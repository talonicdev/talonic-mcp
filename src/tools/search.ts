import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { WIDGET_URIS } from "../widgets/types.js"

const DESCRIPTION = [
  "Find documents, fields, schemas, or sources in the workspace by name or concept. One call returns ranked results across all types.",
  "",
  "USE WHEN: the user names or describes a document without an id ('bank-statement.pdf', 'contracts about indemnification'), or you need a document_id before calling extract / to_markdown / get_document.",
  "NOT FOR: structured field-value filters like 'amount > 1000' (use talonic_filter).",
  "ARGS: query (natural language); optional limit.",
  "RETURNS: documents[], fields[]/fieldMatches[] (only `filterable: true` entries work in talonic_filter), schemas[], sources[]. Use the id from documents[] to act on a named file.",
].join("\n")

const inputSchema = {
  query: z
    .string()
    .min(1)
    .describe(
      "Natural-language search query, e.g. 'indemnification clauses' or 'Acme invoices Q4'.",
    ),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum results per entity type. Default: 5. Increase for broader exploration."),
}

export const outputSchema = {
  documents: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        sourceId: z.string().optional(),
        sourceName: z.string().optional(),
      }),
    )
    .describe("Documents matching the query."),
  fieldMatches: z
    .array(
      z.object({
        resolvedFieldId: z.string().nullable(),
        displayName: z.string().optional(),
        matchedValue: z.string().optional(),
        documentCount: z.number().nullable().optional(),
        filterable: z
          .boolean()
          .describe("Only filterable: true entries can be used with talonic_filter."),
        dataType: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Field's declared data type (e.g. `string`, `number`, `array`). Use this to guard numeric operators in `talonic_filter` (`gt`/`gte`/`lt`/`lte`/`between`) — they only resolve correctly when `dataType === 'number'`. `null` on non-materialized informational entries.",
          ),
      }),
    )
    .describe(
      "Field-level matches with a filterable flag indicating whether the entry can drive talonic_filter.",
    ),
  sources: z
    .array(z.object({ id: z.string(), name: z.string().optional() }))
    .describe("Source connections matching the query."),
  schemas: z
    .array(z.object({ id: z.string(), name: z.string().optional() }))
    .describe("Saved schemas matching the query."),
  fields: z
    .array(
      z.object({
        id: z
          .string()
          .nullable()
          .describe(
            "Field UUID for materialized field-registry entries; `null` for schema-only fields that are declared in a schema but have no extracted values yet. Always non-null when `filterable: true`.",
          ),
        canonicalName: z.string().optional(),
        displayName: z.string().optional(),
        documentCount: z.number().nullable().optional(),
        filterable: z.boolean().optional(),
        dataType: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Field's declared data type (e.g. `string`, `number`, `array`). Use this to guard numeric operators in `talonic_filter` (`gt`/`gte`/`lt`/`lte`/`between`) — they only resolve correctly when `dataType === 'number'`.",
          ),
      }),
    )
    .describe(
      "Field-registry entries matching the query. filterable: true entries are usable with talonic_filter.",
    ),
}

export async function handleSearch(
  talonic: Talonic,
  args: { query: string; limit?: number },
): Promise<ToolResult> {
  try {
    const result = await talonic.search(
      args.query,
      args.limit !== undefined ? { limit: args.limit } : {},
    )
    return jsonOk(result)
  } catch (err) {
    return toolError(err)
  }
}

export function registerSearch(server: McpServer, getTalonic: () => Talonic): void {
  server.registerTool(
    "talonic_search",
    {
      title: "Search Talonic Workspace",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        title: "Search Talonic Workspace",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URIS.search },
        "openai/outputTemplate": WIDGET_URIS.search,
      },
    },
    async (args) => handleSearch(getTalonic(), args),
  )
}
