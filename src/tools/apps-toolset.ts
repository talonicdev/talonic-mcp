import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, probeAccessState, runTool, type ProbeAnswer, type QueryParams } from "./_http.js"
import { zUuid, type ToolResult } from "./_shared.js"

/**
 * Apps toolset: build an app to a tested state, run it, read its results and
 * work its Human Reviews, over the platform's `/v1/apps/*`, `/v1/runs/*` and
 * `/v1/reviews/*` routes (platform `api/platform/apps.controller.ts`:
 * `AppsController`, `AppRunsController`, `AppReviewsController`).
 *
 * Every route carries its own `@AppsAccess` tier on the platform (read,
 * configure, operate, run, owner) and the platform re-checks the caller's
 * role, per-app grants and key scopes on every call. These wrappers forward
 * only; nothing here gates. Registered only when `probeAppsToolsetAccess`
 * (`GET /v1/apps` → 200) passes for the credential, so a credential that
 * cannot read the Apps surface never lists tools that would 403.
 *
 * Ported from the stale `feat/apps-toolset` branch (2026-08) and re-checked
 * route by route against platform staging (2026-11-25); see the PR body for
 * what changed (UUID-only ids, `autonomous` mode, offset paging, no draft
 * `revision`, `partial` verdict, run options in the body).
 */

const APP_MODES = ["rules", "assisted", "external", "autonomous"] as const
const REVIEW_KINDS = ["resolution", "approval", "data_request", "judgment"] as const
const REVIEW_STATUSES = ["open", "assigned", "resolved", "expired", "cancelled"] as const
const VERDICT_OUTCOMES = ["passed", "failed", "indeterminate", "not_applicable"] as const

const appId = zUuid().describe(
  "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
)
const runId = zUuid().describe(
  "App run UUID (run_id from talonic_run_app or talonic_list_app_runs).",
)
const reviewId = zUuid().describe("Human Review UUID (id from talonic_list_app_reviews).")
const limit = z
  .number()
  .int()
  .min(1)
  .max(200)
  .optional()
  .describe("Page size (default 50, max 200).")
const offset = z.number().int().min(0).optional().describe("Rows to skip before the page.")
const jsonObject = () => z.record(z.string(), z.json())

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

const appPath = (id: string, suffix = "") => `/v1/apps/${encodeURIComponent(id)}${suffix}`
const runPath = (id: string, suffix = "") => `/v1/runs/${encodeURIComponent(id)}${suffix}`
const reviewPath = (id: string, suffix = "") => `/v1/reviews/${encodeURIComponent(id)}${suffix}`

type Get = () => string
type Base = string | undefined

const get = (t: Get, b: Base, path: string, params?: QueryParams) =>
  runTool(() => apiJson(t, b, "GET", path, params ? { params } : {}))
const send = (t: Get, b: Base, method: "POST" | "PUT" | "PATCH", path: string, body?: unknown) =>
  runTool(() => apiJson(t, b, method, path, body === undefined ? {} : { body }))

/** Drop `undefined` keys so the platform's whitelisting DTOs see only what the caller set. */
function defined<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

/* ------------------------------------------------------------------ */
/* Handlers (exported for unit tests)                                  */
/* ------------------------------------------------------------------ */

/** @internal */
export const handleGetApp = (t: Get, b: Base, a: { app_id: string }) => get(t, b, appPath(a.app_id))

export interface CreateAppArgs {
  slug: string
  display_name: string
  mode: (typeof APP_MODES)[number]
  description?: string
}
/** @internal */
export const handleCreateApp = (t: Get, b: Base, a: CreateAppArgs) =>
  send(t, b, "POST", "/v1/apps", defined({ ...a }))

export interface SaveAppDraftArgs {
  app_id: string
  content: Record<string, unknown>
}
/** @internal */
export const handleSaveAppDraft = (t: Get, b: Base, a: SaveAppDraftArgs) =>
  send(t, b, "PATCH", appPath(a.app_id), { content: a.content })

