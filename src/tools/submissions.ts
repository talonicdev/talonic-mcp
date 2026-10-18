import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, runTool } from "./_http.js"
import { validationError, type ToolResult } from "./_shared.js"

/**
 * Submissions tools: the Submissions app. Reinsurance submission workbooks
 * captured cell by cell (every value with the cells that give it meaning,
 * embedded workbooks and documents included), mapped into a client's target
 * structure (one row per figure: metric, figure, the client's fields), checked
 * for consistency (totals against their rows, cumulative triangles, declared
 * identities such as incurred = paid + LAE + outstanding), and exported in the
 * client's own long format. Values are never produced by a model; only labels
 * are classified.
 *
 * All tools hit `/v1/submissions/*` with the caller's bearer; the platform owns
 * every rule. The loop an agent runs: talonic_submissions_issues →
 * talonic_submissions_process (dry_run first) → talonic_submissions_list →
 * talonic_submissions_completeness / talonic_submissions_export. To answer a
 * question about figures: talonic_submissions_matrix → talonic_submissions_facts,
 * talonic_submissions_checks for what does not add up.
 */

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const
const write = (idempotent: boolean, destructive = false) =>
  ({
    readOnlyHint: false,
    destructiveHint: destructive,
    idempotentHint: idempotent,
    openWorldHint: false,
  }) as const

const specId = z
  .string()
  .uuid()
  .describe("Target structure id (talonic_submissions_specs). Omit to use none.")

const SPECS_DESCRIPTION = [
  "List the workspace's target structures: the client formats submissions are mapped into, with field count and how many label mappings still await review.",
  "USE WHEN: before any other submissions tool, to pick the spec_id.",
  "NOT FOR: the submissions themselves (talonic_submissions_list).",
  "",
  "ARGS: none.",
  "RETURNS: [{ id, name, updated_at, field_count, labels_to_review }].",
].join("\n")

/** @internal */
export function handleSpecs(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/submissions/specs"))
}

const LIST_DESCRIPTION = [
  "The inbox: every submission workbook of the workspace with its cedent, status (not_captured, captured, mapped, failed), captured values, facts and metrics under a target structure, and failed / warned checks.",
  'USE WHEN: the headline ("which submissions are in, which are mapped, which have problems") or finding a submission by file name.',
  "NOT FOR: what to fix (talonic_submissions_issues); the facts (talonic_submissions_export).",
  "",
  "ARGS: `spec_id` (optional), `q` (file name contains), `limit` (default 100, max 500), `offset`.",
  "RETURNS: { total, submissions[] { document_id, filename, cedent, status, tables, values, facts, metrics, checks_failed, checks_warned, embedded_files, captured_at } }.",
].join("\n")

export const listInputSchema = {
  spec_id: specId.optional(),
  q: z.string().optional().describe("File name contains."),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
}

/** @internal */
export function handleList(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { spec_id?: string; q?: string; limit?: number; offset?: number },
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/submissions", { params: args }))
}

const ISSUES_DESCRIPTION = [
  "The worklist: what needs a person, naming the submissions concerned. Kinds: not_captured, capture_failed, not_mapped, check_failed (with count), labels_to_review (with count), missing_metric (format metrics with no facts in a submission).",
  "USE WHEN: deciding what to do next; after talonic_submissions_process to see what is left.",
  "NOT FOR: the full list (talonic_submissions_list).",
  "",
  "ARGS: `spec_id` (optional; mapping-related kinds need it).",
  "RETURNS: [{ kind, document_id, filename, detail }].",
].join("\n")

export const issuesInputSchema = { spec_id: specId.optional() }

/** @internal */
export function handleIssues(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { spec_id?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/submissions/issues", { params: args }),
  )
}

const PROCESS_DESCRIPTION = [
  "Capture new workbooks and map submissions into a target structure, in bulk. Capturing is deterministic (no model); mapping classifies only labels the workspace has not seen, and reuses every earlier and every human decision. Run with dry_run first.",
  "USE WHEN: new submissions arrived (only: not_captured), or a target structure changed and submissions need re-mapping (only: not_mapped or all).",
  "NOT FOR: reading results (talonic_submissions_list, talonic_submissions_issues).",
  "",
  "ARGS: `spec_id` (map into this structure), `document_ids` (restrict), `only` not_captured|not_mapped|all (default all), `recapture` (capture again even when captured; replaces earlier facts), `limit` (default 50, max 200), `dry_run`.",
  "RETURNS: dry_run → { plan[] { document_id, filename, capture, map } }; otherwise { results[] { document_id, ok, facts?, checks_failed?, error? } }.",
].join("\n")

