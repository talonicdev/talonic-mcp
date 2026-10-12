import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, runTool } from "./_http.js"
import type { ToolResult } from "./_shared.js"

/**
 * Master Records tools: the Master Records app. Vendor, customer and material
 * master rows held in several systems of record (typically the ERPs of merged
 * companies) resolved into one golden record per real-world entity. Every
 * golden value names the sources it came from, every merge carries the
 * field-by-field reasons it was made, and a source disagreement on a bank
 * account or tax id sends the record to review. Accept and split decisions
 * survive every re-run. Deterministic: no model calls.
 *
 * All tools hit `/v1/master-records/*` with the caller's bearer; the platform
 * owns every rule. The loop an agent runs: talonic_master_records_overview →
 * talonic_master_records_get_record for detail → talonic_master_records_decide;
 * talonic_master_records_changes for bank / terms changes checked against the
 * evidence documents.
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

const domainSchema = z
  .enum(["vendors", "customers", "materials"])
  .describe("Master data domain: vendors, customers or materials.")

const domainPath = (domain: string, rest = "") =>
  `/v1/master-records/${encodeURIComponent(domain)}${rest}`

const CONFIG_DESCRIPTION = [
  "Read the Master Records configuration: per domain (vendors, customers, materials) the source systems (label, SQL connection, the read-only SELECT aliasing columns to the canonical fields; order is survivorship priority), the match thresholds, and the optional change logs, open items and evidence Spec.",
  "USE WHEN: before changing the configuration, or to explain which systems feed a domain.",
  "NOT FOR: the golden records (talonic_master_records_overview).",
  "",
  "ARGS: none.",
  "RETURNS: { domains { vendors|customers|materials { sources[], auto_threshold?, review_threshold?, changes[]?, open_items[]?, evidence? } } }.",
].join("\n")

/** @internal */
export function handleConfig(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/master-records/config"))
}

const SAVE_CONFIG_DESCRIPTION = [
  "Replace the Master Records configuration with a complete new one (validated by the platform: every SQL is checked read-only against its connection). Run with dry_run first. Saving needs an owner.",
  "USE WHEN: setting up Master Records for a workspace, or adding a source system or change log.",
  "NOT FOR: partial edits; read talonic_master_records_config, change it, and send the whole object.",
  "",
  "ARGS: `config` (the whole configuration object), `dry_run` (validate only).",
  "RETURNS: { config, saved }. A broken config returns the list of problems.",
].join("\n")

export const saveConfigInputSchema = {
  config: z
    .record(z.string(), z.unknown())
    .describe("The whole Master Records configuration object (see talonic_master_records_config)."),
  dry_run: z.boolean().optional().describe("Validate only; nothing is saved."),
}

/** @internal */
export function handleSaveConfig(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { config: Record<string, unknown>; dry_run?: boolean },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "PUT", "/v1/master-records/config", {
      body: { config: args.config, dry_run: args.dry_run ?? false },
    }),
  )
}

const RUN_DESCRIPTION = [
  "Resolve a domain now: read every configured source, match rows across systems, and replace the domain's golden records. Earlier accept / split decisions are kept. Deterministic; running it again on the same data gives the same records.",
  "USE WHEN: the sources changed, or the domain has never been resolved.",
  "NOT FOR: reading the result (talonic_master_records_overview).",
  "",
  "ARGS: `domain` vendors|customers|materials.",
  "RETURNS: { run_id, stats { source_rows, records, multi_source, auto_merged, to_review, conflicts, bad_conflicts, per_source, pairs_compared, resolve_ms } }.",
].join("\n")

export const runInputSchema = { domain: domainSchema }

/** @internal */
export function handleRun(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { domain: string },
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "POST", domainPath(args.domain, "/run")))
}

