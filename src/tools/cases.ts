import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, probeAccessState, type HttpMethod, type QueryParams } from "./_http.js"
import { IDEMPOTENT_SENTENCE, idempotencyHeaders, runWrite } from "./_idempotency.js"
import { type ToolResult, zUuid } from "./_shared.js"

/**
 * Cases tools: the documents that belong together because they reference
 * each other (an order, its confirmation, the invoice and the delivery
 * note), with the quoted passage behind every link.
 *
 * Read a case and its evidence, rename it or mark it resolved, decide which
 * document an ambiguous reference points to (or reject it), see referenced
 * documents that were never uploaded, and get the case's short story.
 * Templates say which document types a complete case holds.
 *
 * The loop an agent runs: talonic_cases_list → talonic_cases_get →
 * talonic_cases_references_to_review → talonic_cases_resolve_reference /
 * _reject_reference → talonic_cases_narrate → talonic_cases_update.
 *
 * The platform owns every rule (scopes, the person's permissions, document
 * visibility); these tools only forward.
 */

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const
const write = (idempotent: boolean) =>
  ({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: idempotent,
    openWorldHint: false,
  }) as const

/** One cases tool. */
export interface CasesToolSpec {
  name: string
  title: string
  description: string
  inputSchema: Record<string, z.ZodTypeAny>
  annotations: ReturnType<typeof write> | typeof readOnly
  handler: (args: any) => Promise<ToolResult>
}

const READ_SCOPE = "Needs the cases:read (or read) scope."
const WRITE_SCOPE =
  "Needs the cases:write scope; the person behind the credential needs the edit permission in the workspace."

const caseKeyArg = zUuid().describe("The case id (case_key from talonic_cases_list).")
const idempotencyArg = z
  .string()
  .min(1)
  .max(64)
  .optional()
  .describe("Optional Idempotency-Key; a retry with the same key returns the first result.")

const templateDocType = z.object({
  doc_type_name: z.string().min(1).max(200),
  doc_type_id: zUuid().optional(),
  required: z.boolean().optional(),
})
const linkKey = z.object({
  canonical_name: z.string().min(1).max(200),
  category: z.string().max(100),
})

function defined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

function lines(...parts: string[]): string {
  return parts.join("\n")
}

const enc = encodeURIComponent

/**
 * The cases tool set for one credential.
 *
 * @internal Exported for tests.
 */
