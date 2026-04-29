import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { TalonicError, type Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

const DESCRIPTION = [
  "Get the OCR-converted markdown for a document. Accepts an existing document_id,",
  "a local file path, or a URL. When given a raw file, the tool ingests it via",
  "extract first (with a minimal schema) and then returns the markdown.",
  "",
  "USE WHEN:",
  "- The user wants the full text content of a document for summarisation, translation, or analysis.",
  "- A previous tool call returned a document_id and you want to inspect its content.",
  "- The user asks 'what does the document say' or 'summarise this PDF' (you call this then summarise).",
  "- The user has a raw PDF / scan / image and wants markdown directly without designing a schema first.",
  "",
  "DO NOT USE WHEN:",
  "- The user wants specific structured fields (use talonic_extract with a schema).",
  "",
  "INPUTS (provide exactly one):",
  "- document_id: id of an already-ingested document (cheapest path; one API call)",
  "- file_path: local path to a document file (the MCP server reads it from disk)",
  "- file_url: URL to a document file (the Talonic API fetches it server-side)",
].join("\n")

const inputSchema = {
  document_id: z
    .string()
    .min(1)
    .optional()
    .describe(
      "The Talonic document id whose markdown you want. Get this from a previous talonic_extract or talonic_search response.",
    ),
  file_path: z
    .string()
    .optional()
    .describe("Local path to a document file. The MCP server reads it from disk and uploads it."),
  file_url: z
    .string()
    .optional()
    .describe("URL to a document file. The Talonic API fetches it server-side."),
}

export interface ToMarkdownArgs {
  document_id?: string
  file_path?: string
  file_url?: string
}

/**
 * Minimal schema used when we need to ingest a raw file just to obtain
 * a document_id. Auto-discovery extract works on production; we keep
 * this empty so Talonic discovers the schema itself.
 *
 * @internal
 */
const INGEST_ONLY_SCHEMA: Record<string, unknown> = {}

export async function handleToMarkdown(
  talonic: Talonic,
  args: ToMarkdownArgs,
): Promise<ToolResult> {
  try {
    const sources = ["document_id", "file_path", "file_url"] as const
    const provided = sources.filter((k) => args[k] !== undefined)
    if (provided.length === 0) {
      throw new TalonicError({
        code: "missing_input_source",
        message: "talonic_to_markdown requires one of: document_id, file_path, file_url.",
        status: 0,
        retryable: false,
      })
    }
    if (provided.length > 1) {
      throw new TalonicError({
        code: "multiple_input_sources",
        message: `talonic_to_markdown accepts exactly one input; received: ${provided.join(", ")}`,
        status: 0,
        retryable: false,
      })
    }

    let documentId = args.document_id
    if (!documentId) {
      const ingest = await talonic.extract({
        ...(args.file_path !== undefined ? { file_path: args.file_path } : {}),
        ...(args.file_url !== undefined ? { file_url: args.file_url } : {}),
        schema: INGEST_ONLY_SCHEMA,
      })
      documentId = ingest.document.id
    }

    const result = await talonic.documents.getMarkdown(documentId)
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
    async (args) => handleToMarkdown(talonic, args as ToMarkdownArgs),
  )
}
