import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, runTool } from "./_http.js"
import type { ToolResult } from "./_shared.js"

/**
 * AP tools: the Accounts Payable app. Supplier invoices the workspace already
 * captured, read into posting-ready vendor bills (vendor, entity, terms, due
 * date, lines with account / department / class, source page per field) and
 * split into ready and held with the dollars at stake. Holds come from the
 * Money Found ledger (price above contract, charges the contract excludes,
 * invoices paid twice) and AP controls (duplicate, missing PO, vendor not set up).
 *
 * The NetSuite export is a SIMULATED sandbox: it shows the exact REST
 * `vendorBill` records and CSV Import Assistant rows, and "posts" them with
 * simulated internal ids. No NetSuite account is called.
 *
 * All tools hit `/v1/ap/*` with the caller's bearer; the platform owns every rule.
 * The loop an agent runs: talonic_ap_overview → talonic_ap_issues →
 * talonic_ap_bills for detail → talonic_ap_netsuite_preview →
 * talonic_ap_netsuite_post (dry_run first).
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

const OVERVIEW_DESCRIPTION = [
  "AP totals for the workspace: invoices ready to post and held (count and dollars), dollars at stake above contract, duplicates, missing PO, per entity with its system of record, and the last simulated NetSuite run.",
  'USE WHEN: the headline ("how much is ready to post, how much is held and why").',
  "NOT FOR: the invoices themselves (talonic_ap_bills); the held worklist (talonic_ap_issues).",
  "",
  "ARGS: none.",
  "RETURNS: { as_of, currency, configured, gaps[], totals { bills, ready, held { at_stake, above_contract, duplicates, missing_po, vendor_unknown } }, entities[], sources[], last_run }.",
].join("\n")

/** @internal */
export function handleOverview(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/ap/overview"))
}

const BILLS_DESCRIPTION = [
  "List AP invoices as posting-ready vendor bills, each with vendor, invoice number, dates, amount (as invoiced and in the ledger currency), entity, status, holds with dollars and evidence, NetSuite mapping and lines.",
  "USE WHEN: looking up invoices by vendor or number, or listing the ready or held ones.",
  "NOT FOR: totals (talonic_ap_overview).",
  "",
  "ARGS: `status` ready|held, `entity` (entity code), `reason` above_contract|duplicate|missing_po|vendor_unknown, `query` (vendor, number, filename or contract contains), `limit` (default 500).",
  "RETURNS: { currency, total, data[] }.",
].join("\n")

export const billsInputSchema = {
  status: z.enum(["ready", "held"]).optional().describe("Only ready or only held invoices."),
  entity: z.string().optional().describe("Entity code, e.g. 'HRL'."),
  reason: z
    .enum(["above_contract", "duplicate", "missing_po", "vendor_unknown"])
    .optional()
    .describe("Only invoices held for this reason."),
  query: z.string().optional().describe("Vendor, invoice number, filename or contract contains."),
  limit: z.number().int().min(1).max(5000).optional().describe("Maximum invoices returned."),
}

/** @internal */
export function handleBills(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { status?: string; entity?: string; reason?: string; query?: string; limit?: number },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/ap/bills", {
      params: {
        status: args.status,
        entity: args.entity,
        reason: args.reason,
        q: args.query,
        limit: args.limit,
      },
    }),
  )
}

const ISSUES_DESCRIPTION = [
  "The AP worklist: every held invoice, why (each hold with its reason, finding, explanation and dollars), and the dollars at stake.",
  "USE WHEN: deciding what to dispute or fix before posting.",
  "NOT FOR: invoices ready to post (talonic_ap_bills with status=ready).",
  "",
  "ARGS: none.",
  "RETURNS: { currency, data[] { key, vendor, invoice_number, entity, document_id, filename, amount, at_stake, holds[] } }.",
].join("\n")

/** @internal */
export function handleIssues(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/ap/issues"))
}

const CONFIG_DESCRIPTION = [
  "Read the AP configuration: which captured document kinds are bills, the contract register used for entity and cost centre, entities with their system and NetSuite subsidiary, the NetSuite mapping (accounts, departments, terms, currencies, vendors).",
  "USE WHEN: before changing the configuration, or to explain why an invoice maps the way it does.",
  "NOT FOR: invoices (talonic_ap_bills).",
  "",
  "ARGS: none.",
  "RETURNS: { config, saved, updated_at }.",
].join("\n")

/** @internal */
export function handleConfig(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/ap/config"))
}

const SAVE_CONFIG_DESCRIPTION = [
  "Replace the AP configuration with a complete new one (validated by the platform). Run with dry_run first.",
  "USE WHEN: setting up AP for a workspace or changing the NetSuite mapping.",
  "NOT FOR: partial edits; read talonic_ap_config, change it, and send the whole object.",
  "",
  "ARGS: `config` (the whole configuration object), `dry_run` (validate only).",
  "RETURNS: { config, saved }. A broken config returns the list of problems.",
].join("\n")

export const saveConfigInputSchema = {
  config: z
    .record(z.string(), z.unknown())
    .describe("The whole AP configuration object (see talonic_ap_config)."),
  dry_run: z.boolean().optional().describe("Validate only; nothing is saved."),
}

/** @internal */
export function handleSaveConfig(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { config: Record<string, unknown>; dry_run?: boolean },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "PUT", "/v1/ap/config", {
      body: { config: args.config, dry_run: args.dry_run ?? false },
    }),
  )
}