/** @internal */
export const handleListAppVersions = (t: Get, b: Base, a: { app_id: string }) =>
  get(t, b, appPath(a.app_id, "/versions"))

/** @internal */
export const handlePublishApp = (t: Get, b: Base, a: { app_id: string; version: number }) =>
  send(t, b, "POST", appPath(a.app_id, `/versions/${a.version}/publish`))

/** @internal */
export const handleSetAppEnabled = (t: Get, b: Base, a: { app_id: string }, enabled: boolean) =>
  send(t, b, "POST", appPath(a.app_id, enabled ? "/enable" : "/disable"))

export interface RunAppArgs {
  app_id: string
  input?: Record<string, unknown>
  dry_run?: boolean
  idempotency_key?: string
}
/** @internal */
export const handleRunApp = (t: Get, b: Base, a: RunAppArgs) =>
  send(
    t,
    b,
    "POST",
    appPath(a.app_id, "/runs"),
    defined({ input: a.input ?? {}, dry_run: a.dry_run, idempotency_key: a.idempotency_key }),
  )

/** @internal */
export const handleListAppRuns = (
  t: Get,
  b: Base,
  a: { app_id: string; limit?: number; offset?: number },
) => get(t, b, appPath(a.app_id, "/runs"), { limit: a.limit, offset: a.offset })

/** @internal */
export async function handleGetAppRun(
  t: Get,
  b: Base,
  a: { run_id: string; include_events?: boolean },
): Promise<ToolResult> {
  return runTool(async () => {
    const run = await apiJson(t, b, "GET", runPath(a.run_id))
    if (!a.include_events) return run
    const events = await apiJson<{ events?: unknown[] }>(t, b, "GET", runPath(a.run_id, "/events"))
    return { run, events: events?.events ?? [] }
  })
}

/** @internal */
export const handleGetRunRecord = (t: Get, b: Base, a: { run_id: string }) =>
  get(t, b, runPath(a.run_id, "/record"))

export interface RunVerdictsArgs {
  run_id: string
  rolled?: (typeof VERDICT_OUTCOMES)[number]
  auto?: boolean
  rule?: string
  status?: (typeof VERDICT_OUTCOMES)[number]
  limit?: number
  cursor?: string
}
/** @internal */
export const handleGetRunVerdicts = (t: Get, b: Base, a: RunVerdictsArgs) =>
  get(t, b, runPath(a.run_id, "/verdicts"), {
    rolled: a.rolled,
    auto: a.auto,
    rule: a.rule,
    status: a.status,
    limit: a.limit,
    cursor: a.cursor,
  })

export interface ListAppReviewsArgs {
  app_id?: string
  status?: (typeof REVIEW_STATUSES)[number]
  kind?: (typeof REVIEW_KINDS)[number]
  assignee_user_id?: string
  limit?: number
  offset?: number
}
/**
 * Always the workspace inbox (`GET /v1/reviews`) with `app_id` as a filter:
 * it pages and counts, while `GET /v1/apps/:id/reviews` ignores both.
 *
 * @internal
 */
export const handleListAppReviews = (t: Get, b: Base, a: ListAppReviewsArgs) =>
  get(t, b, "/v1/reviews", { ...a })

export interface RaiseAppReviewArgs {
  app_id: string
  run_id?: string
  kind: (typeof REVIEW_KINDS)[number]
  question: string
  context?: Record<string, unknown>
  input_contract: Record<string, unknown>
  team_id?: string
}
/** @internal */
export const handleRaiseAppReview = (t: Get, b: Base, a: RaiseAppReviewArgs) => {
  const { app_id, ...body } = a
  return send(t, b, "POST", appPath(app_id, "/reviews"), defined(body))
}