const OVERVIEW_DESCRIPTION = [
  "A domain's latest run (stats per source, records, merged, to review, conflicts) and its golden records that join two or more source rows, review and bank / tax id conflicts first, each with status, match score, member sources and conflicting fields.",
  'USE WHEN: the headline ("how many duplicates across the ERPs, how many need review") or finding a record by name or source id.',
  "NOT FOR: one record's fields and reasons (talonic_master_records_get_record); single-source rows (talonic_master_records_crosswalk).",
  "",
  "ARGS: `domain`, `status` review|auto|accepted|split|conflict|all (default all), `query` (name or source id contains), `limit` (default 100), `offset`.",
  "RETURNS: { domain, run { id, status, stats, started_at, finished_at }, total, records[] { key, name, member_count, status, score, conflict_level, sources[] { source, id }, conflict_fields[] } }.",
].join("\n")

export const overviewInputSchema = {
  domain: domainSchema,
  status: z
    .enum(["review", "auto", "accepted", "split", "conflict", "all"])
    .optional()
    .describe("Only records with this status; conflict = any field disagreement."),
  query: z.string().max(200).optional().describe("Name or source id contains."),
  limit: z.number().int().min(1).max(5000).optional().describe("Maximum records returned."),
  offset: z.number().int().min(0).optional().describe("Records to skip, for paging."),
}

/** @internal */
export function handleOverview(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { domain: string; status?: string; query?: string; limit?: number; offset?: number },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", domainPath(args.domain, "/overview"), {
      params: { status: args.status, q: args.query, limit: args.limit, offset: args.offset },
    }),
  )
}

const RECORD_DESCRIPTION = [
  "One golden record: each member row with its source and values, the golden value per field with the sources it came from, the fields where sources disagree (bank account and tax id are `bad`), the field-by-field reasons the rows were linked, status, score and any decision.",
  "USE WHEN: explaining why rows were merged, which system a value came from, or before accepting or splitting a record.",
  "NOT FOR: listing records (talonic_master_records_overview).",
  "",
  "ARGS: `domain`, `key` (from talonic_master_records_overview or talonic_master_records_crosswalk).",
  "RETURNS: { key, domain, name, members[] { source, id, values }, golden { <field> { value, from[] } }, conflicts[] { field, severity, values[] }, reasons[] { field, outcome, weight }, score, status, run_id, decision }.",
].join("\n")

export const recordInputSchema = {
  domain: domainSchema,
  key: z.string().min(1).describe("Golden record key."),
}

/** @internal */
export function handleGetRecord(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { domain: string; key: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "GET",
      domainPath(args.domain, `/records/${encodeURIComponent(args.key)}`),
    ),
  )
}

const DECIDE_DESCRIPTION = [
  "Decide a golden record: `accept` keeps the merge, `split` breaks it into one record per source row, `reopen` removes an earlier decision. The domain is re-resolved at once and the decision survives every later run.",
  "USE WHEN: the user has reviewed a record and asks to accept or split it.",
  "NOT FOR: looking at the record (talonic_master_records_get_record).",
  "",
  "ARGS: `domain`, `key`, `decision` accept|split|reopen.",
  "RETURNS: { key, decision, stats } (stats of the re-run).",
].join("\n")

export const decideInputSchema = {
  domain: domainSchema,
  key: z.string().min(1).describe("Golden record key."),
  decision: z.enum(["accept", "split", "reopen"]).describe("accept, split or reopen."),
}

/** @internal */
export function handleDecide(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { domain: string; key: string; decision: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "POST",
      domainPath(args.domain, `/records/${encodeURIComponent(args.key)}/decision`),
      { body: { decision: args.decision } },
    ),
  )
}

