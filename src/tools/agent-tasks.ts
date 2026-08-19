import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

/**
 * Agent-stage worklist tools.
 *
 * The tenant tools are part of the public MCP surface. The admin variants are
 * Talonic-internal and are registered only after the platform's `/access`
 * probe passes. Conditional registration is only a visibility control: the
 * platform re-authorizes every request, and payload calls additionally require
 * an interactive OAuth principal, a named tenant, a TOTP code, and a reason.
 */

const DEFAULT_BASE = "https://api.talonic.com"
const TASK_STATUSES = ["available", "claimed", "submitted", "timed_out", "cancelled"] as const

const taskId = z.string().uuid().describe("Agent task UUID.")
const executionEpoch = z
  .number()
  .int()
  .min(1)
  .max(2_147_483_647)
  .describe("Execution epoch returned by the successful claim. Stale epochs are rejected.")
const status = z.enum(TASK_STATUSES).optional().describe("Optional task-status filter.")
const limit = z.number().int().min(1).max(100).optional().describe("Page size (default 50).")
const cursor = z.string().min(1).optional().describe("Opaque cursor from pagination.next_cursor.")

const outputValue = z.object({
  value: z.json().describe("JSON value matching the field's declared data type."),
  confidence: z.number().min(0).max(1).optional().describe("Optional confidence from 0 to 1."),
  reasoning: z
    .string()
    .max(4000)
    .optional()
    .describe("Optional concise reasoning for this field, up to 4,000 characters."),
})

const outputs = z
  .record(z.string().min(1), outputValue)
  .describe("Output field key to { value, confidence?, reasoning? }. Use only declared fields.")

const listInput = { status, limit, cursor }
const idInput = { task_id: taskId }
const heartbeatInput = { task_id: taskId, execution_epoch: executionEpoch }
const submitInput = {
  task_id: taskId,
  execution_epoch: executionEpoch,
  outputs,
  summary: z
    .string()
    .max(4000)
    .optional()
    .describe("Optional result summary, up to 4,000 characters."),
}

const adminCustomerId = z
  .string()
  .uuid()
  .describe("Explicit customer/workspace UUID. Payload calls never accept 'all'.")
const adminReason = z
  .string()
  .min(1)
  .max(1000)
  .describe("Human-readable reason recorded with the cross-tenant access.")
const adminTotp = z
  .string()
  .regex(/^\d{6}$/, "TOTP code must contain exactly 6 digits")
  .describe("Fresh 6-digit TOTP code for step-up authorization.")
const adminPayloadAccessInput = {
  customer_id: adminCustomerId,
  reason: adminReason,
  totp_code: adminTotp,
}

export interface ListAgentTasksArgs {
  status?: (typeof TASK_STATUSES)[number]
  limit?: number
  cursor?: string
}

export interface AgentTaskIdArgs {
  task_id: string
}

export interface HeartbeatAgentTaskArgs extends AgentTaskIdArgs {
  execution_epoch: number
}

export interface AgentTaskOutput {
  value: unknown
  confidence?: number
  reasoning?: string
}

export interface SubmitAgentTaskArgs extends HeartbeatAgentTaskArgs {
  outputs: Record<string, AgentTaskOutput>
  summary?: string
}

export interface AdminListAgentTasksArgs extends ListAgentTasksArgs {
  customer_id?: string
}

export interface AdminPayloadAccessArgs {
  customer_id: string
  reason: string
  totp_code: string
}

export type AdminAgentTaskIdArgs = AgentTaskIdArgs & AdminPayloadAccessArgs
export type AdminHeartbeatAgentTaskArgs = HeartbeatAgentTaskArgs & AdminPayloadAccessArgs
export type AdminSubmitAgentTaskArgs = SubmitAgentTaskArgs & AdminPayloadAccessArgs

interface ApiRequest {
  method?: "GET" | "POST"
  path: string
  query?: Record<string, string | number | undefined>
  body?: unknown
  headers?: Record<string, string>
}