export function casesTools(getToken: () => string, baseUrl?: string): CasesToolSpec[] {
  const read = (path: string, params?: QueryParams) =>
    runWrite(() => apiJson(getToken, baseUrl, "GET", path, params ? { params } : {}))
  const send = (
    tool: string,
    args: Record<string, unknown>,
    derive: boolean,
    method: HttpMethod,
    path: string,
    body?: unknown,
  ) =>
    runWrite(() =>
      apiJson(getToken, baseUrl, method, path, {
        ...(body !== undefined ? { body } : {}),
        headers: idempotencyHeaders(tool, args, derive),
      }),
    )

  return [
    {
      name: "talonic_cases_list",
      title: "List cases",
      description: lines(
        "The workspace's cases: documents grouped by the references they make to each other. Open cases by default; resolved: true for resolved ones.",
        "USE WHEN: finding a case to work on.",
        "NOT FOR: one case's documents and links (talonic_cases_get).",
        `ARGS: resolved?, limit? (1-200), offset?. ${READ_SCOPE}`,
        "RETURNS: one page of cases with total and summary.",
      ),
      inputSchema: {
        resolved: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: readOnly,
      handler: (a) => read("/v1/relation-claims/cases", defined(a) as QueryParams),
    },
    {
      name: "talonic_cases_get",
      title: "Get a case",
      description: lines(
        "One case: its documents, the links between them with the quoted passage for each, its name, whether it is resolved, and the documents it references but lacks.",
        "USE WHEN: reading a case and its evidence before changing it.",
        `ARGS: case_key. ${READ_SCOPE}`,
        "RETURNS: the case.",
      ),
      inputSchema: { case_key: caseKeyArg },
      annotations: readOnly,
      handler: (a) => read(`/v1/relation-claims/cases/${enc(a.case_key)}`),
    },
    {
      name: "talonic_cases_update",
      title: "Rename or resolve a case",
      description: lines(
        "Rename a case, mark it resolved, or reopen it.",
        `ARGS: case_key, display_name?, resolved?, idempotency_key?. ${WRITE_SCOPE} ${IDEMPOTENT_SENTENCE}`,
        "RETURNS: the updated case.",
      ),
      inputSchema: {
        case_key: caseKeyArg,
        display_name: z.string().max(200).optional(),
        resolved: z.boolean().optional(),
        idempotency_key: idempotencyArg,
      },
      annotations: write(true),
      handler: (a) =>
        send(
          "talonic_cases_update",
          a,
          true,
          "PATCH",
          `/v1/relation-claims/cases/${enc(a.case_key)}`,
          defined({
            display_name: a.display_name,
            resolved: a.resolved,
          }),
        ),
    },
    {
      name: "talonic_cases_narrate",
      title: "Tell a case's story",
      description: lines(
        "The case's title and a short narrative of what happened, in a language. The stored text is returned unless the case changed since.",
        "USE WHEN: summarising a case for the user, or after its documents or links changed.",
        `ARGS: case_key, lang? (e.g. en, de), idempotency_key?. ${WRITE_SCOPE}`,
        "RETURNS: { title, narrative, ... }.",
      ),
      inputSchema: {
        case_key: caseKeyArg,
        lang: z.string().max(10).optional(),
        idempotency_key: idempotencyArg,
      },
      annotations: write(true),
      handler: (a) =>
        send(
          "talonic_cases_narrate",
          a,
          false,
          "POST",
          `/v1/relation-claims/cases/${enc(a.case_key)}/narrate`,
          defined({
            lang: a.lang,
          }),
        ),
    },
    {
      name: "talonic_cases_references_to_review",
      title: "References to decide",
      description: lines(
        "References that match more than one document, each with its candidate documents, waiting for a person to decide.",
        "USE WHEN: linking documents correctly; decide each with talonic_cases_resolve_reference or _reject_reference.",
        `ARGS: limit?, offset?. ${READ_SCOPE}`,
        "RETURNS: one page of references with candidates.",
      ),
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: readOnly,
      handler: (a) => read("/v1/relation-claims/review", defined(a) as QueryParams),
    },
    {
      name: "talonic_cases_resolve_reference",
      title: "Decide a reference",
      description: lines(
        "Decide which document a reference points to. The decision is kept from then on and links the two documents into one case.",
        `ARGS: reference_id, document_id, idempotency_key?. ${WRITE_SCOPE} ${IDEMPOTENT_SENTENCE}`,
        "RETURNS: the decided reference.",
      ),
      inputSchema: { reference_id: zUuid(), document_id: zUuid(), idempotency_key: idempotencyArg },
      annotations: write(true),
      handler: (a) =>
        send(
          "talonic_cases_resolve_reference",
          a,
          true,
          "POST",
          `/v1/relation-claims/${enc(a.reference_id)}/resolve`,
          {
            document_id: a.document_id,
          },
        ),
    },
    {
      name: "talonic_cases_reject_reference",
      title: "Reject a reference",
      description: lines(
        "Reject a reference as not a real link between documents.",
        `ARGS: reference_id, idempotency_key?. ${WRITE_SCOPE} ${IDEMPOTENT_SENTENCE}`,
        "RETURNS: the rejected reference.",
      ),
      inputSchema: { reference_id: zUuid(), idempotency_key: idempotencyArg },
      annotations: write(true),
      handler: (a) =>
        send(
          "talonic_cases_reject_reference",
          a,
          true,
          "POST",
          `/v1/relation-claims/${enc(a.reference_id)}/reject`,
        ),
    },
    {
      name: "talonic_cases_missing_documents",
      title: "Referenced documents not uploaded",
      description: lines(
        "Documents your documents reference that were never uploaded, grouped by reference.",
        "USE WHEN: telling the user what to upload to complete their cases.",
        `ARGS: none. ${READ_SCOPE}`,
        "RETURNS: the missing-document report.",
      ),
      inputSchema: {},
      annotations: readOnly,
      handler: () => read("/v1/relation-claims/missing"),
    },
    {
      name: "talonic_cases_document_neighbors",
      title: "Documents connected to a document",
      description: lines(
        "Documents one step from a document, with the field and value that connects them.",
        `ARGS: document_id. ${READ_SCOPE}`,
        "RETURNS: the neighbouring documents with the connecting field and value.",
      ),
      inputSchema: { document_id: zUuid() },
      annotations: readOnly,
      handler: (a) => read(`/v1/case-synthesis/documents/${enc(a.document_id)}/neighbors`),
    },
    {
      name: "talonic_cases_list_templates",
      title: "List case templates",
      description: lines(
        "Case templates: the document types a complete case of each kind holds.",
        `ARGS: none. ${READ_SCOPE}`,
        "RETURNS: the templates.",
      ),
      inputSchema: {},
      annotations: readOnly,
      handler: () => read("/v1/cases/templates"),
    },
    {
      name: "talonic_cases_save_template",
      title: "Create or change a case template",
      description: lines(
        "Create a case template (no template_id) or change one (with template_id). Admins only: the person behind the credential needs the workspace permission.",
        "USE WHEN: the user asks to define what a complete case contains.",
        `ARGS: template_id?, name (required to create), description?, expected_document_types[] { doc_type_name, doc_type_id?, required? } (required to create), link_key_requirements[]?, match_threshold? (0-1, change only), idempotency_key?. Needs the cases:write scope.`,
        "RETURNS: the template.",
      ),
      inputSchema: {
        template_id: zUuid().optional(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        expected_document_types: z.array(templateDocType).max(100).optional(),
        link_key_requirements: z.array(linkKey).max(50).optional(),
        match_threshold: z.number().min(0).max(1).optional(),
        idempotency_key: idempotencyArg,
      },
      annotations: write(false),
      handler: async (a) => {
        const { template_id, idempotency_key: _k, ...rest } = a
        if (template_id) {
          return send(
            "talonic_cases_save_template",
            a,
            false,
            "PATCH",
            `/v1/cases/templates/${enc(template_id)}`,
            defined(rest),
          )
        }
        if (!rest.name || !rest.expected_document_types) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Validation error: creating a template needs name and expected_document_types.",
              },
            ],
          }
        }
        const { match_threshold: _m, ...create } = rest
        return send(
          "talonic_cases_save_template",
          a,
          false,
          "POST",
          "/v1/cases/templates",
          defined(create),
        )
      },
    },
  ]
}

/**
 * Whether this credential reaches cases (`GET /v1/relation-claims/cases?limit=1` → 200).
 * Listing visibility only; the platform re-checks every call.
 */
export async function probeCasesAccess(token: string, baseUrl?: string): Promise<boolean> {
  return (
    (await probeAccessState(token, baseUrl, "/v1/relation-claims/cases", () => true, {
      limit: 1,
    })) === true
  )
}

/** Register the `talonic_cases_*` tools. */
export function registerCasesTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  for (const t of casesTools(getToken, baseUrl)) {
    server.registerTool(
      t.name,
      {
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: { title: t.title, ...t.annotations },
      },
      async (args: unknown) => t.handler(args) as Promise<any>,
    )
  }
}
