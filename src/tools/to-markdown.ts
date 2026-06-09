import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { TalonicError, type Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { WIDGET_URIS } from "../widgets/types.js"

const DESCRIPTION = [
  "Get the OCR-converted markdown text of a document.",
  "",
  "USE WHEN: the user wants the full text — 'what does it say', summarise, or translate a document.",
  "NOT FOR: specific structured fields (use talonic_extract with a schema).",
  "BY NAME: if the user names a file, call talonic_search first to get its document_id, then call this.",
  "ARGS: prefer `document_id` (a workspace doc — one cheap call). Otherwise `file_url`, or `file_data`+`filename` for small local files — provide exactly one. A file input ingests the document first and consumes credits; `document_id` does not.",
  "RETURNS: document_id and markdown (the full text).",
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
  cost: z
    .object({
      costCredits: z.number(),
      costEur: z.number(),
      balanceCredits: z.number(),
      cellsResolvedRegistry: z.number(),
      cellsResolvedAi: z.number(),
    })
    .nullable()
    .optional()
    .describe(
      "Per-call cost and post-call balance from the underlying extract step, parsed from the X-Talonic-* response headers. `null` when the document was already ingested (document_id path) and no extract call ran. Not always present on legacy clients.",
    ),
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
      _meta: {
        ui: { resourceUri: WIDGET_URIS.toMarkdown },
        "openai/outputTemplate": WIDGET_URIS.toMarkdown,
      },
    },
    async (args) => handleToMarkdown(getTalonic(), args as ToMarkdownArgs),
  )
}
