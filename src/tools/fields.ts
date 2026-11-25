import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, runTool, type QueryParams } from "./_http.js"
import { validationError, type ToolResult, zUuid } from "./_shared.js"
import { widgetToolMeta } from "../widgets/types.js"

/**
 * Field tools: the fields a workspace's documents carry, as a source of
 * truth for agents: list them by maturity, describe one, and read its
 * current values across documents with evidence.
 *
 * All three hit the public `/v1/fields*` surface with the caller's bearer
 * (raw fetch — the SDK does not wrap the card / values / resolve routes yet).
 */

const MATURITIES = ["core", "proven", "candidate"] as const

const maturityArg = z
  .enum(MATURITIES)
  .optional()
  .describe(
    "Filter by maturity: `core` (established and trusted, safe to build on), `proven` (recurring, stable id), `candidate` (seen recently, may still be merged or renamed).",
  )

const fieldIdArg = zUuid()
  .optional()
  .describe("Field UUID (from talonic_list_fields / talonic_search).")
const fieldNameArg = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Field NAME instead of an id — matched against the field's name, other spellings and synonyms, including fields that were merged into it. Use the user's wording ('Invoice No', 'Vertragsnummer').",
  )

/** Resolve an `{ field_id | name }` pair to a field id, following redirects for names. */
async function resolveFieldId(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { field_id?: string; name?: string },
): Promise<{ id: string; resolution?: unknown }> {
  if (args.field_id) return { id: args.field_id }
  const resolved = await apiJson<{
    field: { id: string }
    matched_by: string
    redirected_from: string[]
  }>(getToken, baseUrl, "GET", "/v1/fields/resolve", {
    params: { name: args.name, follow_redirects: true },
  })
  return {
    id: resolved.field.id,
    resolution: { matched_by: resolved.matched_by, redirected_from: resolved.redirected_from },
  }
}

// ── talonic_list_fields ─────────────────────────────────────────────────────

const LIST_DESCRIPTION = [
  "List the fields your workspace's documents carry (vendor name, invoice total, notice period …), each with a stable id, how established it is (maturity), data type, synonyms and how often it occurs.",
  "",
  "USE WHEN: you need to know WHAT data exists before querying it, want to pick the right concept for a question, or need the exact field id for talonic_get_field / talonic_field_values.",
  "NOT FOR: locating a specific document (talonic_search) or filtering documents by a value (talonic_filter). Not a warm-up before answering a question about the documents: call talonic_ask for that. Many fields are one-off candidates; pass maturity core or proven unless the user asks for candidates.",
  "",
  "ARGS: `search` (case-insensitive contains on name), `maturity` (core | proven | candidate — prefer `core`/`proven` for anything you will build on), `include_superseded` (default false: fields merged into another are hidden so you never see two ids for one field), `limit`, `cursor`.",
  "RETURNS: data[] of { id, canonical_name, display_name, data_type, maturity, tier, synonyms, description, occurrence_count, superseded_by, links } plus cursor pagination.",
].join("\n")

export const listFieldsInputSchema = {
  search: z
    .string()
    .optional()
    .describe("Case-insensitive contains match on canonical_name / display_name."),
  maturity: maturityArg,
  include_superseded: z
    .boolean()
    .optional()
    .describe(
      "Include fields merged into another one (they carry `superseded_by`). Default false.",
    ),
  limit: z.number().int().min(1).max(100).optional().describe("Page size (default 20, max 100)."),
  cursor: z.string().optional().describe("Opaque cursor from pagination.next_cursor."),
}

export interface ListFieldsArgs {
  search?: string
  maturity?: (typeof MATURITIES)[number]
  include_superseded?: boolean
  limit?: number
  cursor?: string
}

export async function handleListFields(
  getToken: () => string,
  baseUrl: string | undefined,
  args: ListFieldsArgs,
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/fields", {
      params: {
        search: args.search,
        maturity: args.maturity,
        include_superseded: args.include_superseded,
        limit: args.limit,
        cursor: args.cursor,
      },
    }),
  )
}

// ── talonic_get_field ───────────────────────────────────────────────────────

const GET_DESCRIPTION = [
  "Describe one field: what it means, its synonyms and other names, maturity, where it occurs (document and occurrence counts, first and last seen, which document types), its values (top values with counts, distinct count, examples), which schemas use it, and the fields merged into it (superseded_by).",
  "",
  "USE WHEN: you must decide whether a field is the right one for a question, need example values or the value shape before writing a filter, or hold a field NAME from the user and need the field behind it.",
  "NOT FOR: listing many fields (talonic_list_fields) or reading every value (talonic_field_values).",
  "",
  "ARGS: exactly one of `field_id` or `name`. A name is matched against field names, other spellings and synonyms and followed to the current field; `resolution` says how it matched. `include_history: true` adds the field's history (merges, renames, maturity changes).",
  "RETURNS: the card { id, canonical_name, maturity, data_type, definition, identity, occurrence, values, usage, links } plus `resolution` when a name was given and `history` when requested.",
].join("\n")

