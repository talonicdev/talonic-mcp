import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

/**
 * Apps management toolset — thin adapters over the platform's `/v1/apps`
 * surface (docs/APPS-SPEC.md §B3). Apps are the governed decision layer:
 * Contract (grants) / Logic (rules | assisted | external) / Output
 * (schema-typed decision) / Ledger (journal + sealed record).
 *
 * These static tools give any MCP-connected agent full administrative
 * control, equal to the UI. Enabled apps are ADDITIONALLY published as their
 * own callable tools (`app_<slug>`) — see `app-tools.ts`.
 */

const DEFAULT_BASE = "https://api.talonic.com"
const APP_MODES = ["rules", "assisted", "external"] as const
const REVIEW_KINDS = ["resolution", "approval", "data_request", "judgment"] as const
const REVIEW_STATUSES = ["open", "assigned", "resolved", "expired", "cancelled"] as const

const appId = z.string().min(1).describe("App UUID or public id (app_…).")
const runId = z.string().uuid().describe("App run UUID.")
const reviewId = z.string().uuid().describe("Human Review UUID.")
const limit = z.number().int().min(1).max(200).optional().describe("Page size (default 50).")
const cursor = z.string().min(1).optional().describe("Opaque cursor from pagination.next_cursor.")

interface ApiRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  headers?: Record<string, string>
}

function apiUrl(
  baseUrl: string | undefined,
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  const base = (baseUrl ?? DEFAULT_BASE).replace(/\/$/, "")
  const url = new URL(`${base}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value))
  }
  return url.toString()
}

export async function appsRequest(
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

/* ------------------------------------------------------------------ */
/* Handlers (exported for unit testing)                                */
/* ------------------------------------------------------------------ */

export interface ListAppsArgs {
  enabled?: boolean
  limit?: number
  cursor?: string
}

/** @internal */
export function handleListApps(
  getToken: () => string,
  baseUrl: string | undefined,
  args: ListAppsArgs,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    path: "/v1/apps",
    query: { enabled: args.enabled, limit: args.limit, cursor: args.cursor },
  })
}

/** @internal */
export function handleGetApp(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { app_id: string },
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    path: `/v1/apps/${encodeURIComponent(args.app_id)}`,
  })
}

export interface CreateAppArgs {
  slug: string
  display_name: string
  mode: (typeof APP_MODES)[number]
}

/** @internal */
export function handleCreateApp(
  getToken: () => string,
  baseUrl: string | undefined,
  args: CreateAppArgs,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    method: "POST",
    path: "/v1/apps",
    body: args,
  })
}

export interface SaveAppDraftArgs {
  app_id: string
  content: Record<string, unknown>
  revision?: number
}

/** @internal */
export function handleSaveAppDraft(
  getToken: () => string,
  baseUrl: string | undefined,
  args: SaveAppDraftArgs,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    method: "PATCH",
    path: `/v1/apps/${encodeURIComponent(args.app_id)}`,
    body: {
      content: args.content,
      ...(args.revision === undefined ? {} : { revision: args.revision }),
    },
  })
}

export interface PublishAppArgs {
  app_id: string
  version: number
}

/** @internal */
export function handlePublishApp(
  getToken: () => string,
  baseUrl: string | undefined,
  args: PublishAppArgs,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/versions/${args.version}/publish`,
  })
}

/** @internal */
export function handleSetAppEnabled(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { app_id: string },
  enabled: boolean,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/${enabled ? "enable" : "disable"}`,
  })
}

export interface RunAppArgs {
  app_id: string
  input?: Record<string, unknown>
  dry_run?: boolean
  idempotency_key?: string
}

/** @internal */
export function handleRunApp(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RunAppArgs,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/runs`,
    query: { dry_run: args.dry_run },
    body: { input: args.input ?? {} },
    ...(args.idempotency_key ? { headers: { "Idempotency-Key": args.idempotency_key } } : {}),
  })
}

export interface GetAppRunArgs {
  run_id: string
  include_events?: boolean
}

/** @internal */
export async function handleGetAppRun(
  getToken: () => string,
  baseUrl: string | undefined,
  args: GetAppRunArgs,
): Promise<ToolResult> {
  const run = await appsRequest(getToken, baseUrl, {
    path: `/v1/runs/${encodeURIComponent(args.run_id)}`,
  })
  if (!args.include_events || run.isError) return run
  const events = await appsRequest(getToken, baseUrl, {
    path: `/v1/runs/${encodeURIComponent(args.run_id)}/events`,
  })
  if (events.isError) return events
  return jsonOk({
    run: run["structuredContent"] ?? JSON.parse(run.content[0]!.text),
    events: events["structuredContent"] ?? JSON.parse(events.content[0]!.text),
  })
}

