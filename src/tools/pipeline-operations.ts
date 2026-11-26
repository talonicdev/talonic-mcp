import { z } from "zod"
import { zUuid } from "./_shared.js"
import { READ, REFUSALS, destructive, write, type RouteTool } from "./_route-tools.js"

/**
 * Pipeline operation tools: the day-to-day running of one Spec run
 * (`pipeline_id`, from talonic_run_spec or talonic_get_run). Add documents,
 * start, retry the failed ones, rebuild the review queue, settle groups that
 * need a base document, let one held run proceed, and read the run's
 * documents, submission groups, field states, value history, holds and cases.
 *
 * Every tool hits `/v1/pipelines/{id}/*` with the caller's bearer. Reads need
 * `runs:read`; starting and retrying need `runs:write` and, like the web app,
 * an Admin of a workspace that configures its own processing; choosing a base
 * document needs `reviews:write` and the edit permission.
 */

const pipelineId = zUuid().describe(
  "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
)

export const PIPELINE_OPERATION_TOOLS: readonly RouteTool[] = [
  {
    name: "talonic_pipeline_add_documents",
    title: "Add documents to a Spec run",
    description: [
      "Attach workspace documents to a Spec run. They wait idle until talonic_pipeline_start; documents already in the run are skipped. One call is one submission group (`run_id`).",
      "Every id must be a document the key's person can see (a hidden one answers 404 like a missing one). At most 1000 ids.",
      "RETURNS: { pipeline_id, run_id, added, skipped, documents[] { id, document_id, status } }.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/pipelines/{pipeline_id}/documents",
    input: {
      pipeline_id: pipelineId,
      document_ids: z
        .array(zUuid())
        .min(1)
        .max(1000)
        .describe("Workspace document ids (talonic_search or talonic_filter), 1 to 1000."),
    },
    body: ["document_ids"],
    annotations: write(true),
  },
  {
    name: "talonic_pipeline_documents",
    title: "Documents of a Spec run",
    description: [
      "The documents of a Spec run with their processing state, paged and filterable like the run grid in the web app.",
      "USE WHEN: finding which documents failed, are flagged, or belong to one submission group; getting the run document id that talonic_pipeline_field_states needs.",
      "RETURNS: { data[] (one per run document: id = run document id, document_id, filename, status, …), pagination { total, page, limit } }.",
    ].join("\n"),
    route: "GET /v1/pipelines/{pipeline_id}/documents",
    input: {
      pipeline_id: pipelineId,
      page: z.number().int().min(1).optional().describe("Page number, from 1."),
      limit: z.number().int().min(1).optional().describe("Rows per page; the platform caps it."),
      q: z.string().max(200).optional().describe("Filename contains this text."),
      status: z
        .array(z.string().max(40))
        .max(20)
        .optional()
        .describe('Only these run document states, e.g. ["error"] or ["completed"].'),
      tags: z
        .array(z.string().max(64))
        .max(50)
        .optional()
        .describe("Documents carrying any of these tags."),
      flagged: z
        .boolean()
        .optional()
        .describe("true: only documents with flagged values; false: only without."),
      has_manual_edits: z
        .boolean()
        .optional()
        .describe("true: only documents with values a person changed."),
      overridden_by_amendment: z
        .boolean()
        .optional()
        .describe("true: only documents whose values a later amendment replaced."),
      sort_by: z
        .string()
        .max(300)
        .optional()
        .describe("filename, status, added_at, duration, flag_count, batch, or field:<field key>."),
      sort_dir: z.enum(["asc", "desc"]).optional().describe("Sort direction."),
      run_id: z
        .string()
        .regex(/^(none|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
        .optional()
        .describe(
          "One submission group (talonic_pipeline_runs), or `none` for documents added outside any group.",
        ),
      ids: z.array(zUuid()).max(200).optional().describe("Read exactly these run document ids."),
    },
    query: [
      "page",
      "limit",
      "q",
      "status",
      "tags",
      "flagged",
      "has_manual_edits",
      "overridden_by_amendment",
      "sort_by",
      "sort_dir",
      "run_id",
      "ids",
    ],
    annotations: READ,
  },
  {
    name: "talonic_pipeline_runs",
    title: "Submission groups of a Spec run",
    description: [
      "The submission groups (`run_id`) that fed documents into a Spec run, newest first, paged, with how many documents each holds.",
      "RETURNS: { data[], untracked_count (documents added outside any group), pagination { total, page, limit } }.",
    ].join("\n"),
    route: "GET /v1/pipelines/{pipeline_id}/runs",
    input: {
      pipeline_id: pipelineId,
      page: z.number().int().min(1).optional().describe("Page number, from 1."),
      limit: z.number().int().min(1).optional().describe("Rows per page; the platform caps it."),
      q: z.string().max(100).optional().describe("A run id prefix or a batch id fragment."),
    },
    query: ["page", "limit", "q"],
    annotations: READ,
  },
  {
    name: "talonic_pipeline_start",
    title: "Start a Spec run",
    description: [
      "Start (or resume) processing of the run's idle documents, e.g. after talonic_pipeline_add_documents. Processing uses credits; call only when the user asked to run it. Runs stopped by a business rule are listed in `held_runs` (see talonic_pipeline_rule_holds).",
      "RETURNS: { pipeline_id, enqueued, held_runs[] }. Poll talonic_get_run for progress.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/pipelines/{pipeline_id}/start",
    input: { pipeline_id: pipelineId },
    annotations: write(false),
  },
  {
    name: "talonic_pipeline_retry_errored",
    title: "Retry the failed documents of a Spec run",
    description: [
      "Process again only the run's documents that failed; documents that finished are untouched. Uses credits for the retried documents. To retry one failed document anywhere, re-extract that document instead.",
      "RETURNS: { pipeline_id, retried, enqueued }.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/pipelines/{pipeline_id}/retry-errored",
    input: { pipeline_id: pipelineId },
    annotations: write(false),
  },
  {
    name: "talonic_pipeline_retriage",
    title: "Rebuild a Spec run's review queue",
    description: [
      "Rebuild a finished run's review queue from its stored check results and route the items again, optionally under a new `review_config`. Nothing is checked again and no credits are spent, but the current queue is replaced: items already routed may move. Call only when the user asks.",
      "RETURNS: the rebuild summary and the new routing counts.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/pipelines/{pipeline_id}/retriage",
    input: {
      pipeline_id: pipelineId,
      review_config: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          "A new review routing configuration to apply first; omit to keep the stored one.",
        ),
    },
    body: ["review_config"],
    annotations: destructive(false),
  },
  {
    name: "talonic_pipeline_field_states",
    title: "Field states of one run document",
    description: [
      "The state of every field of one document in a Spec run: value, confidence, whether it is flagged, waits for review, or was changed by a person.",
      "`run_document_id` is the `id` of a row from talonic_pipeline_documents (not the workspace document id).",
      "RETURNS: { data[] }.",
    ].join("\n"),
    route: "GET /v1/pipelines/{pipeline_id}/documents/{run_document_id}/field-states",
    input: {
      pipeline_id: pipelineId,
      run_document_id: zUuid().describe(
        "The run document id (`id` from talonic_pipeline_documents).",
      ),
    },
    annotations: READ,
  },
  {
    name: "talonic_pipeline_cell_history",
    title: "Value history of a Spec run",
    description: [
      "Every value each cell of the run held, who or what set it, and when. Narrow with `document_ids`.",
      "USE WHEN: explaining why a value changed, or auditing manual corrections.",
    ].join("\n"),
    route: "GET /v1/pipelines/{pipeline_id}/cell-history",
    input: {
      pipeline_id: pipelineId,
      document_ids: z
        .array(zUuid())
        .max(200)
        .optional()
        .describe("Only the history of these documents."),
    },
    query: ["document_ids"],
    annotations: READ,
  },
  {
    name: "talonic_pipeline_assembly_groups",
    title: "Assembled groups of a Spec run",
    description: [
      "For a Spec that assembles several documents into one record (e.g. an order with its invoices): every group with its row, its base document and the documents bucketed into it. Documents the key's person cannot see are left out of a group's list.",
      "RETURNS: { data[] }.",
    ].join("\n"),
    route: "GET /v1/pipelines/{pipeline_id}/assembly/groups",
    input: { pipeline_id: pipelineId },
    annotations: READ,
  },
  {
    name: "talonic_pipeline_needs_anchor",
    title: "Groups that need a base document",
    description: [
      "Groups of an assembling Spec run that could not settle on one base document, each with the candidate documents to choose from. Choose with talonic_pipeline_resolve_anchor.",
      "RETURNS: { data[] { group_key, candidates[] { documentId, … } } }.",
    ].join("\n"),
    route: "GET /v1/pipelines/{pipeline_id}/assembly/needs-anchor",
    input: { pipeline_id: pipelineId },
    annotations: READ,
  },
  {
    name: "talonic_pipeline_resolve_anchor",
    title: "Choose a group's base document",
    description: [
      "Settle one group by choosing its base document; the group is assembled again around it. Take `group_key` and a candidate's `documentId` from talonic_pipeline_needs_anchor. Needs the `reviews:write` scope and the edit permission.",
      "RETURNS: { group_key, status, product_record_id }. 400 when the Spec does not assemble documents.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/pipelines/{pipeline_id}/assembly/resolve-anchor",
    input: {
      pipeline_id: pipelineId,
      group_key: z
        .string()
        .min(1)
        .max(2000)
        .describe("The group, from talonic_pipeline_needs_anchor."),
      anchor_document_id: z
        .string()
        .min(1)
        .max(100)
        .describe("The chosen candidate's `documentId`."),
    },
    body: ["group_key", "anchor_document_id"],
    annotations: write(true),
  },
  {
    name: "talonic_pipeline_rerun_assembly",
    title: "Assemble a Spec run's groups again",
    description: [
      "Assemble every group of the run again from its current documents. Existing groups and their rows are rebuilt and can change. Call only when the user asks.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/pipelines/{pipeline_id}/assembly/rerun",
    input: { pipeline_id: pipelineId },
    annotations: destructive(false),
  },
  {
    name: "talonic_pipeline_rule_holds",
    title: "Business-rule holds of a Spec",
    description: [
      "The business-rule holds that stop this Spec's runs, each with the runs it holds and the one-run overrides already given.",
      "RETURNS: { holds[] }. Let one run proceed with talonic_pipeline_override_hold.",
    ].join("\n"),
    route: "GET /v1/pipelines/{pipeline_id}/rule-holds",
    input: { pipeline_id: pipelineId },
    annotations: READ,
  },
  {
    name: "talonic_pipeline_override_hold",
    title: "Let one held run proceed",
    description: [
      "Let exactly one held run proceed despite a business-rule hold, with a reason kept on the audit trail. The hold stays open, so later runs are still stopped. The run starts when admitted (uses credits). Admin only, as in the web app; call only when the user decides.",
      "Take `run_id` and `hold_id` from talonic_pipeline_rule_holds.",
      "RETURNS: { admitted, remaining_hold_ids[], enqueued }.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/pipelines/{pipeline_id}/runs/{run_id}/business-rule-holds/{hold_id}/override",
    input: {
      pipeline_id: pipelineId,
      run_id: zUuid().describe("The held run."),
      hold_id: zUuid().describe("The hold to override for this run."),
      reason: z
        .string()
        .min(3)
        .max(2000)
        .describe("Why this run may proceed (3 to 2000 characters)."),
    },
    body: ["reason"],
    annotations: write(false),
  },
  {
    name: "talonic_pipeline_reconciliation_cases",
    title: "Reconciliation cases of a Spec",
    description: [
      "The reconciliation cases this Spec's business rules raised (a mismatch between documents to look into), with their state.",
      "RETURNS: { cases[] }. The full audit export is talonic_pipeline_export_reconciliation_cases.",
    ].join("\n"),
    route: "GET /v1/pipelines/{pipeline_id}/reconciliation-cases",
    input: { pipeline_id: pipelineId },
    annotations: READ,
  },
  {
    name: "talonic_pipeline_export_reconciliation_cases",
    title: "Export reconciliation cases",
    description: [
      "The full audit export of a Spec's reconciliation cases: the values each case saw, its evidence, its history and the holds it caused. Needs the export permission, as in the web app.",
      "RETURNS: { cases[] }.",
      REFUSALS,
    ].join("\n"),
    route: "GET /v1/pipelines/{pipeline_id}/reconciliation-cases/export",
    input: { pipeline_id: pipelineId },
    annotations: READ,
  },
]
