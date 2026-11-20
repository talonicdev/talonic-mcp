import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, runTool, sleep as defaultSleep } from "./_http.js"
import { validationError, type ToolResult, zUuid } from "./_shared.js"

/**
 * Contract Party Management tools: who a contract's parties are and to whom
 * a letter about it goes. The platform reads the parties from the contract
 * documents (and the reference table) as suggestions; a person confirms,
 * rejects or fixes them. From the roles in force on a day the platform
 * computes the effective partner and the addressee (what Document
 * Generation prints).
 *
 * All tools hit `/v1/parties/*` with the caller's bearer; the platform owns
 * every rule (Sources IAM on contracts and parties, scopes per route).
 *
 * The loop an agent runs: talonic_parties_status → _read (dry_run first,
 * then wait) → _issues → _contract per flagged contract → _set_role /
 * _confirm (only when the user asked) → _merge duplicates (only when the
 * user asked) → _issues again.
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

/** How often a read wait polls the queue. @internal */
export const PARTIES_POLL_INTERVAL_MS = 5_000
/** The longest `wait_seconds` a read accepts. @internal */
export const READ_MAX_WAIT_S = 600

/** Injectable clock and delay for the wait (tests). */
export interface PartiesDeps {
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const ROLES = [
  "partner",
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
const ISSUE_CODES = [
  "no_partner",
  "several_partners",
  "reference_disagrees",
  "kind_unknown",
  "address_missing",
  "manager_without_party",
  "tenant_without_period",
  "owner_change_open",
  "cost_unit_disagrees",
  "cost_unit_missing",
  "not_read",
  "read_failed",
  "possible_duplicate",
] as const

const ROLES_EXPLAINED =
  "Roles: partner (the contract partner), manager (Verwalter: acts for a company or an owners' association and is written to on its behalf; represents_id names the role it acts for), tenant (with enters_contract: true the tenant is the temporary partner for the lease period valid_from..valid_to), previous_owner / new_owner (an owner change: the new owner holds from the transfer date valid_from), contact, invoice_recipient."
const COMPUTED_RULE =
  "The effective partner (the tenant entering the contract during its lease, else the partner) and the addressee (the effective partner's Verwalter when it has one, else the effective partner) are computed by the platform from the roles in force on the day; never set them yourself, fix the roles."
const DECISION_RULE =
  "A read only makes suggestions and never overwrites a person's decision (a confirmed role stays, a rejected one never comes back). Confirming, rejecting and merging are a person's decisions: only do them when the user asked."

const dateArg = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "a date YYYY-MM-DD")
  .describe("ISO date YYYY-MM-DD.")
const contractIdArg = zUuid().describe(
  "Contract id (from talonic_parties_contracts or talonic_parties_issues).",
)
const partyIdArg = zUuid().describe("Party id (from talonic_parties_search, _contract or _issues).")

/** Clamp a requested wait to [0, max] whole seconds. */
function waitSeconds(requested: number | undefined, max: number): number {
  const n = Number.isFinite(requested) ? (requested as number) : 0
  return Math.max(0, Math.min(max, Math.floor(n)))
}

/** Drop undefined entries so a body names only what the caller gave. */
function defined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

// ── Overview ───────────────────────────────────────────────────────────────

const STATUS_DESCRIPTION = [
  "Contract Party Management at a glance: how many contracts, how many have confirmed parties, only suggestions, or no partner; active parties; open suggestions; and the parties-read queue.",
  "USE WHEN: starting any parties work, or to report where things stand. The loop: talonic_parties_status → talonic_parties_read (dry_run first, then with wait_seconds) → talonic_parties_issues → talonic_parties_contract per flagged contract → talonic_parties_set_role / talonic_parties_confirm → talonic_parties_merge duplicates → talonic_parties_issues again.",
  "NOT FOR: what to fix (talonic_parties_issues); one contract (talonic_parties_contract).",
  "",
  "ARGS: none.",
  "RETURNS: { contracts, contracts_confirmed, contracts_suggested, contracts_without_partner, parties, suggestions, reads { counts { pending, running, done, failed }, unread, failed } }.",
].join("\n")

/** @internal */
export function handleStatus(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/parties/status"))
}

const ISSUES_DESCRIPTION = [
  "The parties worklist: per contract what looks wrong today (no partner, several partners, the reference table names another partner, person-or-company unknown, no postal address, a Verwalter for a party no longer on the contract, a tenant entering the contract without a lease period, an owner change without a transfer date, cost unit disagreeing or missing, not read, read failed), plus parties that look like duplicates (same name, and postcode when both have one).",
  "USE WHEN: after talonic_parties_read, deciding what to fix; open each flagged contract with talonic_parties_contract. Duplicates are merge candidates: never merged on their own (talonic_parties_merge, only when the user asked).",
  "NOT FOR: the headline counts (talonic_parties_status); all contracts (talonic_parties_contracts).",
  "",
  `ARGS: \`code\` (only this issue; one of ${ISSUE_CODES.join(", ")}).`,
  "RETURNS: { contracts[] { contract_id, contract_key, title, issues[] { code, detail, role_ids[], party_ids[] } }, duplicates[] { name_key, party_ids[], names[] } }.",
].join("\n")

export const issuesInputSchema = {
  code: z.enum(ISSUE_CODES).optional().describe("Only this issue code."),
}

/** @internal */
export function handleIssues(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { code?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/parties/issues", { params: { code: args.code } }),
  )
}

// ── Contracts ──────────────────────────────────────────────────────────────

const CONTRACTS_DESCRIPTION = [
  "List the workspace's contracts with their parties today: effective partner, addressee and Verwalter by name, the parties' state (confirmed: every role counted is confirmed; suggested: any is a suggestion; none: no partner), open suggestions and the read state.",
  "USE WHEN: getting an overview, finding a contract by key, title or party name, or listing contracts still on suggestions (state: suggested) or without a partner (state: none).",
  "NOT FOR: one contract's roles and evidence (talonic_parties_contract); what needs fixing (talonic_parties_issues).",
  "",
  "ARGS: `query` (contract key, title, counterparty, partner or Verwalter contains), `state` confirmed|suggested|none, `limit` (1-5000, default 500).",
  "RETURNS: { total, data[] { id, contract_key, title, counterparty, status, partner, addressee, manager, state, suggestions, read } }.",
].join("\n")

export const contractsInputSchema = {
  query: z.string().optional().describe("Key, title, counterparty, partner or Verwalter contains."),
  state: z
    .enum(["confirmed", "suggested", "none"])
    .optional()
    .describe("Only contracts whose parties are in this state."),
  limit: z.number().int().min(1).max(5000).optional().describe("At most this many (default 500)."),
}

/** @internal */
export function handleContracts(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { query?: string; state?: string; limit?: number },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/parties/contracts", {
      params: { q: args.query, state: args.state, limit: args.limit },
    }),
  )
}

