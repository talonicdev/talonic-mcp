import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, runTool, sleep as defaultSleep } from "./_http.js"
import { validationError, type ToolResult, zUuid } from "./_shared.js"

/**
 * Contract Party Management tools: who a contract's parties are and to whom
 * a letter about it goes. A contract is a row of one of the workspace's data
 * products (`product_id` + `row_id`); the platform fills each row's parties
 * from the data it already holds as suggestions, and a person confirms,
 * rejects or fixes them. From the roles in force on a day the platform
 * computes the effective partner and the addressee (what Document
 * Generation prints).
 *
 * All tools hit `/v1/parties/*` with the caller's bearer; the platform owns
 * every rule (Sources IAM on rows and parties, scopes per route). The routes
 * are the ones `parties-api.controller.ts` serves; `scripts/check-routes.mjs`
 * fails CI when one is missing from the public spec.
 *
 * The loop an agent runs: talonic_parties_status → talonic_parties_issues
 * (parties needing attention) → talonic_parties_party per flagged party →
 * talonic_parties_contract per contract → talonic_parties_set_role /
 * _confirm (only when the user asked) → _merge duplicates (only when the
 * user asked) → talonic_parties_issues again.
 */

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const
const write = (idempotent: boolean, destructive = false) =>
  ({
    readOnlyHint: false,
    destructiveHint: destructive,
    idempotentHint: idempotent,
    openWorldHint: false,
  }) as const

/** How often a wait polls. @internal */
export const PARTIES_POLL_INTERVAL_MS = 5_000
/** The longest `wait_seconds` a read or sync accepts. @internal */
export const READ_MAX_WAIT_S = 600
/** The most roles one confirm call sends. @internal */
export const CONFIRM_MAX_ROLES = 200

/** Injectable clock and delay for the wait (tests). */
export interface PartiesDeps {
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const ROLES = [
  "partner",
  "our_party",
  "manager",
  "tenant",
  "previous_owner",
  "new_owner",
  "contact",
  "invoice_recipient",
] as const
const KINDS = ["person", "company", "owners_association", "unknown"] as const
const SALUTATIONS = ["herr", "frau", "eheleute", "firma", "weg"] as const
const ROLE_STATES = ["suggested", "confirmed", "rejected"] as const

const ROLES_EXPLAINED =
  "Roles: partner (the contract partner), our_party (our own company on the contract), manager (Verwalter: acts for a company or an owners' association and is written to on its behalf; represents_id names the role it acts for), tenant (with enters_contract: true the tenant is the temporary partner for the lease period valid_from..valid_to), previous_owner / new_owner (an owner change: the new owner holds from the transfer date valid_from), contact, invoice_recipient."
const COMPUTED_RULE =
  "The effective partner (the tenant entering the contract during its lease, else the partner) and the addressee (the effective partner's Verwalter when it has one, else the effective partner) are computed by the platform from the roles in force on the day; never set them yourself, fix the roles."
const DECISION_RULE =
  "Suggestions never overwrite a person's decision (a confirmed role stays, a rejected one never comes back). Confirming, rejecting and merging are a person's decisions: only do them when the user asked."
const CONTRACT_IS_A_ROW =
  "A contract is a row of a data product: `product_id` (contracts[].row.data_product_id from talonic_parties_contracts, or products[].id from talonic_parties_status) and `row_id` (contracts[].row.row_id)."

const dateArg = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "a date YYYY-MM-DD")
  .describe("ISO date YYYY-MM-DD.")
const productIdArg = zUuid().describe(
  "Data product of the contract (contracts[].row.data_product_id from talonic_parties_contracts).",
)
const rowIdArg = z
  .string()
  .min(1)
  .max(200)
  .describe("The contract's row id in that product (contracts[].row.row_id).")
const partyIdArg = zUuid().describe("Party id (from talonic_parties_search, _issues or _contract).")
const limitArg = (max: number, dflt: number) =>
  z
    .number()
    .int()
    .min(1)
    .max(max)
    .optional()
    .describe(`At most this many (1-${max}, default ${dflt}).`)
const offsetArg = z
  .number()
  .int()
  .min(0)
  .max(1_000_000)
  .optional()
  .describe("Skip this many (paging; default 0).")

/** Clamp a requested wait to [0, max] whole seconds. */
function waitSeconds(requested: number | undefined, max: number): number {
  const n = Number.isFinite(requested) ? (requested as number) : 0
  return Math.max(0, Math.min(max, Math.floor(n)))
}

/** Drop undefined entries so a body names only what the caller gave. */
function defined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

/** `/v1/parties/rows/:productId/:rowId` (the row id is free text, so it is encoded). */
const rowPath = (productId: string, rowId: string) =>
  `/v1/parties/rows/${productId}/${encodeURIComponent(rowId)}`

/** Poll `probe` every 5 s until `done` says so or the wait runs out. */
async function waitUntil<T>(
  probe: () => Promise<T>,
  done: (v: T) => boolean,
  waitS: number,
  deps: PartiesDeps,
): Promise<{ last: T; waited_ms: number; still_running: boolean; poll_error?: string }> {
  const sleep = deps.sleep ?? defaultSleep
  const now = deps.now ?? Date.now
  const start = now()
  const deadline = start + waitS * 1000
  let last = await probe()
  let pollError: string | undefined
  while (!done(last) && now() < deadline) {
    await sleep(Math.min(PARTIES_POLL_INTERVAL_MS, deadline - now()))
    try {
      last = await probe()
    } catch (err) {
      pollError = err instanceof Error ? err.message : String(err)
      break
    }
  }
  return {
    last,
    waited_ms: now() - start,
    still_running: pollError !== undefined || !done(last),
    ...(pollError ? { poll_error: pollError } : {}),
  }
}

// ── Overview ───────────────────────────────────────────────────────────────

const STATUS_DESCRIPTION = [
  "Contract Party Management at a glance: whether it is set up, the data products whose rows are the contracts (with row counts), how many rows are filled, the document-read queue, the party count, how many parties need attention, when the last sync finished and the CRM directory's link counts.",
  "USE WHEN: starting any parties work, or to report where things stand. The loop: talonic_parties_status → talonic_parties_issues → talonic_parties_party per flagged party → talonic_parties_contract per contract → talonic_parties_set_role / talonic_parties_confirm → talonic_parties_merge duplicates → talonic_parties_issues again.",
  "NOT FOR: which parties need fixing (talonic_parties_issues); one contract (talonic_parties_contract).",
  "",
  "ARGS: none.",
  "RETURNS: { configured, first_fill, syncing, finding_fields, setup_errors[] { product_id, name, error }, products[] { id, name, rows }, rows, rows_read, reads { pending, running, done, failed }, parties, needs_attention, synced_at, directory { active, label, linked, pick, none } }.",
].join("\n")

