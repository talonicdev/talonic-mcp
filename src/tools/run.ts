import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiForm, apiJson, runTool, type QueryParams } from "./_http.js"
import { validationError, type ToolResult } from "./_shared.js"
import { widgetToolMeta } from "../widgets/types.js"

/**
 * Run tools — execute a Spec's configured pipeline and read its results.
 *
 * Two backends behind one contract:
 * - `document_ids` (documents already in the workspace) → `POST /v1/pipelines`
 *   (`schema_id` = the Spec id). Poll with `pipeline_id`.
 * - `file_urls` (remote files) → `POST /v1/run` (multipart). Poll with `run_id`.
 *
 * Every response is normalised to the RunEnvelope so the agent never has to
 * know which route ran.
 */

export type RunStatus = "processing" | "completed" | "failed"

/** Fold the two routes' status vocabularies into processing | completed | failed. */
export function mapRunStatus(raw: unknown): RunStatus {
  if (raw === "completed") return "completed"
  if (raw === "failed" || raw === "error" || raw === "cancelled") return "failed"
  return "processing"
}

const RUN_DESCRIPTION = [
  "Run a Spec — the customer's configured pipeline — over documents, in one call. Two inputs: `document_ids` (documents already in the workspace; for a new file, first talonic_request_upload → poll talonic_get_document until completed) OR `file_urls` (public https files, max 20; Talonic ingests them first). Consumes credits.",
  "",
  "USE WHEN: the user wants to 'run the invoice pipeline on these documents', process files through their Spec, or produce the Spec's structured rows.",
  "NOT FOR: one-off extraction with an ad-hoc schema (talonic_extract), or checking progress (talonic_get_run) / reading rows (talonic_get_run_results).",
  "ARGS: `spec_id` (talonic_list_specs); exactly one of `document_ids[]` (1–500) or `file_urls[]` (1–20, https); optional `name`, `pipeline_mode` (`new` default | `append` to the Spec's existing pipeline); `batch_id` and flat `metadata` only with file_urls.",
  "RETURNS: RunEnvelope { run_kind ('pipeline'|'run'), run_id, pipeline_id, spec_id, status ('processing'|'completed'|'failed'), raw_status, input_count, documents?, message?, links }. Then poll talonic_get_run every 5–10 s with the pipeline_id (or run_id) until status is completed/failed, then talonic_get_run_results.",
].join("\n")

const GET_RUN_DESCRIPTION = [
  "Poll a Spec run started by talonic_run_spec: normalised status plus document-level progress and, for pipelines, per-phase progress.",
  "",
  "USE WHEN: waiting for a run to finish — poll every 5–10 s; stop on `completed` or `failed`.",
  "NOT FOR: reading the structured rows (talonic_get_run_results) or starting a run (talonic_run_spec).",
  "ARGS: exactly one of `pipeline_id` (run_kind 'pipeline') or `run_id` (run_kind 'run'), from the RunEnvelope.",
  "RETURNS: { run_kind, run_id, pipeline_id, spec_id, status, raw_status, input_count?, progress { total_documents, completed_documents, error_documents, phases?[] }, documents?[], error_message?, created_at, updated_at }.",
].join("\n")

const RESULTS_DESCRIPTION = [
  "Read a Spec run's structured rows — one row per document with the Spec's fields as clean values (held/pending-review cells serialize null), plus the column definitions.",
  "",
  "USE WHEN: talonic_get_run reports `completed` (partial rows are also readable while `processing`).",
  "NOT FOR: progress (talonic_get_run) or per-field provenance of a single value (include: ['provenance'] here, or talonic_field_values).",
  "ARGS: exactly one of `pipeline_id` or `run_id`; optional `document_id` (one document), `include` (['cells','provenance'] — heavier payload), `limit` (1–200, default 50), `cursor`.",
  "RETURNS: { run_kind, status, columns[] of { field_key, display_name, data_type }, data[] of { document_id, filename, record_id, status ('complete'|'partial'|'error'|'processing'), completed_at, fields { field_key: value }, cells?, provenance? }, pagination, pending_review_count, links }.",
].join("\n")

const uuid = z.string().uuid()
const documentIdsArg = z
  .array(uuid)
  .min(1)
  .max(500)
  .optional()
  .describe("Workspace document ids (1–500). Mutually exclusive with file_urls.")
const fileUrlsArg = z
  .array(z.string().url())
  .min(1)
  .max(20)
  .optional()
  .describe("Public https file URLs (1–20). Mutually exclusive with document_ids.")
const metadataArg = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .optional()
  .describe("Flat caller tags stamped on every ingested document (file_urls path only).")

const runSpecInputSchema = {
  spec_id: uuid.describe("Spec UUID (talonic_list_specs)."),
  document_ids: documentIdsArg,
  file_urls: fileUrlsArg,
  name: z.string().min(1).max(200).optional().describe("Display name for the run."),
  pipeline_mode: z
    .enum(["new", "append"])
    .optional()
    .describe("`new` (default) or `append` to the Spec's existing pipeline."),
  batch_id: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Caller grouping key (file_urls path only)."),
  metadata: metadataArg,
}