const PREVIEW_DESCRIPTION = [
  "The exact NetSuite vendor bill records a posting would send (REST Record API `vendorBill` bodies: entity, subsidiary, tranId, tranDate, dueDate, terms, currency, expense / item sublists, memo naming the source document and page), and the invoices left out with the reason. The NetSuite target is a simulated sandbox.",
  "USE WHEN: showing or checking what would be exported to NetSuite.",
  "NOT FOR: posting (talonic_ap_netsuite_post).",
  "",
  "ARGS: `include_held` (also send held invoices, on payment hold; duplicates are never sent).",
  "RETURNS: { adapter { mode: 'simulated_sandbox' }, records[] { bill_key, method, path, body }, skipped[], totals }.",
].join("\n")

export const previewInputSchema = {
  include_held: z.boolean().optional().describe("Send held invoices too, with paymentHold true."),
}

/** @internal */
export function handlePreview(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { include_held?: boolean },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/ap/netsuite/preview", {
      params: { include_held: args.include_held ? 1 : 0 },
    }),
  )
}

const POST_DESCRIPTION = [
  "Post the vendor bills to the SIMULATED NetSuite sandbox: each record is answered as NetSuite's REST API answers a created record (204 with the new internal id), and the run's posting log is kept. Nothing is sent to any NetSuite account; say so when reporting the result.",
  "USE WHEN: the user asks to run the NetSuite export or a shadow posting.",
  "NOT FOR: looking at the payload (talonic_ap_netsuite_preview).",
  "",
  "ARGS: `include_held` (held invoices on payment hold), `dry_run` (answer without keeping the run), `limit`.",
  "RETURNS: { id, records, amount, results[] { bill_key, external_id, internal_id, status, location, payment_hold }, skipped[], log[] }.",
].join("\n")

export const postInputSchema = {
  include_held: z.boolean().optional().describe("Send held invoices too, with paymentHold true."),
  dry_run: z.boolean().optional().describe("Do not keep the run."),
  limit: z.number().int().min(1).max(5000).optional().describe("At most this many records."),
}

/** @internal */
export function handlePost(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { include_held?: boolean; dry_run?: boolean; limit?: number },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", "/v1/ap/netsuite/post", {
      body: {
        include_held: args.include_held ?? false,
        dry_run: args.dry_run ?? false,
        ...(args.limit ? { limit: args.limit } : {}),
      },
    }),
  )
}

const RUNS_DESCRIPTION = [
  "Simulated NetSuite posting runs: the list, or one run with its internal ids and posting log.",
  "USE WHEN: checking what an earlier export posted.",
  "NOT FOR: posting (talonic_ap_netsuite_post).",
  "",
  "ARGS: `run_id` (one run; omit for the list).",
  "RETURNS: { data[] } or one run { results[], skipped[], log[] }.",
].join("\n")

export const runsInputSchema = {
  run_id: z.string().uuid().optional().describe("One run (from the list)."),
}

/** @internal */
export function handleRuns(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { run_id?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "GET",
      args.run_id ? `/v1/ap/netsuite/runs/${args.run_id}` : "/v1/ap/netsuite/runs",
    ),
  )
}

// ── Registration ───────────────────────────────────────────────────────────

/**
 * True when the platform behind `baseUrl` serves the AP app to this credential
 * (`GET /v1/ap/config` → 200). Both entrypoints call it before registering the
 * tools, so a deployment without the app never lists tools that would 404.
 * Any failure resolves `false`; never throws.
 *
 * @public
 */
export async function probeApAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/ap/config"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Register the eight `talonic_ap_*` tools.
 *
 * @public
 */
export function registerApTools(server: McpServer, getToken: () => string, baseUrl?: string): void {
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
      "talonic_ap_overview",
      "AP totals",
      OVERVIEW_DESCRIPTION,
      {},
      readOnly,
      () => handleOverview(getToken, baseUrl),
    ],
    [
      "talonic_ap_bills",
      "List AP invoices",
      BILLS_DESCRIPTION,
      billsInputSchema,
      readOnly,
      (a) => handleBills(getToken, baseUrl, a),
    ],
    [
      "talonic_ap_issues",
      "Held AP invoices",
      ISSUES_DESCRIPTION,
      {},
      readOnly,
      () => handleIssues(getToken, baseUrl),
    ],
    [
      "talonic_ap_config",
      "Read the AP configuration",
      CONFIG_DESCRIPTION,
      {},
      readOnly,
      () => handleConfig(getToken, baseUrl),
    ],
    [
      "talonic_ap_save_config",
      "Save the AP configuration",
      SAVE_CONFIG_DESCRIPTION,
      saveConfigInputSchema,
      write(true, true),
      (a) => handleSaveConfig(getToken, baseUrl, a),
    ],
    [
      "talonic_ap_netsuite_preview",
      "NetSuite vendor bill payload",
      PREVIEW_DESCRIPTION,
      previewInputSchema,
      readOnly,
      (a) => handlePreview(getToken, baseUrl, a),
    ],
    [
      "talonic_ap_netsuite_post",
      "Post to the simulated NetSuite sandbox",
      POST_DESCRIPTION,
      postInputSchema,
      write(true),
      (a) => handlePost(getToken, baseUrl, a),
    ],
    [
      "talonic_ap_netsuite_runs",
      "NetSuite posting runs",
      RUNS_DESCRIPTION,
      runsInputSchema,
      readOnly,
      (a) => handleRuns(getToken, baseUrl, a),
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
