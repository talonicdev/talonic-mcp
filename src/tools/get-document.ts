import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { WIDGET_URIS } from "../widgets/types.js"

const DESCRIPTION = [
  "Fetch a single document's metadata and processing status from the workspace.",
  "",
  "USE WHEN: 'tell me about document X', or to poll status after talonic_request_upload until the file is ready.",
  "NOT FOR: full text (use talonic_to_markdown) · extracted fields (use talonic_extract).",
  "BY NAME: if the user names a file, call talonic_search first to get its document_id, then call this.",
  "ARGS: document_id.",
  "RETURNS: filename, pages, type_detected, language, and `status`. Status lifecycle: pending_upload -> queued -> extracting -> completed. Wait for `completed` before calling talonic_extract on a freshly uploaded doc. To read the document's text, call talonic_to_markdown with this id.",
].join("\n")

const inputSchema = {
  document_id: z
    .string()
    .min(1)
    .describe(
      "The Talonic document ID. Get this from a previous talonic_extract or talonic_search response.",
    ),
}

export const outputSchema = {
  id: z.string(),
  // Freshly-uploaded / pre-extraction documents (browser-handoff polling) return
  // null for these until OCR/ingest computes them. They MUST accept null, or the
  // SDK's outputSchema validation rejects the response with -32602 and the agent
  // cannot poll talonic_get_document after talonic_request_upload.
  filename: z.string().nullable().optional(),
  pages: z.number().nullable().optional(),
  size_bytes: z.number().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  type_detected: z.string().nullable().optional(),
  language_detected: z.string().nullable().optional(),
  status: z.string().optional(),
  source: z
    .object({
      // Pre-extraction documents (e.g. fresh browser-handoff uploads) return
      // null for these until the source linkage is set during ingest. Accept
      // null so output validation does not block agents polling for status.
      id: z.string().nullable().optional(),
      type: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  triage: z
    .object({
      // Triage fields are populated during ingest; null is normal before that.
      sensitivity: z.string().nullable().optional(),
      department: z.string().nullable().optional(),
      jurisdiction: z.string().nullable().optional(),
      pii_detected: z.boolean().nullable().optional(),
      pii_categories: z.array(z.string()).nullable().optional(),
      regulated_data: z.boolean().nullable().optional(),
      confidentiality_marking: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  original_path: z.string().nullable().optional(),
  extraction_count: z.number().nullable().optional(),
  latest_extraction_id: z.string().nullable().optional(),
  processing_log: z
    .array(
      z.object({
        step: z.string().optional(),
        detail: z.string().optional(),
        status: z.string().optional(),
        started_at: z.string().optional(),
        completed_at: z.string().optional(),
        duration_ms: z.number().optional(),
      }),
    )
    .optional(),
  created_at: z.string().optional(),
  links: z
    .object({
      self: z.string().optional(),
      extractions: z.string().optional(),
      dashboard: z.string().optional(),
    })
    .optional(),
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

export function registerGetDocument(server: McpServer, getTalonic: () => Talonic): void {
  server.registerTool(
    "talonic_get_document",
    {
      title: "Get Talonic Document",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        title: "Get Talonic Document",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URIS.getDocument },
        "openai/outputTemplate": WIDGET_URIS.getDocument,
      },
    },
    async (args) => handleGetDocument(getTalonic(), args),
  )
}