const runRefInputSchema = {
  run_id: uuid.optional().describe("From a run_kind 'run' envelope (/v1/run)."),
  pipeline_id: uuid.optional().describe("From a run_kind 'pipeline' envelope (/v1/pipelines)."),
}

const resultsInputSchema = {
  ...runRefInputSchema,
  document_id: uuid.optional().describe("Restrict to one document."),
  include: z
    .array(z.enum(["cells", "provenance"]))
    .optional()
    .describe("Extra per-field detail; heavier payload."),
  limit: z.number().int().min(1).max(200).optional().describe("Page size (default 50)."),
  cursor: z.string().min(1).optional().describe("Opaque cursor from pagination.next_cursor."),
}

export interface RunSpecArgs {
  spec_id: string
  document_ids?: string[]
  file_urls?: string[]
  name?: string
  pipeline_mode?: "new" | "append"
  batch_id?: string
  metadata?: Record<string, string | number | boolean | null>
}

export interface RunRefArgs {
  run_id?: string
  pipeline_id?: string
}

export interface RunResultsArgs extends RunRefArgs {
  document_id?: string
  include?: Array<"cells" | "provenance">
  limit?: number
  cursor?: string
}

interface CreatePipelineResponse {
  id: string
  status?: string
  schema?: { id?: string; name?: string }
  document_count?: number
  enqueued_documents?: number
  appended?: boolean
  run_id?: string
  message?: string
  links?: Record<string, string>
}

interface CreateRunResponse {
  run_id: string
  spec_id?: string
  status?: string
  input_count?: number
  poll_url?: string
  documents?: unknown[]
}

interface PipelineProgressResponse {
  status?: string
  totalDocuments?: number
  completedDocuments?: number
  errorDocuments?: number
  finalizationPending?: string[] | null
  phases?: Array<{
    phaseId?: string
    name?: string
    type?: string
    completed?: number
    running?: number
    errors?: number
  }>
}

function pickRef(
  args: RunRefArgs,
): { kind: "run"; id: string } | { kind: "pipeline"; id: string } | null {
  const hasRun = typeof args.run_id === "string" && args.run_id.length > 0
  const hasPipe = typeof args.pipeline_id === "string" && args.pipeline_id.length > 0
  if (hasRun === hasPipe) return null
  return hasPipe
    ? { kind: "pipeline", id: args.pipeline_id as string }
    : { kind: "run", id: args.run_id as string }
}

/** @internal Exported for unit testing. */
export async function handleRunSpec(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RunSpecArgs,
): Promise<ToolResult> {
  const docs =
    Array.isArray(args.document_ids) && args.document_ids.length > 0 ? args.document_ids : null
  const urls = Array.isArray(args.file_urls) && args.file_urls.length > 0 ? args.file_urls : null
  if ((docs === null) === (urls === null)) {
    return validationError("provide exactly one of document_ids or file_urls (non-empty).")
  }
  if (urls && urls.some((u) => !u.startsWith("https://"))) {
    return validationError("every file_urls entry must start with https://.")
  }
  if (docs && (args.batch_id !== undefined || args.metadata !== undefined)) {
    return validationError(
      "batch_id and metadata only apply to the file_urls path; drop them for document_ids.",
    )
  }
  return runTool(async () => {
    if (docs) {
      const res = await apiJson<CreatePipelineResponse>(
        getToken,
        baseUrl,
        "POST",
        "/v1/pipelines",
        {
          body: {
            schema_id: args.spec_id,
            document_ids: docs,
            ...(args.name ? { name: args.name } : {}),
            ...(args.pipeline_mode ? { pipeline_mode: args.pipeline_mode } : {}),
          },
        },
      )
      return {
        run_kind: "pipeline",
        run_id: res.run_id ?? null,
        pipeline_id: res.id,
        spec_id: res.schema?.id ?? args.spec_id,
        spec_name: res.schema?.name ?? null,
        status: mapRunStatus(res.status),
        raw_status: res.status ?? null,
        input_count: res.document_count ?? docs.length,
        enqueued_documents: res.enqueued_documents ?? null,
        appended: res.appended === true,
        message: res.message ?? null,
        links: res.links ?? {},
      }
    }
    const res = await apiForm<CreateRunResponse>(getToken, baseUrl, "/v1/run", {
      spec_id: args.spec_id,
      file_urls: urls as string[],
      name: args.name,
      pipeline_mode: args.pipeline_mode,
      batch_id: args.batch_id,
      metadata: args.metadata ? JSON.stringify(args.metadata) : undefined,
    })
    return {
      run_kind: "run",
      run_id: res.run_id,
      pipeline_id: null,
      spec_id: res.spec_id ?? args.spec_id,
      spec_name: null,
      status: mapRunStatus(res.status),
      raw_status: res.status ?? null,
      input_count: res.input_count ?? (urls as string[]).length,
      documents: res.documents ?? [],
      message: null,
      links: { poll: res.poll_url ?? `/v1/run/${res.run_id}` },
    }
  })
}

