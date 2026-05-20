import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic, FilterCondition, FilterSort } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

const DESCRIPTION = [
  "STATUS: stable. Field-name resolution is server-side.",
  "",
  "Filter the user's Talonic documents by extracted field values using composable conditions.",
  "Conditions accept either a canonical field name (e.g. 'vendor.name', 'policy.0_coverage_type')",
  "or a field UUID. The Talonic API resolves names to ids server-side.",
  "",
  "USE WHEN:",
  "- The user wants documents matching specific structured criteria, like 'invoices over 1000 EUR'",
  "  or 'contracts expiring before 2026-12-31' or 'COIs from Acme'.",
  "- The query is value-based on extracted fields, not a free-text concept search.",
  "- You need to retrieve a sortable, paginated list filtered by field conditions.",
  "",
  "DO NOT USE WHEN:",
  "- The user wants conceptual / free-text search across content (use talonic_search).",
  "- The user is looking for a single document by id (use talonic_get_document).",
  "- The user wants extracted data from a new document (use talonic_extract).",
  "",
  "OPERATORS:",
  "- eq, neq: equality / inequality.",
  "- gt, gte, lt, lte: numeric or date comparisons.",
  "- between: requires both `value` and `value_to`.",
  "- contains: substring match on string fields.",
  "- is_empty: presence check, no value needed. Returns documents where the field is null or missing.",
  "- is_not_empty: presence check, no value needed. Returns documents where the field has a materialized value. Results reflect data within seconds of extraction completing.",
  "",
  "SCHEMA TYPING:",
  "- Numeric operators (`gt`, `gte`, `lt`, `lte`, `between`) only resolve correctly when the schema field is typed as `number`. A field typed as `string` that holds numeric content (e.g. '€1,500.00') will silently return zero matches even after extraction. Pick the right type at schema design time.",
  "- **Preventive check:** call `talonic_search` first and inspect `fieldMatches[].dataType` / `fields[].dataType` on the field you intend to filter. If `dataType !== 'number'`, do NOT use a numeric operator on it — either pick a different field, switch to a string-friendly operator (`eq`, `contains`), or warn the user that the schema field needs a `data_type` change before the filter can succeed.",
  "- **Reactive fallback:** if the filter response contains a `warnings` array, surface its `message` (and `suggestion`, if present) to the user verbatim — these explain *why* a query returned zero or unexpected results and typically suggest a schema-design change. Do not silently retry without flagging the warning.",
  "",
  "TIPS:",
  "- To discover available field names, call talonic_search first with a related query.",
  "  Only use fields[] entries where filterable is true — their canonicalName is what to",
  "  pass as `field` here. Fields with filterable: false have no extracted data yet.",
  "- fieldMatches[].resolvedFieldId is only valid when filterable is true. Entries with",
  "  filterable: false have resolvedFieldId: null and cannot be used for filtering.",
  "- Both `field` (name) and `field_id` (UUID) reach the API as `fieldId`. Either is fine.",
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

const conditionSchema = z.object({
  field: z
    .string()
    .optional()
    .describe(
      "Canonical field name (e.g. 'vendor.name', 'policy.0_coverage_type'). The Talonic API resolves names to ids server-side. Mutually exclusive with `field_id`.",
    ),
  field_id: z.string().optional().describe("Talonic field UUID. Mutually exclusive with `field`."),
  operator: operatorEnum.describe("Comparison operator. See description for the full list."),
  value: z.unknown().optional().describe("Value to compare against."),
  value_to: z
    .unknown()
    .optional()
    .describe("Upper bound for `between` operator; ignored otherwise."),
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
        openWorldHint: true,
      },
    },
    async (args) => handleFilter(getTalonic(), args as FilterArgs),
  )
}
