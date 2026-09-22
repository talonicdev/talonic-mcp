import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleClaimDecisionTask,
  handleFailDecisionTask,
  handleHeartbeatDecisionTask,
  handleListDecisionTasks,
  handleReadDecisionPackage,
  handleReleaseDecisionTask,
  handleSubmitDecisionTask,
  tokenHasDecideScope,
} from "../../src/tools/decision-tasks"
import { createServer } from "../../src/server-factory"

const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const TASK_ID = "11111111-1111-4111-8111-111111111111"
const RUN_ID = "22222222-2222-4222-8222-222222222222"

/** An unsigned JWT-shaped token whose payload carries the given OAuth scopes. */
function fakeOAuthToken(scopes: unknown): string {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ grant_type: "oauth2", scopes })}.sig`
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function call(fetchMock: ReturnType<typeof vi.fn>, index = 0): [string, RequestInit] {
  return fetchMock.mock.calls[index] as [string, RequestInit]
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("decision-task handlers", () => {
  it("lists one app's inbox with the status, limit and cursor filters and the current bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ id: TASK_ID, run_id: RUN_ID, app_id: APP_ID, status: "available" }],
        pagination: { has_more: false, next_cursor: null },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await handleListDecisionTasks(() => "decide-key", undefined, {
      app_id: APP_ID,
      status: "available",
      limit: 25,
      cursor: "next-page",
    })

    const [rawUrl, init] = call(fetchMock)
    const url = new URL(rawUrl)
    expect(url.origin).toBe("https://api.talonic.com")
    expect(url.pathname).toBe(`/v1/apps/${APP_ID}/decision-tasks`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "available",
      limit: "25",
      cursor: "next-page",
    })
    expect(init.method).toBe("GET")
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer decide-key")
    expect(result.isError).toBeUndefined()
    expect(JSON.parse(result.content[0]?.text ?? "").data[0].run_id).toBe(RUN_ID)
  })

  it("drops undefined list filters from the query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }))
    vi.stubGlobal("fetch", fetchMock)

    await handleListDecisionTasks(() => "t", undefined, { app_id: APP_ID })

    expect(new URL(call(fetchMock)[0]).search).toBe("")
  })

  it("claims with an empty POST and returns the decision bundle as structured content", async () => {
    const bundle = {
      task: { id: TASK_ID, status: "claimed", execution_epoch: 2 },
      output_contract: { type: "object" },
      precedents: [],
      package: {
        package_kind: "records",
        record_count: 3,
        page_size: 500,
        first_cursor: "eyJvZmZzZXQiOjB9",
        documents: [],
      },
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(bundle))
    vi.stubGlobal("fetch", fetchMock)

    const result = await handleClaimDecisionTask(() => "t", "https://staging.example", {
      task_id: TASK_ID,
    })

    const [url, init] = call(fetchMock)
    expect(url).toBe(`https://staging.example/v1/decision-tasks/${TASK_ID}/claim`)
    expect(init.method).toBe("POST")
    expect(init.body).toBeUndefined()
    expect(new Headers(init.headers).get("content-type")).toBeNull()
    expect(result["structuredContent"]).toEqual(bundle)
  })

  it("reads package pages with the opaque cursor and limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        task_id: TASK_ID,
        run_id: RUN_ID,
        record_count: 3,
        page_size: 2,
        data: [],
        pagination: { has_more: false, next_cursor: null },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await handleReadDecisionPackage(() => "t", undefined, { task_id: TASK_ID })
    await handleReadDecisionPackage(() => "t", undefined, {
      task_id: TASK_ID,
      cursor: "eyJvZmZzZXQiOjJ9",
      limit: 2,
    })

    const first = new URL(call(fetchMock, 0)[0])
    expect(first.pathname).toBe(`/v1/decision-tasks/${TASK_ID}/package`)
    expect(first.search).toBe("")
    expect(call(fetchMock, 0)[1].method).toBe("GET")

    const second = new URL(call(fetchMock, 1)[0])
    expect(Object.fromEntries(second.searchParams)).toEqual({
      cursor: "eyJvZmZzZXQiOjJ9",
      limit: "2",
    })
  })

  it("heartbeats and releases with only the execution epoch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: TASK_ID, execution_epoch: 3 }))
    vi.stubGlobal("fetch", fetchMock)

    await handleHeartbeatDecisionTask(() => "t", undefined, {
      task_id: TASK_ID,
      execution_epoch: 3,
    })
    await handleReleaseDecisionTask(() => "t", undefined, {
      task_id: TASK_ID,
      execution_epoch: 3,
    })

    for (const [index, suffix] of [
      [0, "heartbeat"],
      [1, "release"],
    ] as const) {
      const [url, init] = call(fetchMock, index)
      expect(url).toBe(`https://api.talonic.com/v1/decision-tasks/${TASK_ID}/${suffix}`)
      expect(init.method).toBe("POST")
      expect(new Headers(init.headers).get("content-type")).toBe("application/json")
      expect(JSON.parse(String(init.body))).toEqual({ execution_epoch: 3 })
    }
  })

  it("submits the decision envelope without renaming fields and omits absent optionals", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: TASK_ID, status: "submitted" }))
    vi.stubGlobal("fetch", fetchMock)

    await handleSubmitDecisionTask(() => "t", undefined, {
      task_id: TASK_ID,
      execution_epoch: 4,
      outcome: { approve: true, amount: 12.5 },
      evidence: ["dp:abc:invoice_total", "db:conn:invoices:17:total"],
      rationale: "Total matches the purchase order.",
    })
    await handleSubmitDecisionTask(() => "t", undefined, {
      task_id: TASK_ID,
      execution_epoch: 4,
      outcome: { subjects: [] },
      evidence: [],
      rationale: "round closed by talonic-mcp",
      confidence: 0.9,
      service_version: "talonic-mcp/0.1.76",
    })

    expect(call(fetchMock, 0)[0]).toBe(
      `https://api.talonic.com/v1/decision-tasks/${TASK_ID}/submit`,
    )
    expect(JSON.parse(String(call(fetchMock, 0)[1].body))).toEqual({
      execution_epoch: 4,
      outcome: { approve: true, amount: 12.5 },
      evidence: ["dp:abc:invoice_total", "db:conn:invoices:17:total"],
      rationale: "Total matches the purchase order.",
    })
    expect(JSON.parse(String(call(fetchMock, 1)[1].body))).toEqual({
      execution_epoch: 4,
      outcome: { subjects: [] },
      evidence: [],
      rationale: "round closed by talonic-mcp",
      confidence: 0.9,
      service_version: "talonic-mcp/0.1.76",
    })
  })

  it("fails with the epoch and the reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: TASK_ID, status: "failed" }))
    vi.stubGlobal("fetch", fetchMock)

    await handleFailDecisionTask(() => "t", undefined, {
      task_id: TASK_ID,
      execution_epoch: 5,
      reason: "The package contradicts itself on the counterparty.",
    })

    const [url, init] = call(fetchMock)
    expect(url).toBe(`https://api.talonic.com/v1/decision-tasks/${TASK_ID}/fail`)
    expect(JSON.parse(String(init.body))).toEqual({
      execution_epoch: 5,
      reason: "The package contradicts itself on the counterparty.",
    })
  })

  it("surfaces the platform's grant, conflict and verification refusals verbatim", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: "forbidden", reason: "decide_grant_required" }, 403),
      )
      .mockResolvedValueOnce(jsonResponse({ message: "stale epoch" }, 409))
      .mockResolvedValueOnce(
        jsonResponse(
          { message: "An evidence block is required: cite the input-package references" },
          422,
        ),
      )
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
    vi.stubGlobal("fetch", fetchMock)

    const forbidden = await handleListDecisionTasks(() => "oauth", undefined, { app_id: APP_ID })
    const conflict = await handleHeartbeatDecisionTask(() => "t", undefined, {
      task_id: TASK_ID,
      execution_epoch: 1,
    })
    const rejected = await handleSubmitDecisionTask(() => "t", undefined, {
      task_id: TASK_ID,
      execution_epoch: 1,
      outcome: {},
      evidence: [],
      rationale: "x",
    })
    const network = await handleClaimDecisionTask(() => "t", undefined, { task_id: TASK_ID })

    expect(forbidden.isError).toBe(true)
    expect(forbidden.content[0]?.text).toContain("HTTP 403")
    expect(forbidden.content[0]?.text).toContain("decide_grant_required")
    expect(conflict.isError).toBe(true)
    expect(conflict.content[0]?.text).toContain("HTTP 409")
    expect(rejected.isError).toBe(true)
    expect(rejected.content[0]?.text).toContain("HTTP 422")
    expect(rejected.content[0]?.text).toContain("evidence block is required")
    expect(network.isError).toBe(true)
    expect(network.content[0]?.text).toContain("ECONNREFUSED")
  })
})