function apiUrl(
  baseUrl: string | undefined,
  path: string,
  query?: Record<string, string | number | undefined>,
): string {
  const base = (baseUrl ?? DEFAULT_BASE).replace(/\/$/, "")
  const url = new URL(`${base}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value))
  }
  return url.toString()
}

async function agentTaskRequest(
  getToken: () => string,
  baseUrl: string | undefined,
  request: ApiRequest,
): Promise<ToolResult> {
  try {
    const response = await fetch(apiUrl(baseUrl, request.path, request.query), {
      method: request.method ?? "GET",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "application/json",
        ...(request.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...request.headers,
      },
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      return toolError(
        new Error(`Talonic API error: HTTP ${response.status}${body ? ` — ${body}` : ""}`),
      )
    }

    return jsonOk(await response.json())
  } catch (error) {
    return toolError(error)
  }
}

function listQuery(args: ListAgentTasksArgs): Record<string, string | number | undefined> {
  return { status: args.status, limit: args.limit, cursor: args.cursor }
}

function adminHeaders(args: AdminPayloadAccessArgs): Record<string, string> {
  return {
    "x-talonic-reason": args.reason,
    "x-step-up-code": args.totp_code,
  }
}

/** @internal Exported for unit testing. */
export function handleListAgentTasks(
  getToken: () => string,
  baseUrl: string | undefined,
  args: ListAgentTasksArgs,
): Promise<ToolResult> {
  return agentTaskRequest(getToken, baseUrl, {
    path: "/v1/agent-tasks",
    query: listQuery(args),
  })
}

/** @internal Exported for unit testing. */
export function handleGetAgentTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: AgentTaskIdArgs,
): Promise<ToolResult> {
  return agentTaskRequest(getToken, baseUrl, {
    path: `/v1/agent-tasks/${encodeURIComponent(args.task_id)}`,
  })
}

/** @internal Exported for unit testing. */
export function handleClaimAgentTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: AgentTaskIdArgs,
): Promise<ToolResult> {
  return agentTaskRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/agent-tasks/${encodeURIComponent(args.task_id)}/claim`,
  })
}

/** @internal Exported for unit testing. */
export function handleHeartbeatAgentTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: HeartbeatAgentTaskArgs,
): Promise<ToolResult> {
  return agentTaskRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/agent-tasks/${encodeURIComponent(args.task_id)}/heartbeat`,
    body: { execution_epoch: args.execution_epoch },
  })
}

/** @internal Exported for unit testing. */
export function handleSubmitAgentTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: SubmitAgentTaskArgs,
): Promise<ToolResult> {
  return agentTaskRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/agent-tasks/${encodeURIComponent(args.task_id)}/submit`,
    body: {
      execution_epoch: args.execution_epoch,
      outputs: args.outputs,
      ...(args.summary === undefined ? {} : { summary: args.summary }),
    },
  })
}

/**
 * Probe conditional superadmin tool visibility. Any rejection, network error,
 * or timeout resolves false. The platform remains the security boundary.
 */
export async function probeAgentTaskAdminAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const response = await fetch(apiUrl(baseUrl, "/v1/agent-tasks/admin/access"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return response.ok
  } catch {
    return false
  }
}

/** @internal Exported for unit testing. */
export function handleAdminListAgentTasks(
  getToken: () => string,
  baseUrl: string | undefined,
  args: AdminListAgentTasksArgs,
): Promise<ToolResult> {
  return agentTaskRequest(getToken, baseUrl, {
    path: "/v1/agent-tasks/admin/tasks",
    query: { customerId: args.customer_id ?? "all", ...listQuery(args) },
  })
}

/** @internal Exported for unit testing. */
export function handleAdminGetAgentTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: AdminAgentTaskIdArgs,
): Promise<ToolResult> {
  return agentTaskRequest(getToken, baseUrl, {
    path: `/v1/agent-tasks/admin/tasks/${encodeURIComponent(args.task_id)}`,
    query: { customerId: args.customer_id },
    headers: adminHeaders(args),
  })
}

