import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { WIDGET_URIS } from "../widgets/types.js"

const DESCRIPTION = [
  "Save a reusable schema to the workspace for use across future extractions.",
  "",
  "USE WHEN: the user confirms a schema/template they want to reuse across documents.",
  "NOT FOR: a single one-off extraction (pass the schema inline to talonic_extract instead).",
  "ARGS: `name`; `definition` — a JSON Schema ({type:'object',properties:{...}}) or a flat {field:'type'} map.",
  "RETURNS: the saved schema with id and short_id. Pass either to talonic_extract as `schema_id`.",
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
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URIS.saveSchema },
        "openai/outputTemplate": WIDGET_URIS.saveSchema,
      },
    },
    async (args) => handleSaveSchema(getTalonic(), args),
  )
}
