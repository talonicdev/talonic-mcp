import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, probeAccessState, type HttpMethod, type QueryParams } from "./_http.js"
import { IDEMPOTENT_SENTENCE, idempotencyHeaders, runWrite } from "./_idempotency.js"
import { type ToolResult, zUuid } from "./_shared.js"

/**
 * Review tools: work the review queue the way a reviewer does in the app,
 * for the person behind the credential, and keep benchmark answers current.
 *
 * Field review (`/v1/field-reviews/*`, `/v1/field-review-notes`): list held
 * values, claim a batch, inspect the evidence and the cited page, resolve or
 * propose a correction, recommend where you may not decide, read the
 * decision log as the receipt. Benchmarks (`/v1/structuring/*`,
 * `/v1/validation/*`): approve results in bulk, compare sources and choose
 * the value to keep, read field accuracy, correct an expected value, decide
 * flagged values.
 *
 * The loop an agent runs: talonic_review_claim → talonic_review_inspect →
 * talonic_review_resolve (or _propose_correction / _recommend) →
 * talonic_review_decisions → talonic_review_claims release for what is left.
 *
 * The platform owns every rule (scopes, the person's permissions, document
 * visibility, claims); these tools only forward.
 */

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const
const write = (idempotent: boolean) =>
  ({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: idempotent,
    openWorldHint: false,
  }) as const

/** One review tool: name, title, description, input shape, annotations and handler. */
export interface ReviewToolSpec {
  name: string
  title: string
  description: string
  inputSchema: Record<string, z.ZodTypeAny>
  annotations: ReturnType<typeof write> | typeof readOnly
  handler: (args: any) => Promise<ToolResult>
}

const READ_SCOPE = "Needs the reviews:read (or read) scope."
const WRITE_SCOPE =
  "Needs the reviews:write scope; the person behind the credential needs the edit permission in the workspace."

const docIdArg = zUuid().describe(
  "The pipeline_document_id of a review item (from talonic_review_list or talonic_review_claim).",
)
const fieldKeyArg = z.string().min(1).max(256).describe("The field_key of the review item.")
const idempotencyArg = z
  .string()
  .min(1)
  .max(64)
  .optional()
  .describe("Optional Idempotency-Key; a retry with the same key returns the first result.")

const item = (docId: string, fieldKey: string) =>
  `/v1/field-reviews/${encodeURIComponent(docId)}/${encodeURIComponent(fieldKey)}`

/** Drop undefined entries so a body names only what the caller gave. */
function defined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

function lines(...parts: string[]): string {
  return parts.join("\n")
}

/**
 * The review tool set for one credential.
 *
 * @internal Exported for tests.
 */
