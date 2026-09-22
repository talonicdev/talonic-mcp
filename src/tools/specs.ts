import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, runTool, type QueryParams } from "./_http.js"
import type { ToolResult } from "./_shared.js"

/**
 * Spec tools — the configured pipelines a workspace runs. A Spec is the
 * authoring document behind `/specs/{id}` in the app; running it materializes
 * onto a schema (`schema_id`, a DIFFERENT id). Raw fetch over `/v1/specs*`
 * (the SDK does not wrap these routes).
 */

const LIST_DESCRIPTION = [
  "List the workspace's Specs — the configured pipelines (rail + fields) that talonic_run_spec executes. Each row: id, name, description, schema_id (the schema a run materializes onto — a DIFFERENT id from the Spec's), version / materialized_version (null = never published), field_count, node_count, timestamps.",
  "",
  "USE WHEN: the user wants to run 'their pipeline' / 'the invoice Spec', or you need a spec_id for talonic_run_spec / talonic_get_spec.",
  "NOT FOR: ad-hoc extraction schemas (talonic_list_schemas) or discovering fields (talonic_list_fields).",
  "ARGS: optional `search` (name contains, case-insensitive), `limit` (1–100, default 20), `cursor` (from pagination.next_cursor), `order` (asc|desc by updated_at).",
  "RETURNS: { data[] of { id, name, description, schema_id, version, materialized_version, materialized_at, field_count, node_count, created_at, updated_at, links }, pagination { total, limit, has_more, next_cursor } }.",
].join("\n")

const GET_DESCRIPTION = [
  "Get one Spec's structure: identity and version state, the schema it materializes onto, `nodes[]` (the rail as authored, in editing order) and `phases[]` (the compiled execution plan, in run order — a validation checkpoint expands to one phase per gate, so the two lists differ on purpose), and `fields[]` (Spec field ↔ schema field).",
  "",
  "USE WHEN: you need to explain what a run will do, confirm a Spec is published (`version` non-null) before talonic_run_spec, or map field names to keys.",
  "NOT FOR: listing Specs (talonic_list_specs) or starting a run (talonic_run_spec).",
  "ARGS: `spec_id` (UUID from talonic_list_specs); optional `include_versions` (adds `versions[]` — published versions newest first, each { version, content_hash, created_at, is_materialized }).",
  "RETURNS: the Spec object { id, name, description, schema_id, version, materialized_version, materialized_at, field_count, node_count, schema, nodes[], phases[], fields[], links } plus optional versions[].",
].join("\n")

const listSpecsInputSchema = {
  search: z
    .string()
    .min(1)
    .optional()
    .describe("Case-insensitive contains match on the Spec name."),
  limit: z.number().int().min(1).max(100).optional().describe("Page size (default 20)."),
  cursor: z.string().min(1).optional().describe("Opaque cursor from pagination.next_cursor."),
  order: z.enum(["asc", "desc"]).optional().describe("Sort by updated_at (default desc)."),
}

const getSpecInputSchema = {
  spec_id: z.string().uuid().describe("Spec UUID (from talonic_list_specs)."),
  include_versions: z
    .boolean()
    .optional()
    .describe("Also fetch the published versions list (adds `versions[]`)."),
}

export interface ListSpecsArgs {
  search?: string
  limit?: number
  cursor?: string
  order?: "asc" | "desc"
}

export interface GetSpecArgs {
  spec_id: string
  include_versions?: boolean
}

/** @internal Exported for unit testing. */
export async function handleListSpecs(
  getToken: () => string,
  baseUrl: string | undefined,
  args: ListSpecsArgs,
): Promise<ToolResult> {
  const params: QueryParams = {
    search: args.search,
    limit: args.limit,
    cursor: args.cursor,
    order: args.order,
  }
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/specs", { params }))
}

/** @internal Exported for unit testing. */
export async function handleGetSpec(
  getToken: () => string,
  baseUrl: string | undefined,
  args: GetSpecArgs,
): Promise<ToolResult> {
  return runTool(async () => {
    const path = `/v1/specs/${encodeURIComponent(args.spec_id)}`
    const spec = await apiJson<Record<string, unknown>>(getToken, baseUrl, "GET", path)
    if (!args.include_versions) return spec
    const versions = await apiJson<{ data?: unknown[] }>(
      getToken,
      baseUrl,
      "GET",
      `${path}/versions`,
    )
    return { ...spec, versions: versions.data ?? [] }
  })
}

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

/** Register the two Spec tools. @internal */
export function registerSpecTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_list_specs",
    {
      title: "List Specs",
      description: LIST_DESCRIPTION,
      inputSchema: listSpecsInputSchema,
      annotations: { title: "List Specs", ...READ_ONLY },
    },
    async (args) => handleListSpecs(getToken, baseUrl, args as ListSpecsArgs),
  )
  server.registerTool(
    "talonic_get_spec",
    {
      title: "Get a Spec's structure",
      description: GET_DESCRIPTION,
      inputSchema: getSpecInputSchema,
      annotations: { title: "Get a Spec's structure", ...READ_ONLY },
    },
    async (args) => handleGetSpec(getToken, baseUrl, args as GetSpecArgs),
  )
}
