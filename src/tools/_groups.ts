import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ZodRawShape } from "zod"
import { apiJson, probeAccessState, runTool, type HttpMethod, type ProbeAnswer } from "./_http.js"
import type { ToolResult } from "./_shared.js"

/**
 * Probe-gated tool groups: one data file per platform family (Contract Desk,
 * Transport Folders, Compliance, admin, …). Each tool is bound to exactly one
 * `/v1` route; the generic handler fills the route's `{param}` placeholders
 * from the arguments of the same (snake_case) name, sends the listed query
 * arguments as the query string and the listed body arguments as the JSON
 * body. A tool with an odd shape (binary download, wait loop) brings its own
 * `handler`.
 *
 * A group is listed only when its probe answers true for the session's
 * credential (hosted: per-token 5-minute cache in `http-server.ts`; stdio:
 * once at boot), so a workspace without the app never sees tools that would
 * 404. The probe is listing UX only: the platform authorizes every call.
 */

/** What a tool handler gets: the caller's bearer and the API origin. */
export interface GroupContext {
  getToken: () => string
  baseUrl: string | undefined
}

/** MCP tool annotations as the groups declare them. */
export interface GroupAnnotations {
  readOnlyHint: boolean
  destructiveHint: boolean
  idempotentHint: boolean
  openWorldHint: boolean
}

/** A read: no side effects. */
export const READ: GroupAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

/** A write; `destructive` for deletes and anything that cannot be taken back. */
export const write = (idempotent: boolean, destructive = false): GroupAnnotations => ({
  readOnlyHint: false,
  destructiveHint: destructive,
  idempotentHint: idempotent,
  openWorldHint: false,
})

/** `{argName: "wireName"}` or a list of names sent unchanged. */
export type ArgMap = readonly string[] | Readonly<Record<string, string>>

/** One tool of a group. */
export interface GroupTool {
  name: string
  title: string
  description: string
  /** The one platform route this tool calls, e.g. `DELETE /v1/webhooks/{id}`. */
  route: `${HttpMethod} /v1/${string}`
  inputSchema: ZodRawShape
  annotations: GroupAnnotations
  /** Arguments sent as the query string. */
  query?: ArgMap
  /** Arguments sent as the JSON body; `"rest"` = every argument not used by the path or query. */
  body?: ArgMap | "rest"
  /** Replaces the generic handler (binary downloads, wait loops, client-side checks). */
  handler?: (ctx: GroupContext, args: Record<string, unknown>) => Promise<ToolResult>
}

/** A family of tools listed together behind one probe. */
export interface ToolGroup {
  /** Stable key, used by `createServer({ toolGroups })` and the hosted cache. */
  key: string
  /** Human name of the family, for docs and tests. */
  label: string
  /** The docs section slug (src/content/sections/tool-groups.ts) that documents every tool of the group. */
  docsSlug: string
  /** A read-only GET whose 2xx means the group is usable by this credential. */
  probe: { path: `/v1/${string}`; params?: Record<string, string | number | boolean> }
  tools: GroupTool[]
}

const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

/** The route's placeholders, in order, as argument names (`{folderId}` → `folder_id`). */
export function routeParams(route: string): string[] {
  return [...route.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => camelToSnake(m[1]!))
}

function entries(map: ArgMap): Array<[string, string]> {
  return Array.isArray(map)
    ? (map as readonly string[]).map((k) => [k, k])
    : Object.entries(map as Record<string, string>)
}

/**
 * The method, path, query and body a tool's route and arguments produce.
 * Throws when a path argument is missing (the input schema should have
 * required it; this keeps a bad call from hitting a different route).
 *
 * @internal
 */
export function buildRequest(
  tool: Pick<GroupTool, "route" | "query" | "body">,
  args: Record<string, unknown>,
): {
  method: HttpMethod
  path: string
  params: Record<string, string | number | boolean | undefined>
  body: unknown
} {
  const space = tool.route.indexOf(" ")
  const method = tool.route.slice(0, space) as HttpMethod
  const template = tool.route.slice(space + 1)
  const used = new Set<string>()
  const path = template.replace(/\{([A-Za-z0-9_]+)\}/g, (_m, name: string) => {
    const arg = camelToSnake(name)
    const value = args[arg]
    if (value === undefined || value === null || value === "") {
      throw new Error(`Validation error: \`${arg}\` is required.`)
    }
    used.add(arg)
    return encodeURIComponent(String(value))
  })
  const params: Record<string, string | number | boolean | undefined> = {}
  for (const [arg, wire] of entries(tool.query ?? [])) {
    used.add(arg)
    const v = args[arg]
    if (v === undefined || v === null) continue
    params[wire] = Array.isArray(v) ? v.join(",") : (v as string | number | boolean)
  }
  let body: unknown = undefined
  if (tool.body === "rest") {
    const rest: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(args)) if (!used.has(k) && v !== undefined) rest[k] = v
    body = rest
  } else if (tool.body) {
    const picked: Record<string, unknown> = {}
    for (const [arg, wire] of entries(tool.body)) {
      if (args[arg] !== undefined) picked[wire] = args[arg]
    }
    body = picked
  } else if (method === "POST" || method === "PUT" || method === "PATCH") {
    body = {}
  }
  return { method, path, params, body }
}

/** Run one tool of a group: its own handler, or the generic route call. @internal */
export function runGroupTool(
  tool: GroupTool,
  ctx: GroupContext,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  if (tool.handler) return tool.handler(ctx, args)
  return runTool(async () => {
    const req = buildRequest(tool, args)
    return apiJson(ctx.getToken, ctx.baseUrl, req.method, req.path, {
      params: req.params,
      ...(req.body !== undefined ? { body: req.body } : {}),
    })
  })
}

/** Register every tool of a group on the server. @internal */
export function registerGroup(
  server: McpServer,
  group: ToolGroup,
  getToken: () => string,
  baseUrl: string | undefined,
): void {
  const ctx: GroupContext = { getToken, baseUrl }
  for (const tool of group.tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { title: tool.title, ...tool.annotations },
      },
      async (args: unknown) => runGroupTool(tool, ctx, (args ?? {}) as Record<string, unknown>),
    )
  }
}

/** Ask the group's probe route. Never throws. @internal */
export function probeGroup(
  group: ToolGroup,
  token: string,
  baseUrl: string | undefined,
): Promise<ProbeAnswer> {
  return probeAccessState(token, baseUrl, group.probe.path, () => true, group.probe.params ?? {})
}

/** Description block in the house format (WHAT / USE WHEN / NOT FOR / ARGS / RETURNS). @internal */
export function describe(parts: {
  what: string
  use: string
  not?: string
  args?: string
  returns: string
  errors?: string
}): string {
  return [
    parts.what,
    `USE WHEN: ${parts.use}`,
    ...(parts.not ? [`NOT FOR: ${parts.not}`] : []),
    "",
    `ARGS: ${parts.args ?? "none."}`,
    `RETURNS: ${parts.returns}`,
    ...(parts.errors ? [`ERRORS: ${parts.errors}`] : []),
  ].join("\n")
}