/** @internal */
export function handleListAppRuns(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { app_id: string; limit?: number; cursor?: string },
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/runs`,
    query: { limit: args.limit, cursor: args.cursor },
  })
}

/** @internal */
export function handleGetRunRecord(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { run_id: string },
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    path: `/v1/runs/${encodeURIComponent(args.run_id)}/record`,
  })
}

export interface ListAppReviewsArgs {
  app_id?: string
  status?: (typeof REVIEW_STATUSES)[number]
  kind?: (typeof REVIEW_KINDS)[number]
  limit?: number
  cursor?: string
}

/** @internal */
export function handleListAppReviews(
  getToken: () => string,
  baseUrl: string | undefined,
  args: ListAppReviewsArgs,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    path: args.app_id ? `/v1/apps/${encodeURIComponent(args.app_id)}/reviews` : "/v1/reviews",
    query: { status: args.status, kind: args.kind, limit: args.limit, cursor: args.cursor },
  })
}

export interface RaiseAppReviewArgs {
  app_id: string
  run_id?: string
  kind: (typeof REVIEW_KINDS)[number]
  question: string
  context?: Record<string, unknown>
  input_contract: Record<string, unknown>
}

/** @internal */
export function handleRaiseAppReview(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RaiseAppReviewArgs,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/reviews`,
    body: {
      kind: args.kind,
      question: args.question,
      input_contract: args.input_contract,
      ...(args.run_id === undefined ? {} : { run_id: args.run_id }),
      ...(args.context === undefined ? {} : { context: args.context }),
    },
  })
}

export interface ResolveAppReviewArgs {
  review_id: string
  values: Record<string, unknown>
  feedback?: {
    proposal_verdict?: "correct" | "incorrect" | "partially_correct"
    correction?: string
    generalize?: boolean
  }
}

/** @internal */
export function handleResolveAppReview(
  getToken: () => string,
  baseUrl: string | undefined,
  args: ResolveAppReviewArgs,
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    method: "POST",
    path: `/v1/reviews/${encodeURIComponent(args.review_id)}/resolve`,
    body: {
      values: args.values,
      ...(args.feedback === undefined ? {} : { feedback: args.feedback }),
    },
  })
}

