import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { TalonicError, type Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

const DESCRIPTION = [
  "STATUS: stable.",
  "",
  "Get the OCR-converted markdown for a document. Accepts an existing document_id,",
  "raw file bytes (base64), a local file path, or a URL. When given a raw file, the",
  "tool ingests it via extract first and then returns the markdown.",
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
  "- file_data + filename (RECOMMENDED for chat clients): base64-encoded file bytes plus",
  "  the original filename (with extension). Use this whenever you already have the file",
  "  in memory, e.g. the user attached it to the conversation. Works in every MCP client.",
  "- file_path: local path to a document file. Only works if the MCP server has read access",
  "  to that path; in sandboxed chat clients use file_data instead.",
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
  file_data: z
    .string()
    .optional()
    .describe(
      "Base64-encoded file bytes. Recommended path when the agent already has the file in memory (e.g., the user attached a PDF to the conversation). Pair with `filename` so MIME type can be inferred.",
    ),
  filename: z
    .string()
    .optional()
    .describe(
      "Original filename including extension, e.g. 'invoice.pdf'. Used to infer MIME type when uploading via `file_data`. Required when `file_data` is provided.",
    ),
  file_path: z
    .string()
    .optional()
    .describe(
      "Local path to a document file. Only works if the MCP server has read access to that path. In sandboxed chat clients (Claude Desktop, Cowork) use `file_data` instead.",
    ),
  file_url: z
    .string()
    .optional()
    .describe("URL to a document file. The Talonic API fetches it server-side."),
}

const outputSchema = {
  document_id: z.string().describe("ID of the document the markdown was extracted from."),
  markdown: z.string().describe("OCR-converted markdown text content of the document."),
}

export interface ToMarkdownArgs {
  document_id?: string
  file_data?: string
  filename?: string
  file_path?: string
  file_url?: string
}

/**
 * Minimal but valid JSON Schema used when we need to ingest a raw file
 * solely to obtain a document_id (to feed into the markdown call).
 *
 * Why a single throwaway field instead of `{}`: schema-less extraction
 * is unreliable, and we explicitly disable that path at the MCP layer
 * via `talonic_extract`'s validation guard. To stay consistent and
 * reliable in this internal call, we send a trivially valid schema.
 * The API performs a no-op extraction (likely returning a null
 * `document_title` with confidence 0), which we discard. We only need
 * `result.document.id`. The document is still uploaded and ingested.
 *
 * @internal
 */
const INGEST_ONLY_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    document_title: { type: "string" },
  },
}

export async function handleToMarkdown(
  talonic: Talonic,
  args: ToMarkdownArgs,
): Promise<ToolResult> {
  try {
    const sources = ["document_id", "file_data", "file_path", "file_url"] as const
    const provided = sources.filter((k) => args[k] !== undefined)
    if (provided.length === 0) {
      throw new TalonicError({
        code: "missing_input_source",
        message:
          "talonic_to_markdown requires one of: document_id, file_data, file_path, file_url.",
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
        ...(args.file_data !== undefined
          ? {
              file: Buffer.from(args.file_data, "base64"),
              ...(args.filename !== undefined ? { filename: args.filename } : {}),
            }
          : {}),
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

export function registerToMarkdown(server: McpServer, getTalonic: () => Talonic): void {
  server.registerTool(
    "talonic_to_markdown",
    {
      title: "Document to Markdown",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        title: "Document to Markdown",
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => handleToMarkdown(getTalonic(), args as ToMarkdownArgs),
  )
}