const CONTRACT_DESCRIPTION = [
  "One contract's parties on a day: the computed view (partner, manager, tenant, previous and new owner, effective partner, addressee with its postal address lines, contacts, state), every role row with its party, state (suggested|confirmed|rejected), confidence and evidence (document quotes, reference table rows, a person's word), the issues, the cost unit (documents vs. contract register) and the read state.",
  "USE WHEN: checking or fixing a flagged contract; you need role ids (roles[].id) for talonic_parties_set_role, or to answer who the partner is and where a letter goes.",
  ROLES_EXPLAINED,
  COMPUTED_RULE,
  "NOT FOR: the list of contracts (talonic_parties_contracts); one party across contracts (talonic_parties_party).",
  "",
  "ARGS: `contract_id`, `on` (YYYY-MM-DD; default today: the roles in force on that day).",
  "RETURNS: { contract { id, contract_key, title, counterparty, status }, on, view { partner, manager, tenant, previous_owner, new_owner, effective_partner, addressee { ...party, role_id, role, state, valid_from, valid_to, address_lines[] }, contacts[], state }, roles[] { id, party_id, role, represents_id, valid_from, valid_to, enters_contract, state, confidence, evidence[], origin, decided_by, decided_at, note, party }, issues[], cost_unit { documents, quote, register[] }, reference_names[], read { status, read_at, error, notes, read_with } | null }.",
].join("\n")

export const contractInputSchema = {
  contract_id: contractIdArg,
  on: dateArg.optional().describe("The day to read the parties for (YYYY-MM-DD; default today)."),
}

/** @internal */
export function handleContract(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { contract_id: string; on?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", `/v1/parties/contracts/${args.contract_id}`, {
      params: { on: args.on },
    }),
  )
}

// ── Parties ────────────────────────────────────────────────────────────────

