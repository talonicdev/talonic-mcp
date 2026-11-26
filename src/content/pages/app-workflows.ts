// Page copy for the generated tool reference (see src/content/tool-pages.ts).

import type { ToolPage } from "../tool-reference-types"

export const APP_WORKFLOW_PAGES: Record<string, ToolPage> = {
  talonic_ar_overview: {
    task: "apps",
    seoTitle: "talonic_ar_overview — Read the Receivables Cockpit Headline",
    description:
      "MCP tool that returns the Receivables cockpit: open receivables aging, cash application and bill-ready stats, recoverable money found, and latest decisions.",
    related: [
      { label: "talonic_ar_cash_application_preview", slug: "talonic-ar-cash-application-preview" },
      { label: "talonic_ar_bill_ready_preview", slug: "talonic-ar-bill-ready-preview" },
    ],
  },
  talonic_ar_cash_application_preview: {
    task: "apps",
    seoTitle: "talonic_ar_cash_application_preview — Preview Cash Matches",
    description:
      "MCP tool that matches every remittance line to open invoices in Receivables and returns stats plus a page of remittances, exceptions first. It writes nothing.",
    related: [
      { label: "talonic_ar_cash_application_apply", slug: "talonic-ar-cash-application-apply" },
      { label: "talonic_ar_overview", slug: "talonic-ar-overview" },
    ],
  },
  talonic_ar_cash_application_apply: {
    task: "apps",
    seoTitle: "talonic_ar_cash_application_apply — Record Cash Applied",
    description:
      "MCP tool that records the Receivables cash application decisions, changing workspace data. Safe to repeat; it posts nothing to another system. Preview first.",
    related: [
      { label: "talonic_ar_cash_application_preview", slug: "talonic-ar-cash-application-preview" },
    ],
  },
  talonic_ar_bill_ready_preview: {
    task: "apps",
    seoTitle: "talonic_ar_bill_ready_preview — Preview Loads Ready to Bill",
    description:
      "MCP tool that checks each Receivables load (delivery, signed proof of delivery, cost, accessorials, rate) and returns auto_bill, review or not_ready verdicts.",
    related: [
      { label: "talonic_ar_bill_ready_apply", slug: "talonic-ar-bill-ready-apply" },
      { label: "talonic_ar_overview", slug: "talonic-ar-overview" },
    ],
  },
  talonic_ar_bill_ready_apply: {
    task: "apps",
    seoTitle: "talonic_ar_bill_ready_apply — Record Bill Readiness",
    description:
      "MCP tool that records bill_ready or review on every Receivables load, changing workspace data. Loads a person moved to billed, review or on_hold keep it.",
    related: [{ label: "talonic_ar_bill_ready_preview", slug: "talonic-ar-bill-ready-preview" }],
  },
  talonic_ar_tmw_mapping: {
    task: "apps",
    seoTitle: "talonic_ar_tmw_mapping — Map Trimble TMW to Receivables",
    description:
      "MCP tool that returns how Trimble TMW export tables map onto the Receivables inputs, with the status conventions, for setting up receivables from a TMW export.",
    related: [{ label: "talonic_ar_overview", slug: "talonic-ar-overview" }],
  },
  talonic_spend_audit_get: {
    task: "apps",
    seoTitle: "talonic_spend_audit_get — Read the Spend Audit by Vendor",
    description:
      "MCP tool that returns the Spend Audit: every vendor with its verdicts and open to-dos, the lists it was built from, display options, and the stated assumptions.",
    related: [
      { label: "talonic_spend_audit_explain_todo", slug: "talonic-spend-audit-explain-todo" },
      { label: "talonic_spend_audit_share", slug: "talonic-spend-audit-share" },
    ],
  },
  talonic_spend_audit_set_options: {
    task: "apps",
    seoTitle: "talonic_spend_audit_set_options — Set Display Options",
    description:
      "MCP tool that sets the Spend Audit display options, such as hiding or showing price-confirmed vendors, changing workspace data. Needs the workspace permission.",
    related: [
      { label: "talonic_spend_audit_get", slug: "talonic-spend-audit-get" },
      { label: "talonic_spend_audit_set_assumptions", slug: "talonic-spend-audit-set-assumptions" },
    ],
  },
  talonic_spend_audit_set_assumptions: {
    task: "apps",
    seoTitle: "talonic_spend_audit_set_assumptions — Set Audit Assumptions",
    description:
      "MCP tool that replaces the basis and assumptions text shown under the Spend Audit, up to 10,000 characters, changing workspace data. Needs workspace permission.",
    related: [
      { label: "talonic_spend_audit_get", slug: "talonic-spend-audit-get" },
      { label: "talonic_spend_audit_set_options", slug: "talonic-spend-audit-set-options" },
    ],
  },
  talonic_spend_audit_explain_todo: {
    task: "apps",
    seoTitle: "talonic_spend_audit_explain_todo — Close To-Do With Reason",
    description:
      "MCP tool that closes one vendor's Spend Audit to-do with a written reason instead of a document, changing workspace data. Takes the vendor key and the reason.",
    related: [
      { label: "talonic_spend_audit_reopen_todo", slug: "talonic-spend-audit-reopen-todo" },
      { label: "talonic_spend_audit_get", slug: "talonic-spend-audit-get" },
    ],
  },
  talonic_spend_audit_reopen_todo: {
    task: "apps",
    seoTitle: "talonic_spend_audit_reopen_todo — Reopen a Vendor To-Do",
    description:
      "MCP tool that reopens a Spend Audit vendor to-do that was closed with a reason, once that reason no longer holds, changing workspace data. Takes the vendor key.",
    related: [
      { label: "talonic_spend_audit_explain_todo", slug: "talonic-spend-audit-explain-todo" },
      { label: "talonic_spend_audit_get", slug: "talonic-spend-audit-get" },
    ],
  },
  talonic_spend_audit_share: {
    task: "apps",
    seoTitle: "talonic_spend_audit_share — Publish the Spend Audit",
    description:
      "MCP tool that publishes the Spend Audit outside the workspace and returns a new link and password; the previous link stops working. Confirm with the user first.",
    related: [
      { label: "talonic_spend_audit_get_share", slug: "talonic-spend-audit-get-share" },
      { label: "talonic_spend_audit_unshare", slug: "talonic-spend-audit-unshare" },
    ],
  },
  talonic_spend_audit_get_share: {
    task: "apps",
    seoTitle: "talonic_spend_audit_get_share — Read the Audit Share Link",
    description:
      "MCP tool that returns the published Spend Audit link and its password, or nothing when the audit is not published. Read-only; needs the workspace permission.",
    related: [
      { label: "talonic_spend_audit_share", slug: "talonic-spend-audit-share" },
      { label: "talonic_spend_audit_unshare", slug: "talonic-spend-audit-unshare" },
    ],
  },
  talonic_spend_audit_unshare: {
    task: "apps",
    seoTitle: "talonic_spend_audit_unshare — Revoke the Audit Share Link",
    description:
      "MCP tool that revokes the published Spend Audit link, so nobody outside the workspace can open the audit any more. Changes workspace data; reshare to restore.",
    related: [
      { label: "talonic_spend_audit_share", slug: "talonic-spend-audit-share" },
      { label: "talonic_spend_audit_get_share", slug: "talonic-spend-audit-get-share" },
    ],
  },
  talonic_objects_recent: {
    task: "apps",
    seoTitle: "talonic_objects_recent — List the Latest Decisions Made",
    description:
      "MCP tool that lists the latest decisions recorded on business objects (invoices, loads, payments, contracts, leases, ledger rows) across apps, newest first.",
    related: [
      { label: "talonic_object_get", slug: "talonic-object-get" },
      { label: "talonic_objects_by_type", slug: "talonic-objects-by-type" },
    ],
  },
  talonic_objects_by_type: {
    task: "apps",
    seoTitle: "talonic_objects_by_type — Count or List Objects by State",
    description:
      "MCP tool that counts business objects of one type (invoice, load, lease, money_found_row) in each state, or lists the objects in one given state, paginated.",
    related: [
      { label: "talonic_object_get", slug: "talonic-object-get" },
      { label: "talonic_objects_recent", slug: "talonic-objects-recent" },
    ],
  },
  talonic_object_get: {
    task: "apps",
    seoTitle: "talonic_object_get — Read One Object and Its History",
    description:
      "MCP tool that returns one business object's current state and every decision recorded on it, with who decided and the evidence, to explain how it got there.",
    related: [
      { label: "talonic_object_record_decision", slug: "talonic-object-record-decision" },
      { label: "talonic_objects_by_type", slug: "talonic-objects-by-type" },
    ],
  },
  talonic_object_record_decision: {
    task: "apps",
    seoTitle: "talonic_object_record_decision — Record a Decision Made",
    description:
      "MCP tool that records a decision on one business object, such as a lease checked or an invoice disputed, changing workspace data. Attributed to the connection.",
    related: [
      { label: "talonic_object_get", slug: "talonic-object-get" },
      { label: "talonic_money_found_set_row_state", slug: "talonic-money-found-set-row-state" },
    ],
  },
  talonic_payables_desk_page: {
    task: "apps",
    seoTitle: "talonic_payables_desk_page — Page Through Supplier Invoices",
    description:
      "MCP tool that returns one page of Payables Desk supplier invoices (up to 500) with what the checks read and found on each, or ready: false with the reason why.",
    related: [{ label: "talonic_payables_desk_policy", slug: "talonic-payables-desk-policy" }],
  },
  talonic_payables_desk_policy: {
    task: "apps",
    seoTitle: "talonic_payables_desk_policy — Read the Payment Rules",
    description:
      "MCP tool that returns the Payables Desk payment rules in force: order and approval thresholds, currency and rates, where they come from, and their version.",
    related: [
      { label: "talonic_payables_desk_save_policy", slug: "talonic-payables-desk-save-policy" },
      { label: "talonic_payables_desk_page", slug: "talonic-payables-desk-page" },
    ],
  },
  talonic_payables_desk_save_policy: {
    task: "apps",
    seoTitle: "talonic_payables_desk_save_policy — Save the Payment Rules",
    description:
      "MCP tool that saves the Payables Desk payment rules (thresholds, currency, rates), changing workspace data. Send the version read so newer rules are kept.",
    related: [{ label: "talonic_payables_desk_policy", slug: "talonic-payables-desk-policy" }],
  },
  talonic_workbook_list_structures: {
    task: "apps",
    seoTitle: "talonic_workbook_list_structures — List Target Structures",
    description:
      "MCP tool that lists the workspace's Workbook capture target structures, each built from a client's example table, with mapping counts, to pick one to map onto.",
    related: [
      { label: "talonic_workbook_get_structure", slug: "talonic-workbook-get-structure" },
      { label: "talonic_workbook_create_structure", slug: "talonic-workbook-create-structure" },
    ],
  },
  talonic_workbook_create_structure: {
    task: "apps",
    seoTitle: "talonic_workbook_create_structure — Create Target Structure",
    description:
      "MCP tool that creates or replaces a Workbook capture target structure from the example table in a captured workbook, changing workspace data. Takes a name.",
    related: [
      { label: "talonic_workbook_update_structure", slug: "talonic-workbook-update-structure" },
      { label: "talonic_workbook_list_structures", slug: "talonic-workbook-list-structures" },
    ],
  },
  talonic_workbook_get_structure: {
    task: "apps",
    seoTitle: "talonic_workbook_get_structure — Read a Target Structure",
    description:
      "MCP tool that returns one Workbook capture target structure with its fields, defaults and aliases, so an agent can review it before editing it. Read-only.",
    related: [
      { label: "talonic_workbook_update_structure", slug: "talonic-workbook-update-structure" },
      { label: "talonic_workbook_list_mappings", slug: "talonic-workbook-list-mappings" },
    ],
  },
  talonic_workbook_update_structure: {
    task: "apps",
    seoTitle: "talonic_workbook_update_structure — Edit a Target Structure",
    description:
      "MCP tool that sets field defaults and aliases on a Workbook capture structure and can replace its checks (a total equal to its parts), changing workspace data.",
    related: [
      { label: "talonic_workbook_get_structure", slug: "talonic-workbook-get-structure" },
      { label: "talonic_workbook_checks", slug: "talonic-workbook-checks" },
    ],
  },
  talonic_workbook_list_mappings: {
    task: "apps",
    seoTitle: "talonic_workbook_list_mappings — List Label Mappings",
    description:
      "MCP tool that lists how each row and column label maps onto a Workbook capture structure, who decided it, and whether a person approved it, before projecting.",
    related: [
      { label: "talonic_workbook_correct_mapping", slug: "talonic-workbook-correct-mapping" },
      { label: "talonic_workbook_approve_mapping", slug: "talonic-workbook-approve-mapping" },
    ],
  },
  talonic_workbook_correct_mapping: {
    task: "apps",
    seoTitle: "talonic_workbook_correct_mapping — Correct a Label Mapping",
    description:
      "MCP tool that corrects one Workbook capture label mapping, changing workspace data. The fix counts as approved, and every later workbook then reuses it.",
    related: [
      { label: "talonic_workbook_approve_mapping", slug: "talonic-workbook-approve-mapping" },
      { label: "talonic_workbook_list_mappings", slug: "talonic-workbook-list-mappings" },
    ],
  },
  talonic_workbook_approve_mapping: {
    task: "apps",
    seoTitle: "talonic_workbook_approve_mapping — Approve a Label Mapping",
    description:
      "MCP tool that approves one Workbook capture label mapping as it stands, changing workspace data, so later workbooks reuse it. Takes structure and label key.",
    related: [
      { label: "talonic_workbook_correct_mapping", slug: "talonic-workbook-correct-mapping" },
      { label: "talonic_workbook_list_mappings", slug: "talonic-workbook-list-mappings" },
    ],
  },
  talonic_workbook_get_capture: {
    task: "apps",
    seoTitle: "talonic_workbook_get_capture — Read a Workbook Capture",
    description:
      "MCP tool that returns what Workbook capture read from one workbook: the run, its tables with counts, and its pictures with position. Use it to find table IDs.",
    related: [
      { label: "talonic_workbook_table", slug: "talonic-workbook-table" },
      { label: "talonic_workbook_recapture", slug: "talonic-workbook-recapture" },
    ],
  },
  talonic_workbook_checks: {
    task: "apps",
    seoTitle: "talonic_workbook_checks — Check Workbook Totals Add Up",
    description:
      "MCP tool that returns Workbook capture consistency findings, such as totals that do not add up, plus identity check findings when a target structure is given.",
    related: [
      { label: "talonic_workbook_facts", slug: "talonic-workbook-facts" },
      { label: "talonic_workbook_update_structure", slug: "talonic-workbook-update-structure" },
    ],
  },
  talonic_workbook_facts: {
    task: "apps",
    seoTitle: "talonic_workbook_facts — Read Mapped Workbook Facts",
    description:
      "MCP tool that returns a workbook's facts under a Workbook capture target structure, each with its figure, fields and source cell. Up to 5,000 per call.",
    related: [
      { label: "talonic_workbook_project", slug: "talonic-workbook-project" },
      { label: "talonic_workbook_cell", slug: "talonic-workbook-cell" },
    ],
  },
  talonic_workbook_project: {
    task: "apps",
    seoTitle: "talonic_workbook_project — Project Workbook Onto Structure",
    description:
      "MCP tool that maps a workbook's labels and writes its facts under a Workbook capture structure, replacing earlier facts for it. This changes workspace data.",
    related: [
      { label: "talonic_workbook_facts", slug: "talonic-workbook-facts" },
      { label: "talonic_workbook_list_mappings", slug: "talonic-workbook-list-mappings" },
    ],
  },
  talonic_workbook_table: {
    task: "apps",
    seoTitle: "talonic_workbook_table — Rebuild a Captured Table Grid",
    description:
      "MCP tool that rebuilds one Workbook capture table as a grid with every value cell plus header, label, title and note cells, optionally centred on one cell.",
    related: [
      { label: "talonic_workbook_cell", slug: "talonic-workbook-cell" },
      { label: "talonic_workbook_get_capture", slug: "talonic-workbook-get-capture" },
    ],
  },
  talonic_workbook_cell: {
    task: "apps",
    seoTitle: "talonic_workbook_cell — Explain One Captured Workbook Cell",
    description:
      "MCP tool that returns everything Workbook capture knows about one cell: its value, raw text, scale, currency, column path, row labels, notes and formula.",
    related: [
      { label: "talonic_workbook_table", slug: "talonic-workbook-table" },
      { label: "talonic_workbook_facts", slug: "talonic-workbook-facts" },
    ],
  },
  talonic_workbook_recapture: {
    task: "apps",
    seoTitle: "talonic_workbook_recapture — Capture a Workbook Again",
    description:
      "MCP tool that runs Workbook capture on one workbook again now, when its capture is missing or out of date, changing workspace data. Takes the document ID.",
    related: [
      { label: "talonic_workbook_get_capture", slug: "talonic-workbook-get-capture" },
      { label: "talonic_workbook_project", slug: "talonic-workbook-project" },
    ],
  },
  talonic_record_set_page: {
    task: "apps",
    seoTitle: "talonic_record_set_page — Read a Record Set Grid Page",
    description:
      "MCP tool that returns one page of a record set (up to 500 rows) with its fields and cells, as the web grid shows it, filterable by field keys and record IDs.",
    related: [
      { label: "talonic_record_set_cell_provenance", slug: "talonic-record-set-cell-provenance" },
    ],
  },
  talonic_record_set_cell_provenance: {
    task: "apps",
    seoTitle: "talonic_record_set_cell_provenance — Trace a Cell's Source",
    description:
      "MCP tool that returns one record set cell's value, confidence, status, source and audit reference, so an agent can show where a value came from. Read-only.",
    related: [{ label: "talonic_record_set_page", slug: "talonic-record-set-page" }],
  },
  talonic_compliance_get_framework: {
    task: "apps",
    seoTitle: "talonic_compliance_get_framework — Read a Framework's Rules",
    description:
      "MCP tool that returns one Compliance framework with its reading state, whether it is on or off, and every rule in it, to review the rules before editing.",
    related: [
      { label: "talonic_compliance_update_rule", slug: "talonic-compliance-update-rule" },
      { label: "talonic_compliance_add_rule", slug: "talonic-compliance-add-rule" },
    ],
  },
  talonic_compliance_reread_framework: {
    task: "apps",
    seoTitle: "talonic_compliance_reread_framework — Reread Framework Rules",
    description:
      "MCP tool that reads a Compliance framework's rules again from its document and replaces the current rules when done, changing workspace data. Fails while off.",
    related: [
      { label: "talonic_compliance_get_framework", slug: "talonic-compliance-get-framework" },
      { label: "talonic_compliance_update_rule", slug: "talonic-compliance-update-rule" },
    ],
  },
  talonic_compliance_add_rule: {
    task: "apps",
    seoTitle: "talonic_compliance_add_rule — Add a Compliance Rule",
    description:
      "MCP tool that adds a person-written rule to a Compliance framework, with optional obligation, section, condition and threshold, changing workspace data.",
    related: [
      { label: "talonic_compliance_update_rule", slug: "talonic-compliance-update-rule" },
      { label: "talonic_compliance_get_framework", slug: "talonic-compliance-get-framework" },
    ],
  },
  talonic_compliance_update_rule: {
    task: "apps",
    seoTitle: "talonic_compliance_update_rule — Edit a Compliance Rule",
    description:
      "MCP tool that edits one Compliance rule, changing only the fields sent (text, obligation, section, condition, threshold, testable) in the workspace data.",
    related: [
      { label: "talonic_compliance_delete_rule", slug: "talonic-compliance-delete-rule" },
      { label: "talonic_compliance_get_framework", slug: "talonic-compliance-get-framework" },
    ],
  },
  talonic_compliance_delete_rule: {
    task: "apps",
    seoTitle: "talonic_compliance_delete_rule — Delete a Compliance Rule",
    description:
      "MCP tool that deletes one rule from its Compliance framework, changing workspace data. Use it when a rule does not belong; edit it if it reads wrongly.",
    related: [
      { label: "talonic_compliance_update_rule", slug: "talonic-compliance-update-rule" },
      { label: "talonic_compliance_get_framework", slug: "talonic-compliance-get-framework" },
    ],
  },
  talonic_money_found_catalog: {
    task: "apps",
    seoTitle: "talonic_money_found_catalog — List Money Found Options",
    description:
      "MCP tool that returns the Money Found catalog: the roles a configuration binds, their fields, and the levers with what each one needs, for setting it up.",
    related: [
      { label: "talonic_money_found_propose_config", slug: "talonic-money-found-propose-config" },
      { label: "talonic_money_found_config", slug: "talonic-money-found-config" },
    ],
  },
  talonic_money_found_config: {
    task: "apps",
    seoTitle: "talonic_money_found_config — Read the Money Found Setup",
    description:
      "MCP tool that returns the Money Found configuration currently in force, or config: null when none is set, so an agent can review it before proposing a change.",
    related: [
      { label: "talonic_money_found_propose_config", slug: "talonic-money-found-propose-config" },
      { label: "talonic_money_found_save_config", slug: "talonic-money-found-save-config" },
    ],
  },
  talonic_money_found_propose_config: {
    task: "apps",
    seoTitle: "talonic_money_found_propose_config — Propose a Configuration",
    description:
      "MCP tool that proposes a Money Found configuration from the workspace's Specs and tables, as of a date. It saves nothing; show the user, then save it.",
    related: [
      { label: "talonic_money_found_save_config", slug: "talonic-money-found-save-config" },
      { label: "talonic_money_found_catalog", slug: "talonic-money-found-catalog" },
    ],
  },
  talonic_money_found_save_config: {
    task: "apps",
    seoTitle: "talonic_money_found_save_config — Confirm the Configuration",
    description:
      "MCP tool that saves a full Money Found configuration, changing workspace data. Bindings to missing sources or fields are dropped; the ledger then rebuilds.",
    related: [
      { label: "talonic_money_found_propose_config", slug: "talonic-money-found-propose-config" },
      {
        label: "talonic_money_found_structure_clauses",
        slug: "talonic-money-found-structure-clauses",
      },
    ],
  },
  talonic_money_found_structure_clauses: {
    task: "apps",
    seoTitle: "talonic_money_found_structure_clauses — Read Rebate Clauses",
    description:
      "MCP tool that reads rebate steps, rates and dates from Money Found's configured contract clauses and saves them to the configuration, changing workspace data.",
    related: [
      { label: "talonic_money_found_cost_clauses", slug: "talonic-money-found-cost-clauses" },
      { label: "talonic_money_found_save_config", slug: "talonic-money-found-save-config" },
    ],
  },
  talonic_money_found_cost_clauses: {
    task: "apps",
    seoTitle: "talonic_money_found_cost_clauses — Read Cost Bearer Clauses",
    description:
      "MCP tool that reads who bears each cost from contract text for Money Found and saves answers backed by a quote, changing workspace data. dry_run only counts.",
    related: [
      {
        label: "talonic_money_found_structure_clauses",
        slug: "talonic-money-found-structure-clauses",
      },
      { label: "talonic_money_found_config", slug: "talonic-money-found-config" },
    ],
  },
  talonic_money_found_delete_config: {
    task: "apps",
    seoTitle: "talonic_money_found_delete_config — Remove the Configuration",
    description:
      "MCP tool that deletes the Money Found configuration so the ledger answers without one again, changing workspace data. Use it when the user starts over.",
    related: [
      { label: "talonic_money_found_config", slug: "talonic-money-found-config" },
      { label: "talonic_money_found_propose_config", slug: "talonic-money-found-propose-config" },
    ],
  },
  talonic_money_found_set_row_state: {
    task: "apps",
    seoTitle: "talonic_money_found_set_row_state — Record a Ledger Decision",
    description:
      "MCP tool that sets one Money Found ledger row to open, in_progress, resolved or dismissed, with a note, changing workspace data. The next ledger read shows it.",
    related: [
      { label: "talonic_object_record_decision", slug: "talonic-object-record-decision" },
      { label: "talonic_money_found_config", slug: "talonic-money-found-config" },
    ],
  },
  talonic_contract_check_settings: {
    task: "apps",
    seoTitle: "talonic_contract_check_settings — Read Contract Check Setup",
    description:
      "MCP tool that returns the Contract Check settings with what is needed to choose them: data products, the CRM table's columns, sample rows and contract types.",
    related: [
      {
        label: "talonic_contract_check_save_settings",
        slug: "talonic-contract-check-save-settings",
      },
      {
        label: "talonic_contract_check_column_values",
        slug: "talonic-contract-check-column-values",
      },
    ],
  },
  talonic_contract_check_save_settings: {
    task: "apps",
    seoTitle: "talonic_contract_check_save_settings — Save Check Settings",
    description:
      "MCP tool that saves which data product Contract Check reads contracts from and its check settings, changing workspace data. Needs write and upload permissions.",
    related: [
      { label: "talonic_contract_check_settings", slug: "talonic-contract-check-settings" },
      {
        label: "talonic_contract_check_column_values",
        slug: "talonic-contract-check-column-values",
      },
    ],
  },
  talonic_contract_check_column_values: {
    task: "apps",
    seoTitle: "talonic_contract_check_column_values — List CRM Values",
    description:
      "MCP tool that returns up to 100 distinct values of one CRM column for Contract Check, with more: true when there are more, to fill in a setting from them.",
    related: [
      { label: "talonic_contract_check_settings", slug: "talonic-contract-check-settings" },
      {
        label: "talonic_contract_check_save_settings",
        slug: "talonic-contract-check-save-settings",
      },
    ],
  },
  talonic_chart_pdfs_page: {
    task: "apps",
    seoTitle: "talonic_chart_pdfs_page — List PDFs for Chart Reading",
    description:
      "MCP tool that returns one window of the workspace's PDF documents with the total count, so an agent can choose which documents' charts to read. Read-only.",
    related: [
      { label: "talonic_chart_read_charts_preview", slug: "talonic-chart-read-charts-preview" },
      { label: "talonic_chart_read_charts_available", slug: "talonic-chart-read-charts-available" },
    ],
  },
  talonic_chart_read_charts_available: {
    task: "apps",
    seoTitle: "talonic_chart_read_charts_available — Check Chart Reading",
    description:
      "MCP tool that returns { available }: whether reading the charts of selected documents is offered in this workspace. Call it before offering chart reading.",
    related: [
      { label: "talonic_chart_pdfs_page", slug: "talonic-chart-pdfs-page" },
      { label: "talonic_chart_read_charts_preview", slug: "talonic-chart-read-charts-preview" },
    ],
  },
  talonic_chart_read_charts_preview: {
    task: "apps",
    seoTitle: "talonic_chart_read_charts_preview — Preview Chart Reading",
    description:
      "MCP tool that shows what reading the charts of selected documents would read and the most it could cost, without starting anything. Call it before reading.",
    related: [
      { label: "talonic_chart_read_charts", slug: "talonic-chart-read-charts" },
      { label: "talonic_chart_pdfs_page", slug: "talonic-chart-pdfs-page" },
    ],
  },
  talonic_chart_read_charts: {
    task: "apps",
    seoTitle: "talonic_chart_read_charts — Read Charts in Documents",
    description:
      "MCP tool that reads the charts in selected documents and returns one outcome per document. It costs credits and changes workspace data; preview first.",
    related: [
      { label: "talonic_chart_read_charts_preview", slug: "talonic-chart-read-charts-preview" },
      { label: "talonic_chart_read_charts_available", slug: "talonic-chart-read-charts-available" },
    ],
  },
}