/** @internal Exported for unit testing. */
export function handleAdminClaimAgentTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: AdminAgentTaskIdArgs,
): Promise<ToolResult> {
  return agentTaskRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/agent-tasks/admin/tasks/${encodeURIComponent(args.task_id)}/claim`,
    query: { customerId: args.customer_id },
    headers: adminHeaders(args),
  })
}

/** @internal Exported for unit testing. */
export function handleAdminHeartbeatAgentTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: AdminHeartbeatAgentTaskArgs,
): Promise<ToolResult> {
  return agentTaskRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/agent-tasks/admin/tasks/${encodeURIComponent(args.task_id)}/heartbeat`,
    query: { customerId: args.customer_id },
    headers: adminHeaders(args),
    body: { execution_epoch: args.execution_epoch },
  })
}

/** @internal Exported for unit testing. */
export function handleAdminSubmitAgentTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: AdminSubmitAgentTaskArgs,
): Promise<ToolResult> {
  return agentTaskRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/agent-tasks/admin/tasks/${encodeURIComponent(args.task_id)}/submit`,
    query: { customerId: args.customer_id },
    headers: adminHeaders(args),
    body: {
      execution_epoch: args.execution_epoch,
      outputs: args.outputs,
      ...(args.summary === undefined ? {} : { summary: args.summary }),
    },
  })
}

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const

const MUTATING = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
} as const

const DESCRIPTIONS = {
  list: [
    "List Agent-stage tasks visible to this Talonic workspace credential.",
    "",
    "USE WHEN: looking for external-agent work to process; begin with status 'available'.",
    "NOT FOR: reading the immutable task payload (use talonic_get_agent_task) or taking a lease (use talonic_claim_agent_task).",
    "ARGS: optional status, limit, and cursor. RETURNS: metadata only plus pagination.next_cursor.",
  ].join("\n"),
  get: [
    "Fetch one Agent-stage task's immutable input snapshot, instructions, and declared output contract. This disclosure is audited.",
    "",
    "USE WHEN: inspecting a listed task before deciding whether to process it.",
    "NOT FOR: acquiring the task (use talonic_claim_agent_task) or returning results (use talonic_submit_agent_task).",
    "ARGS: task_id. RETURNS: metadata, input_snapshot, output_contract, instructions, and timeout_fallthrough.",
  ].join("\n"),
  claim: [
    "Claim an available Agent-stage task, or reclaim it after its lease expires.",
    "",
    "USE WHEN: ready to process a task. Save the returned execution_epoch and lease_expires_at.",
    "NOT FOR: merely inspecting work (use talonic_get_agent_task) or extending an active lease (use talonic_heartbeat_agent_task).",
    "A conflicting live claim returns HTTP 409. A successful claim returns the task payload.",
  ].join("\n"),
  heartbeat: [
    "Extend the lease on a claimed Agent-stage task.",
    "",
    "USE WHEN: processing may continue past lease_expires_at; heartbeat before expiry using the epoch from claim.",
    "NOT FOR: acquiring a task (use talonic_claim_agent_task) or submitting finished outputs (use talonic_submit_agent_task).",
    "ARGS: task_id and execution_epoch. Stale or foreign claims return HTTP 409.",
  ].join("\n"),
  submit: [
    "Submit declared output fields for a claimed Agent-stage task and resume the parked document.",
    "",
    "USE WHEN: processing is complete and every required output in output_contract is ready.",
    "NOT FOR: undeclared fields or partial lease maintenance (use talonic_heartbeat_agent_task).",
    "ARGS: task_id, execution_epoch, outputs keyed exactly by declared field key, and optional summary. The platform validates all fields and types transactionally before writing anything.",
  ].join("\n"),
} as const

/** Register the five tenant-scoped Agent task tools. */
export function registerAgentTaskTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_list_agent_tasks",
    {
      title: "List Agent Tasks",
      description: DESCRIPTIONS.list,
      inputSchema: listInput,
      annotations: { title: "List Agent Tasks", ...READ_ONLY },
    },
    async (args: ListAgentTasksArgs) => handleListAgentTasks(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_get_agent_task",
    {
      title: "Get Agent Task",
      description: DESCRIPTIONS.get,
      inputSchema: idInput,
      annotations: { title: "Get Agent Task", ...READ_ONLY },
    },
    async (args: AgentTaskIdArgs) => handleGetAgentTask(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_claim_agent_task",
    {
      title: "Claim Agent Task",
      description: DESCRIPTIONS.claim,
      inputSchema: idInput,
      annotations: { title: "Claim Agent Task", ...MUTATING },
    },
    async (args: AgentTaskIdArgs) => handleClaimAgentTask(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_heartbeat_agent_task",
    {
      title: "Heartbeat Agent Task",
      description: DESCRIPTIONS.heartbeat,
      inputSchema: heartbeatInput,
      annotations: { title: "Heartbeat Agent Task", ...MUTATING },
    },
    async (args: HeartbeatAgentTaskArgs) => handleHeartbeatAgentTask(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_submit_agent_task",
    {
      title: "Submit Agent Task",
      description: DESCRIPTIONS.submit,
      inputSchema: submitInput,
      annotations: { title: "Submit Agent Task", ...MUTATING },
    },
    async (args: SubmitAgentTaskArgs) => handleSubmitAgentTask(getToken, baseUrl, args),
  )
}

const adminIdInput = { task_id: taskId, ...adminPayloadAccessInput }
const adminHeartbeatInput = {
  task_id: taskId,
  execution_epoch: executionEpoch,
  ...adminPayloadAccessInput,
}
const adminSubmitInput = {
  task_id: taskId,
  execution_epoch: executionEpoch,
  outputs,
  summary: z.string().max(4000).optional(),
  ...adminPayloadAccessInput,
}

/** Register Talonic-internal cross-tenant variants after the access probe passes. */
export function registerAdminAgentTaskTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_admin_list_agent_tasks",
    {
      title: "Admin: List Agent Tasks",
      description:
        "INTERNAL: list Agent-task metadata across all tenants or one named tenant. NOT FOR payload data; use talonic_admin_get_agent_task with an explicit tenant, reason, and TOTP code.",
      inputSchema: {
        customer_id: z
          .union([z.string().uuid(), z.literal("all")])
          .optional()
          .describe("Tenant UUID, or 'all' (default) for cross-tenant metadata."),
        ...listInput,
      },
      annotations: { title: "Admin: List Agent Tasks", ...READ_ONLY },
    },
    async (args: AdminListAgentTasksArgs) => handleAdminListAgentTasks(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_admin_get_agent_task",
    {
      title: "Admin: Get Agent Task",
      description:
        "INTERNAL: fetch one Agent-task payload for an explicit tenant. This audited disclosure requires interactive OAuth, a reason, and fresh TOTP. NOT FOR cross-tenant metadata listing.",
      inputSchema: adminIdInput,
      annotations: { title: "Admin: Get Agent Task", ...READ_ONLY },
    },
    async (args: AdminAgentTaskIdArgs) => handleAdminGetAgentTask(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_admin_claim_agent_task",
    {
      title: "Admin: Claim Agent Task",
      description:
        "INTERNAL: claim or reclaim one Agent task in an explicit tenant. Requires interactive OAuth, reason, and fresh TOTP. NOT FOR metadata-only access.",
      inputSchema: adminIdInput,
      annotations: { title: "Admin: Claim Agent Task", ...MUTATING },
    },
    async (args: AdminAgentTaskIdArgs) => handleAdminClaimAgentTask(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_admin_heartbeat_agent_task",
    {
      title: "Admin: Heartbeat Agent Task",
      description:
        "INTERNAL: extend one claimed Agent-task lease in an explicit tenant. Requires interactive OAuth, reason, and fresh TOTP. NOT FOR acquiring a task.",
      inputSchema: adminHeartbeatInput,
      annotations: { title: "Admin: Heartbeat Agent Task", ...MUTATING },
    },
    async (args: AdminHeartbeatAgentTaskArgs) =>
      handleAdminHeartbeatAgentTask(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_admin_submit_agent_task",
    {
      title: "Admin: Submit Agent Task",
      description:
        "INTERNAL: submit declared outputs for one claimed Agent task in an explicit tenant. Requires interactive OAuth, reason, and fresh TOTP. NOT FOR undeclared fields.",
      inputSchema: adminSubmitInput,
      annotations: { title: "Admin: Submit Agent Task", ...MUTATING },
    },
    async (args: AdminSubmitAgentTaskArgs) => handleAdminSubmitAgentTask(getToken, baseUrl, args),
  )
}
