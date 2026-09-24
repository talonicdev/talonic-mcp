import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, runTool } from "./_http.js"
import type { ToolResult } from "./_shared.js"
import { widgetToolMeta, type WidgetKey } from "../widgets/types.js"

/**
 * External-mode decision-task tools (platform `docs/APPS-SPEC.md` §B4).
 *
 * An External-mode app parks each run as a decision task: the claimant takes
 * an exclusive lease, reads the run's frozen input package in pages, and
 * closes the run with submit / release / fail. Every route is `decide`-tiered
 * on the platform: a `tlnc_` workspace API key admits on a per-app `decide`
 * grant; an OAuth session admits on the `apps:decide` scope (consented in
 * person at connect time, never pre-consented) plus a live workspace role of
 * `senior_member` or above (platform spec
 * `2026-09-22-decide-for-oauth-sessions-design.md`). Web sessions are refused.
 * The platform re-authorizes every call; these wrappers never gate anything
 * themselves. The one thing they do locally is LISTING: a hosted session whose
 * token visibly lacks the scope gets the tools marked non-invocable (§3.6 of
 * that spec) so an agent explains the missing consent instead of hitting 403.
 */

/** The OAuth scope the platform's `decide` tier requires of a session token. */
export const DECIDE_SCOPE = "apps:decide"

/**
 * Whether the tools should be listed as invocable for this credential.
 *
 * A `tlnc_` key is governed by per-app grants the server cannot see, so it is
 * always listed as invocable. An OAuth access token is a JWT whose payload
 * carries `scopes` in OAuth form; a token that decodes and visibly lacks
 * `apps:decide` is not invocable. Anything undecodable resolves true: this is
 * listing UX only, and the platform remains the boundary.
 *
 * @internal Exported for unit testing and the hosted entrypoint.
 */
export function tokenHasDecideScope(token: string): boolean {
  if (token.startsWith("tlnc_")) return true
  const parts = token.split(".")
  if (parts.length !== 3) return true
  try {
    const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8")) as {
      scopes?: unknown
    }
    if (!Array.isArray(payload.scopes)) return true
    return payload.scopes.includes(DECIDE_SCOPE)
  } catch {
    return true
  }
}

const TASK_STATUSES = [
  "available",
  "claimed",
  "submitted",
  "released",
  "failed",
  "timed_out",
  "cancelled",
] as const

/** Platform default for `apps.package_page_size_max`; a larger `limit` is a 400 there. */
const PACKAGE_PAGE_LIMIT_MAX = 2000

const appId = z.string().uuid().describe("App UUID whose decision-task inbox to read.")
const taskId = z.string().uuid().describe("Decision task UUID.")
const executionEpoch = z
  .number()
  .int()
  .min(1)
  .max(2_147_483_647)
  .describe("Execution epoch returned by the successful claim. Stale epochs are rejected with 409.")
const status = z.enum(TASK_STATUSES).optional().describe("Optional task-status filter.")
const listLimit = z.number().int().min(1).max(100).optional().describe("Page size (default 50).")
const cursor = z.string().min(1).optional().describe("Opaque cursor from pagination.next_cursor.")

const packageCursor = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Opaque package cursor: package.first_cursor from the claim, then pagination.next_cursor. Omit for the first page.",
  )
const packageLimit = z
  .number()
  .int()
  .min(1)
  .max(PACKAGE_PAGE_LIMIT_MAX)
  .optional()
  .describe(
    `Records per page, 1 to ${PACKAGE_PAGE_LIMIT_MAX}. Defaults to the platform page size (package.page_size from the claim).`,
  )

const outcome = z
  .record(z.string(), z.json())
  .describe(
    "The decision, shaped by output_contract from the claim: for a plain JSON Schema contract the object that schema validates; for a verdict_matrix contract { subjects: [{ subject_key, rule_outcomes, auto?, detail? }] }; for a record_set contract its fields-and-rows envelope.",
  )
const evidence = z
  .array(z.string().min(1).max(512))
  .max(10_000)
  .describe(
    "Provenance locators the decision relied on, each copied verbatim from the input package (or a db:/ref: locator the app holds a read grant on). Required; [] is accepted only when the app allows unevidenced decisions.",
  )
