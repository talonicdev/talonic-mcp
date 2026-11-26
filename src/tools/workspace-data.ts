import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, probeAccessState, runTool } from "./_http.js"
import { zUuid, type ToolResult } from "./_shared.js"

/**
 * Workspace data tools: the workspace data catalog (shared data sets and
 * their rows with source documents) and the suggestions Talonic puts to a
 * person about the workspace's data (questions, field mappings, matches
 * between tables), each decided by the caller.
 *
 * All tools hit `/v1/catalog/*` and `/v1/suggestions/*` with the caller's
 * bearer; the platform owns every rule (scopes, document visibility,
 * whether the workspace has suggestions enabled) per call.
 *
 * Loop: talonic_catalog_list → talonic_catalog_rows; talonic_suggestion_questions
 * → talonic_suggestion_answer; talonic_suggestion_mappings / _links →
 * talonic_suggestion_decide_mapping / _link.
 */

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}
const write = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

/** True when the caller's credential can read the workspace data catalog (tools are listed only then). */
export async function probeWorkspaceDataAccess(token: string, baseUrl?: string): Promise<boolean> {
  return (await probeAccessState(token, baseUrl, "/v1/catalog")) === true
}

const NOT_ENABLED =
  "Needs `reviews:write`; a workspace without suggestions answers 403 `feature_not_enabled`."

const D = {
  catalog:
    "List every data set shared in the workspace: its fields with their meaning, row count and when it was last updated. `available: false` means the data set is being brought up to date; `partial: true` means it holds only its first rows. USE WHEN the user asks what data the workspace has, or before reading rows. Needs `records:read`. NOT FOR: the rows themselves (talonic_catalog_rows).",
  entry:
    "One data set of the workspace catalog by name: fields, row count, status, last update. USE WHEN the user names a data set. Needs `records:read`. NOT FOR: listing every data set (talonic_catalog_list) or reading its rows (talonic_catalog_rows).",
  rows: "Read rows of one data set, each with the documents it came from. Narrow with `where`, an object of field → value (or array of values, any of). Pages with `limit` (1-500, default 100) and `offset`; `pagination.has_more` says whether more remain. Rows built from a document the caller may not see are left out and counted in `withheld`. USE WHEN the user wants records of a data set with their sources. Needs `records:read`. NOT FOR: the data set's fields (talonic_catalog_get).",
  questions:
    "List the questions Talonic asks a person about the workspace's data (which field a column holds, whether two records are the same party, a changed format), open ones first, most important first. Each lists its options by `index`. USE WHEN the user wants to see or clear open questions. Needs `reviews:read`. NOT FOR: answering one (talonic_suggestion_answer).",
  answer: `Answer a question with one of its options (\`option\` is the option's \`index\`); the answer applies to every subject the question covers and is recorded for the caller. 409 when the question is no longer open. USE WHEN the user chose an option. ${NOT_ENABLED} NOT FOR: listing questions (talonic_suggestion_questions).`,
  mappings:
    "List suggested fields for the columns of connected sources, with a confidence. `status=suggested` lists those awaiting a decision; filter by `source_id`, page with `limit` and `offset`. USE WHEN the user reviews how source columns map to fields. Needs `reviews:read`. NOT FOR: matches between tables (talonic_suggestion_links).",
  decideMapping: `Confirm or reject a suggested mapping, or retarget it to another field (\`field_registry_id\`, from talonic_list_fields) or to a proposed new field (\`proposed\` with canonical_name). Recorded for the caller. USE WHEN the user decided a mapping. ${NOT_ENABLED} NOT FOR: deciding a match between tables (talonic_suggestion_decide_link).`,
  links:
    "List suggested matches between a column of one table and a column of another (one refers to the other, or they share values), with how much they overlap. `status=suggested` lists those awaiting a decision; filter by `source_id`, page with `limit` and `offset`. USE WHEN the user reviews how tables relate. Needs `reviews:read`. NOT FOR: column-to-field mappings (talonic_suggestion_mappings).",
  decideLink: `Confirm or reject a suggested match between tables; recorded for the caller. USE WHEN the user decided a match. ${NOT_ENABLED} NOT FOR: deciding a field mapping (talonic_suggestion_decide_mapping).`,
}

const pageArgs = {
  source_id: zUuid().optional().describe("Only one source"),
  limit: z.number().int().min(1).max(1000).optional().describe("Page size"),
  offset: z.number().int().min(0).optional().describe("Rows to skip"),
}
const catalogName = () =>
  z.string().min(1).describe("The data set name, as talonic_catalog_list lists it")

/**
 * Register the nine workspace data tools (`talonic_catalog_*`, `talonic_suggestion_*`).
 *
 * @public
 */