export const processInputSchema = {
  spec_id: specId.optional(),
  document_ids: z.array(z.string().uuid()).max(200).optional(),
  only: z.enum(["not_captured", "not_mapped", "all"]).optional(),
  recapture: z
    .boolean()
    .optional()
    .describe("Capture again even when already captured; earlier facts are replaced."),
  limit: z.number().int().min(1).max(200).optional(),
  dry_run: z.boolean().optional().describe("List what would run; nothing runs."),
}

/** @internal */
export function handleProcess(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    spec_id?: string
    document_ids?: string[]
    only?: string
    recapture?: boolean
    limit?: number
    dry_run?: boolean
  },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", "/v1/submissions/process", { body: args }),
  )
}

const COMPLETENESS_DESCRIPTION = [
  "One submission against a target structure: for every metric the client's format knows, how many facts the submission has and which fields they fill, plus metrics found that are not in the format.",
  "USE WHEN: judging whether a submission carries what a quote needs, or explaining what is missing.",
  "NOT FOR: the facts themselves (talonic_submissions_export).",
  "",
  "ARGS: `document_id`, `spec_id`.",
  "RETURNS: { metrics[] { metric, in_format, facts, fields[] } }.",
].join("\n")

export const completenessInputSchema = {
  document_id: z.string().uuid().describe("Submission (workbook document) id."),
  spec_id: specId,
}

/** @internal */
export function handleCompleteness(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { document_id: string; spec_id: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "GET",
      `/v1/submissions/${encodeURIComponent(args.document_id)}/completeness`,
      {
        params: { spec_id: args.spec_id },
      },
    ),
  )
}

const EXPORT_DESCRIPTION = [
  "Facts in the client's long format: a header (the structure's fields, then Metric, Figure, Document, Source) and one row per figure; Source is the cell the figure came from. Large: prefer one document.",
  "USE WHEN: handing facts to the client or another system, or answering a question about figures.",
  "NOT FOR: the inbox (talonic_submissions_list).",
  "",
  "ARGS: `spec_id`, `document_id` (optional; all submissions when omitted).",
  "RETURNS: { header[], rows[][] }.",
].join("\n")

export const exportInputSchema = {
  spec_id: specId,
  document_id: z.string().uuid().optional().describe("Only this submission."),
}

/** @internal */
export function handleExport(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { spec_id: string; document_id?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/submissions/export", { params: args }),
  )
}

const MATRIX_DESCRIPTION = [
  "Where one submission's figures are: facts per metric and year (accident, underwriting or reference period), every metric of the target structure included, grouped into families (premium, losses, exposure, cat, rates, other). Key '' counts facts with no period.",
  "USE WHEN: seeing what a submission covers before answering a question about it; finding which metric and year to read with talonic_submissions_facts.",
  "NOT FOR: the figures themselves (talonic_submissions_facts).",
  "",
  "ARGS: `document_id`, `spec_id`.",
  "RETURNS: { years[], rows[] { metric, family, in_format, facts, years { year: count } } }.",
].join("\n")

export const matrixInputSchema = {
  document_id: z.string().uuid().describe("Submission (workbook document) id."),
  spec_id: specId,
}

/** @internal */
export function handleMatrix(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { document_id: string; spec_id: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "GET",
      `/v1/submissions/${encodeURIComponent(args.document_id)}/matrix`,
      {
        params: { spec_id: args.spec_id },
      },
    ),
  )
}

const FACTS_DESCRIPTION = [
  'One submission\'s figures, filtered: by metric, by year (\'\' = no period) and by field values (e.g. { "LoB Client": "Homeowners", "Category": "Cat" }). Each fact carries its fields and the source cell (sheet, A1, and the embedded file when it came from one), so every number can be cited.',
  'USE WHEN: answering a question about figures ("total incurred for accident year 2019", "paid loss by line of business"). Read talonic_submissions_matrix first to pick metric and year. Do not add up facts across lines of business or categories without checking for a Total row: a total and its parts are both facts.',
  "NOT FOR: every fact of a submission (talonic_submissions_export).",
  "",
  "ARGS: `document_id`, `spec_id`, `metric`, `year`, `fields`, `limit` (1–1000, default 200), `offset`.",
  "RETURNS: { total, facts[] { metric, figure, year, fields, source { sheet, a1, embedded }, derived, total } }.",
].join("\n")

