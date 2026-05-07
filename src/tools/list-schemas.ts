import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

/**
 * LLM-targeted tool description. The first paragraph explains what the
 * tool does in one sentence. The USE WHEN / DO NOT USE sections are
 * what an agent reads before deciding to invoke this tool over an
 * alternative; keep them concrete.
 *
 * @internal
 */
const DESCRIPTION = [
  "STATUS: stable.",
  "",
  "List all saved schemas in the user's Talonic workspace.",
  "Returns each schema with its id (UUID), short_id (SCH-XXXXXXXX), name, description,",
  "version, field count, and full JSON Schema definition. Either id form is accepted by",
  "talonic_extract's `schema_id` parameter.",
  "",
  "USE WHEN:",
  "- The user asks what schemas they have, or asks to see existing schemas.",
  "- You want to discover existing schemas before designing a new one.",
  "- Before recommending the user create a schema, check if one already covers the use case.",
  "- The user asks to extract from a known document type and you want to find a matching schema.",
  "",
  "DO NOT USE WHEN:",
  "- The user just wants to extract data from a document and provides an inline schema (call talonic_extract directly).",
  "",
  "TIP: Pair this with talonic_extract by passing the chosen schema's id as `schema_id`.",
].join("\n")

const schemaItem = z.object({
  id: z.string().describe("UUID of the schema."),
  short_id: z.string().optional().describe("Human-readable short id (SCH-XXXXXXXX)."),
  name: z.string(),
  description: z.string().optional(),
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

const outputSchema = {
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
export async function handleListSchemas(talonic: Talonic): Promise<ToolResult> {
  try {
    const result = await talonic.schemas.list()
    return jsonOk(result)
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
        openWorldHint: true,
      },
    },
    async () => handleListSchemas(getTalonic()),
  )
}