export function registerWorkspaceDataTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const call = (method: "GET" | "POST", path: string, opts = {}) =>
    runTool(() => apiJson(getToken, baseUrl, method, path, opts))
  const tools: Array<
    [
      string,
      string,
      string,
      Record<string, z.ZodTypeAny>,
      typeof readOnly | typeof write,
      (a: any) => Promise<ToolResult>,
    ]
  > = [
    [
      "talonic_catalog_list",
      "Workspace data catalog",
      D.catalog,
      {},
      readOnly,
      () => call("GET", "/v1/catalog"),
    ],
    [
      "talonic_catalog_get",
      "One data set",
      D.entry,
      { name: catalogName() },
      readOnly,
      (a) => call("GET", `/v1/catalog/${encodeURIComponent(a.name)}`),
    ],
    [
      "talonic_catalog_rows",
      "Rows of a data set",
      D.rows,
      {
        name: catalogName(),
        where: z
          .union([z.record(z.string(), z.unknown()), z.string()])
          .optional()
          .describe("Field → value or array of values (an object, or the same as a JSON string)"),
        limit: z.number().int().min(1).max(500).optional().describe("Page size (default 100)"),
        offset: z.number().int().min(0).optional().describe("Rows to skip"),
      },
      readOnly,
      (a) =>
        call("GET", `/v1/catalog/${encodeURIComponent(a.name)}/rows`, {
          params: {
            where:
              a.where === undefined
                ? undefined
                : typeof a.where === "string"
                  ? a.where
                  : JSON.stringify(a.where),
            limit: a.limit,
            offset: a.offset,
          },
        }),
    ],
    [
      "talonic_suggestion_questions",
      "Questions about your data",
      D.questions,
      {
        status: z
          .enum(["open", "answered", "deferred", "dismissed"])
          .optional()
          .describe("Filter by status"),
      },
      readOnly,
      (a) => call("GET", "/v1/suggestions/questions", { params: { status: a.status } }),
    ],
    [
      "talonic_suggestion_answer",
      "Answer a question",
      D.answer,
      {
        question_id: zUuid().describe("The question id (from talonic_suggestion_questions)"),
        option: z.number().int().min(0).max(20).describe("The chosen option's index"),
      },
      { ...write, idempotentHint: false },
      (a) =>
        call("POST", `/v1/suggestions/questions/${encodeURIComponent(a.question_id)}/answer`, {
          body: { option: a.option },
        }),
    ],
    [
      "talonic_suggestion_mappings",
      "Suggested field mappings",
      D.mappings,
      {
        status: z
          .enum(["suggested", "auto_applied", "confirmed", "rejected"])
          .optional()
          .describe("Filter by status"),
        ...pageArgs,
      },
      readOnly,
      (a) =>
        call("GET", "/v1/suggestions/mappings", {
          params: { status: a.status, source_id: a.source_id, limit: a.limit, offset: a.offset },
        }),
    ],
    [
      "talonic_suggestion_decide_mapping",
      "Decide a suggested mapping",
      D.decideMapping,
      {
        mapping_id: zUuid().describe("The mapping id (from talonic_suggestion_mappings)"),
        action: z.enum(["confirm", "reject", "retarget"]),
        field_registry_id: zUuid()
          .optional()
          .describe("retarget: the existing field to map to (from talonic_list_fields)"),
        proposed: z
          .object({
            canonical_name: z.string().min(1),
            display_name: z.string().optional(),
            data_type: z.string().optional(),
            description: z.string().optional(),
          })
          .optional()
          .describe("retarget: a new field to map to"),
      },
      write,
      (a) =>
        call("POST", `/v1/suggestions/mappings/${encodeURIComponent(a.mapping_id)}/decision`, {
          body: {
            action: a.action,
            ...(a.field_registry_id !== undefined
              ? { field_registry_id: a.field_registry_id }
              : {}),
            ...(a.proposed !== undefined ? { proposed: a.proposed } : {}),
          },
        }),
    ],
    [
      "talonic_suggestion_links",
      "Suggested matches between tables",
      D.links,
      {
        status: z
          .enum(["suggested", "confirmed", "rejected"])
          .optional()
          .describe("Filter by status"),
        ...pageArgs,
      },
      readOnly,
      (a) =>
        call("GET", "/v1/suggestions/links", {
          params: { status: a.status, source_id: a.source_id, limit: a.limit, offset: a.offset },
        }),
    ],
    [
      "talonic_suggestion_decide_link",
      "Decide a suggested match",
      D.decideLink,
      {
        link_id: zUuid().describe("The match id (from talonic_suggestion_links)"),
        action: z.enum(["confirm", "reject"]),
      },
      write,
      (a) =>
        call("POST", `/v1/suggestions/links/${encodeURIComponent(a.link_id)}/decision`, {
          body: { action: a.action },
        }),
    ],
  ]
  for (const [name, title, description, inputSchema, annotations, handler] of tools) {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations } },
      async (args: unknown) => handler(args) as Promise<any>,
    )
  }
}
