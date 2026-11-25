import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, probeAccessState, runTool, type ProbeAnswer } from "./_http.js"
import { ApiHttpError, zUuid, type ToolResult } from "./_shared.js"
import { DECIDE_SCOPE } from "./decision-tasks.js"

/**
 * Rule-mining rounds driven by an outside agent (platform spec
 * `docs/superpowers/specs/2026-09-22-mining-external-driver-design.md` §6.3).
 *
 * An autonomous app whose objective names an external driver parks each round
 * as a decision task. The driver claims it with `talonic_claim_decision_task`,
 * reads its brief with `talonic_read_decision_package`, calls the round's tools
 * here, keeps the lease with `talonic_heartbeat_decision_task` and closes the
 * round with `talonic_submit_decision_task`. The claim/heartbeat/package/submit
 * verbs are the decision-task tools, unchanged; this file adds the three round
 * routes (`GET …/tools`, `POST …/tools/:name`, `GET …/tools/calls/:callId`,
 * tier `decide`) and the round reads/start (tiers `read` / `run`).
 *
 * The spec sketches one `mining_<tool>` wrapper per round tool. The round's
 * tool set, inputs and remaining budget are served per round by the platform
 * (`GET …/tools`), so one generic call tool forwards `name` + `input` instead
 * of a hard-coded copy that would drift from the platform's definitions. It
 * handles the two parts of the driver contract a raw REST client must do
 * itself: the 202 + poll path for a call that outlives the sync wait, and the
 * retry of `refused: "busy"` (another call is running on the round).
 *
 * Decide-tier auth is the decision-task tools' (see `decision-tasks.ts`):
 * listing marks the three decide-tier tools non-invocable for an OAuth token
 * that visibly lacks `apps:decide`; the platform decides every call.
 */

const appId = zUuid().describe(
  "Id (UUID) of an autonomous app, from talonic_list_apps where mode is 'autonomous'.",
)
const runId = zUuid().describe(
  "The round's run id (run_id from talonic_mining_list_rounds, or the decision task's run_id).",
)
const executionEpoch = z
  .number()
  .int()
  .min(1)
  .max(2_147_483_647)
  .describe("execution_epoch from talonic_claim_decision_task. A stale epoch is HTTP 409.")
const toolName = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,63}$/)
  .describe("A tool name from talonic_mining_list_round_tools.")

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const
const MUTATING = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const

type Get = () => string
type Base = string | undefined

const roundsPath = (app: string, suffix = "") =>
  `/v1/apps/${encodeURIComponent(app)}/mining/rounds${suffix}`
const roundPath = (app: string, run: string, suffix = "") =>
  roundsPath(app, `/${encodeURIComponent(run)}${suffix}`)

/** Waits between `busy` retries (ms). The platform asks for "a short wait". */
const BUSY_BACKOFF_MS = [500, 1_000, 2_000, 4_000]
/** Gap between status polls of a call answered 202 (ms). */
const POLL_INTERVAL_MS = 2_000
/** Default and ceiling for how long the call tool keeps polling a 202 call. */
const DEFAULT_WAIT_SECONDS = 25
const MAX_WAIT_SECONDS = 120