/** @internal */
export function handleStatus(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/parties/status"))
}

const ISSUES_DESCRIPTION = [
  "The parties worklist: every party that needs a person, because a problem on one of its contracts names it (no partner, several partners, the reference table names another partner, person-or-company unknown, no postal address, a Verwalter for a party no longer on the contract, a tenant entering the contract without a lease period, an owner change without a transfer date, an owners' association without a Verwalter, cost unit disagreeing or missing, not read, read failed, not in the CRM directory, several CRM matches, CRM address far from the contract's) or because it has a duplicate candidate.",
  "USE WHEN: deciding what to fix; open each party with talonic_parties_party (its contracts with their issues[] codes and details, and its duplicates[]). Duplicates are merge candidates: never merged on their own (talonic_parties_merge, only when the user asked).",
  "NOT FOR: the headline counts (talonic_parties_status); the whole register (talonic_parties_search).",
  "",
  "ARGS: `query` (name, street, postcode, town or email contains), `kind` person|company|owners_association|unknown, `product_id` (only contracts of that data product), `scope` all (default: every party) | partners (contract partners only), `limit` (1-5000, default 200), `offset`.",
  "RETURNS: { total, needs_attention, offset, limit, data[] { id, kind, display_name, street, postcode, town, email, phone, status, contracts, roles[], issues (problems plus duplicate candidates) } }.",
].join("\n")

export const issuesInputSchema = {
  query: z.string().max(300).optional().describe("Name, address or email contains."),
  kind: z.enum(KINDS).optional().describe("Only parties of this kind."),
  product_id: zUuid().optional().describe("Only contracts of this data product."),
  scope: z
    .enum(["all", "partners"])
    .optional()
    .describe("all (default): every party; partners: contract partners only."),
  limit: limitArg(5000, 200),
  offset: offsetArg,
}

/** @internal */
export function handleIssues(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    query?: string
    kind?: string
    product_id?: string
    scope?: "all" | "partners"
    limit?: number
    offset?: number
  },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/parties", {
      params: {
        attention: "true",
        scope: args.scope === "partners" ? undefined : "all",
        q: args.query,
        kind: args.kind,
        product_id: args.product_id,
        limit: args.limit,
        offset: args.offset,
      },
    }),
  )
}

// ── Contracts ──────────────────────────────────────────────────────────────

const CONTRACT_DESCRIPTION = [
  "One contract's parties on a day: every role row with its party, state (suggested|confirmed|rejected), confidence and evidence (data fields, document quotes, reference table rows, a person's word); the computed view (partner, manager, tenant, previous and new owner, effective partner, addressee with its postal address lines, contacts, state); the issues; the document read's state; the cost unit the documents name.",
  "USE WHEN: checking or fixing a flagged contract; you need role ids (roles[].id) for talonic_parties_set_role or talonic_parties_confirm, or to answer who the partner is and where a letter goes.",
  CONTRACT_IS_A_ROW,
  ROLES_EXPLAINED,
  COMPUTED_RULE,
  "NOT FOR: one party's contracts (talonic_parties_contracts); the worklist (talonic_parties_issues).",
  "",
  "ARGS: `product_id`, `row_id`, `on` (YYYY-MM-DD; default today: the roles in force on that day).",
  "RETURNS: { row { data_product_id, product_name, row_id, label, document_ids[] }, on, roles[] { id, party_id, role, represents_id, valid_from, valid_to, enters_contract, state, confidence, evidence[], origin, decided_by, decided_at, note, party }, view { partner, manager, tenant, previous_owner, new_owner, effective_partner, addressee { ...party, address_lines[] }, contacts[], state }, issues[] { code, detail, role_ids[], party_ids[] }, read { status, read_at, error, notes, read_with }, cost_unit { documents, quote } }.",
].join("\n")

export const contractInputSchema = {
  product_id: productIdArg,
  row_id: rowIdArg,
  on: dateArg.optional().describe("The day to read the parties for (YYYY-MM-DD; default today)."),
}

/** @internal */
export function handleContract(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { product_id: string; row_id: string; on?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", rowPath(args.product_id, args.row_id), {
      params: { on: args.on },
    }),
  )
}

// ── One party's lists: contracts, documents, history ───────────────────────

type Section = "contracts" | "documents" | "history"

/** One literal per section, so the route check sees each path. */
const SECTION_PATHS: Record<Section, (partyId: string) => string> = {
  contracts: (id) => `/v1/parties/${id}/contracts`,
  documents: (id) => `/v1/parties/${id}/documents`,
  history: (id) => `/v1/parties/${id}/history`,
}

const SECTION_ARGS =
  "ARGS: `party_id`, `product_id` (only contracts of that data product), `limit` (1-500, default 50), `offset`."

const CONTRACTS_DESCRIPTION = [
  "One party's contracts, a page at a time: per contract the row (product_id, row_id, label, documents, read state), this party's roles on it with their evidence, the other parties' roles, the computed view and the contract's issues.",
  "USE WHEN: answering which contracts a party is on and in what role, or finding the product_id and row_id to open one contract with talonic_parties_contract or to add a role with talonic_parties_set_role.",
  "NOT FOR: one contract's full parties (talonic_parties_contract); the party's details (talonic_parties_party).",
  "",
  SECTION_ARGS,
  "RETURNS: { total, offset, limit, data[] { row { data_product_id, product_name, row_id, label, document_ids[], read }, roles[], others[] { ...role, party }, view, issues[] } }.",
].join("\n")

const DOCUMENTS_DESCRIPTION = [
  "The documents a party appears in, a page at a time: each document of its contracts with its filename, the contract's label and the quotes that name the party.",
  "USE WHEN: showing where a party comes from, or checking the evidence before confirming its roles.",
  "NOT FOR: the document itself (talonic_get_document); the party's contracts (talonic_parties_contracts).",
  "",
  SECTION_ARGS,
  "RETURNS: { total, offset, limit, data[] { document_id, filename, row_label, quotes[] } }.",
].join("\n")