const rationale = z
  .string()
  .min(1)
  .max(4000)
  .describe(
    "Short decision rationale (a summary, never private chain-of-thought), up to 4,000 characters.",
  )
const confidence = z.number().min(0).max(1).optional().describe("Optional confidence from 0 to 1.")
const serviceVersion = z
  .string()
  .min(1)
  .max(64)
  .optional()
  .describe("Optional build identifier of the deciding service; recorded as decided_by.label.")
const failReason = z
  .string()
  .min(1)
  .max(2000)
  .describe(
    "Why the task cannot be decided, up to 2,000 characters. Recorded on the Human Review the fail raises.",
  )

const listInput = { app_id: appId, status, limit: listLimit, cursor }
const idInput = { task_id: taskId }
const packageInput = { task_id: taskId, cursor: packageCursor, limit: packageLimit }
const epochInput = { task_id: taskId, execution_epoch: executionEpoch }
const submitInput = {
  task_id: taskId,
  execution_epoch: executionEpoch,
  outcome,
  evidence,
  rationale,
  confidence,
  service_version: serviceVersion,
}
const failInput = { task_id: taskId, execution_epoch: executionEpoch, reason: failReason }

export interface ListDecisionTasksArgs {
  app_id: string
  status?: (typeof TASK_STATUSES)[number]
  limit?: number
  cursor?: string
}

export interface DecisionTaskIdArgs {
  task_id: string
}

export interface ReadDecisionPackageArgs extends DecisionTaskIdArgs {
  cursor?: string
  limit?: number
}

export interface DecisionTaskEpochArgs extends DecisionTaskIdArgs {
  execution_epoch: number
}

export interface SubmitDecisionTaskArgs extends DecisionTaskEpochArgs {
  outcome: Record<string, unknown>
  evidence: string[]
  rationale: string
  confidence?: number
  service_version?: string
}

export interface FailDecisionTaskArgs extends DecisionTaskEpochArgs {
  reason: string
}

function taskPath(taskId: string, suffix = ""): string {
  return `/v1/decision-tasks/${encodeURIComponent(taskId)}${suffix}`
}

/** @internal Exported for unit testing. */
export function handleListDecisionTasks(
  getToken: () => string,
  baseUrl: string | undefined,
  args: ListDecisionTasksArgs,
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "GET",
      `/v1/apps/${encodeURIComponent(args.app_id)}/decision-tasks`,
      {
        params: { status: args.status, limit: args.limit, cursor: args.cursor },
      },
    ),
  )
}

/** @internal Exported for unit testing. */
export function handleClaimDecisionTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: DecisionTaskIdArgs,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "POST", taskPath(args.task_id, "/claim")))
}

/** @internal Exported for unit testing. */
export function handleReadDecisionPackage(
  getToken: () => string,
  baseUrl: string | undefined,
  args: ReadDecisionPackageArgs,
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", taskPath(args.task_id, "/package"), {
      params: { cursor: args.cursor, limit: args.limit },
    }),
  )
}

/** @internal Exported for unit testing. */
export function handleHeartbeatDecisionTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: DecisionTaskEpochArgs,
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", taskPath(args.task_id, "/heartbeat"), {
      body: { execution_epoch: args.execution_epoch },
    }),
  )
}

/** @internal Exported for unit testing. */
export function handleSubmitDecisionTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: SubmitDecisionTaskArgs,
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", taskPath(args.task_id, "/submit"), {
      body: {
        execution_epoch: args.execution_epoch,
        outcome: args.outcome,
        evidence: args.evidence,
        rationale: args.rationale,
        ...(args.confidence === undefined ? {} : { confidence: args.confidence }),
        ...(args.service_version === undefined ? {} : { service_version: args.service_version }),
      },
    }),
  )
}

/** @internal Exported for unit testing. */
export function handleReleaseDecisionTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: DecisionTaskEpochArgs,
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", taskPath(args.task_id, "/release"), {
      body: { execution_epoch: args.execution_epoch },
    }),
  )
}

/** @internal Exported for unit testing. */
export function handleFailDecisionTask(
  getToken: () => string,
  baseUrl: string | undefined,
  args: FailDecisionTaskArgs,
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", taskPath(args.task_id, "/fail"), {
      body: { execution_epoch: args.execution_epoch, reason: args.reason },
    }),
  )
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

