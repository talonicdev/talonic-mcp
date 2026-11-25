import { afterEach, describe, expect, it, vi } from "vitest"
import { createServer } from "../../src/server-factory"
import { createRequestHandler } from "../../src/http-server"
import {
  MINING_DRIVER_TOOLS,
  handleMiningCallRoundTool,
  handleMiningGetRoundToolCall,
  handleMiningListRoundTools,
  handleMiningListRounds,
  handleMiningStartRound,
  probeMiningInUse,
} from "../../src/tools/mining-driver"

const APP = "11111111-1111-4111-8111-111111111111"
const RUN = "22222222-2222-4222-8222-222222222222"
const CALL = "44444444-4444-4444-8444-444444444444"
const ROUND = `/v1/apps/${APP}/mining/rounds/${RUN}`
const token = () => "tlnc_k"

interface Seen {
  method: string
  path: string
  query: Record<string, string>
  body: any
}

/** Sequential fetch stub: each response is consumed in order. */
function stubSeq(responses: Array<[number, unknown]>) {
  const seen: Seen[] = []
  let i = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(String(input))
      seen.push({
        method: init.method ?? "GET",
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      })
      const [status, body] = responses[Math.min(i++, responses.length - 1)]!
      return new Response(JSON.stringify(body), { status })
    }),
  )
  return seen
}

const parse = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0]!.text)

/** Fake clock: sleep advances time instantly. */
function fakeClock() {
  let t = 0
  const sleeps: number[] = []
  return {
    sleeps,
    timing: {
      now: () => t,
      sleep: async (ms: number) => {
        sleeps.push(ms)
        t += ms
      },
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("mining driver: gating and auth listing", () => {
  it("is listed only with includeMiningDriverTools", () => {
    const off = Object.keys((createServer({ apiKey: "tlnc_test" }) as any)._registeredTools)
    for (const n of MINING_DRIVER_TOOLS) expect(off).not.toContain(n)
    const on = (createServer({ apiKey: "tlnc_test", includeMiningDriverTools: true }) as any)
      ._registeredTools
    for (const n of MINING_DRIVER_TOOLS) expect(Object.keys(on)).toContain(n)
  })

  it("marks only the decide-tier tools non-invocable when apps:decide is visibly missing", () => {
    const t = (
      createServer({
        apiKey: "tlnc_test",
        includeMiningDriverTools: true,
        decisionTasksInvocable: false,
      }) as any
    )._registeredTools
    for (const n of [
      "talonic_mining_list_round_tools",
      "talonic_mining_call_round_tool",
      "talonic_mining_get_round_tool_call",
    ]) {
      expect(t[n]._meta?.["talonic/can_invoke"], n).toBe(false)
      expect(t[n]._meta?.["talonic/required_scope"], n).toBe("apps:decide")
    }
    for (const n of [
      "talonic_mining_list_rounds",
      "talonic_mining_get_round",
      "talonic_mining_start_round",
    ])
      expect(t[n]._meta?.["talonic/can_invoke"], n).toBeUndefined()
    const invocable = (createServer({ apiKey: "tlnc_test", includeMiningDriverTools: true }) as any)
      ._registeredTools
    expect(invocable.talonic_mining_call_round_tool._meta?.["talonic/can_invoke"]).toBeUndefined()
  })

  it("probe: true only when the workspace has an autonomous app", async () => {
    stubSeq([[200, { apps: [{ mode: "rules" }, { mode: "autonomous" }] }]])
    expect(await probeMiningInUse("t")).toBe(true)
    stubSeq([[200, { apps: [{ mode: "external" }] }]])
    expect(await probeMiningInUse("t")).toBe(false)
    stubSeq([[403, {}]])
    expect(await probeMiningInUse("t")).toBe(false)
  })

  it("hosted: an autonomous-only workspace also lists the decision-task tools it closes rounds with", async () => {
    const handler = createRequestHandler({
      growthAccess: async () => false,
      adminAgentTaskAccess: async () => false,
      contractsAccess: async () => false,
      apAccess: async () => false,
      docGenAccess: async () => false,
      partiesAccess: async () => false,
      masterRecordsAccess: async () => false,
      submissionsAccess: async () => false,
      priceBaselineAccess: async () => false,
      portfolioAccess: async () => false,
      processesAccess: async () => false,
      agentTasksAccess: async () => false,
      decisionTasksAccess: async () => false,
      appsToolsetAccess: async () => false,
      miningAccess: async () => true,
      tokenAccepted: async () => true,
    })
    const { createServer: createHttp } = await import("node:http")
    const srv = createHttp(handler)
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r))
    const { port } = srv.address() as { port: number }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: "Bearer tlnc_x",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      })
      const text = await res.text()
      expect(text).toContain("talonic_mining_call_round_tool")
      expect(text).toContain("talonic_claim_decision_task")
      expect(text).toContain("talonic_submit_decision_task")
      expect(text).not.toContain("talonic_create_app")
    } finally {
      srv.closeAllConnections()
      await new Promise<void>((r) => srv.close(() => r()))
    }
  })
})

