import type { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js"
import { handleRunApp } from "./apps.js"
import { jsonSchemaToZodShape } from "./json-schema-to-zod.js"

/**
 * Dynamic per-app tools: every enabled Talonic App is published as its own
 * MCP tool named `app_<slug>`, with the app's input schema as the tool
 * schema (docs/APPS-SPEC.md §B3.3).
 *
 * Transport split (locked design decision):
 * - Hosted HTTP is stateless — a fresh `McpServer` per POST — so the tool
 *   list is COMPUTED PER REQUEST from the token-scoped catalog and there is
 *   no `listChanged` channel to push on. Clients pick changes up on their
 *   next `tools/list`.
 * - stdio keeps a live session, so a periodic catalog diff drives
 *   register/update/remove plus `notifications/tools/list_changed`.
 */

const DEFAULT_BASE = "https://api.talonic.com"

/** Catalog manifest fields the dynamic surface consumes. */
export interface AppCatalogEntry {
  id: string
  slug: string
  display_name?: string
  description?: string
  mode?: string
  version?: number
  content_hash?: string
  enabled?: boolean
  input_schema?: unknown
  output_contract?: unknown
}

export interface AppsCatalog {
  etag: string | null
  apps: AppCatalogEntry[]
}

/**
 * Per-token catalog cache (5 min TTL, coarse clear at 1,000 entries — the
 * `adminAgentTaskProbeCache` pattern). Entries keep the ETag so a refetch
 * after TTL can send `If-None-Match` and ride a 304.
 */
const CATALOG_TTL_MS = 5 * 60 * 1000
const catalogCache = new Map<string, { catalog: AppsCatalog; expiresAt: number }>()

/** @internal Exported for tests. */
export function clearAppsCatalogCache(): void {
  catalogCache.clear()
}

/**
 * Fetch the token-scoped catalog of ENABLED apps. Returns null on any
 * failure — dynamic tools then simply don't register; the static management
 * toolset still works and the platform remains the security boundary.
 *
 * @internal Exported for tests.
 */
export async function fetchAppsCatalog(
  token: string,
  baseUrl?: string,
  now: () => number = Date.now,
): Promise<AppsCatalog | null> {
  const cached = catalogCache.get(token)
  if (cached && cached.expiresAt > now()) return cached.catalog

  try {
    const base = (baseUrl ?? DEFAULT_BASE).replace(/\/$/, "")
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    }
    if (cached?.catalog.etag) headers["If-None-Match"] = cached.catalog.etag
    const response = await fetch(`${base}/v1/apps?enabled=true`, {
      headers,
      signal: AbortSignal.timeout(5_000),
    })
    if (response.status === 304 && cached) {
      const refreshed = { catalog: cached.catalog, expiresAt: now() + CATALOG_TTL_MS }
      catalogCache.set(token, refreshed)
      return cached.catalog
    }
    if (!response.ok) return cached?.catalog ?? null
    const body = (await response.json()) as unknown
    const apps = Array.isArray(body)
      ? (body as AppCatalogEntry[])
      : (((body as Record<string, unknown>)["data"] ?? []) as AppCatalogEntry[])
    const catalog: AppsCatalog = {
      etag: response.headers.get("etag"),
      apps: apps.filter((a) => a && typeof a.slug === "string" && a.enabled !== false),
    }
    if (catalogCache.size >= 1000) catalogCache.clear()
    catalogCache.set(token, { catalog, expiresAt: now() + CATALOG_TTL_MS })
    return catalog
  } catch {
    return cached?.catalog ?? null
  }
}

/**
 * Map an app slug to a legal MCP tool name. Slugs are `[a-z0-9-]`, MCP tool
 * names allow `[a-zA-Z0-9_-]`; we normalize hyphens to underscores for
 * readability (`load-auto-billing` → `app_load_auto_billing`) and defend
 * against anything else. Post-mapping collisions (`a-b` vs `a_b`) get a
 * numeric suffix in registration order.
 *
 * @internal Exported for tests.
 */
