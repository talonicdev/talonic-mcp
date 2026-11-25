import { z } from "zod"
import { apiBinary, buildUrl } from "./_http.js"
import { READ, describe, write, type GroupTool, type ToolGroup } from "./_groups.js"
import { toolError, zUuid, type ToolResult } from "./_shared.js"

/**
 * Compliance tools over the platform's public `/v1/compliance/*`: frameworks
 * (regulations or policies held as workspace documents, with their rules),
 * evaluations of documents and document sets against the frameworks that are
 * ON, the failed-check worklist, batch comparisons for discrepancies, rule
 * sets, the verdict export, and the task worklist for a workspace that makes
 * its compliance decisions with its own agent.
 *
 * The loop: talonic_compliance_issues (what failed) →
 * talonic_compliance_get_document_evaluation (each verdict with its reason and
 * quote) → the allowed correction (re-evaluate after the document changed,
 * take a document off the list, switch a framework OFF, narrow a set's rule
 * set). Source-only routes (rule check modes and field-check proposals) have
 * no public operation yet and therefore no tool.
 */

/** Largest export file returned inline. @internal */
export const COMPLIANCE_EXPORT_MAX_BYTES = 8 * 1024 * 1024

const docIds = (min: number, max: number, what: string) =>
  z.array(zUuid()).min(min).max(max).describe(what)

