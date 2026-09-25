import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, runTool } from "./_http.js"
import { validationError, type ToolResult } from "./_shared.js"

/**
 * Contracts tools — fill and clean the Contracts app: one record per contract,
 * folded from its documents (base contract, amendments, renewals,
 * terminations), with the terms in force, the status on the day and the key
 * dates. Every term carries its verbatim quote; the platform refuses a value
 * whose quote does not occur in the document.
 *
 * All tools hit `/v1/contracts/*` with the caller's bearer. The platform owns
 * every rule; these tools only name what to do.
 *
 * The loop an agent runs: talonic_contracts_import (all, dry_run first) →
 * talonic_contracts_import_status until done → talonic_contracts_issues →
 * talonic_contracts_contract per flagged contract → fix with
 * talonic_contracts_update_document / _merge / _reread → talonic_contracts_issues again.
 */

const contractIdArg = z
  .string()
  .uuid()
  .describe("Contract id (from talonic_contracts_register or talonic_contracts_issues).")
const rowIdArg = z
  .string()
  .uuid()
  .describe(
    "Document row id on the contract: `documents[].id` from talonic_contracts_contract (not the workspace document id).",
  )

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

const ROLES = ["master", "amendment", "renewal", "termination", "price_sheet", "other"] as const
const STATUSES = ["draft", "active", "expired", "terminated", "unknown"] as const
const DECISIONS = ["terminated", "notice_sent", "renewal_declined", "active"] as const
const TERMS = [
  "title",
  "counterparty",
  "our_party",
  "family",
  "site",
  "signed_date",
  "effective_date",
  "expiry_date",
  "initial_term_months",
  "auto_renewal",
  "renewal_term_months",
  "notice_days",
  "notice_months",
  "terminated_on",
  "annual_value",
  "currency",
  "escalation_pct",
  "escalation_date",
  "min_commitment",
  "cap_amount",
  "payment_terms_days",
  "governing_law",
  "is_draft",
] as const

// ── Reads ──────────────────────────────────────────────────────────────────

const REGISTER_DESCRIPTION = [
  "List the workspace's contracts: key, title, counterparty, status, start, end in force, notice deadline, document count, next open date, and what Contract Pricing and Money Found report per contract.",
  "USE WHEN: getting an overview, finding a contract by key/name, or counting by status.",
  "NOT FOR: one contract's terms and documents (talonic_contracts_contract); what needs cleaning (talonic_contracts_issues).",
  "",
  "ARGS: `query` (key, title or counterparty contains), `status`, `key` (exact).",
  "RETURNS: data[] { id, contract_key, title, counterparty, status, effective_date, expiry_date, notice_deadline, documents, next_date, links }.",
].join("\n")

export const registerInputSchema = {
  query: z.string().optional().describe("Key, title or counterparty contains."),
  status: z.enum(STATUSES).optional().describe("Only contracts in this status."),
  key: z.string().optional().describe("Exact contract key, e.g. '1042460' or '3042-WLV'."),
}

/** @internal */
export function handleRegister(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { query?: string; status?: string; key?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/contracts", {
      params: { q: args.query, status: args.status, key: args.key },
    }),
  )
}

const CONTRACT_DESCRIPTION = [
  "Read one contract in full: terms in force (each with the document and verbatim quote it rests on), documents in fold order with what each states (unverified values carry their `problem`), key dates, decisions and links to the other apps.",
  "USE WHEN: checking or cleaning a contract; you need document row ids for talonic_contracts_update_document.",
  "NOT FOR: the list of contracts (talonic_contracts_register).",
  "",
  "ARGS: `contract_id`.",
  "RETURNS: { contract, documents[] { id, document_id, filename, role, excluded, extract }, key_dates[], links, decision, history }.",
].join("\n")

export const contractInputSchema = { contract_id: contractIdArg }

/** @internal */
export function handleContract(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { contract_id: string },
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", `/v1/contracts/${args.contract_id}`))
}

