import { describe, it, expect, vi } from "vitest"
import { makeTaggedFetch } from "../src/server-factory.js"
import { VERSION } from "../src/version.js"
import { apiJson, resolveFetch, withFetch } from "../src/tools/_http.js"
import { handleListAgentTasks } from "../src/tools/agent-tasks.js"
import { createServer } from "../src/server-factory.js"

describe("makeTaggedFetch", () => {
  it("appends the known client name to the UA", async () => {
    const base = vi.fn(async () => new Response("{}"))
    const tagged = makeTaggedFetch(() => "Cursor", base as unknown as typeof fetch)
    await tagged("https://api.talonic.com/v1/extract", {})
    const ua = new Headers((base.mock.calls[0][1] as RequestInit).headers).get("user-agent")
    expect(ua).toBe(`talonic-mcp/${VERSION} Cursor`)
  })

  it("sends talonic-mcp/<v> with no suffix when the client is unknown, and never throws", async () => {
    const base = vi.fn(async () => new Response("{}"))
    const tagged = makeTaggedFetch(() => undefined, base as unknown as typeof fetch)
    await expect(tagged("https://api.talonic.com/v1/extract")).resolves.toBeInstanceOf(Response)
    const ua = new Headers((base.mock.calls[0][1] as RequestInit).headers).get("user-agent")
    expect(ua).toBe(`talonic-mcp/${VERSION}`)
  })
})

describe("raw-fetch tools use the server's tagged fetch", () => {
  it("withFetch attaches a fetch to the token getter and resolveFetch reads it back", async () => {
    const base = vi.fn(
      async () => new Response("{}", { headers: { "content-type": "application/json" } }),
    )
    const tagged = makeTaggedFetch(() => "ChatGPT", base as unknown as typeof fetch)
    const source = withFetch(() => "tlnc_x", tagged)
    expect(source()).toBe("tlnc_x")
    expect(resolveFetch(source)).toBe(tagged)
    expect(resolveFetch(() => "plain")).toBe(fetch)

    await apiJson(source, "https://api.example.test", "GET", "/v1/fields")
    const init = base.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get("user-agent")).toBe(`talonic-mcp/${VERSION} ChatGPT`)
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tlnc_x")
  })

  it("agent-task requests carry the tag too", async () => {
    const base = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [] }), {
          headers: { "content-type": "application/json" },
        }),
    )
    const source = withFetch(
      () => "tlnc_x",
      makeTaggedFetch(() => "Cursor", base as unknown as typeof fetch),
    )
    await handleListAgentTasks(source, "https://api.example.test", {})
    const init = base.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get("user-agent")).toBe(`talonic-mcp/${VERSION} Cursor`)
  })

  it("createServer wires the tagged fetch into the field tools", async () => {
    const base = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [], pagination: {} }), {
          headers: { "content-type": "application/json" },
        }),
    )
    vi.stubGlobal("fetch", base)
    try {
      const server = createServer({
        apiKey: "tlnc_test",
        baseUrl: "https://api.example.test",
      }) as any
      const tool = server._registeredTools["talonic_list_fields"]
      await tool.handler({}, {})
      const init = base.mock.calls[0][1] as RequestInit
      expect(new Headers(init.headers).get("user-agent")).toMatch(
        new RegExp(`^talonic-mcp/${VERSION.replace(/\./g, "\\.")}`),
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
