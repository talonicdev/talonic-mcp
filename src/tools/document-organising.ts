import { z } from "zod"
import { buildUrl, resolveFetch, runTool } from "./_http.js"
import { apiHttpError, zUuid, type ToolResult } from "./_shared.js"
import {
  READ,
  READ_FRESH,
  REFUSALS,
  destructive,
  write,
  type RouteTool,
  type RouteToolContext,
} from "./_route-tools.js"

/**
 * Document organising tools: tags, filter counts, the workspace's readable
 * names for documents, and source batch ids imported from a CSV. All hit
 * `/v1/documents/*` with the caller's bearer; reads need `documents:read`,
 * writes `documents:write`. Tag and import writes need an Admin of a
 * workspace that configures its own processing, the readable-name rule an
 * Admin, as in the web app.
 */

/** Largest CSV the tool sends (the platform accepts up to 20 MB; a tool argument is far smaller). */
export const MAX_CSV_CHARS = 5_000_000

const tag = z.string().min(1).max(64).regex(/\S/, "a tag needs a visible character")

/** Quote one CSV cell when it needs it. */
function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** Build the import CSV from rows, or take the caller's CSV text as is. */
export function batchMetadataCsv(args: Record<string, unknown>): string {
  if (typeof args["csv"] === "string") return args["csv"]
  const rows = (args["rows"] ?? []) as Array<{ document_id: string; batch_id: string }>
  return [
    "document_id,batch_id",
    ...rows.map((r) => `${csvCell(r.document_id)},${csvCell(r.batch_id)}`),
  ].join("\n")
}

/** POST the CSV as the multipart `file` field. */
async function importBatchMetadata(
  args: Record<string, unknown>,
  ctx: RouteToolContext,
): Promise<ToolResult> {
  return runTool(async () => {
    const form = new FormData()
    form.append(
      "file",
      new Blob([batchMetadataCsv(args)], { type: "text/csv" }),
      typeof args["filename"] === "string" ? args["filename"] : "batch-metadata.csv",
    )
    const res = await resolveFetch(ctx.getToken)(
      buildUrl(ctx.baseUrl, "/v1/documents/batch-metadata/import"),
      {
        method: "POST",
        headers: { Authorization: `Bearer ${ctx.getToken()}`, Accept: "application/json" },
        body: form,
      },
    )
    if (!res.ok) throw await apiHttpError(res)
    return res.json()
  })
}

