import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ExtractParams, Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, validationError, type ToolResult } from "./_shared.js"
import { EXTRACTION_RESULT_WIDGET_URI } from "../widgets/types.js"

const DESCRIPTION = [
  "Extract structured, schema-validated JSON from a document. Returns the requested fields with per-field confidence scores.",
  "",
  "USE WHEN: the user wants specific fields pulled from an invoice, contract, certificate, statement, form, scan, or PDF.",
  "NOT FOR: full text (use talonic_to_markdown) · finding documents (use talonic_search / talonic_filter).",
  "BY NAME: if the user names a file, call talonic_search first to get its document_id, then call this.",
  "ARGS: a schema is REQUIRED — pass inline `schema` (JSON Schema, e.g. {type:'object',properties:{vendor_name:{type:'string'}}}) OR a saved `schema_id`, not both. Provide EXACTLY ONE document source: `document_id` (cheapest, a workspace doc), `file_url` (public URL), or `file_data`+`filename` (small local files only).",
  "RETURNS: data (the JSON), confidence.overall and confidence.fields (treat <0.7 as needs review), document metadata, extraction_id.",
].join("\n")

const inputSchema = {
  file_data: z
    .string()
    .optional()
    .describe(
      "Base64-encoded file bytes. Recommended path when the agent already has the file in memory (e.g., the user attached a PDF to the conversation). Pair with `filename` so MIME type can be inferred. Works regardless of where the file lives on disk.",
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
      "Local path to a document file. Only works if the MCP server has read access to that path. In sandboxed chat clients (Claude Desktop, Cowork) where uploads land in a host-owned directory, use `file_data` instead.",
    ),
  file_url: z
    .string()
    .optional()
    .describe(
      "URL to a document file. The Talonic API fetches it server-side. Use this for documents already on the public web.",
    ),
  document_id: z
    .string()
    .optional()
    .describe("ID of a document already in the workspace, to re-extract with a new schema."),
  schema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Inline schema definition. REQUIRED unless `schema_id` is provided. Recommended: full JSON Schema {type:'object', properties:{...}}. Also accepted: flat key-type map {field_name:'string', amount:'number'}. Mutually exclusive with `schema_id`.",
    ),
  schema_id: z
    .string()
    .optional()
    .describe(
      "ID of a saved schema. REQUIRED unless `schema` is provided. Accepts UUID or SCH-XXXXXXXX short id from talonic_list_schemas. Mutually exclusive with `schema`.",
    ),
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
  include_provenance: z
    .boolean()
    .optional()
    .describe(
      "Include per-field provenance (source_text, section, page) showing where each value was found in the document.",
    ),
}