const AUTH_NOTE =
  "AUTH: a tlnc_ key needs a per-app 'decide' grant; an OAuth connector session needs the apps:decide scope (consented at connect) and a live workspace role of senior_member or above. A 403 (decide_grant_required, insufficient_scope, insufficient_tier) names what is missing — tell the user, do not retry."

/** Options for {@link registerDecisionTaskTools}. */
export interface DecisionTaskToolOptions {
  /**
   * `false` lists the seven tools marked non-invocable via
   * `_meta["talonic/can_invoke"]: false` (+ `talonic/required_scope`).
   * Descriptions never change per session: directory scanners and clients
   * that cache `tools/list` must see the same text as an authorised
   * session, and each description's AUTH line already tells the agent what
   * a 403 means. Handlers still forward to the platform, which decides.
   * Defaults to true.
   */
  invocable?: boolean
}

const DESCRIPTIONS = {
  list: [
    "List one External-mode app's decision tasks (runs parked for an outside agent to decide), newest first.",
    "",
    "USE WHEN: looking for decisions to make for an app; begin with status 'available'. This is the polling alternative to the app.decision_task.offered webhook.",
    "NOT FOR: Agent-stage document tasks (use talonic_list_agent_tasks), reading a task's input package (claim it, then talonic_read_decision_package), or taking a lease (talonic_claim_decision_task).",
    "ARGS: app_id, optional status, limit, cursor. RETURNS: task metadata only (id, run_id, status, execution_epoch, lease and sla_deadline_at timing) plus pagination.next_cursor.",
    AUTH_NOTE,
  ].join("\n"),
  claim: [
    "Claim an available decision task (or reclaim one whose lease expired) and receive the decision bundle: task metadata with the new execution_epoch, output_contract, precedents, and a package descriptor { package_kind, record_count, page_size, first_cursor, documents }.",
    "",
    "USE WHEN: ready to decide a listed task. There is no separate get: claiming IS the payload fetch. Save execution_epoch and lease_expires_at; then read the records with talonic_read_decision_package starting at first_cursor (null means the package has no records).",
    "NOT FOR: extending a live lease (talonic_heartbeat_decision_task) or returning a decision (talonic_submit_decision_task). A conflicting live claim returns HTTP 409.",
    AUTH_NOTE,
  ].join("\n"),
  package: [
    "Read one page of a claimed decision task's frozen input package: the records the decision must be made from, with their provenance locators. Only the current claimant may read it; each page read is journaled onto the run.",
    "",
    "USE WHEN: after a successful claim, walking pages from package.first_cursor while pagination.has_more is true. The first page also carries the source documents list. A mining_round package is one record { system_prompt, first_turn, tools }.",
    "NOT FOR: unclaimed tasks (HTTP 409; claim first) or listing tasks (talonic_list_decision_tasks).",
    "ARGS: task_id, optional cursor and limit (1 to 2000). Copy evidence locators verbatim from these records for the submit.",
    AUTH_NOTE,
  ].join("\n"),
  heartbeat: [
    "Extend the lease on a claimed decision task, never past its sla_deadline_at.",
    "",
    "USE WHEN: deciding may run past lease_expires_at; heartbeat before expiry using the epoch from claim.",
    "NOT FOR: acquiring a task (talonic_claim_decision_task) or finishing one (talonic_submit_decision_task / talonic_release_decision_task / talonic_fail_decision_task).",
    "ARGS: task_id and execution_epoch. A stale or foreign epoch returns HTTP 409: stop, discard the work, and re-list.",
    AUTH_NOTE,
  ].join("\n"),
  submit: [
    "Submit the decision for a claimed decision task; the platform verifies it transactionally and resumes the run.",
    "",
    "USE WHEN: the decision is final. outcome must satisfy output_contract from the claim (plain JSON Schema, or the verdict_matrix / record_set envelope), evidence lists the package locators relied on (verbatim; [] only if the app allows unevidenced decisions), rationale is a short summary. Rejections are HTTP 422 with the reason and change nothing; the task stays claimed under your epoch, so fix and resubmit before the lease ends.",
    "NOT FOR: giving the task back undecided (talonic_release_decision_task) or declaring it undecidable (talonic_fail_decision_task). Stale epoch is HTTP 409.",
    "ARGS: task_id, execution_epoch, outcome, evidence, rationale, optional confidence and service_version.",
    AUTH_NOTE,
  ].join("\n"),
  release: [
    "Release a claimed decision task back to 'available' without deciding it; the next claim bumps the epoch.",
    "",
    "USE WHEN: you cannot finish within the lease or SLA but another claimant could decide it.",
    "NOT FOR: declaring the task undecidable (talonic_fail_decision_task, which raises a review and applies the app's fallback) or keeping the lease (talonic_heartbeat_decision_task).",
    "ARGS: task_id and execution_epoch. Stale epoch is HTTP 409.",
    AUTH_NOTE,
  ].join("\n"),
  fail: [
    "Report that the claimed decision task cannot be decided: raises a Human Review with your reason AND applies the app's declared fallback policy (rules decide, hold for review, or fail the run).",
    "",
    "USE WHEN: the package is insufficient or contradictory and no claimant could decide it. This ends the task (status 'failed').",
    "NOT FOR: temporary give-backs (talonic_release_decision_task) or a decision you can make with low confidence (submit it with confidence set).",
    "ARGS: task_id, execution_epoch, reason (up to 2,000 characters). Stale epoch is HTTP 409.",
    AUTH_NOTE,
  ].join("\n"),
} as const