const HISTORY_DESCRIPTION = [
  "A party's history, newest first, a page at a time: its names (aliases, former names), role dates on its contracts, its CRM directory link and the decisions people took.",
  "USE WHEN: the user asks what changed on a party, who decided something, or since when it holds a role.",
  "NOT FOR: its current details (talonic_parties_party).",
  "",
  SECTION_ARGS,
  "RETURNS: { total, offset, limit, data[] } (each entry a dated event with what changed and who did it).",
].join("\n")

export const sectionInputSchema = {
  party_id: partyIdArg,
  product_id: zUuid().optional().describe("Only contracts of this data product."),
  limit: limitArg(500, 50),
  offset: offsetArg,
}

/** @internal */
export function handlePartySection(
  getToken: () => string,
  baseUrl: string | undefined,
  section: Section,
  args: { party_id: string; product_id?: string; limit?: number; offset?: number },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", SECTION_PATHS[section](args.party_id), {
      params: { product_id: args.product_id, limit: args.limit, offset: args.offset },
    }),
  )
}

// ── Parties ────────────────────────────────────────────────────────────────

const SEARCH_DESCRIPTION = [
  "Search the party register (people, companies, owners' associations): name (aliases included), street, postcode, town or email contains the query; each with how many contracts it is on, its roles and how many problems it has. By default the contract partners; `scope: all` lists every party (Verwalter, tenants, contacts too).",
  "USE WHEN: finding a party to add to a contract (its id for talonic_parties_set_role), checking whether a party already exists before creating one, or finding duplicates by name.",
  "NOT FOR: the parties needing attention (talonic_parties_issues); one party in full (talonic_parties_party).",
  "",
  "ARGS: `query`, `kind` person|company|owners_association|unknown, `product_id`, `scope` partners (default) | all, `limit` (1-5000, default 200), `offset`.",
  "RETURNS: { total, needs_attention, offset, limit, data[] { id, kind, display_name, salutation, title, first_name, last_name, company_name, legal_form, street, postcode, town, country, email, phone, preferred_channel, external_refs, status, contracts, roles[], issues } }.",
].join("\n")

export const searchInputSchema = {
  query: z.string().max(300).optional().describe("Name, address or email contains."),
  kind: z.enum(KINDS).optional().describe("Only parties of this kind."),
  product_id: zUuid().optional().describe("Only contracts of this data product."),
  scope: z
    .enum(["partners", "all"])
    .optional()
    .describe("partners (default): contract partners; all: every party."),
  limit: limitArg(5000, 200),
  offset: offsetArg,
}

/** @internal */
export function handleSearch(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    query?: string
    kind?: string
    product_id?: string
    scope?: string
    limit?: number
    offset?: number
  },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/parties", {
      params: {
        q: args.query,
        kind: args.kind,
        product_id: args.product_id,
        scope: args.scope === "all" ? "all" : undefined,
        limit: args.limit,
        offset: args.offset,
      },
    }),
  )
}

const PARTY_FIELD_KEYS = [
  "kind",
  "display_name",
  "salutation",
  "title",
  "first_name",
  "last_name",
  "company_name",
  "legal_form",
  "street",
  "postcode",
  "town",
  "country",
  "email",
  "phone",
  "preferred_channel",
  "external_refs",
] as const
type PartyFieldKey = (typeof PARTY_FIELD_KEYS)[number]

const PARTY_DESCRIPTION = [
  "Read, change or create one party. With `party_id` alone: the party with where its letters go and why, its contracts (with its roles, the other parties and each contract's issues), the documents it appears in, its contacts (members) and the companies it is a contact of, duplicate candidates, other names, history and its CRM directory link (with candidates to pick from). `overview: true` leaves the long lists out and counts them (page them with talonic_parties_contracts, _documents, _history). With `party_id` and fields: changes those fields (the rest stay; a person's value beats every other source). Without `party_id`: creates a party; `display_name` is required (kind and salutation are inferred from it when not given).",
  "USE WHEN: checking a flagged party; fixing its name, kind (person or company decides a letter's wording), salutation or postal address (issues kind_unknown, address_missing); creating a party the data misses before adding it to a contract with talonic_parties_set_role. Search first (talonic_parties_search) so you do not create a duplicate.",
  "NOT FOR: its role on a contract (talonic_parties_set_role); combining duplicates (talonic_parties_merge); other names (talonic_parties_names).",
  "",
  "ARGS: `party_id` (omit to create), `overview` (read only), `product_id` (read only: only contracts of that data product); fields `kind` person|company|owners_association|unknown, `display_name`, `salutation` herr|frau|eheleute|firma|weg, `title`, `first_name`, `last_name`, `company_name`, `legal_form`, `street`, `postcode`, `town`, `country`, `email`, `phone`, `preferred_channel` post|email, `external_refs` { name: value } (null clears a text field).",
  "RETURNS: read { party, merged_into, letters { party_id, display_name, address_lines[], reason_code, reason } | null, contracts[], documents[], members[] { id, function, party }, member_of[], duplicates[] { party_id, display_name, postcode, reason }, issues[], names[], history[], directory { active, link, entry, candidates[], crm_address, document_address }, directory_people[] } (overview: contracts without the long lists, plus counts { contracts, documents, history }); change or create: the party.",
].join("\n")

const nullableText = (max: number) => z.string().max(max).nullable().optional()

export const partyInputSchema = {
  party_id: partyIdArg.optional().describe("The party to read or change; omit to create one."),
  overview: z
    .boolean()
    .optional()
    .describe("Read: leave the long lists out and count them instead."),
  product_id: zUuid().optional().describe("Read: only contracts of this data product."),
  kind: z.enum(KINDS).optional().describe("Person, company, owners' association or unknown."),
  display_name: z
    .string()
    .min(1)
    .max(300)
    .optional()
    .describe("Name as printed; required to create."),
  salutation: z.enum(SALUTATIONS).nullable().optional().describe("Salutation; null clears it."),
  title: nullableText(60).describe("Academic title, e.g. 'Dr.'."),
  first_name: nullableText(120).describe("Given name (persons); null clears it."),
  last_name: nullableText(120).describe("Family name (persons); null clears it."),
  company_name: nullableText(300).describe("Registered company name (companies)."),
  legal_form: nullableText(60).describe("e.g. GmbH, AG, KG."),
  street: nullableText(200).describe("Street and house number."),
  postcode: nullableText(12).describe("Postal code."),
  town: nullableText(120).describe("Town or city."),
  country: nullableText(60).describe("Country, e.g. 'DE' or 'Germany'."),
  email: z.string().email().nullable().optional().describe("Email address; null clears it."),
  phone: nullableText(60).describe("Phone number."),
  preferred_channel: z
    .enum(["post", "email"])
    .nullable()
    .optional()
    .describe("How letters to this party are sent."),
  external_refs: z
    .record(z.string(), z.string())
    .optional()
    .describe("References in other systems by name, e.g. { debitor: '10042' }."),
}

