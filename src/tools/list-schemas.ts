import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
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
  "List all saved schemas in the user's Talonic workspace.",
  "Returns each schema with its id, name, description, version,",
  "field count, and full JSON Schema definition.",
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
export function registerListSchemas(server: McpServer, talonic: Talonic): void {
  server.registerTool(
    "talonic_list_schemas",
    {
      title: "List Talonic Schemas",
      description: DESCRIPTION,
      inputSchema: {},
    },
    async () => handleListSchemas(talonic),
  )
}
