import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
  apiJson,
  probeAccessState,
  runTool,
  type HttpMethod,
  type ProbeAnswer,
  type QueryParams,
} from "./_http.js"
import { zUuid, type ToolResult } from "./_shared.js"

/**
 * App workflow tools: the `/v1` routes that complete the apps' web workflows
 * (Receivables, Spend Audit, Payables Desk, workbook capture, business
 * objects, record-set grid pages, and the parts of Accounts Payable,
 * Compliance, Money Found, Price Baseline, Contract Check and Chart Extraction
 * that had no route before).
 *
 * Each group is probe-gated: it is listed only when its probe route answers
 * 200 for the credential (the workspace added the app and the credential may
 * read it), hosted per token with a 5-minute cache, stdio once at boot. The
 * probe is listing UX; the platform checks the scope and the person's role on
 * every call.
 *
 * Preview is separate from the step that commits or publishes: every
 * `*_preview` / read tool is read-only, and the tool that records decisions
 * (`*_apply`), saves a proposal (`*_save_*`) or publishes outside the
 * workspace (`talonic_spend_audit_share`) is its own write tool.
 *
 * Not wrapped (files, not JSON): the Receivables import file
 * (`GET /v1/ar/cash-application/export.csv`) and the Spend Audit uploads
 * (`POST /v1/spend-audit/{spend,documents,logo,todos/:key/documents}`, multipart).
 */

type Annotations = {
  readOnlyHint: boolean
  destructiveHint: boolean
  idempotentHint: boolean
  openWorldHint: boolean
}

const readOnly: Annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}
const write = (idempotent: boolean, destructive = false, openWorld = false): Annotations => ({
  readOnlyHint: false,
  destructiveHint: destructive,
  idempotentHint: idempotent,
  openWorldHint: openWorld,
})

/** One tool bound to one `/v1` route. */
export interface RouteTool {
  name: string
  title: string
  description: string
  method: HttpMethod
  /** Path with `{arg}` placeholders filled from the tool arguments (URL-encoded). */
  path: string
  /** Argument name → query parameter name. */
  query?: Record<string, string>
  /** Argument names sent as the JSON body (only those given). */
  body?: string[]
  input: Record<string, z.ZodTypeAny>
  annotations: Annotations
}

/** A probe-gated group of tools. */
export interface AppWorkflowGroup {
  id: string
  /** GET route whose 200 lists the group. */
  probePath: string
  probeParams?: QueryParams
  tools: RouteTool[]
}