const SEARCH_DESCRIPTION = [
  "Search the party register (people, companies, owners' associations): name, street, postcode, town, email or an external reference contains the query; each with how many contracts it holds a role on.",
  "USE WHEN: finding a party to add to a contract (its id for talonic_parties_set_role), checking whether a party already exists before creating one, or finding duplicates by name.",
  "NOT FOR: one party with its roles (talonic_parties_party); a contract's parties (talonic_parties_contract).",
  "",
  "ARGS: `query`, `kind` person|company|owners_association|unknown, `limit` (1-1000, default 200).",
  "RETURNS: { total, data[] { id, kind, display_name, salutation, title, first_name, last_name, company_name, legal_form, street, postcode, town, country, email, phone, preferred_channel, external_refs, status, contracts } }.",
].join("\n")

export const searchInputSchema = {
  query: z.string().optional().describe("Name, address, email or external reference contains."),
  kind: z.enum(KINDS).optional().describe("Only parties of this kind."),
  limit: z.number().int().min(1).max(1000).optional().describe("At most this many (default 200)."),
}

/** @internal */
export function handleSearch(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { query?: string; kind?: string; limit?: number },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/parties", {
      params: { q: args.query, kind: args.kind, limit: args.limit },
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
  "Read, change or create one party. With `party_id` alone: the party with its roles on every contract, its contacts (members), the companies it is a contact of and the documents it appears in (with quotes). With `party_id` and fields: changes those fields (the rest stay). Without `party_id`: creates a party; `display_name` is required (kind and salutation are inferred from it when not given).",
  "USE WHEN: checking a party; fixing its name, kind (person or company decides a letter's wording), salutation or postal address (issues kind_unknown, address_missing); creating a party the documents miss before adding it to a contract with talonic_parties_set_role. Search first (talonic_parties_search) so you do not create a duplicate.",
  "NOT FOR: its role on a contract (talonic_parties_set_role); combining duplicates (talonic_parties_merge).",
  "",
  "ARGS: `party_id` (omit to create); fields `kind` person|company|owners_association|unknown, `display_name`, `salutation` herr|frau|eheleute|firma|weg, `title`, `first_name`, `last_name`, `company_name`, `legal_form`, `street`, `postcode`, `town`, `country`, `email`, `phone`, `preferred_channel` post|email, `external_refs` { name: value } (null clears a text field).",
  "RETURNS: read { party, merged_into, roles[] { ...role, contract }, members[] { id, function, party }, member_of[], documents[] { document_id, filename, quotes[] } }; change or create: the party.",
].join("\n")

const nullableText = (max: number) => z.string().max(max).nullable().optional()

