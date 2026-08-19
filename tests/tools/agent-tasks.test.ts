import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleAdminClaimAgentTask,
  handleAdminGetAgentTask,
  handleAdminHeartbeatAgentTask,
  handleAdminListAgentTasks,
  handleAdminSubmitAgentTask,
  handleClaimAgentTask,
  handleGetAgentTask,
  handleHeartbeatAgentTask,
  handleListAgentTasks,
  handleSubmitAgentTask,
  probeAgentTaskAdminAccess,
} from "../../src/tools/agent-tasks"
import { createServer } from "../../src/server-factory"
import { adminAgentTaskAccessCached } from "../../src/http-server"

const TASK_ID = "11111111-1111-4111-8111-111111111111"
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222"

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

describe("tenant Agent-task handlers", () => {
  it("lists with cursor filters and the current bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ id: TASK_ID }],
        pagination: { has_more: false, next_cursor: null },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await handleListAgentTasks(() => "oauth-token", undefined, {
      status: "available",
      limit: 25,
      cursor: "next-page",
    })

    const [rawUrl, init] = call(fetchMock)
    const url = new URL(rawUrl)
    expect(url.pathname).toBe("/v1/agent-tasks")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: "available",
      limit: "25",
      cursor: "next-page",
    })
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer oauth-token")
    expect(result.isError).toBeUndefined()
    expect(JSON.parse(result.content[0]?.text ?? "").data[0].id).toBe(TASK_ID)
  })

  it("fetches and claims the expected task routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: TASK_ID }))
    vi.stubGlobal("fetch", fetchMock)

    await handleGetAgentTask(() => "t", "https://staging.example/", { task_id: TASK_ID })
    await handleClaimAgentTask(() => "t", "https://staging.example/", { task_id: TASK_ID })

    expect(call(fetchMock, 0)[0]).toBe(`https://staging.example/v1/agent-tasks/${TASK_ID}`)
    expect(call(fetchMock, 0)[1].method).toBe("GET")
    expect(call(fetchMock, 1)[0]).toBe(`https://staging.example/v1/agent-tasks/${TASK_ID}/claim`)
    expect(call(fetchMock, 1)[1].method).toBe("POST")
    expect(call(fetchMock, 1)[1].body).toBeUndefined()
  })

  it("heartbeats with only the execution epoch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: TASK_ID, execution_epoch: 3 }))
    vi.stubGlobal("fetch", fetchMock)

    await handleHeartbeatAgentTask(() => "t", undefined, {
      task_id: TASK_ID,
      execution_epoch: 3,
    })

    const [url, init] = call(fetchMock)
    expect(url).toBe(`https://api.talonic.com/v1/agent-tasks/${TASK_ID}/heartbeat`)
    expect(init.method).toBe("POST")
    expect(JSON.parse(String(init.body))).toEqual({ execution_epoch: 3 })
  })

  it("submits the declared output envelope without renaming fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: TASK_ID, status: "submitted" }))
    vi.stubGlobal("fetch", fetchMock)

    await handleSubmitAgentTask(() => "t", undefined, {
      task_id: TASK_ID,
      execution_epoch: 4,
      outputs: {
        amount: { value: 12.5, confidence: 0.8, reasoning: "Matched the total." },
        verified: { value: true },
      },
      summary: "Verified",
    })

    const [, init] = call(fetchMock)
    expect(JSON.parse(String(init.body))).toEqual({
      execution_epoch: 4,
      outputs: {
        amount: { value: 12.5, confidence: 0.8, reasoning: "Matched the total." },
        verified: { value: true },
      },
      summary: "Verified",
    })
  })

  it("surfaces API and network errors as MCP tool errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "stale epoch" }, 409))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
    vi.stubGlobal("fetch", fetchMock)

    const conflict = await handleClaimAgentTask(() => "t", undefined, { task_id: TASK_ID })
    const network = await handleGetAgentTask(() => "t", undefined, { task_id: TASK_ID })

    expect(conflict.isError).toBe(true)
    expect(conflict.content[0]?.text).toContain("HTTP 409")
    expect(conflict.content[0]?.text).toContain("stale epoch")
    expect(network.isError).toBe(true)
    expect(network.content[0]?.text).toContain("ECONNREFUSED")
  })
})

