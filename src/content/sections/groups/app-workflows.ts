import type { RawSection } from "../../types"

// Generated from src/tools/app-workflows.ts (names, summaries, parameters); keep in step with it.
export const sections: RawSection[] = [
  {
    slug: "receivables-tools",
    parentSlug: "tool-groups",
    title: "Receivables",
    seoTitle: "Receivables MCP Tools — Cash Application and Bill Ready",
    description:
      "MCP tools for the Talonic Receivables app: preview the cash application and bill readiness, record the decisions, and read the full receivables cockpit.",
    content: [
      {
        type: "paragraph",
        text: "Apply the cash that comes back to the open invoices and decide which loads may bill. The preview tools compute and write nothing; the apply tools record the decisions. Nothing is posted into another system.",
      },
      {
        type: "callout",
        variant: "info",
        text: "These tools are listed only when the app is available to the connection. Every call is checked against the scope of the connection and the role and permissions of the person behind it, exactly as in the web app.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ar-overview",
        text: "talonic_ar_overview",
      },
      {
        type: "paragraph",
        text: "The receivables cockpit: aging of open receivables, cash application and bill-ready statistics, recoverable money found on receivables, latest decisions. USE WHEN: the headline (how much is open, how much applied straight through, which loads can bill). NOT FOR: the remittance or load lists (talonic_ar_cash_application_preview, talonic_ar_bill_ready_preview).",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ar-cash-application-preview",
        text: "talonic_ar_cash_application_preview",
      },
      {
        type: "paragraph",
        text: "Match every remittance line to the open invoices and show the result: statistics over all remittances and one page of them, exceptions first. Writes nothing. USE WHEN: before applying cash, to see what lands and what needs a person. NOT FOR: recording the result (talonic_ar_cash_application_apply).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "page",
            type: "integer",
            required: false,
            description: "Page number, from 1.",
          },
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "Rows per page (default 50, at most 500).",
          },
          {
            name: "invalid_only",
            type: "boolean",
            required: false,
            description: "Only remittances with an invalid deduction.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ar-cash-application-apply",
        text: "talonic_ar_cash_application_apply",
      },
      {
        type: "paragraph",
        text: "Record the decisions of the cash application (payments applied or exception, invoices paid / partially paid / short paid, deductions open). Safe to repeat: recorded decisions are not recorded again. Posts nothing to another system. USE WHEN: after talonic_ar_cash_application_preview, once the result is right. NOT FOR: previewing (talonic_ar_cash_application_preview).",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ar-bill-ready-preview",
        text: "talonic_ar_bill_ready_preview",
      },
      {
        type: "paragraph",
        text: "Per load, the checks (delivered, proof of delivery present and signed, carrier cost within contract, accessorials settled, rate agreed) and the verdict auto_bill, review or not_ready. Writes nothing. USE WHEN: deciding which loads may bill without a person. NOT FOR: recording the verdicts (talonic_ar_bill_ready_apply).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "page",
            type: "integer",
            required: false,
            description: "Page number, from 1.",
          },
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "Rows per page (default 50, at most 500).",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ar-bill-ready-apply",
        text: "talonic_ar_bill_ready_apply",
      },
      {
        type: "paragraph",
        text: "Record bill_ready or review on every load. A load a person moved to billed, review or on_hold keeps its state. USE WHEN: after talonic_ar_bill_ready_preview. NOT FOR: previewing (talonic_ar_bill_ready_preview).",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ar-tmw-mapping",
        text: "talonic_ar_tmw_mapping",
      },
      {
        type: "paragraph",
        text: "How Trimble TMW tables map onto the receivables inputs, with the status conventions. USE WHEN: setting up receivables from a Trimble TMW export. NOT FOR: the receivables data (talonic_ar_overview).",
      },
    ],
    related: [],
    faq: [],
    mentions: [],
  },
  {
    slug: "spend-audit-tools",
    parentSlug: "tool-groups",
    title: "Spend Audit",
    seoTitle: "Spend Audit MCP Tools — Vendors, To-dos and Sharing",
    description:
      "MCP tools for the Talonic Spend Audit app: read the audit, close vendor to-dos, set the options and assumptions, and publish or revoke the share link.",
    content: [
      {
        type: "paragraph",
        text: "Work through a spend audit: every vendor with its verdicts and open to-dos. Preparing the audit is separate from publishing it: only talonic_spend_audit_share makes it reachable outside the workspace, so confirm with the user first.",
      },
      {
        type: "callout",
        variant: "info",
        text: "These tools are listed only when the app is available to the connection. Every call is checked against the scope of the connection and the role and permissions of the person behind it, exactly as in the web app.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-spend-audit-get",
        text: "talonic_spend_audit_get",
      },
      {
        type: "paragraph",
        text: "The spend audit: every vendor with its verdicts and open to-dos, the lists it was built from, display options and assumptions. USE WHEN: reviewing what is still missing per vendor. NOT FOR: the share link (talonic_spend_audit_get_share).",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-spend-audit-set-options",
        text: "talonic_spend_audit_set_options",
      },
      {
        type: "paragraph",
        text: "Set the audit's display options. USE WHEN: hiding or showing price-confirmed vendors. NOT FOR: the assumptions text (talonic_spend_audit_set_assumptions).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "show_price_confirmed",
            type: "boolean",
            required: false,
            description: "Show vendors whose prices are confirmed.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-spend-audit-set-assumptions",
        text: "talonic_spend_audit_set_assumptions",
      },
      {
        type: "paragraph",
        text: "Replace the basis and assumptions text shown under the audit. USE WHEN: stating what the audit rests on. NOT FOR: display options (talonic_spend_audit_set_options).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "text",
            type: "string",
            required: true,
            description: "The text.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-spend-audit-explain-todo",
        text: "talonic_spend_audit_explain_todo",
      },
      {
        type: "paragraph",
        text: "Close one vendor's to-do with a reason instead of a document. USE WHEN: no document is needed for that vendor. NOT FOR: reopening (talonic_spend_audit_reopen_todo).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "key",
            type: "string",
            required: true,
            description: "The vendor key.",
          },
          {
            name: "reason",
            type: "string",
            required: true,
            description: "Why no document is needed.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-spend-audit-reopen-todo",
        text: "talonic_spend_audit_reopen_todo",
      },
      {
        type: "paragraph",
        text: "Reopen a to-do that was closed with a reason. USE WHEN: the reason no longer holds. NOT FOR: closing one (talonic_spend_audit_explain_todo).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "key",
            type: "string",
            required: true,
            description: "The vendor key.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-spend-audit-share",
        text: "talonic_spend_audit_share",
      },
      {
        type: "paragraph",
        text: "PUBLISHES the audit outside the workspace: answers a new link and password; the previous link stops working. Confirm with the user first. USE WHEN: the user asks to send the audit to the client. NOT FOR: reading the current link (talonic_spend_audit_get_share).",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-spend-audit-get-share",
        text: "talonic_spend_audit_get_share",
      },
      {
        type: "paragraph",
        text: "The published link and its password, or nothing when the audit is not published. USE WHEN: the user asks for the link again. NOT FOR: publishing (talonic_spend_audit_share).",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-spend-audit-unshare",
        text: "talonic_spend_audit_unshare",
      },
      {
        type: "paragraph",
        text: "Revoke the published link; nobody outside the workspace can open the audit any more. USE WHEN: the user asks to stop sharing. NOT FOR: a new link (talonic_spend_audit_share).",
      },
    ],
    related: [],
    faq: [],
    mentions: [],
  },
  {
    slug: "business-objects-tools",
    parentSlug: "tool-groups",
    title: "Business objects",
    seoTitle: "Business Objects MCP Tools — Decisions and History",
    description:
      "MCP tools for business objects in Talonic: read the decisions recorded on invoices, loads, payments, contracts, leases and ledger rows, and record one.",
    content: [
      {
        type: "paragraph",
        text: "Read the current state and decision history of the objects the apps decide on, and record a decision. A decision recorded here is attributed to the connection, never to a person.",
      },
      {
        type: "callout",
        variant: "info",
        text: "These tools are listed only when the app is available to the connection. Every call is checked against the scope of the connection and the role and permissions of the person behind it, exactly as in the web app.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-objects-recent",
        text: "talonic_objects_recent",
      },
      {
        type: "paragraph",
        text: "The latest decisions recorded on business objects (invoices, loads, payments, contracts, leases, ledger rows), newest first. USE WHEN: what was decided lately, across apps. NOT FOR: one object's history (talonic_object_get).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "How many.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-objects-by-type",
        text: "talonic_objects_by_type",
      },
      {
        type: "paragraph",
        text: "Without `state`: how many objects of a type are in each state. With `state`: the objects in that state. USE WHEN: counting or listing invoices, loads or leases by state. NOT FOR: one object (talonic_object_get).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "type",
            type: "string",
            required: true,
            description: "The object type.",
          },
          {
            name: "state",
            type: "string",
            required: false,
            description: "A state, e.g. paid.",
          },
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "limit",
          },
          {
            name: "offset",
            type: "integer",
            required: false,
            description: "offset",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-object-get",
        text: "talonic_object_get",
      },
      {
        type: "paragraph",
        text: "The current state of one business object and every decision recorded on it, with who and the evidence. USE WHEN: why an invoice, load or lease is in its state. NOT FOR: recording a decision (talonic_object_record_decision).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "type",
            type: "string",
            required: true,
            description: "type",
          },
          {
            name: "key",
            type: "string",
            required: true,
            description: "The object key.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-object-record-decision",
        text: "talonic_object_record_decision",
      },
      {
        type: "paragraph",
        text: "Record a decision on one business object; it is attributed to this connection, never to a person. USE WHEN: the user decided (e.g. a lease is checked, an invoice is disputed). NOT FOR: Money Found rows (talonic_money_found_set_row_state).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "type",
            type: "string",
            required: true,
            description: "type",
          },
          {
            name: "key",
            type: "string",
            required: true,
            description: "key",
          },
          {
            name: "to_state",
            type: "string",
            required: true,
            description: "The new state.",
          },
          {
            name: "from_state",
            type: "string",
            required: false,
            description: "from state",
          },
          {
            name: "note",
            type: "string",
            required: false,
            description: "note",
          },
          {
            name: "evidence",
            type: "object[]",
            required: false,
            description: "evidence",
          },
        ],
      },
    ],
    related: [],
    faq: [],
    mentions: [],
  },
  {
    slug: "payables-desk-tools",
    parentSlug: "tool-groups",
    title: "Payables Desk",
    seoTitle: "Payables Desk MCP Tools — Invoices and Payment Rules",
    description:
      "MCP tools for the Talonic Payables Desk: page through supplier invoices with what each check found, and read or save the payment rules of the workspace.",
    content: [
      {
        type: "paragraph",
        text: "Supplier invoices with what the checks read and found on each, and the payment rules. Listed where the workspace added Payables Desk, Accounts Payable or Payables Money Found.",
      },
      {
        type: "callout",
        variant: "info",
        text: "These tools are listed only when the app is available to the connection. Every call is checked against the scope of the connection and the role and permissions of the person behind it, exactly as in the web app.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-payables-desk-page",
        text: "talonic_payables_desk_page",
      },
      {
        type: "paragraph",
        text: "One page of supplier invoices with what the checks read and found on each, or ready: false with the reason. USE WHEN: working through supplier invoices before payment. NOT FOR: the payment rules (talonic_payables_desk_policy).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "offset",
            type: "integer",
            required: false,
            description: "offset",
          },
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "limit",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-payables-desk-policy",
        text: "talonic_payables_desk_policy",
      },
      {
        type: "paragraph",
        text: "The payment rules in force (order and approval thresholds, currency, rates), where they come from, and their version. USE WHEN: before changing the rules. NOT FOR: the invoices (talonic_payables_desk_page).",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-payables-desk-save-policy",
        text: "talonic_payables_desk_save_policy",
      },
      {
        type: "paragraph",
        text: "Save the payment rules. Send the version read so a save over a newer one is refused (409). USE WHEN: changing thresholds or rates. NOT FOR: reading them (talonic_payables_desk_policy).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "orderAbove",
            type: "number",
            required: true,
            description: "orderAbove",
          },
          {
            name: "approvalAbove",
            type: "number",
            required: true,
            description: "approvalAbove",
          },
          {
            name: "currency",
            type: "string | null",
            required: false,
            description: "currency",
          },
          {
            name: "rates",
            type: "object",
            required: false,
            description: "rates",
          },
          {
            name: "version",
            type: "integer",
            required: false,
            description: "version",
          },
        ],
      },
    ],
    related: [],
    faq: [],
    mentions: [],
  },
  {
    slug: "workbook-tools",
    parentSlug: "tool-groups",
    title: "Workbook capture",
    seoTitle: "Workbook Capture MCP Tools — Tables, Cells and Facts",
    description:
      "MCP tools for workbook capture in Talonic: target structures, label mappings, tables rebuilt as grids, single cells, facts, and the consistency checks.",
    content: [
      {
        type: "paragraph",
        text: "Excel workbooks read cell by cell. Make a target structure from a client's example table, review and correct how each sender's labels map onto it, project a workbook, and read its facts with their source cells.",
      },
      {
        type: "callout",
        variant: "info",
        text: "These tools are listed only when the app is available to the connection. Every call is checked against the scope of the connection and the role and permissions of the person behind it, exactly as in the web app.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-list-structures",
        text: "talonic_workbook_list_structures",
      },
      {
        type: "paragraph",
        text: "The workspace's target structures (each made from a client's example table) with their mapping counts. USE WHEN: choosing the structure to map a workbook onto. NOT FOR: one structure's fields (talonic_workbook_get_structure).",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-create-structure",
        text: "talonic_workbook_create_structure",
      },
      {
        type: "paragraph",
        text: "Create, or replace, a target structure from the example table in a captured workbook. USE WHEN: a client sent their example table. NOT FOR: editing fields (talonic_workbook_update_structure).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "UUID",
            required: true,
            description: "The workbook document id.",
          },
          {
            name: "name",
            type: "string",
            required: true,
            description: "name",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-get-structure",
        text: "talonic_workbook_get_structure",
      },
      {
        type: "paragraph",
        text: "One target structure with its fields. USE WHEN: before editing it. NOT FOR: its label mappings (talonic_workbook_list_mappings).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "structure_id",
            type: "UUID",
            required: true,
            description: "The target structure id.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-update-structure",
        text: "talonic_workbook_update_structure",
      },
      {
        type: "paragraph",
        text: "Set field defaults and aliases (only the fields named change) and, with `checks`, replace the identity checks (a total that must equal its parts). USE WHEN: a person decided a default, an alias or a check. NOT FOR: label mappings (talonic_workbook_correct_mapping).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "structure_id",
            type: "UUID",
            required: true,
            description: "The target structure id.",
          },
          {
            name: "fields",
            type: "object[]",
            required: false,
            description: "fields",
          },
          {
            name: "checks",
            type: "object[]",
            required: false,
            description: "checks",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-list-mappings",
        text: "talonic_workbook_list_mappings",
      },
      {
        type: "paragraph",
        text: "How each row and column label maps onto the structure, who decided it, and whether a person approved it. USE WHEN: reviewing labels before projecting workbooks. NOT FOR: correcting one (talonic_workbook_correct_mapping).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "structure_id",
            type: "UUID",
            required: true,
            description: "The target structure id.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-correct-mapping",
        text: "talonic_workbook_correct_mapping",
      },
      {
        type: "paragraph",
        text: "Correct one label's mapping; it counts as approved and every later workbook uses it. scope header_leaf applies the metric or ignore decision to every column header ending in the same label. USE WHEN: a label maps wrongly. NOT FOR: approving one as it stands (talonic_workbook_approve_mapping).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "structure_id",
            type: "UUID",
            required: true,
            description: "The target structure id.",
          },
          {
            name: "label_key",
            type: "string",
            required: true,
            description: "The label key from talonic_workbook_list_mappings.",
          },
          {
            name: "scope",
            type: "label | header_leaf",
            required: false,
            description: "scope",
          },
          {
            name: "metric",
            type: "string",
            required: false,
            description: "metric",
          },
          {
            name: "set",
            type: "object",
            required: false,
            description: "set",
          },
          {
            name: "ignore",
            type: "boolean",
            required: false,
            description: "ignore",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-approve-mapping",
        text: "talonic_workbook_approve_mapping",
      },
      {
        type: "paragraph",
        text: "Approve one label's mapping as it stands. USE WHEN: the mapping is right. NOT FOR: changing it (talonic_workbook_correct_mapping).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "structure_id",
            type: "UUID",
            required: true,
            description: "The target structure id.",
          },
          {
            name: "label_key",
            type: "string",
            required: true,
            description: "label key",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-get-capture",
        text: "talonic_workbook_get_capture",
      },
      {
        type: "paragraph",
        text: "What was captured from one workbook: the run, its tables with counts, its pictures with their position. run: null when never captured. USE WHEN: finding the table ids of a workbook. NOT FOR: one table's cells (talonic_workbook_table).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "UUID",
            required: true,
            description: "The workbook document id.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-checks",
        text: "talonic_workbook_checks",
      },
      {
        type: "paragraph",
        text: "Totals that do not add up and similar findings; identity findings too when `structure_id` is given. USE WHEN: checking a workbook before using its figures. NOT FOR: the facts (talonic_workbook_facts).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "UUID",
            required: true,
            description: "The workbook document id.",
          },
          {
            name: "structure_id",
            type: "UUID",
            required: false,
            description: "structure id",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-facts",
        text: "talonic_workbook_facts",
      },
      {
        type: "paragraph",
        text: "The workbook's facts under a target structure, each with its figure, fields and source cell. USE WHEN: reading the mapped figures. NOT FOR: projecting them first (talonic_workbook_project).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "UUID",
            required: true,
            description: "The workbook document id.",
          },
          {
            name: "structure_id",
            type: "UUID",
            required: true,
            description: "The target structure id.",
          },
          {
            name: "metric",
            type: "string",
            required: false,
            description: "metric",
          },
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "limit",
          },
          {
            name: "offset",
            type: "integer",
            required: false,
            description: "offset",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-project",
        text: "talonic_workbook_project",
      },
      {
        type: "paragraph",
        text: "Map the workbook's labels and write its facts under the structure, replacing the facts it held for that structure. USE WHEN: after the mappings are reviewed. NOT FOR: reading facts (talonic_workbook_facts).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "UUID",
            required: true,
            description: "The workbook document id.",
          },
          {
            name: "structure_id",
            type: "UUID",
            required: true,
            description: "The target structure id.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-table",
        text: "talonic_workbook_table",
      },
      {
        type: "paragraph",
        text: "One captured table rebuilt as a grid with every value cell and the header, label, title, context and note cells that give it meaning. USE WHEN: showing a table, or a cell in place (`around`). NOT FOR: everything about one cell (talonic_workbook_cell).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "UUID",
            required: true,
            description: "The workbook document id.",
          },
          {
            name: "table_id",
            type: "UUID",
            required: true,
            description: "table id",
          },
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "limit",
          },
          {
            name: "around",
            type: "string",
            required: false,
            description: "around",
          },
          {
            name: "from",
            type: "integer",
            required: false,
            description: "from",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-cell",
        text: "talonic_workbook_cell",
      },
      {
        type: "paragraph",
        text: "Everything known about one cell: value, raw text, scale, currency, column path, row labels, notes, formula. USE WHEN: explaining where a figure comes from. NOT FOR: the whole table (talonic_workbook_table).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "UUID",
            required: true,
            description: "The workbook document id.",
          },
          {
            name: "table_id",
            type: "UUID",
            required: true,
            description: "table id",
          },
          {
            name: "a1",
            type: "string",
            required: true,
            description: "a1",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-workbook-recapture",
        text: "talonic_workbook_recapture",
      },
      {
        type: "paragraph",
        text: "Capture the workbook again now. USE WHEN: the capture is missing or out of date. NOT FOR: projecting facts (talonic_workbook_project).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "UUID",
            required: true,
            description: "The workbook document id.",
          },
        ],
      },
    ],
    related: [],
    faq: [],
    mentions: [],
  },
  {
    slug: "record-set-tools",
    parentSlug: "tool-groups",
    title: "Record sets",
    seoTitle: "Record Set MCP Tools — Grid Pages and Cell Provenance",
    description:
      "MCP tools for Talonic record sets: read one page of a record set with all its cells, as the web grid shows it, and where the value of one cell came from.",
    content: [
      {
        type: "paragraph",
        text: "Read a record set as the web grid shows it and trace one cell to its source. Rows whose documents the person behind the connection may not see are left out.",
      },
      {
        type: "callout",
        variant: "info",
        text: "These tools are listed only when the app is available to the connection. Every call is checked against the scope of the connection and the role and permissions of the person behind it, exactly as in the web app.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-record-set-page",
        text: "talonic_record_set_page",
      },
      {
        type: "paragraph",
        text: "One page of a record set with its fields and cells, the shape the web grid shows. Rows you may not see are left out. USE WHEN: reading cell values of a record set. NOT FOR: one cell's provenance (talonic_record_set_cell_provenance).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "record_set_id",
            type: "UUID",
            required: true,
            description: "record set id",
          },
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "limit",
          },
          {
            name: "offset",
            type: "integer",
            required: false,
            description: "offset",
          },
          {
            name: "cursor",
            type: "string",
            required: false,
            description: "cursor",
          },
          {
            name: "field_keys",
            type: "string[]",
            required: false,
            description: "field keys",
          },
          {
            name: "record_ids",
            type: "string[]",
            required: false,
            description: "record ids",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-record-set-cell-provenance",
        text: "talonic_record_set_cell_provenance",
      },
      {
        type: "paragraph",
        text: "One cell's value, confidence, status, source and audit reference. USE WHEN: where a value came from. NOT FOR: many cells (talonic_record_set_page).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "record_set_id",
            type: "UUID",
            required: true,
            description: "record set id",
          },
          {
            name: "record_id",
            type: "UUID",
            required: true,
            description: "record id",
          },
          {
            name: "field_key",
            type: "string",
            required: true,
            description: "field key",
          },
        ],
      },
    ],
    related: [],
    faq: [],
    mentions: [],
  },
  {
    slug: "accounts-payable-detail-tools",
    parentSlug: "tool-groups",
    title: "Accounts Payable: bills and orders",
    seoTitle: "Accounts Payable MCP Tools — Bills, Orders and Rules",
    description:
      "MCP tools for Talonic Accounts Payable: one bill or purchase order with its documents, counts per status, the reviewers' language and rule importance.",
    content: [
      {
        type: "paragraph",
        text: "Look at one bill or purchase order in detail, with the documents it is checked against, and set the reviewers' language and which payment rules are important.",
      },
      {
        type: "callout",
        variant: "info",
        text: "These tools are listed only when the app is available to the connection. Every call is checked against the scope of the connection and the role and permissions of the person behind it, exactly as in the web app.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ap-bill",
        text: "talonic_ap_bill",
      },
      {
        type: "paragraph",
        text: "One bill by its key: status, holds, missing information, risk, lines and links. USE WHEN: one bill in detail. NOT FOR: lists (talonic_ap_bills).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "key",
            type: "string",
            required: true,
            description: "key",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ap-bill-documents",
        text: "talonic_ap_bill_documents",
      },
      {
        type: "paragraph",
        text: "The documents one bill links to (order, contract, delivery notes) and why. USE WHEN: checking a bill against its order or contract. NOT FOR: the bill itself (talonic_ap_bill).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "key",
            type: "string",
            required: true,
            description: "key",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ap-order",
        text: "talonic_ap_order",
      },
      {
        type: "paragraph",
        text: "One purchase order by its number, with its invoices and the documents they are checked with. USE WHEN: everything billed against an order. NOT FOR: one bill (talonic_ap_bill).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "key",
            type: "string",
            required: true,
            description: "key",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ap-summary",
        text: "talonic_ap_summary",
      },
      {
        type: "paragraph",
        text: "How many bills are ready, need information, are being evaluated or are held, with their amounts. USE WHEN: a quick count. NOT FOR: totals with entities (talonic_ap_overview).",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ap-set-language",
        text: "talonic_ap_set_language",
      },
      {
        type: "paragraph",
        text: "Set the language reviewers write their reasons in. USE WHEN: the team works in another language. NOT FOR: the AP configuration (talonic_ap_save_config).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "language",
            type: "en | es | de | fr | it | pt | pt-PT",
            required: true,
            description: "language",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ap-set-rule-important",
        text: "talonic_ap_set_rule_important",
      },
      {
        type: "paragraph",
        text: "A failed payment rule marked important holds its bill at high risk. USE WHEN: a rule must never be missed. NOT FOR: whether payment depends on the rule (the effect).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "rule_id",
            type: "UUID",
            required: true,
            description: "rule id",
          },
          {
            name: "important",
            type: "boolean",
            required: true,
            description: "important",
          },
        ],
      },
    ],
    related: [],
    faq: [],
    mentions: [],
  },
  {
    slug: "price-baseline-invoice-tools",
    parentSlug: "tool-groups",
    title: "Price Baseline: invoices",
    seoTitle: "Price Baseline MCP Tools — Invoices and Their Contracts",
    description:
      "MCP tools for Talonic Price Baseline invoices: list the invoices found, find new ones, preview the contracts an invoice may bill and assign the right one.",
    content: [
      {
        type: "paragraph",
        text: "Every invoice found is matched to the contract it bills. Preview the candidate contracts first; assigning one runs the invoice's price check again.",
      },
      {
        type: "callout",
        variant: "info",
        text: "These tools are listed only when the app is available to the connection. Every call is checked against the scope of the connection and the role and permissions of the person behind it, exactly as in the web app.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-price-baseline-needed",
        text: "talonic_price_baseline_needed",
      },
      {
        type: "paragraph",
        text: "Per contract and year, the inputs still missing before its prices can be computed. USE WHEN: planning what to collect. NOT FOR: the register (talonic_price_baseline_register).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "years",
            type: "integer[]",
            required: false,
            description: "years",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-price-baseline-invoices",
        text: "talonic_price_baseline_invoices",
      },
      {
        type: "paragraph",
        text: "The invoices found with their matched contract and price check; with `filter` or paging, one window and the headline. USE WHEN: which invoices are unmatched or off contract. NOT FOR: candidate contracts of one invoice (talonic_price_baseline_match_invoice).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "filter",
            type: "string",
            required: false,
            description: "filter",
          },
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "limit",
          },
          {
            name: "offset",
            type: "integer",
            required: false,
            description: "offset",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-price-baseline-scan-invoices",
        text: "talonic_price_baseline_scan_invoices",
      },
      {
        type: "paragraph",
        text: "Find invoices not yet listed and match the unmatched ones again. USE WHEN: new invoices arrived. NOT FOR: assigning one (talonic_price_baseline_assign_invoice).",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-price-baseline-match-invoice",
        text: "talonic_price_baseline_match_invoice",
      },
      {
        type: "paragraph",
        text: "The contracts an invoice may bill, scored. Changes nothing. USE WHEN: before assigning an invoice's contract. NOT FOR: assigning (talonic_price_baseline_assign_invoice).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "UUID",
            required: true,
            description: "document id",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-price-baseline-assign-invoice",
        text: "talonic_price_baseline_assign_invoice",
      },
      {
        type: "paragraph",
        text: "Assign the contract an invoice bills (`model_id`), null to match again, or skip=true when it is not a bill; its price check runs again. USE WHEN: after talonic_price_baseline_match_invoice. NOT FOR: previewing (talonic_price_baseline_match_invoice).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "UUID",
            required: true,
            description: "document id",
          },
          {
            name: "model_id",
            type: "UUID | null",
            required: false,
            description: "model id",
          },
          {
            name: "skip",
            type: "boolean",
            required: false,
            description: "skip",
          },
        ],
      },
    ],
    related: [],
    faq: [],
    mentions: [],
  },
  {
    slug: "contract-check-tools",
    parentSlug: "tool-groups",
    title: "Contract Check",
    seoTitle: "Contract Check MCP Tools — Settings and CRM Values",
    description:
      "MCP tools for Talonic Contract Check: read and save which data product and CRM table it compares, and list the values of one CRM column to choose from.",
    content: [
      {
        type: "paragraph",
        text: "Read and save Contract Check's settings, and list the values of a CRM column to fill a setting with.",
      },
      {
        type: "callout",
        variant: "info",
        text: "These tools are listed only when the app is available to the connection. Every call is checked against the scope of the connection and the role and permissions of the person behind it, exactly as in the web app.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-contract-check-settings",
        text: "talonic_contract_check_settings",
      },
      {
        type: "paragraph",
        text: "The settings with what is needed to choose them: data products, the CRM table's columns, sample rows, contract types. USE WHEN: before changing the settings. NOT FOR: values of one column (talonic_contract_check_column_values).",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-contract-check-save-settings",
        text: "talonic_contract_check_save_settings",
      },
      {
        type: "paragraph",
        text: "Save which data product the contracts come from and the check settings. USE WHEN: setting Contract Check up. NOT FOR: reading them (talonic_contract_check_settings).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "data_product_id",
            type: "UUID",
            required: false,
            description: "data product id",
          },
          {
            name: "settings",
            type: "object",
            required: false,
            description: "settings",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-contract-check-column-values",
        text: "talonic_contract_check_column_values",
      },
      {
        type: "paragraph",
        text: "Up to 100 distinct values of one CRM column, to choose a setting from; more: true when there are more. USE WHEN: filling a setting that names CRM values. NOT FOR: the settings (talonic_contract_check_settings).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "column",
            type: "string",
            required: true,
            description: "column",
          },
        ],
      },
    ],
    related: [],
    faq: [],
    mentions: [],
  },
  {
    slug: "chart-reading-tools",
    parentSlug: "tool-groups",
    title: "Chart reading",
    seoTitle: "Chart Reading MCP Tools — Preview and Read the Charts",
    description:
      "MCP tools for reading charts in Talonic: page through PDF documents, preview what reading their charts would cost, and then read the charts you select.",
    content: [
      {
        type: "paragraph",
        text: "Reading charts costs credits. Preview a selection first, confirm with the user, then read it; each document gets its own outcome.",
      },
      {
        type: "callout",
        variant: "info",
        text: "These tools are listed only when the app is available to the connection. Every call is checked against the scope of the connection and the role and permissions of the person behind it, exactly as in the web app.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-chart-pdfs-page",
        text: "talonic_chart_pdfs_page",
      },
      {
        type: "paragraph",
        text: "One window of the workspace's PDF documents with total. USE WHEN: choosing documents whose charts to read. NOT FOR: what reading would cost (talonic_chart_read_charts_preview).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "limit",
          },
          {
            name: "offset",
            type: "integer",
            required: false,
            description: "offset",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-chart-read-charts-available",
        text: "talonic_chart_read_charts_available",
      },
      {
        type: "paragraph",
        text: "{ available }: whether reading the charts of selected documents is offered here. USE WHEN: before offering it to the user. NOT FOR: the cost (talonic_chart_read_charts_preview).",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-chart-read-charts-preview",
        text: "talonic_chart_read_charts_preview",
      },
      {
        type: "paragraph",
        text: "What reading the charts of these documents would read and cost at most. Admits nothing. USE WHEN: always before talonic_chart_read_charts. NOT FOR: reading (talonic_chart_read_charts).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_ids",
            type: "UUID[]",
            required: true,
            description: "document ids",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-chart-read-charts",
        text: "talonic_chart_read_charts",
      },
      {
        type: "paragraph",
        text: "Read the charts of the selected documents, one outcome per document. Costs credits: preview first and confirm with the user. USE WHEN: after talonic_chart_read_charts_preview. NOT FOR: previewing (talonic_chart_read_charts_preview).",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_ids",
            type: "UUID[]",
            required: true,
            description: "document ids",
          },
        ],
      },
    ],
    related: [],
    faq: [],
    mentions: [],
  },
]
