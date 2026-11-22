import { afterEach, describe, expect, it, vi } from "vitest"
import { probeProcessesAccess } from "../../src/tools/processes"
import { createServer } from "../../src/server-factory"
import { processesAccessCached } from "../../src/http-server"

const PROC = "11111111-1111-4111-8111-111111111111"
const RUN = "22222222-2222-4222-8222-222222222222"
const API = "https://api.talonic.com/v1/processes"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function stub(body: unknown = {}) {
  const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(body))
  vi.stubGlobal("fetch", fetchMock)
  return (n = 0) => {
    const [url, init] = fetchMock.mock.calls[n] as [string, RequestInit]
    return {
      url: String(url),
      method: init.method,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: new Headers(init.headers).get("authorization"),
      count: fetchMock.mock.calls.length,
    }
  }
}

const tools = () =>
  (createServer({ apiKey: "tlnc_test", includeProcessesTools: true }) as any)._registeredTools

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("talonic_process_* tools", () => {
  it("are listed only when the caller may see processes", () => {
    const off = Object.keys((createServer({ apiKey: "tlnc_test" }) as any)._registeredTools)
    expect(off.filter((n) => n.startsWith("talonic_process_"))).toEqual([])
    expect(
      Object.keys(tools())
        .filter((n) => n.startsWith("talonic_process_"))
        .sort(),
    ).toEqual([
      "talonic_process_list",
      "talonic_process_run",
      "talonic_process_runs",
      "talonic_process_sign",
      "talonic_process_status",
      "talonic_process_waiting_for_me",
    ])
  })

  it("marks reads read-only and running and signing as writes", () => {
    const t = tools()
    for (const n of ["list", "status", "runs", "waiting_for_me"])
      expect(t[`talonic_process_${n}`].annotations.readOnlyHint, n).toBe(true)
    for (const n of ["run", "sign"])
      expect(t[`talonic_process_${n}`].annotations.readOnlyHint, n).toBe(false)
  })

  it("starts a process for one item with values by field name", async () => {
    const call = stub({ runId: RUN, process: "Access", reply: { body: "ok" } })
    await tools().talonic_process_run.handler({ process_id: PROC, values: { Vendor: "Acme" } })
    expect(call()).toMatchObject({
      url: `${API}/${PROC}/items`,
      method: "POST",
      body: { values: { Vendor: "Acme" } },
      auth: "Bearer tlnc_test",
    })
  })

  it("signs a step with a decision, and only the items given", async () => {
    const call = stub({ released: 1 })
    await tools().talonic_process_sign.handler({
      process_id: PROC,
      run_id: RUN,
      step_id: "ok",
      items: ["a"],
      decision: "Pay",
    })
    expect(call()).toMatchObject({
      url: `${API}/${PROC}/runs/${RUN}/holds/ok/release`,
      method: "POST",
      body: { items: ["a"], decision: "Pay" },
    })
  })

  it("reads status and items of a run together, and filters runs", async () => {
    const call = stub({})
    await tools().talonic_process_status.handler({ process_id: PROC, run_id: RUN })
    expect([call(0).url, call(1).url].sort()).toEqual([
      `${API}/${PROC}/items?run=${RUN}`,
      `${API}/${PROC}/status?run=${RUN}`,
    ])
    await tools().talonic_process_runs.handler({ state: "stuck", waiting_for_me: true })
    expect(call(2).url).toBe(`${API}/runs?state=stuck&waitingForMe=1`)
  })

  it("the probe is true on 200 and false on 403 or a network error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await probeProcessesAccess("t")).toBe(true)
    expect(String(fetchMock.mock.calls[0]![0])).toBe(API)
    fetchMock.mockResolvedValue(jsonResponse({}, 403))
    expect(await probeProcessesAccess("t")).toBe(false)
    fetchMock.mockRejectedValue(new Error("down"))
    expect(await probeProcessesAccess("t")).toBe(false)
    expect(typeof processesAccessCached).toBe("function")
  })
})
