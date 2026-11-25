import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, runTool } from "./_http.js"
import { zUuid, type ToolResult } from "./_shared.js"

/**
 * Business Rules tools: the workspace's central rule store, read-only. Every
 * rule the workspace's data is checked against, where it applies (its
 * bindings: which App, Spec or process runs it, pinned to which revision),
 * when it runs (triggers), who decides (the rules layer, or the owner while
 * the layer records), and the current outcome per subject with its reason.
 *
 * All tools hit `/v1/business-rules/*` with the caller's bearer (scope read).
 * The loop an agent runs: talonic_business_rules_list → talonic_business_rules_get
 * → talonic_business_rules_outcomes (status=failed for what needs someone).
 */

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

const RULE_STATUSES = ["draft", "active", "paused", "retired"] as const
const OUTCOME_STATUSES = ["passed", "failed", "indeterminate", "not_applicable", "evaluation_error"] as const

const LIST_DESCRIPTION = [
  "List the workspace's business rules: name, key, the rule in words, status, who decides (central = the rules layer, mirror = the owner, e.g. an App), bindings (owner, pinned revision, triggers) and current outcome counts per status.",
  'USE WHEN: finding a rule, or answering "which rules check our data and how are they doing".',
  "NOT FOR: one rule's history or per-subject results (talonic_business_rules_get, talonic_business_rules_outcomes).",
  "",
  "ARGS: `query` (name or key contains), `status` draft|active|paused|retired, `limit` (default and maximum set by the platform, 200), `offset`.",
  "RETURNS: { total, items[] { id, key, name, status, authority, text, rule_kind, evaluator, latest_revision, active_revision, bindings[], tally { passed, failed, indeterminate, not_applicable, evaluation_error }, subjects, last_outcome_at } }.",
].join("\n")

export const listInputSchema = {
  query: z.string().optional().describe("Name or key contains."),
  status: z.enum(RULE_STATUSES).optional().describe("Only rules in this status."),
  limit: z.number().int().min(1).max(1000).optional().describe("Rules per page (the platform caps it)."),
  offset: z.number().int().min(0).optional().describe("Rules to skip."),
}

/** @internal */
export function handleList(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { query?: string; status?: string; limit?: number; offset?: number },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/business-rules", {
      params: { q: args.query, status: args.status, limit: args.limit, offset: args.offset },
    }),
  )
}

const GET_DESCRIPTION = [
  "One business rule in full: the rule in words, how it is checked (the interpretation of its current revision), its bindings with triggers, current outcome counts, every revision with its hash and origin (where it came from), and the latest 25 outcome changes per subject with the status each replaced.",
  "USE WHEN: explaining a rule, where it applies, when it runs, or what changed recently.",
  "NOT FOR: the full per-subject result list (talonic_business_rules_outcomes).",
  "",
  "ARGS: `id` (rule uuid from talonic_business_rules_list).",
  "RETURNS: { id, key, name, status, authority, text, bindings[], tally, subjects, revisions[] { revision, definition_hash, evaluator, created_by, created_at, text, interpretation, applies_to, record_fold }, origins[], changes[] { subject, status, previous_status, revision, reason, created_at, trigger_ref } }.",
].join("\n")

export const getInputSchema = {
  id: zUuid().describe("Business rule id."),
}

/** @internal */
export function handleGet(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { id: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", `/v1/business-rules/${encodeURIComponent(args.id)}`),
  )
}

const OUTCOMES_DESCRIPTION = [
  "A business rule's current outcome for every subject it judged, newest first: the subject (the owner's own key, e.g. a load or invoice number), status, the revision that decided it, the reason, and evidence references.",
  "USE WHEN: listing what failed or is unclear for one rule, or checking one subject's result.",
  "NOT FOR: counts only (talonic_business_rules_get has the tally).",
  "",
  "ARGS: `id` (rule uuid), `status` passed|failed|indeterminate|not_applicable|evaluation_error, `limit` (the platform caps it), `offset`.",
  "RETURNS: { total, items[] { subject, status, revision, reason, evidence[], binding_id, owner_name, updated_at } }.",
].join("\n")

export const outcomesInputSchema = {
  id: zUuid().describe("Business rule id."),
  status: z.enum(OUTCOME_STATUSES).optional().describe("Only outcomes with this status."),
  limit: z.number().int().min(1).max(1000).optional().describe("Outcomes per page (the platform caps it)."),
  offset: z.number().int().min(0).optional().describe("Outcomes to skip."),
}

/** @internal */
export function handleOutcomes(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { id: string; status?: string; limit?: number; offset?: number },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", `/v1/business-rules/${encodeURIComponent(args.id)}/outcomes`, {
      params: { status: args.status, limit: args.limit, offset: args.offset },
    }),
  )
}

/**
 * Probe whether the platform serves the Business Rules read routes for this
 * token (`GET /v1/business-rules?limit=1` → 200). A deployment without them
 * never lists the tools. Any failure resolves `false`; never throws.
 *
 * @public
 */
export async function probeBusinessRulesAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/business-rules?limit=1"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Register the three read-only `talonic_business_rules_*` tools.
 *
 * @public
 */
export function registerBusinessRulesTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const tools: Array<
    [string, string, string, Record<string, z.ZodTypeAny>, (args: any) => Promise<ToolResult>]
  > = [
    ["talonic_business_rules_list", "List business rules", LIST_DESCRIPTION, listInputSchema, (a) => handleList(getToken, baseUrl, a)],
    ["talonic_business_rules_get", "One business rule", GET_DESCRIPTION, getInputSchema, (a) => handleGet(getToken, baseUrl, a)],
    ["talonic_business_rules_outcomes", "A business rule's outcomes", OUTCOMES_DESCRIPTION, outcomesInputSchema, (a) => handleOutcomes(getToken, baseUrl, a)],
  ]
  for (const [name, title, description, inputSchema, handler] of tools) {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...readOnly } },
      async (args: unknown) => handler(args),
    )
  }
}