/** @internal */
export function handleListAppPrecedents(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { app_id: string; limit?: number },
): Promise<ToolResult> {
  return appsRequest(getToken, baseUrl, {
    path: `/v1/apps/${encodeURIComponent(args.app_id)}/precedents`,
    query: { limit: args.limit },
  })
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const
const MUTATING = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const

const D = {
  list: [
    "List Talonic Apps this credential can see: governed decision apps with Contract, Logic, Output, and Ledger.",
    "",
    "USE WHEN: discovering which apps exist, their modes, versions, and enabled state.",
    "NOT FOR: running an app (use talonic_run_app or the app's own app_<slug> tool).",
    "ARGS: optional enabled filter, limit, cursor. RETURNS: app manifests.",
  ].join("\n"),
  get: [
    "Fetch one app's manifest: contract (grants), mode, active version, output contract, thresholds, triggers, endpoints.",
    "",
    "USE WHEN: inspecting an app before running or reconfiguring it.",
    "ARGS: app_id (UUID or app_… public id).",
  ].join("\n"),
  create: [
    "Create a new app (starts disabled, no versions). Slug is immutable after first publish; display_name renames freely.",
    "",
    "USE WHEN: setting up a new governed decision app.",
    "ARGS: slug (lowercase, digits, hyphens, 3-64 chars), display_name, mode (rules | assisted | external).",
    "NEXT: talonic_save_app_draft to author its configuration, then talonic_publish_app.",
  ].join("\n"),
  saveDraft: [
    "Create or update the app's single draft version (its logic cards or external connection, input bindings, output contract as JSON Schema 2020-12, thresholds, triggers, fallback).",
    "",
    "USE WHEN: authoring or editing configuration. Drafts are the only mutable versions.",
    "ARGS: app_id, content (full version content object), optional revision for optimistic concurrency.",
    "NEXT: talonic_publish_app freezes and activates it.",
  ].join("\n"),
  publish: [
    "Publish a draft version: freezes it immutably, supersedes the previous version, activates it, and locks the slug on first publish. Publishing an identical content hash is a no-op.",
    "",
    "ARGS: app_id and the draft version number (from talonic_get_app head_version or talonic_save_app_draft's response).",
  ].join("\n"),
  enable: [
    "Enable an app so its triggers fire and it appears as a callable app_<slug> tool. Requires a published version.",
    "ARGS: app_id.",
  ].join("\n"),
  disable: [
    "Disable an app instantly — the kill switch. Open work stops being offered; the ledger is unaffected.",
    "ARGS: app_id.",
  ].join("\n"),
  run: [
    "Trigger one app run and return the run (rules-mode runs complete synchronously with the decision; external-mode runs stop at awaiting_decision).",
    "",
    "USE WHEN: executing an app on demand. Set dry_run:true for a full trace with ZERO side effects.",
    "ARGS: app_id, optional input object (validated against the app's input schema), optional dry_run, optional idempotency_key — reusing a key returns the existing run instead of re-running.",
  ].join("\n"),
  getRun: [
    "Fetch one run's current state (projection): status, decision, decided_by, thresholds applied, reviews, evidence.",
    "",
    "ARGS: run_id; include_events:true also returns the append-only journal — every event that happened to the run, in order.",
  ].join("\n"),
  listRuns: ["List an app's runs, newest first.", "ARGS: app_id, optional limit/cursor."].join(
    "\n",
  ),
  record: [
    "Export a run's SEALED decision record — the immutable, audit-grade artifact minted at terminal state. Identical shape for every mode; decided_by records rules, humans, and external agents identically.",
    "ARGS: run_id. Runs that have not reached terminal state have no record yet.",
  ].join("\n"),
  listReviews: [
    "List Human Reviews — structured requests for human input raised by apps (exceptions are the system-raised subset).",
    "",
    "USE WHEN: finding open reviews to resolve, or auditing resolved ones. Omit app_id for the workspace-wide inbox.",
    "ARGS: optional app_id, status (open | assigned | resolved | expired | cancelled), kind, limit, cursor.",
  ].join("\n"),
  raiseReview: [
    "Raise a Human Review on an app: a question for a human, with a schema for the answer. Use this instead of guessing when uncertain — asking for help is part of the protocol.",
    "",
    "ARGS: app_id, kind (resolution | approval | data_request | judgment), question, input_contract (JSON Schema for the answer), optional run_id and context.",
  ].join("\n"),
  resolveReview: [
    "Resolve a Human Review with a two-part payload: the resolution values (validated against the review's input_contract) plus optional feedback that teaches the app (proposal_verdict, correction, generalize).",
    "",
    "NOTE: 'approval' reviews are human-only and reject agent resolvers by policy — expect HTTP 403 there.",
    "ARGS: review_id, values, optional feedback.",
  ].join("\n"),
  precedents: [
    "List an app's precedents: resolved-review memory injected into similar future runs.",
    "",
    "NOTE: activates in v1.1 — the platform may answer HTTP 501 until then; that is expected, not an error in your call.",
    "ARGS: app_id, optional limit.",
  ].join("\n"),
} as const

/** Register the static Apps management toolset. */
export function registerAppsTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_list_apps",
    {
      title: "List Apps",
      description: D.list,
      inputSchema: {
        enabled: z.boolean().optional().describe("Filter by enabled state."),
        limit,
        cursor,
      },
      annotations: { title: "List Apps", ...READ_ONLY },
    },
    async (args: ListAppsArgs) => handleListApps(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_get_app",
    {
      title: "Get App",
      description: D.get,
      inputSchema: { app_id: appId },
      annotations: { title: "Get App", ...READ_ONLY },
    },
    async (args: { app_id: string }) => handleGetApp(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_create_app",
    {
      title: "Create App",
      description: D.create,
      inputSchema: {
        slug: z
          .string()
          .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/)
          .describe("Immutable-after-publish slug."),
        display_name: z.string().min(1).max(200),
        mode: z.enum(APP_MODES),
      },
      annotations: { title: "Create App", ...MUTATING },
    },
    async (args: CreateAppArgs) => handleCreateApp(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_save_app_draft",
    {
      title: "Save App Draft",
      description: D.saveDraft,
      inputSchema: {
        app_id: appId,
        content: z.record(z.string(), z.unknown()).describe("Full app version content."),
        revision: z.number().int().min(0).optional(),
      },
      annotations: { title: "Save App Draft", ...MUTATING },
    },
    async (args: SaveAppDraftArgs) => handleSaveAppDraft(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_publish_app",
    {
      title: "Publish App Version",
      description: D.publish,
      inputSchema: { app_id: appId, version: z.number().int().min(1) },
      annotations: { title: "Publish App Version", ...MUTATING },
    },
    async (args: PublishAppArgs) => handlePublishApp(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_enable_app",
    {
      title: "Enable App",
      description: D.enable,
      inputSchema: { app_id: appId },
      annotations: { title: "Enable App", ...MUTATING },
    },
    async (args: { app_id: string }) => handleSetAppEnabled(getToken, baseUrl, args, true),
  )
  server.registerTool(
    "talonic_disable_app",
    {
      title: "Disable App (kill switch)",
      description: D.disable,
      inputSchema: { app_id: appId },
      annotations: { title: "Disable App", ...MUTATING },
    },
    async (args: { app_id: string }) => handleSetAppEnabled(getToken, baseUrl, args, false),
  )
  server.registerTool(
    "talonic_run_app",
    {
      title: "Run App",
      description: D.run,
      inputSchema: {
        app_id: appId,
        input: z.record(z.string(), z.unknown()).optional(),
        dry_run: z.boolean().optional().describe("Full trace, zero side effects."),
        idempotency_key: z.string().min(1).max(64).optional(),
      },
      annotations: { title: "Run App", ...MUTATING },
    },
    async (args: RunAppArgs) => handleRunApp(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_get_app_run",
    {
      title: "Get App Run",
      description: D.getRun,
      inputSchema: { run_id: runId, include_events: z.boolean().optional() },
      annotations: { title: "Get App Run", ...READ_ONLY },
    },
    async (args: GetAppRunArgs) => handleGetAppRun(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_list_app_runs",
    {
      title: "List App Runs",
      description: D.listRuns,
      inputSchema: { app_id: appId, limit, cursor },
      annotations: { title: "List App Runs", ...READ_ONLY },
    },
    async (args: { app_id: string; limit?: number; cursor?: string }) =>
      handleListAppRuns(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_get_run_record",
    {
      title: "Get Sealed Run Record",
      description: D.record,
      inputSchema: { run_id: runId },
      annotations: { title: "Get Sealed Run Record", ...READ_ONLY },
    },
    async (args: { run_id: string }) => handleGetRunRecord(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_list_app_reviews",
    {
      title: "List Human Reviews",
      description: D.listReviews,
      inputSchema: {
        app_id: appId.optional(),
        status: z.enum(REVIEW_STATUSES).optional(),
        kind: z.enum(REVIEW_KINDS).optional(),
        limit,
        cursor,
      },
      annotations: { title: "List Human Reviews", ...READ_ONLY },
    },
    async (args: ListAppReviewsArgs) => handleListAppReviews(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_raise_app_review",
    {
      title: "Raise Human Review",
      description: D.raiseReview,
      inputSchema: {
        app_id: appId,
        run_id: runId.optional(),
        kind: z.enum(REVIEW_KINDS),
        question: z.string().min(1).max(4000),
        context: z.record(z.string(), z.unknown()).optional(),
        input_contract: z.record(z.string(), z.unknown()).describe("JSON Schema for the answer."),
      },
      annotations: { title: "Raise Human Review", ...MUTATING },
    },
    async (args: RaiseAppReviewArgs) => handleRaiseAppReview(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_resolve_app_review",
    {
      title: "Resolve Human Review",
      description: D.resolveReview,
      inputSchema: {
        review_id: reviewId,
        values: z
          .record(z.string(), z.unknown())
          .describe("Resolution values matching the review's input_contract."),
        feedback: z
          .object({
            proposal_verdict: z.enum(["correct", "incorrect", "partially_correct"]).optional(),
            correction: z.string().max(4000).optional(),
            generalize: z.boolean().optional(),
          })
          .optional()
          .describe("Optional feedback that teaches the app."),
      },
      annotations: { title: "Resolve Human Review", ...MUTATING },
    },
    async (args: ResolveAppReviewArgs) => handleResolveAppReview(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_list_app_precedents",
    {
      title: "List App Precedents",
      description: D.precedents,
      inputSchema: { app_id: appId, limit },
      annotations: { title: "List App Precedents", ...READ_ONLY },
    },
    async (args: { app_id: string; limit?: number }) =>
      handleListAppPrecedents(getToken, baseUrl, args),
  )
}
