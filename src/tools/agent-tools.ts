import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, runTool } from "./_http.js"
import { zUuid, type ToolResult } from "./_shared.js"
import { widgetToolMeta } from "../widgets/types.js"

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
  .array(zUuid())
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
  "RETURNS: four ranked groups — FIELDS (canonical_name, field ids/keys, maturity/tier, occurrence_count, sample values with their documents), VALUES, DOCUMENTS and PASSAGES — every item a ready handle for the next call. Read-only, no LLM cost.",
].join("\n")

export const findDataInputSchema = {
  query: z.string().min(1).describe("The natural-language concept to locate."),
  top_k: z.number().int().min(1).max(25).optional().describe("Max results per group (default 10)."),
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

/**
 * Registry tools that already have a dedicated, shaped MCP tool. They are
 * hidden from talonic_list_agent_tools so a model is never offered two ways
 * to make the same call (talonic_find_data is literally
 * POST /v1/agent/tools/find_data/invoke).
 */
const DEDICATED: ReadonlySet<string> = new Set(["find_data"])

const LIST_TOOLS_DESCRIPTION = [
  "List the platform's agent tool registry — every retrieval, provenance and analysis primitive the in-product Talonic agent runs on (find_data, describe_data, query_data for read-only SQL over the extracted data, get_document_markdown, workspace_overview, …) with its input schema and whether THIS credential may invoke it.",
  "Target API: https://talonic.com/docs/api (GET /v1/agent/tools).",
  "",
  "USE WHEN: you want a capability talonic_* tools do not cover directly (e.g. SQL over the structured data, a workspace overview, cohort discovery) — list here, then call talonic_invoke_agent_tool with the tool name and its args.",
  "NOT FOR: answering the user's question about their documents — call talonic_ask, which runs these same tools server-side in one call and returns a cited answer. Also not for discovering fields (talonic_find_data) or documents (talonic_search).",
  "",
  "ARGS: `only_invocable` (default true — hide tools this credential cannot run), `include_schemas` (default true — include each tool's JSON input schema).",
  "RETURNS: { tools[] of { name, description, impact, capability, can_invoke, input_schema? }, invocable_count, totalCount }. Registry tools that already have their own talonic_* tool (find_data) are left out; call the dedicated tool.",
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
    const registry = (res.tools ?? []).filter((t) => !DEDICATED.has(t.name))
    const tools = registry
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
      invocable_count: registry.filter((t) => t.can_invoke).length,
      totalCount: registry.length,
    }
  })
}

// ── talonic_invoke_agent_tool ───────────────────────────────────────────────

const INVOKE_DESCRIPTION = [
  "Invoke ONE named tool from the platform's agent tool registry directly, with no model in the loop (e.g. `query_data` for a read-only SQL SELECT over the extracted data, `describe_data` for the queryable field list, `get_document_markdown` to read a document's text).",
  "READ-ONLY FOR EVERY CREDENTIAL: the platform runs each caller of this route, API key or OAuth session alike, as its least-privilege viewer role, which grants only the registry's read-only tools (capability `data.read`). Write-capable registry tools are never invocable here, however you connected, so this tool reads and never changes workspace data.",
  "Target API: Talonic agent tool registry — https://talonic.com/docs/api (POST /v1/agent/tools/{name}/invoke; input schemas from talonic_list_agent_tools).",
  "",
  "USE WHEN: talonic_list_agent_tools showed a tool with can_invoke: true that does what you need. Pass exactly the `args` its input_schema declares.",
  "NOT FOR: answering a question about the documents (talonic_ask runs these tools server-side and returns one cited answer). Use this only for a query the user asked for, or when talonic_ask could not answer.",
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

/**
 * Registry tools a model reaches for when it is answering a question itself
 * (exploring the data, then SQL attempt after SQL attempt). Their results
 * carry {@link ASK_HINT} so the model sees, at the moment it chooses that
 * route, that one talonic_ask call does the same work server-side.
 */
const ANALYSIS_TOOLS: ReadonlySet<string> = new Set([
  "query_data",
  "describe_data",
  "workspace_overview",
  "plan_fields",
])

/** @internal */
export const ASK_HINT =
  "If you are answering a question about the documents, call talonic_ask with the user's question instead of further queries: it runs this same SQL, field lookup and document reading server-side, knows the workspace's real field names and duplicate rules, and returns one cited answer in a single call."

/** @internal */
export const UNKNOWN_KEY_HINT =
  "talonic_ask resolves field names itself; call it with the user's question rather than guessing field_key values."

export async function handleInvokeAgentTool(
  getToken: () => string,
  baseUrl: string | undefined,
  args: InvokeAgentToolArgs,
): Promise<ToolResult> {
  const result = await invokeAgentTool(getToken, baseUrl, args)
  if (!ANALYSIS_TOOLS.has(args.name)) return result
  const first = result.content[0]
  if (!first) return result
  if (result.isError) {
    if (/Unknown field_key|Unknown claim predicate/.test(first.text)) {
      first.text = `${first.text}\n${UNKNOWN_KEY_HINT}`
    }
    return result
  }
  if (result["structuredContent"] && typeof result["structuredContent"] === "object") {
    ;(result["structuredContent"] as Record<string, unknown>)["next_step"] = ASK_HINT
  }
  // A separate item, so content[0] stays parseable JSON for clients that read it.
  result.content.push({ type: "text", text: `Next step: ${ASK_HINT}` })
  return result
}

async function invokeAgentTool(
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
  opts: { includeGenericExecutor?: boolean } = {},
): void {
  server.registerTool(
    "talonic_find_data",
    {
      title: "Find where data lives",
      description: FIND_DESCRIPTION,
      inputSchema: findDataInputSchema,
      annotations: {
        title: "Find where data lives",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetToolMeta("findData"),
    },
    async (args) => handleFindData(getToken, baseUrl, args as FindDataArgs),
  )
  // The list + invoke pair is a generic executor over the platform registry.
  // OpenAI's plugin review rejects that shape (every model-callable operation
  // must be its own reviewed tool), so the hosted entrypoint omits the pair
  // for ChatGPT / OpenAI callers. Other clients keep it.
  if (opts.includeGenericExecutor === false) return
  server.registerTool(
    "talonic_list_agent_tools",
    {
      title: "List data tools",
      description: LIST_TOOLS_DESCRIPTION,
      inputSchema: listAgentToolsInputSchema,
      annotations: {
        title: "List data tools",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetToolMeta("listAgentTools"),
    },
    async (args) => handleListAgentTools(getToken, baseUrl, args as ListAgentToolsArgs),
  )
  server.registerTool(
    "talonic_invoke_agent_tool",
    {
      title: "Query workspace data",
      description: INVOKE_DESCRIPTION,
      inputSchema: invokeAgentToolInputSchema,
      annotations: {
        title: "Query workspace data",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: widgetToolMeta("invokeAgentTool"),
    },
    async (args) => handleInvokeAgentTool(getToken, baseUrl, args as InvokeAgentToolArgs),
  )
}