describe("admin Agent-task handlers", () => {
  it("lists cross-tenant metadata with customerId=all by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }))
    vi.stubGlobal("fetch", fetchMock)

    await handleAdminListAgentTasks(() => "admin", undefined, { status: "claimed" })

    const [rawUrl, init] = call(fetchMock)
    const url = new URL(rawUrl)
    expect(url.pathname).toBe("/v1/agent-tasks/admin/tasks")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      customerId: "all",
      status: "claimed",
    })
    expect(new Headers(init.headers).get("x-step-up-code")).toBeNull()
  })

  it("maps tenant, reason, and TOTP to payload query and headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: TASK_ID }))
    vi.stubGlobal("fetch", fetchMock)
    const access = {
      customer_id: CUSTOMER_ID,
      reason: "Investigate stuck customer run",
      totp_code: "123456",
    }

    await handleAdminGetAgentTask(() => "admin", undefined, { task_id: TASK_ID, ...access })
    await handleAdminClaimAgentTask(() => "admin", undefined, { task_id: TASK_ID, ...access })

    for (const index of [0, 1]) {
      const [rawUrl, init] = call(fetchMock, index)
      expect(new URL(rawUrl).searchParams.get("customerId")).toBe(CUSTOMER_ID)
      const headers = new Headers(init.headers)
      expect(headers.get("x-talonic-reason")).toBe(access.reason)
      expect(headers.get("x-step-up-code")).toBe(access.totp_code)
    }
    expect(call(fetchMock, 1)[1].method).toBe("POST")
  })

  it("uses explicit-tenant admin heartbeat and submit routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: TASK_ID }))
    vi.stubGlobal("fetch", fetchMock)
    const access = { customer_id: CUSTOMER_ID, reason: "Customer escalation", totp_code: "654321" }

    await handleAdminHeartbeatAgentTask(() => "admin", undefined, {
      task_id: TASK_ID,
      execution_epoch: 7,
      ...access,
    })
    await handleAdminSubmitAgentTask(() => "admin", undefined, {
      task_id: TASK_ID,
      execution_epoch: 7,
      outputs: { approved: { value: true } },
      ...access,
    })

    expect(new URL(call(fetchMock, 0)[0]).pathname).toBe(
      `/v1/agent-tasks/admin/tasks/${TASK_ID}/heartbeat`,
    )
    expect(JSON.parse(String(call(fetchMock, 0)[1].body))).toEqual({ execution_epoch: 7 })
    expect(new URL(call(fetchMock, 1)[0]).pathname).toBe(
      `/v1/agent-tasks/admin/tasks/${TASK_ID}/submit`,
    )
    expect(JSON.parse(String(call(fetchMock, 1)[1].body))).toEqual({
      execution_epoch: 7,
      outputs: { approved: { value: true } },
    })
  })
})

describe("conditional admin registration", () => {
  it("probes the platform access endpoint and fails closed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ message: "forbidden" }, 403))
      .mockRejectedValueOnce(new Error("timeout"))
    vi.stubGlobal("fetch", fetchMock)

    await expect(probeAgentTaskAdminAccess("admin-token")).resolves.toBe(true)
    await expect(probeAgentTaskAdminAccess("customer-token")).resolves.toBe(false)
    await expect(probeAgentTaskAdminAccess("offline-token")).resolves.toBe(false)
    expect(call(fetchMock, 0)[0]).toBe("https://api.talonic.com/v1/agent-tasks/admin/access")
  })

  it("caches both positive and negative probes per token within the TTL", async () => {
    const probe = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await expect(adminAgentTaskAccessCached("agent-admin-cache-a", probe)).resolves.toBe(true)
    await expect(adminAgentTaskAccessCached("agent-admin-cache-a", probe)).resolves.toBe(true)
    await expect(adminAgentTaskAccessCached("agent-customer-cache-a", probe)).resolves.toBe(false)
    await expect(adminAgentTaskAccessCached("agent-customer-cache-a", probe)).resolves.toBe(false)
    expect(probe).toHaveBeenCalledTimes(2)
  })

  it("re-probes after the five-minute TTL", async () => {
    const probe = vi.fn().mockResolvedValue(true)
    let time = 1_000_000
    const now = () => time

    await adminAgentTaskAccessCached("agent-expiry-cache-a", probe, now)
    time += 5 * 60 * 1000 + 1
    await adminAgentTaskAccessCached("agent-expiry-cache-a", probe, now)
    expect(probe).toHaveBeenCalledTimes(2)
  })

  it("always registers tenant tools and conditionally registers admin variants", () => {
    const withoutAdmin = createServer({ apiKey: "tlnc_test" }) as any
    const withAdmin = createServer({
      apiKey: "tlnc_test",
      includeAdminAgentTaskTools: true,
    }) as any

    expect(withoutAdmin._registeredTools["talonic_list_agent_tasks"]).toBeDefined()
    expect(withoutAdmin._registeredTools["talonic_submit_agent_task"]).toBeDefined()
    expect(withoutAdmin._registeredTools["talonic_admin_list_agent_tasks"]).toBeUndefined()
    expect(withAdmin._registeredTools["talonic_admin_list_agent_tasks"]).toBeDefined()
    expect(withAdmin._registeredTools["talonic_admin_submit_agent_task"]).toBeDefined()
  })
})
