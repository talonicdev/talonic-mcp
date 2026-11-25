import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, probeAccessState, runTool } from "./_http.js"
import { zUuid, type ToolResult } from "./_shared.js"

/**
 * Data product tools: edit a shared data product's definition, manage the
 * runs a product reads from, decide the fields where those runs disagree,
 * and issue the unique IDs a product's rows carry.
 *
 * All tools hit `/v1/data-products/*` with the caller's bearer; the platform
 * owns every rule (scopes, workspace role, document visibility) per call.
 *
 * Loop: talonic_data_product_runs → talonic_data_product_disagreements →
 * talonic_data_product_suggest_resolutions (optional) →
 * talonic_data_product_resolve_field / talonic_data_product_resolve_singles.
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
const destructive = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
}

/** True when the caller's credential can read data products (tools are listed only then). */
export async function probeDataProductsAccess(token: string, baseUrl?: string): Promise<boolean> {
  return (
    (await probeAccessState(token, baseUrl, "/v1/data-products", () => true, { limit: 1 })) === true
  )
}

const ADMIN = "Needs `products:write` and an Admin of the workspace (else 403 `insufficient_role`)."

const D = {
  updateDefinition:
    "Replace the definition of a shared data product (the keyed dataset several runs contribute to: identity, roles, readiness rules). USE WHEN the user wants to change what a shared product holds. Send the full `definition` and `expected_definition_version` (the version you read): if anyone saved in between, the answer is 409 `revision_conflict`; read again and redo the change instead of overwriting. Needs `products:write`. NOT FOR: adding or removing a run (talonic_data_product_add_run / talonic_data_product_remove_run).",
  runs: "List the runs a run-backed data product reads its rows from, with their progress (documents total, completed, failed). USE WHEN the user asks which runs feed a product or whether they have finished. Needs `products:read`. NOT FOR: the fields where those runs disagree (talonic_data_product_disagreements).",
  addRun: `Link one more run (a structuring run or a resolution run of the workspace) to a run-backed data product; its rows appear in the product on the next read. Idempotent. USE WHEN the user wants another run's rows in the product. ${ADMIN} NOT FOR: removing a run (talonic_data_product_remove_run).`,
  removeRun: `Unlink a run from a data product; its rows leave the product on the next read. USE WHEN the user wants a run's rows out of the product. Confirm with the user first. ${ADMIN} NOT FOR: listing the runs (talonic_data_product_runs).`,
  disagreements:
    "For a product built to compare runs: every field where the runs produced different values, grouped by document, with each run's value, confidence and the decision taken so far, plus totals pending and reviewed. Documents the caller may not see are left out. USE WHEN the user wants to review where runs disagree. Needs `products:read`. NOT FOR: recording a decision (talonic_data_product_resolve_field).",
  resolveField:
    "Record the value to keep for one field of one document where the runs disagree, how it was chosen (`selection_method`, for example `run` or `manual`) and the candidates seen (`source_values`, one per run). Recorded for the caller; deciding again replaces the earlier decision. USE WHEN the user picked a value, or accepted a suggestion. Needs `products:write`. NOT FOR: deciding every field only one run filled (talonic_data_product_resolve_singles).",
  suggest:
    "Read each document behind a disagreeing field and suggest the value to keep, with a confidence (0-1) and a short reason, as document_id → field_name → suggestion. Writes nothing; can take up to a minute on a large product. USE WHEN the user wants help deciding many disagreements; show the suggestions and apply the accepted ones with talonic_data_product_resolve_field. Needs `products:write`. NOT FOR: listing the disagreements (talonic_data_product_disagreements).",
  resolveSingles:
    "Decide every disagreeing field where exactly one run has a value and the others are empty, keeping that value; answers how many were decided. Recorded for the caller. USE WHEN the user wants the obvious cases cleared before reviewing the rest. Needs `products:write`. NOT FOR: fields where runs gave different non-empty values (talonic_data_product_resolve_field).",
  issueIds: `Issue unique IDs into the product's rows by its ID rules, or by the \`rules\` you send (target_field, condition empty|always, source_field, format containing {value} and {seq:N}). Rows that already have an ID keep it. USE WHEN the user wants IDs filled in. ${ADMIN} NOT FOR: re-issuing every ID (talonic_data_product_regenerate_ids).`,
  regenerateIds: `Clear every issued ID of the product and issue them again from its rules. USE WHEN the user wants every ID issued afresh after changing the rules. IDs already delivered elsewhere are not recalled, so confirm with the user first. ${ADMIN} NOT FOR: filling IDs only where missing (talonic_data_product_issue_ids).`,
  generatedIds:
    "List every ID issued for the product's rows. USE WHEN the user asks which IDs a product has issued. Needs `products:read`. NOT FOR: the counters the IDs are drawn from (talonic_data_product_sequence_counters).",
  counters:
    "List the counters the product's ID rules draw from, per target field and prefix, with their current value. USE WHEN the user asks where numbering stands. Needs `products:read`. NOT FOR: the IDs one counter issued (talonic_data_product_counter_ids).",
  setCounter: `Set a counter's high-water mark; the next ID issued is value + 1. USE WHEN the user wants numbering to continue from a given value. IDs already issued stay. Lowering the value can issue an ID again that was issued before, so confirm with the user. ${ADMIN} NOT FOR: reading the counters (talonic_data_product_sequence_counters).`,
  counterIds:
    "List the IDs one counter issued, per document, newest first, paged with limit and offset. USE WHEN the user asks which documents got which number from a counter. Needs `products:read`. NOT FOR: every ID of the product (talonic_data_product_generated_ids).",
}

