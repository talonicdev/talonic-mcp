import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { appsRequest } from "./apps.js"
import type { ToolResult } from "./_shared.js"

/**
 * Apps builder toolset — the verbs an agent needs to BUILD an app to a
 * tested state and then maintain it, over the same `/v1/apps` surface the
 * management toolset wraps:
 *
 * - read the draft/active logic and the fields rules can be grounded in
 * - interpret rule sentences (with plain-language author guidance on retry)
 * - propose and apply natural-language edits as typed, reviewable ops
 * - save the acceptance set (labeled ground truth) and CHECK any run
 *   against it — the machine-checkable definition of done a builder loop
 *   iterates toward and a maintainer re-checks for drift
 * - read a batch run's per-subject verdicts
 * - hold one interview turn on a Human Review (values are contract-checked
 *   server-side; submission stays on the resolve tool)
 *
 * Everything here is a thin adapter: authority, validation, fencing, and
 * receipts are the platform's job, not this file's.
 */

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const
const MUTATING = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const

const appId = z.string().min(1).describe("App UUID or public id (app_…).")
const runId = z.string().uuid().describe("App run UUID.")
const VERDICT_OUTCOMES = ["passed", "failed", "indeterminate", "not_applicable"] as const

const acceptanceCase = z
  .object({
    subject_key: z.string().min(1).max(256).optional(),
    expected_outcome: z.enum(VERDICT_OUTCOMES).optional(),
    expected_auto: z.boolean().optional(),
    expected_decision: z.string().min(1).max(64).optional(),
    note: z.string().max(300).optional(),
  })
  .describe(
    "One labeled expectation: subject_key + expected_outcome (+ expected_auto) for batch apps, or expected_decision for single-decision apps.",
  )

const interviewTurn = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(2000),
})

const D = {
  getLogic:
    "Read an app's logic envelope: the editable draft and the active published version, including rule cards with their compile state and plain-language readbacks.",
  getFields:
    "List the fields the app's rules can be grounded in, per bound data source alias. Use this before interpreting or fixing rules: it is the ground truth of what the app can see.",
  interpret:
    "Interpret pending rule sentences into checkable rules against the app's bound fields (the compile step). Pass card_ids to target specific rules; pass guidance (plain language, trusted author input) to tell the interpreter what to use when a rule is stuck — e.g. 'the city lives in shipper_city_state'. Returns the cards plus warnings naming exactly why any rule stayed pending.",
  proposeEdit:
    "Turn a plain-language change request into typed edit operations over the app's rules (add/rewrite/delete/pause/resume, fallback, adjudication, mode). Nothing persists: review the ops and summary, then apply them with talonic_apply_app_edit.",
  applyEdit:
    "Apply accepted edit operations from talonic_propose_app_edit. Application is deterministic and re-validated against the live draft; edited rules recompile immediately and compile warnings are returned.",
  interview:
    "Hold one turn of the natural-language interview on an open Human Review: send the reviewer's message (and the prior transcript — the server is stateless) and get back a focused question or a readback with proposed resolution values. Values are validated against the review's input contract server-side; ready=true only when they conform. Submission stays on talonic_resolve_app_review.",
  getAcceptance:
    "Read the app's acceptance set: labeled ground truth plus the accepted mismatch share.",
  saveAcceptance:
    "Replace the app's acceptance set: the labeled expectations a correct run must reproduce, plus tolerance (accepted mismatch share in [0,1]). This is the machine-checkable definition of done a builder loop iterates toward.",
  checkAcceptance:
    "Score a run (default: the latest completed one) against the app's acceptance set by pure ledger comparison — per-subject verdict outcomes and the auto (substantive) bar for batch apps, the decision field otherwise. No model is consulted: pass means the same thing every time. Returns score, pass/fail, and the exact mismatches.",
  verdicts:
    "Read a batch run's per-subject verdicts (the results matrix): rolled outcome, auto flag, and per-rule outcomes with reasons and evidence. Filterable by rolled outcome and auto.",
} as const

