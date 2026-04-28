import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"

/**
 * Register the `talonic://schemas` resource. The agent can read this
 * URI to retrieve the user's saved schemas without burning a tool call.
 *
 * The MCP SDK exposes resources as a separate primitive from tools.
 * Clients (Claude Desktop, Cursor, etc.) display them in their UI
 * alongside the conversation, so users can browse what their agent has
 * access to.
 *
 * @internal
 */
export function registerSchemasResource(server: McpServer, talonic: Talonic): void {
  server.registerResource(
    "talonic-schemas",
    "talonic://schemas",
    {
      title: "Talonic Schemas",
      description:
        "All schemas saved in the user's Talonic workspace, with their full JSON Schema definitions.",
      mimeType: "application/json",
    },
    async (uri) => {
      const result = await talonic.schemas.list()
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    },
  )
}
