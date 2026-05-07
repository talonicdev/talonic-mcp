import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ExtractParams, Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, validationError, type ToolResult } from "./_shared.js"

const DESCRIPTION = [
  "STATUS: stable. Production-safe when called with a schema. Schema-less extraction is disabled at the MCP layer.",
  "",
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
  "FILE SOURCES (provide exactly EXACTLY ONE; never combine, e.g. do NOT pass both file_data and file_path):",
  "- file_data + filename: base64-encoded file bytes plus the original filename (with extension).",
  "  RECOMMENDED for local-stdio installs (Claude Desktop, Cursor, Cline, Continue, Cowork).",
  "  WARNING for hosted-MCP via Claude.ai connectors: Claude.ai imposes a hard size limit on",
  "  tool-call arguments (effectively under ~1KB), so file_data CANNOT carry a real PDF through",
  "  Claude.ai's pipeline. The bytes get truncated before reaching the MCP server. For files",
  "  larger than a trivial test, use file_url or document_id instead when running through",
  "  Claude.ai. Local stdio installs do NOT have this limit.",
  "- file_path: a local path to the document. Only works if the MCP server process can read",
  "  that path on its own filesystem. Chat clients (Claude Desktop, Claude.ai, Cowork) store",
  "  user uploads in a sandbox the MCP server cannot access, so file_path is only useful when",
  "  the agent explicitly knows a path on the same machine as the MCP server.",
  "- file_url: a URL the Talonic API will fetch directly. Use for documents already on the",
  "  public web. Best path for Claude.ai users dealing with files larger than the parameter cap.",
  "- document_id: re-extract a document already in the workspace. Cheapest option when the",
  "  document is already uploaded via app.talonic.com or a previous extract call.",
  "",
  "SCHEMA (REQUIRED, provide exactly one of `schema` or `schema_id`):",
  '- JSON Schema (RECOMMENDED): { type: "object", properties: { vendor_name: { type: "string" } } }.',
  '- Flat key-type map: { vendor_name: "string", invoice_total: "number" }. Accepted, but if you get a "no fields" error, fall back to JSON Schema.',
  "- schema_id: id of a saved schema from talonic_list_schemas. Accepts UUID or SCH-XXXXXXXX short id.",
  "",
  "Calls without `schema` or `schema_id` are rejected with a validation error before they hit the API,",
  "to prevent unreliable schema-free extractions reaching production.",
  "",
  "RESPONSE SHAPE (key fields):",
  "- data: the structured extracted JSON, shaped by your schema.",
  "- confidence.overall: 0..1 confidence for the extraction as a whole.",
  "- confidence.fields: per-field confidence map. Treat fields below ~0.7 as needing human review.",
  "- document.id, document.filename, document.pages, document.type_detected, document.language_detected.",
  "- extraction_id, request_id: stable identifiers for support and re-fetch.",
  "- processing.duration_ms, processing.region: useful for debugging and capacity planning.",
  "- markdown: present only when `include_markdown: true`.",
  "- provenance: present only when `include_provenance: true`. Per-field source evidence:",
  "  { field_name: { source_text, section, page } }. Useful for audit trails and citations.",
  "Cost, EUR price, and remaining credit balance are not surfaced in v0.1 and may appear in a later version.",
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
    },
    async (args) => handleExtract(getTalonic(), args as ExtractArgs),
  )
}