const ISSUES_DESCRIPTION = [
  "The cleaning worklist: contracts that look wrong and why. Codes: several_base_contracts (one key holds several contracts), printed_number_differs, several_counterparties, several_sites, ended_by_message (an email read as the termination), unread_documents, no_dates, unverified_terms.",
  "USE WHEN: after an import, to decide what to fix; again after fixing, to confirm it is clean.",
  "NOT FOR: contracts that are fine (talonic_contracts_register).",
  "",
  "ARGS: `code` (only contracts with this issue, optional).",
  "RETURNS: data[] { contract_id, contract_key, title, status, issues[] { code, detail, document_ids } }. document_ids are workspace document ids; match them to documents[].document_id in talonic_contracts_contract.",
].join("\n")

export const issuesInputSchema = {
  code: z
    .enum([
      "several_base_contracts",
      "printed_number_differs",
      "several_counterparties",
      "several_sites",
      "ended_by_message",
      "unread_documents",
      "no_dates",
      "unverified_terms",
    ])
    .optional()
    .describe("Only contracts with this issue."),
}

/** @internal */
export async function handleIssues(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { code?: string },
): Promise<ToolResult> {
  return runTool(async () => {
    const res = await apiJson<{ data: Array<{ issues: Array<{ code: string }> }> }>(
      getToken,
      baseUrl,
      "GET",
      "/v1/contracts/issues",
    )
    return args.code
      ? { data: res.data.filter((c) => c.issues.some((i) => i.code === args.code)) }
      : res
  })
}

const UPCOMING_DESCRIPTION = [
  "Open key dates across all contracts, soonest first: notice deadlines, ends of term, renewals, price changes, terminations, dated obligations. Dates marked handled are left out.",
  "USE WHEN: what needs someone soon; preparing a renewal or notice decision.",
  "NOT FOR: one contract's dates (talonic_contracts_contract).",
  "",
  "ARGS: `days` (horizon, default the workspace's alert horizon, 90).",
  "RETURNS: data[] { id, contract_id, contract_key, title, kind, due_date, days_left, label, quote }.",
].join("\n")

export const upcomingInputSchema = {
  days: z.number().int().min(1).max(3650).optional().describe("Days ahead."),
}

/** @internal */
export function handleUpcoming(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { days?: number },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/contracts/upcoming", { params: { days: args.days } }),
  )
}

const CANDIDATES_DESCRIPTION = [
  "Contract documents whose terms have not been read yet, grouped by the contract key in their filename; keys Contract Pricing already models first.",
  "USE WHEN: choosing what to read, or checking how the documents will group before importing.",
  "NOT FOR: reading them (talonic_contracts_import).",
  "",
  "ARGS: `query` (filename contains).",
  "RETURNS: data[] { contract_key, in_price_baseline, documents[] { document_id, filename, import } }.",
].join("\n")

export const candidatesInputSchema = { query: z.string().optional().describe("Filename contains.") }

/** @internal */
export function handleCandidates(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { query?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/contracts/import/candidates", {
      params: { q: args.query },
    }),
  )
}

const STATUS_DESCRIPTION = [
  "Where the read queue stands: counts by status (pending, running, done, failed) and the latest failures with their error.",
  "USE WHEN: after talonic_contracts_import, poll until pending and running are 0.",
  "NOT FOR: the contracts themselves (talonic_contracts_register).",
  "",
  "ARGS: none.",
  "RETURNS: { counts, failed[] { document_id, filename, error, attempts } }.",
].join("\n")

/** @internal */
export function handleImportStatus(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/contracts/import/status"))
}

// ── Writes ─────────────────────────────────────────────────────────────────

const IMPORT_DESCRIPTION = [
  "Queue contract documents to be read; the platform reads them in the background (one model call each) and files each under its contract.",
  "USE WHEN: filling the app. `all: true` queues every unread candidate (narrow with query, contract_keys, only_priced; `limit` for a first batch); `document_ids` queues exactly those. Always run `all` with `dry_run: true` first and say how many documents it will read.",
  "NOT FOR: reading a contract again after cleaning (talonic_contracts_reread).",
  "",
  "ARGS: `all` or `document_ids`; with all: `query`, `contract_keys`, `only_priced`, `limit`, `dry_run`; with document_ids: `force` (read again even if read).",
  "RETURNS: all → { dry_run, contracts, documents, queued, skipped }; document_ids → { queued, skipped }. Then poll talonic_contracts_import_status.",
].join("\n")