export interface ResolveAppReviewArgs {
  review_id: string
  values: Record<string, unknown>
  feedback?: {
    proposal_verdict?: "correct" | "incorrect" | "partial"
    correction?: string
    generalize?: boolean
  }
}
/** @internal */
export const handleResolveAppReview = (t: Get, b: Base, a: ResolveAppReviewArgs) =>
  send(
    t,
    b,
    "POST",
    reviewPath(a.review_id, "/resolve"),
    defined({ values: a.values, feedback: a.feedback }),
  )

export interface InterviewArgs {
  review_id: string
  message: string
  transcript?: Array<{ role: "user" | "assistant"; text: string }>
}
/** @internal */
export const handleInterviewReview = (t: Get, b: Base, a: InterviewArgs) =>
  send(
    t,
    b,
    "POST",
    reviewPath(a.review_id, "/interview"),
    defined({ message: a.message, transcript: a.transcript }),
  )

/** @internal */
export const handleListAppPrecedents = (
  t: Get,
  b: Base,
  a: { app_id: string; similar_to?: Record<string, unknown> },
) =>
  get(t, b, appPath(a.app_id, "/precedents"), {
    similar_to: a.similar_to ? JSON.stringify(a.similar_to) : undefined,
  })

/** @internal */
export const handleGetAppLogic = (t: Get, b: Base, a: { app_id: string }) =>
  get(t, b, appPath(a.app_id, "/logic"))

/** @internal */
export const handleGetAppFields = (t: Get, b: Base, a: { app_id: string }) =>
  get(t, b, appPath(a.app_id, "/logic/fields"))

export interface InterpretRulesArgs {
  app_id: string
  card_ids?: string[]
  guidance?: string
  locale?: string
}
/** @internal */
export const handleInterpretRules = (t: Get, b: Base, a: InterpretRulesArgs) =>
  send(
    t,
    b,
    "POST",
    appPath(a.app_id, "/logic/compile"),
    defined({
      card_ids: a.card_ids && a.card_ids.length > 0 ? a.card_ids : undefined,
      guidance: a.guidance || undefined,
      locale: a.locale,
    }),
  )

/** @internal */
export const handleProposeEdit = (t: Get, b: Base, a: { app_id: string; instruction: string }) =>
  send(t, b, "POST", appPath(a.app_id, "/edit-proposals"), { instruction: a.instruction })

/** @internal */
export const handleApplyEdit = (
  t: Get,
  b: Base,
  a: { app_id: string; ops: Record<string, unknown>[] },
) => send(t, b, "POST", appPath(a.app_id, "/edit-proposals/apply"), { ops: a.ops })

/** @internal */
export const handleGetAcceptance = (t: Get, b: Base, a: { app_id: string }) =>
  get(t, b, appPath(a.app_id, "/acceptance"))

export interface SaveAcceptanceArgs {
  app_id: string
  cases: Array<Record<string, unknown>>
  tolerance?: number
}
/** @internal */
export const handleSaveAcceptance = (t: Get, b: Base, a: SaveAcceptanceArgs) =>
  send(
    t,
    b,
    "PUT",
    appPath(a.app_id, "/acceptance"),
    defined({ cases: a.cases, tolerance: a.tolerance }),
  )

/** @internal */
export const handleCheckAcceptance = (t: Get, b: Base, a: { app_id: string; run_id?: string }) =>
  get(t, b, appPath(a.app_id, "/acceptance/check"), { run_id: a.run_id })

/* ------------------------------------------------------------------ */
/* Descriptions                                                        */
/* ------------------------------------------------------------------ */

const BUILD_FLOW =
  "FLOW: talonic_create_app -> talonic_save_app_draft -> talonic_interpret_app_rules -> talonic_publish_app -> talonic_run_app (dry_run first) -> talonic_get_app_run / talonic_get_run_verdicts -> talonic_save_app_acceptance + talonic_check_app_acceptance -> talonic_enable_app."