describe("decision-task registration", () => {
  const server = createServer({ apiKey: "tlnc_test" }) as any

  it.each([
    "talonic_list_decision_tasks",
    "talonic_claim_decision_task",
    "talonic_read_decision_package",
    "talonic_heartbeat_decision_task",
    "talonic_submit_decision_task",
    "talonic_release_decision_task",
    "talonic_fail_decision_task",
  ])("%s is always registered and names the decide grant", (name) => {
    const tool = server._registeredTools[name]
    expect(tool).toBeDefined()
    expect(tool.description).toContain("decide")
    expect(tool.description).toContain("decide_grant_required")
  })

  it("requires evidence and rationale on submit and caps the package page at 2000", () => {
    const submit = server._registeredTools["talonic_submit_decision_task"].inputSchema
    expect(submit.safeParse({ task_id: TASK_ID, execution_epoch: 1, outcome: {} }).success).toBe(
      false,
    )
    expect(
      submit.safeParse({
        task_id: TASK_ID,
        execution_epoch: 1,
        outcome: { ok: true },
        evidence: [],
        rationale: "because",
      }).success,
    ).toBe(true)

    const pkg = server._registeredTools["talonic_read_decision_package"].inputSchema
    expect(pkg.safeParse({ task_id: TASK_ID, limit: 2000 }).success).toBe(true)
    expect(pkg.safeParse({ task_id: TASK_ID, limit: 2001 }).success).toBe(false)
  })
})