export function toolNameForSlug(slug: string, taken?: Set<string>): string {
  const base = `app_${slug.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/-/g, "_")}`
  if (!taken) return base
  let name = base
  let n = 2
  while (taken.has(name)) name = `${base}_${n++}`
  taken.add(name)
  return name
}

function toolDescription(app: AppCatalogEntry, fallbackNote?: string): string {
  const lines = [
    `Run the Talonic App '${app.display_name ?? app.slug}'${app.version ? ` (v${app.version})` : ""}: ${
      app.description ?? "a governed decision app."
    }`,
    "",
    "Executes one governed run and returns the decision with run id, evidence, and a sealed-record reference.",
    "Inspect the full trace with talonic_get_app_run; export the audit record with talonic_get_run_record.",
  ]
  if (app.output_contract) {
    lines.push(
      `Output contract (JSON Schema): ${JSON.stringify(app.output_contract).slice(0, 800)}`,
    )
  }
  if (fallbackNote) lines.push(`NOTE: ${fallbackNote}`)
  return lines.join("\n")
}

/**
 * Register one MCP tool per enabled app on `server`. Returns the registered
 * tool handles keyed by tool name (used by the stdio refresh loop).
 */
/**
 * Handles of the dynamic tools registered on each server instance, so the
 * stdio refresh loop can diff/remove them later. WeakMap: servers are
 * per-request on hosted HTTP and must stay collectable.
 */
export const dynamicToolHandles = new WeakMap<McpServer, Map<string, RegisteredTool>>()

export function registerDynamicAppTools(
  server: McpServer,
  catalog: AppsCatalog,
  getToken: () => string,
  baseUrl?: string,
): Map<string, RegisteredTool> {
  const handles = new Map<string, RegisteredTool>()
  dynamicToolHandles.set(server, handles)
  const taken = new Set<string>()
  for (const app of catalog.apps) {
    const name = toolNameForSlug(app.slug, taken)
    const conversion = jsonSchemaToZodShape(app.input_schema)
    const handle = server.registerTool(
      name,
      {
        title: app.display_name ?? app.slug,
        description: toolDescription(
          app,
          conversion.fellBack
            ? `input is accepted as a free-form object (${conversion.fallbackReason})`
            : undefined,
        ),
        inputSchema: conversion.shape,
        annotations: {
          title: app.display_name ?? app.slug,
          readOnlyHint: false,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async (args: Record<string, unknown>) =>
        handleRunApp(getToken, baseUrl, {
          app_id: app.id,
          input: conversion.fellBack ? ((args["input"] as Record<string, unknown>) ?? {}) : args,
        }),
    )
    handles.set(name, handle)
  }
  return handles
}

/**
 * stdio only: keep the per-app tool list live. Fetches the catalog every
 * `intervalMs` (0 disables), diffs against what is registered, applies
 * register/remove, and lets the SDK emit `notifications/tools/list_changed`.
 * Returns a stop function.
 */
export function armStdioAppToolRefresh(
  server: McpServer,
  getToken: () => string,
  baseUrl: string | undefined,
  intervalMs: number,
  initialHandles: Map<string, RegisteredTool>,
): () => void {
  if (!intervalMs || intervalMs <= 0) return () => undefined
  let handles = initialHandles
  let lastEtag: string | null | undefined
  const timer = setInterval(() => {
    void (async () => {
      // Bypass the shared TTL cache: a live session refresh IS the poll.
      clearAppsCatalogCache()
      const catalog = await fetchAppsCatalog(getToken(), baseUrl)
      if (!catalog) return
      if (lastEtag !== undefined && catalog.etag !== null && catalog.etag === lastEtag) return
      lastEtag = catalog.etag
      for (const handle of handles.values()) handle.remove()
      handles = registerDynamicAppTools(server, catalog, getToken, baseUrl)
      // registerTool/remove already schedule list_changed notifications on a
      // connected transport; nothing else to emit here.
    })()
  }, intervalMs)
  timer.unref?.()
  return () => clearInterval(timer)
}