export function reviewTools(getToken: () => string, baseUrl?: string): ReviewToolSpec[] {
  const read = (path: string, params?: QueryParams) =>
    runWrite(() => apiJson(getToken, baseUrl, "GET", path, params ? { params } : {}))
  const send = (
    tool: string,
    args: Record<string, unknown>,
    derive: boolean,
    method: HttpMethod,
    path: string,
    body?: unknown,
  ) =>
    runWrite(() =>
      apiJson(getToken, baseUrl, method, path, {
        ...(body !== undefined ? { body } : {}),
        headers: idempotencyHeaders(tool, args, derive),
      }),
    )

  return [
    {
      name: "talonic_review_list",
      title: "List review items",
      description: lines(
        "The review queue: values held for a human decision before they count, newest first, each with its current value, confidence and why it is held.",
        "USE WHEN: finding review work or checking what is left. To take items for yourself use talonic_review_claim.",
        "NOT FOR: one item's evidence (talonic_review_inspect).",
        `ARGS: pipeline_id?, trigger? (gate | declarative), status? (blocked | pending_review), limit?, cursor? (next_cursor of the previous page). ${READ_SCOPE}`,
        "RETURNS: { data[]: { pipeline_document_id, field_key, status, reason, current_value, confidence, document, pipeline }, pagination { total, has_more, next_cursor } }.",
      ),
      inputSchema: {
        pipeline_id: zUuid().optional().describe("Only items of this run."),
        trigger: z.enum(["gate", "declarative"]).optional(),
        status: z.enum(["blocked", "pending_review"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      },
      annotations: readOnly,
      handler: (a) => read("/v1/field-reviews", defined(a) as QueryParams),
    },
    {
      name: "talonic_review_claim",
      title: "Claim review items",
      description: lines(
        "Claim the next review items for the person behind the credential, in queue order under the filters. Concurrent reviewers and agents get different items; items freshly held by someone else are skipped (held_by_others).",
        "USE WHEN: starting review work. Keep the claim with talonic_review_claims (touch) while working; release what you will not decide.",
        "NOT FOR: browsing without claiming (talonic_review_list).",
        `ARGS: pipeline_id?, field_key?, reason?, batch_size? (1-200), start_key? ("<pipeline_document_id>:<field_key>"), idempotency_key?. ${WRITE_SCOPE} Pass idempotency_key to make a retry return the same batch.`,
        "RETURNS: { claimed_by, items[], total, held_by_others }.",
      ),
      inputSchema: {
        pipeline_id: zUuid().optional(),
        field_key: z.string().max(256).optional(),
        reason: z
          .string()
          .max(64)
          .optional()
          .describe("Only items of this review reason, as talonic_review_list shows it."),
        batch_size: z.number().int().min(1).max(200).optional(),
        start_key: z.string().max(600).optional(),
        idempotency_key: idempotencyArg,
      },
      annotations: write(false),
      handler: (a) => {
        const { idempotency_key: _k, ...body } = a
        return send(
          "talonic_review_claim",
          a,
          false,
          "POST",
          "/v1/field-reviews/checkout",
          defined(body),
        )
      },
    },
    {
      name: "talonic_review_claims",
      title: "Keep or release review claims",
      description: lines(
        "Keep the listed claims alive (touch) or hand them back to the queue (release). Only claims of the person behind the credential change; safe to repeat.",
        "USE WHEN: working a batch for more than a few minutes (touch), or done with items you will not decide (release).",
        `ARGS: action (touch | release), items[] { pipeline_document_id, field_key }. ${WRITE_SCOPE}`,
        "RETURNS: { ok, action, items }.",
      ),
      inputSchema: {
        action: z.enum(["touch", "release"]),
        items: z
          .array(z.object({ pipeline_document_id: zUuid(), field_key: z.string().min(1).max(256) }))
          .min(1)
          .max(200),
      },
      annotations: write(true),
      handler: (a) =>
        send("talonic_review_claims", a, false, "POST", "/v1/field-reviews/claims", {
          action: a.action,
          items: a.items,
        }),
    },
    {
      name: "talonic_review_assign",
      title: "Claim or release one review item",
      description: lines(
        "Claim (assign: true) or release (assign: false) one review item for the person behind the credential. An item freshly held by someone else answers a conflict.",
        "USE WHEN: taking one specific item. For a batch use talonic_review_claim.",
        `ARGS: pipeline_document_id, field_key, assign. ${WRITE_SCOPE}`,
        "RETURNS: { assigned, assigned_to }.",
      ),
      inputSchema: { pipeline_document_id: docIdArg, field_key: fieldKeyArg, assign: z.boolean() },
      annotations: write(true),
      handler: (a) =>
        send(
          "talonic_review_assign",
          a,
          false,
          "POST",
          `${item(a.pipeline_document_id, a.field_key)}/assign`,
          {
            assign: a.assign,
          },
        ),
    },
    {
      name: "talonic_review_inspect",
      title: "Inspect a review item",
      description: lines(
        "The evidence behind a held value: the value, its history, check results, prior decisions and the source passages it came from with their document and page. The cited page itself is at GET /v1/documents/{id}/file.",
        "USE WHEN: before deciding an item. Quote a passage from the cited document as evidence_quote in talonic_review_resolve.",
        "NOT FOR: the whole document's comparison with reference values (talonic_review_reference_view).",
        `ARGS: pipeline_document_id, field_key. ${READ_SCOPE}`,
        "RETURNS: the reviewer detail (item, field, history, verdicts, source spans, prior decisions).",
      ),
      inputSchema: { pipeline_document_id: docIdArg, field_key: fieldKeyArg },
      annotations: readOnly,
      handler: (a) => read(`${item(a.pipeline_document_id, a.field_key)}/provenance`),
    },
    {
      name: "talonic_review_reference_view",
      title: "Compare a document with its reference values",
      description: lines(
        "Every field of one document in a run beside its reference value (reference table, a check's expected value, or the matched master record); status none when there is no reference.",
        "USE WHEN: deciding several fields of one document against known values.",
        `ARGS: pipeline_document_id. ${READ_SCOPE}`,
        "RETURNS: { status, source, tableName, key, fields[], extras[] }.",
      ),
      inputSchema: { pipeline_document_id: docIdArg },
      annotations: readOnly,
      handler: (a) =>
        read(`/v1/field-reviews/reference-view/${encodeURIComponent(a.pipeline_document_id)}`),
    },
    {
      name: "talonic_review_resolve",
      title: "Resolve a review item",
      description: lines(
        "Decide a held value: approve keeps it, correct or override promotes corrected_value, accept_proposal promotes a proposed correction. The field then continues its processing; the decision is logged.",
        "USE WHEN: you inspected the item and know the right value. Give evidence_quote (verbatim text from the cited document) with document_id when correcting.",
        "NOT FOR: a field that is not in review (talonic_review_propose_correction); a field you may not decide (talonic_review_recommend).",
        `ARGS: pipeline_document_id, field_key, action, corrected_value?, reason?, clear_value?, evidence_quote?, document_id?, reopen? (revise an earlier decision), idempotency_key?. ${WRITE_SCOPE} ${IDEMPOTENT_SENTENCE}`,
        "RETURNS: the field's new state.",
      ),
      inputSchema: {
        pipeline_document_id: docIdArg,
        field_key: fieldKeyArg,
        action: z.enum(["approve", "correct", "override", "accept_proposal"]),
        corrected_value: z.string().max(10000).optional(),
        reason: z.string().max(2000).optional(),
        clear_value: z.boolean().optional().describe("With correct: clear the field instead."),
        evidence_quote: z
          .string()
          .optional()
          .describe("Verbatim passage from document_id supporting the value."),
        document_id: zUuid()
          .optional()
          .describe("The workspace document the evidence_quote is from."),
        reopen: z.boolean().optional(),
        idempotency_key: idempotencyArg,
      },
      annotations: write(true),
      handler: (a) => {
        const { pipeline_document_id, field_key, idempotency_key: _k, ...body } = a
        return send(
          "talonic_review_resolve",
          a,
          true,
          "POST",
          `${item(pipeline_document_id, field_key)}/resolve`,
          defined(body),
        )
      },
    },
    {
      name: "talonic_review_propose_correction",
      title: "Propose a correction",
      description: lines(
        "Propose a new value for a field that is NOT in review: it re-opens for a reviewer with your proposal attached. The value changes only when someone resolves it.",
        "USE WHEN: you found a wrong value in finished output.",
        "NOT FOR: items already held for review (talonic_review_resolve).",
        `ARGS: pipeline_document_id, field_key, proposed_value (or clear: true), reason, evidence_quote?, idempotency_key?. ${WRITE_SCOPE} ${IDEMPOTENT_SENTENCE}`,
        "RETURNS: { reopened, ... }.",
      ),
      inputSchema: {
        pipeline_document_id: docIdArg,
        field_key: fieldKeyArg,
        proposed_value: z.string().optional(),
        clear: z.boolean().optional(),
        reason: z.string().min(1),
        evidence_quote: z.string().optional(),
        idempotency_key: idempotencyArg,
      },
      annotations: write(true),
      handler: (a) => {
        const { pipeline_document_id, field_key, idempotency_key: _k, ...body } = a
        return send(
          "talonic_review_propose_correction",
          a,
          true,
          "POST",
          `${item(pipeline_document_id, field_key)}/reopen`,
          defined({ ...body, source: "human" }),
        )
      },
    },
    {
      name: "talonic_review_recommend",
      title: "Recommend a decision",
      description: lines(
        "Leave a recommendation on an item the person behind the credential may not decide (a field marked complex), for a reviewer who can. The value does not change.",
        "USE WHEN: talonic_review_resolve was refused for a complex field.",
        `ARGS: pipeline_document_id, field_key, recommended_action (approve | correct), corrected_value?, reason, idempotency_key?. ${WRITE_SCOPE} ${IDEMPOTENT_SENTENCE}`,
        "RETURNS: the recommendation.",
      ),
      inputSchema: {
        pipeline_document_id: docIdArg,
        field_key: fieldKeyArg,
        recommended_action: z.enum(["approve", "correct"]),
        corrected_value: z.string().max(10000).optional(),
        reason: z.string().min(1).max(2000),
        idempotency_key: idempotencyArg,
      },
      annotations: write(true),
      handler: (a) => {
        const { pipeline_document_id, field_key, idempotency_key: _k, ...body } = a
        return send(
          "talonic_review_recommend",
          a,
          true,
          "POST",
          `${item(pipeline_document_id, field_key)}/recommend`,
          defined(body),
        )
      },
    },
    {
      name: "talonic_review_decisions",
      title: "Review decision log",
      description: lines(
        "Who decided what: prior and final value, action and reason per field. The receipt for resolved items.",
        "USE WHEN: confirming a decision was recorded, or reporting review outcomes.",
        `ARGS: pipeline_id? (omit for the whole workspace). ${READ_SCOPE}`,
        "RETURNS: the decision rows.",
      ),
      inputSchema: { pipeline_id: zUuid().optional() },
      annotations: readOnly,
      handler: (a) => read("/v1/field-reviews/decisions", defined(a) as QueryParams),
    },
    {
      name: "talonic_review_metrics",
      title: "Review progress for a run",
      description: lines(
        "How far review of one run has come: fields that entered review, fields decided, and the approved / corrected / overridden mix.",
        `ARGS: pipeline_id. ${READ_SCOPE}`,
        "RETURNS: { fieldsInReview, decided, decisions { approve, correct, override, total }, documents { total, duplicates } }.",
      ),
      inputSchema: { pipeline_id: zUuid() },
      annotations: readOnly,
      handler: (a) => read("/v1/field-reviews/metrics", { pipeline_id: a.pipeline_id }),
    },
    {
      name: "talonic_review_notes",
      title: "Review notes on a field",
      description: lines(
        "Reviewer guidance kept for everyone reviewing a field, newest first.",
        "USE WHEN: before deciding items of a field, to follow the workspace's own rules.",
        `ARGS: field_key. ${READ_SCOPE}`,
        "RETURNS: notes[] { id, fieldKey, body, author, createdAt }.",
      ),
      inputSchema: { field_key: z.string().min(1).max(200) },
      annotations: readOnly,
      handler: (a) => read("/v1/field-review-notes", { field_key: a.field_key }),
    },
    {
      name: "talonic_review_add_note",
      title: "Add a review note",
      description: lines(
        "Add guidance to a field for everyone reviewing it, written as the person behind the credential.",
        "USE WHEN: the user asks to record how a field should be checked.",
        `ARGS: field_key, body, idempotency_key?. ${WRITE_SCOPE} ${IDEMPOTENT_SENTENCE}`,
        "RETURNS: the note.",
      ),
      inputSchema: {
        field_key: z.string().min(1).max(200),
        body: z.string().min(1).max(4000),
        idempotency_key: idempotencyArg,
      },
      annotations: write(true),
      handler: (a) =>
        send("talonic_review_add_note", a, true, "POST", "/v1/field-review-notes", {
          field_key: a.field_key,
          body: a.body,
        }),
    },
    // ── Benchmarks and approvals ────────────────────────────────────────────
    {
      name: "talonic_review_bulk_approve",
      title: "Approve results in bulk",
      description: lines(
        "Approve many results waiting for approval at once, as the person behind the credential. One result that cannot be approved never stops the rest.",
        `ARGS: result_ids[], idempotency_key?. ${WRITE_SCOPE} ${IDEMPOTENT_SENTENCE}`,
        "RETURNS: { approved, failed }.",
      ),
      inputSchema: { result_ids: z.array(zUuid()).min(1), idempotency_key: idempotencyArg },
      annotations: write(true),
      handler: (a) =>
        send(
          "talonic_review_bulk_approve",
          a,
          true,
          "POST",
          "/v1/structuring/approvals/bulk-approve",
          {
            result_ids: a.result_ids,
          },
        ),
    },
    {
      name: "talonic_review_compare_sources",
      title: "Compare sources for an approval",
      description: lines(
        "Field by field, what each source said for an approval decision, with the supporting passage, to choose the value to keep.",
        "USE WHEN: before talonic_review_choose_value.",
        `ARGS: decision_id, validation_run_id?. ${READ_SCOPE}`,
        "RETURNS: { data[]: per-field source values }.",
      ),
      inputSchema: { decision_id: zUuid(), validation_run_id: zUuid().optional() },
      annotations: readOnly,
      handler: (a) =>
        read(
          `/v1/structuring/approval-decisions/${encodeURIComponent(a.decision_id)}/diffs`,
          defined({ validation_run_id: a.validation_run_id }) as QueryParams,
        ),
    },
    {
      name: "talonic_review_choose_value",
      title: "Choose the value to keep",
      description: lines(
        "Record the value to keep for one field of an approval decision, from a source (source_pick) or typed (free_text).",
        `ARGS: decision_id, field_name, canonical_value, selection_method, source_values[] { source_label, value, source_text, document_id }, validation_run_id?, data_product_id?, idempotency_key?. ${WRITE_SCOPE} ${IDEMPOTENT_SENTENCE}`,
        "RETURNS: the recorded selection.",
      ),
      inputSchema: {
        decision_id: zUuid(),
        field_name: z.string().min(1).max(200),
        canonical_value: z.string().max(10000),
        selection_method: z.enum(["source_pick", "free_text"]),
        source_values: z.array(
          z.object({
            source_label: z.string(),
            value: z.string().nullable(),
            source_text: z.string().nullable(),
            document_id: z.string().nullable(),
          }),
        ),
        validation_run_id: zUuid().optional(),
        data_product_id: zUuid().optional(),
        idempotency_key: idempotencyArg,
      },
      annotations: write(true),
      handler: (a) => {
        const { decision_id, idempotency_key: _k, ...body } = a
        return send(
          "talonic_review_choose_value",
          a,
          true,
          "POST",
          `/v1/structuring/approval-decisions/${encodeURIComponent(decision_id)}/canonical`,
          defined(body),
        )
      },
    },
    {
      name: "talonic_review_list_benchmarks",
      title: "List benchmark runs",
      description: lines(
        "Benchmark runs (comparisons against your own answers and run reviews), or with kind: checks the run-to-run comparisons and rule checks, newest first.",
        "USE WHEN: finding a benchmark to read accuracy from.",
        `ARGS: kind? (benchmarks | checks; default benchmarks). ${READ_SCOPE}`,
        "RETURNS: { data[]: runs with comparison_type }.",
      ),
      inputSchema: { kind: z.enum(["benchmarks", "checks"]).optional() },
      annotations: readOnly,
      handler: (a) =>
        read(
          a.kind === "checks" ? "/v1/validation/runs/sessions" : "/v1/validation/runs/benchmarks",
        ),
    },
    {
      name: "talonic_review_field_accuracy",
      title: "Field accuracy in a benchmark",
      description: lines(
        "Expected against extracted values of one field across a benchmark's documents: where the field is right and how it goes wrong.",
        `ARGS: run_id, field_name. ${READ_SCOPE}`,
        "RETURNS: the field's expected/actual breakdown.",
      ),
      inputSchema: { run_id: zUuid(), field_name: z.string().min(1) },
      annotations: readOnly,
      handler: (a) =>
        read(
          `/v1/validation/runs/${encodeURIComponent(a.run_id)}/confusion-matrix/${encodeURIComponent(a.field_name)}`,
        ),
    },
    {
      name: "talonic_review_update_expected_value",
      title: "Correct an expected value",
      description: lines(
        "Correct one expected value in a golden sample (your own answers a benchmark compares against); null clears it.",
        `ARGS: golden_sample_id, value_id, expected_value (string or null), idempotency_key?. ${WRITE_SCOPE} ${IDEMPOTENT_SENTENCE}`,
        "RETURNS: the updated value.",
      ),
      inputSchema: {
        golden_sample_id: zUuid(),
        value_id: zUuid(),
        expected_value: z.string().max(10000).nullable(),
        idempotency_key: idempotencyArg,
      },
      annotations: write(true),
      handler: (a) =>
        send(
          "talonic_review_update_expected_value",
          a,
          true,
          "PATCH",
          `/v1/validation/ground-truth/${encodeURIComponent(a.golden_sample_id)}/values/${encodeURIComponent(a.value_id)}`,
          { expected_value: a.expected_value },
        ),
    },
    {
      name: "talonic_review_rematch_golden_sample",
      title: "Re-link a golden sample to documents",
      description: lines(
        "Re-link a golden sample's rows to workspace documents, for example after uploading the documents it names.",
        `ARGS: golden_sample_id, idempotency_key?. ${WRITE_SCOPE}`,
        "RETURNS: { matched, unmatched }.",
      ),
      inputSchema: { golden_sample_id: zUuid(), idempotency_key: idempotencyArg },
      annotations: write(true),
      handler: (a) =>
        send(
          "talonic_review_rematch_golden_sample",
          a,
          false,
          "POST",
          `/v1/validation/ground-truth/${encodeURIComponent(a.golden_sample_id)}/rematch`,
        ),
    },
    {
      name: "talonic_review_decide_flags",
      title: "Accept or reject flagged values",
      description: lines(
        "Decide values a run review flagged: accepting applies the suggested value, rejecting keeps the original. One result, or many at once.",
        "USE WHEN: after reading talonic_review_flag_progress and the run's results.",
        `ARGS: run_id, and either result_id + decision (accepted | rejected) or decisions[] { result_id, decision }, idempotency_key?. ${WRITE_SCOPE} ${IDEMPOTENT_SENTENCE}`,
        "RETURNS: the decision outcome.",
      ),
      inputSchema: {
        run_id: zUuid(),
        result_id: zUuid().optional(),
        decision: z.enum(["accepted", "rejected"]).optional(),
        decisions: z
          .array(z.object({ result_id: zUuid(), decision: z.enum(["accepted", "rejected"]) }))
          .min(1)
          .optional(),
        idempotency_key: idempotencyArg,
      },
      annotations: write(true),
      handler: async (a) => {
        const run = `/v1/validation/runs/${encodeURIComponent(a.run_id)}`
        if (a.decisions) {
          return send("talonic_review_decide_flags", a, true, "POST", `${run}/judge-bulk`, {
            decisions: a.decisions,
          })
        }
        if (!a.result_id || !a.decision) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Validation error: give result_id and decision, or decisions[].",
              },
            ],
          }
        }
        const path = a.decision === "accepted" ? "judge-accept" : "judge-reject"
        return send("talonic_review_decide_flags", a, true, "POST", `${run}/${path}`, {
          result_id: a.result_id,
        })
      },
    },
    {
      name: "talonic_review_flag_progress",
      title: "Run review progress",
      description: lines(
        "Progress of a run review: how many values were checked and how many are flagged.",
        `ARGS: run_id. ${READ_SCOPE}`,
        "RETURNS: the progress counts.",
      ),
      inputSchema: { run_id: zUuid() },
      annotations: readOnly,
      handler: (a) => read(`/v1/validation/runs/${encodeURIComponent(a.run_id)}/judge-progress`),
    },
  ]
}

/**
 * Whether this credential reaches the review queue (`GET /v1/field-reviews/summary` → 200).
 * Listing visibility only; the platform re-checks every call.
 */
export async function probeReviewAccess(token: string, baseUrl?: string): Promise<boolean> {
  return (await probeAccessState(token, baseUrl, "/v1/field-reviews/summary")) === true
}

/** Register the `talonic_review_*` tools. */
export function registerReviewTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  for (const t of reviewTools(getToken, baseUrl)) {
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: { title: t.title, ...t.annotations },
      },
      async (args: unknown) => t.handler(args) as Promise<any>,
    )
  }
}
