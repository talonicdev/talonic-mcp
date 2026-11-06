import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, runTool } from "./_http.js"
import type { ToolResult } from "./_shared.js"

/**
 * `talonic_aggregate`: several workspace metrics in one request over the
 * platform's `POST /v1/aggregate` (documents ingested and failed, app
 * verdicts, cost per document, …). Numbers only, never rows. The platform
 * owns the catalog of datasets, fields and measures and validates every
 * name; this tool forwards the body with the caller's bearer.
 */

const DESCRIPTION = [
  "Workspace metrics in one request: counts, sums, averages and percentiles over an allowlisted catalog, optionally grouped. Returns numbers only, never rows.",
  "USE WHEN: a monitoring or dashboard question (documents ingested or failed in a window, documents without a load_number, auto-billable verdicts, average or median cost per document, model calls by operation).",
  "NOT FOR: reading documents or values (talonic_search, talonic_field_values); credit spend (talonic_get_usage).",
  "",
  "ARGS: `from`, `to` ISO-8601 WITH an offset (e.g. 2026-11-05T12:00:00Z); the window is half-open [from, to), at most 31 days. `scope` (optional, every query): document_ids, tags/system_tags {any|all}, source_connection_ids, document_types, client_batch_ids, roots_only, attachments_only. `queries[]` (1-20): `id` (a-z0-9_), `dataset`, `measure`, `of` (numeric field), `where[]` {field, op, value}, `group_by` (up to 3 fields, or hour/day in UTC).",
  "Datasets (the platform's catalog is the authority and can hold more; an unknown name returns 400 invalid_aggregate with the current list): documents, document_cost (documents created in the window with all their model-call cost so far, cost_usd and pages), pipeline_documents, app_verdicts (decision_state, auto_billable, load_number, load_number_hold), app_runs, deliveries, llm_calls. Entity datasets count what was created in the window with its status now; llm_calls counts rows written in it.",
  "Measures: count, rows, count_distinct, sum, avg, min, max, median, p1-p99; a list returns `values` plus `n`. Ops: eq, neq, in, not_in, is_null, not_null, gt, gte, lt, lte, contains_any, contains_all.",
  "RETURNS: { window, as_of, results { <id>: { dataset, kind, value | values | groups[] { key, value|values }, groups_total } } }.",
  "ERRORS: 400 invalid_aggregate names the allowed datasets / fields / measures; 403 cost_not_visible for cost fields or the model dimension when cost visibility is off; 422 aggregate_timeout names the dataset (narrow the window or scope).",
].join("\n")

const whereSchema = z.object({
  field: z.string().describe("A field of the query's dataset."),
  op: z
    .string()
    .describe(
      "eq, neq, in, not_in, is_null, not_null, gt, gte, lt, lte, contains_any, contains_all.",
    ),
  value: z
    .unknown()
    .optional()
    .describe("Omitted for is_null / not_null; an array for in, not_in, contains_*."),
})

export const aggregateInputSchema = {
  from: z
    .string()
    .describe("Window start, inclusive, ISO-8601 with offset (e.g. 2026-11-05T12:00:00Z)."),
  to: z
    .string()
    .describe("Window end, exclusive, ISO-8601 with offset. At most 31 days after from."),
  scope: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Document selectors applied to every query: document_ids (≤1000), tags / system_tags ({any:[…]} or {all:[…]}), source_connection_ids, document_types (ids or names), client_batch_ids, roots_only, attachments_only. Refused on app_runs and deliveries.",
    ),
  queries: z
    .array(
      z.object({
        id: z.string().describe("Result key: lowercase letters, digits, underscore."),
        dataset: z
          .string()
          .describe(
            "A catalog dataset, e.g. documents, document_cost, pipeline_documents, app_verdicts, app_runs, deliveries, llm_calls; an unknown name returns 400 with the current list.",
          ),
        measure: z
          .union([z.string(), z.array(z.string())])
          .describe("One measure (returns value) or a list (returns values plus n)."),
        of: z.string().optional().describe("Numeric field for sum, avg, min, max, median, pNN."),
        where: z.array(whereSchema).optional(),
        group_by: z
          .array(z.string())
          .optional()
          .describe("Up to 3 groupable fields, or hour / day."),
      }),
    )
    .min(1)
    .describe("1-20 queries; each result is keyed by its id."),
}

/** Input of {@link handleAggregate}: the `POST /v1/aggregate` body. */
export interface AggregateArgs {
  from: string
  to: string
  scope?: Record<string, unknown>
  queries: Array<Record<string, unknown>>
}

/**
 * Forward the request body to `POST /v1/aggregate`. Exported for unit testing.
 *
 * @internal
 */
export function handleAggregate(
  getToken: () => string,
  baseUrl: string | undefined,
  args: AggregateArgs,
): Promise<ToolResult> {
  const body = {
    from: args.from,
    to: args.to,
    ...(args.scope !== undefined ? { scope: args.scope } : {}),
    queries: args.queries,
  }
  return runTool(() => apiJson(getToken, baseUrl, "POST", "/v1/aggregate", { body }))
}

/**
 * True when the platform behind `baseUrl` serves `POST /v1/aggregate` to this
 * credential: a one-hour document count answers 200, or 429 (the
 * route allows one request in flight per workspace, so a probe racing a
 * dashboard request is busy, not absent). Both entrypoints call it
 * before registering the tool, so a deployment without the route never lists
 * it. Any failure resolves `false`; never throws.
 *
 * @public
 */
export async function probeAggregateAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const to = new Date()
    const from = new Date(to.getTime() - 3_600_000)
    const res = await fetch(buildUrl(baseUrl, "/v1/aggregate"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from.toISOString(),
        to: to.toISOString(),
        queries: [{ id: "q", dataset: "documents", measure: "count" }],
      }),
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok || res.status === 429
  } catch {
    return false
  }
}

/**
 * Register `talonic_aggregate`.
 *
 * @public
 */
export function registerAggregateTool(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const title = "Workspace metrics"
  server.registerTool(
    "talonic_aggregate",
    {
      title,
      description: DESCRIPTION,
      inputSchema: aggregateInputSchema,
      annotations: {
        title,
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: AggregateArgs) => handleAggregate(getToken, baseUrl, args),
  )
}
