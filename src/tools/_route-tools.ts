import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { z } from "zod"
import { apiJson, runTool, type HttpMethod, type QueryParams } from "./_http.js"
import { validationError, type ToolResult } from "./_shared.js"

/**
 * A small, local data model for tools that each wrap exactly one `/v1` route:
 * the route template names its path arguments (`{pipeline_id}`), `query` and
 * `body` name the arguments forwarded there, and a tool with an unusual shape
 * (multipart upload, an argument that picks the route) brings its own handler.
 *
 * Used by the workspace operation families (pipelines, ingest, document
 * organising, collections, saved filters, document types).
 */

/** MCP tool annotations. */
export interface ToolAnnotations {
  readOnlyHint: boolean
  destructiveHint: boolean
  idempotentHint: boolean
  openWorldHint: boolean
}

/** A lookup: changes nothing. */
export const READ: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

/** Saves nothing, but answers differently on each call (a fresh sample, a fresh draft). */
export const READ_FRESH: ToolAnnotations = { ...READ, idempotentHint: false }

/** Changes workspace data; nothing is lost. */
export const write = (idempotent = false): ToolAnnotations => ({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: idempotent,
  openWorldHint: false,
})

/** Removes, replaces or overwrites something: clients ask the person before calling. */
export const destructive = (idempotent = false): ToolAnnotations => ({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: idempotent,
  openWorldHint: false,
})

/**
 * What every tool says about a refusal. The platform names the reason on a
 * 403; the agent should relay it rather than retry.
 */
export const REFUSALS =
  "A 403 names its reason (insufficient_scope, insufficient_role, no_person, person_inactive, workspace_read_only): the key's person must be allowed the same action in the Talonic web app, and an OAuth connection must have granted the scope. Tell the user; do not retry."

/** A tool bound to one `/v1` route. */
export interface RouteTool {
  name: string
  title: string
  description: string
  /** `"METHOD /v1/path/{arg}"`; every `{arg}` is a required input argument. */
  route: string
  /** Further routes an argument of this tool can pick (custom handler). */
  alsoRoutes?: string[]
  input: Record<string, z.ZodTypeAny>
  annotations: ToolAnnotations
  /** Arguments sent as query parameters (arrays are joined with commas). */
  query?: string[]
  /** Arguments sent in the JSON body (only those given). */
  body?: string[]
  /** A check before calling: a message refuses the call at the MCP layer. */
  validate?: (args: Record<string, unknown>) => string | null
  /** A tool whose call is not a plain JSON round-trip. */
  handler?: (args: Record<string, unknown>, ctx: RouteToolContext) => Promise<ToolResult>
}

/** What a custom handler needs to call the API. */
export interface RouteToolContext {
  getToken: () => string
  baseUrl: string | undefined
}

/** Split `"METHOD /path"` into its parts. */
export function parseRoute(route: string): { method: HttpMethod; path: string } {
  const [method, path] = route.split(" ") as [HttpMethod, string]
  return { method, path }
}

/** The path arguments a route template names. */
export function routeArgs(route: string): string[] {
  return [...route.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]!)
}

/** Fill a route template's `{arg}` slots, URL-encoded. */
export function fillPath(path: string, args: Record<string, unknown>): string {
  return path.replace(/\{([a-z_]+)\}/g, (_, k: string) => encodeURIComponent(String(args[k])))
}

/** A check that at least one of `keys` was given. */
export const atLeastOne =
  (...keys: string[]) =>
  (args: Record<string, unknown>): string | null =>
    keys.some((k) => args[k] !== undefined) ? null : `Give at least one of: ${keys.join(", ")}.`

function queryValue(v: unknown): string | number | boolean | undefined {
  if (v === undefined || v === null) return undefined
  if (Array.isArray(v)) return v.length ? v.map(String).join(",") : undefined
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v
  return JSON.stringify(v)
}

/** Call a route tool's API route with the given arguments. @internal */
export async function callRouteTool(
  tool: RouteTool,
  args: Record<string, unknown>,
  ctx: RouteToolContext,
): Promise<ToolResult> {
  for (const k of routeArgs(tool.route)) {
    if (typeof args[k] !== "string" || args[k] === "")
      return validationError(`\`${k}\` is required.`)
  }
  const refusal = tool.validate?.(args)
  if (refusal) return validationError(refusal)
  if (tool.handler) return tool.handler(args, ctx)
  const { method, path } = parseRoute(tool.route)
  const params: QueryParams = {}
  for (const k of tool.query ?? []) params[k] = queryValue(args[k])
  let body: Record<string, unknown> | undefined
  if (tool.body) {
    body = {}
    for (const k of tool.body) if (args[k] !== undefined) body[k] = args[k]
  } else if (method === "POST" || method === "PATCH" || method === "PUT") {
    body = {}
  }
  return runTool(() =>
    apiJson(ctx.getToken, ctx.baseUrl, method, fillPath(path, args), {
      params,
      ...(body !== undefined ? { body } : {}),
    }),
  )
}

/** Register a list of route tools on the server. @internal */
export function registerRouteTools(
  server: McpServer,
  tools: readonly RouteTool[],
  getToken: () => string,
  baseUrl?: string,
): void {
  const ctx: RouteToolContext = { getToken, baseUrl }
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: { title: tool.title, ...tool.annotations },
      },
      async (args: unknown) =>
        callRouteTool(tool, (args ?? {}) as Record<string, unknown>, ctx) as Promise<any>,
    )
  }
}