describe("mining driver: routes", () => {
  it("lists and starts rounds; reconcile uses its own route", async () => {
    const seen = stubSeq([[200, { rounds: [], total: 0 }]])
    await handleMiningListRounds(token, undefined, { app_id: APP, limit: 5, offset: 10 })
    await handleMiningStartRound(token, undefined, { app_id: APP, phase: "hypothesis" })
    await handleMiningStartRound(token, undefined, { app_id: APP, phase: "reconcile" })
    await handleMiningListRoundTools(token, undefined, { app_id: APP, run_id: RUN })
    expect(seen.map((s) => `${s.method} ${s.path}`)).toEqual([
      `GET /v1/apps/${APP}/mining/rounds`,
      `POST /v1/apps/${APP}/mining/rounds`,
      `POST /v1/apps/${APP}/mining/rounds/reconcile`,
      `GET ${ROUND}/tools`,
    ])
    expect(seen[0]!.query).toEqual({ limit: "5", offset: "10" })
    expect(seen[1]!.body).toEqual({ phase: "hypothesis" })
    expect(seen[2]!.body).toBeUndefined()
  })

  it("forwards a call as { execution_epoch, input } and returns a sync answer as is", async () => {
    const seen = stubSeq([
      [200, { call_id: CALL, status: "done", content: "3 rows", is_error: false }],
    ])
    const res = await handleMiningCallRoundTool(token, undefined, {
      app_id: APP,
      run_id: RUN,
      execution_epoch: 4,
      name: "run_query",
      input: { sql: "select 1" },
    })
    expect(res.isError).toBeUndefined()
    expect(parse(res)).toMatchObject({ status: "done", content: "3 rows" })
    expect(seen[0]).toMatchObject({
      method: "POST",
      path: `${ROUND}/tools/run_query`,
      body: { execution_epoch: 4, input: { sql: "select 1" } },
    })
  })

  it("retries a busy round with backoff, then succeeds", async () => {
    const busy: [number, unknown] = [
      409,
      { message: "another call is running", details: { call_id: CALL, refused: "busy" } },
    ]
    const seen = stubSeq([busy, busy, [200, { call_id: CALL, status: "done", content: "ok" }]])
    const clock = fakeClock()
    const res = await handleMiningCallRoundTool(
      token,
      undefined,
      { app_id: APP, run_id: RUN, execution_epoch: 1, name: "describe_substrate" },
      clock.timing,
    )
    expect(parse(res).content).toBe("ok")
    expect(seen).toHaveLength(3)
    expect(clock.sleeps).toEqual([500, 1000])
  })

  it("does not retry a stale-claim 409, and gives up on a round that stays busy", async () => {
    stubSeq([[409, { message: "stale or foreign task claim", details: { refused: "claim" } }]])
    const stale = await handleMiningCallRoundTool(token, undefined, {
      app_id: APP,
      run_id: RUN,
      execution_epoch: 1,
      name: "x",
    })
    expect(stale.isError).toBe(true)
    expect(stale.content[0]!.text).toMatch(/HTTP 409/)

    const seen = stubSeq([[409, { details: { refused: "busy" } }]])
    const clock = fakeClock()
    const busy = await handleMiningCallRoundTool(
      token,
      undefined,
      { app_id: APP, run_id: RUN, execution_epoch: 1, name: "x" },
      clock.timing,
    )
    expect(busy.isError).toBe(true)
    expect(seen).toHaveLength(5)
  })

  it("polls a 202 call until it is done", async () => {
    const seen = stubSeq([
      [202, { call_id: CALL, status: "running", poll: "…" }],
      [200, { call_id: CALL, status: "running", state: "active" }],
      [200, { call_id: CALL, status: "done", content: "found 2", is_error: false }],
    ])
    const clock = fakeClock()
    const res = await handleMiningCallRoundTool(
      token,
      undefined,
      { app_id: APP, run_id: RUN, execution_epoch: 7, name: "evaluate_hypothesis" },
      clock.timing,
    )
    expect(parse(res)).toMatchObject({ status: "done", content: "found 2" })
    expect(seen.slice(1).map((s) => `${s.method} ${s.path}`)).toEqual([
      `GET ${ROUND}/tools/calls/${CALL}`,
      `GET ${ROUND}/tools/calls/${CALL}`,
    ])
    expect(seen[1]!.query).toEqual({ execution_epoch: "7" })
  })

  it("hands back the call_id when the call outlives wait_seconds", async () => {
    stubSeq([
      [202, { call_id: CALL, status: "running" }],
      [200, { call_id: CALL, status: "running", state: "active" }],
    ])
    const clock = fakeClock()
    const res = await handleMiningCallRoundTool(
      token,
      undefined,
      {
        app_id: APP,
        run_id: RUN,
        execution_epoch: 7,
        name: "evaluate_hypothesis",
        wait_seconds: 4,
      },
      clock.timing,
    )
    expect(parse(res)).toMatchObject({ call_id: CALL, status: "running" })
    expect(parse(res).next_step).toMatch(/talonic_mining_get_round_tool_call/)

    const seen = stubSeq([[200, { call_id: CALL, status: "done", content: "late" }]])
    const later = await handleMiningGetRoundToolCall(token, undefined, {
      app_id: APP,
      run_id: RUN,
      call_id: CALL,
      execution_epoch: 7,
    })
    expect(parse(later).content).toBe("late")
    expect(seen[0]!.query).toEqual({ execution_epoch: "7" })
  })

  it("rejects a tool name that could escape the route", async () => {
    const t = (createServer({ apiKey: "tlnc_test", includeMiningDriverTools: true }) as any)
      ._registeredTools
    const schema = t.talonic_mining_call_round_tool.inputSchema
    const bad = schema.safeParse({
      app_id: APP,
      run_id: RUN,
      execution_epoch: 1,
      name: "../../tools",
    })
    expect(bad.success).toBe(false)
  })
})