const productId = () => zUuid().describe("The data product id (from GET /v1/data-products)")
const p = (id: string) => `/v1/data-products/${encodeURIComponent(id)}`
const counterPath = (a: { data_product_id: string; target_field: string; prefix: string }) =>
  `${p(a.data_product_id)}/sequence-counters/${encodeURIComponent(a.target_field)}/${encodeURIComponent(a.prefix)}`

const idRule = z
  .object({
    target_field: z.string().describe("The field the ID is written to"),
    condition: z.enum(["empty", "always"]).describe("Issue only where empty, or always"),
    source_field: z.string().describe("The field whose value the ID starts with"),
    format: z.string().describe("Must contain {value} and {seq:N}, for example {value}{seq:6}"),
    sequence_scope: z.enum(["per_value", "global"]).optional(),
    resolution_map: z.record(z.string(), z.string()).optional(),
    unresolved_behavior: z.enum(["passthrough", "skip", "error"]).optional(),
    fallback_chain: z.array(z.record(z.string(), z.unknown())).optional(),
    cross_product: z.boolean().optional().describe("Share the counter across products"),
  })
  .passthrough()

/**
 * Register the fourteen `talonic_data_product_*` tools.
 *
 * @public
 */
export function registerDataProductTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const call = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, opts = {}) =>
    runTool(() => apiJson(getToken, baseUrl, method, path, opts))
  const counter = {
    data_product_id: productId(),
    target_field: z.string().min(1).describe("The field the IDs are written to"),
    prefix: z.string().min(1).describe("The counter's prefix"),
  }
  const tools: Array<
    [
      string,
      string,
      string,
      Record<string, z.ZodTypeAny>,
      typeof readOnly | typeof write | typeof destructive,
      (a: any) => Promise<ToolResult>,
    ]
  > = [
    [
      "talonic_data_product_update_definition",
      "Change a data product definition",
      D.updateDefinition,
      {
        data_product_id: productId(),
        definition: z
          .record(z.string(), z.unknown())
          .describe("The full definition: identity, roles and readiness rules"),
        expected_definition_version: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("The definition_version you edited"),
      },
      write,
      (a) =>
        call("PUT", `${p(a.data_product_id)}/definition`, {
          body: {
            definition: a.definition,
            ...(a.expected_definition_version !== undefined
              ? { expected_definition_version: a.expected_definition_version }
              : {}),
          },
        }),
    ],
    [
      "talonic_data_product_runs",
      "Data product runs",
      D.runs,
      { data_product_id: productId() },
      readOnly,
      (a) => call("GET", `${p(a.data_product_id)}/runs`),
    ],
    [
      "talonic_data_product_add_run",
      "Add a run to a data product",
      D.addRun,
      {
        data_product_id: productId(),
        run_id: zUuid().describe("The structuring run or resolution run to add"),
      },
      write,
      (a) => call("POST", `${p(a.data_product_id)}/runs`, { body: { run_id: a.run_id } }),
    ],
    [
      "talonic_data_product_remove_run",
      "Remove a run from a data product",
      D.removeRun,
      {
        data_product_id: productId(),
        run_id: zUuid().describe("The run to remove (from talonic_data_product_runs)"),
      },
      { ...destructive, idempotentHint: true },
      (a) => call("DELETE", `${p(a.data_product_id)}/runs/${encodeURIComponent(a.run_id)}`),
    ],
    [
      "talonic_data_product_disagreements",
      "Fields where runs disagree",
      D.disagreements,
      { data_product_id: productId() },
      readOnly,
      (a) => call("GET", `${p(a.data_product_id)}/pending-resolutions`),
    ],
    [
      "talonic_data_product_resolve_field",
      "Decide a disagreeing field",
      D.resolveField,
      {
        data_product_id: productId(),
        document_id: zUuid().describe("The document the field belongs to"),
        field_name: z.string().min(1).describe("The field to decide"),
        canonical_value: z.string().describe("The value to keep"),
        selection_method: z
          .string()
          .min(1)
          .describe("How the value was chosen, for example `run` or `manual`"),
        source_values: z
          .array(
            z.object({
              run_id: z.string().describe("The run that produced this value"),
              run_name: z.string().optional(),
              value: z.unknown().describe("The run's value"),
              confidence: z.number().optional(),
            }),
          )
          .describe("The candidates seen, one per run"),
      },
      write,
      (a) =>
        call("POST", `${p(a.data_product_id)}/resolve-field`, {
          body: {
            document_id: a.document_id,
            field_name: a.field_name,
            canonical_value: a.canonical_value,
            selection_method: a.selection_method,
            source_values: a.source_values,
          },
        }),
    ],
    [
      "talonic_data_product_suggest_resolutions",
      "Suggest values for disagreeing fields",
      D.suggest,
      { data_product_id: productId() },
      { ...readOnly, idempotentHint: false },
      (a) => call("POST", `${p(a.data_product_id)}/auto-review`),
    ],
    [
      "talonic_data_product_resolve_singles",
      "Decide fields only one run filled",
      D.resolveSingles,
      { data_product_id: productId() },
      write,
      (a) => call("POST", `${p(a.data_product_id)}/auto-resolve-singles`),
    ],
    [
      "talonic_data_product_issue_ids",
      "Issue IDs for product rows",
      D.issueIds,
      {
        data_product_id: productId(),
        rules: z
          .array(idRule)
          .optional()
          .describe("ID rules to apply instead of the product's own"),
      },
      write,
      (a) =>
        call("POST", `${p(a.data_product_id)}/apply-id-rules`, {
          body: a.rules !== undefined ? { rules: a.rules } : {},
        }),
    ],
    [
      "talonic_data_product_regenerate_ids",
      "Re-issue every product ID",
      D.regenerateIds,
      { data_product_id: productId() },
      destructive,
      (a) => call("POST", `${p(a.data_product_id)}/regenerate-ids`),
    ],
    [
      "talonic_data_product_generated_ids",
      "Issued IDs",
      D.generatedIds,
      { data_product_id: productId() },
      readOnly,
      (a) => call("GET", `${p(a.data_product_id)}/generated-ids`),
    ],
    [
      "talonic_data_product_sequence_counters",
      "Sequence counters",
      D.counters,
      { data_product_id: productId() },
      readOnly,
      (a) => call("GET", `${p(a.data_product_id)}/sequence-counters`),
    ],
    [
      "talonic_data_product_set_sequence_counter",
      "Set a sequence counter",
      D.setCounter,
      {
        ...counter,
        value: z.number().int().min(0).describe("The new high-water mark"),
        scope: z
          .enum(["product", "cross"])
          .describe("`cross` for a counter shared across products"),
      },
      { ...destructive, idempotentHint: true },
      (a) => call("PATCH", counterPath(a), { body: { value: a.value, scope: a.scope } }),
    ],
    [
      "talonic_data_product_counter_ids",
      "IDs one counter issued",
      D.counterIds,
      {
        ...counter,
        scope: z.enum(["product", "cross"]).optional().describe("Counter scope (default product)"),
        limit: z.number().int().min(1).optional().describe("Page size"),
        offset: z.number().int().min(0).optional().describe("Rows to skip"),
      },
      readOnly,
      (a) =>
        call("GET", `${counterPath(a)}/ids`, {
          params: { scope: a.scope, limit: a.limit, offset: a.offset },
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
