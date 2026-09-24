import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createServer } from "../../src/server-factory"
import {
  handleCompare,
  handleDocuments,
  handleIndices,
  handleManual,
  handleModels,
  handlePrices,
  handleRefresh,
  handleUpdate,
  handleWorkbook,
  probePriceBaselineAccess,
} from "../../src/tools/price-baseline"

type Call = { url: string; init: RequestInit }

const TOOLS = [
  "talonic_price_baseline_documents",
  "talonic_price_baseline_extract",
  "talonic_price_baseline_models",
  "talonic_price_baseline_update_model",
  "talonic_price_baseline_prices",
  "talonic_price_baseline_workbook",
  "talonic_price_baseline_compare",
  "talonic_price_baseline_indices",
  "talonic_price_baseline_refresh_indices",
  "talonic_price_baseline_add_index_values",
]

const MODEL = "0b7c1c2e-5d1f-4b8a-9c3e-2f6a7d8e9f01"
const INVOICE = "7a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b"
const getToken = () => "tlnc_test"
const parsed = (r: { content: Array<{ text?: string }> }) => JSON.parse(r.content[0]?.text ?? "")

function stubFetch(respond: (url: string) => Response = () => Response.json({ ok: true })) {
  const calls: Call[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return respond(url)
    }),
  )
  return calls
}

describe("price baseline tools", () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it("register only when the probe passed", () => {
    const off = createServer({ apiKey: "tlnc_test" }) as any
    const on = createServer({ apiKey: "tlnc_test", includePriceBaselineTools: true }) as any
    for (const name of TOOLS) {
      expect(off._registeredTools[name]).toBeUndefined()
      expect(on._registeredTools[name]).toBeDefined()
    }
  })

  it.each(TOOLS)("%s has a tight description with a NOT FOR redirect", (name) => {
    const server = createServer({ apiKey: "tlnc_test", includePriceBaselineTools: true }) as any
    const d: string = server._registeredTools[name].description
    expect(d).toContain("NOT FOR")
    expect(d.length).toBeLessThanOrEqual(1500)
  })

  it("probe is true on 200 and false on 404 or network failure", async () => {
    const calls = stubFetch(() => Response.json({ data: [] }))
    expect(await probePriceBaselineAccess("tlnc_x", "https://api-nikolas.up.railway.app")).toBe(
      true,
    )
    expect(calls[0]?.url).toBe("https://api-nikolas.up.railway.app/v1/price-baseline/indices")
    stubFetch(() => new Response("", { status: 404 }))
    expect(await probePriceBaselineAccess("tlnc_x")).toBe(false)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    )
    expect(await probePriceBaselineAccess("tlnc_x")).toBe(false)
  })

  it("documents forwards the query as `q` with the bearer", async () => {
    const calls = stubFetch()
    await handleDocuments(getToken, undefined, { query: "Wärme" })
    expect(calls[0]?.url).toBe("https://api.talonic.com/v1/price-baseline/documents?q=W%C3%A4rme")
    expect((calls[0]?.init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer tlnc_test",
    )
  })

  it("models lists without an id and reads one with it", async () => {
    const calls = stubFetch()
    await handleModels(getToken, undefined, {})
    await handleModels(getToken, undefined, { model_id: MODEL })
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.talonic.com/v1/price-baseline/models",
      `https://api.talonic.com/v1/price-baseline/models/${MODEL}`,
    ])
  })

  it("update PUTs the model and status", async () => {
    const calls = stubFetch()
    await handleUpdate(getToken, undefined, {
      model_id: MODEL,
      model: { components: [] },
      status: "confirmed",
    })
    expect(calls[0]?.init.method).toBe("PUT")
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      model: { components: [] },
      status: "confirmed",
    })
  })

  it("prices passes the month window", async () => {
    const calls = stubFetch()
    await handlePrices(getToken, undefined, { model_id: MODEL, from: "2023-01", to: "2023-12" })
    expect(calls[0]?.url).toBe(
      `https://api.talonic.com/v1/price-baseline/models/${MODEL}/prices?from=2023-01&to=2023-12`,
    )
  })

  it("workbook returns the xlsx as an embedded resource with the server's filename", async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const calls = stubFetch(
      () =>
        new Response(bytes, {
          headers: { "content-disposition": 'attachment; filename="Preisbasis_WLV.xlsx"' },
        }),
    )
    const res = (await handleWorkbook(getToken, undefined, {
      model_id: MODEL,
      from: "2023-01",
      to: "2023-12",
      comparison_id: INVOICE,
    })) as any
    expect(calls[0]?.url).toContain(`comparison_id=${INVOICE}`)
    expect(JSON.parse(res.content[0].text)).toEqual({ filename: "Preisbasis_WLV.xlsx", bytes: 4 })
    expect(res.content[1].resource.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    expect(Buffer.from(res.content[1].resource.blob, "base64")).toEqual(Buffer.from(bytes))
  })

  it("workbook surfaces the API error instead of an empty file", async () => {
    stubFetch(() => new Response('{"message":"Price model x not found"}', { status: 404 }))
    const res = (await handleWorkbook(getToken, undefined, {
      model_id: MODEL,
      from: "2023-01",
      to: "2023-12",
    })) as any
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain("404")
  })

  it("compare runs a check, lists past checks, and rejects neither", async () => {
    const calls = stubFetch()
    await handleCompare(getToken, undefined, { model_id: MODEL, invoice_document_id: INVOICE })
    await handleCompare(getToken, undefined, { model_id: MODEL, list: true })
    const bad = (await handleCompare(getToken, undefined, { model_id: MODEL })) as any
    expect(calls[0]?.init.method).toBe("POST")
    expect(calls[0]?.url).toBe(`https://api.talonic.com/v1/price-baseline/models/${MODEL}/compare`)
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ invoice_document_id: INVOICE })
    expect(calls[1]?.url).toBe(
      `https://api.talonic.com/v1/price-baseline/models/${MODEL}/comparisons`,
    )
    expect(bad.isError).toBe(true)
    expect(calls).toHaveLength(2)
  })

  it("indices reads the catalog, or values joined by comma", async () => {
    const calls = stubFetch()
    await handleIndices(getToken, undefined, {})
    await handleIndices(getToken, undefined, { series: ["destatis.vpi", "behg.co2"] })
    expect(calls[0]?.url).toBe("https://api.talonic.com/v1/price-baseline/indices")
    expect(calls[1]?.url).toBe(
      "https://api.talonic.com/v1/price-baseline/indices/values?series=destatis.vpi%2Cbehg.co2",
    )
  })

  it("refresh rejects an inverted year range before calling the API", async () => {
    const calls = stubFetch()
    const res = (await handleRefresh(getToken, undefined, {
      series: ["behg.co2"],
      from_year: 2025,
      to_year: 2023,
    })) as any
    expect(res.isError).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it("manual values need a URL or document before they reach the API", async () => {
    const calls = stubFetch(() => Response.json({ stored: 1 }))
    const bad = (await handleManual(getToken, undefined, {
      values: [{ series: "eex.gas", period: "2023-Q1", value: 1, quote: "q" }],
    })) as any
    expect(bad.isError).toBe(true)
    expect(bad.content[0].text).toContain("values[0]")
    const ok = await handleManual(getToken, undefined, {
      values: [
        {
          series: "eex.gas",
          period: "2023-Q1",
          value: 1,
          quote: "q",
          source_url: "https://example.org",
        },
      ],
    })
    expect(parsed(ok as any)).toEqual({ stored: 1 })
    expect(calls).toHaveLength(1)
  })
})