const D = {
  get: [
    "Read one app's manifest: mode, active version, enabled state, contract (what it reads and acts on), output contract, thresholds, triggers, fallback.",
    "USE WHEN: inspecting an app before changing or running it. NOT FOR: the editable draft (talonic_get_app_logic) or listing apps (talonic_list_apps).",
  ].join("\n"),
  create: [
    "Create a new app. It starts disabled with no versions; the slug can no longer change once a version is published.",
    "USE WHEN: the user asks to set up a new app. ARGS: slug (lowercase letters, digits, hyphens, 3-64 chars), display_name, mode, optional one-sentence description.",
    "Modes: rules (decides from written rules), assisted (rules with people confirming), external (an outside agent decides through the decision-task tools), autonomous (finds candidate rules in the app's data).",
    "RETURNS: the manifest; use its `id` (UUID) with every other app tool.",
    BUILD_FLOW,
  ].join("\n"),
  saveDraft: [
    "Create or replace the app's single draft version: logic (rule sentences, or the external connection), input bindings, output contract (JSON Schema 2020-12), thresholds, triggers, fallback. Drafts are the only versions that can change.",
    "USE WHEN: authoring configuration in full. For a plain-language change to an existing draft prefer talonic_propose_app_edit + talonic_apply_app_edit.",
    "ARGS: app_id, content (the full version content object; read the current one with talonic_get_app_logic). RETURNS: { version, status, content_hash }; pass version to talonic_publish_app.",
  ].join("\n"),
  versions: [
    "List an app's versions, newest first: version number, status (draft, published, superseded), content hash, published_at.",
    "USE WHEN: you need the draft's version number for talonic_publish_app, or to see what is live.",
  ].join("\n"),
  publish: [
    "Publish the app's draft: freezes it, makes it the active version (the previous one is superseded) and locks the slug on first publish.",
    "USE WHEN: the draft is tested (talonic_run_app with dry_run, talonic_check_app_acceptance) and the user wants it live. Publishing does not enable the app; call talonic_enable_app for triggers to fire.",
    "ARGS: app_id and the draft's version number (from talonic_save_app_draft or talonic_list_app_versions). A number that is not the current draft is HTTP 409.",
  ].join("\n"),
  enable: [
    "Enable an app so its triggers fire and it can be run. Needs a published version. Enabling an app that acts on outside systems needs a workspace owner (HTTP 403 otherwise).",
    "USE WHEN: the user asks to switch the app on. ARGS: app_id.",
  ].join("\n"),
  disable: [
    "Disable an app at once (the kill switch): triggers stop and open work is no longer offered. Past runs and records are kept.",
    "USE WHEN: the user asks to stop or pause an app. ARGS: app_id.",
  ].join("\n"),
  run: [
    "Start one run of an app's active version and return it. A rules app usually finishes in the call with its decision; an external app stops at awaiting_decision until its decision task is submitted.",
    "USE WHEN: testing or executing an app. Set dry_run:true first: a full trace with no side effects (no actions, no webhooks to outside systems).",
    "ARGS: app_id, optional input object, dry_run, idempotency_key (reusing a key returns the existing run instead of starting another). Consumes credits.",
    "NEXT: talonic_get_app_run for status and decision; talonic_get_run_verdicts for per-subject results.",
  ].join("\n"),
  listRuns: [
    "List an app's runs, newest first, with status, decision and who decided; `total` counts every run.",
    "ARGS: app_id, optional limit (max 200) and offset.",
  ].join("\n"),
  getRun: [
    "Read one run: status, decision, decided_by, thresholds applied, reviews raised, timing.",
    "USE WHEN: checking a run you started or found. include_events:true adds the run's journal (every event in order).",
    "NOT FOR: Spec/pipeline runs (talonic_get_run). ARGS: run_id, optional include_events.",
  ].join("\n"),
  record: [
    "Export a finished run's sealed decision record: the immutable, audit-ready result with its decision, who decided (rules, a person or an outside agent) and the evidence.",
    "USE WHEN: the user needs the final, auditable outcome. A run that has not finished has no record yet (HTTP 404). ARGS: run_id.",
  ].join("\n"),
  verdicts: [
    "Read a batch run's per-subject results: a summary plus one row per subject with its overall outcome, the auto flag, and each rule's outcome with reasons and evidence.",
    "USE WHEN: inspecting what a run decided per record. Single-decision runs have none (HTTP 404; use talonic_get_app_run).",
    "ARGS: run_id; optional rolled (overall outcome), auto, rule + status (always together), limit (max 200), cursor (from `next`).",
  ].join("\n"),
  listReviews: [
    "List Human Reviews: questions apps raised for a person (approvals, missing data, judgment calls, exceptions), newest first, with `total`.",
    "USE WHEN: finding open reviews to answer, or checking the result of one already resolved (status 'resolved' shows its values). Omit app_id for the whole workspace.",
    "ARGS: optional app_id, status, kind, assignee_user_id, limit (max 200), offset.",
  ].join("\n"),
  raiseReview: [
    "Ask a person a question on an app instead of guessing: a Human Review with a JSON Schema for the answer.",
    "USE WHEN: a decision needs a person's input. ARGS: app_id, kind (resolution | approval | data_request | judgment), question, input_contract (JSON Schema the answer must satisfy), optional run_id, context, team_id.",
    "NEXT: the answer arrives through talonic_resolve_app_review (or the web app); read it with talonic_list_app_reviews status 'resolved'.",
  ].join("\n"),
  resolveReview: [
    "Answer a Human Review: values (validated against the review's input_contract) plus optional feedback that teaches the app (proposal_verdict correct | incorrect | partial, correction, generalize).",
    "USE WHEN: the user gives the answer. 'approval' reviews accept only a person's answer; an API key or agent is refused (HTTP 403). Needs operate access on the app.",
    "RETURNS: the resolved review with its values. ARGS: review_id, values, optional feedback.",
  ].join("\n"),
  interview: [
    "Hold one turn of a guided conversation on an open Human Review: send the reviewer's message and the earlier turns (the server keeps no state); get back a follow-up question or a readback with proposed answer values.",
    "ready:true only when the proposed values satisfy the review's input contract. Nothing is submitted: finish with talonic_resolve_app_review.",
    "ARGS: review_id, message, optional transcript [{ role: user | assistant, text }].",
  ].join("\n"),
  precedents: [
    "List an app's precedents: past resolved reviews it reuses for similar future runs.",
    "ARGS: app_id, optional similar_to (match keys object) to narrow to similar cases. An app with none returns an empty list.",
  ].join("\n"),
  getLogic: [
    "Read an app's logic: the editable draft and the active published version, including each rule with its interpretation state and plain-language readback.",
    "USE WHEN: before editing, or to get the draft's full content for talonic_save_app_draft.",
  ].join("\n"),
  getFields: [
    "List the fields the app's rules can use, per bound data source. This is everything the app can see.",
    "USE WHEN: before writing or fixing rules, so they name fields that exist.",
  ].join("\n"),
  interpret: [
    "Turn the draft's pending rule sentences into checkable rules against the app's fields, and save the draft.",
    "ARGS: app_id; optional card_ids (default: all pending), guidance (plain language, e.g. 'the city is in shipper_city_state') for rules that stayed pending, locale for the readbacks.",
    "RETURNS: the rules plus warnings saying why any rule stayed pending.",
  ].join("\n"),
  proposeEdit: [
    "Turn a plain-language change request into typed edit operations on the app's rules (add, rewrite, delete, pause, resume, fallback, mode). Nothing is saved.",
    "USE WHEN: the user describes a change in words. Show the summary to the user, then apply the accepted ops with talonic_apply_app_edit.",
  ].join("\n"),
  applyEdit: [
    "Apply accepted edit operations from talonic_propose_app_edit to the draft. They are re-checked against the current draft; changed rules are interpreted again and warnings returned.",
    "ARGS: app_id, ops (from the proposal, unchanged).",
  ].join("\n"),
  getAcceptance: [
    "Read the app's acceptance set: the labeled expected results a correct run must reproduce, and the accepted mismatch share. null when none is saved.",
  ].join("\n"),
  saveAcceptance: [
    "Replace the app's acceptance set: the expected results a correct run must reproduce, plus tolerance (accepted mismatch share, 0 to 1). This is the app's definition of done.",
    "ARGS: app_id, cases (per subject: subject_key + expected_outcome and/or expected_auto; for single-decision apps: expected_decision), optional tolerance (default 0).",
  ].join("\n"),
  checkAcceptance: [
    "Score a run against the app's acceptance set by comparing recorded results: the same run always gets the same score. Returns score, pass/fail and each mismatch.",
    "USE WHEN: after talonic_run_app, to decide whether the app is ready to publish or still correct. ARGS: app_id, optional run_id (default: the latest completed run).",
  ].join("\n"),
} as const

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