export const importInputSchema = {
  all: z.boolean().optional().describe("Queue every unread candidate (with the filters below)."),
  document_ids: z
    .array(z.string().uuid())
    .min(1)
    .max(500)
    .optional()
    .describe("Workspace document ids to read."),
  query: z.string().optional().describe("all: only filenames containing this."),
  contract_keys: z
    .array(z.string())
    .max(2000)
    .optional()
    .describe("all: only these contract keys."),
  only_priced: z.boolean().optional().describe("all: only keys Contract Pricing already models."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20000)
    .optional()
    .describe("all: queue at most this many documents."),
  dry_run: z.boolean().optional().describe("all: count only, queue nothing."),
  force: z.boolean().optional().describe("document_ids: read again even when already read."),
}

/** @internal */
export function handleImport(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    all?: boolean
    document_ids?: string[]
    query?: string
    contract_keys?: string[]
    only_priced?: boolean
    limit?: number
    dry_run?: boolean
    force?: boolean
  },
): Promise<ToolResult> {
  if (!!args.all === !!args.document_ids?.length)
    return Promise.resolve(validationError("Pass either `all: true` or `document_ids`, not both."))
  if (args.all) {
    const { query, contract_keys, only_priced, limit, dry_run } = args
    return runTool(() =>
      apiJson(getToken, baseUrl, "POST", "/v1/contracts/import/all", {
        body: { query, contract_keys, only_priced, limit, dry_run },
      }),
    )
  }
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", "/v1/contracts/import", {
      body: { document_ids: args.document_ids, force: args.force },
    }),
  )
}

const UPDATE_DOCUMENT_DESCRIPTION = [
  "Fix one document of a contract: set what it is (`role`), leave it out of the fold (`excluded`), file it under another contract key (`contract_key`; a new key creates that contract, null returns it to its derived key), or take it off the contract (`remove`).",
  "USE WHEN: cleaning — a key holds several contracts (move each set to its own key, e.g. '1042460-WLV / An der Walze 12'), an email is read as a termination (exclude it), an amendment is read as a base contract (role).",
  "NOT FOR: moving all documents of a contract at once (talonic_contracts_merge).",
  "",
  "ARGS: `contract_id`, `document_row_id`, and one or more of `role`, `excluded`, `contract_key`; or `remove: true` alone.",
  "RETURNS: the contract the document ends up in, recomputed. A hand-set key and role survive re-reading.",
].join("\n")

export const updateDocumentInputSchema = {
  contract_id: contractIdArg,
  document_row_id: rowIdArg,
  role: z.enum(ROLES).optional().describe("What the document is."),
  excluded: z.boolean().optional().describe("true = leave it out of the contract's terms."),
  contract_key: z
    .string()
    .max(64)
    .nullable()
    .optional()
    .describe("File under this key; null = back to the derived key."),
  remove: z
    .boolean()
    .optional()
    .describe("Take the document off the contract (the document stays in the workspace)."),
}

/** @internal */
export function handleUpdateDocument(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    contract_id: string
    document_row_id: string
    role?: string
    excluded?: boolean
    contract_key?: string | null
    remove?: boolean
  },
): Promise<ToolResult> {
  const path = `/v1/contracts/${args.contract_id}/documents/${args.document_row_id}`
  if (args.remove) {
    if (args.role !== undefined || args.excluded !== undefined || args.contract_key !== undefined)
      return Promise.resolve(validationError("`remove` goes alone."))
    return runTool(() => apiJson(getToken, baseUrl, "DELETE", path))
  }
  if (args.role === undefined && args.excluded === undefined && args.contract_key === undefined)
    return Promise.resolve(
      validationError("Nothing to change: pass role, excluded, contract_key or remove."),
    )
  return runTool(() =>
    apiJson(getToken, baseUrl, "PUT", path, {
      body: { role: args.role, excluded: args.excluded, contract_key: args.contract_key },
    }),
  )
}

const MERGE_DESCRIPTION = [
  "Move every document of one contract under another key (the same contract read under two keys, e.g. '1042460' and '1042460-WLV'). The emptied contract disappears.",
  "USE WHEN: two register rows are the same contract.",
  "NOT FOR: moving single documents (talonic_contracts_update_document).",
  "",
  "ARGS: `contract_id` (the one to empty), `into_key`.",
  "RETURNS: { moved, contract } — the contract under into_key, recomputed.",
].join("\n")

