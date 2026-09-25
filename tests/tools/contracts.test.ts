import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleContract,
  handleDecide,
  handleImport,
  handleIssues,
  handleMerge,
  handleRegister,
  handleReread,
  handleSetTerm,
  handleUpdateDocument,
  probeContractsAccess,
} from "../../src/tools/contracts"
import { createServer } from "../../src/server-factory"
import { contractsAccessCached } from "../../src/http-server"

const C = "11111111-1111-4111-8111-111111111111"
const R = "22222222-2222-4222-8222-222222222222"
const token = () => "tlnc_key"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function stub(body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body))
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

describe("contracts tool handlers", () => {
  it("register forwards the filters as query params", async () => {
    const call = stub({ data: [] })
    await handleRegister(token, undefined, { query: "Walze", status: "active" })
    expect(call()).toMatchObject({
      url: "https://api.talonic.com/v1/contracts?q=Walze&status=active",
      method: "GET",
      auth: "Bearer tlnc_key",
    })
  })

  it("contract reads one contract", async () => {
    const call = stub({ contract: {} })
    await handleContract(token, "https://api.example.test", { contract_id: C })
    expect(call().url).toBe(`https://api.example.test/v1/contracts/${C}`)
  })

  it("issues narrows by code on the client", async () => {
    stub({
      data: [
        { contract_key: "A", issues: [{ code: "no_dates" }] },
        { contract_key: "B", issues: [{ code: "ended_by_message" }] },
      ],
    })
    const res = await handleIssues(token, undefined, { code: "ended_by_message" })
    expect(
      JSON.parse(res.content[0]!.text).data.map((c: { contract_key: string }) => c.contract_key),
    ).toEqual(["B"])
  })

  it("import all posts the filters to import/all", async () => {
    const call = stub({ dry_run: true, documents: 12 })
    await handleImport(token, undefined, { all: true, only_priced: true, limit: 50, dry_run: true })
    expect(call()).toMatchObject({
      url: "https://api.talonic.com/v1/contracts/import/all",
      method: "POST",
      body: { only_priced: true, limit: 50, dry_run: true },
    })
  })

  it("import by ids posts to import", async () => {
    const call = stub({ queued: 1 })
    await handleImport(token, undefined, { document_ids: [R], force: true })
    expect(call()).toMatchObject({
      url: "https://api.talonic.com/v1/contracts/import",
      body: { document_ids: [R], force: true },
    })
  })

  it("import refuses neither and both", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect((await handleImport(token, undefined, {})).isError).toBe(true)
    expect((await handleImport(token, undefined, { all: true, document_ids: [R] })).isError).toBe(
      true,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("update_document PUTs the change, or DELETEs on remove", async () => {
    let call = stub({})
    await handleUpdateDocument(token, undefined, {
      contract_id: C,
      document_row_id: R,
      contract_key: "1042460-WLV / An der Walze 12",
      excluded: false,
    })
    expect(call()).toMatchObject({
      url: `https://api.talonic.com/v1/contracts/${C}/documents/${R}`,
      method: "PUT",
      body: { contract_key: "1042460-WLV / An der Walze 12", excluded: false },
    })
    vi.unstubAllGlobals()
    call = stub({})
    await handleUpdateDocument(token, undefined, {
      contract_id: C,
      document_row_id: R,
      remove: true,
    })
    expect(call().method).toBe("DELETE")
  })

  it("update_document refuses an empty change and remove mixed with edits", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(
      (await handleUpdateDocument(token, undefined, { contract_id: C, document_row_id: R }))
        .isError,
    ).toBe(true)
    expect(
      (
        await handleUpdateDocument(token, undefined, {
          contract_id: C,
          document_row_id: R,
          remove: true,
          role: "master",
        })
      ).isError,
    ).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("merge, reread, decide and set_term hit their routes", async () => {
    let call = stub({})
    await handleMerge(token, undefined, { contract_id: C, into_key: "3042-WLV" })
    expect(call()).toMatchObject({
      url: `https://api.talonic.com/v1/contracts/${C}/merge`,
      body: { into_key: "3042-WLV" },
    })
    vi.unstubAllGlobals()
    call = stub({})
    await handleReread(token, undefined, { contract_id: C })
    expect(call()).toMatchObject({
      url: `https://api.talonic.com/v1/contracts/${C}/reread`,
      body: {},
    })
    vi.unstubAllGlobals()
    call = stub({})
    await handleDecide(token, undefined, {
      contract_id: C,
      state: "notice_sent",
      note: "Schreiben vom 12.01.2026",
    })
    expect(call()).toMatchObject({
      url: `https://api.talonic.com/v1/contracts/${C}/decision`,
      body: { state: "notice_sent", note: "Schreiben vom 12.01.2026" },
    })
    vi.unstubAllGlobals()
    call = stub({})
    await handleSetTerm(token, undefined, {
      contract_id: C,
      document_row_id: R,
      field: "notice_months",
      value: 6,
      quote: "mit einer Frist von 6 Monaten",
    })
    expect(call()).toMatchObject({
      url: `https://api.talonic.com/v1/contracts/${C}/documents/${R}/terms`,
      body: { field: "notice_months", value: 6 },
    })
  })

  it("surfaces the platform's error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ message: "Not saved: quote not found in the document" }, 422),
        ),
    )
    const res = await handleSetTerm(token, undefined, {
      contract_id: C,
      document_row_id: R,
      field: "expiry_date",
      value: "2030-12-31",
      quote: "xyz",
    })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("quote not found")
  })
})

describe("contracts tool registration", () => {
  it("lists the thirteen tools only when the probe passed", () => {
    const off = Object.keys((createServer({ apiKey: "tlnc_test" }) as any)._registeredTools).filter(
      (n) => n.startsWith("talonic_contracts_"),
    )
    const on = Object.keys(
      (createServer({ apiKey: "tlnc_test", includeContractsTools: true }) as any)._registeredTools,
    ).filter((n) => n.startsWith("talonic_contracts_"))
    expect(off).toEqual([])
    expect(on).toHaveLength(13)
  })

  it("marks reads read-only and cleaning destructive", () => {
    const tools = (createServer({ apiKey: "tlnc_test", includeContractsTools: true }) as any)
      ._registeredTools
    expect(tools.talonic_contracts_issues.annotations.readOnlyHint).toBe(true)
    expect(tools.talonic_contracts_update_document.annotations.destructiveHint).toBe(true)
    expect(tools.talonic_contracts_merge.annotations.destructiveHint).toBe(true)
    expect(tools.talonic_contracts_import.annotations.readOnlyHint).toBe(false)
  })

  it("the probe is true on 200 and false on 404 or a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ counts: {} })))
    expect(await probeContractsAccess("t")).toBe(true)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 404)))
    expect(await probeContractsAccess("t")).toBe(false)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")))
    expect(await probeContractsAccess("t")).toBe(false)
  })

  it("caches the probe per token", async () => {
    const probe = vi.fn().mockResolvedValue(true)
    const now = () => 1_000
    expect(await contractsAccessCached("tok-c", probe, now)).toBe(true)
    expect(await contractsAccessCached("tok-c", probe, now)).toBe(true)
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
