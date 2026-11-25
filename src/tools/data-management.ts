import { z } from "zod"
import { apiJson, buildUrl, resolveFetch, runTool } from "./_http.js"
import { apiHttpError, zUuid, validationError, type ToolResult } from "./_shared.js"
import {
  READ,
  buildRequest,
  describe,
  runGroupTool,
  write,
  type GroupTool,
  type ToolGroup,
} from "./_groups.js"

/**
 * Documents, extractions, jobs and schemas: the `/v1` routes the Node SDK
 * already wraps that had no MCP tool (list / re-extract / delete documents,
 * read and correct extractions, list / create / cancel jobs and read their
 * rows, replace / delete a schema). Reads need the `read` scope, writes
 * `write`; every route evaluates the key's person's document visibility, so
 * a document that person cannot see answers 404 exactly like a missing one.
 *
 * None of these routes honours an `Idempotency-Key` header, so the
 * non-idempotent writes (re-extract, create job) say so: a retry after a
 * timeout must first check whether the first call landed.
 */

const cursorArgs = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Items per page (1-100, default 20)."),
  cursor: z.string().max(512).optional().describe("pagination.next_cursor of the previous page."),
  order: z
    .enum(["asc", "desc"])
    .optional()
    .describe("By creation time; default desc (newest first)."),
  after: z.string().optional().describe("Only items created after this ISO-8601 timestamp."),
  before: z.string().optional().describe("Only items created before this ISO-8601 timestamp."),
}
const PAGE_QUERY = ["limit", "cursor", "order", "after", "before"] as const
const PAGE_RETURNS = "pagination { total, limit, has_more, next_cursor }"

const LIST_DOCUMENTS = describe({
  what: "List the workspace's documents, newest first, one page at a time, with filters. Only documents this connection may see are listed.",
  use: "browsing or counting documents by status, source, upload time or filename (e.g. 'which uploads failed today', 'the attachments of this email').",
  not: "finding documents by their content or a field value (talonic_search, talonic_filter); one document's details (talonic_get_document).",
  args: "`status` (e.g. completed, error, extracting), `source_id`, `source_type`, `search` (filename contains), `parent_id` (documents unpacked from one container: email attachments, archive members, packet parts), `relation` (why a document is nested, e.g. email_attachment), `top_level` (true: hide nested documents), `text_degraded` (true: only documents whose text could not be read verbatim), `after` / `before` (ISO-8601 creation time), `limit` 1-100 (default 20), `cursor`, `order` asc|desc.",
  returns: `{ data[] { id, filename, pages, size_bytes, mime_type, type_detected, status, error?, source { id, type }, parent?, field_count, created_at, links }, ${PAGE_RETURNS} }.`,
})

const REEXTRACT = describe({
  what: "Read an existing document again and capture its values afresh, without uploading it again. Consumes credits like a new extraction. Answers at once with status processing; the document's earlier values are replaced when it finishes.",
  use: "the user asks to redo a document after its schema or setup changed, or a document came out wrong.",
  not: "extracting with a different schema now and returning the values (talonic_extract with document_id); a document that is still processing (wait, poll talonic_get_document).",
  args: "`document_id` (UUID).",
  returns:
    "{ id, status: 'processing', message, links }. Poll talonic_get_document until status is completed (or a failure status). Not idempotent and not deduplicated: on a timeout, check the document's status before calling again.",
  errors: "402 out of credits; 404 the document does not exist or this connection may not see it.",
})

const DELETE_DOCUMENT = describe({
  what: "Delete one document from the workspace together with its captured values. Cannot be undone.",
  use: "the user explicitly asks to remove a specific document (a duplicate, a wrong upload, data that must go). Confirm the filename with the user before calling.",
  not: "hiding a document from a list or retagging it; deleting many documents at once without the user naming them.",
  args: "`document_id` (UUID).",
  returns: "{ deleted: true, id }.",
  errors:
    "404 the document does not exist, this connection may not see it, or it was only shared with the user (shared documents are read-only).",
})

