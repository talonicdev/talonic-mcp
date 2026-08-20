import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
  clearAppsCatalogCache,
  fetchAppsCatalog,
  registerDynamicAppTools,
  toolNameForSlug,
  type AppsCatalog,
} from "../../src/tools/app-tools"
import { createServer } from "../../src/server-factory"

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(status === 304 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

const CATALOG: AppsCatalog = {
  etag: 'W/"hash-1"',
  apps: [
    {
      id: "app-1",
      slug: "load-auto-billing",
      display_name: "Load auto-billing",
      description: "Approve or hold delivery loads for billing.",
      enabled: true,
      version: 4,
      input_schema: {
        type: "object",
        properties: { load_id: { type: "string" } },
        required: ["load_id"],
      },
      output_contract: { type: "object", properties: { decision: { enum: ["approve", "hold"] } } },
    },
    { id: "app-2", slug: "contract-review", enabled: true },
  ],
}

beforeEach(() => clearAppsCatalogCache())
afterEach(() => vi.unstubAllGlobals())

describe("toolNameForSlug", () => {
  it("maps hyphens to underscores with the app_ prefix", () => {
    expect(toolNameForSlug("load-auto-billing")).toBe("app_load_auto_billing")
  })
  it("sanitizes anything outside the MCP name charset", () => {
    expect(toolNameForSlug("weird.slug!x")).toBe("app_weird_slug_x")
  })
  it("suffixes post-mapping collisions deterministically", () => {
    const taken = new Set<string>()
    expect(toolNameForSlug("a-b", taken)).toBe("app_a_b")
    expect(toolNameForSlug("a_b", taken)).toBe("app_a_b_2")
  })
})

describe("fetchAppsCatalog", () => {
  it("fetches enabled apps, keeps the etag, and caches per token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: CATALOG.apps }, 200, { etag: 'W/"hash-1"' }))
    vi.stubGlobal("fetch", fetchMock)
    const first = await fetchAppsCatalog("tok-a", undefined)
    const second = await fetchAppsCatalog("tok-a", undefined)
    expect(first?.apps).toHaveLength(2)
    expect(first?.etag).toBe('W/"hash-1"')
    expect(second).toBe(first) // TTL cache hit, no second fetch
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = new URL(fetchMock.mock.calls[0]![0] as string)
    expect(url.pathname).toBe("/v1/apps")
    expect(url.searchParams.get("enabled")).toBe("true")
  })

  it("revalidates with If-None-Match after expiry and rides a 304", async () => {
    let t = 0
    const now = () => t
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: CATALOG.apps }, 200, { etag: 'W/"hash-1"' }))
      .mockResolvedValueOnce(jsonResponse(null, 304))
    vi.stubGlobal("fetch", fetchMock)
    const first = await fetchAppsCatalog("tok-b", undefined, now)
    t = 6 * 60 * 1000 // past TTL
    const second = await fetchAppsCatalog("tok-b", undefined, now)
    expect(second).toBe(first)
    const revalidateHeaders = new Headers((fetchMock.mock.calls[1]![1] as RequestInit).headers)
    expect(revalidateHeaders.get("if-none-match")).toBe('W/"hash-1"')
  })

  it("filters disabled apps and returns null on hard failure with no cache", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "x", slug: "off-app", enabled: false }] }))
      .mockRejectedValueOnce(new Error("boom"))
    vi.stubGlobal("fetch", fetchMock)
    const catalog = await fetchAppsCatalog("tok-c", undefined)
    expect(catalog?.apps).toHaveLength(0)
    clearAppsCatalogCache()
    const failed = await fetchAppsCatalog("tok-d", undefined)
    expect(failed).toBeNull()
  })
})

describe("registerDynamicAppTools", () => {
  function toolNames(server: McpServer): string[] {
    return Object.keys((server as any)._registeredTools)
  }

  it("registers one app_<slug> tool per enabled app", () => {
    const server = new McpServer({ name: "t", version: "0" })
    registerDynamicAppTools(server, CATALOG, () => "tok")
    const names = toolNames(server)
    expect(names).toContain("app_load_auto_billing")
    expect(names).toContain("app_contract_review")
    expect(names).toHaveLength(2)
  })

  it("notes the permissive fallback in the description when the app has no input schema", () => {
    const server = new McpServer({ name: "t", version: "0" })
    registerDynamicAppTools(server, CATALOG, () => "tok")
    const tools = (server as any)._registeredTools
    expect(tools["app_contract_review"].description).toContain("free-form")
    expect(tools["app_load_auto_billing"].description).not.toContain("free-form")
  })

  it("createServer registers dynamic tools when given a catalog, alongside the static toolset", () => {
    const server = createServer({ apiKey: "tlnc_test", appsCatalog: CATALOG }) as any
    expect(server._registeredTools["app_load_auto_billing"]).toBeDefined()
    expect(server._registeredTools["talonic_list_apps"]).toBeDefined()
    expect(server._registeredTools["talonic_run_app"]).toBeDefined()
  })

  it("the dynamic tool handler runs the app with schema-shaped args", async () => {
    const server = new McpServer({ name: "t", version: "0" })
    registerDynamicAppTools(server, CATALOG, () => "tok")
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "run-1" }))
    vi.stubGlobal("fetch", fetchMock)
    const tool = (server as any)._registeredTools["app_load_auto_billing"]
    await tool.handler({ load_id: "L-9" })
    const [rawUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new URL(rawUrl).pathname).toBe("/v1/apps/app-1/runs")
    expect(JSON.parse(init.body as string)).toEqual({ input: { load_id: "L-9" } })
  })
})
