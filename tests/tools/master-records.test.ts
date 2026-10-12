import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleChanges,
  handleConfig,
  handleCrosswalk,
  handleDecide,
  handleGetRecord,
  handleOverview,
  handleRun,
  handleSaveConfig,
  probeMasterRecordsAccess,
} from "../../src/tools/master-records"
import { createServer } from "../../src/server-factory"
import { masterRecordsAccessCached } from "../../src/http-server"

const KEY = "0f3c9a1b2d4e5f60718293a4b5c6d7e8f9012345"
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

describe("master records tool handlers", () => {
  it("config reads the configuration", async () => {
    const call = stub({ domains: {} })
    await handleConfig(token, undefined)
    expect(call()).toMatchObject({
      url: "https://api.talonic.com/v1/master-records/config",
      method: "GET",
      auth: "Bearer tlnc_key",
    })
  })

  it("save_config puts the whole config, dry run by flag", async () => {
    const call = stub({ saved: false })
    await handleSaveConfig(token, undefined, { config: { domains: {} }, dry_run: true })
    expect(call()).toMatchObject({
      method: "PUT",
      url: "https://api.talonic.com/v1/master-records/config",
      body: { config: { domains: {} }, dry_run: true },
    })
  })

  it("run posts to the domain", async () => {
    const call = stub({ run_id: "r", stats: {} })
    await handleRun(token, undefined, { domain: "vendors" })
    expect(call()).toMatchObject({
      method: "POST",
      url: "https://api.talonic.com/v1/master-records/vendors/run",
    })
  })

  it("overview forwards the filters as query params", async () => {
    const call = stub({ records: [] })
    await handleOverview(token, "https://api.example.test", {
      domain: "customers",
      status: "review",
      query: "Acme",
      limit: 10,
      offset: 20,
    })
    expect(call().url).toBe(
      "https://api.example.test/v1/master-records/customers/overview?status=review&q=Acme&limit=10&offset=20",
    )
  })

  it("get_record and decide address one record by key", async () => {
    let call = stub({ key: KEY })
    await handleGetRecord(token, undefined, { domain: "vendors", key: KEY })
    expect(call().url).toBe(`https://api.talonic.com/v1/master-records/vendors/records/${KEY}`)
    vi.unstubAllGlobals()
    call = stub({ key: KEY, decision: "split" })
    await handleDecide(token, undefined, { domain: "vendors", key: KEY, decision: "split" })
    expect(call()).toMatchObject({
      method: "POST",
      url: `https://api.talonic.com/v1/master-records/vendors/records/${KEY}/decision`,
      body: { decision: "split" },
    })
  })

  it("changes sends flagged only when asked; crosswalk is a plain read", async () => {
    let call = stub({ changes: [] })
    await handleChanges(token, undefined, { domain: "vendors", flagged: true })
    expect(call().url).toBe(
      "https://api.talonic.com/v1/master-records/vendors/changes?flagged=true",
    )
    vi.unstubAllGlobals()
    call = stub({ changes: [] })
    await handleChanges(token, undefined, { domain: "vendors" })
    expect(call().url).toBe("https://api.talonic.com/v1/master-records/vendors/changes")
    vi.unstubAllGlobals()
    call = stub([])
    await handleCrosswalk(token, undefined, { domain: "materials" })
    expect(call().url).toBe("https://api.talonic.com/v1/master-records/materials/crosswalk")
  })

  it("an API error comes back as a tool error", async () => {
    stub({ message: "No sources configured for vendors" }, 422)
    const res = await handleRun(token, undefined, { domain: "vendors" })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("No sources configured for vendors")
  })
})

describe("master records tool registration", () => {
  it("lists the eight tools only when the probe passed", () => {
    const off = Object.keys((createServer({ apiKey: "tlnc_test" }) as any)._registeredTools).filter(
      (n) => n.startsWith("talonic_master_records_"),
    )
    const on = Object.keys(
      (createServer({ apiKey: "tlnc_test", includeMasterRecordsTools: true }) as any)
        ._registeredTools,
    ).filter((n) => n.startsWith("talonic_master_records_"))
    expect(off).toEqual([])
    expect(on).toHaveLength(8)
  })

  it("marks reads read-only and replacing the config destructive", () => {
    const tools = (createServer({ apiKey: "tlnc_test", includeMasterRecordsTools: true }) as any)
      ._registeredTools
    expect(tools.talonic_master_records_overview.annotations.readOnlyHint).toBe(true)
    expect(tools.talonic_master_records_get_record.annotations.readOnlyHint).toBe(true)
    expect(tools.talonic_master_records_changes.annotations.readOnlyHint).toBe(true)
    expect(tools.talonic_master_records_crosswalk.annotations.readOnlyHint).toBe(true)
    expect(tools.talonic_master_records_save_config.annotations.destructiveHint).toBe(true)
    expect(tools.talonic_master_records_run.annotations.readOnlyHint).toBe(false)
    expect(tools.talonic_master_records_decide.annotations.readOnlyHint).toBe(false)
    expect(tools.talonic_master_records_decide.annotations.title).toBe(
      "Accept or split a golden record",
    )
  })

  it("the probe is true on 200 and false on 404 or a network error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ domains: {} }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await probeMasterRecordsAccess("t")).toBe(true)
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://api.talonic.com/v1/master-records/config",
    )
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 404)))
    expect(await probeMasterRecordsAccess("t")).toBe(false)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")))
    expect(await probeMasterRecordsAccess("t")).toBe(false)
  })

  it("caches the probe per token", async () => {
    const probe = vi.fn().mockResolvedValue(true)
    const now = () => 1_000
    expect(await masterRecordsAccessCached("tok-mr", probe, now)).toBe(true)
    expect(await masterRecordsAccessCached("tok-mr", probe, now)).toBe(true)
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
