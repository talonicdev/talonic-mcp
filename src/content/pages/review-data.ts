// Page copy for the generated tool reference (see src/content/tool-pages.ts).

import type { ToolPage } from "../tool-reference-types"

export const REVIEW_AND_DATA_PAGES: Record<string, ToolPage> = {
  talonic_review_list: {
    task: "review",
    seoTitle: "talonic_review_list — List the Values Held for Review",
    description:
      "MCP tool that lists values held for a human decision, newest first, with each one's current value, confidence and reason, filtered by run, trigger or status.",
    related: [
      { label: "talonic_review_claim", slug: "talonic-review-claim" },
      { label: "talonic_review_inspect", slug: "talonic-review-inspect" },
    ],
  },
  talonic_review_claim: {
    task: "review",
    seoTitle: "talonic_review_claim — Claim the Next Review Items",
    description:
      "MCP tool that claims the next review items for you in queue order, so parallel reviewers and agents never get the same item. Filter by run, field or reason.",
    related: [
      { label: "talonic_review_claims", slug: "talonic-review-claims" },
      { label: "talonic_review_resolve", slug: "talonic-review-resolve" },
    ],
  },
  talonic_review_claims: {
    task: "review",
    seoTitle: "talonic_review_claims — Keep or Release Review Claims",
    description:
      "MCP tool that keeps your review claims alive while you work a batch, or hands items you will not decide back to the queue. Safe to repeat; only yours change.",
    related: [{ label: "talonic_review_claim", slug: "talonic-review-claim" }],
  },
  talonic_review_assign: {
    task: "review",
    seoTitle: "talonic_review_assign — Claim or Release One Review Item",
    description:
      "MCP tool that claims or releases one specific review item for you. An item freshly held by someone else returns a conflict; for a batch, claim from the queue.",
    related: [{ label: "talonic_review_claim", slug: "talonic-review-claim" }],
  },
  talonic_review_inspect: {
    task: "review",
    seoTitle: "talonic_review_inspect — Inspect a Held Value's Evidence",
    description:
      "MCP tool that returns the evidence behind a held value: its history, check results, prior decisions and source passages with document and page, before deciding.",
    related: [
      { label: "talonic_review_resolve", slug: "talonic-review-resolve" },
      { label: "talonic_review_reference_view", slug: "talonic-review-reference-view" },
    ],
  },
  talonic_review_reference_view: {
    task: "review",
    seoTitle: "talonic_review_reference_view — Compare to Reference Values",
    description:
      "MCP tool that shows every field of one document beside its reference value from a reference table, a check or a matched master record, to decide fields at once.",
    related: [
      { label: "talonic_review_inspect", slug: "talonic-review-inspect" },
      { label: "talonic_review_resolve", slug: "talonic-review-resolve" },
    ],
  },
  talonic_review_resolve: {
    task: "review",
    seoTitle: "talonic_review_resolve — Approve or Correct a Held Value",
    description:
      "MCP tool that decides a held value: approve it, correct or override it, or accept a proposed correction, with a verbatim evidence quote. Decisions are logged.",
    related: [
      { label: "talonic_review_inspect", slug: "talonic-review-inspect" },
      { label: "talonic_review_decisions", slug: "talonic-review-decisions" },
    ],
  },
  talonic_review_propose_correction: {
    task: "review",
    seoTitle: "talonic_review_propose_correction — Propose a Value Fix",
    description:
      "MCP tool that proposes a new value for a finished field and re-opens it for a reviewer with your reason. Nothing changes until it is resolved. Safe to retry.",
    related: [{ label: "talonic_review_resolve", slug: "talonic-review-resolve" }],
  },
  talonic_review_recommend: {
    task: "review",
    seoTitle: "talonic_review_recommend — Recommend a Review Decision",
    description:
      "MCP tool that leaves an approve or correct recommendation on a field you may not decide, for a reviewer who can. The value itself stays as is. Safe to retry.",
    related: [{ label: "talonic_review_resolve", slug: "talonic-review-resolve" }],
  },
  talonic_review_decisions: {
    task: "review",
    seoTitle: "talonic_review_decisions — Read the Review Decision Log",
    description:
      "MCP tool that returns who decided what in review: prior and final value, action and reason per field, for one run or the whole workspace, as a decision receipt.",
    related: [
      { label: "talonic_review_resolve", slug: "talonic-review-resolve" },
      { label: "talonic_review_metrics", slug: "talonic-review-metrics" },
    ],
  },
  talonic_review_metrics: {
    task: "review",
    seoTitle: "talonic_review_metrics — Review Progress for a Run",
    description:
      "MCP tool that reports how far review of one run has come: fields that entered review, fields decided, and the mix of approved, corrected and overridden values.",
    related: [{ label: "talonic_review_decisions", slug: "talonic-review-decisions" }],
  },
  talonic_review_notes: {
    task: "review",
    seoTitle: "talonic_review_notes — Read Reviewer Notes on a Field",
    description:
      "MCP tool that returns the reviewer guidance kept for a field, newest first, so people and agents follow the workspace's own rules before deciding its items.",
    related: [{ label: "talonic_review_add_note", slug: "talonic-review-add-note" }],
  },
  talonic_review_add_note: {
    task: "review",
    seoTitle: "talonic_review_add_note — Add a Reviewer Note to a Field",
    description:
      "MCP tool that adds guidance to a field for everyone who reviews it, written as you, such as how a value should be checked. Safe to retry with idempotency_key.",
    related: [{ label: "talonic_review_notes", slug: "talonic-review-notes" }],
  },
  talonic_review_bulk_approve: {
    task: "review",
    seoTitle: "talonic_review_bulk_approve — Approve Results in Bulk",
    description:
      "MCP tool that approves many results waiting for approval in one call, as you. One result that cannot be approved never stops the rest; returns approved, failed.",
    related: [{ label: "talonic_review_list", slug: "talonic-review-list" }],
  },
  talonic_review_compare_sources: {
    task: "review",
    seoTitle: "talonic_review_compare_sources — Compare Sources Per Field",
    description:
      "MCP tool that shows, field by field, what each source said for an approval decision, with the supporting passage, so you can choose which value to keep.",
    related: [{ label: "talonic_review_choose_value", slug: "talonic-review-choose-value" }],
  },
  talonic_review_choose_value: {
    task: "review",
    seoTitle: "talonic_review_choose_value — Choose the Value to Keep",
    description:
      "MCP tool that records the value to keep for one field of an approval decision, picked from a source or typed in, with the candidates you saw. Safe to retry.",
    related: [{ label: "talonic_review_compare_sources", slug: "talonic-review-compare-sources" }],
  },
  talonic_review_list_benchmarks: {
    task: "review",
    seoTitle: "talonic_review_list_benchmarks — List Benchmark Runs",
    description:
      "MCP tool that lists benchmark runs, comparisons against your own answers and run reviews, or run-to-run comparisons and rule checks, newest first, for accuracy.",
    related: [{ label: "talonic_review_field_accuracy", slug: "talonic-review-field-accuracy" }],
  },
  talonic_review_field_accuracy: {
    task: "review",
    seoTitle: "talonic_review_field_accuracy — Accuracy of One Field",
    description:
      "MCP tool that compares expected and extracted values of one field across a benchmark's documents, showing where the field is right and how it goes wrong.",
    related: [{ label: "talonic_review_list_benchmarks", slug: "talonic-review-list-benchmarks" }],
  },
  talonic_review_decide_flags: {
    task: "review",
    seoTitle: "talonic_review_decide_flags — Accept or Reject Flags",
    description:
      "MCP tool that accepts or rejects values a run review flagged, one result or many at once: accepting applies the suggested value, rejecting keeps the original.",
    related: [{ label: "talonic_review_flag_progress", slug: "talonic-review-flag-progress" }],
  },
  talonic_review_flag_progress: {
    task: "review",
    seoTitle: "talonic_review_flag_progress — Run Review Progress",
    description:
      "MCP tool that reports the progress of a run review: how many values were checked so far and how many were flagged, so you know when to start deciding the flags.",
    related: [{ label: "talonic_review_decide_flags", slug: "talonic-review-decide-flags" }],
  },
  talonic_cases_list: {
    task: "review",
    seoTitle: "talonic_cases_list — List Cases of Linked Documents",
    description:
      "MCP tool that lists the workspace's cases, documents grouped by the references they make to each other. Open cases by default, resolved on request, paged.",
    related: [{ label: "talonic_cases_get", slug: "talonic-cases-get" }],
  },
  talonic_cases_get: {
    task: "review",
    seoTitle: "talonic_cases_get — Read a Case and Its Document Links",
    description:
      "MCP tool that returns one case: its documents, the links between them with the quoted passage for each, whether it is resolved, and documents it still lacks.",
    related: [
      { label: "talonic_cases_list", slug: "talonic-cases-list" },
      { label: "talonic_cases_update", slug: "talonic-cases-update" },
    ],
  },
  talonic_cases_update: {
    task: "review",
    seoTitle: "talonic_cases_update — Rename, Resolve or Reopen a Case",
    description:
      "MCP tool that renames a case, marks it resolved or reopens it, and returns the updated case. Safe to retry: the same call with the same key never applies twice.",
    related: [{ label: "talonic_cases_get", slug: "talonic-cases-get" }],
  },
  talonic_cases_narrate: {
    task: "review",
    seoTitle: "talonic_cases_narrate — Summarise What Happened in a Case",
    description:
      "MCP tool that returns a case's title and a short narrative of what happened, in the language you ask for. Stored text is reused unless the case changed since.",
    related: [{ label: "talonic_cases_get", slug: "talonic-cases-get" }],
  },
  talonic_cases_references_to_review: {
    task: "review",
    seoTitle: "talonic_cases_references_to_review — Ambiguous References",
    description:
      "MCP tool that lists references matching more than one document, each with its candidate documents, waiting for a person to decide which document is meant.",
    related: [
      { label: "talonic_cases_resolve_reference", slug: "talonic-cases-resolve-reference" },
      { label: "talonic_cases_reject_reference", slug: "talonic-cases-reject-reference" },
    ],
  },
  talonic_cases_resolve_reference: {
    task: "review",
    seoTitle: "talonic_cases_resolve_reference — Decide a Reference",
    description:
      "MCP tool that decides which document a reference points to. The decision is kept from then on and links the two documents into one case. Safe to retry.",
    related: [
      { label: "talonic_cases_references_to_review", slug: "talonic-cases-references-to-review" },
    ],
  },
  talonic_cases_reject_reference: {
    task: "review",
    seoTitle: "talonic_cases_reject_reference — Reject a Reference",
    description:
      "MCP tool that rejects a reference as not a real link between documents, so it stops connecting them in cases. Returns the rejected reference; safe to retry.",
    related: [
      { label: "talonic_cases_references_to_review", slug: "talonic-cases-references-to-review" },
    ],
  },
  talonic_cases_missing_documents: {
    task: "review",
    seoTitle: "talonic_cases_missing_documents — Missing Documents",
    description:
      "MCP tool that lists documents your uploaded documents reference but that were never uploaded, grouped by reference, so you know what to upload next to a case.",
    related: [{ label: "talonic_cases_list", slug: "talonic-cases-list" }],
  },
  talonic_cases_document_neighbors: {
    task: "review",
    seoTitle: "talonic_cases_document_neighbors — Connected Documents",
    description:
      "MCP tool that returns the documents one step from a given document, with the field and value that connects each one, to trace how your documents relate.",
    related: [{ label: "talonic_cases_get", slug: "talonic-cases-get" }],
  },
  talonic_cases_list_templates: {
    task: "review",
    seoTitle: "talonic_cases_list_templates — List Case Templates",
    description:
      "MCP tool that lists the workspace's case templates: the document types a complete case of each kind should hold, so you can see what a full case looks like.",
    related: [{ label: "talonic_cases_save_template", slug: "talonic-cases-save-template" }],
  },
  talonic_cases_save_template: {
    task: "review",
    seoTitle: "talonic_cases_save_template — Save a Case Template",
    description:
      "MCP tool that creates or changes a case template: its name, the document types a complete case holds and which are required. Admins only; safe to retry.",
    related: [{ label: "talonic_cases_list_templates", slug: "talonic-cases-list-templates" }],
  },
  talonic_data_product_update_definition: {
    task: "data",
    seoTitle: "talonic_data_product_update_definition — Edit a Definition",
    description:
      "MCP tool that replaces a shared data product's definition: identity, roles and readiness rules. Send the version you read; a newer save returns a conflict.",
    related: [{ label: "talonic_data_product_runs", slug: "talonic-data-product-runs" }],
  },
  talonic_data_product_runs: {
    task: "data",
    seoTitle: "talonic_data_product_runs — List Runs Feeding a Product",
    description:
      "MCP tool that lists the runs a data product reads its rows from, with each run's progress: documents total, completed and failed, so you know if they finished.",
    related: [
      { label: "talonic_data_product_add_run", slug: "talonic-data-product-add-run" },
      { label: "talonic_data_product_remove_run", slug: "talonic-data-product-remove-run" },
    ],
  },
  talonic_data_product_add_run: {
    task: "data",
    seoTitle: "talonic_data_product_add_run — Add a Run to a Product",
    description:
      "MCP tool that links one more run to a data product; its rows appear in the product on the next read. Idempotent, and needs an Admin of the workspace to call.",
    related: [
      { label: "talonic_data_product_runs", slug: "talonic-data-product-runs" },
      { label: "talonic_data_product_remove_run", slug: "talonic-data-product-remove-run" },
    ],
  },
  talonic_data_product_remove_run: {
    task: "data",
    seoTitle: "talonic_data_product_remove_run — Unlink a Feeding Run",
    description:
      "MCP tool that unlinks a run from a data product so its rows leave the product on the next read. Confirm with the user first; needs an Admin of the workspace.",
    related: [
      { label: "talonic_data_product_runs", slug: "talonic-data-product-runs" },
      { label: "talonic_data_product_add_run", slug: "talonic-data-product-add-run" },
    ],
  },
  talonic_data_product_disagreements: {
    task: "data",
    seoTitle: "talonic_data_product_disagreements — Run Disagreements",
    description:
      "MCP tool that lists every field where compared runs produced different values, by document, with each run's value, confidence and the decision taken so far.",
    related: [
      { label: "talonic_data_product_resolve_field", slug: "talonic-data-product-resolve-field" },
      {
        label: "talonic_data_product_suggest_resolutions",
        slug: "talonic-data-product-suggest-resolutions",
      },
    ],
  },
  talonic_data_product_resolve_field: {
    task: "data",
    seoTitle: "talonic_data_product_resolve_field — Decide a Field",
    description:
      "MCP tool that records the value to keep for one field where runs disagree, how it was chosen and the candidates seen. Deciding again replaces the earlier one.",
    related: [
      { label: "talonic_data_product_disagreements", slug: "talonic-data-product-disagreements" },
    ],
  },
  talonic_data_product_suggest_resolutions: {
    task: "data",
    seoTitle: "talonic_data_product_suggest_resolutions — Suggest Values",
    description:
      "MCP tool that reads the documents behind disagreeing fields and suggests a value to keep, with a confidence and a reason. Writes nothing; takes up to a minute.",
    related: [
      { label: "talonic_data_product_resolve_field", slug: "talonic-data-product-resolve-field" },
    ],
  },
  talonic_data_product_resolve_singles: {
    task: "data",
    seoTitle: "talonic_data_product_resolve_singles — Clear Singles",
    description:
      "MCP tool that decides every disagreeing field where exactly one run has a value and the others are empty, keeping that value, and returns how many it decided.",
    related: [
      { label: "talonic_data_product_resolve_field", slug: "talonic-data-product-resolve-field" },
    ],
  },
  talonic_data_product_issue_ids: {
    task: "data",
    seoTitle: "talonic_data_product_issue_ids — Issue IDs into Product Rows",
    description:
      "MCP tool that issues unique IDs into a data product's rows from its ID rules or rules you send, with sequence formats. Rows that already have an ID keep it.",
    related: [
      { label: "talonic_data_product_regenerate_ids", slug: "talonic-data-product-regenerate-ids" },
      { label: "talonic_data_product_generated_ids", slug: "talonic-data-product-generated-ids" },
    ],
  },
  talonic_data_product_regenerate_ids: {
    task: "data",
    seoTitle: "talonic_data_product_regenerate_ids — Re-issue IDs",
    description:
      "MCP tool that clears every issued ID of a data product and issues them again from its rules. IDs already delivered elsewhere are not recalled, so confirm first.",
    related: [{ label: "talonic_data_product_issue_ids", slug: "talonic-data-product-issue-ids" }],
  },
  talonic_data_product_generated_ids: {
    task: "data",
    seoTitle: "talonic_data_product_generated_ids — List Issued IDs",
    description:
      "MCP tool that lists every ID issued for a data product's rows, so you can see which identifiers exist before delivery or after changing the product's ID rules.",
    related: [
      { label: "talonic_data_product_issue_ids", slug: "talonic-data-product-issue-ids" },
      {
        label: "talonic_data_product_sequence_counters",
        slug: "talonic-data-product-sequence-counters",
      },
    ],
  },
  talonic_data_product_sequence_counters: {
    task: "data",
    seoTitle: "talonic_data_product_sequence_counters — ID Counters",
    description:
      "MCP tool that lists the sequence counters a data product's ID rules draw from, per target field and prefix, with each counter's current value and next number.",
    related: [
      {
        label: "talonic_data_product_set_sequence_counter",
        slug: "talonic-data-product-set-sequence-counter",
      },
      { label: "talonic_data_product_counter_ids", slug: "talonic-data-product-counter-ids" },
    ],
  },
  talonic_data_product_set_sequence_counter: {
    task: "data",
    seoTitle: "talonic_data_product_set_sequence_counter — Set a Counter",
    description:
      "MCP tool that sets a sequence counter's high-water mark so the next ID issued is value + 1. Issued IDs stay; lowering it can reuse an ID, so confirm first.",
    related: [
      {
        label: "talonic_data_product_sequence_counters",
        slug: "talonic-data-product-sequence-counters",
      },
    ],
  },
  talonic_data_product_counter_ids: {
    task: "data",
    seoTitle: "talonic_data_product_counter_ids — IDs From One Counter",
    description:
      "MCP tool that lists the IDs one sequence counter issued, per document, newest first, paged with limit and offset, to see which document got which number.",
    related: [
      {
        label: "talonic_data_product_sequence_counters",
        slug: "talonic-data-product-sequence-counters",
      },
    ],
  },
  talonic_data_policy_check: {
    task: "data",
    seoTitle: "talonic_data_policy_check — Validate a Data Policy",
    description:
      "MCP tool that checks a data policy's latest version and prepares it to run, returning its rule count. A rule that does not check out returns a 400 naming it.",
    related: [
      { label: "talonic_data_policy_preview", slug: "talonic-data-policy-preview" },
      { label: "talonic_data_policy_publish", slug: "talonic-data-policy-publish" },
    ],
  },
  talonic_data_policy_preview: {
    task: "data",
    seoTitle: "talonic_data_policy_preview — Preview a Data Policy",
    description:
      "MCP tool that previews a data policy on one record set without writing anything: a sample record as the policy would leave it, plus the set's record count.",
    related: [
      { label: "talonic_data_policy_check", slug: "talonic-data-policy-check" },
      { label: "talonic_data_policy_publish", slug: "talonic-data-policy-publish" },
    ],
  },
  talonic_data_policy_publish: {
    task: "data",
    seoTitle: "talonic_data_policy_publish — Publish a Data Policy",
    description:
      "MCP tool that publishes a data policy's latest checked version so runs use it. Send the version you read; a newer change returns a conflict. Confirm first.",
    related: [
      { label: "talonic_data_policy_preview", slug: "talonic-data-policy-preview" },
      { label: "talonic_data_policy_run", slug: "talonic-data-policy-run" },
    ],
  },
  talonic_data_policy_run: {
    task: "data",
    seoTitle: "talonic_data_policy_run — Apply a Policy to a Finished Run",
    description:
      "MCP tool that applies a published data policy to a completed structuring run and starts it, returning the new run. Fails with not_published until published.",
    related: [{ label: "talonic_data_policy_publish", slug: "talonic-data-policy-publish" }],
  },
  talonic_catalog_list: {
    task: "data",
    seoTitle: "talonic_catalog_list — List the Workspace's Data Sets",
    description:
      "MCP tool that lists every data set shared in the workspace with its fields and their meaning, row count and last update, plus flags for sets being refreshed.",
    related: [
      { label: "talonic_catalog_get", slug: "talonic-catalog-get" },
      { label: "talonic_catalog_rows", slug: "talonic-catalog-rows" },
    ],
  },
  talonic_catalog_get: {
    task: "data",
    seoTitle: "talonic_catalog_get — Read One Data Set's Field List",
    description:
      "MCP tool that returns one data set from the workspace catalog by name: its fields, row count, status and last update, before you read its rows or filter them.",
    related: [
      { label: "talonic_catalog_list", slug: "talonic-catalog-list" },
      { label: "talonic_catalog_rows", slug: "talonic-catalog-rows" },
    ],
  },
  talonic_catalog_rows: {
    task: "data",
    seoTitle: "talonic_catalog_rows — Read Data Set Rows With Sources",
    description:
      "MCP tool that reads rows of one data set, each with the documents it came from. Filter by field values and page up to 500 rows; hidden rows count as withheld.",
    related: [{ label: "talonic_catalog_get", slug: "talonic-catalog-get" }],
  },
  talonic_suggestion_questions: {
    task: "data",
    seoTitle: "talonic_suggestion_questions — Open Data Questions",
    description:
      "MCP tool that lists questions Talonic asks about your data, such as which field a column holds or whether two records are one party, open and important first.",
    related: [{ label: "talonic_suggestion_answer", slug: "talonic-suggestion-answer" }],
  },
  talonic_suggestion_answer: {
    task: "data",
    seoTitle: "talonic_suggestion_answer — Answer a Data Question",
    description:
      "MCP tool that answers an open question about your data with one of its options. The answer covers every subject the question names; closed ones return 409.",
    related: [{ label: "talonic_suggestion_questions", slug: "talonic-suggestion-questions" }],
  },
  talonic_suggestion_mappings: {
    task: "data",
    seoTitle: "talonic_suggestion_mappings — Suggested Column Mappings",
    description:
      "MCP tool that lists suggested fields for the columns of connected sources, each with a confidence. Filter to those awaiting a decision or by source, paged.",
    related: [
      { label: "talonic_suggestion_decide_mapping", slug: "talonic-suggestion-decide-mapping" },
      { label: "talonic_suggestion_links", slug: "talonic-suggestion-links" },
    ],
  },
  talonic_suggestion_decide_mapping: {
    task: "data",
    seoTitle: "talonic_suggestion_decide_mapping — Decide a Mapping",
    description:
      "MCP tool that confirms or rejects a suggested column mapping, or retargets it to another existing field or a proposed new field. The decision is recorded.",
    related: [
      { label: "talonic_suggestion_mappings", slug: "talonic-suggestion-mappings" },
      { label: "talonic_list_fields", slug: "talonic-list-fields" },
    ],
  },
  talonic_suggestion_links: {
    task: "data",
    seoTitle: "talonic_suggestion_links — Suggested Table Matches",
    description:
      "MCP tool that lists suggested matches between a column of one table and a column of another, where one refers to the other or they share values, with overlap.",
    related: [
      { label: "talonic_suggestion_decide_link", slug: "talonic-suggestion-decide-link" },
      { label: "talonic_suggestion_mappings", slug: "talonic-suggestion-mappings" },
    ],
  },
  talonic_suggestion_decide_link: {
    task: "data",
    seoTitle: "talonic_suggestion_decide_link — Decide a Table Match",
    description:
      "MCP tool that confirms or rejects a suggested match between two tables' columns, recorded as your decision, so confirmed relations connect data across tables.",
    related: [{ label: "talonic_suggestion_links", slug: "talonic-suggestion-links" }],
  },
  talonic_schema_review_queue: {
    task: "review",
    seoTitle: "talonic_schema_review_queue — Pending Schema Changes",
    description:
      "MCP tool that lists schema changes waiting for a decision, newest first: those that add, remove or retype fields in a way that can affect output you have.",
    related: [
      { label: "talonic_schema_review_approve", slug: "talonic-schema-review-approve" },
      { label: "talonic_schema_review_reject", slug: "talonic-schema-review-reject" },
    ],
  },
  talonic_schema_review_approve: {
    task: "review",
    seoTitle: "talonic_schema_review_approve — Approve a Schema Change",
    description:
      "MCP tool that approves a schema change from the review queue so it becomes the live version. The decision records who decided and when; confirm first.",
    related: [
      { label: "talonic_schema_review_queue", slug: "talonic-schema-review-queue" },
      { label: "talonic_schema_review_reject", slug: "talonic-schema-review-reject" },
    ],
  },
  talonic_schema_review_reject: {
    task: "review",
    seoTitle: "talonic_schema_review_reject — Reject a Schema Change",
    description:
      "MCP tool that rejects a schema change from the review queue and discards the proposed changes. The decision records who decided and when; confirm first.",
    related: [
      { label: "talonic_schema_review_queue", slug: "talonic-schema-review-queue" },
      { label: "talonic_schema_review_approve", slug: "talonic-schema-review-approve" },
    ],
  },
  talonic_link_key_set: {
    task: "review",
    seoTitle: "talonic_link_key_set — Set or Remove a Workspace Link Key",
    description:
      "MCP tool that makes a field a link key, so documents sharing its value such as a customer number are linked, or stops using it. Turning it on links past ones.",
    related: [
      { label: "talonic_cases_list", slug: "talonic-cases-list" },
      { label: "talonic_cases_document_neighbors", slug: "talonic-cases-document-neighbors" },
    ],
  },
}
