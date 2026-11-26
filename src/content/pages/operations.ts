// Page copy for the generated tool reference (see src/content/tool-pages.ts).

import type { ToolPage } from "../tool-reference-types"

export const OPERATIONS_PAGES: Record<string, ToolPage> = {
  talonic_pipeline_add_documents: {
    task: "run",
    seoTitle: "talonic_pipeline_add_documents — Add Documents to a Spec Run",
    description:
      "MCP tool that attaches up to 1000 workspace documents to a Spec run as one submission group. They wait idle until the run starts; any already in it are skipped.",
    related: [
      { label: "talonic_pipeline_start", slug: "talonic-pipeline-start" },
      { label: "talonic_pipeline_documents", slug: "talonic-pipeline-documents" },
    ],
  },
  talonic_pipeline_documents: {
    task: "run",
    seoTitle: "talonic_pipeline_documents — List a Spec Run's Documents",
    description:
      "MCP tool that lists a Spec run's documents with their processing state, paged and filterable by status, tag or flag, to find failed or flagged ones fast.",
    related: [
      { label: "talonic_pipeline_field_states", slug: "talonic-pipeline-field-states" },
      { label: "talonic_pipeline_retry_errored", slug: "talonic-pipeline-retry-errored" },
    ],
  },
  talonic_pipeline_runs: {
    task: "run",
    seoTitle: "talonic_pipeline_runs — List a Spec Run's Submission Groups",
    description:
      "MCP tool that lists the submission groups that fed documents into a Spec run, newest first and paged, with how many documents each holds and how many are loose.",
    related: [{ label: "talonic_pipeline_documents", slug: "talonic-pipeline-documents" }],
  },
  talonic_pipeline_start: {
    task: "run",
    seoTitle: "talonic_pipeline_start — Start or Resume a Spec Run",
    description:
      "MCP tool that starts or resumes processing of a Spec run's idle documents, such as newly added ones. It uses credits and lists runs held by a business rule.",
    related: [
      { label: "talonic_pipeline_add_documents", slug: "talonic-pipeline-add-documents" },
      { label: "talonic_pipeline_rule_holds", slug: "talonic-pipeline-rule-holds" },
    ],
  },
  talonic_pipeline_retry_errored: {
    task: "run",
    seoTitle: "talonic_pipeline_retry_errored — Retry Failed Run Documents",
    description:
      "MCP tool that processes only the failed documents of a Spec run again, leaving finished ones untouched. Credits are used for the retried documents only.",
    related: [{ label: "talonic_pipeline_documents", slug: "talonic-pipeline-documents" }],
  },
  talonic_pipeline_retriage: {
    task: "run",
    seoTitle: "talonic_pipeline_retriage — Rebuild a Run's Review Queue",
    description:
      "MCP tool that rebuilds a finished Spec run's review queue from stored check results, optionally with a new review_config. No credits used; items may move.",
    related: [{ label: "talonic_pipeline_documents", slug: "talonic-pipeline-documents" }],
  },
  talonic_pipeline_field_states: {
    task: "run",
    seoTitle: "talonic_pipeline_field_states — Read a Run Document's Fields",
    description:
      "MCP tool that returns every field of one document in a Spec run: its value, confidence, and whether it is flagged, waiting for review or changed by a person.",
    related: [
      { label: "talonic_pipeline_documents", slug: "talonic-pipeline-documents" },
      { label: "talonic_pipeline_cell_history", slug: "talonic-pipeline-cell-history" },
    ],
  },
  talonic_pipeline_cell_history: {
    task: "run",
    seoTitle: "talonic_pipeline_cell_history — Audit a Run's Value History",
    description:
      "MCP tool that returns every value each cell of a Spec run has held, who or what set it, and when. Narrow it to chosen documents to explain or audit a change.",
    related: [{ label: "talonic_pipeline_field_states", slug: "talonic-pipeline-field-states" }],
  },
  talonic_pipeline_assembly_groups: {
    task: "run",
    seoTitle: "talonic_pipeline_assembly_groups — List Assembled Groups",
    description:
      "MCP tool that lists the groups of a Spec run that assembles several documents into one record, each with its row, base document and the documents placed in it.",
    related: [
      { label: "talonic_pipeline_needs_anchor", slug: "talonic-pipeline-needs-anchor" },
      { label: "talonic_pipeline_rerun_assembly", slug: "talonic-pipeline-rerun-assembly" },
    ],
  },
  talonic_pipeline_needs_anchor: {
    task: "run",
    seoTitle: "talonic_pipeline_needs_anchor — List Groups Needing a Base",
    description:
      "MCP tool that lists the groups of an assembling Spec run that could not settle on one base document, each with the candidate documents a person can choose from.",
    related: [
      { label: "talonic_pipeline_resolve_anchor", slug: "talonic-pipeline-resolve-anchor" },
    ],
  },
  talonic_pipeline_resolve_anchor: {
    task: "run",
    seoTitle: "talonic_pipeline_resolve_anchor — Choose a Base Document",
    description:
      "MCP tool that settles one group of an assembling Spec run by choosing its base document from the candidates, then assembles the group again around it.",
    related: [
      { label: "talonic_pipeline_needs_anchor", slug: "talonic-pipeline-needs-anchor" },
      { label: "talonic_pipeline_assembly_groups", slug: "talonic-pipeline-assembly-groups" },
    ],
  },
  talonic_pipeline_rerun_assembly: {
    task: "run",
    seoTitle: "talonic_pipeline_rerun_assembly — Reassemble a Run's Groups",
    description:
      "MCP tool that assembles every group of a Spec run again from its current documents. Existing groups and rows are rebuilt and can change, so use it on request.",
    related: [
      { label: "talonic_pipeline_assembly_groups", slug: "talonic-pipeline-assembly-groups" },
    ],
  },
  talonic_pipeline_rule_holds: {
    task: "run",
    seoTitle: "talonic_pipeline_rule_holds — List Business-Rule Holds",
    description:
      "MCP tool that lists the business-rule holds stopping a Spec's runs, each with the runs it holds and any one-run overrides already given, to decide what's next.",
    related: [{ label: "talonic_pipeline_override_hold", slug: "talonic-pipeline-override-hold" }],
  },
  talonic_pipeline_override_hold: {
    task: "run",
    seoTitle: "talonic_pipeline_override_hold — Let One Held Run Proceed",
    description:
      "MCP tool that lets exactly one held run proceed past a business-rule hold, with a reason kept for audit. The hold stays open for later runs. Admin only.",
    related: [{ label: "talonic_pipeline_rule_holds", slug: "talonic-pipeline-rule-holds" }],
  },
  talonic_pipeline_reconciliation_cases: {
    task: "run",
    seoTitle: "talonic_pipeline_reconciliation_cases — List Mismatch Cases",
    description:
      "MCP tool that lists the reconciliation cases a Spec's business rules raised, each a mismatch between documents to look into, with its current state shown.",
    related: [
      {
        label: "talonic_pipeline_export_reconciliation_cases",
        slug: "talonic-pipeline-export-reconciliation-cases",
      },
    ],
  },
  talonic_pipeline_export_reconciliation_cases: {
    task: "run",
    seoTitle: "talonic_pipeline_export_reconciliation_cases — Export Cases",
    description:
      "MCP tool that exports a Spec's reconciliation cases in full for audit: each case's values, evidence, history and the holds it caused. Needs export permission.",
    related: [
      {
        label: "talonic_pipeline_reconciliation_cases",
        slug: "talonic-pipeline-reconciliation-cases",
      },
    ],
  },
  talonic_ingest_queue_status: {
    task: "sources",
    seoTitle: "talonic_ingest_queue_status — Check the Processing Queue",
    description:
      "MCP tool that counts the workspace's documents in each processing state, such as queued, extracting, completed or error, to see whether uploads are done.",
    related: [{ label: "talonic_get_document", slug: "talonic-get-document" }],
  },
  talonic_ingest_duplicates: {
    task: "sources",
    seoTitle: "talonic_ingest_duplicates — Find Identical Workspace Files",
    description:
      "MCP tool that lists groups of identical files in the workspace, with their document ids and filenames and a duplicate count. Only documents you can see show.",
    related: [
      { label: "talonic_ingest_skipped_duplicates", slug: "talonic-ingest-skipped-duplicates" },
    ],
  },
  talonic_ingest_skipped_duplicates: {
    task: "sources",
    seoTitle: "talonic_ingest_skipped_duplicates — List Skipped Duplicates",
    description:
      "MCP tool that lists uploads skipped because an identical document already existed, newest first and up to 1000, each naming the existing document it matched.",
    related: [
      { label: "talonic_ingest_process_duplicate", slug: "talonic-ingest-process-duplicate" },
    ],
  },
  talonic_ingest_process_duplicate: {
    task: "sources",
    seoTitle: "talonic_ingest_process_duplicate — Process a Skipped Upload",
    description:
      "MCP tool that creates a new document for an upload skipped as a duplicate, reusing the existing document's content and values. Pass idempotency_key for retries.",
    related: [
      { label: "talonic_ingest_skipped_duplicates", slug: "talonic-ingest-skipped-duplicates" },
    ],
  },
  talonic_ingest_settings: {
    task: "sources",
    seoTitle: "talonic_ingest_settings — Read Optional Ingest Steps",
    description:
      "MCP tool that shows which optional steps run as documents arrive in the workspace, such as document types, sensitivity tags, document links and delivery.",
    related: [{ label: "talonic_ingest_update_settings", slug: "talonic-ingest-update-settings" }],
  },
  talonic_ingest_update_settings: {
    task: "sources",
    seoTitle: "talonic_ingest_update_settings — Turn Ingest Steps On or Off",
    description:
      "MCP tool that turns optional ingest steps on or off for documents arriving from now on; only the steps you pass change. Turning delivery off stops notices.",
    related: [{ label: "talonic_ingest_settings", slug: "talonic-ingest-settings" }],
  },
  talonic_documents_tags: {
    task: "organise",
    seoTitle: "talonic_documents_tags — List Every Tag on Your Documents",
    description:
      "MCP tool that lists every distinct tag on the documents you can see, so an agent can reuse an existing tag instead of a near-duplicate, or offer tag filters.",
    related: [{ label: "talonic_documents_batch_tag", slug: "talonic-documents-batch-tag" }],
  },
  talonic_documents_system_tags: {
    task: "organise",
    seoTitle: "talonic_documents_system_tags — List Grouping Tags",
    description:
      "MCP tool that lists the read-only grouping tags Talonic set on documents when unpacking them, naming the email or archive each came in, apart from user tags.",
    related: [{ label: "talonic_documents_tags", slug: "talonic-documents-tags" }],
  },
  talonic_documents_facets: {
    task: "organise",
    seoTitle: "talonic_documents_facets — Count Documents per Filter",
    description:
      "MCP tool that counts the documents you can see per status, document type, source and tag, to build or explain filters or give a quick overview of the workspace.",
    related: [{ label: "talonic_saved_filters_list", slug: "talonic-saved-filters-list" }],
  },
  talonic_documents_batch_tag: {
    task: "organise",
    seoTitle: "talonic_documents_batch_tag — Tag Many Documents at Once",
    description:
      "MCP tool that adds, removes or sets tags on up to 1000 documents in one all-or-nothing call. Tags can control who sees a document, so remove and set need care.",
    related: [
      { label: "talonic_documents_tags", slug: "talonic-documents-tags" },
      { label: "talonic_documents_set_tags", slug: "talonic-documents-set-tags" },
    ],
  },
  talonic_documents_set_tags: {
    task: "organise",
    seoTitle: "talonic_documents_set_tags — Replace One Document's Tags",
    description:
      "MCP tool that replaces one document's tags with exactly the list you give; an empty list clears them. Tags can control who sees a document, so use on request.",
    related: [{ label: "talonic_documents_batch_tag", slug: "talonic-documents-batch-tag" }],
  },
  talonic_documents_import_batch_ids: {
    task: "organise",
    seoTitle: "talonic_documents_import_batch_ids — Import Source Batch Ids",
    description:
      "MCP tool that sets the source batch id of existing documents from rows or CSV text, matching by id, filename or source item id, and reports rows that missed.",
  },
  talonic_documents_display_name_rule: {
    task: "organise",
    seoTitle: "talonic_documents_display_name_rule — Read the Name Rule",
    description:
      "MCP tool that returns the workspace's rule for showing documents under a readable name instead of the raw filename, with its script and sample results.",
    related: [
      {
        label: "talonic_documents_set_display_name_rule",
        slug: "talonic-documents-set-display-name-rule",
      },
    ],
  },
  talonic_documents_set_display_name_rule: {
    task: "organise",
    seoTitle: "talonic_documents_set_display_name_rule — Set Name Rule",
    description:
      "MCP tool that sets how documents get a readable name: off, a tidied filename or a custom script. New documents follow it; old ones need a backfill. Admin only.",
    related: [
      {
        label: "talonic_documents_preview_display_name_rule",
        slug: "talonic-documents-preview-display-name-rule",
      },
      {
        label: "talonic_documents_backfill_display_names",
        slug: "talonic-documents-backfill-display-names",
      },
    ],
  },
  talonic_documents_preview_display_name_rule: {
    task: "organise",
    seoTitle: "talonic_documents_preview_display_name_rule — Try a Script",
    description:
      "MCP tool that runs a candidate readable-name script over a sample of the workspace's real filenames and shows the names it gives, without saving. Admins only.",
    related: [
      {
        label: "talonic_documents_set_display_name_rule",
        slug: "talonic-documents-set-display-name-rule",
      },
    ],
  },
  talonic_documents_generate_display_name_script: {
    task: "organise",
    seoTitle: "talonic_documents_generate_display_name_script — Draft Rule",
    description:
      "MCP tool that drafts a readable-name script from a plain-language instruction, using the workspace's own filenames as examples. Nothing is saved. Admin only.",
    related: [
      {
        label: "talonic_documents_preview_display_name_rule",
        slug: "talonic-documents-preview-display-name-rule",
      },
    ],
  },
  talonic_documents_display_name_coverage: {
    task: "organise",
    seoTitle: "talonic_documents_display_name_coverage — Check Coverage",
    description:
      "MCP tool that reports how many documents carry a readable name, how many differ from their filename, and a sample of those still shown under the raw filename.",
    related: [
      {
        label: "talonic_documents_backfill_display_names",
        slug: "talonic-documents-backfill-display-names",
      },
    ],
  },
  talonic_documents_backfill_display_names: {
    task: "organise",
    seoTitle: "talonic_documents_backfill_display_names — Apply Name Rule",
    description:
      "MCP tool that applies the current readable-name rule to every existing document in the background, overwriting the readable names they already have. Admin only.",
    related: [
      {
        label: "talonic_documents_display_name_coverage",
        slug: "talonic-documents-display-name-coverage",
      },
    ],
  },
  talonic_collections_list: {
    task: "organise",
    seoTitle: "talonic_collections_list — List the Workspace's Collections",
    description:
      "MCP tool that lists the workspace's collections and accounts with rule, document and assignment counts, or only those assigned to you, or document counts.",
    related: [{ label: "talonic_collections_create", slug: "talonic-collections-create" }],
  },
  talonic_collections_create: {
    task: "organise",
    seoTitle: "talonic_collections_create — Create a Document Collection",
    description:
      "MCP tool that creates a collection or an account with a name, description and optional aliases. It starts empty until you add rules or documents. Admin only.",
    related: [
      { label: "talonic_collections_add_rule", slug: "talonic-collections-add-rule" },
      { label: "talonic_collections_add_documents", slug: "talonic-collections-add-documents" },
    ],
  },
  talonic_collections_preview: {
    task: "organise",
    seoTitle: "talonic_collections_preview — Preview a Collection",
    description:
      "MCP tool that returns a sample of the documents a collection holds under its current rules and hand-added documents, limited to what you can see. Admin only.",
    related: [{ label: "talonic_collections_rules", slug: "talonic-collections-rules" }],
  },
  talonic_collections_update: {
    task: "organise",
    seoTitle: "talonic_collections_update — Rename or Change a Collection",
    description:
      "MCP tool that renames a collection or changes its description, kind or aliases, for example turning a plain collection into a customer account. Admin only.",
    related: [{ label: "talonic_collections_list", slug: "talonic-collections-list" }],
  },
  talonic_collections_delete: {
    task: "organise",
    seoTitle: "talonic_collections_delete — Delete a Document Collection",
    description:
      "MCP tool that deletes a collection with its rules, hand-added documents and assignments; the documents stay. People limited to it lose that view. Admins only.",
    related: [
      { label: "talonic_collections_assignments", slug: "talonic-collections-assignments" },
    ],
  },
  talonic_collections_rules: {
    task: "organise",
    seoTitle: "talonic_collections_rules — List a Collection's Rules",
    description:
      "MCP tool that lists the rules that fill a collection, each naming a rule_type and a rule_value, so you can see why a source, type or case's documents are in it.",
    related: [
      { label: "talonic_collections_add_rule", slug: "talonic-collections-add-rule" },
      { label: "talonic_collections_remove_rule", slug: "talonic-collections-remove-rule" },
    ],
  },
  talonic_collections_add_rule: {
    task: "organise",
    seoTitle: "talonic_collections_add_rule — Add a Rule to a Collection",
    description:
      "MCP tool that adds a rule so every document of a source, document type or case joins a collection, including documents that arrive later on. Admin only.",
    related: [
      { label: "talonic_collections_rules", slug: "talonic-collections-rules" },
      { label: "talonic_document_types_list", slug: "talonic-document-types-list" },
    ],
  },
  talonic_collections_remove_rule: {
    task: "organise",
    seoTitle: "talonic_collections_remove_rule — Remove a Collection Rule",
    description:
      "MCP tool that removes one rule from a collection; documents it brought in leave unless another rule or a hand-add keeps them there. Admins only, as in the app.",
    related: [{ label: "talonic_collections_rules", slug: "talonic-collections-rules" }],
  },
  talonic_collections_documents: {
    task: "organise",
    seoTitle: "talonic_collections_documents — List Hand-Added Documents",
    description:
      "MCP tool that lists the documents added to a collection by hand, not those its rules bring in, limited to the documents you can see. Preview shows all it holds.",
    related: [{ label: "talonic_collections_preview", slug: "talonic-collections-preview" }],
  },
  talonic_collections_add_documents: {
    task: "organise",
    seoTitle: "talonic_collections_add_documents — Hand-Add Documents",
    description:
      "MCP tool that adds documents to a collection by hand. Every id must be a document you can see, or nothing is added and the call answers 404. Admins only.",
    related: [{ label: "talonic_collections_documents", slug: "talonic-collections-documents" }],
  },
  talonic_collections_remove_document: {
    task: "organise",
    seoTitle: "talonic_collections_remove_document — Take a Document Out",
    description:
      "MCP tool that takes one hand-added document out of a collection. A rule of the collection may still include it, so check its rules as well. Admin only.",
    related: [{ label: "talonic_collections_rules", slug: "talonic-collections-rules" }],
  },
  talonic_collections_assignments: {
    task: "organise",
    seoTitle: "talonic_collections_assignments — See Who Has a Collection",
    description:
      "MCP tool that lists the people and groups a collection is assigned to, each with its mode: enforced limits what they see, default only preselects it for them.",
    related: [{ label: "talonic_collections_assign", slug: "talonic-collections-assign" }],
  },
  talonic_collections_assign: {
    task: "organise",
    seoTitle: "talonic_collections_assign — Assign a Collection to People",
    description:
      "MCP tool that assigns a collection to a person or group. Enforced mode limits what they see to its documents; default only preselects it for them. Admins only.",
    related: [
      { label: "talonic_collections_assignments", slug: "talonic-collections-assignments" },
      { label: "talonic_collections_unassign", slug: "talonic-collections-unassign" },
    ],
  },
  talonic_collections_unassign: {
    task: "organise",
    seoTitle: "talonic_collections_unassign — Remove an Assignment",
    description:
      "MCP tool that removes one collection assignment. A person who was limited to the collection in enforced mode sees their usual documents again. Admins only.",
    related: [
      { label: "talonic_collections_assignments", slug: "talonic-collections-assignments" },
    ],
  },
  talonic_saved_filters_list: {
    task: "organise",
    seoTitle: "talonic_saved_filters_list — List Saved Filter Presets",
    description:
      "MCP tool that lists the workspace's saved filter presets, newest first, with name, conditions, search text, sort and source. Narrow it to one source if needed.",
    related: [
      { label: "talonic_filter", slug: "talonic-filter" },
      { label: "talonic_saved_filters_create", slug: "talonic-saved-filters-create" },
    ],
  },
  talonic_saved_filters_create: {
    task: "organise",
    seoTitle: "talonic_saved_filters_create — Save a Reusable Filter Preset",
    description:
      "MCP tool that saves a named filter preset with conditions, search text and sort, so it shows in your web app filter picker. Conditions follow talonic_filter.",
    related: [
      { label: "talonic_saved_filters_list", slug: "talonic-saved-filters-list" },
      { label: "talonic_filter", slug: "talonic-filter" },
    ],
  },
  talonic_saved_filters_delete: {
    task: "organise",
    seoTitle: "talonic_saved_filters_delete — Delete a Saved Filter",
    description:
      "MCP tool that deletes one of your own saved filter presets by id; another person's filter answers 404. The delete cannot be undone, so confirm the filter first.",
    related: [{ label: "talonic_saved_filters_list", slug: "talonic-saved-filters-list" }],
  },
  talonic_document_types_list: {
    task: "organise",
    seoTitle: "talonic_document_types_list — List Workspace Document Types",
    description:
      "MCP tool that lists the workspace's document types with how many documents each has, most used first, to find a type id for a collection rule, update or merge.",
    related: [
      { label: "talonic_document_types_create", slug: "talonic-document-types-create" },
      { label: "talonic_document_types_pending", slug: "talonic-document-types-pending" },
    ],
  },
  talonic_document_types_create: {
    task: "organise",
    seoTitle: "talonic_document_types_create — Create a Document Type",
    description:
      "MCP tool that creates a new document type for the workspace with a name and optional description, and returns its id, name and document count for later use.",
    related: [{ label: "talonic_document_types_list", slug: "talonic-document-types-list" }],
  },
  talonic_document_types_update: {
    task: "organise",
    seoTitle: "talonic_document_types_update — Rename a Document Type",
    description:
      "MCP tool that renames a document type or changes its description, using the type id from the document type list. Documents of that type keep their type.",
    related: [{ label: "talonic_document_types_list", slug: "talonic-document-types-list" }],
  },
  talonic_document_types_pending: {
    task: "organise",
    seoTitle: "talonic_document_types_pending — Review Proposed Types",
    description:
      "MCP tool that lists document types proposed while new documents were sorted, with suggestions to create each, merge them together or merge into a known type.",
    related: [
      {
        label: "talonic_document_types_resolve_pending",
        slug: "talonic-document-types-resolve-pending",
      },
      { label: "talonic_document_types_auto_resolve", slug: "talonic-document-types-auto-resolve" },
    ],
  },
  talonic_document_types_resolve_pending: {
    task: "organise",
    seoTitle: "talonic_document_types_resolve_pending — Decide a Proposal",
    description:
      "MCP tool that settles one proposed document type: create it as a new type, or merge it into an existing type you name. Its documents move with it either way.",
    related: [{ label: "talonic_document_types_pending", slug: "talonic-document-types-pending" }],
  },
  talonic_document_types_resolve_pending_batch: {
    task: "organise",
    seoTitle: "talonic_document_types_resolve_pending_batch — Bulk Decide",
    description:
      "MCP tool that settles up to 200 proposed document types in one call, each with create or merge, and answers a result per item so you see which went through.",
    related: [{ label: "talonic_document_types_pending", slug: "talonic-document-types-pending" }],
  },
  talonic_document_types_merge_pending: {
    task: "organise",
    seoTitle: "talonic_document_types_merge_pending — Merge Proposed Types",
    description:
      "MCP tool that merges several proposed document types into one new type under the name you choose, moving all of their documents to it in a single call.",
    related: [{ label: "talonic_document_types_pending", slug: "talonic-document-types-pending" }],
  },
  talonic_document_types_auto_resolve: {
    task: "organise",
    seoTitle: "talonic_document_types_auto_resolve — Settle All Proposals",
    description:
      "MCP tool that settles every waiting proposed document type at once, merging each into a matching standard type where one exists and creating the rest.",
    related: [{ label: "talonic_document_types_pending", slug: "talonic-document-types-pending" }],
  },
  talonic_document_types_dismiss_pending: {
    task: "organise",
    seoTitle: "talonic_document_types_dismiss_pending — Dismiss a Proposal",
    description:
      "MCP tool that dismisses one proposed document type without creating a type, clearing it from the list of proposals waiting for a decision in the workspace.",
    related: [{ label: "talonic_document_types_pending", slug: "talonic-document-types-pending" }],
  },
}
