import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic, FilterCondition, FilterSort } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { WIDGET_URIS } from "../widgets/types.js"

const DESCRIPTION = [
  "Find documents by their extracted field VALUES using composable conditions (e.g. 'invoices where total > 1000').",
  "",
  "USE WHEN: value-based criteria on extracted fields — numeric/date/text comparisons or presence checks.",
  "NOT FOR: free-text / concept search (use talonic_search) · a single document by id (use talonic_get_document).",
  "ARGS: conditions[] (AND-ed). Each = EXACTLY ONE of `field` (canonical name) or `field_id` (UUID), an `operator`, and usually a `value`. Operators: eq, neq, gt, gte, lt, lte, between (needs `value` AND `value_to`), contains, is_empty / is_not_empty (no value). `value`/`value_to` are string|number|boolean matching the field type (ISO YYYY-MM-DD for dates).",
  "TEXT FILTERS: for eq/contains/is_not_empty on a text field, just TRY a natural field name ('currency', 'vendor_name') — names resolve server-side and an unresolved field surfaces in warnings[] rather than erroring. Do NOT block on discovering the field first; search-first is only required for numeric operators.",
  "NUMERIC GUARD: gt/gte/lt/lte/between only work when the field's dataType is 'number'. Call talonic_search first and check dataType; a numeric op on a string field returns zero matches. If the response has `warnings[]`, surface them to the user — do not silently retry.",
  "RETURNS: data[] (matching documents with field values), total, warnings[].",
].join("\n")

const operatorEnum = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "contains",
  "is_empty",
  "is_not_empty",
])

const conditionValue = z.union([z.string(), z.number(), z.boolean()])

const conditionSchema = z.object({
  field: z
    .string()
    .optional()
    .describe(
      "Canonical field name (e.g. 'vendor.name', 'policy.0_coverage_type'). Provide EXACTLY ONE of `field` or `field_id` per condition — not both, not neither. The Talonic API resolves names to ids server-side.",
    ),
  field_id: z
    .string()
    .optional()
    .describe(
      "Talonic field UUID. Provide EXACTLY ONE of `field` or `field_id` per condition — not both, not neither.",
    ),
  operator: operatorEnum.describe("Comparison operator. See description for the full list."),
  value: conditionValue
    .optional()
    .describe(
      "Comparison value, typed to match the field (number for numeric fields, string for text and ISO 'YYYY-MM-DD' dates, boolean for flags). REQUIRED for every operator EXCEPT `is_empty` / `is_not_empty` (which take no value). For `between`, this is the lower bound — pair it with `value_to`.",
    ),
  value_to: conditionValue
    .optional()
    .describe(
      "Upper bound. REQUIRED only for the `between` operator (paired with `value`); same type as `value`. Omit for all other operators.",
    ),
})

const sortSchema = z.object({
  field: z.string().optional(),
  field_id: z.string().optional(),
  direction: z.enum(["asc", "desc"]).describe("Sort direction."),
})

const inputSchema = {
  conditions: z
    .array(conditionSchema)
    .min(1)
    .describe("One or more filter conditions, AND-ed together."),
  search: z
    .string()
    .optional()
    .describe("Optional free-text search applied alongside the filters."),
  sort: sortSchema.optional().describe("Optional sort by a field."),
  page: z.number().int().positive().optional().describe("Page number for pagination."),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Results per page. Default 50 server-side."),
  source_connection_id: z
    .string()
    .optional()
    .describe("Optionally scope to a specific source connection."),
}

export const outputSchema = {
  data: z
    .array(
      z
        .object({
          document_id: z.string().optional(),
          filename: z.string().optional(),
          fields: z.record(z.string(), z.unknown()).optional(),
        })
        .passthrough(),
    )
    .describe("Documents matching the filter conditions, with their extracted field values."),
  total: z.number().optional().describe("Total documents matching across all pages."),
  page: z.number().optional().describe("Current page number."),
  pagination: z
    .object({
      total: z.number().optional(),
      limit: z.number().optional(),
      has_more: z.boolean().optional(),
      next_cursor: z.string().nullable().optional(),
    })
    .optional()
    .describe("Cursor-based pagination metadata."),
  warnings: z
    .array(
      z
        .object({
          code: z.string().optional().describe("Machine-readable warning code."),
          message: z.string().optional().describe("Human-readable warning message."),
          field: z
            .string()
            .optional()
            .describe("Canonical name of the field this warning applies to."),
          field_id: z.string().optional().describe("UUID of the field this warning applies to."),
          suggestion: z
            .string()
            .optional()
            .describe(
              "Suggested mitigation, e.g. a recommended `data_type` change to make the query resolve correctly.",
            ),
        })
        .passthrough(),
    )
    .optional()
    .describe(
      "API warnings surfaced by the Talonic filter endpoint. Most commonly raised when a numeric operator is applied to a string-typed field, in which case the warning explains the lexicographic-comparison trap and suggests a schema-design change. Agents should surface these to the user rather than silently retrying.",
    ),
}

export interface FilterArgs {
  conditions: Array<{
    field?: string
    field_id?: string
    operator:
      | "eq"
      | "neq"
      | "gt"
      | "gte"
      | "lt"
      | "lte"
      | "between"
      | "contains"
      | "is_empty"
      | "is_not_empty"
    value?: unknown
    value_to?: unknown
  }>
  search?: string
  sort?: { field?: string; field_id?: string; direction: "asc" | "desc" }
  page?: number
  limit?: number
  source_connection_id?: string
}

export async function handleFilter(talonic: Talonic, args: FilterArgs): Promise<ToolResult> {
  try {
    const conditions: FilterCondition[] = args.conditions.map((c) => {
      const cond: FilterCondition = { operator: c.operator }
      if (c.field !== undefined) cond.field = c.field
      if (c.field_id !== undefined) cond.fieldId = c.field_id
      if (c.value !== undefined) cond.value = c.value
      if (c.value_to !== undefined) cond.valueTo = c.value_to
      return cond
    })

    let sort: FilterSort | undefined
    if (args.sort !== undefined) {
      sort = { direction: args.sort.direction }
      if (args.sort.field !== undefined) sort.field = args.sort.field
      if (args.sort.field_id !== undefined) sort.fieldId = args.sort.field_id
    }

    const result = await talonic.documents.filter({
      conditions,
      ...(args.search !== undefined ? { search: args.search } : {}),
      ...(sort !== undefined ? { sort } : {}),
      ...(args.page !== undefined ? { page: args.page } : {}),
      ...(args.limit !== undefined ? { limit: args.limit } : {}),
      ...(args.source_connection_id !== undefined
        ? { source_connection_id: args.source_connection_id }
        : {}),
    })
    return jsonOk(result)
  } catch (err) {
    return toolError(err)
  }
}

export function registerFilter(server: McpServer, getTalonic: () => Talonic): void {
  server.registerTool(
    "talonic_filter",
    {
      title: "Filter Talonic Documents",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        title: "Filter Talonic Documents",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URIS.filter },
        "openai/outputTemplate": WIDGET_URIS.filter,
      },
    },
    async (args) => handleFilter(getTalonic(), args as FilterArgs),
  )
}
