import { afterEach, describe, expect, it, vi } from "vitest"
import { handleAggregate, probeAggregateAccess } from "../../src/tools/aggregate"
import { createServer } from "../../src/server-factory"
import { aggregateAccessCached } from "../../src/http-server"

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
      method: init.method,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: new Headers(init.headers).get("authorization"),
    }
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("talonic_aggregate handler", () => {
  it("posts window, scope and queries to /v1/aggregate with the bearer", async () => {
    const call = stub({ window: {}, results: { ingested: { value: 4102 } } })
    const queries = [
      {
        id: "ingested",
        dataset: "documents",
        measure: "count",
        where: [{ field: "duplicate", op: "eq", value: false }],
        group_by: ["document_type"],
      },
      { id: "cost", dataset: "document_cost", measure: ["avg", "median"], of: "cost_usd" },
    ]
    const res = await handleAggregate(token, "https://api-nikolas.up.railway.app", {
      from: "2026-11-05T12:00:00Z",
      to: "2026-11-06T00:00:00+01:00",
      scope: { tags: { any: ["pilot"] } },
      queries,
    })
    expect(call()).toEqual({
      url: "https://api-nikolas.up.railway.app/v1/aggregate",
      method: "POST",
      auth: "Bearer tlnc_key",
      body: {
        from: "2026-11-05T12:00:00Z",
        to: "2026-11-06T00:00:00+01:00",
        scope: { tags: { any: ["pilot"] } },
        queries,
      },
    })
    expect(res.isError).toBeFalsy()
    expect(JSON.stringify(res.content)).toContain("4102")
  })

  it("omits scope when none is given (the platform refuses unknown or empty keys)", async () => {
    const call = stub({ results: {} })
    await handleAggregate(token, undefined, {
      from: "2026-11-05T12:00:00Z",
      to: "2026-11-06T00:00:00Z",
      queries: [{ id: "q", dataset: "documents", measure: "count" }],
    })
    expect(Object.keys(call().body)).toEqual(["from", "to", "queries"])
  })

  it("returns the platform's refusal as a tool error", async () => {
    stub(
      {
        code: "invalid_aggregate",
        message: "query 'q': unknown dataset 'docs'",
        details: { allowed_datasets: ["documents"] },
      },
      400,
    )
    const res = await handleAggregate(token, undefined, {
      from: "2026-11-05T12:00:00Z",
      to: "2026-11-06T00:00:00Z",
      queries: [{ id: "q", dataset: "docs", measure: "count" }],
    })
    expect(res.isError).toBe(true)
    const text = JSON.stringify(res.content)
    expect(text).toContain("invalid_aggregate")
    expect(text).toContain("allowed_datasets")
  })
})

describe("talonic_aggregate registration and probe", () => {
  it("registers only when the probe passed, read-only", () => {
    const off = createServer({ apiKey: "tlnc_test" }) as any
    const on = createServer({ apiKey: "tlnc_test", includeAggregateTool: true }) as any
    expect(off._registeredTools.talonic_aggregate).toBeUndefined()
    const tool = on._registeredTools.talonic_aggregate
    expect(tool).toBeDefined()
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    for (const s of ["USE WHEN", "NOT FOR", "ARGS", "RETURNS", "31 days", "offset"])
      expect(tool.description).toContain(s)
    for (const code of ["invalid_aggregate", "cost_not_visible", "aggregate_timeout"])
      expect(tool.description).toContain(code)
  })

  it("probe posts a one-hour document count and is true only on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: { q: { value: 0 } } }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await probeAggregateAccess("t", "https://api-nikolas.up.railway.app")).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api-nikolas.up.railway.app/v1/aggregate")
    expect(init.method).toBe("POST")
    const body = JSON.parse(String(init.body))
    expect(body.queries).toEqual([{ id: "q", dataset: "documents", measure: "count" }])
    expect(Date.parse(body.to) - Date.parse(body.from)).toBe(3_600_000)
    expect(body.from).toMatch(/Z$/)

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 404)))
    expect(await probeAggregateAccess("t")).toBe(false)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 403)))
    expect(await probeAggregateAccess("t")).toBe(false)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")))
    expect(await probeAggregateAccess("t")).toBe(false)
  })

  it("caches the probe per token", async () => {
    const probe = vi.fn().mockResolvedValue(true)
    const now = () => 1_000
    expect(await aggregateAccessCached("tok-agg", probe, now)).toBe(true)
    expect(await aggregateAccessCached("tok-agg", probe, now)).toBe(true)
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
