import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, runTool } from "./_http.js"
import type { ToolResult } from "./_shared.js"

/**
 * Wrappers over the platform's agent tool registry (`/v1/agent/tools`) — the
 * same LLM-free retrieval and provenance primitives the in-product agent runs
 * on. An API key reaches the `data.read` subset; the platform enforces the
 * capability matrix on every call, so these tools never widen access.
 *
 * `talonic_find_data` is exposed first-class because it is the tool an agent
 * should reach for before any registry lookup: it resolves a natural-language
 * concept to the fields, values, documents and passages that actually carry it.
 */

/** Shape of `POST /v1/agent/tools/:name/invoke`. */
interface InvokeResponse {
  tool: string
  ok: true
  content: string
  cards?: unknown[]
  artifacts?: unknown[]
  citations?: unknown[]
}

/** The invoke route returns the tool's JSON as a string; hand agents the object. */
function unwrap(res: InvokeResponse): Record<string, unknown> {
  let result: unknown = res.content
  if (typeof res.content === "string") {
    try {
      result = JSON.parse(res.content)
    } catch {
      result = res.content
    }
  }
  const out: Record<string, unknown> = { tool: res.tool, result }
  if (res.citations?.length) out["citations"] = res.citations
  if (res.artifacts?.length) out["artifacts"] = res.artifacts
  if (res.cards?.length) out["cards"] = res.cards
  return out
}

const documentIdsArg = z
  .array(z.string().uuid())
  .max(1000)
  .optional()
  .describe("Restrict to these document ids (hard filter, enforced server-side).")

// ── talonic_find_data ───────────────────────────────────────────────────────

const FIND_DESCRIPTION = [
  "Locate the REAL data behind a natural-language concept before querying anything: semantic + lexical retrieval that resolves a phrase ('payment volume per transaction', 'counterparty', 'Vertragslaufzeit') to the registry fields, values, documents and text passages that carry it — even when the field is captured under a different name.",
  "",
  "USE WHEN: the user asks about a concept and you are not sure which field holds it, when talonic_list_fields / talonic_search came back empty or ambiguous, or when the answer may live in document prose rather than a captured cell.",
  "NOT FOR: reading a known field's values (talonic_field_values) or filtering by a known field (talonic_filter).",
  "",
  "ARGS: `query` (the concept, in the user's words), optional `top_k` (1–25, default 10), `document_ids` (hard scope).",
  "RETURNS: ranked planes — FIELDS (canonical_name, field ids/keys, maturity/tier, occurrence_count, sample values with their documents), VALUES, DOCUMENTS and PASSAGES — every item a ready handle for the next call. Read-only, no LLM cost.",
].join("\n")

export const findDataInputSchema = {
  query: z.string().min(1).describe("The natural-language concept to locate."),
  top_k: z.number().int().min(1).max(25).optional().describe("Max results per plane (default 10)."),
  document_ids: documentIdsArg,
}

export interface FindDataArgs {
  query: string
  top_k?: number
  document_ids?: string[]
}

export async function handleFindData(
  getToken: () => string,
  baseUrl: string | undefined,
  args: FindDataArgs,
): Promise<ToolResult> {
  return runTool(async () => {
    const res = await apiJson<InvokeResponse>(
      getToken,
      baseUrl,
      "POST",
      "/v1/agent/tools/find_data/invoke",
      {
        body: {
          args: {
            query: args.query,
            ...(args.top_k !== undefined ? { top_k: args.top_k } : {}),
            ...(args.document_ids?.length ? { document_scope: args.document_ids } : {}),
          },
        },
      },
    )
    return unwrap(res)
  })
}

// ── talonic_list_agent_tools ────────────────────────────────────────────────

const LIST_TOOLS_DESCRIPTION = [
  "List the platform's agent tool registry — every retrieval, provenance and analysis primitive the in-product Talonic agent runs on (find_data, describe_data, query_data for read-only SQL over the extracted data, get_document_markdown, workspace_overview, …) with its input schema and whether THIS credential may invoke it.",
  "",
  "USE WHEN: you want a capability talonic_* tools do not cover directly (e.g. SQL over the structured data, a workspace overview, cohort discovery) — list here, then call talonic_invoke_agent_tool with the tool name and its args.",
  "NOT FOR: discovering fields (talonic_list_fields / talonic_find_data) or documents (talonic_search) — those are shaped for you.",
  "",
  "ARGS: `only_invocable` (default true — hide tools this key cannot run), `include_schemas` (default true — include each tool's JSON input schema).",
  "RETURNS: { tools[] of { name, description, impact, capability, can_invoke, input_schema? }, invocable_count, totalCount }.",
].join("\n")