/** @internal */
export function handleParty(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { party_id?: string; overview?: boolean; product_id?: string } & Partial<
    Record<PartyFieldKey, unknown>
  >,
): Promise<ToolResult> {
  const fields = defined(Object.fromEntries(PARTY_FIELD_KEYS.map((k) => [k, args[k]])))
  const changing = Object.keys(fields).length > 0
  if (args.party_id) {
    const path = `/v1/parties/${args.party_id}`
    return runTool(() =>
      changing
        ? apiJson(getToken, baseUrl, "PATCH", path, { body: fields })
        : apiJson(getToken, baseUrl, "GET", path, {
            params: {
              view: args.overview ? "overview" : undefined,
              product_id: args.product_id,
            },
          }),
    )
  }
  if (typeof args.display_name !== "string" || !args.display_name.trim()) {
    return Promise.resolve(
      validationError("pass party_id to read or change a party, or display_name to create one."),
    )
  }
  return runTool(() => apiJson(getToken, baseUrl, "POST", "/v1/parties", { body: fields }))
}

// ── Roles ──────────────────────────────────────────────────────────────────

const SET_ROLE_DESCRIPTION = [
  "Add a role to a contract, or change one role row. With `product_id`, `row_id`, `party_id` and `role`: adds the party in that role (confirmed unless `state` says suggested; a party already holding that role on the contract has that row updated). With `role_id`: changes that row: confirm or reject it (`state`), move it to another role or party, set the period, the Verwalter link or enters_contract. Any change by a person is a decision: an edited suggestion becomes confirmed unless `state` says otherwise.",
  "USE WHEN: fixing a contract's parties after reading talonic_parties_contract: a partner missing (no_partner), two partners at once (reject the wrong one, or give the old one valid_to), a Verwalter for the right party (represents_id), a tenant entering the contract (enters_contract with valid_from / valid_to), an owner change (previous_owner, new_owner with valid_from = transfer date).",
  CONTRACT_IS_A_ROW,
  ROLES_EXPLAINED,
  COMPUTED_RULE,
  DECISION_RULE,
  "NOT FOR: confirming several checked roles at once (talonic_parties_confirm); the party's own details (talonic_parties_party).",
  "",
  "ARGS: add: `product_id`, `row_id`, `party_id`, `role`; change: `role_id` (roles[].id from talonic_parties_contract) and optional `party_id`, `role`. Both: `state` suggested|confirmed|rejected, `represents_id` (another role id on the same contract; null clears), `valid_from`, `valid_to` (YYYY-MM-DD; null clears), `enters_contract` (tenant only), `note` (say where the decision comes from).",
  "RETURNS: the role row { id, data_product_id, row_id, party_id, role, represents_id, valid_from, valid_to, enters_contract, state, confidence, evidence[], origin, decided_by, decided_at, note }.",
].join("\n")

export const setRoleInputSchema = {
  product_id: productIdArg.optional().describe("Add: the contract's data product."),
  row_id: rowIdArg.optional().describe("Add: the contract's row id in that product."),
  role_id: zUuid()
    .optional()
    .describe("Change: the role row (roles[].id from talonic_parties_contract)."),
  party_id: partyIdArg.optional().describe("Add: the party; change: move the row to this party."),
  role: z.enum(ROLES).optional().describe("The role."),
  state: z
    .enum(ROLE_STATES)
    .optional()
    .describe("confirmed or rejected (a person's decision); suggested keeps it open."),
  represents_id: zUuid()
    .nullable()
    .optional()
    .describe("Manager / contact: the role id it acts for on the same contract; null clears."),
  valid_from: dateArg.nullable().optional().describe("From this day (YYYY-MM-DD); null clears."),
  valid_to: dateArg.nullable().optional().describe("Until this day (YYYY-MM-DD); null clears."),
  enters_contract: z
    .boolean()
    .optional()
    .describe("Tenant: enters the contract (temporary partner for the lease period)."),
  note: z.string().max(1000).nullable().optional().describe("Why; where the decision comes from."),
}

/** @internal */
export function handleSetRole(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    product_id?: string
    row_id?: string
    role_id?: string
    party_id?: string
    role?: string
    state?: string
    represents_id?: string | null
    valid_from?: string | null
    valid_to?: string | null
    enters_contract?: boolean
    note?: string | null
  },
): Promise<ToolResult> {
  const { product_id, row_id, role_id, ...rest } = args
  const body = defined(rest)
  const adding = product_id !== undefined || row_id !== undefined
  if (adding === !!role_id) {
    return Promise.resolve(
      validationError(
        "pass product_id and row_id (with party_id and role) to add, or role_id to change.",
      ),
    )
  }
  if (adding) {
    if (!product_id || !row_id) {
      return Promise.resolve(validationError("adding a role needs both product_id and row_id."))
    }
    if (!args.party_id || !args.role) {
      return Promise.resolve(validationError("adding a role needs party_id and role."))
    }
    return runTool(() =>
      apiJson(getToken, baseUrl, "POST", `${rowPath(product_id, row_id)}/roles`, { body }),
    )
  }
  if (Object.keys(body).length === 0) {
    return Promise.resolve(
      validationError(
        "name something to change: state, role, party_id, represents_id, valid_from, valid_to, enters_contract or note.",
      ),
    )
  }
  return runTool(() =>
    apiJson(getToken, baseUrl, "PATCH", `/v1/parties/roles/${role_id}`, { body }),
  )
}