/** @internal Exported for unit testing. */
export async function handleGetRun(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RunRefArgs,
): Promise<ToolResult> {
  const ref = pickRef(args)
  if (!ref) return validationError("provide exactly one of run_id or pipeline_id.")
  return runTool(async () => {
    if (ref.kind === "run") {
      const r = await apiJson<Record<string, unknown>>(
        getToken,
        baseUrl,
        "GET",
        `/v1/run/${encodeURIComponent(ref.id)}`,
      )
      return {
        run_kind: "run",
        run_id: (r["run_id"] as string) ?? ref.id,
        pipeline_id: (r["pipeline_id"] as string | undefined) ?? null,
        spec_id: (r["spec_id"] as string | undefined) ?? null,
        status: mapRunStatus(r["status"]),
        raw_status: r["status"] ?? null,
        input_count: r["input_count"] ?? null,
        progress: r["progress"] ?? null,
        documents: r["documents"] ?? undefined,
        error_message: r["error_message"] ?? null,
        batch_id: r["batch_id"] ?? null,
        created_at: r["created_at"] ?? null,
        updated_at: r["updated_at"] ?? null,
      }
    }
    const base = `/v1/pipelines/${encodeURIComponent(ref.id)}`
    const p = await apiJson<Record<string, unknown>>(getToken, baseUrl, "GET", base)
    const pr = await apiJson<PipelineProgressResponse>(getToken, baseUrl, "GET", `${base}/progress`)
    const raw = pr.status ?? (p["status"] as string | undefined)
    return {
      run_kind: "pipeline",
      run_id: null,
      pipeline_id: (p["id"] as string) ?? ref.id,
      spec_id: (p["schema"] as { id?: string } | undefined)?.id ?? null,
      name: p["name"] ?? null,
      status: mapRunStatus(raw),
      raw_status: raw ?? null,
      progress: {
        total_documents: pr.totalDocuments ?? null,
        completed_documents: pr.completedDocuments ?? null,
        error_documents: pr.errorDocuments ?? null,
        finalization_pending: pr.finalizationPending ?? null,
        phases: (pr.phases ?? []).map((ph) => ({
          phase_id: ph.phaseId ?? null,
          name: ph.name ?? null,
          type: ph.type ?? null,
          completed: ph.completed ?? null,
          running: ph.running ?? null,
          errors: ph.errors ?? null,
        })),
      },
      created_at: p["created_at"] ?? null,
      links: p["links"] ?? {},
    }
  })
}

/** @internal Exported for unit testing. */
export async function handleGetRunResults(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RunResultsArgs,
): Promise<ToolResult> {
  const ref = pickRef(args)
  if (!ref) return validationError("provide exactly one of run_id or pipeline_id.")
  return runTool(async () => {
    const params: QueryParams = {
      ...(ref.kind === "pipeline" ? { view: "documents" } : {}),
      document_id: args.document_id,
      include: args.include?.length ? args.include.join(",") : undefined,
      limit: args.limit,
      cursor: args.cursor,
    }
    const path =
      ref.kind === "run"
        ? `/v1/run/${encodeURIComponent(ref.id)}/results`
        : `/v1/pipelines/${encodeURIComponent(ref.id)}/results`
    const body = await apiJson<Record<string, unknown>>(getToken, baseUrl, "GET", path, { params })
    return { run_kind: ref.kind, ...body }
  })
}

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

/** Register the three run tools. @internal */
export function registerRunTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_run_spec",
    {
      title: "Run a Spec pipeline",
      description: RUN_DESCRIPTION,
      inputSchema: runSpecInputSchema,
      annotations: {
        title: "Run a Spec pipeline",
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: widgetToolMeta("runSpec"),
    },
    async (args) => handleRunSpec(getToken, baseUrl, args as RunSpecArgs),
  )
  server.registerTool(
    "talonic_get_run",
    {
      title: "Poll a Spec run",
      description: GET_RUN_DESCRIPTION,
      inputSchema: runRefInputSchema,
      annotations: { title: "Poll a Spec run", ...READ_ONLY },
      _meta: widgetToolMeta("getRun"),
    },
    async (args) => handleGetRun(getToken, baseUrl, args as RunRefArgs),
  )
  server.registerTool(
    "talonic_get_run_results",
    {
      title: "Read a Spec run's rows",
      description: RESULTS_DESCRIPTION,
      inputSchema: resultsInputSchema,
      annotations: { title: "Read a Spec run's rows", ...READ_ONLY },
      _meta: widgetToolMeta("getRunResults"),
    },
    async (args) => handleGetRunResults(getToken, baseUrl, args as RunResultsArgs),
  )
}
