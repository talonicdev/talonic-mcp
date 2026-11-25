import { z } from "zod"
import { READ, describe, runGroupTool, type GroupTool, type ToolGroup } from "./_groups.js"
import { validationError, type ToolResult } from "./_shared.js"

/**
 * Workspace metrics over the platform's aggregate catalog:
 * `GET /v1/aggregate/catalog` (what may be asked) and `POST /v1/aggregate`
 * (several numbers in one request, never rows). The platform owns every
 * dataset, field, measure and limit and answers 400 `invalid_aggregate` with
 * the allowed names, so a new dataset needs no MCP release. The MCP layer
 * checks only what can never be right: a timestamp without an offset, an
 * empty or inverted window, a malformed or repeated query id.
 *
 * Supersedes talonic-mcp PR #57: same tool name and body, plus the catalog
 * tool, the probe moved from a `POST` (which takes the workspace's one
 * in-flight aggregate slot) to the catalog `GET`, and the description no
 * longer hard-codes the dataset list.
 */

/** ISO-8601 with an explicit offset; the platform's own pattern. @internal */
export const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i
/** A query id: the platform's own pattern. @internal */
export const QUERY_ID_RE = /^[a-z][a-z0-9_]{0,63}$/

const OPS = [
  "eq",
  "neq",
  "in",
  "not_in",
  "is_null",
  "not_null",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains_any",
  "contains_all",
] as const

const CATALOG = describe({
  what: "What talonic_aggregate can count in this workspace: every dataset with its fields (type, groupable, the filter operators it takes, whether it is a cost field), the measures, the group-by time buckets, the document scope keys, the limits (window days, queries per request, list values, buckets) and whether this workspace may read cost fields. Reads no data and is free.",
  use: "before the first talonic_aggregate call of a conversation, or when talonic_aggregate answered 400 invalid_aggregate.",
  not: "the numbers themselves (talonic_aggregate).",
  returns:
    "{ datasets[] { name, description, kind entity|event, document_scope, defaults[], fields[] { name, description, type, groupable, cost, ops[] } }, measures, group_by { time[], max, max_buckets }, scope_keys[], limits { max_window_days, max_queries, max_list_values, statement_timeout_ms, concurrency }, cost_visible }.",
})

const AGGREGATE = describe({
  what: "Workspace metrics in one request: counts, sums, averages, minimums, maximums, medians and percentiles over a time window, optionally grouped by up to three fields or by UTC hour / day. Returns numbers only, never rows. Counts only documents this credential may see.",
  use: "a monitoring or dashboard question: documents received or failed in a window, documents missing a value, app verdicts by state, average or median cost per document, deliveries by outcome.",
  not: "reading documents or values (talonic_search, talonic_field_values); credit spend by function (talonic_get_usage). Call talonic_aggregate_catalog first for the dataset and field names.",
  args: "`from`, `to` ISO-8601 WITH an offset (e.g. 2026-11-05T12:00:00Z), half-open [from, to), at most the catalog's max_window_days (31 by default). `scope` (optional, applies to every document query): document_ids, tags / system_tags {any|all}, source_connection_ids, document_types (ids or names), client_batch_ids, roots_only, attachments_only. `queries[]` (1 to the catalog's max_queries, 20 by default): `id` (lowercase letters, digits, underscore; unique), `dataset`, `measure` (one name, or a list), `of` (the numeric field for sum / avg / min / max / median / pNN), `where[]` {field, op, value}, `group_by[]`.",
  returns:
    "{ window { from, to }, as_of, results { <id>: { dataset, kind, value | values (+ n) | groups[] { key, value | values }, groups_total } } }. A count over no rows is 0; an average, minimum or percentile over no rows is null. Cost fields are in US dollars.",
  errors:
    "400 invalid_aggregate names the allowed datasets / fields / measures; 403 cost_not_visible for cost fields when the workspace may not see costs; 422 aggregate_timeout names the dataset (narrow the window or scope); 429 another aggregate of this workspace is running (wait, then retry once).",
})

