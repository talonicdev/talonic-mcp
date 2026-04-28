import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ExtractParams, Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

const DESCRIPTION = [
  "Extract structured, schema-validated data from a document using Talonic.",
  "Returns clean JSON matching the schema, with per-field confidence scores and",
  "metadata about the document (detected type, language, page count).",
  "",
  "USE WHEN:",
  "- The user has a document (PDF, image, scan, DOCX, etc.) and wants specific fields pulled out.",
  "- You need structured data (vendor name, total amount, dates, parties, terms) rather than free text.",
  "- The user uploads or references any invoice, contract, certificate, statement, or form.",
  "- You want validated JSON instead of trying to OCR + parse with raw LLM calls.",
  "",
  "DO NOT USE WHEN:",
  "- The user just wants the full text content (use talonic_to_markdown after extracting once).",
  "- The user wants to find documents matching a query (use talonic_search or talonic_filter).",
  "",
  "FILE SOURCES (provide exactly one):",
  "- file_path: a local path to the document (the MCP server reads it from disk).",
  "- file_url: a URL the Talonic API will fetch directly.",
  "- document_id: re-extract a document already in the workspace.",
  "",
  "SCHEMA FORMATS (provide at most one of `schema` or `schema_id`):",
  '- Flat map (recommended): { vendor_name: "string", total_amount: "number", due_date: "date" }',
  '- JSON Schema: { type: "object", properties: { ... } }',
  "- schema_id: id of a saved schema from talonic_list_schemas",
  "",
  "IMPORTANT: production currently rejects requests with no schema. Always provide either",
  "an inline `schema` or a `schema_id`.",
].join("\n")

const inputSchema = {
  file_path: z
    .string()
    .optional()
    .describe(
      "Local path to a document file. The MCP server reads it from disk and uploads it. Provide one of file_path, file_url, or document_id.",
    ),
  file_url: z
    .string()
    .optional()
    .describe(
      "URL to a document file. The Talonic API fetches it server-side. Use this for remote documents.",
    ),
  document_id: z
    .string()
    .optional()
    .describe("ID of a document already in the workspace, to re-extract with a new schema."),
  schema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Inline schema definition. Flat map (recommended), simplified fields, or JSON Schema.",
    ),
  schema_id: z
    .string()
    .optional()
    .describe("ID of a saved schema. Mutually exclusive with `schema`."),
  instructions: z
    .string()
    .optional()
    .describe(
      "Natural-language guidance for the extractor, e.g. 'Focus on the billing section. Amounts are in EUR.'",
    ),
  include_markdown: z
    .boolean()
    .optional()
    .describe("Include OCR-converted markdown in the response alongside structured data."),
}

export interface ExtractArgs {
  file_path?: string
  file_url?: string
  document_id?: string
  schema?: Record<string, unknown>
  schema_id?: string
  instructions?: string
  include_markdown?: boolean
}

export async function handleExtract(talonic: Talonic, args: ExtractArgs): Promise<ToolResult> {
  try {
    const params: ExtractParams = {}
    if (args.file_path !== undefined) params.file_path = args.file_path
    if (args.file_url !== undefined) params.file_url = args.file_url
    if (args.document_id !== undefined) params.document_id = args.document_id
    if (args.schema !== undefined) params.schema = args.schema
    if (args.schema_id !== undefined) params.schema_id = args.schema_id
    if (args.instructions !== undefined) params.instructions = args.instructions
    if (args.include_markdown !== undefined) params.include_markdown = args.include_markdown

    const result = await talonic.extract(params)
    return jsonOk(result)
  } catch (err) {
    return toolError(err)
  }
}

export function registerExtract(server: McpServer, talonic: Talonic): void {
  server.registerTool(
    "talonic_extract",
    {
      title: "Extract Data from Document",
      description: DESCRIPTION,
      inputSchema,
    },
    async (args) => handleExtract(talonic, args as ExtractArgs),
  )
}
