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
      "talonic_process_address",
      "talonic_process_change",
      "talonic_process_check",
      "talonic_process_create",
      "talonic_process_delete",
      "talonic_process_get",
      "talonic_process_item",
      "talonic_process_list",
      "talonic_process_mailbox_ownership",
      "talonic_process_publish",
      "talonic_process_retry",
      "talonic_process_rollback",
      "talonic_process_run",
      "talonic_process_runs",
      "talonic_process_send_back",
      "talonic_process_setup",
      "talonic_process_sign",
      "talonic_process_status",
      "talonic_process_test_run",
      "talonic_process_versions",
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

  it("marks the new reads read-only, and what changes live work or cannot be undone as destructive", () => {
    const t = tools()
    for (const n of ["get", "check", "versions", "item", "setup"])
      expect(t[`talonic_process_${n}`].annotations.readOnlyHint, n).toBe(true)
    for (const n of ["create", "change", "test_run", "retry", "send_back", "mailbox_ownership"]) {
      expect(t[`talonic_process_${n}`].annotations.readOnlyHint, n).toBe(false)
      expect(t[`talonic_process_${n}`].annotations.destructiveHint, n).toBe(false)
    }
    for (const n of ["publish", "rollback", "delete", "address"])
      expect(t[`talonic_process_${n}`].annotations.destructiveHint, n).toBe(true)
  })

  it("makes a draft from a description, or from an n8n workflow handed in as text", async () => {
    let call = stub({ id: PROC, name: "Invoices", stillOpen: ["Who signs here?"] })
    await tools().talonic_process_create.handler({
      description: "Invoices over 10,000 go to a manager.",
    })
    expect(call()).toMatchObject({
      url: API,
      method: "POST",
      body: { description: "Invoices over 10,000 go to a manager." },
    })
    call = stub({ id: PROC })
    await tools().talonic_process_create.handler({ workflow_json: '{"nodes":[]}' })
    expect(call().body).toEqual({ workflow: { nodes: [] } })
    call = stub({})
    const bad = await tools().talonic_process_create.handler({ workflow_json: "{not json" })
    expect(bad.isError).toBe(true)
  })

  it("changes a draft, and sends confirmed only when it is true", async () => {
    let call = stub({ status: "needs_confirmation", reductions: ["x"] })
    await tools().talonic_process_change.handler({
      process_id: PROC,
      change: "Remove the approval.",
    })
    expect(call()).toMatchObject({
      url: `${API}/${PROC}/change`,
      method: "POST",
      body: { change: "Remove the approval." },
    })
    call = stub({ status: "changed" })
    await tools().talonic_process_change.handler({
      process_id: PROC,
      change: "Remove the approval.",
      step_id: "s_1",
      confirmed: true,
    })
    expect(call().body).toEqual({ change: "Remove the approval.", stepId: "s_1", confirmed: true })
  })

  it("reads the check together with what publishing would change, and publishes with a reason", async () => {
    let call = stub({ canPublish: true })
    await tools().talonic_process_check.handler({ process_id: PROC })
    expect([call(0).url, call(1).url].sort()).toEqual([
      `${API}/${PROC}/changes`,
      `${API}/${PROC}/check`,
    ])
    call = stub({ version: 2 })
    await tools().talonic_process_publish.handler({ process_id: PROC, reason: "New approver" })
    expect(call()).toMatchObject({
      url: `${API}/${PROC}/publish`,
      method: "POST",
      body: { reason: "New approver" },
    })
  })

  it("only looks at an address unless asked to make one, and replaces one only when told", async () => {
    let call = stub({ exists: true })
    await tools().talonic_process_address.handler({ process_id: PROC })
    expect(call()).toMatchObject({ url: `${API}/${PROC}/address`, method: "GET" })
    call = stub({ token: "t", path: "/process-hooks/t" })
    await tools().talonic_process_address.handler({ process_id: PROC, make: true })
    expect(call()).toMatchObject({ method: "PUT", body: {} })
    call = stub({ token: "t" })
    await tools().talonic_process_address.handler({
      process_id: PROC,
      make: true,
      replace: true,
      test: true,
    })
    expect(call().body).toEqual({ test: true, replace: true })
  })

  it("reads what processes can use in one call, and never a secret's value", async () => {
    const call = stub({ data: ["api_token"] })
    await tools().talonic_process_setup.handler({})
    expect([0, 1, 2, 3].map((n) => call(n).url).sort()).toEqual([
      `${API}/lookup-data`,
      `${API}/mailboxes`,
      `${API}/people`,
      `${API}/secrets`,
    ])
    expect(Object.keys(tools()).filter((n) => /secret/.test(n))).toEqual([])
  })

  it("tests, rolls back, deletes, retries, sends back and sets a mailbox's ownership on the right routes", async () => {
    const cases: Array<[string, Record<string, unknown>, string, string, unknown]> = [
      [
        "test_run",
        { process_id: PROC, document_ids: [RUN] },
        "POST",
        `${API}/${PROC}/test-run`,
        { documentIds: [RUN] },
      ],
      [
        "rollback",
        { process_id: PROC, version: 3 },
        "POST",
        `${API}/${PROC}/versions/3/rollback`,
        undefined,
      ],
      ["delete", { process_id: PROC }, "DELETE", `${API}/${PROC}`, undefined],
      ["retry", { run_id: RUN }, "POST", `${API}/runs/${RUN}/retry`, undefined],
      [
        "send_back",
        { process_id: PROC, run_id: RUN, step_id: "s_1", items: ["a"], reason: "Wrong amount" },
        "POST",
        `${API}/${PROC}/runs/${RUN}/holds/s_1/send-back`,
        { items: ["a"], reason: "Wrong amount" },
      ],
      [
        "mailbox_ownership",
        { mailbox_id: RUN, ownership: "company" },
        "PUT",
        `${API}/mailboxes/${RUN}/ownership`,
        { ownership: "company" },
      ],
      [
        "item",
        { process_id: PROC, run_id: RUN, item_key: "doc 1" },
        "GET",
        `${API}/${PROC}/runs/${RUN}/items/doc%201`,
        undefined,
      ],
      ["get", { process_id: PROC }, "GET", `${API}/${PROC}`, undefined],
      ["versions", { process_id: PROC }, "GET", `${API}/${PROC}/versions`, undefined],
    ]
    for (const [name, args, method, url, body] of cases) {
      const call = stub({})
      // the server takes `fetch` when it is made: make it after the stub, or the call would go out for real
      await tools()[`talonic_process_${name}`].handler(args)
      expect(call(), name).toMatchObject({ url, method })
      expect(call().body, name).toEqual(body)
    }
  })
})
