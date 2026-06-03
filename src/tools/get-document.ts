import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { WIDGET_URIS } from "../widgets/types.js"

const DESCRIPTION = [
  "STATUS: stable.",
  "",
  "Fetch full metadata for a single document already in the user's Talonic workspace.",
  "Returns id, filename, page count, detected document type, language, processing log,",
  "and link URLs (self, extractions, dashboard).",
  "",
  "USE WHEN:",
  "- You need details about a specific document the user already extracted or uploaded.",
  "- You have a document_id from a previous extract or search call and want more context.",
  "- You called talonic_request_upload and need to poll until the user has uploaded the file.",
  "- The user asks 'tell me about document X' or similar.",
  "",
  "DO NOT USE WHEN:",
  "- The user wants the document's full text content (use talonic_to_markdown for OCR markdown).",
  "- The user wants extracted structured data (use talonic_extract with a schema, or fetch the extraction by id).",
  "- The user has a file but no document_id yet (call talonic_extract first to ingest the document).",
  "",
  "STATUS VALUES on the response `status` field:",
  "- pending_upload: document slot reserved via talonic_request_upload, file not yet received.",
  "  Keep polling (~5 s interval). Token expires after 15 min — if status stays 'pending_upload'",
  "  past the expires_at returned by talonic_request_upload, the user did not upload in time.",
  "- queued / extracting: file received, OCR and exhaustive extraction in progress. Keep polling.",
  "- completed: extraction is done. This is the state to wait for before calling talonic_extract",
  "  with a schema or schema_id — the schema-specific LLM pass runs off the cached OCR'd text.",
  "- uploaded: file received but the extraction queue could not be enqueued (rare, e.g. Redis",
  "  unavailable). The talonic_extract endpoint will trigger processing inline if called.",
  "- error / ocr_failed / extraction_failed: terminal failures; processing_log carries the reason.",
].join("\n")

const inputSchema = {
  document_id: z
    .string()
    .min(1)
    .describe(
      "The Talonic document ID. Get this from a previous talonic_extract or talonic_search response.",
    ),
}

const outputSchema = {
  id: z.string(),
  filename: z.string().optional(),
  pages: z.number().optional(),
  size_bytes: z.number().optional(),
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
  extraction_count: z.number().optional(),
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
        openWorldHint: true,
      },
      _meta: {
        "openai/outputTemplate": WIDGET_URIS.getDocument,
      },
    },
    async (args) => handleGetDocument(getTalonic(), args),
  )
}
