import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

const DESCRIPTION = [
  "Get the OCR-converted markdown for a document already in the user's Talonic workspace.",
  "Returns clean, agent-ready markdown that preserves tables, headings, and layout.",
  "",
  "USE WHEN:",
  "- The user wants the full text of a document for summarisation, translation, or analysis.",
  "- A previous tool call returned a document_id and you want to inspect its content.",
  "- The user asks 'what does the document say' or 'summarise this PDF' (you call this then summarise).",
  "",
  "DO NOT USE WHEN:",
  "- The user wants specific structured fields (use talonic_extract with a schema).",
  "- The user has a file but no document_id yet (call talonic_extract first to ingest the document; the response includes a document.id you can pass here).",
  "",
  'TIP: To go from a local file to markdown, first call talonic_extract with a minimal flat-map schema like {"text": "string"} to ingest the document and obtain a document_id, then call this tool.',
].join("\n")

const inputSchema = {
  document_id: z
    .string()
    .min(1)
    .describe(
      "The Talonic document id whose markdown you want. Get this from a previous talonic_extract or talonic_search response.",
    ),
}

export async function handleToMarkdown(
  talonic: Talonic,
  args: { document_id: string },
): Promise<ToolResult> {
  try {
    const result = await talonic.documents.getMarkdown(args.document_id)
    return jsonOk(result)
  } catch (err) {
    return toolError(err)
  }
}

export function registerToMarkdown(server: McpServer, talonic: Talonic): void {
  server.registerTool(
    "talonic_to_markdown",
    {
      title: "Document to Markdown",
      description: DESCRIPTION,
      inputSchema,
    },
    async (args) => handleToMarkdown(talonic, args),
  )
}
