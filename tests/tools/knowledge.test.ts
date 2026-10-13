import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleKnowledgeAdd,
  handleKnowledgeCustomers,
  handleKnowledgeGet,
  handleKnowledgeRecall,
  handleKnowledgeSearch,
  handleKnowledgeUpdate,
  probeKnowledgeAccess,
} from "../../src/tools/knowledge"
import { createServer } from "../../src/server-factory"
import { knowledgeAccessCached } from "../../src/http-server"

const token = () => "tlnc_key"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function stub(body: unknown = {}, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body, status))
  vi.stubGlobal("fetch", fetchMock)
  return () => {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    return {
      url,
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: new Headers(init.headers).get("authorization"),
      accept: new Headers(init.headers).get("accept"),
    }
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("knowledge tool handlers", () => {
  it("customers lists the registry's customers", async () => {
    const call = stub({ items: [] })
    await handleKnowledgeCustomers(token, undefined)
    expect(call()).toMatchObject({
      url: "https://api.talonic.com/v1/knowledge/customers",
      method: "GET",
      auth: "Bearer tlnc_key",
    })
  })

  it("recall reads the markdown digest whole, with repeated tag params and status=all on request", async () => {
    const digest = '<knowledge-registry tenant="bw" entries="2">\n## data (2)\n</knowledge-registry>\n'
    const fetchMock = vi.fn().mockResolvedValue(new Response(digest, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const res = await handleKnowledgeRecall(token, "https://api.example.test", {
      tenant: "bw",
      kind: "data",
      tags: ["reference-db", "gotcha"],
      include_inactive: true,
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      "https://api.example.test/v1/knowledge/digest?tenant=bw&kind=data&tag=reference-db&tag=gotcha&status=all",
    )
    expect(new Headers(init.headers).get("accept")).toBe("text/markdown")
    expect(res.content[0]!.text).toBe(digest)
    expect(res.isError).toBeUndefined()
  })

  it("recall surfaces a refusal as a tool error carrying the API text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("No knowledge customer matches 'x'", { status: 404 })))
    const res = await handleKnowledgeRecall(token, undefined, { tenant: "x" })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("HTTP 404")
    expect(res.content[0]!.text).toContain("No knowledge customer matches")
  })

  it("search forwards every filter, repeating tag, and booleans as 'true'", async () => {
    const call = stub({ items: [], total: 0, limit: 50, offset: 0 })
    await handleKnowledgeSearch(token, undefined, {
      tenant: "bw",
      q: "ord number",
      kind: "data",
      tags: ["reference-db", "ids"],
      status: "all",
      due: true,
      unverified: false,
      since: "2026-10-01",
      limit: 20,
      offset: 40,
    })
    expect(call()).toMatchObject({
      method: "GET",
      url: "https://api.talonic.com/v1/knowledge/entries?tenant=bw&q=ord+number&kind=data&status=all&due=true&since=2026-10-01&limit=20&offset=40&tag=reference-db&tag=ids",
    })
  })

  it("search without filters hits the bare list", async () => {
    const call = stub({ items: [], total: 0, limit: 50, offset: 0 })
    await handleKnowledgeSearch(token, undefined, {})
    expect(call().url).toBe("https://api.talonic.com/v1/knowledge/entries")
  })

  it("get reads one entry with its history", async () => {
    const call = stub({ id: "bw-17", history: [] })
    await handleKnowledgeGet(token, undefined, { id: "bw-17" })
    expect(call()).toMatchObject({
      method: "GET",
      url: "https://api.talonic.com/v1/knowledge/entries/bw-17?include=history",
    })
  })

  it("add posts the entry whole and stamps via=mcp", async () => {
    const call = stub({ id: "bw-41", current_revision: 1 }, 201)
    const body = "x".repeat(50_000)
    await handleKnowledgeAdd(token, undefined, {
      tenant: "Bridgeway",
      kind: "data",
      title: "Reference DB key",
      body,
      tags: ["reference-db"],
      unverified: true,
      revisit_at: "2026-12-01",
      deployment: "bridgeway-aws",
      branch: "bridgeway",
      note: "from the catalog check",
    })
    const c = call()
    expect(c).toMatchObject({ method: "POST", url: "https://api.talonic.com/v1/knowledge/entries" })
    expect(c.body).toEqual({
      tenant: "Bridgeway",
      kind: "data",
      title: "Reference DB key",
      body,
      tags: ["reference-db"],
      unverified: true,
      revisit_at: "2026-12-01",
      deployment: "bridgeway-aws",
      branch: "bridgeway",
      note: "from the catalog check",
      via: "mcp",
    })
  })

  it("update puts the read revision and reason, null clears revisit_at, via=mcp", async () => {
    const call = stub({ id: "bw-17", current_revision: 3 })
    await handleKnowledgeUpdate(token, undefined, {
      id: "bw-17",
      revision: 2,
      reason: "retired",
      note: "dashboard fact",
      revisit_at: null,
    })
    const c = call()
    expect(c).toMatchObject({ method: "PUT", url: "https://api.talonic.com/v1/knowledge/entries/bw-17" })
    expect(c.body).toEqual({ revision: 2, reason: "retired", note: "dashboard fact", revisit_at: null, via: "mcp" })
  })

  it("update returns the 409 body (the current entry) as the tool error", async () => {
    const current = { message: "Entry bw-17 is at revision 3", details: { current: { id: "bw-17", current_revision: 3 } } }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(current, 409)))
    const res = await handleKnowledgeUpdate(token, undefined, { id: "bw-17", revision: 2, reason: "refreshed" })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("HTTP 409")
    expect(res.content[0]!.text).toContain('"current_revision":3')
  })
})

describe("knowledge tool registration", () => {
  it("registers the six tools only when includeKnowledgeTools is set", () => {
    const off = Object.keys((createServer({ apiKey: "tlnc_test" }) as any)._registeredTools).filter((n) =>
      n.startsWith("talonic_knowledge_"),
    )
    const on = Object.keys(
      (createServer({ apiKey: "tlnc_test", includeKnowledgeTools: true }) as any)._registeredTools,
    ).filter((n) => n.startsWith("talonic_knowledge_"))
    expect(off).toEqual([])
    expect(on.sort()).toEqual([
      "talonic_knowledge_add",
      "talonic_knowledge_customers",
      "talonic_knowledge_get",
      "talonic_knowledge_recall",
      "talonic_knowledge_search",
      "talonic_knowledge_update",
    ])
  })

  it("marks the reads read-only and the writes neither read-only nor destructive", () => {
    const tools = (createServer({ apiKey: "tlnc_test", includeKnowledgeTools: true }) as any)._registeredTools
    for (const n of ["customers", "recall", "search", "get"]) {
      expect(tools[`talonic_knowledge_${n}`].annotations.readOnlyHint).toBe(true)
    }
    for (const n of ["add", "update"]) {
      expect(tools[`talonic_knowledge_${n}`].annotations.readOnlyHint).toBe(false)
      expect(tools[`talonic_knowledge_${n}`].annotations.destructiveHint).toBe(false)
    }
    expect(tools.talonic_knowledge_recall.annotations.title).toBe("Recall what Talonic knows about a customer")
  })

  it("the add body is unbounded: no max on the body schema (the server's 5 MB limit is the one cut)", () => {
    const tools = (createServer({ apiKey: "tlnc_test", includeKnowledgeTools: true }) as any)._registeredTools
    const big = "x".repeat(1_000_000)
    expect(tools.talonic_knowledge_add.inputSchema.shape.body.safeParse(big).success).toBe(true)
    expect(tools.talonic_knowledge_update.inputSchema.shape.body.safeParse(big).success).toBe(true)
  })

  it("probe is true on 200 of /v1/knowledge/access, false on any other status or a network failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await probeKnowledgeAccess("t")).toBe(true)
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://api.talonic.com/v1/knowledge/access")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 403)))
    expect(await probeKnowledgeAccess("t")).toBe(false)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")))
    expect(await probeKnowledgeAccess("t")).toBe(false)
  })

  it("caches the probe per token", async () => {
    const probe = vi.fn().mockResolvedValue(true)
    const now = () => 1_000
    expect(await knowledgeAccessCached("tok-kb", probe, now)).toBe(true)
    expect(await knowledgeAccessCached("tok-kb", probe, now)).toBe(true)
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
