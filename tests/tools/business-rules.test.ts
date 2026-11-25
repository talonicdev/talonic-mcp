import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleGet,
  handleList,
  handleOutcomes,
  probeBusinessRulesAccess,
} from "../../src/tools/business-rules"
import { createServer } from "../../src/server-factory"
import { businessRulesAccessCached } from "../../src/http-server"

const RULE = "88de1aa5-2d87-423b-a759-b6b089933537"
const token = () => "tlnc_key"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

function stub(body: unknown = {}, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body, status))
  vi.stubGlobal("fetch", fetchMock)
  return () => {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    return { url, method: init.method, auth: new Headers(init.headers).get("authorization") }
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("business rules tool handlers", () => {
  it("list forwards query, status and paging as query params", async () => {
    const call = stub({ items: [], total: 0 })
    await handleList(token, "https://api.example.test", { query: "address", status: "active", limit: 20, offset: 40 })
    expect(call()).toMatchObject({
      url: "https://api.example.test/v1/business-rules?q=address&status=active&limit=20&offset=40",
      method: "GET",
      auth: "Bearer tlnc_key",
    })
  })

  it("list without filters is a plain read", async () => {
    const call = stub({ items: [], total: 0 })
    await handleList(token, undefined, {})
    expect(call().url).toBe("https://api.talonic.com/v1/business-rules")
  })

  it("get and outcomes address one rule by id", async () => {
    let call = stub({ id: RULE })
    await handleGet(token, undefined, { id: RULE })
    expect(call().url).toBe(`https://api.talonic.com/v1/business-rules/${RULE}`)
    vi.unstubAllGlobals()
    call = stub({ items: [], total: 0 })
    await handleOutcomes(token, undefined, { id: RULE, status: "failed", limit: 50 })
    expect(call().url).toBe(`https://api.talonic.com/v1/business-rules/${RULE}/outcomes?status=failed&limit=50`)
  })

  it("an API error comes back as a tool error", async () => {
    stub({ message: "Business rule not found" }, 404)
    const res = await handleGet(token, undefined, { id: RULE })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("Business rule not found")
  })
})

describe("business rules tool registration", () => {
  const names = (opts: Record<string, unknown>) =>
    Object.keys((createServer({ apiKey: "tlnc_test", ...opts }) as any)._registeredTools).filter((n) =>
      n.startsWith("talonic_business_rules_"),
    )

  it("lists the three tools only when the probe passed", () => {
    expect(names({})).toEqual([])
    expect(names({ includeBusinessRulesTools: true }).sort()).toEqual([
      "talonic_business_rules_get",
      "talonic_business_rules_list",
      "talonic_business_rules_outcomes",
    ])
  })

  it("marks every tool read-only", () => {
    const tools = (createServer({ apiKey: "tlnc_test", includeBusinessRulesTools: true }) as any)._registeredTools
    for (const n of ["talonic_business_rules_list", "talonic_business_rules_get", "talonic_business_rules_outcomes"]) {
      expect(tools[n].annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    }
  })

  it("the probe is true on 200 and false on 404 or a network error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [], total: 0 }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await probeBusinessRulesAccess("t")).toBe(true)
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://api.talonic.com/v1/business-rules?limit=1")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 404)))
    expect(await probeBusinessRulesAccess("t")).toBe(false)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")))
    expect(await probeBusinessRulesAccess("t")).toBe(false)
  })

  it("caches the probe per token", async () => {
    const probe = vi.fn().mockResolvedValue(true)
    const now = () => 1_000
    expect(await businessRulesAccessCached("tok-br", probe, now)).toBe(true)
    expect(await businessRulesAccessCached("tok-br", probe, now)).toBe(true)
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