export const factsInputSchema = {
  document_id: z.string().uuid().describe("Submission (workbook document) id."),
  spec_id: specId,
  metric: z
    .string()
    .max(200)
    .optional()
    .describe("Metric name exactly as talonic_submissions_matrix lists it."),
  year: z
    .string()
    .regex(/^((19|20)\d{2})?$/)
    .optional()
    .describe("Four-digit year, or '' for facts with no period."),
  fields: z
    .record(z.string(), z.string())
    .optional()
    .describe("Field values every fact must carry."),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
}

/** @internal */
export function handleFacts(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    document_id: string
    spec_id: string
    metric?: string
    year?: string
    fields?: Record<string, string>
    limit?: number
    offset?: number
  },
): Promise<ToolResult> {
  const { document_id, fields, ...rest } = args
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", `/v1/submissions/${encodeURIComponent(document_id)}/facts`, {
      params: { ...rest, ...(fields ? { fields: JSON.stringify(fields) } : {}) },
    }),
  )
}

const CHECKS_DESCRIPTION = [
  "What does not add up in one submission: totals that are not the sum of their rows, cumulative paid amounts that fall, and the target structure's identities (e.g. Total Incurred = Paid Loss + Paid LAE + Outstanding Loss). Each with the cell, the actual and the expected figure.",
  "USE WHEN: reviewing a submission's quality, or before quoting a figure that a finding concerns.",
  "NOT FOR: counts across submissions (talonic_submissions_list).",
  "",
  "ARGS: `document_id`, `spec_id` (optional; identities need it).",
  "RETURNS: [{ kind, severity, sheet, a1, embedded, expected, actual, parts[], check }].",
].join("\n")

export const checksInputSchema = {
  document_id: z.string().uuid().describe("Submission (workbook document) id."),
  spec_id: specId.optional(),
}

/** @internal */
export function handleChecks(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { document_id: string; spec_id?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "GET",
      `/v1/submissions/${encodeURIComponent(args.document_id)}/checks`,
      {
        params: args.spec_id ? { spec_id: args.spec_id } : {},
      },
    ),
  )
}

const REVIEW_DESCRIPTION = [
  "Agentic review of a target structure's label mappings (how each spreadsheet label maps onto the client's metrics and fields). Without `start`: the review's progress and the decisions stored (confirmed, corrected, best guesses, answered by experts, still proposed, open questions). With `start: true`: rule-made mappings are confirmed, the review agent decides the rest, the few only the client can answer become questions, and every mapped submission is re-mapped; runs in the background, poll without `start`.",
  "USE WHEN: labels are waiting for review (talonic_submissions_specs shows labels_to_review) and nobody will check them one by one.",
  "NOT FOR: the questions themselves (talonic_submissions_questions).",
  "",
  "ARGS: `spec_id`, `start` (true to start a review).",
  "RETURNS: { run: { phase, done, total, stats } | null, decisions: { total, proposed, questions, confirmed, fixed, best_guess, answered } }.",
].join("\n")

export const reviewInputSchema = {
  spec_id: z.string().uuid().describe("Target structure id (talonic_submissions_specs)."),
  start: z.boolean().optional().describe("Start a review instead of reading its status."),
}

/** @internal */
export function handleReview(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { spec_id: string; start?: boolean },
): Promise<ToolResult> {
  return runTool(() =>
    args.start
      ? apiJson(getToken, baseUrl, "POST", "/v1/submissions/review", {
          body: { spec_id: args.spec_id },
        })
      : apiJson(getToken, baseUrl, "GET", "/v1/submissions/review", {
          params: { spec_id: args.spec_id },
        }),
  )
}

const QUESTIONS_DESCRIPTION = [
  "The open questions the label review left for the client's experts, one per group, heaviest first. Without `group`: the questions with their options and the labels each settles. With `group` and `option`: record the expert's answer; every label of the group takes the mapping that answer means, and the submissions are re-mapped.",
  "USE WHEN: walking the client's experts through the few questions only they can answer, or recording their answers.",
  "NOT FOR: starting a review (talonic_submissions_review).",
  "",
  "ARGS: `spec_id`; to answer: `group` (from the list) and `option` (0-based index into its options).",
  "RETURNS: list: data[] { group, question, options[], labels[] { label_key, text, where, samples[] } }; answer: { settled }.",
].join("\n")

