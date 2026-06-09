import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { WIDGET_URIS } from "../widgets/types.js"

/**
 * LLM-targeted tool description. The first paragraph explains what the
 * tool does in one sentence. The USE WHEN / DO NOT USE sections are
 * what an agent reads before deciding to invoke this tool over an
 * alternative; keep them concrete.
 *
 * @internal
 */
const DESCRIPTION = [
  "List the saved schemas in the workspace as compact summaries (id, short_id, name, description, version, field_count).",
  "",
  "USE WHEN: 'what schemas do I have', or to find a reusable schema before extracting.",
  "NOT FOR: a one-off extraction with an inline schema (call talonic_extract directly).",
  "ARGS: none.",
  "RETURNS: data[] of schema summaries. Full field definitions are omitted here — read the talonic://schemas resource for those. Pass a schema's id/short_id to talonic_extract as `schema_id`.",
].join("\n")

export const schemaItem = z.object({
  id: z.string().describe("UUID of the schema."),
  short_id: z.string().optional().describe("Human-readable short id (SCH-XXXXXXXX)."),
  name: z.string(),
  description: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Schema description, or null when the schema was created without one. The API explicitly maps the absent case to null (see SchemaResponse in openapi.yaml), so the output schema must accept null in addition to undefined.",
    ),
  definition: z.record(z.string(), z.unknown()).optional(),
  field_count: z.number().optional(),
  version: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  links: z
    .object({
      self: z.string().optional(),
      extractions: z.string().optional(),
      dashboard: z.string().optional(),
    })
    .optional(),
})

export const outputSchema = {
  data: z.array(schemaItem).describe("Saved schemas in the workspace."),
  pagination: z
    .object({
      total: z.number().optional(),
      limit: z.number().optional(),
      has_more: z.boolean().optional(),
      next_cursor: z.string().nullable().optional(),
    })
    .optional()
    .describe("Cursor-based pagination metadata."),
}

/**
 * Pure handler. Invokes the SDK and shapes the result. Exported for
 * unit testing; the public registration is via `register()` below.
 *
 * @internal
 */
/**
 * Fields stripped from each list item before returning. The full schema
 * `definition` is the big one — with a dozen+ schemas, returning every
 * field definition blows past some clients' tool-result size budget and the
 * payload gets truncated mid-object. `links` are also dropped as list noise.
 * Both remain available via the `talonic://schemas` resource.
 *
 * @internal
 */
const LIST_ITEM_OMIT = new Set(["definition", "links"])

export async function handleListSchemas(talonic: Talonic): Promise<ToolResult> {
  try {
    const result = await talonic.schemas.list()
    const data = Array.isArray(result?.data)
      ? result.data.map((schema) => {
          const summary: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(schema as unknown as Record<string, unknown>)) {
            if (!LIST_ITEM_OMIT.has(key)) summary[key] = value
          }
          return summary
        })
      : result?.data
    return jsonOk({ ...result, data })
  } catch (err) {
    return toolError(err)
  }
}

/**
 * Register `talonic_list_schemas` on an MCP server.
 *
 * @internal
 */
export function registerListSchemas(server: McpServer, getTalonic: () => Talonic): void {
  server.registerTool(
    "talonic_list_schemas",
    {
      title: "List Talonic Schemas",
      description: DESCRIPTION,
      inputSchema: {},
      outputSchema,
      annotations: {
        title: "List Talonic Schemas",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URIS.listSchemas },
        "openai/outputTemplate": WIDGET_URIS.listSchemas,
      },
    },
    async () => handleListSchemas(getTalonic()),
  )
}