const CHANGES_DESCRIPTION = [
  "Master data changes from the source systems' change logs, each checked against the evidence documents: a bank account change `matches` when a document for the party names the new account, `contradicts` when documents name another, `no_document` otherwise; flagged bank changes carry the party's open payables across every source as `exposure`. Read live; nothing is stored.",
  'USE WHEN: "which bank detail changes have no document behind them", vendor bank fraud checks, terms changes.',
  "NOT FOR: the golden records (talonic_master_records_overview).",
  "",
  "ARGS: `domain`, `flagged` (only the changes that need attention).",
  "RETURNS: { domain, stats { changes, bank_changes, bank_matched, bank_contradicted, bank_no_document, terms_no_document, flagged, exposure, evidence_documents }, evidence_run, changes[] { source, id, field, old_value, new_value, changed_at, changed_by, golden_key, golden_name, verdict, flagged, evidence[], exposure, elsewhere[], explanation } }.",
].join("\n")

export const changesInputSchema = {
  domain: domainSchema,
  flagged: z.boolean().optional().describe("Only flagged changes."),
}

/** @internal */
export function handleChanges(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { domain: string; flagged?: boolean },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", domainPath(args.domain, "/changes"), {
      params: { flagged: args.flagged ? "true" : undefined },
    }),
  )
}

const CROSSWALK_DESCRIPTION = [
  "The crosswalk: every source row (source, source id) mapped to its golden record key and name and the record's status, single-source rows included.",
  "USE WHEN: looking up which golden record a system's id belongs to, or handing the mapping to another system.",
  "NOT FOR: the merge reasons (talonic_master_records_get_record).",
  "",
  "ARGS: `domain`.",
  "RETURNS: { domain, rows[] { golden_key, golden_name, source, source_id, status } }.",
].join("\n")

export const crosswalkInputSchema = { domain: domainSchema }

/** @internal */
export function handleCrosswalk(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { domain: string },
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", domainPath(args.domain, "/crosswalk")))
}

// ── Registration ───────────────────────────────────────────────────────────

/**
 * True when the platform behind `baseUrl` serves the Master Records app to this
 * credential (`GET /v1/master-records/config` → 200). Both entrypoints call it
 * before registering the tools, so a deployment without the app never lists
 * tools that would 404. Any failure resolves `false`; never throws.
 *
 * @public
 */
export async function probeMasterRecordsAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/master-records/config"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Register the eight `talonic_master_records_*` tools.
 *
 * @public
 */
export function registerMasterRecordsTools(
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
      "talonic_master_records_config",
      "Read the Master Records configuration",
      CONFIG_DESCRIPTION,
      {},
      readOnly,
      () => handleConfig(getToken, baseUrl),
    ],
    [
      "talonic_master_records_save_config",
      "Save the Master Records configuration",
      SAVE_CONFIG_DESCRIPTION,
      saveConfigInputSchema,
      write(true, true),
      (a) => handleSaveConfig(getToken, baseUrl, a),
    ],
    [
      "talonic_master_records_run",
      "Resolve master records",
      RUN_DESCRIPTION,
      runInputSchema,
      write(true),
      (a) => handleRun(getToken, baseUrl, a),
    ],
    [
      "talonic_master_records_overview",
      "Master records overview",
      OVERVIEW_DESCRIPTION,
      overviewInputSchema,
      readOnly,
      (a) => handleOverview(getToken, baseUrl, a),
    ],
    [
      "talonic_master_records_get_record",
      "One golden record",
      RECORD_DESCRIPTION,
      recordInputSchema,
      readOnly,
      (a) => handleGetRecord(getToken, baseUrl, a),
    ],
    [
      "talonic_master_records_decide",
      "Accept or split a golden record",
      DECIDE_DESCRIPTION,
      decideInputSchema,
      write(true),
      (a) => handleDecide(getToken, baseUrl, a),
    ],
    [
      "talonic_master_records_changes",
      "Master data changes checked against documents",
      CHANGES_DESCRIPTION,
      changesInputSchema,
      readOnly,
      (a) => handleChanges(getToken, baseUrl, a),
    ],
    [
      "talonic_master_records_crosswalk",
      "Source id to golden record crosswalk",
      CROSSWALK_DESCRIPTION,
      crosswalkInputSchema,
      readOnly,
      (a) => handleCrosswalk(getToken, baseUrl, a),
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
