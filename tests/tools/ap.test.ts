import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleBills,
  handleConfig,
  handleIssues,
  handleOverview,
  handlePost,
  handlePreview,
  handleRuns,
  handleSaveConfig,
  probeApAccess,
} from "../../src/tools/ap"
import { createServer } from "../../src/server-factory"
import { apAccessCached } from "../../src/http-server"

const RUN = "33333333-3333-4333-8333-333333333333"
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

describe("ap tool handlers", () => {
  it("overview reads the totals", async () => {
    const call = stub({ totals: {} })
    await handleOverview(token, undefined)
    expect(call()).toMatchObject({
      url: "https://api.talonic.com/v1/ap/overview",
      method: "GET",
      auth: "Bearer tlnc_key",
    })
  })

  it("bills forwards the filters as query params", async () => {
    const call = stub({ data: [] })
    await handleBills(token, "https://api.example.test", {
      status: "held",
      entity: "HRL",
      reason: "duplicate",
      query: "Corvane",
      limit: 10,
    })
    expect(call().url).toBe(
      "https://api.example.test/v1/ap/bills?status=held&entity=HRL&reason=duplicate&q=Corvane&limit=10",
    )
  })

  it("issues and config are plain reads", async () => {
    let call = stub({ data: [] })
    await handleIssues(token, undefined)
    expect(call().url).toBe("https://api.talonic.com/v1/ap/issues")
    vi.unstubAllGlobals()
    call = stub({ config: {} })
    await handleConfig(token, undefined)
    expect(call().url).toBe("https://api.talonic.com/v1/ap/config")
  })

  it("save_config puts the whole config, dry run by flag", async () => {
    const call = stub({ saved: false })
    await handleSaveConfig(token, undefined, { config: { default_terms_days: 30 }, dry_run: true })
    expect(call()).toMatchObject({
      method: "PUT",
      url: "https://api.talonic.com/v1/ap/config",
      body: { config: { default_terms_days: 30 }, dry_run: true },
    })
  })

  it("preview and post carry include_held; post forwards dry_run and limit", async () => {
    let call = stub({ records: [] })
    await handlePreview(token, undefined, { include_held: true })
    expect(call().url).toBe("https://api.talonic.com/v1/ap/netsuite/preview?include_held=1")
    vi.unstubAllGlobals()
    call = stub({ id: "dry-run" })
    await handlePost(token, undefined, { include_held: true, dry_run: true, limit: 5 })
    expect(call()).toMatchObject({
      method: "POST",
      url: "https://api.talonic.com/v1/ap/netsuite/post",
      body: { include_held: true, dry_run: true, limit: 5 },
    })
  })

  it("runs lists, or reads one run", async () => {
    let call = stub({ data: [] })
    await handleRuns(token, undefined, {})
    expect(call().url).toBe("https://api.talonic.com/v1/ap/netsuite/runs")
    vi.unstubAllGlobals()
    call = stub({ log: [] })
    await handleRuns(token, undefined, { run_id: RUN })
    expect(call().url).toBe(`https://api.talonic.com/v1/ap/netsuite/runs/${RUN}`)
  })

  it("an API error comes back as a tool error", async () => {
    stub({ message: "Invalid AP configuration" }, 400)
    const res = await handleSaveConfig(token, undefined, { config: {} })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("Invalid AP configuration")
  })
})

describe("ap tool registration", () => {
  it("lists the eight tools only when the probe passed", () => {
    const off = Object.keys((createServer({ apiKey: "tlnc_test" }) as any)._registeredTools).filter(
      (n) => n.startsWith("talonic_ap_"),
    )
    const on = Object.keys(
      (createServer({ apiKey: "tlnc_test", includeApTools: true }) as any)._registeredTools,
    ).filter((n) => n.startsWith("talonic_ap_"))
    expect(off).toEqual([])
    expect(on).toHaveLength(8)
  })

  it("marks reads read-only and replacing the config destructive", () => {
    const tools = (createServer({ apiKey: "tlnc_test", includeApTools: true }) as any)
      ._registeredTools
    expect(tools.talonic_ap_overview.annotations.readOnlyHint).toBe(true)
    expect(tools.talonic_ap_netsuite_preview.annotations.readOnlyHint).toBe(true)
    expect(tools.talonic_ap_save_config.annotations.destructiveHint).toBe(true)
    expect(tools.talonic_ap_netsuite_post.annotations.readOnlyHint).toBe(false)
    expect(tools.talonic_ap_netsuite_post.annotations.title).toBe(
      "Post to the simulated NetSuite sandbox",
    )
  })

  it("the probe is true on 200 and false on 404 or a network error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ config: {} }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await probeApAccess("t")).toBe(true)
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://api.talonic.com/v1/ap/config")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 404)))
    expect(await probeApAccess("t")).toBe(false)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")))
    expect(await probeApAccess("t")).toBe(false)
  })

  it("caches the probe per token", async () => {
    const probe = vi.fn().mockResolvedValue(true)
    const now = () => 1_000
    expect(await apAccessCached("tok-ap", probe, now)).toBe(true)
    expect(await apAccessCached("tok-ap", probe, now)).toBe(true)
    expect(probe).toHaveBeenCalledTimes(1)
  })
})
