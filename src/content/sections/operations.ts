import type { RawSection } from "../types"

// Workspace operation tool families (Spec-run operations, ingest operations,
// document organising, collections, saved filters, document types). Each tool
// has a level-3 heading whose id is its slug, its description, the routes it
// calls and a parameter table that tests/content/operations-sections.test.ts
// checks against the tool's input schema.
export const sections: RawSection[] = [
  {
    slug: "pipeline-operations",
    parentSlug: "operations",
    title: "Spec run operations",
    seoTitle: "Spec Run Operations — Talonic MCP Tools for Runs and Holds",
    description:
      "MCP tools that run a Talonic Spec day to day: add documents, start, retry failures, rebuild the review queue, settle groups and let a held run proceed.",
    content: [
      {
        type: "paragraph",
        text: "Run one Spec run (its `pipeline_id`, from `talonic_run_spec` or `talonic_get_run`) the way the run view of the web app does: add documents, start them, retry the ones that failed, rebuild the review queue, choose the base document of a group, let one run held by a business rule proceed, and read the run's documents, submission groups, field states, value history, holds and reconciliation cases.",
      },
      {
        type: "paragraph",
        text: "Reads need the `runs:read` scope. Adding, starting, retrying, rebuilding and assembling need `runs:write`, and the key's person must be an Admin of a workspace that configures its own processing, as in the web app. Choosing a base document needs `reviews:write` and the edit permission; letting a held run proceed needs an Admin; the reconciliation export needs the export permission.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Listed when the connection can read the workspace's Spec runs (`GET /v1/pipelines` answers). The platform checks every call. A 403 names its reason (insufficient_scope, insufficient_role, no_person, person_inactive, workspace_read_only): the key's person must be allowed the same action in the Talonic web app, and an OAuth connection must have granted the scope.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-add-documents",
        text: "talonic_pipeline_add_documents",
      },
      {
        type: "paragraph",
        text: "Attach workspace documents to a Spec run. They wait idle until talonic_pipeline_start; documents already in the run are skipped. One call is one submission group (`run_id`). Every id must be a document the key's person can see (a hidden one answers 404 like a missing one). At most 1000 ids. RETURNS: { pipeline_id, run_id, added, skipped, documents[] { id, document_id, status } }.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/pipelines/{pipeline_id}/documents`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
          {
            name: "document_ids",
            type: "UUID[]",
            required: true,
            description: "Workspace document ids (talonic_search or talonic_filter), 1 to 1000.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-documents",
        text: "talonic_pipeline_documents",
      },
      {
        type: "paragraph",
        text: "The documents of a Spec run with their processing state, paged and filterable like the run grid in the web app. USE WHEN: finding which documents failed, are flagged, or belong to one submission group; getting the run document id that talonic_pipeline_field_states needs. RETURNS: { data[] (one per run document: id = run document id, document_id, filename, status, …), pagination { total, page, limit } }.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/pipelines/{pipeline_id}/documents`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
          {
            name: "page",
            type: "number",
            required: false,
            description: "Page number, from 1.",
          },
          {
            name: "limit",
            type: "number",
            required: false,
            description: "Rows per page; the platform caps it.",
          },
          {
            name: "q",
            type: "string",
            required: false,
            description: "Filename contains this text.",
          },
          {
            name: "status",
            type: "string[]",
            required: false,
            description: 'Only these run document states, e.g. ["error"] or ["completed"].',
          },
          {
            name: "tags",
            type: "string[]",
            required: false,
            description: "Documents carrying any of these tags.",
          },
          {
            name: "flagged",
            type: "boolean",
            required: false,
            description: "true: only documents with flagged values; false: only without.",
          },
          {
            name: "has_manual_edits",
            type: "boolean",
            required: false,
            description: "true: only documents with values a person changed.",
          },
          {
            name: "overridden_by_amendment",
            type: "boolean",
            required: false,
            description: "true: only documents whose values a later amendment replaced.",
          },
          {
            name: "sort_by",
            type: "string",
            required: false,
            description:
              "filename, status, added_at, duration, flag_count, batch, or field:<field key>.",
          },
          {
            name: "sort_dir",
            type: "asc | desc",
            required: false,
            description: "Sort direction.",
          },
          {
            name: "run_id",
            type: "string",
            required: false,
            description:
              "One submission group (talonic_pipeline_runs), or `none` for documents added outside any group.",
          },
          {
            name: "ids",
            type: "UUID[]",
            required: false,
            description: "Read exactly these run document ids.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-runs",
        text: "talonic_pipeline_runs",
      },
      {
        type: "paragraph",
        text: "The submission groups (`run_id`) that fed documents into a Spec run, newest first, paged, with how many documents each holds. RETURNS: { data[], untracked_count (documents added outside any group), pagination { total, page, limit } }.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/pipelines/{pipeline_id}/runs`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
          {
            name: "page",
            type: "number",
            required: false,
            description: "Page number, from 1.",
          },
          {
            name: "limit",
            type: "number",
            required: false,
            description: "Rows per page; the platform caps it.",
          },
          {
            name: "q",
            type: "string",
            required: false,
            description: "A run id prefix or a batch id fragment.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-start",
        text: "talonic_pipeline_start",
      },
      {
        type: "paragraph",
        text: "Start (or resume) processing of the run's idle documents, e.g. after talonic_pipeline_add_documents. Processing uses credits; call only when the user asked to run it. Runs stopped by a business rule are listed in `held_runs` (see talonic_pipeline_rule_holds). RETURNS: { pipeline_id, enqueued, held_runs[] }. Poll talonic_get_run for progress.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/pipelines/{pipeline_id}/start`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-retry-errored",
        text: "talonic_pipeline_retry_errored",
      },
      {
        type: "paragraph",
        text: "Process again only the run's documents that failed; documents that finished are untouched. Uses credits for the retried documents. To retry one failed document anywhere, re-extract that document instead. RETURNS: { pipeline_id, retried, enqueued }.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/pipelines/{pipeline_id}/retry-errored`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-retriage",
        text: "talonic_pipeline_retriage",
      },
      {
        type: "paragraph",
        text: "Rebuild a finished run's review queue from its stored check results and route the items again, optionally under a new `review_config`. Nothing is checked again and no credits are spent, but the current queue is replaced: items already routed may move. Call only when the user asks. RETURNS: the rebuild summary and the new routing counts.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/pipelines/{pipeline_id}/retriage`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
          {
            name: "review_config",
            type: "object",
            required: false,
            description:
              "A new review routing configuration to apply first; omit to keep the stored one.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-field-states",
        text: "talonic_pipeline_field_states",
      },
      {
        type: "paragraph",
        text: "The state of every field of one document in a Spec run: value, confidence, whether it is flagged, waits for review, or was changed by a person. `run_document_id` is the `id` of a row from talonic_pipeline_documents (not the workspace document id). RETURNS: { data[] }.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/pipelines/{pipeline_id}/documents/{run_document_id}/field-states`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
          {
            name: "run_document_id",
            type: "UUID",
            required: true,
            description: "The run document id (`id` from talonic_pipeline_documents).",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-cell-history",
        text: "talonic_pipeline_cell_history",
      },
      {
        type: "paragraph",
        text: "Every value each cell of the run held, who or what set it, and when. Narrow with `document_ids`. USE WHEN: explaining why a value changed, or auditing manual corrections.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/pipelines/{pipeline_id}/cell-history`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
          {
            name: "document_ids",
            type: "UUID[]",
            required: false,
            description: "Only the history of these documents.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-assembly-groups",
        text: "talonic_pipeline_assembly_groups",
      },
      {
        type: "paragraph",
        text: "For a Spec that assembles several documents into one record (e.g. an order with its invoices): every group with its row, its base document and the documents bucketed into it. Documents the key's person cannot see are left out of a group's list. RETURNS: { data[] }.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/pipelines/{pipeline_id}/assembly/groups`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-needs-anchor",
        text: "talonic_pipeline_needs_anchor",
      },
      {
        type: "paragraph",
        text: "Groups of an assembling Spec run that could not settle on one base document, each with the candidate documents to choose from. Choose with talonic_pipeline_resolve_anchor. RETURNS: { data[] { group_key, candidates[] { documentId, … } } }.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/pipelines/{pipeline_id}/assembly/needs-anchor`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-resolve-anchor",
        text: "talonic_pipeline_resolve_anchor",
      },
      {
        type: "paragraph",
        text: "Settle one group by choosing its base document; the group is assembled again around it. Take `group_key` and a candidate's `documentId` from talonic_pipeline_needs_anchor. Needs the `reviews:write` scope and the edit permission. RETURNS: { group_key, status, product_record_id }. 400 when the Spec does not assemble documents.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/pipelines/{pipeline_id}/assembly/resolve-anchor`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
          {
            name: "group_key",
            type: "string",
            required: true,
            description: "The group, from talonic_pipeline_needs_anchor.",
          },
          {
            name: "anchor_document_id",
            type: "string",
            required: true,
            description: "The chosen candidate's `documentId`.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-rerun-assembly",
        text: "talonic_pipeline_rerun_assembly",
      },
      {
        type: "paragraph",
        text: "Assemble every group of the run again from its current documents. Existing groups and their rows are rebuilt and can change. Call only when the user asks.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/pipelines/{pipeline_id}/assembly/rerun`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-rule-holds",
        text: "talonic_pipeline_rule_holds",
      },
      {
        type: "paragraph",
        text: "The business-rule holds that stop this Spec's runs, each with the runs it holds and the one-run overrides already given. RETURNS: { holds[] }. Let one run proceed with talonic_pipeline_override_hold.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/pipelines/{pipeline_id}/rule-holds`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-override-hold",
        text: "talonic_pipeline_override_hold",
      },
      {
        type: "paragraph",
        text: "Let exactly one held run proceed despite a business-rule hold, with a reason kept on the audit trail. The hold stays open, so later runs are still stopped. The run starts when admitted (uses credits). Admin only, as in the web app; call only when the user decides. Take `run_id` and `hold_id` from talonic_pipeline_rule_holds. RETURNS: { admitted, remaining_hold_ids[], enqueued }.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/pipelines/{pipeline_id}/runs/{run_id}/business-rule-holds/{hold_id}/override`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
          {
            name: "run_id",
            type: "UUID",
            required: true,
            description: "The held run.",
          },
          {
            name: "hold_id",
            type: "UUID",
            required: true,
            description: "The hold to override for this run.",
          },
          {
            name: "reason",
            type: "string",
            required: true,
            description: "Why this run may proceed (3 to 2000 characters).",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-reconciliation-cases",
        text: "talonic_pipeline_reconciliation_cases",
      },
      {
        type: "paragraph",
        text: "The reconciliation cases this Spec's business rules raised (a mismatch between documents to look into), with their state. RETURNS: { cases[] }. The full audit export is talonic_pipeline_export_reconciliation_cases.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/pipelines/{pipeline_id}/reconciliation-cases`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-pipeline-export-reconciliation-cases",
        text: "talonic_pipeline_export_reconciliation_cases",
      },
      {
        type: "paragraph",
        text: "The full audit export of a Spec's reconciliation cases: the values each case saw, its evidence, its history and the holds it caused. Needs the export permission, as in the web app. RETURNS: { cases[] }.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/pipelines/{pipeline_id}/reconciliation-cases/export`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pipeline_id",
            type: "UUID",
            required: true,
            description: "The Spec run's pipeline_id, from talonic_run_spec or talonic_get_run.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Add documents, start, then retry the failures",
        code: '// talonic_pipeline_add_documents({ "pipeline_id": "1111…", "document_ids": ["2222…", "3333…"] })\n{ "pipeline_id": "1111…", "run_id": "4444…", "added": 2, "skipped": 0 }\n// talonic_pipeline_start({ "pipeline_id": "1111…" })\n{ "pipeline_id": "1111…", "enqueued": 2, "held_runs": [] }\n// talonic_pipeline_documents({ "pipeline_id": "1111…", "status": ["error"] })\n// talonic_pipeline_retry_errored({ "pipeline_id": "1111…" })',
      },
    ],
    related: [
      {
        label: "Ingest operations",
        slug: "ingest-operations",
      },
      {
        label: "Document organising",
        slug: "document-organising",
      },
      {
        label: "Collections",
        slug: "collections",
      },
    ],
    faq: [
      {
        question: "Does starting a run use credits?",
        answer: "Yes. Processing documents uses credits; rebuilding the review queue does not.",
      },
      {
        question: "What does overriding a hold change?",
        answer:
          "It lets exactly one held run proceed. The hold stays open, so later runs are still stopped.",
      },
    ],
    mentions: ["Spec", "run", "review queue", "business rules"],
  },
  {
    slug: "ingest-operations",
    parentSlug: "operations",
    title: "Ingest operations",
    seoTitle: "Ingest Operations — Talonic MCP Tools for Queue, Duplicates",
    description:
      "MCP tools for document intake in Talonic: the processing queue, duplicate files, uploads skipped as duplicates, and which optional ingest steps run for you.",
    content: [
      {
        type: "paragraph",
        text: "See where the workspace's documents are in processing, which files are identical, which uploads were skipped because an identical document already existed, and process such an upload anyway. Turn the optional ingest steps on or off.",
      },
      {
        type: "paragraph",
        text: "Queue and duplicate reads need `documents:read`; processing a duplicate needs `documents:write` and the ingest permission. The ingest settings need `workspace:read` to read and `workspace:write` plus an Admin to change.",
      },
      {
        type: "paragraph",
        text: "To retry one failed document, re-extract it. Workspace-wide recovery of stuck or failed documents stays with Talonic support.",
      },
      {
        type: "callout",
        variant: "info",
        text: "The queue and duplicate tools are listed when `GET /v1/extract/queue-status` answers; the settings tools when `GET /v1/settings/ingest-stages` answers. The platform checks every call. A 403 names its reason (insufficient_scope, insufficient_role, no_person, person_inactive, workspace_read_only): the key's person must be allowed the same action in the Talonic web app, and an OAuth connection must have granted the scope.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ingest-queue-status",
        text: "talonic_ingest_queue_status",
      },
      {
        type: "paragraph",
        text: "How many of the workspace's documents are in each processing state (queued, extracting, completed, error, …). Workspace totals, as in the web app. USE WHEN: checking whether uploads are still being processed, or how many failed. NOT FOR: one document's state (talonic_get_document).",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/extract/queue-status`.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ingest-duplicates",
        text: "talonic_ingest_duplicates",
      },
      {
        type: "paragraph",
        text: "Groups of identical files in the workspace and how many documents carry a content fingerprint. A group lists only documents the key's person can see and is left out when fewer than two remain. RETURNS: { duplicate_groups, total_duplicate_files, groups[] { count, document_ids[], filenames[] }, … }.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/extract/dedup/stats`.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ingest-skipped-duplicates",
        text: "talonic_ingest_skipped_duplicates",
      },
      {
        type: "paragraph",
        text: "Uploads that were not processed because an identical document already existed, newest first (up to 1000), each naming the existing document. Process one anyway with talonic_ingest_process_duplicate. RETURNS: { entries[] { existing_document_id, filename, … }, total }.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/extract/dedup/audit-log`.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ingest-process-duplicate",
        text: "talonic_ingest_process_duplicate",
      },
      {
        type: "paragraph",
        text: "Create a new document for an upload that was skipped as a duplicate. It reuses the existing document's content and values (the file is not read again). The existing document must be visible to the key's person. Needs the ingest permission. RETURNS: { document { id, filename, status } }.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/extract/dedup/process-anyway`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "existing_document_id",
            type: "UUID",
            required: true,
            description:
              "The document the upload matched (`existing_document_id` from talonic_ingest_skipped_duplicates).",
          },
          {
            name: "filename",
            type: "string",
            required: false,
            description: "Name of the new document; default the existing one's.",
          },
          {
            name: "source_connection_id",
            type: "UUID",
            required: false,
            description: "Source to attach it to; default the existing one's.",
          },
          {
            name: "tags",
            type: "string[]",
            required: false,
            description: "Tags of the new document; default the existing one's.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ingest-settings",
        text: "talonic_ingest_settings",
      },
      {
        type: "paragraph",
        text: "Which optional steps run when documents arrive in this workspace, each on by default: `classification` (document types), `triage` (sensitivity tags), `grounding_gate` (checking low-confidence values against the page), `entity_linking` (links between documents), `delivery` (the `document.extracted` notification to webhooks and destinations) and `registry_binding` (matching values to the workspace's fields).",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/settings/ingest-stages`.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-ingest-update-settings",
        text: "talonic_ingest_update_settings",
      },
      {
        type: "paragraph",
        text: "Turn optional ingest steps on or off; only the steps given change. Applies to documents that arrive from now on. Turning `delivery` off stops `document.extracted` notifications; turning `classification` off leaves new documents without a type. Admin only, as in the web app; call only when the user asks. RETURNS: the settings after the change.",
      },
      {
        type: "paragraph",
        text: "Calls `PATCH /v1/settings/ingest-stages`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "classification",
            type: "boolean",
            required: false,
            description: "Assign document types.",
          },
          {
            name: "triage",
            type: "boolean",
            required: false,
            description: "Tag sensitive content.",
          },
          {
            name: "grounding_gate",
            type: "boolean",
            required: false,
            description: "Check low-confidence values against the page.",
          },
          {
            name: "entity_linking",
            type: "boolean",
            required: false,
            description: "Link related documents.",
          },
          {
            name: "delivery",
            type: "boolean",
            required: false,
            description: "Send the `document.extracted` notification.",
          },
          {
            name: "registry_binding",
            type: "boolean",
            required: false,
            description: "Match values to the workspace's fields.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Process a skipped duplicate anyway",
        code: '// talonic_ingest_skipped_duplicates({})\n{ "entries": [{ "existing_document_id": "2222…", "filename": "invoice (1).pdf" }], "total": 1 }\n// talonic_ingest_process_duplicate({ "existing_document_id": "2222…", "filename": "invoice (1).pdf" })\n{ "document": { "id": "5555…", "filename": "invoice (1).pdf", "status": "completed" } }',
      },
    ],
    related: [
      {
        label: "Spec run operations",
        slug: "pipeline-operations",
      },
      {
        label: "Document organising",
        slug: "document-organising",
      },
      {
        label: "Collections",
        slug: "collections",
      },
    ],
    faq: [
      {
        question: "Is a processed duplicate read again?",
        answer: "No. The new document reuses the existing document's content and values.",
      },
      {
        question: "When do changed ingest settings apply?",
        answer:
          "To documents that arrive from then on. Documents already processed keep their results.",
      },
    ],
    mentions: ["ingest", "duplicates", "processing queue", "settings"],
  },
  {
    slug: "document-organising",
    parentSlug: "operations",
    title: "Document organising",
    seoTitle: "Document Organising — Talonic MCP Tools for Tags and Names",
    description:
      "MCP tools that organise Talonic documents: tags on one or many documents, counts per filter value, readable document names, and batch ids from a CSV file.",
    content: [
      {
        type: "paragraph",
        text: "Tag documents one at a time or up to 1000 at once, count documents per filter value, import source batch ids, and set the workspace's rule for readable document names: draft a rule from plain words, try it on real filenames, save it and apply it to every document.",
      },
      {
        type: "paragraph",
        text: "Reads need `documents:read`. Tag and batch-id writes need `documents:write` and an Admin of a workspace that configures its own processing; the readable-name rule needs `documents:write` and an Admin, as in the web app.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Listed when the connection can read the workspace's tags (`GET /v1/documents/tags` answers). The platform checks every call. A 403 names its reason (insufficient_scope, insufficient_role, no_person, person_inactive, workspace_read_only): the key's person must be allowed the same action in the Talonic web app, and an OAuth connection must have granted the scope.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-documents-tags",
        text: "talonic_documents_tags",
      },
      {
        type: "paragraph",
        text: "Every distinct tag on documents the key's person can see. USE WHEN: before tagging, to reuse an existing tag instead of a near-duplicate; to offer tag filters.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/documents/tags`.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-documents-system-tags",
        text: "talonic_documents_system_tags",
      },
      {
        type: "paragraph",
        text: "Distinct grouping tags Talonic set on visible documents when it unpacked them (the email or archive a document came in). They are read-only labels, kept apart from the tags people set.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/documents/system-tags`.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-documents-facets",
        text: "talonic_documents_facets",
      },
      {
        type: "paragraph",
        text: "How many visible documents have each status, document type, source and tag. USE WHEN: building or explaining filters, or giving a quick overview of the workspace's documents.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/documents/facets`.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-documents-batch-tag",
        text: "talonic_documents_batch_tag",
      },
      {
        type: "paragraph",
        text: "Add, remove or set tags on up to 1000 documents in one call. `mode`: `add` (default) merges, `remove` takes the given tags away, `set` replaces each document's tags with exactly these. All or nothing: one hidden or missing document refuses the whole batch with 404. Tags can control who sees a document, so `remove` and `set` can take access away: call only when the user asked. RETURNS: { updated, mode, tags[], results[] { id, status, tags[] }, audit_event_id }.",
      },
      {
        type: "paragraph",
        text: "Calls `PATCH /v1/documents/batch-tag`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_ids",
            type: "UUID[]",
            required: true,
            description: "Documents to change, 1 to 1000.",
          },
          {
            name: "tags",
            type: "string[]",
            required: true,
            description: "Tags, at most 50, each up to 64 characters.",
          },
          {
            name: "mode",
            type: "add | remove | set",
            required: false,
            description: "add (default), remove, or set.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-documents-set-tags",
        text: "talonic_documents_set_tags",
      },
      {
        type: "paragraph",
        text: "Replace one document's tags with exactly the given list; an empty list clears them. Tags can control who sees a document: call only when the user asked. To add a tag without touching the others, use talonic_documents_batch_tag with mode `add`.",
      },
      {
        type: "paragraph",
        text: "Calls `PATCH /v1/documents/{document_id}/tags`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "UUID",
            required: true,
            description: "The document, from talonic_search or talonic_filter.",
          },
          {
            name: "tags",
            type: "string[]",
            required: true,
            description: "The complete new tag list (at most 50; empty clears).",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-documents-import-batch-ids",
        text: "talonic_documents_import_batch_ids",
      },
      {
        type: "paragraph",
        text: "Set the source batch id of existing documents from a list or a CSV, e.g. to group documents by the delivery or job they came in. Give `rows` ({ document_id, batch_id }) or `csv` text with the columns `document_id,batch_id`. A `document_id` cell may hold the document id, its filename (with or without extension) or its source item id. An existing batch id is overwritten. RETURNS: { updated, not_found[] } (the cells that matched no document).",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/documents/batch-metadata/import`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "rows",
            type: "object[]",
            required: false,
            description: "One entry per document: which document, which batch id.",
          },
          {
            name: "csv",
            type: "string",
            required: false,
            description: "CSV text with a header row naming `document_id` and `batch_id`.",
          },
          {
            name: "filename",
            type: "string",
            required: false,
            description: "Name the upload carries; default batch-metadata.csv.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-documents-display-name-rule",
        text: "talonic_documents_display_name_rule",
      },
      {
        type: "paragraph",
        text: "The workspace's rule for showing documents under a readable name instead of their raw filename: `mode` `off`, `default` (tidy the filename) or `lua` (a script), the script if any, and a sample of current filename → name pairs. Change it with talonic_documents_set_display_name_rule after trying a script with talonic_documents_preview_display_name_rule.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/documents/display-name-rule`.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-documents-set-display-name-rule",
        text: "talonic_documents_set_display_name_rule",
      },
      {
        type: "paragraph",
        text: "Set how documents get their readable name: `off` (show filenames; clears the readable names already stored), `default` (tidy the filename) or `lua` with a `script`. New documents follow the rule; apply it to existing ones with talonic_documents_backfill_display_names. Admin only, as in the web app; call only when the user asks. A `script` reads `record.filename` and calls `record:set('display_name', value)`. Try it first with talonic_documents_preview_display_name_rule.",
      },
      {
        type: "paragraph",
        text: "Calls `PATCH /v1/documents/display-name-rule`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "mode",
            type: "off | default | lua",
            required: true,
            description: "`off`, `default` or `lua`.",
          },
          {
            name: "script",
            type: "string",
            required: false,
            description: "The rule script; required for `lua`, kept as a draft otherwise.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-documents-preview-display-name-rule",
        text: "talonic_documents_preview_display_name_rule",
      },
      {
        type: "paragraph",
        text: "Run a candidate rule script over a random sample of the workspace's real filenames and show the names it would give, without saving anything. Admin only. RETURNS: { rows[] { filename, display_name, no_label }, total, changed, no_label }.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/documents/display-name-rule/preview`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "lua_script",
            type: "string",
            required: true,
            description: "The script to try.",
          },
          {
            name: "sample_size",
            type: "number",
            required: false,
            description: "Filenames to try it on (default 50).",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-documents-generate-display-name-script",
        text: "talonic_documents_generate_display_name_script",
      },
      {
        type: "paragraph",
        text: 'Draft a rule script from a plain-language instruction, e.g. "drop the number in front of the name and the date at the end", using the workspace\'s own filenames as examples. Saves nothing: show the draft to the user, try it with talonic_documents_preview_display_name_rule, then save it with talonic_documents_set_display_name_rule. Admin only. RETURNS: { lua_script, explanation, sample_filenames[] }.',
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/documents/display-name-rule/generate-script`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "instruction",
            type: "string",
            required: true,
            description: "The rule in the user's own words.",
          },
          {
            name: "sample_size",
            type: "number",
            required: false,
            description: "Filenames to draw examples from (default 40).",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-documents-display-name-coverage",
        text: "talonic_documents_display_name_coverage",
      },
      {
        type: "paragraph",
        text: "How many documents carry a readable name, how many differ from their filename, and a sample of documents still shown under their raw filename.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/documents/display-name-rule/coverage`.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-documents-backfill-display-names",
        text: "talonic_documents_backfill_display_names",
      },
      {
        type: "paragraph",
        text: "Apply the current readable-name rule to every existing document, overwriting the readable names they have. Runs in the background. Admin only; call only when the user asks. RETURNS: { scanned, enqueued }.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/documents/display-name-rule/backfill`.",
      },
      {
        type: "code",
        language: "json",
        title: "Draft, try and save a readable-name rule",
        code: '// talonic_documents_generate_display_name_script({ "instruction": "drop the number in front of the name" })\n{ "lua_script": "…", "explanation": "…", "sample_filenames": ["0042_Invoice Acme.pdf"] }\n// talonic_documents_preview_display_name_rule({ "lua_script": "…" })\n{ "rows": [{ "filename": "0042_Invoice Acme.pdf", "display_name": "Invoice Acme", "no_label": false }], "total": 50, "changed": 48, "no_label": 2 }\n// talonic_documents_set_display_name_rule({ "mode": "lua", "script": "…" })\n// talonic_documents_backfill_display_names({})',
      },
    ],
    related: [
      {
        label: "Spec run operations",
        slug: "pipeline-operations",
      },
      {
        label: "Ingest operations",
        slug: "ingest-operations",
      },
      {
        label: "Collections",
        slug: "collections",
      },
    ],
    faq: [
      {
        question: "Is a batch tag change partial when one document is missing?",
        answer: "No. One hidden or missing document refuses the whole batch and nothing changes.",
      },
      {
        question: "Can I upload the batch-id CSV as a file?",
        answer:
          "Pass its text as `csv`, or the pairs as `rows`; the tool sends it as the upload the platform expects.",
      },
    ],
    mentions: ["tags", "document names", "facets", "batch ids"],
  },
  {
    slug: "collections",
    parentSlug: "operations",
    title: "Collections",
    seoTitle: "Collections — Talonic MCP Tools for Grouping Your Documents",
    description:
      "MCP tools for Talonic collections: create named groups of documents, fill them by rule or by hand, and assign them to people or groups, enforced or default.",
    content: [
      {
        type: "paragraph",
        text: "A collection is a named group of documents. Rules fill it with every document of a source, a document type or a case, including documents that arrive later; documents can also be added by hand. A collection can be assigned to people or groups: `enforced` limits what they see to its documents, `default` only preselects it. An account is a collection of kind `account`.",
      },
      {
        type: "paragraph",
        text: "Reads need `documents:read`; every change needs `documents:write` and an Admin, as in the web app. Document lists show only what the key's person can see.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Listed when the connection can read the workspace's collections (`GET /v1/collections` answers). The platform checks every call. A 403 names its reason (insufficient_scope, insufficient_role, no_person, person_inactive, workspace_read_only): the key's person must be allowed the same action in the Talonic web app, and an OAuth connection must have granted the scope.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-list",
        text: "talonic_collections_list",
      },
      {
        type: "paragraph",
        text: "The workspace's collections. `view`: `all` (default) lists every collection with its rule, document and assignment counts; `mine` the collections assigned to the key's person; `counts` the number of visible documents per collection. Start here; use the id with the other talonic_collections_* tools. Accounts are collections with kind `account`.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/collections`, `GET /v1/collections/mine`, `GET /v1/collections/counts`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "view",
            type: "all | mine | counts",
            required: false,
            description: "all (default), mine or counts.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-create",
        text: "talonic_collections_create",
      },
      {
        type: "paragraph",
        text: "Create a collection (or, with kind `account`, an account). It starts empty: fill it with talonic_collections_add_rule or talonic_collections_add_documents. Admin only. 409 when the name is taken.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/collections`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "name",
            type: "string",
            required: true,
            description: "Name, up to 200 characters.",
          },
          {
            name: "description",
            type: "string",
            required: false,
            description: "What the collection holds.",
          },
          {
            name: "kind",
            type: "collection | account",
            required: false,
            description:
              "`account` makes it an account (one company; a document belongs to one account).",
          },
          {
            name: "aliases",
            type: "string[]",
            required: false,
            description: "Other names the account goes by.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-preview",
        text: "talonic_collections_preview",
      },
      {
        type: "paragraph",
        text: "A sample of the documents the collection holds under its current rules and hand-added documents, limited to what the key's person can see. Admin only, as in the web app.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/collections/{collection_id}/preview`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "collection_id",
            type: "UUID",
            required: true,
            description: "The collection, from talonic_collections_list.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-update",
        text: "talonic_collections_update",
      },
      {
        type: "paragraph",
        text: "Rename or describe a collection, or change its kind or aliases. Admin only.",
      },
      {
        type: "paragraph",
        text: "Calls `PATCH /v1/collections/{collection_id}`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "collection_id",
            type: "UUID",
            required: true,
            description: "The collection, from talonic_collections_list.",
          },
          {
            name: "name",
            type: "string",
            required: false,
            description: "Name, up to 200 characters.",
          },
          {
            name: "description",
            type: "string",
            required: false,
            description: "What the collection holds.",
          },
          {
            name: "kind",
            type: "collection | account",
            required: false,
            description:
              "`account` makes it an account (one company; a document belongs to one account).",
          },
          {
            name: "aliases",
            type: "string[]",
            required: false,
            description: "Other names the account goes by.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-delete",
        text: "talonic_collections_delete",
      },
      {
        type: "paragraph",
        text: "Delete a collection with its rules, hand-added documents and assignments. The documents themselves stay. People assigned to it with mode `enforced` lose the view it gave them. Cannot be undone: call only when the user asked to delete this collection by name. Admin only.",
      },
      {
        type: "paragraph",
        text: "Calls `DELETE /v1/collections/{collection_id}`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "collection_id",
            type: "UUID",
            required: true,
            description: "The collection, from talonic_collections_list.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-rules",
        text: "talonic_collections_rules",
      },
      {
        type: "paragraph",
        text: "The rules that fill a collection: each names a `rule_type` and a `rule_value`.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/collections/{collection_id}/rules`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "collection_id",
            type: "UUID",
            required: true,
            description: "The collection, from talonic_collections_list.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-add-rule",
        text: "talonic_collections_add_rule",
      },
      {
        type: "paragraph",
        text: "Add a rule: every document of a source (`source_connection`, value = the source id), a document type (`document_type`, value = the type id) or a case (`case`, value = the case id) joins the collection, including documents that arrive later. Admin only.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/collections/{collection_id}/rules`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "collection_id",
            type: "UUID",
            required: true,
            description: "The collection, from talonic_collections_list.",
          },
          {
            name: "rule_type",
            type: "source_connection | document_type | case",
            required: true,
            description: "What the rule matches: a source, a document type or a case.",
          },
          {
            name: "rule_value",
            type: "string",
            required: true,
            description: "The id of the source, document type or case.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-remove-rule",
        text: "talonic_collections_remove_rule",
      },
      {
        type: "paragraph",
        text: "Remove one rule; the documents it brought in leave the collection unless another rule or a hand-add keeps them. Admin only.",
      },
      {
        type: "paragraph",
        text: "Calls `DELETE /v1/collections/{collection_id}/rules/{rule_id}`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "collection_id",
            type: "UUID",
            required: true,
            description: "The collection, from talonic_collections_list.",
          },
          {
            name: "rule_id",
            type: "UUID",
            required: true,
            description: "The rule, from talonic_collections_rules.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-documents",
        text: "talonic_collections_documents",
      },
      {
        type: "paragraph",
        text: "The documents added to a collection by hand (not those its rules bring in), limited to what the key's person can see. For everything the collection holds, use talonic_collections_preview.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/collections/{collection_id}/documents`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "collection_id",
            type: "UUID",
            required: true,
            description: "The collection, from talonic_collections_list.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-add-documents",
        text: "talonic_collections_add_documents",
      },
      {
        type: "paragraph",
        text: "Add documents to a collection by hand. Every id must be a document the key's person can see (404 otherwise, nothing added). Admin only.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/collections/{collection_id}/documents`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "collection_id",
            type: "UUID",
            required: true,
            description: "The collection, from talonic_collections_list.",
          },
          {
            name: "document_ids",
            type: "UUID[]",
            required: true,
            description: "Documents to add.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-remove-document",
        text: "talonic_collections_remove_document",
      },
      {
        type: "paragraph",
        text: "Take one hand-added document out of a collection. A rule of the collection may still include it. Admin only.",
      },
      {
        type: "paragraph",
        text: "Calls `DELETE /v1/collections/{collection_id}/documents/{document_id}`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "collection_id",
            type: "UUID",
            required: true,
            description: "The collection, from talonic_collections_list.",
          },
          {
            name: "document_id",
            type: "UUID",
            required: true,
            description: "The document, from talonic_collections_documents.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-assignments",
        text: "talonic_collections_assignments",
      },
      {
        type: "paragraph",
        text: "The people and groups a collection is assigned to, each with its mode (`enforced` or `default`).",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/collections/{collection_id}/assignments`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "collection_id",
            type: "UUID",
            required: true,
            description: "The collection, from talonic_collections_list.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-assign",
        text: "talonic_collections_assign",
      },
      {
        type: "paragraph",
        text: "Assign a collection to a person (`user`) or a `group`. Mode `enforced` limits what they see to the collection's documents; `default` only preselects it for them. `enforced` changes what someone can see: call only when the user asked. Admin only.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/collections/{collection_id}/assignments`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "collection_id",
            type: "UUID",
            required: true,
            description: "The collection, from talonic_collections_list.",
          },
          {
            name: "principal_type",
            type: "user | group",
            required: true,
            description: "A person or a group.",
          },
          {
            name: "principal_id",
            type: "UUID",
            required: true,
            description: "The person's user id or the group id.",
          },
          {
            name: "mode",
            type: "enforced | default",
            required: true,
            description: "enforced: they see only the collection; default: preselected for them.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-collections-unassign",
        text: "talonic_collections_unassign",
      },
      {
        type: "paragraph",
        text: "Remove one assignment. A person who was limited to the collection (mode `enforced`) sees their usual documents again. Admin only.",
      },
      {
        type: "paragraph",
        text: "Calls `DELETE /v1/collections/{collection_id}/assignments/{assignment_id}`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "collection_id",
            type: "UUID",
            required: true,
            description: "The collection, from talonic_collections_list.",
          },
          {
            name: "assignment_id",
            type: "UUID",
            required: true,
            description: "The assignment, from talonic_collections_assignments.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "A collection of one supplier's documents",
        code: '// talonic_collections_create({ "name": "Acme", "kind": "account" })\n{ "id": "6666…", "name": "Acme", "kind": "account" }\n// talonic_collections_add_rule({ "collection_id": "6666…", "rule_type": "source_connection", "rule_value": "7777…" })\n// talonic_collections_preview({ "collection_id": "6666…" })',
      },
    ],
    related: [
      {
        label: "Spec run operations",
        slug: "pipeline-operations",
      },
      {
        label: "Ingest operations",
        slug: "ingest-operations",
      },
      {
        label: "Document organising",
        slug: "document-organising",
      },
    ],
    faq: [
      {
        question: "Does deleting a collection delete its documents?",
        answer:
          "No. The documents stay; the collection's rules, hand-added list and assignments go.",
      },
      {
        question: "What does an enforced assignment do?",
        answer: "It limits what the assigned person or group sees to the collection's documents.",
      },
    ],
    mentions: ["collections", "accounts", "assignments", "rules"],
  },
  {
    slug: "saved-filters",
    parentSlug: "operations",
    title: "Saved filters",
    seoTitle: "Saved Filters — Talonic MCP Tools for Filter Presets Today",
    description:
      "MCP tools for saved filters in Talonic: list the workspace's filter presets, save a preset for yourself, and delete your own, as in the web app filter picker.",
    content: [
      {
        type: "paragraph",
        text: "Saved filters are the presets of the web app's filter picker. List the workspace's presets, save one for the key's person (it appears in their picker), and delete one of their own. Run a preset's conditions with `talonic_filter`.",
      },
      {
        type: "paragraph",
        text: "All three need only `documents:read`: any member may keep their own presets, and a preset changes no document.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Listed when the connection can read saved filters (`GET /v1/search/saved-filters` answers). The platform checks every call. A 403 names its reason (insufficient_scope, insufficient_role, no_person, person_inactive, workspace_read_only): the key's person must be allowed the same action in the Talonic web app, and an OAuth connection must have granted the scope.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-saved-filters-list",
        text: "talonic_saved_filters_list",
      },
      {
        type: "paragraph",
        text: "The workspace's saved filter presets, newest first: name, conditions, search text, sort and source. Narrow to one source with `source_id`. Run a preset's conditions with talonic_filter.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/search/saved-filters`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "source_id",
            type: "UUID",
            required: false,
            description: "Only presets of this source.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-saved-filters-create",
        text: "talonic_saved_filters_create",
      },
      {
        type: "paragraph",
        text: "Save a filter preset for the key's person, so it appears in their filter picker in the web app. `conditions` take the same shape as talonic_filter's conditions. RETURNS: { id, name, conditions, search, sort, source_connection_id, created_at, updated_at }.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/search/saved-filters`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "name",
            type: "string",
            required: true,
            description: "Name in the picker.",
          },
          {
            name: "conditions",
            type: "object[]",
            required: false,
            description: "Filter conditions, as talonic_filter takes them.",
          },
          {
            name: "search",
            type: "string",
            required: false,
            description: "Free-text search kept with the filter.",
          },
          {
            name: "sort",
            type: "object",
            required: false,
            description: "Sort kept with the filter.",
          },
          {
            name: "source_connection_id",
            type: "UUID",
            required: false,
            description: "Narrow the filter to one source.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-saved-filters-delete",
        text: "talonic_saved_filters_delete",
      },
      {
        type: "paragraph",
        text: "Delete one of the key's person's own saved filters (404 for anyone else's). Cannot be undone.",
      },
      {
        type: "paragraph",
        text: "Calls `DELETE /v1/search/saved-filters/{filter_id}`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "filter_id",
            type: "UUID",
            required: true,
            description: "The preset, from talonic_saved_filters_list.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Save a filter",
        code: '// talonic_saved_filters_create({ "name": "Open invoices", "conditions": [{ "field": "status", "operator": "eq", "value": "open" }] })\n{ "id": "8888…", "name": "Open invoices", "conditions": [ … ], "search": null, "sort": null }',
      },
    ],
    related: [
      {
        label: "Spec run operations",
        slug: "pipeline-operations",
      },
      {
        label: "Ingest operations",
        slug: "ingest-operations",
      },
      {
        label: "Document organising",
        slug: "document-organising",
      },
    ],
    faq: [
      {
        question: "Can I delete someone else's saved filter?",
        answer: "No. Only your own; anyone else's answers 404.",
      },
    ],
    mentions: ["saved filters", "filter presets"],
  },
  {
    slug: "document-types",
    parentSlug: "operations",
    title: "Document types",
    seoTitle: "Document Types — Talonic MCP Tools for Types and Proposals",
    description:
      "MCP tools for Talonic document types: list, create and rename types, and decide the types proposed for new documents: create, merge, settle all, or dismiss.",
    content: [
      {
        type: "paragraph",
        text: "List, create and rename the workspace's document types. When new documents do not fit an existing type, Talonic proposes one and waits for a decision: create it, merge it into an existing type, merge several proposals into one, settle all of them automatically, or dismiss one.",
      },
      {
        type: "paragraph",
        text: "Reads need `documents:read`; every change needs `documents:write` and an Admin of a workspace that configures its own processing, as in the web app.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Listed when the connection can read the waiting proposals (`GET /v1/document-types/pending-confirmations/count` answers). The platform checks every call. A 403 names its reason (insufficient_scope, insufficient_role, no_person, person_inactive, workspace_read_only): the key's person must be allowed the same action in the Talonic web app, and an OAuth connection must have granted the scope.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-document-types-list",
        text: "talonic_document_types_list",
      },
      {
        type: "paragraph",
        text: "The workspace's document types with how many documents each has, most used first. USE WHEN: finding a type id for talonic_document_types_resolve_pending, talonic_document_types_update or a collection rule.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/document-types`.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-document-types-create",
        text: "talonic_document_types_create",
      },
      {
        type: "paragraph",
        text: "Create a document type for the workspace. RETURNS: { id, name, document_count, … }.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/document-types`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "name",
            type: "string",
            required: true,
            description: "The type's name.",
          },
          {
            name: "description",
            type: "string",
            required: false,
            description: "What documents of this type are.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-document-types-update",
        text: "talonic_document_types_update",
      },
      {
        type: "paragraph",
        text: "Rename a document type or change its description.",
      },
      {
        type: "paragraph",
        text: "Calls `PATCH /v1/document-types/{type_id}`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "type_id",
            type: "UUID",
            required: true,
            description: "The type, from talonic_document_types_list.",
          },
          {
            name: "name",
            type: "string",
            required: false,
            description: "The new name.",
          },
          {
            name: "description",
            type: "string",
            required: false,
            description: "The new description.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-document-types-pending",
        text: "talonic_document_types_pending",
      },
      {
        type: "paragraph",
        text: "Document types proposed while new documents were sorted, waiting for a decision, with suggestions: create as is, merge similar proposals together, or merge into a close existing type. With `count_only: true`, only how many wait. Decide with talonic_document_types_resolve_pending, _resolve_pending_batch, _merge_pending, _auto_resolve or _dismiss_pending.",
      },
      {
        type: "paragraph",
        text: "Calls `GET /v1/document-types/pending-confirmations`, `GET /v1/document-types/pending-confirmations/count`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "count_only",
            type: "boolean",
            required: false,
            description: "true: answer only { count }.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-document-types-resolve-pending",
        text: "talonic_document_types_resolve_pending",
      },
      {
        type: "paragraph",
        text: "Settle one proposal: `create` makes the proposed type, `merge` folds it into `merge_into_type_id`. Its documents move with it.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/document-types/pending-confirmations/{proposal_id}/resolve`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "proposal_id",
            type: "UUID",
            required: true,
            description: "The proposal, from talonic_document_types_pending.",
          },
          {
            name: "action",
            type: "create | merge",
            required: true,
            description: "create the proposed type, or merge it into an existing one.",
          },
          {
            name: "merge_into_type_id",
            type: "UUID",
            required: false,
            description: "With merge: the existing type.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-document-types-resolve-pending-batch",
        text: "talonic_document_types_resolve_pending_batch",
      },
      {
        type: "paragraph",
        text: "Settle up to 200 proposals in one call, each with `create` or `merge`. Answers a result per item.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/document-types/pending-confirmations/resolve-batch`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "items",
            type: "object[]",
            required: true,
            description: "One decision per proposal, 1 to 200.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-document-types-merge-pending",
        text: "talonic_document_types_merge_pending",
      },
      {
        type: "paragraph",
        text: "Merge several proposals into one new type named `chosen_name`; their documents move to it.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/document-types/pending-confirmations/merge-pending`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "pending_ids",
            type: "UUID[]",
            required: true,
            description: "The proposals to merge.",
          },
          {
            name: "chosen_name",
            type: "string",
            required: true,
            description: "The new type's name.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-document-types-auto-resolve",
        text: "talonic_document_types_auto_resolve",
      },
      {
        type: "paragraph",
        text: "Settle every waiting proposal automatically: each is matched to Talonic's standard type list and merged where a matching type exists; the rest are created. Call only when the user wants all of them settled without reviewing each.",
      },
      {
        type: "paragraph",
        text: "Calls `POST /v1/document-types/pending-confirmations/auto-resolve`.",
      },
      {
        type: "heading",
        level: 3,
        id: "talonic-document-types-dismiss-pending",
        text: "talonic_document_types_dismiss_pending",
      },
      {
        type: "paragraph",
        text: "Dismiss one proposal without creating a type.",
      },
      {
        type: "paragraph",
        text: "Calls `DELETE /v1/document-types/pending-confirmations/{proposal_id}`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "proposal_id",
            type: "UUID",
            required: true,
            description: "The proposal, from talonic_document_types_pending.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Merge a proposal into an existing type",
        code: '// talonic_document_types_pending({})\n// talonic_document_types_resolve_pending({ "proposal_id": "7777…", "action": "merge", "merge_into_type_id": "8888…" })',
      },
    ],
    related: [
      {
        label: "Spec run operations",
        slug: "pipeline-operations",
      },
      {
        label: "Ingest operations",
        slug: "ingest-operations",
      },
      {
        label: "Document organising",
        slug: "document-organising",
      },
    ],
    faq: [
      {
        question: "What happens to the documents of a merged proposal?",
        answer: "They move to the type it was merged into.",
      },
    ],
    mentions: ["document types", "classification", "proposals"],
  },
]