export const getFieldInputSchema = {
  field_id: fieldIdArg,
  name: fieldNameArg,
  include_history: z
    .boolean()
    .optional()
    .describe("Add the field's history (maturity changes, merges, renames), newest first."),
}

export interface GetFieldArgs {
  field_id?: string
  name?: string
  include_history?: boolean
}

export async function handleGetField(
  getToken: () => string,
  baseUrl: string | undefined,
  args: GetFieldArgs,
): Promise<ToolResult> {
  if (!args.field_id && !args.name) return validationError("Provide `field_id` or `name`.")
  if (args.field_id && args.name)
    return validationError("Provide either `field_id` or `name`, not both.")
  return runTool(async () => {
    const { id, resolution } = await resolveFieldId(getToken, baseUrl, args)
    const card = await apiJson<Record<string, unknown>>(
      getToken,
      baseUrl,
      "GET",
      `/v1/fields/${id}/card`,
      {
        params: { follow_redirects: true },
      },
    )
    const out: Record<string, unknown> = { ...card }
    if (resolution) out["resolution"] = resolution
    if (args.include_history) {
      out["history"] = await apiJson(getToken, baseUrl, "GET", `/v1/fields/${id}/history`, {
        params: { limit: 50 },
      })
    }
    return out
  })
}

// ── talonic_field_values ────────────────────────────────────────────────────

const VALUES_DESCRIPTION = [
  "Read a field's CURRENT VALUES across documents, with evidence: one row per value, with the document id, filename and type, the value, its confidence, the label it appeared under in the document, the exact source text, and how the label was matched to this field (`resolved_by`).",
  "",
  "USE WHEN: the user asks 'what are all the X across my documents', you need to tabulate or total one field across all documents, or you want the evidence (source text + document) behind a value.",
  "NOT FOR: multi-field row-shaped queries over documents (talonic_filter) or one document's full field set (talonic_get_document).",
  "",
  "ARGS: exactly one of `field_id` or `name`; optional `document_id` (one document), `value` (case-insensitive contains filter), `limit` (max 100), `cursor`.",
  "RETURNS: { field_id, canonical_name, concept_ids, data[] of { occurrence_id, document_id, document_filename, value, confidence, provenance{ raw_field_name, source_text, resolved_by, needs_confirmation, via_redirect }, links }, pagination }. Only rows from documents the caller may see are returned.",
].join("\n")

export const fieldValuesInputSchema = {
  field_id: fieldIdArg,
  name: fieldNameArg,
  document_id: zUuid().optional().describe("Only occurrences on this document."),
  value: z.string().optional().describe("Case-insensitive contains filter on the value text."),
  limit: z.number().int().min(1).max(100).optional().describe("Page size (default 20, max 100)."),
  cursor: z.string().optional().describe("Opaque cursor from pagination.next_cursor."),
}

export interface FieldValuesArgs {
  field_id?: string
  name?: string
  document_id?: string
  value?: string
  limit?: number
  cursor?: string
}

export async function handleFieldValues(
  getToken: () => string,
  baseUrl: string | undefined,
  args: FieldValuesArgs,
): Promise<ToolResult> {
  if (!args.field_id && !args.name) return validationError("Provide `field_id` or `name`.")
  if (args.field_id && args.name)
    return validationError("Provide either `field_id` or `name`, not both.")
  return runTool(async () => {
    const { id, resolution } = await resolveFieldId(getToken, baseUrl, args)
    const params: QueryParams = {
      document_id: args.document_id,
      value: args.value,
      limit: args.limit,
      cursor: args.cursor,
    }
    const page = await apiJson<Record<string, unknown>>(
      getToken,
      baseUrl,
      "GET",
      `/v1/fields/${id}/values`,
      { params },
    )
    return resolution ? { ...page, resolution } : page
  })
}

// ── registration ────────────────────────────────────────────────────────────

/**
 * Register the three Field Registry tools.
 *
 * @internal
 */
export function registerFieldTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_list_fields",
    {
      title: "List fields",
      description: LIST_DESCRIPTION,
      inputSchema: listFieldsInputSchema,
      annotations: {
        title: "List fields",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetToolMeta("listFields"),
    },
    async (args) => handleListFields(getToken, baseUrl, args as ListFieldsArgs),
  )
  server.registerTool(
    "talonic_get_field",
    {
      title: "Look up a field",
      description: GET_DESCRIPTION,
      inputSchema: getFieldInputSchema,
      annotations: {
        title: "Look up a field",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetToolMeta("getField"),
    },
    async (args) => handleGetField(getToken, baseUrl, args as GetFieldArgs),
  )
  server.registerTool(
    "talonic_field_values",
    {
      title: "Read a field's values",
      description: VALUES_DESCRIPTION,
      inputSchema: fieldValuesInputSchema,
      annotations: {
        title: "Read a field's values",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetToolMeta("fieldValues"),
    },
    async (args) => handleFieldValues(getToken, baseUrl, args as FieldValuesArgs),
  )
}
