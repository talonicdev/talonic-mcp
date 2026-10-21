import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createServer } from "../../src/server-factory"
import {
  handleAnswer,
  handleAssume,
  handleAssumptions,
  handleCompare,
  handleContract,
  handleExtract,
  handleImport,
  handleImports,
  handleRegister,
  handleSync,
  handleDocuments,
  handleIndices,
  handleManual,
  handleModels,
  handlePrices,
  handleProofInvoice,
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
  "talonic_price_baseline_proof_invoice",
  "talonic_price_baseline_indices",
  "talonic_price_baseline_refresh_indices",
  "talonic_price_baseline_add_index_values",
  "talonic_price_baseline_register",
  "talonic_price_baseline_contract",
  "talonic_price_baseline_answer",
  "talonic_price_baseline_assumptions",
  "talonic_price_baseline_assume",
  "talonic_price_baseline_sync_series",
  "talonic_price_baseline_imports",
  "talonic_price_baseline_import",
]

const MODEL = "0b7c1c2e-5d1f-4b8a-9c3e-2f6a7d8e9f01"
const INVOICE = "7a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b"
const ASSUMPTION = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f"
const API = "https://api.talonic.com/v1/price-baseline"
const body = (c: Call | undefined) => JSON.parse(String(c?.init.body))
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

  it("proof_invoice returns the restated invoice with a PDF link, or the HTML", async () => {
    const invoice = {
      comparison_id: INVOICE,
      lines: [{ label: "Arbeitspreis", amount: 120.5, billed_amount: 100, delta: 20.5 }],
      totals: { net: 120.5, billed_net: 100, delta: 20.5, tax_rate: 0.19, tax: 22.9, gross: 143.4 },
      checks: [{ key: "lines_priced", label: "Every line priced", passed: true, detail: null }],
      audit_proof: false,
      hash: "abc",
      sources: [],
    }
    const calls = stubFetch(() => Response.json({ invoice, html: "<html>proof</html>" }))
    const json = parsed(
      (await handleProofInvoice(getToken, undefined, { comparison_id: INVOICE })) as any,
    )
    const pdf = `${API}/comparisons/${INVOICE}/proof-invoice.pdf`
    expect(calls[0]?.url).toBe(`${API}/comparisons/${INVOICE}/proof-invoice`)
    expect(calls[0]?.init.method).toBe("GET")
    expect(json).toEqual({ ...invoice, pdf_url: pdf })
    const html = parsed(
      (await handleProofInvoice(getToken, undefined, {
        comparison_id: INVOICE,
        format: "html",
      })) as any,
    )
    expect(html).toEqual({ html: "<html>proof</html>", pdf_url: pdf })
    expect(calls).toHaveLength(2)
  })

  it("proof_invoice surfaces a missing comparison as an error", async () => {
    stubFetch(() => new Response('{"message":"Comparison x not found"}', { status: 404 }))
    const res = (await handleProofInvoice(getToken, undefined, { comparison_id: INVOICE })) as any
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain("404")
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

  it("new tools are read-only exactly where they only read", () => {
    const server = createServer({ apiKey: "tlnc_test", includePriceBaselineTools: true }) as any
    const ro = (n: string) => server._registeredTools[n].annotations.readOnlyHint
    for (const n of ["register", "contract", "assumptions", "imports"])
      expect(ro(`talonic_price_baseline_${n}`)).toBe(true)
    for (const n of ["answer", "assume", "sync_series", "import"])
      expect(ro(`talonic_price_baseline_${n}`)).toBe(false)
  })

  it("descriptions of the input tools state the sourcing and assumption rules", () => {
    const server = createServer({ apiKey: "tlnc_test", includePriceBaselineTools: true }) as any
    for (const n of ["contract", "answer", "assume"]) {
      const d: string = server._registeredTools[`talonic_price_baseline_${n}`].description
      expect(d).toContain("verbatim")
      expect(d).toContain("publisher URL")
      expect(d).toContain("replaced by a real value")
    }
  })

  it("extract builds from a document or enriches a model, never both", async () => {
    const calls = stubFetch()
    await handleExtract(getToken, undefined, { document_id: INVOICE })
    await handleExtract(getToken, undefined, { model_id: MODEL })
    const both = (await handleExtract(getToken, undefined, {
      document_id: INVOICE,
      model_id: MODEL,
    })) as any
    const neither = (await handleExtract(getToken, undefined, {})) as any
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ["POST", `${API}/models`],
      ["POST", `${API}/models/${MODEL}/enrich`],
    ])
    expect(both.isError).toBe(true)
    expect(neither.isError).toBe(true)
  })

  it("update sends contract_key and excluded status, and rejects an empty patch", async () => {
    const calls = stubFetch()
    await handleUpdate(getToken, undefined, {
      model_id: MODEL,
      contract_key: "WLV-2019-0042",
      status: "excluded",
    })
    await handleUpdate(getToken, undefined, { model_id: MODEL, contract_key: null })
    const empty = (await handleUpdate(getToken, undefined, { model_id: MODEL })) as any
    expect(body(calls[0])).toEqual({ contract_key: "WLV-2019-0042", status: "excluded" })
    expect(body(calls[1])).toEqual({ contract_key: null })
    expect(empty.isError).toBe(true)
    expect(calls).toHaveLength(2)
  })

  it("register passes the year and wraps rows as data[]", async () => {
    const calls = stubFetch(() => Response.json([{ id: MODEL, contract_key: "K1" }]))
    const res = await handleRegister(getToken, undefined, { year: 2024 })
    expect(calls[0]?.url).toBe(`${API}/register?year=2024`)
    expect(parsed(res as any)).toEqual({ data: [{ id: MODEL, contract_key: "K1" }] })
    await handleRegister(getToken, undefined, {})
    expect(calls[1]?.url).toBe(`${API}/register`)
  })

  it("contract reads the grid for one period and trims cells unless asked", async () => {
    const book = {
      title: "WLV",
      open: [{ key: "index:behg.co2", kind: "index_value" }],
      expected: { basis: "plan", net: 100 },
      sheets: [{ name: "Calc", widths: [10], rows: [[{ v: 1 }], [{ v: 2 }]] }],
    }
    const calls = stubFetch(() => Response.json(book))
    const lean = parsed(
      (await handleContract(getToken, undefined, { model_id: MODEL, year: 2024 })) as any,
    )
    expect(calls[0]?.url).toBe(`${API}/models/${MODEL}/sheets?year=2024`)
    expect(lean.sheets).toEqual([{ name: "Calc", rows: 2 }])
    expect(lean.open).toEqual(book.open)
    const full = parsed(
      (await handleContract(getToken, undefined, {
        model_id: MODEL,
        from: "2024-01",
        to: "2024-06",
        include_grid: true,
      })) as any,
    )
    expect(calls[1]?.url).toBe(`${API}/models/${MODEL}/sheets?from=2024-01&to=2024-06`)
    expect(full.sheets).toEqual(book.sheets)
  })

  it("contract rejects mixed or half periods before calling the API", async () => {
    const calls = stubFetch()
    for (const bad of [
      { year: 2024, comparison_id: INVOICE },
      { from: "2024-01" },
      { year: 2024, from: "2024-01", to: "2024-02" },
      { from: "2024-06", to: "2024-01" },
    ]) {
      const res = (await handleContract(getToken, undefined, { model_id: MODEL, ...bad })) as any
      expect(res.isError).toBe(true)
    }
    expect(calls).toHaveLength(0)
  })

  it("answer enters a quoted contract value or records a source choice", async () => {
    const calls = stubFetch()
    await handleAnswer(getToken, undefined, {
      model_id: MODEL,
      action: "enter_contract_value",
      variable: "AP0",
      value: 4.25,
      quote: "Der Arbeitspreis beträgt 4,25 ct/kWh",
    })
    await handleAnswer(getToken, undefined, {
      model_id: MODEL,
      action: "choose_source",
      key: "index:the.levy",
      choice: "request",
      note: "Ask the supplier",
    })
    await handleAnswer(getToken, undefined, {
      model_id: MODEL,
      action: "choose_source",
      key: "index:the.levy",
      choice: null,
    })
    expect(calls[0]?.url).toBe(`${API}/models/${MODEL}/values`)
    expect(body(calls[0])).toEqual({
      variable: "AP0",
      value: 4.25,
      quote: "Der Arbeitspreis beträgt 4,25 ct/kWh",
    })
    expect(calls[1]?.url).toBe(`${API}/models/${MODEL}/decide`)
    expect(body(calls[1])).toEqual({
      key: "index:the.levy",
      choice: "request",
      note: "Ask the supplier",
    })
    expect(body(calls[2])).toEqual({ key: "index:the.levy", choice: null, note: null })
  })

  it("answer refuses a value without its quote", async () => {
    const calls = stubFetch()
    const res = (await handleAnswer(getToken, undefined, {
      model_id: MODEL,
      action: "enter_contract_value",
      variable: "AP0",
      value: 4.25,
      quote: "  ",
    })) as any
    const noKey = (await handleAnswer(getToken, undefined, {
      model_id: MODEL,
      action: "choose_source",
      choice: "request",
    })) as any
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain("quote")
    expect(noKey.isError).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it("assumptions lists for the workspace or one contract", async () => {
    const calls = stubFetch()
    await handleAssumptions(getToken, undefined, {})
    await handleAssumptions(getToken, undefined, { contract_key: "K1" })
    expect(calls.map((c) => c.url)).toEqual([
      `${API}/assumptions`,
      `${API}/assumptions?contract_key=K1`,
    ])
  })

  it("assume creates for one contract, replaces workspace-wide, and withdraws", async () => {
    const calls = stubFetch()
    await handleAssume(getToken, undefined, {
      action: "create",
      scope: "contract",
      contract_key: "K1",
      target_kind: "series",
      target: "the.levy",
      rule: "value",
      value: 0.3,
      unit: "ct/kWh",
      period_from: "2025",
      note: "Not published yet",
    })
    await handleAssume(getToken, undefined, {
      action: "replace",
      assumption_id: ASSUMPTION,
      scope: "workspace",
      target_kind: "series",
      target: "*",
      rule: "carry_forward",
      note: "Carry the last value until publication",
    })
    await handleAssume(getToken, undefined, { action: "withdraw", assumption_id: ASSUMPTION })
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ["POST", `${API}/assumptions`],
      ["PUT", `${API}/assumptions/${ASSUMPTION}`],
      ["DELETE", `${API}/assumptions/${ASSUMPTION}`],
    ])
    expect(body(calls[0])).toMatchObject({
      contract_key: "K1",
      target: "the.levy",
      rule: "value",
      value: 0.3,
      period_from: "2025",
      period_to: null,
    })
    expect(body(calls[1])).toMatchObject({ contract_key: null, target: "*", value: null })
  })

  it("assume rejects what the platform would reject, before calling it", async () => {
    const calls = stubFetch()
    const base = {
      action: "create" as const,
      scope: "workspace" as const,
      target_kind: "series" as const,
      target: "the.levy",
      note: "why",
    }
    for (const bad of [
      { ...base, rule: "value" as const },
      { ...base, rule: "value" as const, value: 1, note: undefined },
      { ...base, rule: "proxy" as const },
      { ...base, rule: "carry_forward" as const, target_kind: "variable" as const },
      { ...base, rule: "value" as const, value: 1, target: "*" },
      { ...base, rule: "value" as const, value: 1, scope: "contract" as const },
      { ...base, rule: "value" as const, value: 1, scope: undefined },
      { action: "withdraw" as const },
    ]) {
      const res = (await handleAssume(getToken, undefined, bad)) as any
      expect(res.isError).toBe(true)
    }
    expect(calls).toHaveLength(0)
  })

  it("sync fetches given or due series, and changes a schedule", async () => {
    const calls = stubFetch(() => Response.json([{ series: "behg.co2", stored: 3, error: null }]))
    const res = await handleSync(getToken, undefined, { keys: ["behg.co2"] })
    await handleSync(getToken, undefined, {})
    await handleSync(getToken, undefined, { key: "behg.co2", sync_hours: 24 })
    expect(parsed(res as any)).toEqual({ data: [{ series: "behg.co2", stored: 3, error: null }] })
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ["POST", `${API}/data/series/sync`],
      ["POST", `${API}/data/series/sync`],
      ["PUT", `${API}/data/series`],
    ])
    expect(body(calls[0])).toEqual({ keys: ["behg.co2"] })
    expect(body(calls[1])).toEqual({})
    expect(body(calls[2])).toEqual({ key: "behg.co2", sync_hours: 24 })
    const mixed = (await handleSync(getToken, undefined, {
      keys: ["a"],
      key: "a",
      active: false,
    })) as any
    const bare = (await handleSync(getToken, undefined, { key: "a" })) as any
    expect(mixed.isError).toBe(true)
    expect(bare.isError).toBe(true)
    expect(calls).toHaveLength(3)
  })

  it("indices view sync reads the series overview", async () => {
    const calls = stubFetch()
    await handleIndices(getToken, undefined, { view: "sync" })
    expect(calls[0]?.url).toBe(`${API}/data/series`)
  })

  it("imports lists candidates or status, and import queues unique ids", async () => {
    const calls = stubFetch()
    await handleImports(getToken, undefined, { query: "WLV" })
    await handleImports(getToken, undefined, { view: "status" })
    await handleImport(getToken, undefined, { document_ids: [INVOICE, INVOICE, MODEL] })
    expect(calls.map((c) => c.url)).toEqual([
      `${API}/import/candidates?q=WLV`,
      `${API}/import/status`,
      `${API}/import`,
    ])
    expect(body(calls[2])).toEqual({ document_ids: [INVOICE, MODEL] })
  })
})