/** Injectable clock for tests. @internal */
export interface DriverTiming {
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** True when a 409 is the worker's "another call is running on this round" refusal. */
function isBusy(err: unknown): boolean {
  if (!(err instanceof ApiHttpError) || err.status !== 409) return false
  try {
    const body = JSON.parse(err.body) as {
      details?: { refused?: string }
      error?: { details?: { refused?: string } }
    }
    return (body.details?.refused ?? body.error?.details?.refused) === "busy"
  } catch {
    return /"refused"\s*:\s*"busy"/.test(err.body)
  }
}

interface CallAnswer {
  call_id?: string
  status?: string
  content?: unknown
  is_error?: boolean
  [k: string]: unknown
}

/* ------------------------------------------------------------------ */
/* Handlers (exported for unit tests)                                  */
/* ------------------------------------------------------------------ */

/** @internal */
export const handleMiningListRounds = (
  t: Get,
  b: Base,
  a: { app_id: string; limit?: number; offset?: number },
) =>
  runTool(() =>
    apiJson(t, b, "GET", roundsPath(a.app_id), { params: { limit: a.limit, offset: a.offset } }),
  )

/** @internal */
export const handleMiningGetRound = (t: Get, b: Base, a: { app_id: string; run_id: string }) =>
  runTool(() => apiJson(t, b, "GET", roundPath(a.app_id, a.run_id)))

export interface MiningStartRoundArgs {
  app_id: string
  phase?: "discovery" | "hypothesis" | "reconcile"
  dry_run?: boolean
}
/**
 * A reconcile round has its own route (configure tier) on the platform; the
 * generic start route refuses `phase: reconcile` with a 422.
 *
 * @internal
 */
export const handleMiningStartRound = (t: Get, b: Base, a: MiningStartRoundArgs) =>
  runTool(() =>
    a.phase === "reconcile"
      ? apiJson(t, b, "POST", roundsPath(a.app_id, "/reconcile"))
      : apiJson(t, b, "POST", roundsPath(a.app_id), {
          body: {
            ...(a.phase ? { phase: a.phase } : {}),
            ...(a.dry_run !== undefined ? { dry_run: a.dry_run } : {}),
          },
        }),
  )

/** @internal */
export const handleMiningListRoundTools = (
  t: Get,
  b: Base,
  a: { app_id: string; run_id: string },
) => runTool(() => apiJson(t, b, "GET", roundPath(a.app_id, a.run_id, "/tools")))

export interface MiningCallRoundToolArgs {
  app_id: string
  run_id: string
  execution_epoch: number
  name: string
  input?: Record<string, unknown>
  wait_seconds?: number
}

/** @internal */
export async function handleMiningCallRoundTool(
  t: Get,
  b: Base,
  a: MiningCallRoundToolArgs,
  timing: DriverTiming = {},
): Promise<ToolResult> {
  const sleep = timing.sleep ?? realSleep
  const now = timing.now ?? Date.now
  return runTool(async () => {
    const path = roundPath(a.app_id, a.run_id, `/tools/${encodeURIComponent(a.name)}`)
    const body = { execution_epoch: a.execution_epoch, input: a.input ?? {} }
    let answer: CallAnswer | undefined
    for (let attempt = 0; ; attempt++) {
      try {
        answer = await apiJson<CallAnswer>(t, b, "POST", path, { body })
        break
      } catch (err) {
        const backoff = BUSY_BACKOFF_MS[attempt]
        if (!isBusy(err) || backoff === undefined) throw err
        await sleep(backoff)
      }
    }
    if (answer?.status !== "running" || !answer.call_id) return answer
    // 202: the call is still running on the worker. Poll its status route.
    const waitMs = Math.min(a.wait_seconds ?? DEFAULT_WAIT_SECONDS, MAX_WAIT_SECONDS) * 1_000
    const deadline = now() + waitMs
    const callId = answer.call_id
    while (now() < deadline) {
      await sleep(POLL_INTERVAL_MS)
      const polled = await apiJson<CallAnswer>(
        t,
        b,
        "GET",
        roundPath(a.app_id, a.run_id, `/tools/calls/${encodeURIComponent(callId)}`),
        { params: { execution_epoch: a.execution_epoch } },
      )
      if (polled?.status !== "running") return polled
    }
    return {
      call_id: callId,
      status: "running",
      next_step:
        "The call is still running. Poll talonic_mining_get_round_tool_call with this call_id; heartbeat the task if its lease is close to expiring.",
    }
  })
}

/** @internal */
export const handleMiningGetRoundToolCall = (
  t: Get,
  b: Base,
  a: { app_id: string; run_id: string; call_id: string; execution_epoch: number },
) =>
  runTool(() =>
    apiJson(
      t,
      b,
      "GET",
      roundPath(a.app_id, a.run_id, `/tools/calls/${encodeURIComponent(a.call_id)}`),
      {
        params: { execution_epoch: a.execution_epoch },
      },
    ),
  )

/* ------------------------------------------------------------------ */
/* Descriptions                                                        */
/* ------------------------------------------------------------------ */

const DRIVER_FLOW =
  "FLOW for a round waiting for an outside driver: talonic_list_decision_tasks (the app's tasks) -> talonic_claim_decision_task (keep execution_epoch) -> talonic_read_decision_package (the round's brief and tools) -> talonic_mining_list_round_tools -> talonic_mining_call_round_tool, repeatedly, with talonic_heartbeat_decision_task before the lease ends -> talonic_submit_decision_task with outcome { summary, protocol_feedback }, evidence [] and a one-line rationale."

const AUTH_NOTE =
  "AUTH: a tlnc_ key needs a per-app 'decide' grant (plus 'read' for the round reads); an OAuth connector session needs the apps:decide scope and a live workspace role of senior_member or above. A 403 names what is missing: tell the user, do not retry."

const D = {
  listRounds: [
    "List an autonomous app's rule-finding rounds, newest first: phase, status, what each found, and for a round waiting for an outside driver its task state (claimed by whom, lease, deadline). `total` counts every round.",
    "USE WHEN: finding a round to drive or checking progress. ARGS: app_id, optional limit (max 200), offset.",
  ].join("\n"),
  getRound: [
    "Read one rule-finding round: phase, status, budget, findings, candidate rules, summary, and the driver block for an externally driven round.",
    "ARGS: app_id, run_id.",
  ].join("\n"),
  startRound: [
    "Start a rule-finding round on an autonomous app. Without phase the app's plan picks the next one; reconcile reviews rules whose candidates lapsed (needs configure access). dry_run re-grades without searching.",
    "USE WHEN: the user asks to look for new rules now. Only one externally driven round per app can be open (HTTP 409 with the open task otherwise).",
    "RETURNS: { run_id, status, phase, … }. A round with an outside driver then waits for a claim: see talonic_list_decision_tasks.",
  ].join("\n"),
  listTools: [
    "List the tools you may call on a round you hold the claim on, with their inputs, the round's remaining budget and the retry rule for a busy round.",
    "USE WHEN: right after claiming the round's decision task, or to check remaining budget.",
    DRIVER_FLOW,
    AUTH_NOTE,
  ].join("\n"),
  callTool: [
    "Call one round tool by name with its input, as the current claimant. The call runs under the app's grants and the round's budgets; a tool's own error comes back as is_error:true with a reason, not as a failure of this call.",
    "Busy rounds are retried for you. A call that runs long is polled for up to wait_seconds (default 25, max 120); if it is still running you get its call_id: poll talonic_mining_get_round_tool_call.",
    "Do not call tools on one round in parallel. close_round is not a tool here: close the round with talonic_submit_decision_task.",
    "ARGS: app_id, run_id, execution_epoch, name, input (object, default {}), optional wait_seconds. A stale or foreign claim or an expired lease is HTTP 409: claim again.",
    AUTH_NOTE,
  ].join("\n"),
  getCall: [
    "Read a round tool call that was still running: status running | done, and its content and is_error once done. Only the round's current claimant can read it.",
    "ARGS: app_id, run_id, call_id, execution_epoch.",
    AUTH_NOTE,
  ].join("\n"),
} as const

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

/** Options for {@link registerMiningDriverTools}. */
export interface MiningDriverToolOptions {
  /**
   * `false` marks the three decide-tier tools non-invocable via
   * `_meta["talonic/can_invoke"]: false` (+ `talonic/required_scope`), as the
   * decision-task tools are. Descriptions stay identical. Defaults to true.
   */
  invocable?: boolean
}

/** The six tool names {@link registerMiningDriverTools} registers. @internal */
export const MINING_DRIVER_TOOLS = [
  "talonic_mining_list_rounds",
  "talonic_mining_get_round",
  "talonic_mining_start_round",
  "talonic_mining_list_round_tools",
  "talonic_mining_call_round_tool",
  "talonic_mining_get_round_tool_call",
] as const

/** Register the six rule-mining round tools. */
export function registerMiningDriverTools(
  server: McpServer,
  getToken: Get,
  baseUrl?: string,
  options: MiningDriverToolOptions = {},
): void {
  const t = getToken
  const b = baseUrl
  const decideMeta =
    options.invocable === false
      ? { _meta: { "talonic/can_invoke": false, "talonic/required_scope": DECIDE_SCOPE } }
      : {}

  server.registerTool(
    "talonic_mining_list_rounds",
    {
      title: "List Mining Rounds",
      description: D.listRounds,
      inputSchema: {
        app_id: appId,
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: { title: "List Mining Rounds", ...READ_ONLY },
    },
    (a: { app_id: string; limit?: number; offset?: number }) => handleMiningListRounds(t, b, a),
  )
  server.registerTool(
    "talonic_mining_get_round",
    {
      title: "Get Mining Round",
      description: D.getRound,
      inputSchema: { app_id: appId, run_id: runId },
      annotations: { title: "Get Mining Round", ...READ_ONLY },
    },
    (a: { app_id: string; run_id: string }) => handleMiningGetRound(t, b, a),
  )
  server.registerTool(
    "talonic_mining_start_round",
    {
      title: "Start Mining Round",
      description: D.startRound,
      inputSchema: {
        app_id: appId,
        phase: z.enum(["discovery", "hypothesis", "reconcile"]).optional(),
        dry_run: z.boolean().optional(),
      },
      annotations: { title: "Start Mining Round", ...MUTATING },
    },
    (a: MiningStartRoundArgs) => handleMiningStartRound(t, b, a),
  )
  server.registerTool(
    "talonic_mining_list_round_tools",
    {
      title: "List Round Tools",
      description: D.listTools,
      inputSchema: { app_id: appId, run_id: runId },
      annotations: { title: "List Round Tools", ...READ_ONLY },
      ...decideMeta,
    },
    (a: { app_id: string; run_id: string }) => handleMiningListRoundTools(t, b, a),
  )
  server.registerTool(
    "talonic_mining_call_round_tool",
    {
      title: "Call Round Tool",
      description: D.callTool,
      inputSchema: {
        app_id: appId,
        run_id: runId,
        execution_epoch: executionEpoch,
        name: toolName,
        input: z.record(z.string(), z.json()).optional().describe("The tool's input object."),
        wait_seconds: z
          .number()
          .int()
          .min(0)
          .max(MAX_WAIT_SECONDS)
          .optional()
          .describe(`Seconds to keep polling a long call (default ${DEFAULT_WAIT_SECONDS}).`),
      },
      annotations: { title: "Call Round Tool", ...MUTATING },
      ...decideMeta,
    },
    (a: MiningCallRoundToolArgs) => handleMiningCallRoundTool(t, b, a),
  )
  server.registerTool(
    "talonic_mining_get_round_tool_call",
    {
      title: "Get Round Tool Call",
      description: D.getCall,
      inputSchema: {
        app_id: appId,
        run_id: runId,
        call_id: zUuid().describe("call_id from talonic_mining_call_round_tool."),
        execution_epoch: executionEpoch,
      },
      annotations: { title: "Get Round Tool Call", ...READ_ONLY },
      ...decideMeta,
    },
    (a: { app_id: string; run_id: string; call_id: string; execution_epoch: number }) =>
      handleMiningGetRoundToolCall(t, b, a),
  )
}

/**
 * True when the workspace has an autonomous app, i.e. when there can be
 * rule-finding rounds to read or drive. Listing UX only.
 *
 * @internal
 */
export function probeMiningInUse(token: string, baseUrl?: string): Promise<ProbeAnswer> {
  return probeAccessState(token, baseUrl, "/v1/apps", (body) => {
    const apps = (body as { apps?: Array<{ mode?: string }> } | null)?.apps
    return Array.isArray(apps) && apps.some((a) => a?.mode === "autonomous")
  })
}
