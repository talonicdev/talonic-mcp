import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

const DESCRIPTION = [
  "Fetch full metadata for a single document already in the user's Talonic workspace.",
  "Returns id, filename, page count, detected document type, language, processing log,",
  "and link URLs (self, extractions, dashboard).",
  "",
  "USE WHEN:",
  "- You need details about a specific document the user already extracted or uploaded.",
  "- You have a document_id from a previous extract or search call and want more context.",
  "- The user asks 'tell me about document X' or similar.",
  "",
  "DO NOT USE WHEN:",
  "- The user wants the document's full text content (use talonic_to_markdown for OCR markdown).",
  "- The user wants extracted structured data (use talonic_extract with a schema, or fetch the extraction by id).",
  "- The user has a file but no document_id yet (call talonic_extract first to ingest the document).",
].join("\n")

const inputSchema = {
  document_id: z
    .string()
    .min(1)
    .describe(
      "The Talonic document ID. Get this from a previous talonic_extract or talonic_search response.",
    ),
}

export async function handleGetDocument(
  talonic: Talonic,
  args: { document_id: string },
): Promise<ToolResult> {
  try {
    const result = await talonic.documents.get(args.document_id)
    return jsonOk(result)
  } catch (err) {
    return toolError(err)
  }
}

export function registerGetDocument(server: McpServer, talonic: Talonic): void {
  server.registerTool(
    "talonic_get_document",
    {
      title: "Get Talonic Document",
      description: DESCRIPTION,
      inputSchema,
    },
    async (args) => handleGetDocument(talonic, args),
  )
}