const acceptanceCase = z
  .object({
    subject_key: z.string().min(1).max(256).optional(),
    expected_outcome: z.enum(VERDICT_OUTCOMES).optional(),
    expected_auto: z.boolean().optional(),
    expected_decision: z.string().min(1).max(64).optional(),
    note: z.string().max(300).optional(),
  })
  .describe(
    "One expected result: subject_key + expected_outcome (and/or expected_auto) for batch apps, or expected_decision for single-decision apps.",
  )

/** Register the Apps toolset (25 tools). */
export function registerAppsToolset(server: McpServer, getToken: Get, baseUrl?: string): void {
  const t = getToken
  const b = baseUrl
  const reg = (
    name: string,
    title: string,
    description: string,
    inputSchema: Record<string, z.ZodType>,
    annotations: {
      readOnlyHint: boolean
      destructiveHint: boolean
      idempotentHint: boolean
      openWorldHint: boolean
    },
    handler: (args: any) => Promise<ToolResult>,
  ) =>
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations } },
      handler,
    )

  // Builder
  reg(
    "talonic_create_app",
    "Create App",
    D.create,
    {
      slug: z
        .string()
        .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/)
        .describe("Lowercase letters, digits and hyphens, 3-64 chars."),
      display_name: z.string().min(1).max(200),
      mode: z.enum(APP_MODES),
      description: z.string().max(2000).optional().describe("One sentence about the app."),
    },
    MUTATING,
    (a: CreateAppArgs) => handleCreateApp(t, b, a),
  )
  reg("talonic_get_app", "Get App", D.get, { app_id: appId }, READ_ONLY, (a) =>
    handleGetApp(t, b, a),
  )
  reg("talonic_get_app_logic", "Get App Logic", D.getLogic, { app_id: appId }, READ_ONLY, (a) =>
    handleGetAppLogic(t, b, a),
  )
  reg("talonic_get_app_fields", "Get App Fields", D.getFields, { app_id: appId }, READ_ONLY, (a) =>
    handleGetAppFields(t, b, a),
  )
  reg(
    "talonic_save_app_draft",
    "Save App Draft",
    D.saveDraft,
    { app_id: appId, content: jsonObject().describe("Full version content object.") },
    MUTATING,
    (a: SaveAppDraftArgs) => handleSaveAppDraft(t, b, a),
  )
  reg(
    "talonic_interpret_app_rules",
    "Interpret App Rules",
    D.interpret,
    {
      app_id: appId,
      card_ids: z
        .array(z.string().min(1).max(128))
        .max(50)
        .optional()
        .describe("Rule card ids; omit for all pending."),
      guidance: z.string().max(1000).optional().describe("Plain-language hint for stuck rules."),
      locale: z.string().max(10).optional().describe("Language of reasons and readbacks, e.g. de."),
    },
    MUTATING,
    (a: InterpretRulesArgs) => handleInterpretRules(t, b, a),
  )
  reg(
    "talonic_propose_app_edit",
    "Propose App Edit",
    D.proposeEdit,
    {
      app_id: appId,
      instruction: z.string().min(8).max(2000).describe("The change, in plain language."),
    },
    { ...READ_ONLY, idempotentHint: false },
    (a) => handleProposeEdit(t, b, a),
  )
  reg(
    "talonic_apply_app_edit",
    "Apply App Edit",
    D.applyEdit,
    {
      app_id: appId,
      ops: z.array(jsonObject()).min(1).max(20).describe("Accepted ops from the proposal."),
    },
    MUTATING,
    (a) => handleApplyEdit(t, b, a),
  )
  reg(
    "talonic_list_app_versions",
    "List App Versions",
    D.versions,
    { app_id: appId },
    READ_ONLY,
    (a) => handleListAppVersions(t, b, a),
  )
  reg(
    "talonic_publish_app",
    "Publish App",
    D.publish,
    { app_id: appId, version: z.number().int().min(1).describe("The draft's version number.") },
    MUTATING,
    (a) => handlePublishApp(t, b, a),
  )
  reg("talonic_enable_app", "Enable App", D.enable, { app_id: appId }, MUTATING, (a) =>
    handleSetAppEnabled(t, b, a, true),
  )
  reg("talonic_disable_app", "Disable App", D.disable, { app_id: appId }, MUTATING, (a) =>
    handleSetAppEnabled(t, b, a, false),
  )
  reg(
    "talonic_get_app_acceptance",
    "Get App Acceptance Set",
    D.getAcceptance,
    { app_id: appId },
    READ_ONLY,
    (a) => handleGetAcceptance(t, b, a),
  )
  reg(
    "talonic_save_app_acceptance",
    "Save App Acceptance Set",
    D.saveAcceptance,
    {
      app_id: appId,
      cases: z.array(acceptanceCase).min(1).max(2000),
      tolerance: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Accepted mismatch share (default 0)."),
    },
    MUTATING,
    (a: SaveAcceptanceArgs) => handleSaveAcceptance(t, b, a),
  )
  reg(
    "talonic_check_app_acceptance",
    "Check App Acceptance",
    D.checkAcceptance,
    {
      app_id: appId,
      run_id: zUuid().optional().describe("Run to score; default the latest completed run."),
    },
    READ_ONLY,
    (a) => handleCheckAcceptance(t, b, a),
  )

  // Runs
  reg(
    "talonic_run_app",
    "Run App",
    D.run,
    {
      app_id: appId,
      input: jsonObject().optional().describe("Run input, checked against the app's input schema."),
      dry_run: z.boolean().optional().describe("Full trace, no side effects."),
      idempotency_key: z.string().min(1).max(64).optional(),
    },
    MUTATING,
    (a: RunAppArgs) => handleRunApp(t, b, a),
  )
  reg(
    "talonic_list_app_runs",
    "List App Runs",
    D.listRuns,
    { app_id: appId, limit, offset },
    READ_ONLY,
    (a) => handleListAppRuns(t, b, a),
  )
  reg(
    "talonic_get_app_run",
    "Get App Run",
    D.getRun,
    { run_id: runId, include_events: z.boolean().optional() },
    READ_ONLY,
    (a) => handleGetAppRun(t, b, a),
  )
  reg("talonic_get_run_record", "Get Run Record", D.record, { run_id: runId }, READ_ONLY, (a) =>
    handleGetRunRecord(t, b, a),
  )
  reg(
    "talonic_get_run_verdicts",
    "Get Run Verdicts",
    D.verdicts,
    {
      run_id: runId,
      rolled: z.enum(VERDICT_OUTCOMES).optional().describe("Filter by overall outcome."),
      auto: z.boolean().optional().describe("Filter by the auto flag."),
      rule: z.string().min(1).max(128).optional().describe("Rule id; needs status."),
      status: z.enum(VERDICT_OUTCOMES).optional().describe("That rule's outcome; needs rule."),
      limit,
      cursor: z.string().min(1).max(512).optional().describe("`next` from the previous page."),
    },
    READ_ONLY,
    (a: RunVerdictsArgs) => handleGetRunVerdicts(t, b, a),
  )

  // Reviews
  reg(
    "talonic_list_app_reviews",
    "List Human Reviews",
    D.listReviews,
    {
      app_id: appId.optional(),
      status: z.enum(REVIEW_STATUSES).optional(),
      kind: z.enum(REVIEW_KINDS).optional(),
      assignee_user_id: zUuid().optional().describe("Only reviews assigned to this user."),
      limit,
      offset,
    },
    READ_ONLY,
    (a: ListAppReviewsArgs) => handleListAppReviews(t, b, a),
  )
  reg(
    "talonic_raise_app_review",
    "Raise Human Review",
    D.raiseReview,
    {
      app_id: appId,
      run_id: runId.optional(),
      kind: z.enum(REVIEW_KINDS),
      question: z.string().min(1).max(4000),
      context: jsonObject().optional(),
      input_contract: jsonObject().describe("JSON Schema the answer must satisfy."),
      team_id: zUuid().optional().describe("Review team to assign."),
    },
    MUTATING,
    (a: RaiseAppReviewArgs) => handleRaiseAppReview(t, b, a),
  )
  reg(
    "talonic_resolve_app_review",
    "Resolve Human Review",
    D.resolveReview,
    {
      review_id: reviewId,
      values: jsonObject().describe("Answer values matching the review's input_contract."),
      feedback: z
        .object({
          proposal_verdict: z.enum(["correct", "incorrect", "partial"]).optional(),
          correction: z.string().max(4000).optional(),
          generalize: z.boolean().optional(),
        })
        .optional()
        .describe("Optional feedback that teaches the app."),
    },
    MUTATING,
    (a: ResolveAppReviewArgs) => handleResolveAppReview(t, b, a),
  )
  reg(
    "talonic_interview_app_review",
    "Interview Human Review",
    D.interview,
    {
      review_id: reviewId,
      message: z.string().min(1).max(4000).describe("The reviewer's message for this turn."),
      transcript: z
        .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
        .max(20)
        .optional()
        .describe("Earlier turns, oldest first."),
    },
    { ...READ_ONLY, idempotentHint: false },
    (a: InterviewArgs) => handleInterviewReview(t, b, a),
  )
  reg(
    "talonic_list_app_precedents",
    "List App Precedents",
    D.precedents,
    { app_id: appId, similar_to: jsonObject().optional().describe("Match keys of the case.") },
    READ_ONLY,
    (a) => handleListAppPrecedents(t, b, a),
  )
}