const whereSchema = z.object({
  field: z.string().min(1).describe("A field of the query's dataset (talonic_aggregate_catalog)."),
  op: z.enum(OPS).describe("Filter operator; the catalog lists which ones each field takes."),
  value: z
    .unknown()
    .optional()
    .describe("Omitted for is_null / not_null; a list for in, not_in, contains_any, contains_all."),
})

const querySchema = z.object({
  id: z
    .string()
    .describe("Result key: starts with a lowercase letter; letters, digits, underscore."),
  dataset: z
    .string()
    .min(1)
    .describe("A catalog dataset, e.g. documents, app_verdicts, deliveries."),
  measure: z
    .union([z.string(), z.array(z.string()).min(1)])
    .describe("One measure (returns value) or a list (returns values plus n)."),
  of: z.string().optional().describe("Numeric field for sum, avg, min, max, median, p1-p99."),
  where: z.array(whereSchema).max(50).optional(),
  group_by: z
    .array(z.string())
    .optional()
    .describe("Up to 3 groupable fields, or hour / day (UTC)."),
})

export const aggregateInputSchema = {
  from: z.string().describe("Window start, inclusive, ISO-8601 with offset."),
  to: z.string().describe("Window end, exclusive, ISO-8601 with offset."),
  scope: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Document selectors applied to every query: document_ids, tags, system_tags, source_connection_ids, document_types, client_batch_ids, roots_only, attachments_only.",
    ),
  queries: z
    .array(querySchema)
    .min(1)
    .describe("The numbers to compute; each result is keyed by its id."),
}

/**
 * The refusal the MCP layer gives before any call, or null when the request
 * may go to the platform. Exported for tests.
 *
 * @internal
 */
export function checkAggregateArgs(args: Record<string, unknown>): string | null {
  for (const key of ["from", "to"] as const) {
    const v = args[key]
    if (typeof v !== "string" || !TIMESTAMP_RE.test(v)) {
      return `\`${key}\` must be an ISO-8601 timestamp with an offset, e.g. 2026-11-05T12:00:00Z.`
    }
  }
  if (Date.parse(args["to"] as string) <= Date.parse(args["from"] as string)) {
    return "`to` must be after `from` (the window is [from, to))."
  }
  const queries = args["queries"]
  if (!Array.isArray(queries) || queries.length === 0) return "`queries` needs at least one query."
  const seen = new Set<string>()
  for (const q of queries as Array<{ id?: unknown }>) {
    if (typeof q?.id !== "string" || !QUERY_ID_RE.test(q.id)) {
      return `query id ${JSON.stringify(q?.id)} must start with a lowercase letter and hold only lowercase letters, digits and underscores.`
    }
    if (seen.has(q.id)) return `query id "${q.id}" is used twice; each result needs its own id.`
    seen.add(q.id)
  }
  return null
}

const aggregateTool: GroupTool = {
  name: "talonic_aggregate",
  title: "Workspace metrics",
  description: AGGREGATE,
  route: "POST /v1/aggregate",
  inputSchema: aggregateInputSchema,
  annotations: READ,
  body: ["from", "to", "scope", "queries"],
  handler: (ctx, args): Promise<ToolResult> => {
    const refusal = checkAggregateArgs(args)
    if (refusal) return Promise.resolve(validationError(refusal))
    return runGroupTool({ ...aggregateTool, handler: undefined }, ctx, args)
  },
}

export const aggregateGroup: ToolGroup = {
  key: "aggregate",
  label: "Workspace metrics",
  docsSlug: "aggregate-tools",
  probe: { path: "/v1/aggregate/catalog" },
  tools: [
    {
      name: "talonic_aggregate_catalog",
      title: "What workspace metrics can count",
      description: CATALOG,
      route: "GET /v1/aggregate/catalog",
      inputSchema: {},
      annotations: READ,
    },
    aggregateTool,
  ],
}
