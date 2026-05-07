import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

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

const outputSchema = {
  id: z.string(),
  filename: z.string().optional(),
  pages: z.number().optional(),
  size_bytes: z.number().optional(),
  mime_type: z.string().optional(),
  type_detected: z.string().nullable().optional(),
  language_detected: z.string().nullable().optional(),
  status: z.string().optional(),
  source: z
    .object({
      id: z.string().optional(),
      type: z.string().optional(),
    })
    .optional(),
  triage: z
    .object({
      sensitivity: z.string().optional(),
      department: z.string().optional(),
      jurisdiction: z.string().nullable().optional(),
      pii_detected: z.boolean().optional(),
      pii_categories: z.array(z.string()).nullable().optional(),
      regulated_data: z.boolean().optional(),
      confidentiality_marking: z.string().nullable().optional(),
    })
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
    },
    async (args) => handleGetDocument(getTalonic(), args),
  )
}