/** Register the seven tenant-scoped decision-task tools. */
export function registerDecisionTaskTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
  options: DecisionTaskToolOptions = {},
): void {
  const invocable = options.invocable !== false
  const metaFor = (key: WidgetKey): { _meta: Record<string, unknown> } => ({
    _meta: {
      ...widgetToolMeta(key),
      ...(invocable ? {} : { "talonic/can_invoke": false, "talonic/required_scope": DECIDE_SCOPE }),
    },
  })

  server.registerTool(
    "talonic_list_decision_tasks",
    {
      title: "List Decision Tasks",
      description: DESCRIPTIONS.list,
      inputSchema: listInput,
      annotations: { title: "List Decision Tasks", ...READ_ONLY },
      ...metaFor("listDecisionTasks"),
    },
    async (args: ListDecisionTasksArgs) => handleListDecisionTasks(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_claim_decision_task",
    {
      title: "Claim Decision Task",
      description: DESCRIPTIONS.claim,
      inputSchema: idInput,
      annotations: { title: "Claim Decision Task", ...MUTATING },
      ...metaFor("claimDecisionTask"),
    },
    async (args: DecisionTaskIdArgs) => handleClaimDecisionTask(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_read_decision_package",
    {
      title: "Read Decision Package",
      description: DESCRIPTIONS.package,
      inputSchema: packageInput,
      annotations: { title: "Read Decision Package", ...READ_ONLY },
      ...metaFor("readDecisionPackage"),
    },
    async (args: ReadDecisionPackageArgs) => handleReadDecisionPackage(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_heartbeat_decision_task",
    {
      title: "Heartbeat Decision Task",
      description: DESCRIPTIONS.heartbeat,
      inputSchema: epochInput,
      annotations: { title: "Heartbeat Decision Task", ...MUTATING },
      ...metaFor("heartbeatDecisionTask"),
    },
    async (args: DecisionTaskEpochArgs) => handleHeartbeatDecisionTask(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_submit_decision_task",
    {
      title: "Submit Decision Task",
      description: DESCRIPTIONS.submit,
      inputSchema: submitInput,
      annotations: { title: "Submit Decision Task", ...MUTATING },
      ...metaFor("submitDecisionTask"),
    },
    async (args: SubmitDecisionTaskArgs) => handleSubmitDecisionTask(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_release_decision_task",
    {
      title: "Release Decision Task",
      description: DESCRIPTIONS.release,
      inputSchema: epochInput,
      annotations: { title: "Release Decision Task", ...MUTATING },
      ...metaFor("releaseDecisionTask"),
    },
    async (args: DecisionTaskEpochArgs) => handleReleaseDecisionTask(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_fail_decision_task",
    {
      title: "Fail Decision Task",
      description: DESCRIPTIONS.fail,
      inputSchema: failInput,
      annotations: { title: "Fail Decision Task", ...MUTATING },
      ...metaFor("failDecisionTask"),
    },
    async (args: FailDecisionTaskArgs) => handleFailDecisionTask(getToken, baseUrl, args),
  )
}