const LIST_EXTRACTIONS = describe({
  what: "List extractions (one per document that has captured values), newest first, one page at a time.",
  use: "finding the documents with completed or failed captures in a time range, or the extraction of one document.",
  not: "the values of one extraction (talonic_get_extraction_data); searching by value (talonic_filter).",
  args: "`document_id` (UUID), `status` complete|failed, `after` / `before` (ISO-8601), `limit` 1-100, `cursor`, `order`.",
  returns: `{ data[] { id, document_id, status, field_count, created_at, links }, ${PAGE_RETURNS} }. An extraction's id equals its document's id.`,
})

const GET_EXTRACTION = describe({
  what: "One extraction in full: its fields with values, types and confidence, and the document it belongs to.",
  use: "inspecting how a document's values were captured before correcting them.",
  not: "just the field → value map (talonic_get_extraction_data).",
  args: "`extraction_id` (UUID; the document id).",
  returns: "The extraction with its fields, confidence and links.",
})

const GET_EXTRACTION_DATA = describe({
  what: "One extraction's values as a flat field → value map (JSON), or as a one-row CSV.",
  use: "handing a document's captured values to another system or comparing them with a source.",
  not: "confidence and field metadata (talonic_get_extraction); values across many documents (talonic_field_values).",
  args: "`extraction_id` (UUID; the document id), `format` json|csv (default json).",
  returns: "JSON: { <field>: value }. CSV: { format: 'csv', csv } (header row plus one value row).",
})

const CORRECT_EXTRACTION = describe({
  what: "Correct captured values of one extraction. Each correction is stored as a new version of the value, attributed to this connection; a value that a reviewer confirmed or that waits for approval is NOT overwritten and is reported in cells_skipped.",
  use: "the user tells you a captured value is wrong and gives the right one.",
  not: "changing which fields a schema has (talonic_update_schema); re-reading the whole document (talonic_reextract_document).",
  args: "`extraction_id` (UUID; the document id), `values` { <field_name>: corrected value } (only the fields to change).",
  returns:
    "The extraction, plus cells_written[] and cells_skipped[] (the corrections that were withheld, with why).",
  errors:
    "400 `values` is not an object; 403 a workspace-wide (master view) credential; 404 unknown or not visible.",
})

const LIST_JOBS = describe({
  what: "List jobs (a schema run over a set of documents), newest first, one page at a time.",
  use: "checking what jobs exist, which are still running, or finding a job id.",
  not: "Spec runs (talonic_get_run); one job (talonic_get_job).",
  args: "`status` (e.g. pending, processing, completed, failed), `after` / `before` (ISO-8601), `limit` 1-100, `cursor`, `order`.",
  returns: `{ data[] { id, name, status, schema, document_count, created_at, completed_at, links }, ${PAGE_RETURNS} }.`,
})

const GET_JOB = describe({
  what: "One job: status, progress, schema, timestamps, error if it failed.",
  use: "polling a job created with talonic_create_job until it completes.",
  not: "the job's extracted rows (talonic_get_job_results).",
  args: "`job_id` (UUID).",
  returns: "{ id, name, status, schema, document_count, created_at, completed_at, error?, links }.",
})

const GET_JOB_RESULTS = describe({
  what: "A job's result rows: one row per document with the extracted values, row confidence and validation flags. Readable while the job still runs (rows appear as documents finish). Only documents this connection may see are included.",
  use: "reading what a job extracted, e.g. to build a table or check a few values.",
  not: "one document's values (talonic_get_extraction_data).",
  args: "`job_id` (UUID).",
  returns:
    "{ job_id, job_status, schema { id, name }, total_rows, data[] { id, document_id, filename, status, values, confidence, validation_flags } }.",
})