const CONFIRM_DESCRIPTION = [
  `Confirm several suggested roles the user checked, by their ids (up to ${CONFIRM_MAX_ROLES}): each is confirmed on its own, so one refused role never blocks the others. Confirming says a person checked them; it is the user's decision, so only call this when the user asked, and say first how many you will confirm.`,
  "USE WHEN: the user accepts the suggestions of one or more contracts after you showed them (role ids from talonic_parties_contract roles[].id, or talonic_parties_contracts).",
  "There is no confirm-by-confidence across the workspace: pick the roles to confirm from the contracts you read.",
  DECISION_RULE,
  "NOT FOR: rejecting or fixing one role (talonic_parties_set_role).",
  "",
  `ARGS: \`role_ids[]\` (1-${CONFIRM_MAX_ROLES}), \`note\` (say where the decision comes from; recorded on each role).`,
  "RETURNS: { confirmed, failed, rows[] { role_id, ok, role? (the confirmed row), error? } }.",
].join("\n")

export const confirmInputSchema = {
  role_ids: z
    .array(zUuid())
    .min(1)
    .max(CONFIRM_MAX_ROLES)
    .describe("The role rows to confirm (roles[].id from talonic_parties_contract)."),
  note: z.string().max(1000).optional().describe("Why; where the decision comes from."),
}

