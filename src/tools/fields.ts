import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, runTool, type QueryParams } from "./_http.js"
import { validationError, type ToolResult } from "./_shared.js"

/**
 * Field Registry tools — the workspace's canonical vocabulary as a source of
 * truth for agents: list concepts by maturity, describe one (the concept
 * card), and read its current values across documents with provenance.
 *
 * All three hit the public `/v1/fields*` surface with the caller's bearer
 * (raw fetch — the SDK does not wrap the card / values / resolve routes yet).
 */

const MATURITIES = ["core", "proven", "candidate"] as const

const maturityArg = z
  .enum(MATURITIES)
  .optional()
  .describe(
    "Filter by maturity: `core` (universal, fully trusted — safe to build on), `proven` (recurring, stable id), `candidate` (newly discovered, may still be merged or renamed).",
  )

const fieldIdArg = z
  .string()
  .uuid()
  .optional()
  .describe("Field UUID (from talonic_list_fields / talonic_search).")
const fieldNameArg = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Field NAME instead of an id — resolved through canonical name, synonyms, merge aliases and the registry's spelling fold, then followed to the live concept. Use the user's wording ('Invoice No', 'Vertragsnummer').",
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
  "List the workspace's Field Registry — the canonical concepts Talonic has discovered across every ingested document, each with a stable id, maturity level, data type, synonyms and occurrence count.",
  "",
  "USE WHEN: you need to know WHAT data exists before querying it, want to pick the right concept for a question, or need the exact field id for talonic_get_field / talonic_field_values.",
  "NOT FOR: locating a specific document (talonic_search) or filtering documents by a value (talonic_filter).",
  "",
  "ARGS: `search` (case-insensitive contains on name), `maturity` (core | proven | candidate — prefer `core`/`proven` for anything you will build on), `include_superseded` (default false: rows merged into another concept are hidden so you never see two ids for one concept), `limit`, `cursor`.",
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
    .describe("Include rows merged into a survivor (they carry `superseded_by`). Default false."),
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
  "Get the CONCEPT CARD for one Field Registry field: what it means (curated description + extraction instruction), its synonyms and aliases, maturity, where it occurs (document/occurrence counts, first/last seen, document-type spread), its value distribution (top values with counts, distinct count, examples), schema usage, and identity links (superseded_by, absorbed concepts).",
  "",
  "USE WHEN: you must decide whether a field is the right concept for a question, need example values or the value shape before writing a filter, or hold a field NAME from the user and need the live concept behind it.",
  "NOT FOR: listing many fields (talonic_list_fields) or reading every value (talonic_field_values).",
  "",
  "ARGS: exactly one of `field_id` or `name`. Names are resolved through canonical name → spelling fold → merge aliases → synonyms (then case-insensitive fallbacks) and followed to the live concept; the response says which arm matched. `include_history: true` appends the curation trail (merges, renames, maturity moves).",
  "RETURNS: the card { id, canonical_name, maturity, data_type, definition, identity, occurrence, values, usage, links } plus `resolution` when a name was given and `history` when requested.",
].join("\n")

export const getFieldInputSchema = {
  field_id: fieldIdArg,
  name: fieldNameArg,
  include_history: z
    .boolean()
    .optional()
    .describe(
      "Append the concept's curation history (tier changes, merges, renames), newest first.",
    ),
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
  "Read a field's CURRENT VALUES across documents, with provenance — one row per bound occurrence: document id + filename + type, the value, confidence, the raw name it was captured under, the verbatim source text, and the resolution band that bound it.",
  "",
  "USE WHEN: the user asks 'what are all the X across my documents', you need to tabulate or aggregate one concept across the corpus, or you want the evidence (source text + document) behind a value.",
  "NOT FOR: multi-field row-shaped queries over documents (talonic_filter) or one document's full field set (talonic_get_document).",
  "",
  "ARGS: exactly one of `field_id` or `name`; optional `document_id` (one document), `value` (case-insensitive contains filter), `limit` (max 100), `cursor`.",
  "RETURNS: { field_id, canonical_name, concept_ids, data[] of { occurrence_id, document_id, document_filename, value, confidence, provenance{ raw_field_name, source_text, resolved_by, needs_confirmation, via_redirect }, links }, pagination }. Rows are Sources-IAM filtered for the caller.",
].join("\n")

export const fieldValuesInputSchema = {
  field_id: fieldIdArg,
  name: fieldNameArg,
  document_id: z.string().uuid().optional().describe("Only occurrences on this document."),
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
      title: "List registry fields",
      description: LIST_DESCRIPTION,
      inputSchema: listFieldsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => handleListFields(getToken, baseUrl, args as ListFieldsArgs),
  )
  server.registerTool(
    "talonic_get_field",
    {
      title: "Get a field's concept card",
      description: GET_DESCRIPTION,
      inputSchema: getFieldInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => handleGetField(getToken, baseUrl, args as GetFieldArgs),
  )
  server.registerTool(
    "talonic_field_values",
    {
      title: "Read a field's values across documents",
      description: VALUES_DESCRIPTION,
      inputSchema: fieldValuesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => handleFieldValues(getToken, baseUrl, args as FieldValuesArgs),
  )
}
