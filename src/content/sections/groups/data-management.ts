import type { RawSection } from "../../types"

const pageArgs = [
  { name: "limit", type: "integer", description: "Items per page, 1-100. Default 20." },
  { name: "cursor", type: "string", description: "`pagination.next_cursor` of the previous page." },
  {
    name: "order",
    type: "asc | desc",
    description: "By creation time. Default desc (newest first).",
  },
  { name: "after", type: "ISO-8601", description: "Only items created after this time." },
  { name: "before", type: "ISO-8601", description: "Only items created before this time." },
]

export const section: RawSection = {
  slug: "data-management-tools",
  parentSlug: "tool-groups",
  title: "Documents, extractions, jobs and schemas",
  seoTitle: "Manage Documents, Extractions, Jobs and Schemas via MCP",
  description:
    "MCP tools to list, re-extract and delete Talonic documents, read and correct extracted values, run and cancel jobs over many documents, and edit saved schemas.",
  content: [
    {
      type: "paragraph",
      text: "These tools cover the day-to-day housekeeping of a workspace: listing documents, reading a document again, correcting values, running one saved schema over many documents as a job, and changing or removing saved schemas. Every call runs as the person behind the connection: a document that person cannot see answers 404, exactly like a missing one.",
    },
    {
      type: "callout",
      variant: "warning",
      text: "The tools are listed when the connection can read the workspace's documents; changes need the `write` scope. `talonic_delete_document` and `talonic_delete_schema` cannot be undone, and `talonic_update_schema` with a new field list removes every field you do not send again. Agents confirm with the user before calling them. Re-extracting a document and creating a job consume credits and are not deduplicated: after a timeout, check the first call's result before calling again.",
    },
    { type: "heading", level: 3, id: "talonic-list-documents", text: "talonic_list_documents" },
    {
      type: "paragraph",
      text: "List documents, newest first, one page at a time. Returns `data[]` (id, filename, pages, status, source, field count, created_at) and `pagination { total, limit, has_more, next_cursor }`.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "status",
          type: "string",
          description: "Only documents with this status, e.g. `error`.",
        },
        { name: "source_id", type: "UUID", description: "Only documents from this source." },
        {
          name: "source_type",
          type: "string",
          description: "Only documents from this kind of source.",
        },
        { name: "search", type: "string", description: "Filename contains (case-insensitive)." },
        {
          name: "parent_id",
          type: "UUID",
          description:
            "Only documents unpacked from this one (email attachments, archive members).",
        },
        { name: "relation", type: "string", description: "Only nested documents of this kind." },
        { name: "top_level", type: "boolean", description: "`true` hides nested documents." },
        {
          name: "text_degraded",
          type: "boolean",
          description: "`true`: only documents whose text could not be read verbatim.",
        },
        ...pageArgs,
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-reextract-document",
      text: "talonic_reextract_document",
    },
    {
      type: "paragraph",
      text: "Read an existing document again and capture its values afresh, without uploading it again. Consumes credits like a new extraction. Answers at once with `status: processing`; poll `talonic_get_document` until it is `completed`.",
    },
    {
      type: "param-table",
      params: [{ name: "document_id", type: "UUID", required: true, description: "The document." }],
    },
    { type: "heading", level: 3, id: "talonic-delete-document", text: "talonic_delete_document" },
    {
      type: "paragraph",
      text: "Delete one document with its captured values. Cannot be undone. Documents only shared with the user are read-only and answer 404. Returns `{ deleted: true, id }`.",
    },
    {
      type: "param-table",
      params: [{ name: "document_id", type: "UUID", required: true, description: "The document." }],
    },
    { type: "heading", level: 3, id: "talonic-list-extractions", text: "talonic_list_extractions" },
    {
      type: "paragraph",
      text: "List extractions, one per document with captured values, newest first. An extraction's id is its document's id.",
    },
    {
      type: "param-table",
      params: [
        { name: "document_id", type: "UUID", description: "Only this document's extraction." },
        { name: "status", type: "complete | failed", description: "Only finished or failed ones." },
        ...pageArgs,
      ],
    },
    { type: "heading", level: 3, id: "talonic-get-extraction", text: "talonic_get_extraction" },
    {
      type: "paragraph",
      text: "One extraction in full: every field with its value, type and confidence.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "extraction_id",
          type: "UUID",
          required: true,
          description: "The extraction (document) id.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-get-extraction-data",
      text: "talonic_get_extraction_data",
    },
    {
      type: "paragraph",
      text: "One extraction's values as a flat field → value map, or as a one-row CSV (`{ format: 'csv', csv }`).",
    },
    {
      type: "param-table",
      params: [
        {
          name: "extraction_id",
          type: "UUID",
          required: true,
          description: "The extraction (document) id.",
        },
        { name: "format", type: "json | csv", description: "Default json." },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-correct-extraction",
      text: "talonic_correct_extraction",
    },
    {
      type: "paragraph",
      text: "Correct captured values. Each correction is kept as a new version of the value, attributed to the connection. A value a reviewer confirmed, or one waiting for approval, is not overwritten: it is reported in `cells_skipped`. Returns the extraction with `cells_written` and `cells_skipped`.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "extraction_id",
          type: "UUID",
          required: true,
          description: "The extraction (document) id.",
        },
        {
          name: "values",
          type: "object",
          required: true,
          description: "`{ <field_name>: corrected value }` for the fields to change.",
        },
      ],
    },
    { type: "heading", level: 3, id: "talonic-list-jobs", text: "talonic_list_jobs" },
    {
      type: "paragraph",
      text: "List jobs (one saved schema run over a set of documents), newest first.",
    },
    {
      type: "param-table",
      params: [
        { name: "status", type: "string", description: "Only jobs with this status." },
        ...pageArgs,
      ],
    },
    { type: "heading", level: 3, id: "talonic-get-job", text: "talonic_get_job" },
    {
      type: "paragraph",
      text: "One job's status, schema, document count, timestamps and error. Poll it after `talonic_create_job`.",
    },
    {
      type: "param-table",
      params: [{ name: "job_id", type: "UUID", required: true, description: "The job." }],
    },
    { type: "heading", level: 3, id: "talonic-get-job-results", text: "talonic_get_job_results" },
    {
      type: "paragraph",
      text: "A job's result rows: one per document with its values, confidence and validation flags. Readable while the job still runs.",
    },
    {
      type: "param-table",
      params: [{ name: "job_id", type: "UUID", required: true, description: "The job." }],
    },
    { type: "heading", level: 3, id: "talonic-create-job", text: "talonic_create_job" },
    {
      type: "paragraph",
      text: "Run a saved schema over many documents and collect one row of values per document. Consumes credits per document. Name the documents, or pass `all_documents: true` for every completed document of the workspace. Returns the job id; poll `talonic_get_job`.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "schema_id",
          type: "UUID",
          required: true,
          description: "The saved schema to run.",
        },
        { name: "document_ids", type: "UUID[]", description: "The documents to process." },
        {
          name: "all_documents",
          type: "boolean",
          description: "`true`: every completed document, instead of `document_ids`.",
        },
        { name: "name", type: "string", description: "A name for the job, up to 200 characters." },
      ],
    },
    { type: "heading", level: 3, id: "talonic-cancel-job", text: "talonic_cancel_job" },
    {
      type: "paragraph",
      text: "Cancel a pending or running job; rows already produced stay. Safe to retry: a job that already ended answers 409 and is left as it is.",
    },
    {
      type: "param-table",
      params: [{ name: "job_id", type: "UUID", required: true, description: "The job." }],
    },
    { type: "heading", level: 3, id: "talonic-update-schema", text: "talonic_update_schema" },
    {
      type: "paragraph",
      text: "Rename a saved schema, change its description, or replace its field list. A new `definition` or `fields` list replaces every field, so read the schema first with `talonic_get_schema` and send the whole list. A schema managed by a Spec answers 409; change the Spec in the app instead.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "schema_id",
          type: "string",
          required: true,
          description: "UUID or SCH-XXXXXXXX short id.",
        },
        { name: "name", type: "string", description: "New name, up to 100 characters." },
        {
          name: "description",
          type: "string | null",
          description: "New description; null clears it.",
        },
        {
          name: "definition",
          type: "object",
          description: "The full field list as JSON Schema: `{ properties, required }`.",
        },
        {
          name: "fields",
          type: "object[]",
          description:
            "The full field list as rows: `field_name`, `display_name`, `data_type`, `description`, `is_required`.",
        },
      ],
    },
    { type: "heading", level: 3, id: "talonic-delete-schema", text: "talonic_delete_schema" },
    {
      type: "paragraph",
      text: "Delete a saved schema. Cannot be undone; documents already extracted with it keep their values. A schema managed by a Spec answers 409.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "schema_id",
          type: "string",
          required: true,
          description: "UUID or SCH-XXXXXXXX short id.",
        },
      ],
    },
  ],
  related: [],
  faq: [],
  mentions: [],
}