/** @internal */
export function handleConfirm(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { role_ids: string[]; note?: string },
): Promise<ToolResult> {
  const ids = [...new Set(args.role_ids ?? [])]
  if (!ids.length) return Promise.resolve(validationError("pass at least one role id."))
  return runTool(async () => {
    const rows: Array<{ role_id: string; ok: boolean; role?: unknown; error?: string }> = []
    for (const id of ids) {
      try {
        const role = await apiJson(getToken, baseUrl, "PATCH", `/v1/parties/roles/${id}`, {
          body: { state: "confirmed", ...(args.note !== undefined ? { note: args.note } : {}) },
        })
        rows.push({ role_id: id, ok: true, role })
      } catch (err) {
        rows.push({
          role_id: id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    const confirmed = rows.filter((r) => r.ok).length
    return { confirmed, failed: rows.length - confirmed, rows }
  })
}

const MERGE_DESCRIPTION = [
  "Merge one party into another: every role and contact link moves to the survivor (`into`); a role the survivor already holds on the same contract keeps the survivor's row and takes the merged one's evidence. The merged party stays only as a pointer to the survivor. Cannot be undone; a person's decision, so only when the user asked. Run with dry_run first.",
  "USE WHEN: talonic_parties_party lists duplicates[] and the user confirms they are the same party.",
  "NOT FOR: two different parties with similar names; moving one role to another party (talonic_parties_set_role with role_id and party_id).",
  "",
  "ARGS: `party_id` (the one that goes), `into` (the survivor), `dry_run`.",
  "RETURNS: { dry_run, moves, combined, party } (party: the survivor, after a real merge).",
].join("\n")

export const mergeInputSchema = {
  party_id: partyIdArg.describe("The party merged away."),
  into: zUuid().describe("The party that survives."),
  dry_run: z.boolean().optional().describe("Count the moves; nothing changes."),
}

/** @internal */
export function handleMerge(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { party_id: string; into: string; dry_run?: boolean },
): Promise<ToolResult> {
  if (args.party_id === args.into) {
    return Promise.resolve(validationError("a party cannot be merged into itself."))
  }
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", `/v1/parties/${args.party_id}/merge`, {
      body: { into: args.into, dry_run: args.dry_run ?? false },
    }),
  )
}

// ── Reading and syncing ────────────────────────────────────────────────────

const READ_STATES_BUSY = new Set(["pending", "running"])

const READ_DESCRIPTION = [
  "Have one contract's documents read for its parties: the platform reads the documents in the background and adds every party and role it finds as a suggestion, with quotes, merged with what the contract's data already says. A read is extra work on the documents; ask for it only when the contract's data names too little (issues not_read, no_partner) or the user asked. A contract already queued or being read is not queued twice. With `status: true` only reports the read's state; without a contract, `status: true` reports the workspace's read queue. Pass `wait_seconds` to wait until the read is done or failed (polls every 5 s).",
  "USE WHEN: one contract's parties are missing or wrong and its data cannot fill them; then talonic_parties_contract to see the new suggestions.",
  CONTRACT_IS_A_ROW,
  DECISION_RULE,
  "NOT FOR: filling every contract from the data products again (talonic_parties_sync); reading many contracts at once (ask for one at a time, only where needed).",
  "",
  "ARGS: `product_id` + `row_id` (the contract), `status` (only report; nothing is queued), `wait_seconds` (0-600, default 0).",
  "RETURNS: queued { status: pending|running }; a contract's state { status, read_at, error, notes, read_with }; the queue (no contract) { reads { pending, running, done, failed }, rows, rows_read }. After a wait also { waited_ms, still_running } and `read` (the last state: done, failed with error, or still pending|running).",
].join("\n")

export const readInputSchema = {
  product_id: productIdArg.optional().describe("The contract's data product."),
  row_id: rowIdArg.optional().describe("The contract's row id in that product."),
  status: z.boolean().optional().describe("Only report; nothing is queued."),
  wait_seconds: z
    .number()
    .min(0)
    .max(READ_MAX_WAIT_S)
    .optional()
    .describe(`Seconds to wait for the read to finish (0-${READ_MAX_WAIT_S}).`),
}

interface RowRead {
  read?: { status?: string | null; read_at?: string | null; error?: string | null } | null
}
interface PartiesStatus {
  syncing?: boolean
  rows?: number
  rows_read?: number
  reads?: Record<string, number>
  synced_at?: string | null
}

const queueBusy = (s: PartiesStatus) =>
  (s.reads?.["pending"] ?? 0) + (s.reads?.["running"] ?? 0) > 0

/** @internal */
export function handleRead(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { product_id?: string; row_id?: string; status?: boolean; wait_seconds?: number },
  deps: PartiesDeps = {},
): Promise<ToolResult> {
  const waitS = waitSeconds(args.wait_seconds, READ_MAX_WAIT_S)
  const hasRow = !!args.product_id && !!args.row_id
  if (!!args.product_id !== !!args.row_id) {
    return Promise.resolve(validationError("a contract needs both product_id and row_id."))
  }
  if (!hasRow && !args.status) {
    return Promise.resolve(
      validationError(
        "pass product_id and row_id to read one contract, or status: true for the read queue. To fill every contract from the data, use talonic_parties_sync.",
      ),
    )
  }
  if (!hasRow) {
    const queue = () => apiJson<PartiesStatus>(getToken, baseUrl, "GET", "/v1/parties/status")
    return runTool(async () => {
      if (waitS === 0) {
        const s = await queue()
        return { reads: s.reads, rows: s.rows, rows_read: s.rows_read }
      }
      const w = await waitUntil(queue, (s) => !queueBusy(s), waitS, deps)
      return {
        reads: w.last.reads,
        rows: w.last.rows,
        rows_read: w.last.rows_read,
        waited_ms: w.waited_ms,
        still_running: w.still_running,
        ...(w.poll_error ? { poll_error: w.poll_error } : {}),
      }
    })
  }
  const path = rowPath(args.product_id!, args.row_id!)
  const rowRead = async () => (await apiJson<RowRead>(getToken, baseUrl, "GET", path)).read ?? null
  return runTool(async () => {
    let queued: Record<string, unknown> | null = null
    if (!args.status) {
      queued = await apiJson<Record<string, unknown>>(getToken, baseUrl, "POST", `${path}/read`)
      if (waitS === 0) return queued
    } else if (waitS === 0) {
      return (await rowRead()) ?? { status: null }
    }
    const w = await waitUntil(rowRead, (r) => !READ_STATES_BUSY.has(r?.status ?? ""), waitS, deps)
    const failed = w.last?.status === "failed"
    return {
      ...(queued ?? {}),
      read: w.last,
      waited_ms: w.waited_ms,
      still_running: w.still_running,
      ...(w.poll_error ? { poll_error: w.poll_error } : {}),
      next: w.still_running
        ? "Still reading: call talonic_parties_read with status: true (and wait_seconds) later."
        : failed
          ? "The read failed (read.error); tell the user. The contract keeps what its data says."
          : "Read done: open the contract with talonic_parties_contract.",
    }
  })
}

const SYNC_DESCRIPTION = [
  "Bring the contracts' parties in line with the workspace's data products now: every contract row is filled again from its data (mapped fields, the field registry, the Contracts app), new rows are registered and sure duplicates are merged. A full pass runs in the background; named `row_ids` are filled at once. Fills only make suggestions and never overwrite a person's decision. Pass `wait_seconds` to wait until the full pass finished (polls the status every 5 s).",
  "USE WHEN: new contracts or changed data should show now instead of at the next scheduled sync (every 15 minutes), or after the user changed group companies or the CRM directory.",
  "NOT FOR: reading one contract's documents (talonic_parties_read).",
  "",
  "ARGS: `row_ids[]` (only these contract rows, up to 5000; omit for a full pass), `wait_seconds` (0-600, default 0; full pass only).",
  "RETURNS: { started: true }; after a wait also { syncing, synced_at, rows, waited_ms, still_running }.",
].join("\n")

export const syncInputSchema = {
  row_ids: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(5000)
    .optional()
    .describe("Only these contract rows (contracts[].row.row_id); omit for a full pass."),
  wait_seconds: z
    .number()
    .min(0)
    .max(READ_MAX_WAIT_S)
    .optional()
    .describe(`Seconds to wait for a full pass to finish (0-${READ_MAX_WAIT_S}).`),
}

/** @internal */
export function handleSync(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { row_ids?: string[]; wait_seconds?: number },
  deps: PartiesDeps = {},
): Promise<ToolResult> {
  const waitS = waitSeconds(args.wait_seconds, READ_MAX_WAIT_S)
  return runTool(async () => {
    const started = await apiJson<Record<string, unknown>>(
      getToken,
      baseUrl,
      "POST",
      "/v1/parties/sync",
      { body: args.row_ids ? { row_ids: args.row_ids } : {} },
    )
    if (waitS === 0 || args.row_ids) return started
    const w = await waitUntil(
      () => apiJson<PartiesStatus>(getToken, baseUrl, "GET", "/v1/parties/status"),
      (s) => !s.syncing,
      waitS,
      deps,
    )
    return {
      ...started,
      syncing: w.last.syncing ?? false,
      synced_at: w.last.synced_at ?? null,
      rows: w.last.rows,
      waited_ms: w.waited_ms,
      still_running: w.still_running,
      ...(w.poll_error ? { poll_error: w.poll_error } : {}),
    }
  })
}

// ── Names, CRM directory link, address choice ──────────────────────────────

const NAMES_DESCRIPTION = [
  "A party's other names: add an alias or a former name (with the day it ended), confirm or reject a suggested name, or remove a name a person added. Other names make the party findable under them (talonic_parties_search) and keep documents with an old name on the same party.",
  "USE WHEN: the user says a party is also called X, was renamed (former name with valid_to), or a suggested name in talonic_parties_party names[] is right or wrong.",
  "NOT FOR: the party's printed name (talonic_parties_party display_name); two parties that are one (talonic_parties_merge).",
  "",
  "ARGS: add: `party_id`, `name`, `kind` alias|former, `valid_to` (former only, YYYY-MM-DD), `note`; decide: `name_id` (names[].id from talonic_parties_party) and `state` confirmed|rejected; remove: `name_id` and `remove: true` (names from the data are rejected instead).",
  "RETURNS: add / decide: the name { id, party_id, name, kind, valid_to, state, source, decided_by, decided_at }; remove: { deleted: true }.",
].join("\n")

export const namesInputSchema = {
  party_id: partyIdArg.optional().describe("Add: the party."),
  name: z.string().min(1).max(300).optional().describe("Add: the other name."),
  kind: z
    .enum(["alias", "former"])
    .optional()
    .describe("Add: alias (also called) or former (renamed)."),
  valid_to: dateArg.nullable().optional().describe("Add, former name: the day it ended."),
  note: z.string().max(500).nullable().optional().describe("Add: where this comes from."),
  name_id: zUuid().optional().describe("Decide or remove: the name (names[].id)."),
  state: z.enum(["confirmed", "rejected"]).optional().describe("Decide: confirmed or rejected."),
  remove: z.boolean().optional().describe("Remove: true deletes a name a person added."),
}

/** @internal */
export function handleNames(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    party_id?: string
    name?: string
    kind?: "alias" | "former"
    valid_to?: string | null
    note?: string | null
    name_id?: string
    state?: "confirmed" | "rejected"
    remove?: boolean
  },
): Promise<ToolResult> {
  if (args.name_id) {
    if (args.party_id || args.name !== undefined || args.kind) {
      return Promise.resolve(
        validationError(
          "name_id goes with state (decide) or remove: true (remove), not with add fields.",
        ),
      )
    }
    if (!!args.remove === !!args.state) {
      return Promise.resolve(validationError("with name_id pass either state or remove: true."))
    }
    const path = `/v1/parties/names/${args.name_id}`
    return runTool(() =>
      args.remove
        ? apiJson(getToken, baseUrl, "DELETE", path)
        : apiJson(getToken, baseUrl, "PATCH", path, { body: { state: args.state } }),
    )
  }
  if (!args.party_id || !args.name || !args.kind) {
    return Promise.resolve(
      validationError(
        "pass party_id, name and kind to add a name, or name_id to decide or remove one.",
      ),
    )
  }
  if (args.valid_to && args.kind !== "former") {
    return Promise.resolve(validationError("valid_to belongs to a former name only."))
  }
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", `/v1/parties/${args.party_id}/names`, {
      body: defined({
        name: args.name,
        kind: args.kind,
        valid_to: args.valid_to,
        note: args.note,
      }),
    }),
  )
}