const d = (...lines: string[]) => lines.join("\n")
const page = {
  page: z.number().int().min(1).optional().describe("Page number, from 1."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe("Rows per page (default 50, at most 500)."),
}

const RECEIVABLES: AppWorkflowGroup = {
  id: "receivables",
  probePath: "/v1/ar/connectors/trimble-tmw",
  tools: [
    {
      name: "talonic_ar_overview",
      title: "Receivables cockpit",
      description: d(
        "The receivables cockpit: aging of open receivables, cash application and bill-ready statistics, recoverable money found on receivables, latest decisions.",
        "USE WHEN: the headline (how much is open, how much applied straight through, which loads can bill).",
        "NOT FOR: the remittance or load lists (talonic_ar_cash_application_preview, talonic_ar_bill_ready_preview).",
        "ARGS: none. RETURNS: the cockpit object. 422 until the receivables sources are bound in Money Found.",
      ),
      method: "GET",
      path: "/v1/ar/overview",
      input: {},
      annotations: readOnly,
    },
    {
      name: "talonic_ar_cash_application_preview",
      title: "Preview the cash application",
      description: d(
        "Match every remittance line to the open invoices and show the result: statistics over all remittances and one page of them, exceptions first. Writes nothing.",
        "USE WHEN: before applying cash, to see what lands and what needs a person.",
        "NOT FOR: recording the result (talonic_ar_cash_application_apply).",
        "ARGS: `page`, `limit`, `invalid_only` (only remittances with a deduction ruled invalid). RETURNS: { stats, remittances[], page }.",
      ),
      method: "GET",
      path: "/v1/ar/cash-application",
      query: { page: "page", limit: "limit", invalid_only: "invalid" },
      input: {
        ...page,
        invalid_only: z
          .boolean()
          .optional()
          .describe("Only remittances with an invalid deduction."),
      },
      annotations: readOnly,
    },
    {
      name: "talonic_ar_cash_application_apply",
      title: "Record the cash application",
      description: d(
        "Record the decisions of the cash application (payments applied or exception, invoices paid / partially paid / short paid, deductions open). Safe to repeat: recorded decisions are not recorded again. Posts nothing to another system.",
        "USE WHEN: after talonic_ar_cash_application_preview, once the result is right.",
        "NOT FOR: previewing (talonic_ar_cash_application_preview).",
        "ARGS: none. RETURNS: { recorded, result } (result = the first page as it now stands). Needs apps:receivables:write.",
      ),
      method: "POST",
      path: "/v1/ar/cash-application/apply",
      input: {},
      annotations: write(true),
    },
    {
      name: "talonic_ar_bill_ready_preview",
      title: "Preview bill readiness",
      description: d(
        "Per load, the checks (delivered, proof of delivery present and signed, carrier cost within contract, accessorials settled, rate agreed) and the verdict auto_bill, review or not_ready. Writes nothing.",
        "USE WHEN: deciding which loads may bill without a person.",
        "NOT FOR: recording the verdicts (talonic_ar_bill_ready_apply).",
        "ARGS: `page`, `limit`. RETURNS: { stats, loads[], page }.",
      ),
      method: "GET",
      path: "/v1/ar/bill-ready",
      query: { page: "page", limit: "limit" },
      input: page,
      annotations: readOnly,
    },
    {
      name: "talonic_ar_bill_ready_apply",
      title: "Record bill readiness",
      description: d(
        "Record bill_ready or review on every load. A load a person moved to billed, review or on_hold keeps its state.",
        "USE WHEN: after talonic_ar_bill_ready_preview.",
        "NOT FOR: previewing (talonic_ar_bill_ready_preview).",
        "ARGS: none. RETURNS: { recorded, result }. Needs apps:receivables:write.",
      ),
      method: "POST",
      path: "/v1/ar/bill-ready/apply",
      input: {},
      annotations: write(true),
    },
    {
      name: "talonic_ar_tmw_mapping",
      title: "Trimble TMW mapping",
      description: d(
        "How Trimble TMW tables map onto the receivables inputs, with the status conventions.",
        "USE WHEN: setting up receivables from a Trimble TMW export.",
        "NOT FOR: the receivables data (talonic_ar_overview).",
        "ARGS: none. RETURNS: { mapping }.",
      ),
      method: "GET",
      path: "/v1/ar/connectors/trimble-tmw",
      input: {},
      annotations: readOnly,
    },
  ],
}

const SPEND_AUDIT: AppWorkflowGroup = {
  id: "spend_audit",
  probePath: "/v1/spend-audit",
  tools: [
    {
      name: "talonic_spend_audit_get",
      title: "The spend audit",
      description: d(
        "The spend audit: every vendor with its verdicts and open to-dos, the lists it was built from, display options and assumptions.",
        "USE WHEN: reviewing what is still missing per vendor.",
        "NOT FOR: the share link (talonic_spend_audit_get_share).",
        "ARGS: none. RETURNS: the audit object.",
      ),
      method: "GET",
      path: "/v1/spend-audit",
      input: {},
      annotations: readOnly,
    },
    {
      name: "talonic_spend_audit_set_options",
      title: "Spend audit display options",
      description: d(
        "Set the audit's display options.",
        "USE WHEN: hiding or showing price-confirmed vendors.",
        "NOT FOR: the assumptions text (talonic_spend_audit_set_assumptions).",
        "ARGS: `show_price_confirmed`. Needs apps:spend-audit:write and the workspace permission.",
      ),
      method: "PUT",
      path: "/v1/spend-audit/options",
      body: ["show_price_confirmed"],
      input: {
        show_price_confirmed: z
          .boolean()
          .optional()
          .describe("Show vendors whose prices are confirmed."),
      },
      annotations: write(true),
    },
    {
      name: "talonic_spend_audit_set_assumptions",
      title: "Spend audit assumptions",
      description: d(
        "Replace the basis and assumptions text shown under the audit.",
        "USE WHEN: stating what the audit rests on.",
        "NOT FOR: display options (talonic_spend_audit_set_options).",
        "ARGS: `text` (at most 10,000 characters). Needs apps:spend-audit:write and the workspace permission.",
      ),
      method: "PUT",
      path: "/v1/spend-audit/assumptions",
      body: ["text"],
      input: { text: z.string().max(10000).describe("The text.") },
      annotations: write(true),
    },
    {
      name: "talonic_spend_audit_explain_todo",
      title: "Close a vendor to-do with a reason",
      description: d(
        "Close one vendor's to-do with a reason instead of a document.",
        "USE WHEN: no document is needed for that vendor.",
        "NOT FOR: reopening (talonic_spend_audit_reopen_todo).",
        "ARGS: `key` (vendor key from talonic_spend_audit_get), `reason`. Needs apps:spend-audit:write and the upload permission.",
      ),
      method: "POST",
      path: "/v1/spend-audit/todos/{key}/explain",
      body: ["reason"],
      input: {
        key: z.string().min(1).describe("The vendor key."),
        reason: z.string().min(1).max(1000).describe("Why no document is needed."),
      },
      annotations: write(true),
    },
    {
      name: "talonic_spend_audit_reopen_todo",
      title: "Reopen a vendor to-do",
      description: d(
        "Reopen a to-do that was closed with a reason.",
        "USE WHEN: the reason no longer holds.",
        "NOT FOR: closing one (talonic_spend_audit_explain_todo).",
        "ARGS: `key`. Needs apps:spend-audit:write and the upload permission.",
      ),
      method: "DELETE",
      path: "/v1/spend-audit/todos/{key}/explain",
      input: { key: z.string().min(1).describe("The vendor key.") },
      annotations: write(true),
    },
    {
      name: "talonic_spend_audit_share",
      title: "Publish the spend audit",
      description: d(
        "PUBLISHES the audit outside the workspace: answers a new link and password; the previous link stops working. Confirm with the user first.",
        "USE WHEN: the user asks to send the audit to the client.",
        "NOT FOR: reading the current link (talonic_spend_audit_get_share).",
        "ARGS: none. RETURNS: { url, password }. Needs apps:spend-audit:write and the workspace permission.",
      ),
      method: "POST",
      path: "/v1/spend-audit/share",
      input: {},
      annotations: write(false, false, true),
    },
    {
      name: "talonic_spend_audit_get_share",
      title: "Current spend audit link",
      description: d(
        "The published link and its password, or nothing when the audit is not published.",
        "USE WHEN: the user asks for the link again.",
        "NOT FOR: publishing (talonic_spend_audit_share).",
        "ARGS: none. Needs the workspace permission.",
      ),
      method: "GET",
      path: "/v1/spend-audit/share",
      input: {},
      annotations: readOnly,
    },
    {
      name: "talonic_spend_audit_unshare",
      title: "Revoke the spend audit link",
      description: d(
        "Revoke the published link; nobody outside the workspace can open the audit any more.",
        "USE WHEN: the user asks to stop sharing.",
        "NOT FOR: a new link (talonic_spend_audit_share).",
        "ARGS: none. Needs apps:spend-audit:write and the workspace permission.",
      ),
      method: "DELETE",
      path: "/v1/spend-audit/share",
      input: {},
      annotations: write(true, true, true),
    },
  ],
}

const OBJECTS: AppWorkflowGroup = {
  id: "objects",
  probePath: "/v1/objects/recent",
  probeParams: { limit: 1 },
  tools: [
    {
      name: "talonic_objects_recent",
      title: "Latest decisions",
      description: d(
        "The latest decisions recorded on business objects (invoices, loads, payments, contracts, leases, ledger rows), newest first.",
        "USE WHEN: what was decided lately, across apps.",
        "NOT FOR: one object's history (talonic_object_get).",
        "ARGS: `limit` (default 50).",
      ),
      method: "GET",
      path: "/v1/objects/recent",
      query: { limit: "limit" },
      input: { limit: z.number().int().min(1).max(500).optional().describe("How many.") },
      annotations: readOnly,
    },
    {
      name: "talonic_objects_by_type",
      title: "Objects of one type",
      description: d(
        "Without `state`: how many objects of a type are in each state. With `state`: the objects in that state.",
        "USE WHEN: counting or listing invoices, loads or leases by state.",
        "NOT FOR: one object (talonic_object_get).",
        "ARGS: `type` (e.g. invoice, load, lease, money_found_row), `state`, `limit`, `offset`.",
      ),
      method: "GET",
      path: "/v1/objects/{type}",
      query: { state: "state", limit: "limit", offset: "offset" },
      input: {
        type: z.string().min(1).describe("The object type."),
        state: z.string().optional().describe("A state, e.g. paid."),
        limit: z.number().int().min(1).max(1000).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: readOnly,
    },
    {
      name: "talonic_object_get",
      title: "One object and its history",
      description: d(
        "The current state of one business object and every decision recorded on it, with who and the evidence.",
        "USE WHEN: why an invoice, load or lease is in its state.",
        "NOT FOR: recording a decision (talonic_object_record_decision).",
        "ARGS: `type`, `key`.",
      ),
      method: "GET",
      path: "/v1/objects/{type}/{key}",
      input: { type: z.string().min(1), key: z.string().min(1).describe("The object key.") },
      annotations: readOnly,
    },
    {
      name: "talonic_object_record_decision",
      title: "Record a decision on an object",
      description: d(
        "Record a decision on one business object; it is attributed to this connection, never to a person.",
        "USE WHEN: the user decided (e.g. a lease is checked, an invoice is disputed).",
        "NOT FOR: Money Found rows (talonic_money_found_set_row_state).",
        "ARGS: `type`, `key`, `to_state`, optional `from_state` (refused when the object is elsewhere), `note`, `evidence[]`. Needs records:write.",
      ),
      method: "POST",
      path: "/v1/objects/{type}/{key}/events",
      body: ["to_state", "from_state", "note", "evidence"],
      input: {
        type: z.string().min(1),
        key: z.string().min(1),
        to_state: z
          .string()
          .regex(/^[a-z][a-z0-9_]{0,63}$/)
          .describe("The new state."),
        from_state: z
          .string()
          .regex(/^[a-z][a-z0-9_]{0,63}$/)
          .optional(),
        note: z.string().max(2000).optional(),
        evidence: z
          .array(
            z.object({
              document_id: z.string().optional(),
              field: z.string().optional(),
              reference_data_id: z.string().optional(),
              label: z.string(),
            }),
          )
          .optional(),
      },
      annotations: write(false),
    },
  ],
}

const PAYABLES_DESK: AppWorkflowGroup = {
  id: "payables_desk",
  probePath: "/v1/payables-desk/policy",
  tools: [
    {
      name: "talonic_payables_desk_page",
      title: "Payables desk",
      description: d(
        "One page of supplier invoices with what the checks read and found on each, or ready: false with the reason.",
        "USE WHEN: working through supplier invoices before payment.",
        "NOT FOR: the payment rules (talonic_payables_desk_policy).",
        "ARGS: `offset`, `limit` (at most 500).",
      ),
      method: "GET",
      path: "/v1/payables-desk/desk",
      query: { offset: "offset", limit: "limit" },
      input: {
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
      annotations: readOnly,
    },
    {
      name: "talonic_payables_desk_policy",
      title: "Payment rules",
      description: d(
        "The payment rules in force (order and approval thresholds, currency, rates), where they come from, and their version.",
        "USE WHEN: before changing the rules.",
        "NOT FOR: the invoices (talonic_payables_desk_page).",
        "ARGS: none.",
      ),
      method: "GET",
      path: "/v1/payables-desk/policy",
      input: {},
      annotations: readOnly,
    },
    {
      name: "talonic_payables_desk_save_policy",
      title: "Save the payment rules",
      description: d(
        "Save the payment rules. Send the version read so a save over a newer one is refused (409).",
        "USE WHEN: changing thresholds or rates.",
        "NOT FOR: reading them (talonic_payables_desk_policy).",
        "ARGS: `orderAbove`, `approvalAbove`, `currency`, `rates`, `version`. Needs apps:payables-desk:write and the workspace permission.",
      ),
      method: "PUT",
      path: "/v1/payables-desk/policy",
      body: ["orderAbove", "approvalAbove", "currency", "rates", "version"],
      input: {
        orderAbove: z.number().min(0),
        approvalAbove: z.number().min(0),
        currency: z.string().max(3).nullable().optional(),
        rates: z.record(z.string(), z.unknown()).optional(),
        version: z.number().int().min(0).optional(),
      },
      annotations: write(true),
    },
  ],
}

const DOC = { document_id: zUuid().describe("The workbook document id.") }
const STRUCTURE = { structure_id: zUuid().describe("The target structure id.") }

const WORKBOOK: AppWorkflowGroup = {
  id: "workbook",
  probePath: "/v1/sheet-capture/specs",
  tools: [
    {
      name: "talonic_workbook_list_structures",
      title: "Target structures",
      description: d(
        "The workspace's target structures (each made from a client's example table) with their mapping counts.",
        "USE WHEN: choosing the structure to map a workbook onto.",
        "NOT FOR: one structure's fields (talonic_workbook_get_structure).",
        "ARGS: none.",
      ),
      method: "GET",
      path: "/v1/sheet-capture/specs",
      input: {},
      annotations: readOnly,
    },
    {
      name: "talonic_workbook_create_structure",
      title: "Create a target structure",
      description: d(
        "Create, or replace, a target structure from the example table in a captured workbook.",
        "USE WHEN: a client sent their example table.",
        "NOT FOR: editing fields (talonic_workbook_update_structure).",
        "ARGS: `document_id`, `name`. Needs documents:write.",
      ),
      method: "POST",
      path: "/v1/sheet-capture/specs",
      body: ["document_id", "name"],
      input: { ...DOC, name: z.string().min(1).max(200) },
      annotations: write(false),
    },
    {
      name: "talonic_workbook_get_structure",
      title: "One target structure",
      description: d(
        "One target structure with its fields.",
        "USE WHEN: before editing it.",
        "NOT FOR: its label mappings (talonic_workbook_list_mappings).",
        "ARGS: `structure_id`.",
      ),
      method: "GET",
      path: "/v1/sheet-capture/specs/{structure_id}",
      input: STRUCTURE,
      annotations: readOnly,
    },
    {
      name: "talonic_workbook_update_structure",
      title: "Edit a target structure",
      description: d(
        "Set field defaults and aliases (only the fields named change) and, with `checks`, replace the identity checks (a total that must equal its parts).",
        "USE WHEN: a person decided a default, an alias or a check.",
        "NOT FOR: label mappings (talonic_workbook_correct_mapping).",
        "ARGS: `structure_id`, `fields[] { name, default?, aliases? }`, `checks[] { name, total, parts[] }`. Needs documents:write.",
      ),
      method: "PATCH",
      path: "/v1/sheet-capture/specs/{structure_id}",
      body: ["fields", "checks"],
      input: {
        ...STRUCTURE,
        fields: z
          .array(
            z.object({
              name: z.string(),
              default: z.string().nullable().optional(),
              aliases: z.array(z.string()).optional(),
            }),
          )
          .optional(),
        checks: z
          .array(z.object({ name: z.string(), total: z.string(), parts: z.array(z.string()) }))
          .optional(),
      },
      annotations: write(true),
    },
    {
      name: "talonic_workbook_list_mappings",
      title: "Label mappings",
      description: d(
        "How each row and column label maps onto the structure, who decided it, and whether a person approved it.",
        "USE WHEN: reviewing labels before projecting workbooks.",
        "NOT FOR: correcting one (talonic_workbook_correct_mapping).",
        "ARGS: `structure_id`.",
      ),
      method: "GET",
      path: "/v1/sheet-capture/specs/{structure_id}/mappings",
      input: STRUCTURE,
      annotations: readOnly,
    },
    {
      name: "talonic_workbook_correct_mapping",
      title: "Correct a label mapping",
      description: d(
        "Correct one label's mapping; it counts as approved and every later workbook uses it. scope header_leaf applies the metric or ignore decision to every column header ending in the same label.",
        "USE WHEN: a label maps wrongly.",
        "NOT FOR: approving one as it stands (talonic_workbook_approve_mapping).",
        "ARGS: `structure_id`, `label_key`, `scope`, `metric`, `set`, `ignore`. Needs documents:write.",
      ),
      method: "PATCH",
      path: "/v1/sheet-capture/specs/{structure_id}/mappings/{label_key}",
      body: ["scope", "metric", "set", "ignore"],
      input: {
        ...STRUCTURE,
        label_key: z.string().min(1).describe("The label key from talonic_workbook_list_mappings."),
        scope: z.enum(["label", "header_leaf"]).optional(),
        metric: z.string().max(200).optional(),
        set: z.record(z.string(), z.string()).optional(),
        ignore: z.boolean().optional(),
      },
      annotations: write(true),
    },
    {
      name: "talonic_workbook_approve_mapping",
      title: "Approve a label mapping",
      description: d(
        "Approve one label's mapping as it stands.",
        "USE WHEN: the mapping is right.",
        "NOT FOR: changing it (talonic_workbook_correct_mapping).",
        "ARGS: `structure_id`, `label_key`. Needs documents:write.",
      ),
      method: "POST",
      path: "/v1/sheet-capture/specs/{structure_id}/mappings/{label_key}/approve",
      input: { ...STRUCTURE, label_key: z.string().min(1) },
      annotations: write(true),
    },
    {
      name: "talonic_workbook_get_capture",
      title: "A workbook's capture",
      description: d(
        "What was captured from one workbook: the run, its tables with counts, its pictures with their position. run: null when never captured.",
        "USE WHEN: finding the table ids of a workbook.",
        "NOT FOR: one table's cells (talonic_workbook_table).",
        "ARGS: `document_id`.",
      ),
      method: "GET",
      path: "/v1/sheet-capture/documents/{document_id}",
      input: DOC,
      annotations: readOnly,
    },
    {
      name: "talonic_workbook_checks",
      title: "Workbook consistency findings",
      description: d(
        "Totals that do not add up and similar findings; identity findings too when `structure_id` is given.",
        "USE WHEN: checking a workbook before using its figures.",
        "NOT FOR: the facts (talonic_workbook_facts).",
        "ARGS: `document_id`, `structure_id`.",
      ),
      method: "GET",
      path: "/v1/sheet-capture/documents/{document_id}/checks",
      query: { structure_id: "spec_id" },
      input: { ...DOC, structure_id: zUuid().optional() },
      annotations: readOnly,
    },
    {
      name: "talonic_workbook_facts",
      title: "Workbook facts",
      description: d(
        "The workbook's facts under a target structure, each with its figure, fields and source cell.",
        "USE WHEN: reading the mapped figures.",
        "NOT FOR: projecting them first (talonic_workbook_project).",
        "ARGS: `document_id`, `structure_id`, `metric`, `limit` (at most 5,000), `offset`.",
      ),
      method: "GET",
      path: "/v1/sheet-capture/documents/{document_id}/facts",
      query: { structure_id: "spec_id", metric: "metric", limit: "limit", offset: "offset" },
      input: {
        ...DOC,
        ...STRUCTURE,
        metric: z.string().optional(),
        limit: z.number().int().min(1).max(5000).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: readOnly,
    },
    {
      name: "talonic_workbook_project",
      title: "Project a workbook onto a structure",
      description: d(
        "Map the workbook's labels and write its facts under the structure, replacing the facts it held for that structure.",
        "USE WHEN: after the mappings are reviewed.",
        "NOT FOR: reading facts (talonic_workbook_facts).",
        "ARGS: `document_id`, `structure_id`. Needs documents:write.",
      ),
      method: "POST",
      path: "/v1/sheet-capture/documents/{document_id}/facts",
      body: ["spec_id"],
      input: { ...DOC, ...STRUCTURE },
      annotations: write(true),
    },
    {
      name: "talonic_workbook_table",
      title: "One table as a grid",
      description: d(
        "One captured table rebuilt as a grid with every value cell and the header, label, title, context and note cells that give it meaning.",
        "USE WHEN: showing a table, or a cell in place (`around`).",
        "NOT FOR: everything about one cell (talonic_workbook_cell).",
        "ARGS: `document_id`, `table_id`, `limit`, `around` (A1), `from` (row).",
      ),
      method: "GET",
      path: "/v1/sheet-capture/documents/{document_id}/tables/{table_id}",
      query: { limit: "limit", around: "around", from: "from" },
      input: {
        ...DOC,
        table_id: zUuid(),
        limit: z.number().int().min(1).max(5000).optional(),
        around: z
          .string()
          .regex(/^[A-Z]{1,3}\d{1,7}$/)
          .optional(),
        from: z.number().int().min(0).optional(),
      },
      annotations: readOnly,
    },
    {
      name: "talonic_workbook_cell",
      title: "One captured cell",
      description: d(
        "Everything known about one cell: value, raw text, scale, currency, column path, row labels, notes, formula.",
        "USE WHEN: explaining where a figure comes from.",
        "NOT FOR: the whole table (talonic_workbook_table).",
        "ARGS: `document_id`, `table_id`, `a1`.",
      ),
      method: "GET",
      path: "/v1/sheet-capture/documents/{document_id}/tables/{table_id}/cells/{a1}",
      input: { ...DOC, table_id: zUuid(), a1: z.string().regex(/^[A-Z]{1,3}\d{1,7}$/) },
      annotations: readOnly,
    },
    {
      name: "talonic_workbook_recapture",
      title: "Capture a workbook again",
      description: d(
        "Capture the workbook again now.",
        "USE WHEN: the capture is missing or out of date.",
        "NOT FOR: projecting facts (talonic_workbook_project).",
        "ARGS: `document_id`. Needs documents:write.",
      ),
      method: "POST",
      path: "/v1/sheet-capture/documents/{document_id}/run",
      input: DOC,
      annotations: write(true),
    },
  ],
}

const RECORD_SETS: AppWorkflowGroup = {
  id: "record_sets",
  probePath: "/v1/record-sets",
  probeParams: { limit: 1 },
  tools: [
    {
      name: "talonic_record_set_page",
      title: "Record set grid page",
      description: d(
        "One page of a record set with its fields and cells, the shape the web grid shows. Rows you may not see are left out.",
        "USE WHEN: reading cell values of a record set.",
        "NOT FOR: one cell's provenance (talonic_record_set_cell_provenance).",
        "ARGS: `record_set_id`, `limit` (at most 500), `offset`, `cursor`, `field_keys[]`, `record_ids[]`.",
      ),
      method: "GET",
      path: "/v1/record-sets/{record_set_id}/page",
      query: {
        limit: "limit",
        offset: "offset",
        cursor: "cursor",
        field_keys: "fieldKeys",
        record_ids: "recordIds",
      },
      input: {
        record_set_id: zUuid(),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional(),
        cursor: z.string().optional(),
        field_keys: z.array(z.string()).optional(),
        record_ids: z.array(z.string()).optional(),
      },
      annotations: readOnly,
    },
    {
      name: "talonic_record_set_cell_provenance",
      title: "Cell provenance",
      description: d(
        "One cell's value, confidence, status, source and audit reference.",
        "USE WHEN: where a value came from.",
        "NOT FOR: many cells (talonic_record_set_page).",
        "ARGS: `record_set_id`, `record_id`, `field_key`.",
      ),
      method: "GET",
      path: "/v1/record-sets/{record_set_id}/cells/{record_id}/{field_key}/provenance",
      input: { record_set_id: zUuid(), record_id: zUuid(), field_key: z.string().min(1) },
      annotations: readOnly,
    },
  ],
}

const AP: AppWorkflowGroup = {
  id: "ap",
  probePath: "/v1/ap/config",
  tools: [
    {
      name: "talonic_ap_bill",
      title: "One AP bill",
      description: d(
        "One bill by its key: status, holds, missing information, risk, lines and links.",
        "USE WHEN: one bill in detail.",
        "NOT FOR: lists (talonic_ap_bills).",
        "ARGS: `key` (bill key).",
      ),
      method: "GET",
      path: "/v1/ap/bill",
      query: { key: "key" },
      input: { key: z.string().min(1) },
      annotations: readOnly,
    },
    {
      name: "talonic_ap_bill_documents",
      title: "Documents of an AP bill",
      description: d(
        "The documents one bill links to (order, contract, delivery notes) and why.",
        "USE WHEN: checking a bill against its order or contract.",
        "NOT FOR: the bill itself (talonic_ap_bill).",
        "ARGS: `key`.",
      ),
      method: "GET",
      path: "/v1/ap/bill/file",
      query: { key: "key" },
      input: { key: z.string().min(1) },
      annotations: readOnly,
    },
    {
      name: "talonic_ap_order",
      title: "One purchase order",
      description: d(
        "One purchase order by its number, with its invoices and the documents they are checked with.",
        "USE WHEN: everything billed against an order.",
        "NOT FOR: one bill (talonic_ap_bill).",
        "ARGS: `key` (order number).",
      ),
      method: "GET",
      path: "/v1/ap/order",
      query: { key: "key" },
      input: { key: z.string().min(1) },
      annotations: readOnly,
    },
    {
      name: "talonic_ap_summary",
      title: "AP counts per status",
      description: d(
        "How many bills are ready, need information, are being evaluated or are held, with their amounts.",
        "USE WHEN: a quick count.",
        "NOT FOR: totals with entities (talonic_ap_overview).",
        "ARGS: none.",
      ),
      method: "GET",
      path: "/v1/ap/summary",
      input: {},
      annotations: readOnly,
    },
    {
      name: "talonic_ap_set_language",
      title: "AP reviewer language",
      description: d(
        "Set the language reviewers write their reasons in.",
        "USE WHEN: the team works in another language.",
        "NOT FOR: the AP configuration (talonic_ap_save_config).",
        "ARGS: `language` (en, es, de, fr, it, pt, pt-PT). Needs apps:payables:write.",
      ),
      method: "PUT",
      path: "/v1/ap/language",
      body: ["language"],
      input: { language: z.enum(["en", "es", "de", "fr", "it", "pt", "pt-PT"]) },
      annotations: write(true),
    },
    {
      name: "talonic_ap_set_rule_important",
      title: "Mark a payment rule important",
      description: d(
        "A failed payment rule marked important holds its bill at high risk.",
        "USE WHEN: a rule must never be missed.",
        "NOT FOR: whether payment depends on the rule (the effect).",
        "ARGS: `rule_id`, `important`. Needs apps:payables:write.",
      ),
      method: "POST",
      path: "/v1/ap/rules/rules/{rule_id}/important",
      body: ["important"],
      input: { rule_id: zUuid(), important: z.boolean() },
      annotations: write(true),
    },
  ],
}

const RULE_FIELDS = {
  obligation: z.string().optional().describe("How binding the rule is."),
  section: z.string().max(300).optional(),
  applies_to: z.string().max(500).optional(),
  condition: z.string().max(1000).optional(),
  threshold: z.string().max(300).optional(),
  testable: z.boolean().optional(),
}
const RULE_BODY = [
  "text",
  "obligation",
  "section",
  "applies_to",
  "condition",
  "threshold",
  "testable",
]

const COMPLIANCE: AppWorkflowGroup = {
  id: "compliance",
  probePath: "/v1/compliance/frameworks",
  tools: [
    {
      name: "talonic_compliance_get_framework",
      title: "One compliance framework",
      description: d(
        "One framework with its reading state, ON/OFF and its rules.",
        "USE WHEN: before editing its rules.",
        "NOT FOR: all frameworks (the frameworks list).",
        "ARGS: `document_id`.",
      ),
      method: "GET",
      path: "/v1/compliance/frameworks/{document_id}",
      input: { document_id: zUuid() },
      annotations: readOnly,
    },
    {
      name: "talonic_compliance_reread_framework",
      title: "Read a framework's rules again",
      description: d(
        "Read the framework's rules again from its document; the rules are replaced when the reading finishes.",
        "USE WHEN: the document changed or the rules were read wrongly.",
        "NOT FOR: editing one rule (talonic_compliance_update_rule).",
        "ARGS: `document_id`. Needs apps:compliance:write; 409 while the app is off.",
      ),
      method: "POST",
      path: "/v1/compliance/frameworks/{document_id}/extract",
      input: { document_id: zUuid() },
      annotations: write(false, true),
    },
    {
      name: "talonic_compliance_add_rule",
      title: "Add a compliance rule",
      description: d(
        "Add a rule written by a person to a framework.",
        "USE WHEN: a rule is missing.",
        "NOT FOR: changing a rule (talonic_compliance_update_rule).",
        "ARGS: `document_id`, `text`, optional obligation, section, applies_to, condition, threshold, testable. Needs apps:compliance:write.",
      ),
      method: "POST",
      path: "/v1/compliance/frameworks/{document_id}/rules",
      body: RULE_BODY,
      input: { document_id: zUuid(), text: z.string().min(1).max(2000), ...RULE_FIELDS },
      annotations: write(false),
    },
    {
      name: "talonic_compliance_update_rule",
      title: "Edit a compliance rule",
      description: d(
        "Edit one rule; only the fields sent change.",
        "USE WHEN: a rule reads wrongly.",
        "NOT FOR: removing it (talonic_compliance_delete_rule).",
        "ARGS: `rule_id` plus the fields to change. Needs apps:compliance:write.",
      ),
      method: "PATCH",
      path: "/v1/compliance/rules/{rule_id}",
      body: RULE_BODY,
      input: { rule_id: zUuid(), text: z.string().min(1).max(2000).optional(), ...RULE_FIELDS },
      annotations: write(true),
    },
    {
      name: "talonic_compliance_delete_rule",
      title: "Remove a compliance rule",
      description: d(
        "Take one rule out of its framework.",
        "USE WHEN: the rule does not belong.",
        "NOT FOR: switching a whole framework off.",
        "ARGS: `rule_id`. Needs apps:compliance:write.",
      ),
      method: "DELETE",
      path: "/v1/compliance/rules/{rule_id}",
      input: { rule_id: zUuid() },
      annotations: write(true, true),
    },
  ],
}

const MONEY_FOUND: AppWorkflowGroup = {
  id: "money_found",
  probePath: "/v1/money-found/config",
  tools: [
    {
      name: "talonic_money_found_catalog",
      title: "What Money Found offers",
      description: d(
        "The roles a configuration binds, their fields, and the levers with what each needs.",
        "USE WHEN: setting Money Found up.",
        "NOT FOR: the configuration in force (talonic_money_found_config).",
        "ARGS: none.",
      ),
      method: "GET",
      path: "/v1/money-found/catalog",
      input: {},
      annotations: readOnly,
    },
    {
      name: "talonic_money_found_config",
      title: "Money Found configuration",
      description: d(
        "The configuration in force, or config: null.",
        "USE WHEN: before changing it.",
        "NOT FOR: a proposal (talonic_money_found_propose_config).",
        "ARGS: none.",
      ),
      method: "GET",
      path: "/v1/money-found/config",
      input: {},
      annotations: readOnly,
    },
    {
      name: "talonic_money_found_propose_config",
      title: "Propose a Money Found configuration",
      description: d(
        "Propose a configuration from the workspace's Specs and tables. Saves nothing; show it to the user, then confirm with talonic_money_found_save_config.",
        "USE WHEN: no configuration yet, or the sources changed.",
        "NOT FOR: saving (talonic_money_found_save_config).",
        "ARGS: `as_of` (YYYY-MM-DD). Needs apps:money-found:write; 409 while the app is off.",
      ),
      method: "POST",
      path: "/v1/money-found/config/propose",
      query: { as_of: "as_of" },
      input: {
        as_of: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      },
      annotations: write(false),
    },
    {
      name: "talonic_money_found_save_config",
      title: "Confirm a Money Found configuration",
      description: d(
        "Confirm a configuration (validated in full; a binding to a missing source or field is dropped). The ledger rebuilds on the next read.",
        "USE WHEN: the user accepted a proposal or a change.",
        "NOT FOR: proposing one (talonic_money_found_propose_config).",
        "ARGS: `config` (the whole object). Needs apps:money-found:write.",
      ),
      method: "PUT",
      path: "/v1/money-found/config",
      body: ["config"],
      input: { config: z.record(z.string(), z.unknown()) },
      annotations: write(true, true),
    },
    {
      name: "talonic_money_found_structure_clauses",
      title: "Read clause numbers",
      description: d(
        "Read tiers, rates and dates out of the configured contracts' clause text and save them into the configuration.",
        "USE WHEN: after confirming a configuration, so rebate and commitment levers run.",
        "NOT FOR: cost bearers (talonic_money_found_cost_clauses).",
        "ARGS: none. Needs apps:money-found:write; 422 without a configuration.",
      ),
      method: "POST",
      path: "/v1/money-found/config/structure-clauses",
      input: {},
      annotations: write(true),
    },
    {
      name: "talonic_money_found_cost_clauses",
      title: "Read who bears each cost",
      description: d(
        "Read who bears each cost from the contracts' own text and save it; an answer counts only when its quote is found. dry_run counts only.",
        "USE WHEN: pass-through costs matter.",
        "NOT FOR: clause numbers (talonic_money_found_structure_clauses).",
        "ARGS: `keys[]`, `limit`, `dry_run`. Needs apps:money-found:write.",
      ),
      method: "POST",
      path: "/v1/money-found/config/cost-clauses",
      body: ["keys", "limit", "dry_run"],
      input: {
        keys: z.array(z.string()).max(2000).optional(),
        limit: z.number().int().min(1).max(5000).optional(),
        dry_run: z.boolean().optional(),
      },
      annotations: write(true),
    },
    {
      name: "talonic_money_found_delete_config",
      title: "Remove the Money Found configuration",
      description: d(
        "Remove the configuration; the ledger without one answers again.",
        "USE WHEN: the user asks to start over.",
        "NOT FOR: changing it (talonic_money_found_save_config).",
        "ARGS: none. Needs apps:money-found:write and the workspace permission.",
      ),
      method: "DELETE",
      path: "/v1/money-found/config",
      input: {},
      annotations: write(true, true),
    },
    {
      name: "talonic_money_found_set_row_state",
      title: "Record a decision on a ledger row",
      description: d(
        "Record open, in_progress, resolved or dismissed on one ledger row; the next ledger read shows it.",
        "USE WHEN: the user acted on a finding.",
        "NOT FOR: re-reviewing a contract price row.",
        "ARGS: `lever_id`, `key` (row key), `state`, `note`. Needs apps:money-found:write.",
      ),
      method: "POST",
      path: "/v1/money-found/rows/{lever_id}/{key}/state",
      body: ["state", "note"],
      input: {
        lever_id: z.string().min(1),
        key: z.string().min(1),
        state: z.enum(["open", "in_progress", "resolved", "dismissed"]),
        note: z.string().max(2000).optional(),
      },
      annotations: write(true),
    },
  ],
}

const PRICE_BASELINE: AppWorkflowGroup = {
  id: "price_baseline",
  probePath: "/v1/price-baseline/indices",
  tools: [
    {
      name: "talonic_price_baseline_needed",
      title: "What is missing to price contracts",
      description: d(
        "Per contract and year, the inputs still missing before its prices can be computed.",
        "USE WHEN: planning what to collect.",
        "NOT FOR: the register (talonic_price_baseline_register).",
        "ARGS: `years[]`.",
      ),
      method: "GET",
      path: "/v1/price-baseline/needed",
      query: { years: "years" },
      input: { years: z.array(z.number().int()).optional() },
      annotations: readOnly,
    },
    {
      name: "talonic_price_baseline_invoices",
      title: "Invoices found",
      description: d(
        "The invoices found with their matched contract and price check; with `filter` or paging, one window and the headline.",
        "USE WHEN: which invoices are unmatched or off contract.",
        "NOT FOR: candidate contracts of one invoice (talonic_price_baseline_match_invoice).",
        "ARGS: `filter`, `limit` (at most 500), `offset`.",
      ),
      method: "GET",
      path: "/v1/price-baseline/invoices",
      query: { filter: "filter", limit: "limit", offset: "offset" },
      input: {
        filter: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: readOnly,
    },
    {
      name: "talonic_price_baseline_scan_invoices",
      title: "Find new invoices",
      description: d(
        "Find invoices not yet listed and match the unmatched ones again.",
        "USE WHEN: new invoices arrived.",
        "NOT FOR: assigning one (talonic_price_baseline_assign_invoice).",
        "ARGS: none. Needs apps:price-baseline:write; 409 while the app is off.",
      ),
      method: "POST",
      path: "/v1/price-baseline/invoices/scan",
      input: {},
      annotations: write(true),
    },
    {
      name: "talonic_price_baseline_match_invoice",
      title: "Candidate contracts for an invoice",
      description: d(
        "The contracts an invoice may bill, scored. Changes nothing.",
        "USE WHEN: before assigning an invoice's contract.",
        "NOT FOR: assigning (talonic_price_baseline_assign_invoice).",
        "ARGS: `document_id`.",
      ),
      method: "GET",
      path: "/v1/price-baseline/invoices/{document_id}/match",
      input: { document_id: zUuid() },
      annotations: readOnly,
    },
    {
      name: "talonic_price_baseline_assign_invoice",
      title: "Assign an invoice's contract",
      description: d(
        "Assign the contract an invoice bills (`model_id`), null to match again, or skip=true when it is not a bill; its price check runs again.",
        "USE WHEN: after talonic_price_baseline_match_invoice.",
        "NOT FOR: previewing (talonic_price_baseline_match_invoice).",
        "ARGS: `document_id`, `model_id`, `skip`. Needs apps:price-baseline:write.",
      ),
      method: "PUT",
      path: "/v1/price-baseline/invoices/{document_id}",
      body: ["model_id", "skip"],
      input: {
        document_id: zUuid(),
        model_id: zUuid().nullable().optional(),
        skip: z.boolean().optional(),
      },
      annotations: write(true),
    },
  ],
}

const CONTRACT_CHECK: AppWorkflowGroup = {
  id: "contract_check",
  probePath: "/v1/contract-check/settings",
  tools: [
    {
      name: "talonic_contract_check_settings",
      title: "Contract Check settings",
      description: d(
        "The settings with what is needed to choose them: data products, the CRM table's columns, sample rows, contract types.",
        "USE WHEN: before changing the settings.",
        "NOT FOR: values of one column (talonic_contract_check_column_values).",
        "ARGS: none.",
      ),
      method: "GET",
      path: "/v1/contract-check/settings",
      input: {},
      annotations: readOnly,
    },
    {
      name: "talonic_contract_check_save_settings",
      title: "Save Contract Check settings",
      description: d(
        "Save which data product the contracts come from and the check settings.",
        "USE WHEN: setting Contract Check up.",
        "NOT FOR: reading them (talonic_contract_check_settings).",
        "ARGS: `data_product_id`, `settings`. Needs write and the upload permission.",
      ),
      method: "PUT",
      path: "/v1/contract-check/settings",
      body: ["data_product_id", "settings"],
      input: {
        data_product_id: zUuid().optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
      },
      annotations: write(true),
    },
    {
      name: "talonic_contract_check_column_values",
      title: "Values of a CRM column",
      description: d(
        "Up to 100 distinct values of one CRM column, to choose a setting from; more: true when there are more.",
        "USE WHEN: filling a setting that names CRM values.",
        "NOT FOR: the settings (talonic_contract_check_settings).",
        "ARGS: `column`.",
      ),
      method: "GET",
      path: "/v1/contract-check/settings/values",
      query: { column: "column" },
      input: { column: z.string().min(1) },
      annotations: readOnly,
    },
  ],
}

const CHART_TO_DATA: AppWorkflowGroup = {
  id: "chart_to_data",
  probePath: "/v1/chart-to-data/read-charts",
  tools: [
    {
      name: "talonic_chart_pdfs_page",
      title: "PDF documents for chart reading",
      description: d(
        "One window of the workspace's PDF documents with total.",
        "USE WHEN: choosing documents whose charts to read.",
        "NOT FOR: what reading would cost (talonic_chart_read_charts_preview).",
        "ARGS: `limit`, `offset`.",
      ),
      method: "GET",
      path: "/v1/chart-to-data/pdfs/page",
      query: { limit: "limit", offset: "offset" },
      input: {
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: readOnly,
    },
    {
      name: "talonic_chart_read_charts_available",
      title: "Whether chart reading is offered",
      description: d(
        "{ available }: whether reading the charts of selected documents is offered here.",
        "USE WHEN: before offering it to the user.",
        "NOT FOR: the cost (talonic_chart_read_charts_preview).",
        "ARGS: none.",
      ),
      method: "GET",
      path: "/v1/chart-to-data/read-charts",
      input: {},
      annotations: readOnly,
    },
    {
      name: "talonic_chart_read_charts_preview",
      title: "Preview reading charts",
      description: d(
        "What reading the charts of these documents would read and cost at most. Admits nothing.",
        "USE WHEN: always before talonic_chart_read_charts.",
        "NOT FOR: reading (talonic_chart_read_charts).",
        "ARGS: `document_ids[]`. Needs the upload permission.",
      ),
      method: "GET",
      path: "/v1/chart-to-data/read-charts/preview",
      query: { document_ids: "document_ids" },
      input: { document_ids: z.array(zUuid()).min(1) },
      annotations: readOnly,
    },
    {
      name: "talonic_chart_read_charts",
      title: "Read charts of selected documents",
      description: d(
        "Read the charts of the selected documents, one outcome per document. Costs credits: preview first and confirm with the user.",
        "USE WHEN: after talonic_chart_read_charts_preview.",
        "NOT FOR: previewing (talonic_chart_read_charts_preview).",
        "ARGS: `document_ids[]`. Needs apps:chart-to-data:write and the upload permission; 409 while the app is off.",
      ),
      method: "POST",
      path: "/v1/chart-to-data/read-charts",
      body: ["document_ids"],
      input: { document_ids: z.array(zUuid()).min(1) },
      annotations: write(false),
    },
  ],
}

/** Every probe-gated group, in listing order. */
export const APP_WORKFLOW_GROUPS: readonly AppWorkflowGroup[] = [
  RECEIVABLES,
  SPEND_AUDIT,
  OBJECTS,
  PAYABLES_DESK,
  WORKBOOK,
  RECORD_SETS,
  AP,
  COMPLIANCE,
  MONEY_FOUND,
  PRICE_BASELINE,
  CONTRACT_CHECK,
  CHART_TO_DATA,
]

/** Tool argument names that map onto a differently named body field. */
const BODY_ALIAS: Record<string, string> = { spec_id: "structure_id" }

/** @internal The request a tool sends for its arguments. */
export function buildRequest(
  tool: RouteTool,
  args: Record<string, unknown>,
): { path: string; params: QueryParams; body?: Record<string, unknown> } {
  const used = new Set<string>()
  const path = tool.path.replace(/\{(\w+)\}/g, (_, k: string) => {
    used.add(k)
    return encodeURIComponent(String(args[k] ?? ""))
  })
  const params: QueryParams = {}
  for (const [arg, q] of Object.entries(tool.query ?? {})) {
    const v = args[arg]
    if (v === undefined || v === null) continue
    params[q] = Array.isArray(v) ? v.join(",") : (v as string | number | boolean)
  }
  if (!tool.body) return { path, params }
  const body: Record<string, unknown> = {}
  for (const field of tool.body) {
    const v = args[BODY_ALIAS[field] ?? field]
    if (v !== undefined) body[field] = v
  }
  return { path, params, body }
}

/** @internal */
export function handleRouteTool(
  getToken: () => string,
  baseUrl: string | undefined,
  tool: RouteTool,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const { path, params, body } = buildRequest(tool, args ?? {})
  return runTool(() =>
    apiJson(getToken, baseUrl, tool.method, path, {
      params,
      ...(body !== undefined ? { body } : {}),
    }),
  )
}

/** The probe answer of one group: 200 lists it; a 5xx, 429 or network failure is "unknown". */
export function probeAppWorkflowGroup(
  group: AppWorkflowGroup,
  token: string,
  baseUrl?: string,
): Promise<ProbeAnswer> {
  return probeAccessState(token, baseUrl, group.probePath, () => true, group.probeParams ?? {})
}

/** The ids of the groups whose probe passed for this credential (stdio: once at boot). */
export async function probeAppWorkflowGroups(token: string, baseUrl?: string): Promise<string[]> {
  const answers = await Promise.all(
    APP_WORKFLOW_GROUPS.map((g) => probeAppWorkflowGroup(g, token, baseUrl)),
  )
  return APP_WORKFLOW_GROUPS.filter((_, i) => answers[i] === true).map((g) => g.id)
}

/**
 * Register the tools of the groups named in `groupIds` (those whose probe
 * passed). Unknown ids are ignored.
 *
 * @public
 */
export function registerAppWorkflowTools(
  server: McpServer,
  getToken: () => string,
  baseUrl: string | undefined,
  groupIds: readonly string[],
): void {
  const on = new Set(groupIds)
  for (const group of APP_WORKFLOW_GROUPS) {
    if (!on.has(group.id)) continue
    for (const tool of group.tools) {
      server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: tool.input,
          annotations: { title: tool.title, ...tool.annotations },
        },
        (args: Record<string, unknown>) => handleRouteTool(getToken, baseUrl, tool, args),
      )
    }
  }
}