export const mergeInputSchema = {
  contract_id: contractIdArg,
  into_key: z.string().min(1).max(64).describe("The key to move everything under."),
}

/** @internal */
export function handleMerge(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { contract_id: string; into_key: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", `/v1/contracts/${args.contract_id}/merge`, {
      body: { into_key: args.into_key },
    }),
  )
}

const REREAD_DESCRIPTION = [
  "Read a contract's documents again (or one of them), e.g. after cleaning or when values did not verify. One model call per document; hand-set values and roles are kept.",
  "USE WHEN: a contract's terms look wrong and the documents are right.",
  "NOT FOR: documents never read (talonic_contracts_import).",
  "",
  "ARGS: `contract_id`, `document_row_id` (optional, all when omitted).",
  "RETURNS: { queued, skipped }. Then poll talonic_contracts_import_status.",
].join("\n")

export const rereadInputSchema = {
  contract_id: contractIdArg,
  document_row_id: rowIdArg.optional(),
}

/** @internal */
export function handleReread(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { contract_id: string; document_row_id?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", `/v1/contracts/${args.contract_id}/reread`, {
      body: args.document_row_id ? { document_row_id: args.document_row_id } : {},
    }),
  )
}

const DECIDE_DESCRIPTION = [
  "Record a decision on a contract: terminated, notice_sent, renewal_declined, or active (withdraws the earlier one). Recorded as made through the API key, with your note; the contract's status, end and key dates follow.",
  "USE WHEN: the user states the decision or it is confirmed by a document they point to. Never infer a termination on your own.",
  "NOT FOR: a termination letter already in the documents (it is read as a fact; check talonic_contracts_contract).",
  "",
  "ARGS: `contract_id`, `state`, `note` (say where the decision comes from).",
  "RETURNS: the contract, recomputed.",
].join("\n")

export const decideInputSchema = {
  contract_id: contractIdArg,
  state: z.enum(DECISIONS),
  note: z
    .string()
    .max(2000)
    .optional()
    .describe("Source of the decision, e.g. 'Kündigungsschreiben vom 12.01.2026'."),
}

/** @internal */
export function handleDecide(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { contract_id: string; state: string; note?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", `/v1/contracts/${args.contract_id}/decision`, {
      body: { state: args.state, note: args.note },
    }),
  )
}

const KEY_DATE_DESCRIPTION = [
  "Mark a key date handled (or open again), e.g. a notice deadline someone has dealt with. Handled dates leave the upcoming list and raise no alert.",
  "USE WHEN: the user confirms a date is taken care of.",
  "NOT FOR: changing the date itself (it follows the documents).",
  "",
  "ARGS: `key_date_id` (key_dates[].id from talonic_contracts_contract or id from talonic_contracts_upcoming), `handled`, `note`.",
  "RETURNS: { id, handled }.",
].join("\n")

export const keyDateInputSchema = {
  key_date_id: z.string().uuid(),
  handled: z.boolean(),
  note: z.string().max(2000).optional(),
}

/** @internal */
export function handleKeyDate(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { key_date_id: string; handled: boolean; note?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", `/v1/contracts/key-dates/${args.key_date_id}`, {
      body: { handled: args.handled, note: args.note },
    }),
  )
}

const SET_TERM_DESCRIPTION = [
  "Set one term on one document by hand, with the passage that states it copied verbatim from that document. The platform saves it only when the quote occurs in the document and prints the value.",
  "USE WHEN: a term was missed or read wrong and you have the exact passage (talonic_get_document or talonic_search to find it).",
  "NOT FOR: guessing a value; decisions (talonic_contracts_decide).",
  "",
  "ARGS: `contract_id`, `document_row_id`, `field`, `value` (ISO date for dates; fraction for escalation_pct; months for *_months), `quote`.",
  "RETURNS: the contract, recomputed; an error naming the problem when the quote does not verify.",
].join("\n")

export const setTermInputSchema = {
  contract_id: contractIdArg,
  document_row_id: rowIdArg,
  field: z.enum(TERMS),
  value: z.union([z.string(), z.number(), z.boolean()]),
  quote: z.string().min(3).max(2000).describe("Copied character for character from the document."),
}