const outputSchema = {
  extraction_id: z.string().describe("Stable identifier for this extraction."),
  request_id: z
    .string()
    .optional()
    .describe("Server-assigned request ID for support and debugging."),
  status: z.string().describe("Extraction status (e.g. 'complete')."),
  document: z
    .object({
      id: z.string(),
      filename: z.string(),
      pages: z.number().optional(),
      size_bytes: z.number().optional(),
      mime_type: z.string().nullable().optional(),
      type_detected: z.string().nullable().optional(),
      language_detected: z.string().nullable().optional(),
    })
    .describe("Metadata about the ingested document."),
  data: z
    .record(z.string(), z.unknown())
    .describe("The extracted structured data, shape determined by the schema."),
  schema: z
    .object({
      source: z.string().optional(),
      id: z.string().nullable().optional(),
      definition: z.record(z.string(), z.unknown()).optional(),
      save_url: z.string().optional(),
    })
    .optional()
    .describe("Schema metadata: which schema was used and how it can be saved."),
  confidence: z
    .object({
      overall: z.number().describe("0..1 confidence for the extraction as a whole."),
      fields: z.record(z.string(), z.number()).describe("Per-field confidence map (0..1)."),
    })
    .optional()
    .describe("Extraction confidence. Treat fields below ~0.7 as needing human review."),
  provenance: z
    .record(
      z.string(),
      z.object({
        source_text: z.string().optional(),
        section: z.string().optional(),
        page: z.number().optional(),
      }),
    )
    .optional()
    .describe(
      "Per-field source evidence (source_text, section, page). Present only when `include_provenance: true`.",
    ),
  processing: z
    .object({
      duration_ms: z.number().optional(),
      pages_processed: z.number().optional(),
      region: z.string().optional(),
    })
    .optional()
    .describe("Processing metadata: duration, pages processed, region."),
  links: z
    .object({
      self: z.string().optional(),
      document: z.string().optional(),
      dashboard: z.string().optional(),
    })
    .optional()
    .describe("URLs for self, document, and human-readable dashboard view."),
  markdown: z
    .string()
    .optional()
    .describe("OCR-converted markdown. Present only when `include_markdown: true`."),
  cost: z
    .object({
      costCredits: z.number().describe("Credits consumed by this call."),
      costEur: z.number().describe("Approximate EUR cost of this call."),
      balanceCredits: z.number().describe("Workspace credit balance after this call settled."),
      cellsResolvedRegistry: z
        .number()
        .describe("Cells resolved from the materialized field-registry (cheap path)."),
      cellsResolvedAi: z.number().describe("Cells resolved by AI extraction (priced path)."),
    })
    .nullable()
    .optional()
    .describe(
      "Per-call cost and post-call balance, parsed from the X-Talonic-* response headers. `null` for non-extract calls; not always present on legacy clients.",
    ),
}

export interface ExtractArgs {
  file_data?: string
  filename?: string
  file_path?: string
  file_url?: string
  document_id?: string
  schema?: Record<string, unknown>
  schema_id?: string
  instructions?: string
  include_markdown?: boolean
  include_provenance?: boolean
}

export async function handleExtract(talonic: Talonic, args: ExtractArgs): Promise<ToolResult> {
  // Schema is required at the MCP layer. Schema-less extraction is not
  // reliable in v0.1 and is explicitly disabled here so agents get a
  // fast, clear error instead of a slow, opaque API failure or, worse,
  // a quietly-empty result. Items 1 and 7 of the v1 priority list.
  if (args.schema === undefined && args.schema_id === undefined) {
    return validationError(
      "talonic_extract requires a schema. Provide either an inline `schema` (JSON Schema or flat key-type map) or a `schema_id` from talonic_list_schemas. Schema-less extraction is unreliable in v0.1 and is disabled at the MCP layer.",
    )
  }
  if (args.schema !== undefined && args.schema_id !== undefined) {
    return validationError("talonic_extract accepts `schema` OR `schema_id`, not both. Pick one.")
  }

  try {
    const params: ExtractParams = {}
    if (args.file_data !== undefined) {
      params.file = Buffer.from(args.file_data, "base64")
      if (args.filename !== undefined) params.filename = args.filename
    }
    if (args.file_path !== undefined) params.file_path = args.file_path
    if (args.file_url !== undefined) params.file_url = args.file_url
    if (args.document_id !== undefined) params.document_id = args.document_id
    if (args.schema !== undefined) params.schema = args.schema
    if (args.schema_id !== undefined) params.schema_id = args.schema_id
    if (args.instructions !== undefined) params.instructions = args.instructions
    if (args.include_markdown !== undefined) params.include_markdown = args.include_markdown
    if (args.include_provenance !== undefined)
      (params as any).include_provenance = args.include_provenance

    const result = await talonic.extract(params)
    return jsonOk(result)
  } catch (err) {
    return toolError(err)
  }
}

export function registerExtract(server: McpServer, getTalonic: () => Talonic): void {
  server.registerTool(
    "talonic_extract",
    {
      title: "Extract Data from Document",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        title: "Extract Data from Document",
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        ui: { resourceUri: EXTRACTION_RESULT_WIDGET_URI },
        "openai/outputTemplate": EXTRACTION_RESULT_WIDGET_URI,
      },
    },
    async (args) => handleExtract(getTalonic(), args as ExtractArgs),
  )
}