export const listAgentToolsInputSchema = {
  only_invocable: z
    .boolean()
    .optional()
    .describe("Hide tools this credential cannot invoke. Default true."),
  include_schemas: z
    .boolean()
    .optional()
    .describe("Include each tool's JSON input schema. Default true."),
}

export interface ListAgentToolsArgs {
  only_invocable?: boolean
  include_schemas?: boolean
}

interface ToolListing {
  name: string
  description?: string
  impact?: string
  capability?: string
  can_invoke?: boolean
  input_schema?: unknown
  [k: string]: unknown
}

export async function handleListAgentTools(
  getToken: () => string,
  baseUrl: string | undefined,
  args: ListAgentToolsArgs,
): Promise<ToolResult> {
  return runTool(async () => {
    const res = await apiJson<{
      tools: ToolListing[]
      totalCount?: number
      invocable_count?: number
    }>(getToken, baseUrl, "GET", "/v1/agent/tools")
    const onlyInvocable = args.only_invocable ?? true
    const includeSchemas = args.include_schemas ?? true
    const tools = (res.tools ?? [])
      .filter((t) => !onlyInvocable || t.can_invoke)
      .map((t) => {
        const item: Record<string, unknown> = {
          name: t.name,
          description: t.description,
          impact: t.impact,
          capability: t.capability,
          can_invoke: t.can_invoke,
        }
        if (includeSchemas) item["input_schema"] = t.input_schema
        return item
      })
    return {
      tools,
      invocable_count: res.invocable_count ?? tools.length,
      totalCount: res.totalCount ?? res.tools?.length ?? 0,
    }
  })
}

// ── talonic_invoke_agent_tool ───────────────────────────────────────────────

const INVOKE_DESCRIPTION = [
  "Invoke ONE named tool from the platform's agent tool registry directly, with no model in the loop — you choose the arguments. This is how an external agent uses Talonic's retrieval and provenance while driving control flow itself (e.g. `query_data` for a read-only SQL SELECT over the extracted data, `describe_data` for the queryable field list, `get_document_markdown` to read a document's text).",
  "",
  "USE WHEN: talonic_list_agent_tools showed a tool with can_invoke: true that does what you need. Pass exactly the `args` its input_schema declares.",
  "NOT FOR: anything a dedicated talonic_* tool already does (prefer those — they are shaped for you).",
  "",
  "ARGS: `name` (tool name), `args` (object matching the tool's input_schema), optional `document_ids` (hard scope for scope-aware tools).",
  "RETURNS: { tool, result (the tool's parsed output), citations?, artifacts?, cards? }. Denied capabilities come back as an error naming the capability required; the platform re-checks every call.",
].join("\n")

export const invokeAgentToolInputSchema = {
  name: z.string().min(1).describe("Tool name from talonic_list_agent_tools, e.g. `query_data`."),
  args: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Arguments matching the tool's input_schema."),
  document_ids: documentIdsArg,
}

export interface InvokeAgentToolArgs {
  name: string
  args?: Record<string, unknown>
  document_ids?: string[]
}

export async function handleInvokeAgentTool(
  getToken: () => string,
  baseUrl: string | undefined,
  args: InvokeAgentToolArgs,
): Promise<ToolResult> {
  return runTool(async () => {
    const res = await apiJson<InvokeResponse>(
      getToken,
      baseUrl,
      "POST",
      `/v1/agent/tools/${encodeURIComponent(args.name)}/invoke`,
      {
        body: {
          args: args.args ?? {},
          ...(args.document_ids?.length ? { scope: { document_ids: args.document_ids } } : {}),
        },
      },
    )
    return unwrap(res)
  })
}

// ── registration ────────────────────────────────────────────────────────────

/**
 * Register the agent-registry wrappers.
 *
 * @internal
 */
export function registerAgentRegistryTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_find_data",
    {
      title: "Find the data behind a concept",
      description: FIND_DESCRIPTION,
      inputSchema: findDataInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => handleFindData(getToken, baseUrl, args as FindDataArgs),
  )
  server.registerTool(
    "talonic_list_agent_tools",
    {
      title: "List the platform agent tools",
      description: LIST_TOOLS_DESCRIPTION,
      inputSchema: listAgentToolsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => handleListAgentTools(getToken, baseUrl, args as ListAgentToolsArgs),
  )
  server.registerTool(
    "talonic_invoke_agent_tool",
    {
      title: "Invoke a platform agent tool",
      description: INVOKE_DESCRIPTION,
      inputSchema: invokeAgentToolInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => handleInvokeAgentTool(getToken, baseUrl, args as InvokeAgentToolArgs),
  )
}
