import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { WIDGET_URIS } from "../widgets/types.js"

const DESCRIPTION = [
  "STATUS: stable.",
  "",
  "Save a schema definition to the user's Talonic workspace so it can be reused",
  "across future extractions. Returns the saved schema with its newly assigned id and short_id.",
  "",
  "USE WHEN:",
  "- The user asks to save a schema, store a template, or reuse the schema across docs.",
  "- You have iterated on a schema with the user and they confirmed it should be saved.",
  "- The user wants to standardise extraction across many documents of the same type.",
  "",
  "DO NOT USE WHEN:",
  "- The user just wants to extract once with an inline schema (call talonic_extract directly with the schema inline).",
  "- The user has not confirmed the schema design (avoid creating clutter in their workspace).",
  "",
  "DEFINITION FORMATS:",
  '- JSON Schema (most reliable): { type: "object", properties: { vendor_name: { type: "string" } } }',
  '- Flat key-type map: { vendor_name: "string", invoice_total: "number" } -- API normalises server-side. If you get a "no fields" error from the API, fall back to JSON Schema.',
  "",
  "TIP: After saving, call talonic_extract with `schema_id` set to the returned id (UUID or SCH- short id) for consistent results.",
].join("\n")

const inputSchema = {
  name: z.string().min(1).describe("Human-readable name for the schema, e.g. 'Standard Invoice'."),
  definition: z
    .record(z.string(), z.unknown())
    .describe(
      "Schema definition. Most reliable: full JSON Schema {type:'object', properties:{...}}. Also accepted: a flat key-type map {field_name:'string', amount:'number'} which the API normalises.",
    ),
  description: z
    .string()
    .optional()
    .describe("Optional description of what this schema extracts and when to use it."),
}

export const outputSchema = {
  id: z.string().describe("UUID of the newly saved schema."),
  short_id: z.string().optional().describe("Human-readable short id (SCH-XXXXXXXX)."),
  name: z.string(),
  description: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Schema description, or null when the schema was saved without one. The API explicitly maps the absent case to null (see SchemaResponse in openapi.yaml).",
    ),
  definition: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Final schema definition as stored, normalised by the API."),
  field_count: z.number().optional(),
  version: z
    .number()
    .optional()
    .describe("Schema version (1 for new schemas; increments on update)."),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  links: z
    .object({
      self: z.string().optional(),
      extractions: z.string().optional(),
      dashboard: z.string().optional(),
    })
    .optional(),
}

export async function handleSaveSchema(
  talonic: Talonic,
  args: { name: string; definition: Record<string, unknown>; description?: string },
): Promise<ToolResult> {
  try {
    const result = await talonic.schemas.create({
      name: args.name,
      definition: args.definition,
      ...(args.description !== undefined ? { description: args.description } : {}),
    })
    return jsonOk(result)
  } catch (err) {
    return toolError(err)
  }
}

export function registerSaveSchema(server: McpServer, getTalonic: () => Talonic): void {
  server.registerTool(
    "talonic_save_schema",
    {
      title: "Save Talonic Schema",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        title: "Save Talonic Schema",
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        "openai/outputTemplate": WIDGET_URIS.saveSchema,
      },
    },
    async (args) => handleSaveSchema(getTalonic(), args),
  )
}