/** The 25 tool names {@link registerAppsToolset} registers. @internal */
export const APPS_TOOLSET_TOOLS = [
  "talonic_create_app",
  "talonic_get_app",
  "talonic_get_app_logic",
  "talonic_get_app_fields",
  "talonic_save_app_draft",
  "talonic_interpret_app_rules",
  "talonic_propose_app_edit",
  "talonic_apply_app_edit",
  "talonic_list_app_versions",
  "talonic_publish_app",
  "talonic_enable_app",
  "talonic_disable_app",
  "talonic_get_app_acceptance",
  "talonic_save_app_acceptance",
  "talonic_check_app_acceptance",
  "talonic_run_app",
  "talonic_list_app_runs",
  "talonic_get_app_run",
  "talonic_get_run_record",
  "talonic_get_run_verdicts",
  "talonic_list_app_reviews",
  "talonic_raise_app_review",
  "talonic_resolve_app_review",
  "talonic_interview_app_review",
  "talonic_list_app_precedents",
] as const

/**
 * True when the credential can read the Apps surface (`GET /v1/apps` → 200).
 * Listing UX only: every call is re-authorized by the platform.
 *
 * @internal
 */
export function probeAppsToolsetAccess(token: string, baseUrl?: string): Promise<ProbeAnswer> {
  return probeAccessState(token, baseUrl, "/v1/apps")
}