const DIRECTORY_LINK_DESCRIPTION = [
  "Link a party to its entry in the workspace's CRM directory, or unlink it (`external_id: null`). A linked party shows the CRM's address, phone and parent company over the contract sources (a person's own edit still wins); a person's link or unlink is never redone by the automatic linking. The party's contracts are filled again with the new link.",
  "USE WHEN: talonic_parties_party shows directory.link.state pick (several CRM entries match: issue crm_pick) and the user names the right one from directory.candidates[], or a link is wrong.",
  "NOT FOR: which address letters use when the CRM's differs (talonic_parties_address_choice).",
  "",
  "ARGS: `party_id`, `external_id` (the CRM entry's id from directory.candidates[].external_id; null unlinks), `kind` company|contact (the entry's kind; default company).",
  "RETURNS: the party's directory link { state, kind, external_id, candidates[], odd_address, address_choice, decided_by }.",
].join("\n")

export const directoryLinkInputSchema = {
  party_id: partyIdArg,
  external_id: z
    .string()
    .min(1)
    .max(100)
    .nullable()
    .describe("The CRM entry's id (directory.candidates[].external_id); null unlinks."),
  kind: z.enum(["company", "contact"]).optional().describe("The entry's kind (default company)."),
}

/** @internal */
export function handleDirectoryLink(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { party_id: string; external_id: string | null; kind?: "company" | "contact" },
): Promise<ToolResult> {
  if (args.external_id === undefined) {
    return Promise.resolve(validationError("pass external_id, or null to unlink."))
  }
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", `/v1/parties/${args.party_id}/directory-link`, {
      body: defined({ external_id: args.external_id, kind: args.kind }),
    }),
  )
}

const ADDRESS_CHOICE_DESCRIPTION = [
  "Choose which address a linked party's letters use when the CRM's address is far from the contract's (issue crm_address_differs): `crm` or `document`. The party's contracts are filled again with the choice; the automatic linking never changes it.",
  "USE WHEN: talonic_parties_party shows directory.crm_address and directory.document_address and the user says which is right.",
  "NOT FOR: typing a new address (talonic_parties_party with street, postcode, town).",
  "",
  "ARGS: `party_id`, `choice` crm|document.",
  "RETURNS: the party's directory link { state, kind, external_id, odd_address, address_choice, decided_by }.",
].join("\n")

export const addressChoiceInputSchema = {
  party_id: partyIdArg,
  choice: z.enum(["crm", "document"]).describe("crm: the CRM's address; document: the contract's."),
}

/** @internal */
export function handleAddressChoice(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { party_id: string; choice: "crm" | "document" },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", `/v1/parties/${args.party_id}/address-choice`, {
      body: { choice: args.choice },
    }),
  )
}

// ── Contacts and group companies ───────────────────────────────────────────

const MEMBERS_DESCRIPTION = [
  "Add a contact person to a company or an owners' association (with their function), or remove a contact link. A contact is always a person; the company is a company or an owners' association. Adding the same person again updates the function.",
  "USE WHEN: the user names the person to write to at a company (e.g. the WEG's Verwalter contact), or a contact left.",
  "NOT FOR: a contact role on one contract (talonic_parties_set_role with role contact).",
  "",
  "ARGS: add: `party_id` (the company), `person_id`, `function` (e.g. 'Geschäftsführer'); remove: `member_id` (members[].id from talonic_parties_party) alone.",
  "RETURNS: add: the link { id, company_party_id, person_party_id, function }; remove: { ok: true }.",
].join("\n")

export const membersInputSchema = {
  party_id: partyIdArg.optional().describe("Add: the company or owners' association."),
  person_id: zUuid().optional().describe("Add: the person (a party of kind person)."),
  function: z.string().max(200).nullable().optional().describe("Add: their function."),
  member_id: zUuid()
    .optional()
    .describe("Remove: the link (members[].id from talonic_parties_party)."),
}

/** @internal */
export function handleMembers(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { party_id?: string; person_id?: string; function?: string | null; member_id?: string },
): Promise<ToolResult> {
  if (args.member_id) {
    if (args.party_id || args.person_id || args.function !== undefined) {
      return Promise.resolve(validationError("member_id (remove) goes alone."))
    }
    return runTool(() =>
      apiJson(getToken, baseUrl, "DELETE", `/v1/parties/members/${args.member_id}`),
    )
  }
  if (!args.party_id || !args.person_id) {
    return Promise.resolve(
      validationError("pass party_id and person_id to add a contact, or member_id to remove one."),
    )
  }
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", `/v1/parties/${args.party_id}/members`, {
      body: {
        person_id: args.person_id,
        ...(args.function !== undefined ? { function: args.function } : {}),
      },
    }),
  )
}

const GROUP_COMPANIES_DESCRIPTION = [
  "Read the workspace's own companies (the group: lead company, subsidiaries, sisters), or replace them all with `companies`. They tell our side from the contract partner: our own companies never become a contract partner. Replacing deletes every company not in the new list: read first, change, send the whole list, and only when the user asked.",
  "USE WHEN: one of our own companies shows up as a contract partner, or setting up the workspace.",
  "NOT FOR: contract partners (talonic_parties_party).",
  "",
  "ARGS: none to read; `companies[] { name, parent? (another name in the list), relation? subsidiary|sister|parent }` to replace.",
  "RETURNS: { data[] { id, name, parent_id, relation } } (after a replace: the stored list).",
].join("\n")