export const questionsInputSchema = {
  spec_id: z.string().uuid().describe("Target structure id (talonic_submissions_specs)."),
  group: z.string().max(400).optional().describe("The question group to answer (from the list)."),
  option: z.number().int().min(0).max(5).optional().describe("0-based index of the chosen option."),
}

/** @internal */
export function handleQuestions(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { spec_id: string; group?: string; option?: number },
): Promise<ToolResult> {
  if ((args.group === undefined) !== (args.option === undefined)) {
    return Promise.resolve(
      validationError(
        "Give both `group` and `option` to answer, or neither to list the questions.",
      ),
    )
  }
  return runTool(() =>
    args.group !== undefined
      ? apiJson(getToken, baseUrl, "POST", "/v1/submissions/questions/answer", {
          body: { spec_id: args.spec_id, group: args.group, option: args.option },
        })
      : apiJson(getToken, baseUrl, "GET", "/v1/submissions/questions", {
          params: { spec_id: args.spec_id },
        }),
  )
}

/**
 * True when the deployment has the Submissions app and the token can read it.
 * One cheap read; a network error or any non-2xx counts as no access.
 */
export async function probeSubmissionsAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/submissions/specs"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Register the nine `talonic_submissions_*` tools. */
export function registerSubmissionsTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const tools: Array<
    [
      string,
      string,
      string,
      Record<string, z.ZodTypeAny>,
      Record<string, unknown>,
      (a: any) => Promise<ToolResult>,
    ]
  > = [
    [
      "talonic_submissions_specs",
      "Submission target structures",
      SPECS_DESCRIPTION,
      {},
      readOnly,
      () => handleSpecs(getToken, baseUrl),
    ],
    [
      "talonic_submissions_list",
      "Submissions inbox",
      LIST_DESCRIPTION,
      listInputSchema,
      readOnly,
      (a) => handleList(getToken, baseUrl, a),
    ],
    [
      "talonic_submissions_issues",
      "Submissions worklist",
      ISSUES_DESCRIPTION,
      issuesInputSchema,
      readOnly,
      (a) => handleIssues(getToken, baseUrl, a),
    ],
    [
      "talonic_submissions_process",
      "Capture and map submissions",
      PROCESS_DESCRIPTION,
      processInputSchema,
      write(true),
      (a) => handleProcess(getToken, baseUrl, a),
    ],
    [
      "talonic_submissions_completeness",
      "Submission completeness",
      COMPLETENESS_DESCRIPTION,
      completenessInputSchema,
      readOnly,
      (a) => handleCompleteness(getToken, baseUrl, a),
    ],
    [
      "talonic_submissions_matrix",
      "Submission facts by metric and year",
      MATRIX_DESCRIPTION,
      matrixInputSchema,
      readOnly,
      (a) => handleMatrix(getToken, baseUrl, a),
    ],
    [
      "talonic_submissions_facts",
      "Submission figures",
      FACTS_DESCRIPTION,
      factsInputSchema,
      readOnly,
      (a) => handleFacts(getToken, baseUrl, a),
    ],
    [
      "talonic_submissions_checks",
      "Submission checks",
      CHECKS_DESCRIPTION,
      checksInputSchema,
      readOnly,
      (a) => handleChecks(getToken, baseUrl, a),
    ],
    [
      "talonic_submissions_review",
      "Review label mappings",
      REVIEW_DESCRIPTION,
      reviewInputSchema,
      write(true),
      (a) => handleReview(getToken, baseUrl, a),
    ],
    [
      "talonic_submissions_questions",
      "Questions for the client's experts",
      QUESTIONS_DESCRIPTION,
      questionsInputSchema,
      write(true),
      (a) => handleQuestions(getToken, baseUrl, a),
    ],
    [
      "talonic_submissions_export",
      "Export submission facts",
      EXPORT_DESCRIPTION,
      exportInputSchema,
      readOnly,
      (a) => handleExport(getToken, baseUrl, a),
    ],
  ]
  for (const [name, title, description, inputSchema, annotations, handler] of tools) {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations } },
      async (args: unknown) => handler(args),
    )
  }
}
