import { afterEach, describe, expect, it, vi } from "vitest"
import { createServer } from "../../src/server-factory"
import { contractsAccessCached, decisionTasksAccessCached } from "../../src/http-server"
import { handleListApps, probeAgentTasksInUse, probeExternalAppsInUse } from "../../src/tools/apps"

const names = (opts: Record<string, unknown>) =>
  Object.keys((createServer({ apiKey: "tlnc_test", ...opts }) as any)._registeredTools)

describe("worker-protocol tool gating", () => {
  it("hides Agent-task and decision-task tools when the workspace does not use them", () => {
    const tools = names({ includeAgentTaskTools: false, includeDecisionTaskTools: false })
    expect(tools.filter((t) => /agent_task|decision/.test(t))).toEqual([])
    expect(tools).toContain("talonic_list_apps")
    expect(tools).toContain("talonic_get_schema")
  })
  it("keeps them by default (local installs are usually the worker)", () => {
    const tools = names({})
    expect(tools).toContain("talonic_claim_agent_task")
    expect(tools).toContain("talonic_claim_decision_task")
  })
  it("only describes flows whose tools are registered", () => {
    const off = (
      createServer({
        apiKey: "tlnc_test",
        includeAgentTaskTools: false,
        includeDecisionTaskTools: false,
      }) as any
    ).server._instructions as string
    expect(off).not.toMatch(/execution_epoch|decision_task/)
    expect(off).toMatch(/Which tool for which question/)
  })
})

describe("probe cache never drops tools on a transient failure", () => {
  it("reuses the last known answer when the probe cannot reach the platform", async () => {
    let t = 0
    const now = () => t
    expect(await contractsAccessCached("tok-flaky", async () => true, now)).toBe(true)
    t += 10 * 60 * 1000 // past the TTL
    expect(await contractsAccessCached("tok-flaky", async () => "unknown", now)).toBe(true)
    expect(
      await contractsAccessCached(
        "tok-flaky",
        async () => {
          throw new Error("x")
        },
        now,
      ),
    ).toBe(true)
  })
  it("does not cache an unknown answer", async () => {
    const probe = vi.fn(async () => "unknown" as const)
    expect(await decisionTasksAccessCached("tok-new", probe)).toBe(false)
    expect(await decisionTasksAccessCached("tok-new", probe)).toBe(false)
    expect(probe).toHaveBeenCalledTimes(2)
  })
})

describe("probes", () => {
  afterEach(() => vi.unstubAllGlobals())
  const stub = (status: number, body: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body), { status })),
    )

  it("external apps: true only when an app has mode external", async () => {
    stub(200, { apps: [{ mode: "rules" }, { mode: "external" }] })
    expect(await probeExternalAppsInUse("t")).toBe(true)
    stub(200, { apps: [{ mode: "rules" }] })
    expect(await probeExternalAppsInUse("t")).toBe(false)
    stub(403, {})
    expect(await probeExternalAppsInUse("t")).toBe(false)
    stub(503, {})
    expect(await probeExternalAppsInUse("t")).toBe("unknown")
  })
  it("agent tasks: true only when at least one task exists", async () => {
    stub(200, { data: [{ id: "x" }] })
    expect(await probeAgentTasksInUse("t")).toBe(true)
    stub(200, { data: [] })
    expect(await probeAgentTasksInUse("t")).toBe(false)
  })
  it("list_apps returns compact app rows", async () => {
    stub(200, {
      apps: [
        {
          id: "a1",
          slug: "s",
          display_name: "S",
          mode: "external",
          enabled: true,
          contract: { big: 1 },
        },
      ],
    })
    const res = await handleListApps(() => "t", undefined, {})
    const body = JSON.parse(res.content[0]!.text)
    expect(body.count).toBe(1)
    expect(body.apps[0]).toEqual({
      id: "a1",
      slug: "s",
      display_name: "S",
      description: null,
      mode: "external",
      enabled: true,
      standard: null,
    })
  })
})