export const groupCompaniesInputSchema = {
  companies: z
    .array(
      z.object({
        name: z.string().min(1).max(300),
        parent: z.string().max(300).nullable().optional().describe("Another name in the list."),
        relation: z.enum(["subsidiary", "sister", "parent"]).nullable().optional(),
      }),
    )
    .max(1000)
    .optional()
    .describe("The complete new list; omit to read."),
}

/** @internal */
export function handleGroupCompanies(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { companies?: Array<Record<string, unknown>> },
): Promise<ToolResult> {
  return runTool(() =>
    args.companies
      ? apiJson(getToken, baseUrl, "PUT", "/v1/parties/group-companies", {
          body: { companies: args.companies },
        })
      : apiJson(getToken, baseUrl, "GET", "/v1/parties/group-companies"),
  )
}

// ── Registration ───────────────────────────────────────────────────────────

/**
 * True when the platform behind `baseUrl` serves Contract Party Management to
 * this credential (`GET /v1/parties/status` → 200). Both entrypoints call it
 * before registering the tools, so a deployment without the app never lists
 * tools that would 404. Any failure resolves `false`; never throws.
 *
 * @public
 */
export async function probePartiesAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/parties/status"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** The names `registerPartiesTools` lists, in order. @internal */
export const PARTIES_TOOL_NAMES = [
  "talonic_parties_status",
  "talonic_parties_issues",
  "talonic_parties_contract",
  "talonic_parties_contracts",
  "talonic_parties_documents",
  "talonic_parties_history",
  "talonic_parties_search",
  "talonic_parties_party",
  "talonic_parties_names",
  "talonic_parties_directory_link",
  "talonic_parties_address_choice",
  "talonic_parties_set_role",
  "talonic_parties_confirm",
  "talonic_parties_merge",
  "talonic_parties_read",
  "talonic_parties_sync",
  "talonic_parties_members",
  "talonic_parties_group_companies",
] as const

/**
 * Register the eighteen `talonic_parties_*` tools.
 *
 * @public
 */
export function registerPartiesTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const tools: Array<
    [
      (typeof PARTIES_TOOL_NAMES)[number],
      string,
      string,
      Record<string, z.ZodTypeAny>,
      ReturnType<typeof write> | typeof readOnly,
      (args: any) => Promise<ToolResult>,
    ]
  > = [
    [
      "talonic_parties_status",
      "Contract parties status",
      STATUS_DESCRIPTION,
      {},
      readOnly,
      () => handleStatus(getToken, baseUrl),
    ],
    [
      "talonic_parties_issues",
      "Parties needing attention",
      ISSUES_DESCRIPTION,
      issuesInputSchema,
      readOnly,
      (a) => handleIssues(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_contract",
      "One contract's parties",
      CONTRACT_DESCRIPTION,
      contractInputSchema,
      readOnly,
      (a) => handleContract(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_contracts",
      "A party's contracts",
      CONTRACTS_DESCRIPTION,
      sectionInputSchema,
      readOnly,
      (a) => handlePartySection(getToken, baseUrl, "contracts", a),
    ],
    [
      "talonic_parties_documents",
      "A party's documents",
      DOCUMENTS_DESCRIPTION,
      sectionInputSchema,
      readOnly,
      (a) => handlePartySection(getToken, baseUrl, "documents", a),
    ],
    [
      "talonic_parties_history",
      "A party's history",
      HISTORY_DESCRIPTION,
      sectionInputSchema,
      readOnly,
      (a) => handlePartySection(getToken, baseUrl, "history", a),
    ],
    [
      "talonic_parties_search",
      "Search parties",
      SEARCH_DESCRIPTION,
      searchInputSchema,
      readOnly,
      (a) => handleSearch(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_party",
      "Read, change or create a party",
      PARTY_DESCRIPTION,
      partyInputSchema,
      // With fields it overwrites the party's details: destructive per OpenAI's annotation rules.
      write(false, true),
      (a) => handleParty(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_names",
      "A party's other names",
      NAMES_DESCRIPTION,
      namesInputSchema,
      // Removing a name deletes it; rejecting overrides a suggestion: destructive.
      write(true, true),
      (a) => handleNames(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_directory_link",
      "Link a party to the CRM",
      DIRECTORY_LINK_DESCRIPTION,
      directoryLinkInputSchema,
      // Replaces or removes the party's link: destructive.
      write(true, true),
      (a) => handleDirectoryLink(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_address_choice",
      "Choose a party's letter address",
      ADDRESS_CHOICE_DESCRIPTION,
      addressChoiceInputSchema,
      write(true),
      (a) => handleAddressChoice(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_set_role",
      "Add or change a contract role",
      SET_ROLE_DESCRIPTION,
      setRoleInputSchema,
      // Overwrites or rejects a role row: destructive.
      write(true, true),
      (a) => handleSetRole(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_confirm",
      "Confirm checked roles",
      CONFIRM_DESCRIPTION,
      confirmInputSchema,
      write(true),
      (a) => handleConfirm(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_merge",
      "Merge duplicate parties",
      MERGE_DESCRIPTION,
      mergeInputSchema,
      write(true, true),
      (a) => handleMerge(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_read",
      "Read one contract's parties",
      READ_DESCRIPTION,
      readInputSchema,
      write(true),
      (a) => handleRead(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_sync",
      "Refresh parties from the data",
      SYNC_DESCRIPTION,
      syncInputSchema,
      write(true),
      (a) => handleSync(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_members",
      "Company contacts",
      MEMBERS_DESCRIPTION,
      membersInputSchema,
      // Removing a contact link deletes it: destructive.
      write(true, true),
      (a) => handleMembers(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_group_companies",
      "Our group companies",
      GROUP_COMPANIES_DESCRIPTION,
      groupCompaniesInputSchema,
      // With `companies` it replaces the whole list: destructive.
      write(true, true),
      (a) => handleGroupCompanies(getToken, baseUrl, a),
    ],
  ]
  for (const [name, title, description, inputSchema, annotations, handler] of tools) {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations } },
      async (args: unknown) => handler(args) as Promise<any>,
    )
  }
}