export const partyInputSchema = {
  party_id: partyIdArg.optional().describe("The party to read or change; omit to create one."),
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
  args: { party_id?: string } & Partial<Record<PartyFieldKey, unknown>>,
): Promise<ToolResult> {
  const fields = defined(Object.fromEntries(PARTY_FIELD_KEYS.map((k) => [k, args[k]])))
  const changing = Object.keys(fields).length > 0
  if (args.party_id) {
    const path = `/v1/parties/${args.party_id}`
    return runTool(() =>
      changing
        ? apiJson(getToken, baseUrl, "PATCH", path, { body: fields })
        : apiJson(getToken, baseUrl, "GET", path),
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
  "Add a role to a contract, or change one role row. With `contract_id`, `party_id` and `role`: adds the party in that role (confirmed unless `state` says suggested; a party already holding that role on the contract has that row updated). With `role_id`: changes that row: confirm or reject it (`state`), move it to another role or party, set the period, the Verwalter link or enters_contract. Any change by a person is a decision: an edited suggestion becomes confirmed unless `state` says otherwise.",
  "USE WHEN: fixing a contract's parties after reading talonic_parties_contract: a partner missing (no_partner), two partners at once (reject the wrong one, or give the old one valid_to), a Verwalter for the right party (represents_id), a tenant entering the contract (enters_contract with valid_from / valid_to), an owner change (previous_owner, new_owner with valid_from = transfer date).",
  ROLES_EXPLAINED,
  COMPUTED_RULE,
  DECISION_RULE,
  "NOT FOR: confirming many suggestions at once (talonic_parties_confirm); the party's own details (talonic_parties_party).",
  "",
  "ARGS: add: `contract_id`, `party_id`, `role`; change: `role_id` (roles[].id from talonic_parties_contract) and optional `party_id`, `role`. Both: `state` suggested|confirmed|rejected, `represents_id` (another role id on the same contract; null clears), `valid_from`, `valid_to` (YYYY-MM-DD; null clears), `enters_contract` (tenant only), `note` (say where the decision comes from).",
  "RETURNS: the role row { id, contract_id, party_id, role, represents_id, valid_from, valid_to, enters_contract, state, confidence, evidence[], origin, decided_by, decided_at, note }.",
].join("\n")

export const setRoleInputSchema = {
  contract_id: contractIdArg.optional().describe("Add: the contract to add the role to."),
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
    contract_id?: string
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
  const { contract_id, role_id, ...rest } = args
  const body = defined(rest)
  if (!!contract_id === !!role_id) {
    return Promise.resolve(
      validationError("pass contract_id (with party_id and role) to add, or role_id to change."),
    )
  }
  if (contract_id) {
    if (!args.party_id || !args.role) {
      return Promise.resolve(validationError("adding a role needs party_id and role."))
    }
    return runTool(() =>
      apiJson(getToken, baseUrl, "POST", `/v1/parties/contracts/${contract_id}/roles`, { body }),
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
  "Confirm suggested roles in bulk: by default only high-confidence suggestions (a verified quote the contract register agrees with), optionally only of named contracts or roles. Confirming says a person checked them; it is the user's decision, so only call this when the user asked. Run with dry_run first and say how many it would confirm.",
  "USE WHEN: the user asks to accept the suggestions (all, or of some contracts / roles).",
  DECISION_RULE,
  "NOT FOR: rejecting or fixing one role (talonic_parties_set_role).",
  "",
  "ARGS: `contract_ids[]` (omit for all), `roles[]` (e.g. ['partner']), `min_confidence` high|medium|low (default high), `limit` (1-5000, default 500), `dry_run`.",
  "RETURNS: { dry_run, confirmed, rows[] { id, contract_id, party_id, role, confidence } } (rows: the first 100).",
].join("\n")

export const confirmInputSchema = {
  contract_ids: z.array(zUuid()).max(1000).optional().describe("Only these contracts."),
  roles: z.array(z.enum(ROLES)).max(ROLES.length).optional().describe("Only these roles."),
  min_confidence: z
    .enum(["high", "medium", "low"])
    .optional()
    .describe("Lowest confidence confirmed (default high)."),
  limit: z.number().int().min(1).max(5000).optional().describe("At most this many (default 500)."),
  dry_run: z.boolean().optional().describe("Count only; nothing is confirmed."),
}

/** @internal */
export function handleConfirm(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    contract_ids?: string[]
    roles?: string[]
    min_confidence?: "high" | "medium" | "low"
    limit?: number
    dry_run?: boolean
  },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", "/v1/parties/roles/confirm", {
      body: {
        ...(args.contract_ids ? { contract_ids: args.contract_ids } : {}),
        ...(args.roles ? { roles: args.roles } : {}),
        min_confidence: args.min_confidence ?? "high",
        ...(args.limit ? { limit: args.limit } : {}),
        dry_run: args.dry_run ?? false,
      },
    }),
  )
}