export function registerAppsBuilderTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_get_app_logic",
    {
      title: "Get App Logic",
      description: D.getLogic,
      inputSchema: { app_id: appId },
      annotations: { title: "Get App Logic", ...READ_ONLY },
    },
    async (args: { app_id: string }) => handleGetAppLogic(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_get_app_fields",
    {
      title: "Get App Bindable Fields",
      description: D.getFields,
      inputSchema: { app_id: appId },
      annotations: { title: "Get App Bindable Fields", ...READ_ONLY },
    },
    async (args: { app_id: string }) => handleGetAppFields(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_interpret_app_rules",
    {
      title: "Interpret App Rules",
      description: D.interpret,
      inputSchema: {
        app_id: appId,
        card_ids: z
          .array(z.string().min(1))
          .max(50)
          .optional()
          .describe("Specific rule card ids; omit for all pending."),
        guidance: z
          .string()
          .max(1000)
          .optional()
          .describe("Plain-language author guidance for stuck rules."),
      },
      annotations: { title: "Interpret App Rules", ...MUTATING },
    },
    async (args: InterpretRulesArgs) => handleInterpretRules(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_propose_app_edit",
    {
      title: "Propose App Edit (natural language)",
      description: D.proposeEdit,
      inputSchema: {
        app_id: appId,
        instruction: z.string().min(8).max(2000).describe("The change, in plain language."),
      },
      annotations: { title: "Propose App Edit", ...READ_ONLY },
    },
    async (args: { app_id: string; instruction: string }) =>
      handleProposeEdit(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_apply_app_edit",
    {
      title: "Apply App Edit",
      description: D.applyEdit,
      inputSchema: {
        app_id: appId,
        ops: z
          .array(z.record(z.string(), z.unknown()))
          .min(1)
          .max(20)
          .describe("Accepted ops from the proposal."),
      },
      annotations: { title: "Apply App Edit", ...MUTATING },
    },
    async (args: { app_id: string; ops: Record<string, unknown>[] }) =>
      handleApplyEdit(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_interview_app_review",
    {
      title: "Interview App Review",
      description: D.interview,
      inputSchema: {
        review_id: z.string().uuid().describe("Human Review UUID."),
        message: z.string().min(1).max(4000).describe("The reviewer's message for this turn."),
        transcript: z
          .array(interviewTurn)
          .max(20)
          .optional()
          .describe("Prior turns (client-held)."),
      },
      annotations: { title: "Interview App Review", ...MUTATING },
    },
    async (args: InterviewArgs) => handleInterviewReview(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_get_app_acceptance",
    {
      title: "Get App Acceptance Set",
      description: D.getAcceptance,
      inputSchema: { app_id: appId },
      annotations: { title: "Get App Acceptance Set", ...READ_ONLY },
    },
    async (args: { app_id: string }) => handleGetAcceptance(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_save_app_acceptance",
    {
      title: "Save App Acceptance Set",
      description: D.saveAcceptance,
      inputSchema: {
        app_id: appId,
        cases: z.array(acceptanceCase).min(1).max(2000),
        tolerance: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Accepted mismatch share (default 0)."),
      },
      annotations: { title: "Save App Acceptance Set", ...MUTATING },
    },
    async (args: SaveAcceptanceArgs) => handleSaveAcceptance(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_check_app_acceptance",
    {
      title: "Check App Acceptance",
      description: D.checkAcceptance,
      inputSchema: {
        app_id: appId,
        run_id: z
          .string()
          .uuid()
          .optional()
          .describe("Run to score; defaults to the latest completed run."),
      },
      annotations: { title: "Check App Acceptance", ...READ_ONLY },
    },
    async (args: { app_id: string; run_id?: string }) =>
      handleCheckAcceptance(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_get_run_verdicts",
    {
      title: "Get Run Verdicts",
      description: D.verdicts,
      inputSchema: {
        run_id: runId,
        rolled: z.enum(VERDICT_OUTCOMES).optional().describe("Filter by rolled outcome."),
        auto: z.boolean().optional().describe("Filter by the auto (substantive) flag."),
        limit: z.number().int().min(1).max(500).optional(),
        cursor: z.string().min(1).optional(),
      },
      annotations: { title: "Get Run Verdicts", ...READ_ONLY },
    },
    async (args: RunVerdictsArgs) => handleGetRunVerdicts(getToken, baseUrl, args),
  )
}

/* ------------------------------------------------------------------ */
/* Handlers (exported for unit testing)                                */
/* ------------------------------------------------------------------ */

/** @internal */
export function handleGetAppLogic(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { app_id: string },
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/logic`,
  })
}

/** @internal */
export function handleGetAppFields(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { app_id: string },
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/logic/fields`,
  })
}

export interface InterpretRulesArgs {
  app_id: string
  card_ids?: string[]
  guidance?: string
}

/** @internal */
export function handleInterpretRules(
  getToken: () => string,
  baseUrl: string | undefined,
  args: InterpretRulesArgs,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/logic/compile`,
    body: {
      ...(args.card_ids && args.card_ids.length > 0 ? { card_ids: args.card_ids } : {}),
      ...(args.guidance ? { guidance: args.guidance } : {}),
    },
  })
}

/** @internal */
export function handleProposeEdit(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { app_id: string; instruction: string },
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/edit-proposals`,
    body: { instruction: args.instruction },
  })
}

/** @internal */
export function handleApplyEdit(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { app_id: string; ops: Record<string, unknown>[] },
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/edit-proposals/apply`,
    body: { ops: args.ops },
  })
}

export interface InterviewArgs {
  review_id: string
  message: string
  transcript?: Array<{ role: "user" | "assistant"; text: string }>
}

/** @internal */
export function handleInterviewReview(
  getToken: () => string,
  baseUrl: string | undefined,
  args: InterviewArgs,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/reviews/${encodeURIComponent(args.review_id)}/interview`,
    body: { message: args.message, ...(args.transcript ? { transcript: args.transcript } : {}) },
  })
}

/** @internal */
export function handleGetAcceptance(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { app_id: string },
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/acceptance`,
  })
}

export interface SaveAcceptanceArgs {
  app_id: string
  cases: Array<Record<string, unknown>>
  tolerance?: number
}

/** @internal */
export function handleSaveAcceptance(
  getToken: () => string,
  baseUrl: string | undefined,
  args: SaveAcceptanceArgs,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    method: "PUT",
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/acceptance`,
    body: {
      cases: args.cases,
      ...(args.tolerance !== undefined ? { tolerance: args.tolerance } : {}),
    },
  })
}

/** @internal */
export function handleCheckAcceptance(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { app_id: string; run_id?: string },
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/acceptance/check`,
    query: { run_id: args.run_id },
  })
}

export interface RunVerdictsArgs {
  run_id: string
  rolled?: (typeof VERDICT_OUTCOMES)[number]
  auto?: boolean
  limit?: number
  cursor?: string
}

/** @internal */
export function handleGetRunVerdicts(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RunVerdictsArgs,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    path: `/v1/runs/${encodeURIComponent(args.run_id)}/verdicts`,
    query: { rolled: args.rolled, auto: args.auto, limit: args.limit, cursor: args.cursor },
  })
}
