import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleGrowthFunnel,
  handleGrowthFunnels,
  handleGrowthToolsUsage,
  handleGrowthTraffic,
  probeGrowthAccess,
} from "../../src/tools/growth"
import { createServer } from "../../src/server-factory"
import { growthAccessCached } from "../../src/http-server"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("growth tool handlers", () => {
  it("talonic_growth_funnel GETs /v1/growth/funnel with range and bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ configured: true, rangeDays: 7 }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await handleGrowthFunnel(() => "oauth-token", undefined, { range: "7d" })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.talonic.com/v1/growth/funnel?range=7d")
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer oauth-token")
    expect(JSON.parse(result.content[0]?.text ?? "")).toEqual({ configured: true, rangeDays: 7 })
    expect(result.isError).toBeUndefined()
  })

  it("omitted range sends no query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ rangeDays: 30 }))
    vi.stubGlobal("fetch", fetchMock)

    await handleGrowthFunnels(() => "t", undefined, {})
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      "https://api.talonic.com/v1/growth/funnels",
    )
  })

  it("honors a custom baseUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal("fetch", fetchMock)

    await handleGrowthTraffic(() => "t", "https://staging-api.talonic.com", { range: "90d" })
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      "https://staging-api.talonic.com/v1/growth/traffic?range=90d",
    )
  })

  it("maps tools-usage args to query params, dropping empties and renaming funnel_stage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal("fetch", fetchMock)

    await handleGrowthToolsUsage(() => "t", undefined, {
      range: "7d",
      tool: "pdf-to-csv",
      country: "DE",
      funnel_stage: "succeeded",
      category: undefined,
      source: "",
    })
    const url = new URL((fetchMock.mock.calls[0] as [string])[0])
    expect(url.pathname).toBe("/v1/growth/tools-usage")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      range: "7d",
      tool: "pdf-to-csv",
      country: "DE",
      funnelStage: "succeeded",
    })
  })

  it("shapes a 403 as the superadmin-required error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "forbidden" }, 403))
    vi.stubGlobal("fetch", fetchMock)

    const result = await handleGrowthFunnel(() => "customer-token", undefined, {})
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain("superadmin")
  })

  it("surfaces other HTTP failures with status and body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "boom" }, 500))
    vi.stubGlobal("fetch", fetchMock)

    const result = await handleGrowthTraffic(() => "t", undefined, {})
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain("HTTP 500")
  })

  it("never throws on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")))

    const result = await handleGrowthFunnels(() => "t", undefined, {})
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain("ECONNREFUSED")
  })
})

describe("probeGrowthAccess", () => {
  it("is true on 200 and false on 403", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ error: "forbidden" }, 403))
    vi.stubGlobal("fetch", fetchMock)

    await expect(probeGrowthAccess("admin-token")).resolves.toBe(true)
    await expect(probeGrowthAccess("customer-token")).resolves.toBe(false)
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      "https://api.talonic.com/v1/growth/access",
    )
  })

  it("resolves false on a network error instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")))
    await expect(probeGrowthAccess("t")).resolves.toBe(false)
  })
})

describe("growthAccessCached", () => {
  it("probes once per token within the TTL, caching negatives too", async () => {
    const probe = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await expect(growthAccessCached("cache-admin", probe)).resolves.toBe(true)
    await expect(growthAccessCached("cache-admin", probe)).resolves.toBe(true)
    await expect(growthAccessCached("cache-customer", probe)).resolves.toBe(false)
    await expect(growthAccessCached("cache-customer", probe)).resolves.toBe(false)
    expect(probe).toHaveBeenCalledTimes(2)
  })

  it("re-probes after the TTL expires", async () => {
    const probe = vi.fn().mockResolvedValue(true)
    let t = 1_000_000
    const now = () => t

    await growthAccessCached("cache-expiry", probe, now)
    t += 5 * 60 * 1000 + 1
    await growthAccessCached("cache-expiry", probe, now)
    expect(probe).toHaveBeenCalledTimes(2)
  })
})

describe("conditional registration", () => {
  const GROWTH_TOOLS = [
    "talonic_growth_funnel",
    "talonic_growth_funnels",
    "talonic_growth_traffic",
    "talonic_growth_tools_usage",
  ]

  it("registers the growth tools only when includeGrowthTools is set", () => {
    const withGrowth = createServer({ apiKey: "tlnc_test", includeGrowthTools: true })
    const without = createServer({ apiKey: "tlnc_test" })
    const names = (s: unknown) => Object.keys((s as { _registeredTools: object })._registeredTools)

    for (const tool of GROWTH_TOOLS) {
      expect(names(withGrowth)).toContain(tool)
      expect(names(without)).not.toContain(tool)
    }
    // The baseline surface is untouched either way.
    expect(names(without)).toContain("talonic_extract")
    expect(names(withGrowth)).toContain("talonic_extract")
  })
})