describe("decide-scope listing", () => {
  it("reads apps:decide from an OAuth token's scopes and fails open otherwise", () => {
    expect(tokenHasDecideScope("tlnc_anything")).toBe(true)
    expect(tokenHasDecideScope(fakeOAuthToken(["documents:read", "apps:decide"]))).toBe(true)
    expect(tokenHasDecideScope(fakeOAuthToken(["documents:read", "extract:write"]))).toBe(false)
    // No scopes claim, not a JWT, or undecodable payload: the platform decides.
    expect(tokenHasDecideScope(fakeOAuthToken(undefined))).toBe(true)
    expect(tokenHasDecideScope("opaque-token")).toBe(true)
    expect(tokenHasDecideScope("a.!!!.c")).toBe(true)
  })

  it("marks the seven tools non-invocable without hiding them or blocking the handler", async () => {
    // Stub fetch BEFORE createServer: createServer binds its tagged fetch's
    // `baseFetch` default from the global `fetch` at call time (see
    // makeTaggedFetch), and registerDecisionTaskTools is wired with `rawToken`
    // (withFetch-wrapped) for surface-tagging consistency with the other
    // raw-fetch tool registrations, so a late stub would never be seen.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }))
    vi.stubGlobal("fetch", fetchMock)
    const marked = createServer({ apiKey: "tlnc_test", decisionTasksInvocable: false }) as any
    const plain = createServer({ apiKey: "tlnc_test" }) as any
    for (const name of [
      "talonic_list_decision_tasks",
      "talonic_claim_decision_task",
      "talonic_read_decision_package",
      "talonic_heartbeat_decision_task",
      "talonic_submit_decision_task",
      "talonic_release_decision_task",
      "talonic_fail_decision_task",
    ]) {
      expect(
        marked._registeredTools[name].description.startsWith("NOT INVOCABLE IN THIS SESSION"),
      ).toBe(true)
      expect(marked._registeredTools[name].description).toContain("apps:decide")
      expect(marked._registeredTools[name]._meta).toEqual({
        "talonic/can_invoke": false,
        "talonic/required_scope": "apps:decide",
      })
      expect(plain._registeredTools[name].description).not.toContain("NOT INVOCABLE")
      expect(plain._registeredTools[name]._meta).toBeUndefined()
    }
    // Other tools are untouched by the marker.
    expect(marked._registeredTools["talonic_list_agent_tasks"].description).not.toContain(
      "NOT INVOCABLE",
    )

    // The handler still forwards: the platform, not the listing, is the boundary.
    const result = await marked._registeredTools["talonic_list_decision_tasks"].handler({
      app_id: APP_ID,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.isError).toBeUndefined()
  })
})