const CREATE_JOB = describe({
  what: "Create and queue a job: run a saved schema over a set of documents and collect one row of values per document. Consumes credits per document processed.",
  use: "the user wants the same fields pulled from many existing documents into one table.",
  not: "one document (talonic_extract with document_id); running a configured Spec (talonic_run_spec).",
  args: "`schema_id` (UUID of a saved schema), `document_ids` (UUIDs) OR `all_documents: true` (every completed document of the workspace; confirm with the user and check the cost first, talonic_get_pricing), `name` (optional, at most 200 characters).",
  returns:
    "{ id, status: 'pending', message, links { self, results } }. Poll talonic_get_job; read rows with talonic_get_job_results. Not deduplicated: after a timeout, look for the job with talonic_list_jobs before creating another.",
  errors: "400 no completed documents; 402 out of credits; 404 unknown schema.",
})

const CANCEL_JOB = describe({
  what: "Cancel a pending or running job. Documents already processed keep their rows; the job ends as failed with the error 'Cancelled via API'.",
  use: "the user wants to stop a job (wrong schema, wrong documents, too expensive).",
  args: "`job_id` (UUID).",
  returns:
    "The job with status failed. Safe to retry: a job that already ended (completed, failed or cancelled) answers 409 and is left unchanged.",
  errors: "404 unknown job; 409 the job already ended.",
})

const UPDATE_SCHEMA = describe({
  what: "Change a saved schema: rename it, change its description, or REPLACE its field list. Sending `definition` or `fields` replaces every field: fields not resent are removed, so read it first (talonic_get_schema), change it, and send the whole list. Confirm removed fields with the user.",
  use: "the user wants to add, remove or retype fields of a saved schema, or rename it.",
  not: "creating a schema (talonic_save_schema); a schema managed by a Spec (refused with 409; change the Spec in the app instead).",
  args: "`schema_id` (UUID or SCH-… short id), `name` (at most 100 characters), `description` (null clears it), `definition` (JSON Schema: { properties { <field>: { type, description?, title? } }, required[] }) OR `fields[]` { field_name, display_name?, data_type?, description?, is_required? }.",
  returns: "The schema with its fields as a JSON Schema definition.",
  errors: "404 unknown schema; 409 the schema is managed by a Spec.",
})

const DELETE_SCHEMA = describe({
  what: "Delete a saved schema. Cannot be undone. Documents already extracted with it keep their values.",
  use: "the user explicitly asks to remove a specific schema. Confirm the schema's name with the user before calling.",
  not: "a schema managed by a Spec (refused with 409).",
  args: "`schema_id` (UUID or SCH-… short id).",
  returns: "{ deleted: true, id }.",
  errors: "404 unknown schema; 409 the schema is managed by a Spec.",
})

const documentId = { document_id: zUuid().describe("The document id.") }
const extractionId = {
  extraction_id: zUuid().describe("The extraction id (the same as its document's id)."),
}
const jobId = { job_id: zUuid().describe("The job id.") }
const schemaId = {
  schema_id: z.string().min(1).max(64).describe("The schema's UUID or SCH-XXXXXXXX short id."),
}

const schemaFieldSchema = z.object({
  field_name: z.string().min(1).describe("Machine name of the field."),
  display_name: z.string().optional(),
  data_type: z.string().optional().describe("string (default), number, boolean, date, …"),
  description: z.string().optional(),
  is_required: z.boolean().optional(),
})