export const DOCUMENT_ORGANISING_TOOLS: readonly RouteTool[] = [
  {
    name: "talonic_documents_tags",
    title: "Document tags",
    description:
      "Every distinct tag on documents the key's person can see. USE WHEN: before tagging, to reuse an existing tag instead of a near-duplicate; to offer tag filters.",
    route: "GET /v1/documents/tags",
    input: {},
    annotations: READ,
  },
  {
    name: "talonic_documents_system_tags",
    title: "Grouping tags set by Talonic",
    description:
      "Distinct grouping tags Talonic set on visible documents when it unpacked them (the email or archive a document came in). They are read-only labels, kept apart from the tags people set.",
    route: "GET /v1/documents/system-tags",
    input: {},
    annotations: READ,
  },
  {
    name: "talonic_documents_facets",
    title: "Document counts per filter value",
    description:
      "How many visible documents have each status, document type, source and tag. USE WHEN: building or explaining filters, or giving a quick overview of the workspace's documents.",
    route: "GET /v1/documents/facets",
    input: {},
    annotations: READ,
  },
  {
    name: "talonic_documents_batch_tag",
    title: "Tag many documents",
    description: [
      "Add, remove or set tags on up to 1000 documents in one call. `mode`: `add` (default) merges, `remove` takes the given tags away, `set` replaces each document's tags with exactly these. All or nothing: one hidden or missing document refuses the whole batch with 404. Tags can control who sees a document, so `remove` and `set` can take access away: call only when the user asked.",
      "RETURNS: { updated, mode, tags[], results[] { id, status, tags[] }, audit_event_id }.",
      REFUSALS,
    ].join("\n"),
    route: "PATCH /v1/documents/batch-tag",
    input: {
      document_ids: z.array(zUuid()).min(1).max(1000).describe("Documents to change, 1 to 1000."),
      tags: z.array(tag).max(50).describe("Tags, at most 50, each up to 64 characters."),
      mode: z.enum(["add", "remove", "set"]).optional().describe("add (default), remove, or set."),
    },
    body: ["document_ids", "tags", "mode"],
    annotations: destructive(true),
  },
  {
    name: "talonic_documents_set_tags",
    title: "Replace one document's tags",
    description: [
      "Replace one document's tags with exactly the given list; an empty list clears them. Tags can control who sees a document: call only when the user asked. To add a tag without touching the others, use talonic_documents_batch_tag with mode `add`.",
      REFUSALS,
    ].join("\n"),
    route: "PATCH /v1/documents/{document_id}/tags",
    input: {
      document_id: zUuid().describe("The document, from talonic_search or talonic_filter."),
      tags: z.array(tag).max(50).describe("The complete new tag list (at most 50; empty clears)."),
    },
    body: ["tags"],
    annotations: destructive(true),
  },
  {
    name: "talonic_documents_import_batch_ids",
    title: "Import source batch ids",
    description: [
      "Set the source batch id of existing documents from a list or a CSV, e.g. to group documents by the delivery or job they came in. Give `rows` ({ document_id, batch_id }) or `csv` text with the columns `document_id,batch_id`. A `document_id` cell may hold the document id, its filename (with or without extension) or its source item id. An existing batch id is overwritten.",
      "RETURNS: { updated, not_found[] } (the cells that matched no document).",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/documents/batch-metadata/import",
    input: {
      rows: z
        .array(
          z.object({
            document_id: z.string().min(1).max(500),
            batch_id: z.string().min(1).max(500),
          }),
        )
        .min(1)
        .max(20_000)
        .optional()
        .describe("One entry per document: which document, which batch id."),
      csv: z
        .string()
        .min(1)
        .max(MAX_CSV_CHARS)
        .optional()
        .describe("CSV text with a header row naming `document_id` and `batch_id`."),
      filename: z
        .string()
        .max(200)
        .optional()
        .describe("Name the upload carries; default batch-metadata.csv."),
    },
    validate: (a) =>
      (a["rows"] === undefined) === (a["csv"] === undefined)
        ? "Give exactly one of `rows` or `csv`."
        : null,
    handler: importBatchMetadata,
    annotations: write(true),
  },
  {
    name: "talonic_documents_display_name_rule",
    title: "Readable-name rule",
    description: [
      "The workspace's rule for showing documents under a readable name instead of their raw filename: `mode` `off`, `default` (tidy the filename) or `lua` (a script), the script if any, and a sample of current filename → name pairs.",
      "Change it with talonic_documents_set_display_name_rule after trying a script with talonic_documents_preview_display_name_rule.",
    ].join("\n"),
    route: "GET /v1/documents/display-name-rule",
    input: {},
    annotations: READ,
  },
  {
    name: "talonic_documents_set_display_name_rule",
    title: "Set the readable-name rule",
    description: [
      "Set how documents get their readable name: `off` (show filenames; clears the readable names already stored), `default` (tidy the filename) or `lua` with a `script`. New documents follow the rule; apply it to existing ones with talonic_documents_backfill_display_names. Admin only, as in the web app; call only when the user asks.",
      "A `script` reads `record.filename` and calls `record:set('display_name', value)`. Try it first with talonic_documents_preview_display_name_rule.",
      REFUSALS,
    ].join("\n"),
    route: "PATCH /v1/documents/display-name-rule",
    input: {
      mode: z.enum(["off", "default", "lua"]).describe("`off`, `default` or `lua`."),
      script: z
        .string()
        .max(20_000)
        .optional()
        .describe("The rule script; required for `lua`, kept as a draft otherwise."),
    },
    body: ["mode", "script"],
    validate: (a) =>
      a["mode"] === "lua" && typeof a["script"] !== "string"
        ? "mode `lua` needs a `script`."
        : null,
    annotations: destructive(true),
  },
  {
    name: "talonic_documents_preview_display_name_rule",
    title: "Try a readable-name script",
    description: [
      "Run a candidate rule script over a random sample of the workspace's real filenames and show the names it would give, without saving anything. Admin only.",
      "RETURNS: { rows[] { filename, display_name, no_label }, total, changed, no_label }.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/documents/display-name-rule/preview",
    input: {
      lua_script: z.string().max(20_000).describe("The script to try."),
      sample_size: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Filenames to try it on (default 50)."),
    },
    body: ["lua_script", "sample_size"],
    annotations: READ_FRESH,
  },
  {
    name: "talonic_documents_generate_display_name_script",
    title: "Draft a readable-name script",
    description: [
      'Draft a rule script from a plain-language instruction, e.g. "drop the number in front of the name and the date at the end", using the workspace\'s own filenames as examples. Saves nothing: show the draft to the user, try it with talonic_documents_preview_display_name_rule, then save it with talonic_documents_set_display_name_rule. Admin only.',
      "RETURNS: { lua_script, explanation, sample_filenames[] }.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/documents/display-name-rule/generate-script",
    input: {
      instruction: z.string().min(1).max(2_000).describe("The rule in the user's own words."),
      sample_size: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe("Filenames to draw examples from (default 40)."),
    },
    body: ["instruction", "sample_size"],
    annotations: READ_FRESH,
  },
  {
    name: "talonic_documents_display_name_coverage",
    title: "Readable-name coverage",
    description:
      "How many documents carry a readable name, how many differ from their filename, and a sample of documents still shown under their raw filename.",
    route: "GET /v1/documents/display-name-rule/coverage",
    input: {},
    annotations: READ,
  },
  {
    name: "talonic_documents_backfill_display_names",
    title: "Apply the readable-name rule to every document",
    description: [
      "Apply the current readable-name rule to every existing document, overwriting the readable names they have. Runs in the background. Admin only; call only when the user asks.",
      "RETURNS: { scanned, enqueued }.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/documents/display-name-rule/backfill",
    input: {},
    annotations: destructive(true),
  },
]
