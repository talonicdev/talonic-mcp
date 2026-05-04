import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

const DESCRIPTION = [
  "STATUS: stable.",
  "",
  "Search the user's Talonic workspace for documents, fields, sources, or schemas",
  "matching a query. Returns ranked results across all entity types in one call.",
  "",
  "USE WHEN:",
  "- The user wants to find documents but does not know the exact filename or id.",
  "- The query is conceptual ('contracts mentioning indemnification', 'Acme invoices').",
  "- You need to narrow a large workspace before calling talonic_extract or talonic_filter.",
  "- The user asks 'do I have any docs about X' or 'find anything related to X'.",
  "",
  "DO NOT USE WHEN:",
  "- The user has a specific document_id (use talonic_get_document instead).",
  "- The user wants to apply structured field-value filters like 'amount > 1000' (use talonic_filter).",
  "- The user wants to extract data from a brand-new document (use talonic_extract).",
  "",
  "TIP: The result includes documents, fieldMatches, sources, schemas, and fields. Pick the entity type the user actually needs.",
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

export function registerSearch(server: McpServer, talonic: Talonic): void {
  server.registerTool(
    "talonic_search",
    {
      title: "Search Talonic Workspace",
      description: DESCRIPTION,
      inputSchema,
    },
    async (args) => handleSearch(talonic, args),
  )
}