const pageArgs = {
  status: z
    .enum(["processing", "waiting", "completed", "error"])
    .optional()
    .describe("Only evaluations with this status (an interrupted one shows error)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe("Page size; any of status / limit / offset asks for one page."),
  offset: z.number().int().min(0).optional().describe("Rows to skip, for paging."),
}

const epoch = z
  .number()
  .int()
  .min(1)
  .describe("The execution_epoch talonic_compliance_claim_task returned.")

/** `GET /v1/compliance/export`: the verdicts as a CSV or XLSX file. @internal */
export async function handleComplianceExport(
  ctx: { getToken: () => string; baseUrl: string | undefined },
  args: Record<string, unknown>,
  maxBytes = COMPLIANCE_EXPORT_MAX_BYTES,
): Promise<ToolResult> {
  const format = (args["format"] as string | undefined) ?? "xlsx"
  const params = { format, ...(args["issues_only"] ? { issues: "true" } : {}) }
  const path = "/v1/compliance/export"
  try {
    const file = await apiBinary(ctx.getToken, ctx.baseUrl, path, { params, maxBytes })
    const filename = file.filename ?? `compliance.${format}`
    const meta = { filename, mime_type: file.mimeType, size: file.bytes.length, format }
    return {
      content: [
        { type: "text", text: JSON.stringify(meta) },
        {
          type: "resource",
          resource: {
            uri: buildUrl(ctx.baseUrl, path, params),
            mimeType: file.mimeType,
            blob: file.bytes.toString("base64"),
          },
        },
      ],
      structuredContent: meta,
    } as unknown as ToolResult
  } catch (err) {
    return toolError(err)
  }
}

const tools: GroupTool[] = [
  // ── Worklist and evidence ────────────────────────────────────────────────
  {
    name: "talonic_compliance_issues",
    title: "Compliance worklist",
    description: describe({
      what: "The worklist of failed checks: per document the rules it fails (and, with `unclear`, the rules whose verdict is unclear), with the framework each rule comes from.",
      use: "'what is not compliant', the starting point before opening one document's evaluation.",
      not: "the full verdict list with passes (talonic_compliance_list_evaluations); one document's reasons and quotes (talonic_compliance_get_document_evaluation).",
      args: "`unclear` (also list unclear verdicts).",
      returns: "{ data[] } one entry per document with its failing rules.",
    }),
    route: "GET /v1/compliance/issues",
    inputSchema: {
      unclear: z.boolean().optional().describe("Also list rules whose verdict is unclear."),
    },
    annotations: READ,
    query: ["unclear"],
  },
  {
    name: "talonic_compliance_get_document_evaluation",
    title: "One document's compliance evaluation",
    description: describe({
      what: "A document's latest evaluation with every result: per rule the verdict (pass, fail, unclear, not_applicable), the reason, the quote from the document it rests on, whether it needs a person's check, and whether the evaluation is outdated.",
      use: "retrieving the evidence behind a failed check from talonic_compliance_issues, before deciding on a correction.",
      not: "a document set (talonic_compliance_get_set_evaluation).",
      args: "`document_id`.",
      returns: "{ evaluation } with its results; null when the document was never evaluated.",
    }),
    route: "GET /v1/compliance/evaluations/documents/{documentId}",
    inputSchema: { document_id: zUuid().describe("The evaluated document.") },
    annotations: READ,
  },
  {
    name: "talonic_compliance_list_evaluations",
    title: "Compliance evaluations",
    description: describe({
      what: "The latest evaluation of every document on the Evaluations list. Without paging arguments the whole list; with any of status / limit / offset one page with total and has_more.",
      use: "an overview of every evaluated document, or finding documents whose evaluation errored or is still running.",
      not: "only the failures (talonic_compliance_issues); counts only (talonic_compliance_evaluation_status).",
      args: "`status` processing|waiting|completed|error, `limit` 1-500, `offset`.",
      returns: "{ data[] } or a page { data[], total, has_more }.",
    }),
    route: "GET /v1/compliance/evaluations",
    inputSchema: pageArgs,
    annotations: READ,
    query: ["status", "limit", "offset"],
  },
  {
    name: "talonic_compliance_evaluation_status",
    title: "Compliance evaluation counts",
    description: describe({
      what: "Counts over the latest evaluations: processing, completed, error, outdated and failing.",
      use: "the headline ('how many documents fail'), or waiting until evaluations started with talonic_compliance_evaluate finish.",
      returns: "{ processing, completed, error, outdated, failing }.",
    }),
    route: "GET /v1/compliance/evaluations/status",
    inputSchema: {},
    annotations: READ,
  },
  {
    name: "talonic_compliance_export",
    title: "Export compliance verdicts",
    description: describe({
      what: `Download every verdict of the evaluated documents and document sets as a file (one row per rule and document or set: framework, rule, obligation, verdict, reason, quote, evaluated at, outdated), up to ${COMPLIANCE_EXPORT_MAX_BYTES / (1024 * 1024)} MB.`,
      use: "the user wants the results as a spreadsheet to share or file.",
      not: "reading results in the conversation (talonic_compliance_issues, talonic_compliance_get_document_evaluation).",
      args: "`format` xlsx (default) | csv, `issues_only` (only failed and unclear verdicts of the sets).",
      returns:
        "a text item { filename, mime_type, size, format } and a resource item { uri, mimeType, blob } with the file.",
    }),
    route: "GET /v1/compliance/export",
    inputSchema: {
      format: z.enum(["xlsx", "csv"]).optional().describe("File format (default xlsx)."),
      issues_only: z.boolean().optional().describe("Only failed and unclear verdicts of the sets."),
    },
    annotations: READ,
    handler: (ctx, args) => handleComplianceExport(ctx, args),
  },
  // ── Evaluating ───────────────────────────────────────────────────────────
  {
    name: "talonic_compliance_evaluate",
    title: "Evaluate documents for compliance",
    description: describe({
      what: "Evaluate documents against every framework that is ON. Runs in the background; poll talonic_compliance_evaluation_status or talonic_compliance_get_document_evaluation.",
      use: "a document changed or a framework was switched ON and its verdicts are outdated; or after a correction, to check it took effect.",
      not: "documents not yet on the Evaluations list (talonic_compliance_add_documents adds and evaluates them).",
      args: "`document_ids` (1-500).",
      returns: "{ data[] } one started evaluation per document.",
      errors: "403 when the app is switched off for the workspace.",
    }),
    route: "POST /v1/compliance/evaluations",
    inputSchema: { document_ids: docIds(1, 500, "Documents to evaluate.") },
    annotations: write(false),
    body: ["document_ids"],
  },
  {
    name: "talonic_compliance_evaluate_all",
    title: "Evaluate every document that needs it",
    description: describe({
      what: "Evaluate every listed document whose evaluation is missing or outdated, oldest first. Run with dry_run first to see how many.",
      use: "bringing the whole list up to date after frameworks changed.",
      args: "`dry_run` (only count), `limit` 1-500 (the rest follow on the next call).",
      returns: "How many documents need it and how many were started.",
    }),
    route: "POST /v1/compliance/evaluations/all",
    inputSchema: {
      dry_run: z.boolean().optional().describe("Only report how many would be evaluated."),
      limit: z.number().int().min(1).max(500).optional().describe("Evaluate at most this many."),
    },
    annotations: write(false),
    body: ["dry_run", "limit"],
  },
  {
    name: "talonic_compliance_add_documents",
    title: "Add documents to compliance evaluations",
    description: describe({
      what: "Put workspace documents on the Evaluations list and evaluate them against the frameworks that are ON.",
      use: "the user wants documents checked that are not on the list yet.",
      args: "`document_ids` (1-500).",
      returns: "The documents added and the evaluations started.",
    }),
    route: "POST /v1/compliance/evaluations/documents",
    inputSchema: { document_ids: docIds(1, 500, "Documents to add and evaluate.") },
    annotations: write(true),
    body: ["document_ids"],
  },
  {
    name: "talonic_compliance_remove_document",
    title: "Take a document off the compliance list",
    description: describe({
      what: "Take a document off the Evaluations list together with its evaluations. The document itself stays in the workspace; adding it again re-evaluates it.",
      use: "a document was put on the list by mistake or no longer needs checking. Ask the user first.",
      args: "`document_id`.",
      returns: "Confirmation of the removal.",
    }),
    route: "DELETE /v1/compliance/evaluations/documents/{documentId}",
    inputSchema: { document_id: zUuid().describe("The document to take off the list.") },
    annotations: write(true, true),
  },
  // ── Frameworks ───────────────────────────────────────────────────────────
  {
    name: "talonic_compliance_list_frameworks",
    title: "Compliance frameworks",
    description: describe({
      what: "The frameworks (regulations, policies, contract standards held as workspace documents) with their status, whether each is ON, and their rule counts.",
      use: "which rules documents are checked against, or finding a framework's document_id.",
      not: "the rules themselves (talonic_compliance_framework_rules).",
      returns: "{ data[] } frameworks with document_id, name, status, active, rule counts.",
    }),
    route: "GET /v1/compliance/frameworks",
    inputSchema: {},
    annotations: READ,
  },
  {
    name: "talonic_compliance_framework_rules",
    title: "A framework's rules",
    description: describe({
      what: "The rules of one framework: code, text, obligation, section, what it applies to and its condition.",
      use: "explaining a failed verdict's rule, or picking rule ids for a rule set.",
      args: "`document_id` (the framework's document).",
      returns: "{ data[] } rules with their ids.",
    }),
    route: "GET /v1/compliance/frameworks/{documentId}/rules",
    inputSchema: { document_id: zUuid().describe("The framework's document id.") },
    annotations: READ,
  },
  {
    name: "talonic_compliance_add_frameworks",
    title: "Make documents compliance frameworks",
    description: describe({
      what: "Make existing workspace documents frameworks (a regulation, policy or standard to check other documents against). Their rules are then written from their text; switch a framework ON to check documents against it.",
      use: "the user uploaded a regulation or policy and wants documents checked against it.",
      args: "`document_ids` (1-50).",
      returns: "{ data[] } the new frameworks.",
    }),
    route: "POST /v1/compliance/frameworks/from-documents",
    inputSchema: { document_ids: docIds(1, 50, "Workspace documents to make frameworks.") },
    annotations: write(true),
    body: ["document_ids"],
  },
  {
    name: "talonic_compliance_set_framework_active",
    title: "Switch a framework ON or OFF",
    description: describe({
      what: "Turn a framework ON (its rules are in force for every evaluation) or OFF (they are not). Reversible; evaluations made before become outdated.",
      use: "a framework does not apply to the workspace's documents, or should now apply.",
      args: "`document_id`, `active`.",
      returns: "The framework with its new state.",
    }),
    route: "POST /v1/compliance/frameworks/{documentId}/active",
    inputSchema: {
      document_id: zUuid().describe("The framework's document id."),
      active: z.boolean().describe("true = ON, false = OFF."),
    },
    annotations: write(true),
    body: ["active"],
  },
  {
    name: "talonic_compliance_generate_rules",
    title: "Write a framework's rules again",
    description: describe({
      what: "Write the rules of a framework again from its text, replacing the current ones.",
      use: "a framework's rules are missing or the framework document was replaced. Ask the user first: rule sets that name the old rules lose them.",
      args: "`document_id`.",
      returns: "The framework with its status and rule counts.",
    }),
    route: "POST /v1/compliance/frameworks/{documentId}/rules/generate",
    inputSchema: { document_id: zUuid().describe("The framework's document id.") },
    annotations: write(false, true),
  },
  {
    name: "talonic_compliance_remove_framework",
    title: "Take a framework out of Compliance",
    description: describe({
      what: "Take a framework out of the app with its rules. The document stays in the workspace and can be made a framework again.",
      use: "the user no longer wants documents checked against it. Ask first; to pause it, switch it OFF instead.",
      args: "`document_id`.",
      returns: "Confirmation of the removal.",
    }),
    route: "DELETE /v1/compliance/frameworks/{documentId}",
    inputSchema: { document_id: zUuid().describe("The framework's document id.") },
    annotations: write(true, true),
  },
  // ── Discrepancy comparisons ──────────────────────────────────────────────
  {
    name: "talonic_compliance_list_comparisons",
    title: "Document comparisons",
    description: describe({
      what: "Comparisons of document batches for discrepancies (values that should agree across the documents but do not), newest first.",
      use: "finding an earlier comparison.",
      returns: "{ data[] } comparisons with id, status and counts.",
    }),
    route: "GET /v1/compliance/discrepancy-runs",
    inputSchema: {},
    annotations: READ,
  },
  {
    name: "talonic_compliance_get_comparison",
    title: "One document comparison",
    description: describe({
      what: "One comparison with every discrepancy found: the value, which documents disagree and where.",
      use: "reading the result of talonic_compliance_compare_documents.",
      args: "`run_id`.",
      returns: "The comparison with its status and discrepancies.",
    }),
    route: "GET /v1/compliance/discrepancy-runs/{runId}",
    inputSchema: { run_id: zUuid().describe("The comparison id.") },
    annotations: READ,
  },
  {
    name: "talonic_compliance_compare_documents",
    title: "Compare documents for discrepancies",
    description: describe({
      what: "Compare a batch of documents that belong together (an order, its invoice, its delivery note) for values that disagree. Runs in the background; read it with talonic_compliance_get_comparison.",
      use: "the user asks whether a set of documents is consistent.",
      args: "`document_ids` (2-50).",
      returns: "The new comparison with its id.",
    }),
    route: "POST /v1/compliance/discrepancy-runs",
    inputSchema: { document_ids: docIds(2, 50, "The documents to compare.") },
    annotations: write(false),
    body: ["document_ids"],
  },
  // ── Document sets ────────────────────────────────────────────────────────
  {
    name: "talonic_compliance_list_sets",
    title: "Compliance document sets",
    description: describe({
      what: "Document sets (documents judged as one whole, e.g. a contract with its annexes) with their documents and rule set.",
      use: "finding a set id, or checking which documents a set holds.",
      returns: "{ data[] } sets with id, name, documents, rule_set_id.",
    }),
    route: "GET /v1/compliance/sets",
    inputSchema: {},
    annotations: READ,
  },
  {
    name: "talonic_compliance_create_set",
    title: "Create a compliance document set",
    description: describe({
      what: "Create a document set picked by hand, judged against one rule set or, without one, every rule of the frameworks that are ON.",
      use: "documents only make sense together (a contract and its annexes).",
      args: "`name`, `document_ids` (2-100), `rule_set_id` (optional).",
      returns: "The new set.",
    }),
    route: "POST /v1/compliance/sets",
    inputSchema: {
      name: z.string().min(1).max(200).describe("Set name."),
      document_ids: docIds(2, 100, "The set's documents."),
      rule_set_id: zUuid()
        .nullable()
        .optional()
        .describe("Rule set to judge it against; omitted or null = every ON rule."),
    },
    annotations: write(false),
    body: ["name", "document_ids", "rule_set_id"],
  },
  {
    name: "talonic_compliance_assembly_groups",
    title: "Groups to make compliance sets from",
    description: describe({
      what: "The assembly groups of the workspace's pipelines (documents grouped by a shared value, such as one order number) that sets can be made from.",
      use: "before talonic_compliance_create_sets_from_groups.",
      returns: "{ data[] } groups with pipeline_id, group_key and their documents.",
    }),
    route: "GET /v1/compliance/sets/assembly-groups",
    inputSchema: {},
    annotations: READ,
  },
  {
    name: "talonic_compliance_create_sets_from_groups",
    title: "Create compliance sets from groups",
    description: describe({
      what: "Create one document set per assembly group; the set follows the group as documents join it.",
      use: "every order (or case) should be judged as a whole.",
      args: "`groups[]` { pipeline_id, group_key } (1-100), `rule_set_id` (optional).",
      returns: "{ data[] } the new sets.",
    }),
    route: "POST /v1/compliance/sets/from-assemblies",
    inputSchema: {
      groups: z
        .array(z.object({ pipeline_id: zUuid(), group_key: z.string().min(1).max(1000) }))
        .min(1)
        .max(100)
        .describe("Groups from talonic_compliance_assembly_groups."),
      rule_set_id: zUuid()
        .nullable()
        .optional()
        .describe("Rule set to judge them against; omitted or null = every ON rule."),
    },
    annotations: write(false),
    body: ["groups", "rule_set_id"],
  },
  {
    name: "talonic_compliance_update_set",
    title: "Edit a compliance document set",
    description: describe({
      what: "Rename a set, replace its documents (a group-following set becomes hand-picked) or change its rule set. Fields left out stay.",
      use: "a set is missing a document or should be judged against other rules.",
      args: "`set_id`, `name`, `document_ids` (2-100), `rule_set_id` (null = every ON rule).",
      returns: "The updated set.",
    }),
    route: "PATCH /v1/compliance/sets/{setId}",
    inputSchema: {
      set_id: zUuid().describe("The set."),
      name: z.string().min(1).max(200).optional().describe("New set name."),
      document_ids: docIds(2, 100, "The set's documents (replaces them).").optional(),
      rule_set_id: zUuid()
        .nullable()
        .optional()
        .describe("null = every ON rule; omitted = unchanged."),
    },
    annotations: write(true),
    body: ["name", "document_ids", "rule_set_id"],
  },
  {
    name: "talonic_compliance_remove_set",
    title: "Remove a compliance document set",
    description: describe({
      what: "Remove a document set with its evaluations. The documents stay in the workspace.",
      use: "a set is no longer needed. Ask the user first.",
      args: "`set_id`.",
      returns: "Confirmation of the removal.",
    }),
    route: "DELETE /v1/compliance/sets/{setId}",
    inputSchema: { set_id: zUuid().describe("The set.") },
    annotations: write(true, true),
  },
  {
    name: "talonic_compliance_list_set_evaluations",
    title: "Compliance set evaluations",
    description: describe({
      what: "The latest evaluation of every document set. Without paging arguments the whole list; with any of status / limit / offset one page with total and has_more.",
      use: "an overview of how every set fares.",
      args: "`status` processing|waiting|completed|error, `limit` 1-500, `offset`.",
      returns: "{ data[] } or a page { data[], total, has_more }.",
    }),
    route: "GET /v1/compliance/sets/evaluations",
    inputSchema: pageArgs,
    annotations: READ,
    query: ["status", "limit", "offset"],
  },
  {
    name: "talonic_compliance_get_set_evaluation",
    title: "One set's compliance evaluation",
    description: describe({
      what: "A set's latest evaluation with every result: verdict, reason, and the quote with the member document it comes from.",
      use: "the evidence behind a set's failed check.",
      args: "`set_id`.",
      returns: "{ evaluation } with its results; null when never evaluated.",
    }),
    route: "GET /v1/compliance/sets/{setId}/evaluation",
    inputSchema: { set_id: zUuid().describe("The set.") },
    annotations: READ,
  },
  {
    name: "talonic_compliance_evaluate_sets",
    title: "Evaluate compliance document sets",
    description: describe({
      what: "Evaluate document sets, each as one whole, against their rule set. Runs in the background.",
      use: "a set changed or its verdicts are outdated.",
      args: "`set_ids` (1-100).",
      returns: "{ data[] } one started evaluation per set.",
    }),
    route: "POST /v1/compliance/sets/evaluate",
    inputSchema: { set_ids: z.array(zUuid()).min(1).max(100).describe("Sets to evaluate.") },
    annotations: write(false),
    body: ["set_ids"],
  },
  // ── Rule sets ────────────────────────────────────────────────────────────
  {
    name: "talonic_compliance_list_rule_sets",
    title: "Compliance rule sets",
    description: describe({
      what: "The workspace's rule sets: named selections of rules of the ON frameworks that a document set is judged against.",
      use: "finding a rule_set_id for a set.",
      returns: "{ data[] } rule sets with id, name, rule_ids.",
    }),
    route: "GET /v1/compliance/rule-sets",
    inputSchema: {},
    annotations: READ,
  },
  {
    name: "talonic_compliance_create_rule_set",
    title: "Create a compliance rule set",
    description: describe({
      what: "Create a named selection of rules (from talonic_compliance_framework_rules) to judge document sets against.",
      use: "only some rules apply to a kind of document set.",
      args: "`name`, `rule_ids` (1-1000).",
      returns: "The new rule set.",
    }),
    route: "POST /v1/compliance/rule-sets",
    inputSchema: {
      name: z.string().min(1).max(200).describe("Rule set name."),
      rule_ids: z.array(zUuid()).min(1).max(1000).describe("Rules of ON frameworks."),
    },
    annotations: write(false),
    body: ["name", "rule_ids"],
  },
  {
    name: "talonic_compliance_update_rule_set",
    title: "Change a compliance rule set",
    description: describe({
      what: "Rename a rule set or replace its rules.",
      use: "a rule should be added to or dropped from what sets are judged against.",
      args: "`rule_set_id`, `name`, `rule_ids` (1-1000, replaces them).",
      returns: "The updated rule set.",
    }),
    route: "PATCH /v1/compliance/rule-sets/{ruleSetId}",
    inputSchema: {
      rule_set_id: zUuid(),
      name: z.string().min(1).max(200).optional().describe("New rule set name."),
      rule_ids: z.array(zUuid()).min(1).max(1000).optional().describe("The rules (replaces them)."),
    },
    annotations: write(true),
    body: ["name", "rule_ids"],
  },
  {
    name: "talonic_compliance_remove_rule_set",
    title: "Remove a compliance rule set",
    description: describe({
      what: "Remove a rule set. Sets that used it go back to every rule of the ON frameworks.",
      use: "a rule set is no longer needed. Ask the user first.",
      args: "`rule_set_id`.",
      returns: "Confirmation of the removal.",
    }),
    route: "DELETE /v1/compliance/rule-sets/{ruleSetId}",
    inputSchema: { rule_set_id: zUuid() },
    annotations: write(true, true),
  },
  // ── Who decides; the workspace agent's tasks ─────────────────────────────
  {
    name: "talonic_compliance_settings",
    title: "Who makes compliance decisions",
    description: describe({
      what: "Who makes the workspace's compliance decisions: `platform` (Talonic decides every verdict) or `external` (the workspace's own agent decides, through the compliance tasks).",
      use: "before working the task tools, or explaining why verdicts wait.",
      returns: "{ decider: platform | external }.",
    }),
    route: "GET /v1/compliance/settings",
    inputSchema: {},
    annotations: READ,
  },
  {
    name: "talonic_compliance_set_decider",
    title: "Switch who makes compliance decisions",
    description: describe({
      what: "Switch who makes the compliance decisions: `platform` or `external` (the workspace's own agent works the tasks). Reversible. The person behind the connection needs the Workspace settings permission.",
      use: "the user explicitly asks to hand decisions to their own agent, or back.",
      args: "`decider` platform|external.",
      returns: "The new setting.",
      errors: "403 without the Workspace settings permission.",
    }),
    route: "PUT /v1/compliance/settings",
    inputSchema: {
      decider: z
        .enum(["platform", "external"])
        .describe("platform = Talonic decides; external = the workspace's own agent."),
    },
    annotations: write(true),
    body: ["decider"],
  },
  {
    name: "talonic_compliance_list_tasks",
    title: "Compliance tasks for the workspace's agent",
    description: describe({
      what: "Decisions waiting for the workspace's own agent (only when the decider is external).",
      use: "an agent working the compliance decisions: pick a task, then talonic_compliance_claim_task.",
      args: "`status` open (default) | all, `limit` (default 100).",
      returns: "{ data[] } tasks with id, status, document or set, and lease state.",
    }),
    route: "GET /v1/compliance/tasks",
    inputSchema: {
      status: z.enum(["open", "all"]).optional().describe("open (default) or all."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .describe("Most tasks returned (default 100)."),
    },
    annotations: READ,
    query: ["status", "limit"],
  },
  {
    name: "talonic_compliance_get_task",
    title: "One compliance task",
    description: describe({
      what: "One task's state (open, claimed, done) without its work package.",
      use: "checking a task before or after claiming it.",
      args: "`task_id`.",
      returns: "The task.",
    }),
    route: "GET /v1/compliance/tasks/{taskId}",
    inputSchema: { task_id: zUuid() },
    annotations: READ,
  },
  {
    name: "talonic_compliance_claim_task",
    title: "Claim a compliance task",
    description: describe({
      what: "Claim a task for this agent and read its work package: instructions, the input, and the JSON Schema the answer must match. The claim is a lease: renew it with talonic_compliance_heartbeat_task while working, hand it back with talonic_compliance_release_task, or answer with talonic_compliance_submit_task. A lapsed lease returns the task to open.",
      use: "starting work on one task from talonic_compliance_list_tasks.",
      args: "`task_id`.",
      returns:
        "{ task (with execution_epoch and the lease), instructions, input, output_schema, how_to_answer }. Keep execution_epoch for every later call.",
      errors: "409 when another agent holds the claim, the task is closed or not ready yet.",
    }),
    route: "POST /v1/compliance/tasks/{taskId}/claim",
    inputSchema: { task_id: zUuid() },
    annotations: write(false),
  },
  {
    name: "talonic_compliance_heartbeat_task",
    title: "Renew a compliance task claim",
    description: describe({
      what: "Renew the lease on a claimed task.",
      use: "work on a claimed task takes longer than its lease.",
      args: "`task_id`, `execution_epoch`.",
      returns: "The new lease expiry.",
      errors: "409 when the claim lapsed or was taken over (stop working on it).",
    }),
    route: "POST /v1/compliance/tasks/{taskId}/heartbeat",
    inputSchema: { task_id: zUuid(), execution_epoch: epoch },
    annotations: write(true),
    body: ["execution_epoch"],
  },
  {
    name: "talonic_compliance_release_task",
    title: "Hand a compliance task back",
    description: describe({
      what: "Hand a claimed task back unanswered; it is open again for any agent.",
      use: "the agent cannot decide the task.",
      args: "`task_id`, `execution_epoch`.",
      returns: "The task, open again.",
    }),
    route: "POST /v1/compliance/tasks/{taskId}/release",
    inputSchema: { task_id: zUuid(), execution_epoch: epoch },
    annotations: write(true),
    body: ["execution_epoch"],
  },
  {
    name: "talonic_compliance_submit_task",
    title: "Answer a compliance task",
    description: describe({
      what: "Submit the answer to a claimed task. It is checked against the package's output_schema and stored exactly like a verdict Talonic makes itself.",
      use: "the agent has decided a claimed task.",
      args: "`task_id`, `execution_epoch`, `answer` (an object matching output_schema).",
      returns: "{ task, result }.",
      errors:
        "400 naming what is wrong when the answer does not match the schema; 409 without a live claim (lapsed, released or a stale epoch).",
    }),
    route: "POST /v1/compliance/tasks/{taskId}/submit",
    inputSchema: {
      task_id: zUuid(),
      execution_epoch: epoch,
      answer: z
        .record(z.string(), z.unknown())
        .describe("The answer, matching the package's output_schema."),
    },
    annotations: write(false),
    body: ["execution_epoch", "answer"],
  },
]

export const complianceGroup: ToolGroup = {
  key: "compliance",
  label: "Compliance",
  docsSlug: "compliance-tools",
  probe: { path: "/v1/compliance/settings" },
  tools,
}