const getExtractionData: GroupTool = {
  name: "talonic_get_extraction_data",
  title: "One extraction's values",
  description: GET_EXTRACTION_DATA,
  route: "GET /v1/extractions/{extractionId}/data",
  inputSchema: {
    ...extractionId,
    format: z.enum(["json", "csv"]).optional().describe("json (default) or csv."),
  },
  annotations: READ,
  handler: async (ctx, args): Promise<ToolResult> => {
    const id = args["extraction_id"]
    if (args["format"] !== "csv") {
      return runGroupTool({ ...getExtractionData, handler: undefined }, ctx, args)
    }
    return runTool(async () => {
      const url = buildUrl(ctx.baseUrl, `/v1/extractions/${encodeURIComponent(String(id))}/data`, {
        format: "csv",
      })
      const res = await resolveFetch(ctx.getToken)(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${ctx.getToken()}`, Accept: "text/csv" },
      })
      if (!res.ok) throw await apiHttpError(res)
      return { format: "csv", csv: await res.text() }
    })
  },
}

const createJob: GroupTool = {
  name: "talonic_create_job",
  title: "Create a job over documents",
  description: CREATE_JOB,
  route: "POST /v1/jobs",
  inputSchema: {
    schema_id: zUuid().describe("UUID of the saved schema to run."),
    document_ids: z
      .array(zUuid())
      .min(1)
      .max(10_000)
      .optional()
      .describe("The documents to process."),
    all_documents: z
      .boolean()
      .optional()
      .describe("true: every completed document of the workspace (instead of document_ids)."),
    name: z.string().max(200).optional().describe("A name for the job."),
  },
  annotations: write(false),
  body: ["schema_id", "document_ids", "name"],
  handler: (ctx, args) => {
    const ids = args["document_ids"] as unknown[] | undefined
    const all = args["all_documents"] === true
    if (ids?.length && all) {
      return Promise.resolve(
        validationError("pass `document_ids` or `all_documents: true`, not both."),
      )
    }
    if (!ids?.length && !all) {
      return Promise.resolve(
        validationError(
          "name the documents (`document_ids`) or pass `all_documents: true` to run over every completed document.",
        ),
      )
    }
    return runGroupTool({ ...createJob, handler: undefined }, ctx, args)
  },
}

export const dataManagementGroup: ToolGroup = {
  key: "data_management",
  label: "Documents, extractions, jobs and schemas",
  docsSlug: "data-management-tools",
  probe: { path: "/v1/documents", params: { limit: 1 } },
  tools: [
    {
      name: "talonic_list_documents",
      title: "List documents",
      description: LIST_DOCUMENTS,
      route: "GET /v1/documents",
      inputSchema: {
        status: z.string().max(32).optional().describe("Only documents with this status."),
        source_id: zUuid().optional().describe("Only documents from this source."),
        source_type: z
          .string()
          .max(64)
          .optional()
          .describe("Only documents from this kind of source."),
        search: z.string().max(200).optional().describe("Filename contains (case-insensitive)."),
        parent_id: zUuid()
          .optional()
          .describe("Only documents unpacked from this container document."),
        relation: z
          .string()
          .max(32)
          .optional()
          .describe("Only nested documents of this kind, e.g. email_attachment."),
        top_level: z.boolean().optional().describe("true: hide documents nested in another."),
        text_degraded: z
          .boolean()
          .optional()
          .describe(
            "true: only documents whose text was not read verbatim; false: only those that were.",
          ),
        ...cursorArgs,
      },
      annotations: READ,
      query: [
        "status",
        "source_id",
        "source_type",
        "search",
        "parent_id",
        "relation",
        "top_level",
        "text_degraded",
        ...PAGE_QUERY,
      ],
    },
    {
      name: "talonic_reextract_document",
      title: "Re-extract a document",
      description: REEXTRACT,
      route: "POST /v1/documents/{documentId}/re-extract",
      inputSchema: documentId,
      annotations: write(false),
    },
    {
      name: "talonic_delete_document",
      title: "Delete a document",
      description: DELETE_DOCUMENT,
      route: "DELETE /v1/documents/{documentId}",
      inputSchema: documentId,
      annotations: write(true, true),
    },
    {
      name: "talonic_list_extractions",
      title: "List extractions",
      description: LIST_EXTRACTIONS,
      route: "GET /v1/extractions",
      inputSchema: {
        document_id: zUuid().optional().describe("Only the extraction of this document."),
        status: z.enum(["complete", "failed"]).optional(),
        ...cursorArgs,
      },
      annotations: READ,
      query: ["document_id", "status", ...PAGE_QUERY],
    },
    {
      name: "talonic_get_extraction",
      title: "One extraction",
      description: GET_EXTRACTION,
      route: "GET /v1/extractions/{extractionId}",
      inputSchema: extractionId,
      annotations: READ,
    },
    getExtractionData,
    {
      name: "talonic_correct_extraction",
      title: "Correct extracted values",
      description: CORRECT_EXTRACTION,
      route: "PATCH /v1/extractions/{extractionId}/data",
      inputSchema: {
        ...extractionId,
        values: z
          .record(z.string(), z.unknown())
          .describe("{ <field_name>: corrected value } for the fields to change."),
      },
      annotations: write(true),
      handler: (ctx, args) => {
        const values = args["values"]
        if (!values || typeof values !== "object" || Array.isArray(values)) {
          return Promise.resolve(validationError("`values` must be an object of field → value."))
        }
        if (Object.keys(values).length === 0) {
          return Promise.resolve(validationError("`values` names no field to correct."))
        }
        // The route takes the field → value map itself as the body.
        return runTool(() =>
          apiJson(
            ctx.getToken,
            ctx.baseUrl,
            "PATCH",
            `/v1/extractions/${encodeURIComponent(String(args["extraction_id"]))}/data`,
            { body: values },
          ),
        )
      },
    },
    {
      name: "talonic_list_jobs",
      title: "List jobs",
      description: LIST_JOBS,
      route: "GET /v1/jobs",
      inputSchema: {
        status: z.string().max(32).optional().describe("Only jobs with this status."),
        ...cursorArgs,
      },
      annotations: READ,
      query: ["status", ...PAGE_QUERY],
    },
    {
      name: "talonic_get_job",
      title: "One job",
      description: GET_JOB,
      route: "GET /v1/jobs/{jobId}",
      inputSchema: jobId,
      annotations: READ,
    },
    {
      name: "talonic_get_job_results",
      title: "A job's result rows",
      description: GET_JOB_RESULTS,
      route: "GET /v1/jobs/{jobId}/results",
      inputSchema: jobId,
      annotations: READ,
    },
    createJob,
    {
      name: "talonic_cancel_job",
      title: "Cancel a job",
      description: CANCEL_JOB,
      route: "POST /v1/jobs/{jobId}/cancel",
      inputSchema: jobId,
      annotations: write(true),
    },
    {
      name: "talonic_update_schema",
      title: "Change a saved schema",
      description: UPDATE_SCHEMA,
      route: "PUT /v1/schemas/{schemaId}",
      inputSchema: {
        ...schemaId,
        name: z.string().min(1).max(100).optional().describe("New name."),
        description: z.string().nullable().optional().describe("New description; null clears it."),
        definition: z
          .object({
            properties: z.record(z.string(), z.record(z.string(), z.unknown())),
            required: z.array(z.string()).optional(),
          })
          .optional()
          .describe("The complete new field list as a JSON Schema object. Replaces every field."),
        fields: z
          .array(schemaFieldSchema)
          .min(1)
          .optional()
          .describe("The complete new field list as rows. Replaces every field."),
      },
      annotations: write(true, true),
      body: ["name", "description", "definition", "fields"],
      handler: (ctx, args) => {
        if (args["definition"] !== undefined && args["fields"] !== undefined) {
          return Promise.resolve(validationError("send `definition` or `fields`, not both."))
        }
        const changes = ["name", "description", "definition", "fields"].filter(
          (k) => args[k] !== undefined,
        )
        if (changes.length === 0) {
          return Promise.resolve(
            validationError("nothing to change: pass name, description, definition or fields."),
          )
        }
        const req = buildRequest(
          {
            route: "PUT /v1/schemas/{schemaId}",
            body: ["name", "description", "definition", "fields"],
          },
          args,
        )
        return runTool(() =>
          apiJson(ctx.getToken, ctx.baseUrl, req.method, req.path, { body: req.body }),
        )
      },
    },
    {
      name: "talonic_delete_schema",
      title: "Delete a saved schema",
      description: DELETE_SCHEMA,
      route: "DELETE /v1/schemas/{schemaId}",
      inputSchema: schemaId,
      annotations: write(true, true),
    },
  ],
}