/** @internal */
export function handleSetTerm(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    contract_id: string
    document_row_id: string
    field: string
    value: string | number | boolean
    quote: string
  },
): Promise<ToolResult> {
  const { field, value, quote } = args
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "POST",
      `/v1/contracts/${args.contract_id}/documents/${args.document_row_id}/terms`,
      { body: { field, value, quote } },
    ),
  )
}

// ── Registration ───────────────────────────────────────────────────────────

/**
 * True when the platform behind `baseUrl` serves the Contracts app to this
 * credential (`GET /v1/contracts/import/status` → 200). Both entrypoints call it
 * before registering the tools, so a deployment without the app never lists
 * tools that would 404. Any failure resolves `false`; never throws.
 *
 * @public
 */
export async function probeContractsAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/contracts/import/status"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Register the thirteen `talonic_contracts_*` tools.
 *
 * @public
 */
export function registerContractsTools(
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
      "talonic_contracts_register",
      "List contracts",
      REGISTER_DESCRIPTION,
      registerInputSchema,
      readOnly,
      (a) => handleRegister(getToken, baseUrl, a),
    ],
    [
      "talonic_contracts_contract",
      "Read one contract",
      CONTRACT_DESCRIPTION,
      contractInputSchema,
      readOnly,
      (a) => handleContract(getToken, baseUrl, a),
    ],
    [
      "talonic_contracts_issues",
      "Contracts to clean",
      ISSUES_DESCRIPTION,
      issuesInputSchema,
      readOnly,
      (a) => handleIssues(getToken, baseUrl, a),
    ],
    [
      "talonic_contracts_upcoming",
      "Upcoming contract dates",
      UPCOMING_DESCRIPTION,
      upcomingInputSchema,
      readOnly,
      (a) => handleUpcoming(getToken, baseUrl, a),
    ],
    [
      "talonic_contracts_import_candidates",
      "Unread contract documents",
      CANDIDATES_DESCRIPTION,
      candidatesInputSchema,
      readOnly,
      (a) => handleCandidates(getToken, baseUrl, a),
    ],
    [
      "talonic_contracts_import_status",
      "Contract read queue",
      STATUS_DESCRIPTION,
      {},
      readOnly,
      () => handleImportStatus(getToken, baseUrl),
    ],
    [
      "talonic_contracts_import",
      "Read contract documents",
      IMPORT_DESCRIPTION,
      importInputSchema,
      write(true),
      (a) => handleImport(getToken, baseUrl, a),
    ],
    [
      "talonic_contracts_update_document",
      "Fix a contract document",
      UPDATE_DOCUMENT_DESCRIPTION,
      updateDocumentInputSchema,
      write(false, true),
      (a) => handleUpdateDocument(getToken, baseUrl, a),
    ],
    [
      "talonic_contracts_merge",
      "Merge two contracts",
      MERGE_DESCRIPTION,
      mergeInputSchema,
      write(true, true),
      (a) => handleMerge(getToken, baseUrl, a),
    ],
    [
      "talonic_contracts_reread",
      "Read a contract again",
      REREAD_DESCRIPTION,
      rereadInputSchema,
      write(true),
      (a) => handleReread(getToken, baseUrl, a),
    ],
    [
      "talonic_contracts_decide",
      "Record a contract decision",
      DECIDE_DESCRIPTION,
      decideInputSchema,
      write(true),
      (a) => handleDecide(getToken, baseUrl, a),
    ],
    [
      "talonic_contracts_key_date",
      "Mark a key date handled",
      KEY_DATE_DESCRIPTION,
      keyDateInputSchema,
      write(true),
      (a) => handleKeyDate(getToken, baseUrl, a),
    ],
    [
      "talonic_contracts_set_term",
      "Set a contract term with its quote",
      SET_TERM_DESCRIPTION,
      setTermInputSchema,
      write(true),
      (a) => handleSetTerm(getToken, baseUrl, a),
    ],
  ]
  for (const [name, title, description, inputSchema, annotations, handler] of tools) {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations } },
      async (args: unknown) => handler(args),
    )
  }
}
