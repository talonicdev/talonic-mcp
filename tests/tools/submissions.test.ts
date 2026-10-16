import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleChecks,
  handleCompleteness,
  handleExport,
  handleFacts,
  handleIssues,
  handleList,
  handleMatrix,
  handleProcess,
  handleSpecs,
  probeSubmissionsAccess,
} from "../../src/tools/submissions"
import { createServer } from "../../src/server-factory"
import { submissionsAccessCached } from "../../src/http-server"

const token = () => "tlnc_key"
const SPEC = "623c1765-3e1d-42a3-844e-a461cc8dd74c"
const DOC = "31d701ff-a6a8-4033-9761-3aaaca95a2cc"

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

describe("submissions tool handlers", () => {
  it("specs reads the target structures", async () => {
    const call = stub({ data: [] })
    await handleSpecs(token, undefined)
    expect(call()).toMatchObject({
      url: "https://api.talonic.com/v1/submissions/specs",
      method: "GET",
      auth: "Bearer tlnc_key",
    })
  })

  it("list passes spec, search and paging", async () => {
    const call = stub({ data: { total: 0, submissions: [] } })
    await handleList(token, undefined, { spec_id: SPEC, q: "utica", limit: 10, offset: 20 })
    const url = new URL(call().url)
    expect(url.pathname).toBe("/v1/submissions")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      spec_id: SPEC,
      q: "utica",
      limit: "10",
      offset: "20",
    })
  })

  it("issues passes the spec", async () => {
    const call = stub({ data: [] })
    await handleIssues(token, undefined, { spec_id: SPEC })
    expect(call().url).toBe(`https://api.talonic.com/v1/submissions/issues?spec_id=${SPEC}`)
  })

  it("process posts the filters, dry run included", async () => {
    const call = stub({ data: { dry_run: true, plan: [] } })
    await handleProcess(token, undefined, { spec_id: SPEC, only: "not_mapped", dry_run: true })
    expect(call()).toMatchObject({
      method: "POST",
      url: "https://api.talonic.com/v1/submissions/process",
      body: { spec_id: SPEC, only: "not_mapped", dry_run: true },
    })
  })

  it("completeness reads one submission under a spec", async () => {
    const call = stub({ data: { metrics: [] } })
    await handleCompleteness(token, undefined, { document_id: DOC, spec_id: SPEC })
    expect(call().url).toBe(
      `https://api.talonic.com/v1/submissions/${DOC}/completeness?spec_id=${SPEC}`,
    )
  })

  it("export reads facts for one document", async () => {
    const call = stub({ data: { header: [], rows: [] } })
    await handleExport(token, undefined, { spec_id: SPEC, document_id: DOC })
    expect(call().url).toBe(
      `https://api.talonic.com/v1/submissions/export?spec_id=${SPEC}&document_id=${DOC}`,
    )
  })

  it("matrix reads one submission's metric × year grid", async () => {
    const call = stub({ data: { years: [], rows: [] } })
    await handleMatrix(token, undefined, { document_id: DOC, spec_id: SPEC })
    expect(call().url).toBe(`https://api.talonic.com/v1/submissions/${DOC}/matrix?spec_id=${SPEC}`)
  })

  it("facts sends metric, year and a field filter as JSON", async () => {
    const call = stub({ data: { total: 0, facts: [] } })
    await handleFacts(token, undefined, {
      document_id: DOC,
      spec_id: SPEC,
      metric: "Total Incurred",
      year: "2019",
      fields: { Category: "Cat" },
      limit: 50,
    })
    const url = new URL(call().url)
    expect(url.pathname).toBe(`/v1/submissions/${DOC}/facts`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      spec_id: SPEC,
      metric: "Total Incurred",
      year: "2019",
      limit: "50",
      fields: '{"Category":"Cat"}',
    })
  })

  it("checks reads findings with or without a target structure", async () => {
    const call = stub({ data: [] })
    await handleChecks(token, undefined, { document_id: DOC })
    expect(call().url).toBe(`https://api.talonic.com/v1/submissions/${DOC}/checks`)
  })

  it("surfaces an API error as a tool error", async () => {
    stub({ message: "Target structure not found" }, 404)
    const res = await handleExport(token, undefined, { spec_id: SPEC })
    expect(res.isError).toBe(true)
  })
})

describe("submissions tool registration", () => {
  it("lists the nine tools only when the probe passed", () => {
    const names = (s: unknown) =>
      Object.keys((s as any)._registeredTools).filter((n) => n.startsWith("talonic_submissions_"))
    expect(names(createServer({ apiKey: "tlnc_test" }))).toEqual([])
    expect(
      names(createServer({ apiKey: "tlnc_test", includeSubmissionsTools: true })),
    ).toHaveLength(9)
  })

  it("marks reads read-only and processing as a write", () => {
    const tools = (createServer({ apiKey: "tlnc_test", includeSubmissionsTools: true }) as any)
      ._registeredTools
    for (const n of [
      "specs",
      "list",
      "issues",
      "completeness",
      "matrix",
      "facts",
      "checks",
      "export",
    ])
      expect(tools[`talonic_submissions_${n}`].annotations.readOnlyHint).toBe(true)
    expect(tools.talonic_submissions_process.annotations.readOnlyHint).toBe(false)
    expect(tools.talonic_submissions_process.annotations.destructiveHint).toBe(false)
  })

  it("the probe is true on 200 and false on 404 or a network error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await probeSubmissionsAccess("t")).toBe(true)
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://api.talonic.com/v1/submissions/specs")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 404)))
    expect(await probeSubmissionsAccess("t")).toBe(false)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")))
    expect(await probeSubmissionsAccess("t")).toBe(false)
  })

  it("caches the probe per token", async () => {
    const probe = vi.fn().mockResolvedValue(true)
    const now = () => 1_000
    expect(await submissionsAccessCached("tok-sub", probe, now)).toBe(true)
    expect(await submissionsAccessCached("tok-sub", probe, now)).toBe(true)
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