const MERGE_DESCRIPTION = [
  "Merge one party into another: every role and contact link moves to the survivor (`into`); a role the survivor already holds on the same contract keeps the survivor's row and takes the merged one's evidence. The merged party stays only as a pointer to the survivor. Cannot be undone; a person's decision, so only when the user asked. Run with dry_run first.",
  "USE WHEN: talonic_parties_issues lists duplicates (same name and postcode) and the user confirms they are the same party.",
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

// ── Reading ────────────────────────────────────────────────────────────────

const READ_DESCRIPTION = [
  "Read the parties from contract documents: queues contracts for the platform to read in the background (one model call per contract) and store every party and role it finds as a suggestion, with quotes. By default every contract not read yet (only_unread); `contract_ids` reads exactly those again. With `status: true` only reports the queue. Pass `wait_seconds` to wait until the queue is empty (polls the queue every 5 s).",
  "USE WHEN: filling the app or after new contract documents arrived: run with dry_run first and say how many contracts it will read, then without dry_run and with wait_seconds; then talonic_parties_issues.",
  DECISION_RULE,
  "NOT FOR: one contract's parties (talonic_parties_contract).",
  "",
  "ARGS: `status` (only the queue); or `contract_ids[]` (omit for all), `only_unread` (default true), `force` (read again although read), `limit` (1-5000, default 500), `dry_run`; `wait_seconds` (0-600, default 0; not with dry_run).",
  "RETURNS: dry_run { dry_run, would_queue, skipped, contracts[] (first 50) }; queued { dry_run, queued, skipped }; status { contracts, counts { pending, running, done, failed }, unread, failed[] { contract_id, contract_key, error, attempts } }. After a wait also { status, waited_ms, still_running }.",
].join("\n")

export const readInputSchema = {
  status: z.boolean().optional().describe("Only report the read queue; nothing is queued."),
  contract_ids: z
    .array(zUuid())
    .max(5000)
    .optional()
    .describe("Only these contracts (read again when already read)."),
  only_unread: z
    .boolean()
    .optional()
    .describe("All contracts: only those not read yet (default true)."),
  force: z.boolean().optional().describe("Read again although already read."),
  limit: z.number().int().min(1).max(5000).optional().describe("Queue at most this many."),
  dry_run: z.boolean().optional().describe("Count and list what would be read; nothing is queued."),
  wait_seconds: z
    .number()
    .min(0)
    .max(READ_MAX_WAIT_S)
    .optional()
    .describe(`Seconds to wait for the queue to empty (0-${READ_MAX_WAIT_S}).`),
}

interface ReadStatus {
  counts?: Record<string, number>
}

const busy = (s: ReadStatus) => (s.counts?.["pending"] ?? 0) + (s.counts?.["running"] ?? 0) > 0

/** @internal */
export function handleRead(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    status?: boolean
    contract_ids?: string[]
    only_unread?: boolean
    force?: boolean
    limit?: number
    dry_run?: boolean
    wait_seconds?: number
  },
  deps: PartiesDeps = {},
): Promise<ToolResult> {
  const waitS = waitSeconds(args.wait_seconds, READ_MAX_WAIT_S)
  const readStatus = () => apiJson<ReadStatus>(getToken, baseUrl, "GET", "/v1/parties/read/status")
  return runTool(async () => {
    let started: Record<string, unknown> | null = null
    if (!args.status) {
      started = await apiJson<Record<string, unknown>>(
        getToken,
        baseUrl,
        "POST",
        "/v1/parties/read",
        {
          body: {
            ...(args.contract_ids ? { contract_ids: args.contract_ids } : {}),
            ...(args.only_unread !== undefined ? { only_unread: args.only_unread } : {}),
            ...(args.force !== undefined ? { force: args.force } : {}),
            ...(args.limit ? { limit: args.limit } : {}),
            dry_run: args.dry_run ?? false,
          },
        },
      )
      if (waitS === 0 || args.dry_run) return started
    }
    const first = await readStatus()
    if (waitS === 0) return first
    const sleep = deps.sleep ?? defaultSleep
    const now = deps.now ?? Date.now
    const start = now()
    const deadline = start + waitS * 1000
    let status = first
    let pollError: string | undefined
    while (busy(status) && now() < deadline) {
      await sleep(Math.min(PARTIES_POLL_INTERVAL_MS, deadline - now()))
      try {
        status = await readStatus()
      } catch (err) {
        pollError = err instanceof Error ? err.message : String(err)
        break
      }
    }
    const stillRunning = pollError !== undefined || busy(status)
    return {
      ...(started ?? {}),
      status,
      waited_ms: now() - start,
      still_running: stillRunning,
      ...(pollError ? { poll_error: pollError } : {}),
      next: stillRunning
        ? "Still reading: call talonic_parties_read with status: true (and wait_seconds) later."
        : "Read done: open the worklist with talonic_parties_issues.",
    }
  })
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
  "Read the workspace's own companies (the group: lead company, subsidiaries, sisters), or replace them all with `companies`. The read uses them to tell our side from the contract partner. Replacing deletes every company not in the new list: read first, change, send the whole list, and only when the user asked.",
  "USE WHEN: a read takes one of our own companies for the partner, or setting up the workspace.",
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

/**
 * Register the twelve `talonic_parties_*` tools.
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
      string,
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
      "Contract parties worklist",
      ISSUES_DESCRIPTION,
      issuesInputSchema,
      readOnly,
      (a) => handleIssues(getToken, baseUrl, a),
    ],
    [
      "talonic_parties_contracts",
      "Contracts with their parties",
      CONTRACTS_DESCRIPTION,
      contractsInputSchema,
      readOnly,
      (a) => handleContracts(getToken, baseUrl, a),
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
      "Confirm suggested roles",
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
      "Read parties from contracts",
      READ_DESCRIPTION,
      readInputSchema,
      write(true),
      (a) => handleRead(getToken, baseUrl, a),
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
