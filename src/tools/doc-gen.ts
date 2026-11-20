import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiBinary, apiJson, buildUrl, runTool, sleep as defaultSleep } from "./_http.js"
import { toolError, validationError, type ToolResult, zUuid } from "./_shared.js"

/**
 * Document Generation tools: the Doc Gen app. Word templates (letters and
 * agreements) whose placeholders are described by a field sheet: each field
 * names where its value comes from (a data product column, the reference
 * table, a pattern over a column, a contract party from Contract Party
 * Management, the writer's profile, a workspace rule, today's date, or
 * `case`: entered per document). Red passages of a template (grammar,
 * conditional text, values to fill) are fields too (`spot.original`). Filling a template for rows
 * of a data product gives one document per row; generating makes the Word
 * files (and PDFs) with every value's origin in the document history.
 *
 * All tools hit `/v1/doc-gen/*` with the caller's bearer; the platform owns
 * every rule (Sources IAM on rows and generated files, scopes per route).
 *
 * The loop an agent runs: talonic_doc_gen_status / _issues → _templates (read
 * the field sheet) → _propose against a product (wait) → fix fields by key
 * (_update_template) / _confirm_fields (only when the user asked) → _products
 * records to pick rows → _draft (check `missing`) → _generate with `values`
 * for the entered fields → _jobs → _file.
 */

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const
const write = (idempotent: boolean, destructive = false) =>
  ({
    readOnlyHint: false,
    destructiveHint: destructive,
    idempotentHint: idempotent,
    openWorldHint: false,
  }) as const

/** How often a wait polls a proposal or a batch. @internal */
export const DOC_GEN_POLL_INTERVAL_MS = 3_000
/** The longest `wait_seconds` a proposal accepts. @internal */
export const PROPOSE_MAX_WAIT_S = 120
/** The longest `wait_seconds` a generation accepts. @internal */
export const GENERATE_MAX_WAIT_S = 300
/** The largest generated file returned inline (raw bytes, before base64). @internal */
export const DOC_GEN_MAX_FILE_BYTES = 8 * 1024 * 1024

/** Injectable clock and delay for the waits (tests). */
export interface DocGenDeps {
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

const templateIdArg = zUuid().describe(
  "Template id (from talonic_doc_gen_templates or talonic_doc_gen_issues).",
)
const productIdArg = zUuid().describe("Data product id (from talonic_doc_gen_products).")
const jobIdArg = zUuid().describe("Batch id (from talonic_doc_gen_jobs or _generate).")
const valuesArg = z
  .record(z.string(), z.string())
  .describe(
    'Values by field key (or case key). A field whose source type is `case` (entered per document) takes the value as entered; a passage decided per document (condition `ask`) takes "yes" or "no" (include or leave out; it stays missing until decided); a value for any other field is an edit over the fill, recorded in the document history.',
  )

const ENTERED_RULE =
  "Fields whose source type is `case` are entered per document: the data does not hold them (e.g. the new owner), so pass them in `values` by field key (or case key). A value for any other field overrides the fill and is recorded as an edit in the document history."

/** Clamp a requested wait to [0, max] whole seconds. */
function waitSeconds(requested: number | undefined, max: number): number {
  const n = Number.isFinite(requested) ? (requested as number) : 0
  return Math.max(0, Math.min(max, Math.floor(n)))
}

/**
 * Poll `read` until `isRunning` is false or the wait ends. A poll failure
 * ends the wait with the last state and the error, so nothing started is lost.
 */
async function pollUntilDone<T>(
  first: T,
  read: () => Promise<T>,
  isRunning: (value: T) => boolean,
  waitS: number,
  deps: DocGenDeps,
): Promise<{ value: T; waited_ms: number; still_running: boolean; poll_error?: string }> {
  const sleep = deps.sleep ?? defaultSleep
  const now = deps.now ?? Date.now
  const start = now()
  const deadline = start + waitS * 1000
  let value = first
  while (isRunning(value) && now() < deadline) {
    await sleep(Math.min(DOC_GEN_POLL_INTERVAL_MS, deadline - now()))
    try {
      value = await read()
    } catch (err) {
      return {
        value,
        waited_ms: now() - start,
        still_running: true,
        poll_error: err instanceof Error ? err.message : String(err),
      }
    }
  }
  return { value, waited_ms: now() - start, still_running: isRunning(value) }
}

// ── Overview ───────────────────────────────────────────────────────────────

const STATUS_DESCRIPTION = [
  "Document Generation at a glance: how many templates, field-sheet fields (confirmed, unconfirmed, entered per document), proposals running / failed / never run, and batches of the last 30 days with the latest one.",
  "USE WHEN: starting any Doc Gen work, or to report where things stand.",
  "NOT FOR: what to fix (talonic_doc_gen_issues); one template (talonic_doc_gen_templates).",
  "",
  "ARGS: none.",
  "RETURNS: { templates, fields { total, confirmed, unconfirmed, entered_per_document }, proposals { running, failed, never_proposed }, jobs { last_30_days, documents_last_30_days, failed_last_30_days, last } }.",
].join("\n")

/** @internal */
export function handleStatus(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/doc-gen/status"))
}

const ISSUES_DESCRIPTION = [
  "The Doc Gen worklist: templates never proposed, proposals failed or with fields left without a suggestion, fields nobody confirmed, and batches of the last 30 days that failed, have failed documents or miss PDFs.",
  "USE WHEN: deciding what to fix before generating, or after a batch.",
  "NOT FOR: the headline counts (talonic_doc_gen_status).",
  "",
  "ARGS: none.",
  "RETURNS: { data[] { code (never_proposed|proposal_failed|proposal_pending|fields_unconfirmed|job_failed|documents_failed|pdf_missing), template_id?, template_name?, job_id?, detail, fields?[] } }.",
].join("\n")

/** @internal */
export function handleIssues(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/doc-gen/issues"))
}

// ── Templates ──────────────────────────────────────────────────────────────

const TEMPLATES_DESCRIPTION = [
  "List the Word templates, or read one template with its field sheet and proposal state.",
  "USE WHEN: finding a template, or before proposing, fixing or generating: the field sheet names every field's key, label, source ({ type: product|reference|extract|first|case|user|rule|today, ... }) and whether a person confirmed it.",
  `${ENTERED_RULE}`,
  "NOT FOR: changing a template (talonic_doc_gen_update_template).",
  "",
  "ARGS: `template_id` (one template; omit for the list), `query` (name, group or file contains), `group` (exact group).",
  "RETURNS: list { data[] { id, name, file, group, kind, pairId, version, dataProductId, field_count, unconfirmed, entered_per_document, generated, lastUsedAt } } or one template { ...template, fields[] { key, label, kind, options, source, confirmed, reason }, proposal { status running|done|failed, productId, startedAt, finishedAt, error, summary } }.",
].join("\n")

export const templatesInputSchema = {
  template_id: templateIdArg.optional(),
  query: z.string().optional().describe("Name, group or filename contains (list only)."),
  group: z.string().optional().describe("Only templates of this group (list only)."),
}

/** @internal */
export function handleTemplates(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { template_id?: string; query?: string; group?: string },
): Promise<ToolResult> {
  return runTool(() =>
    args.template_id
      ? apiJson(getToken, baseUrl, "GET", `/v1/doc-gen/templates/${args.template_id}`)
      : apiJson(getToken, baseUrl, "GET", "/v1/doc-gen/templates", {
          params: { q: args.query, group: args.group },
        }),
  )
}

const UPDATE_TEMPLATE_DESCRIPTION = [
  "Change a template's metadata (name, group, kind, companion template, version) and its fields by key: a field's label, source, confirmed flag or reason. Fields not named stay as they are; an unknown key is refused. Run with dry_run first to see the sheet as it would be.",
  "USE WHEN: fixing a field the proposal got wrong (e.g. pointing it at another column or making it entered per document with source { type: 'case', caseKey }), or pairing a letter with its agreement.",
  "Setting `confirmed: true` is a person's decision: only do it when the user asked (see talonic_doc_gen_confirm_fields).",
  "Red passages (fields with `spot.original`, red text in the Word file): set a `variant` for grammar that depends on the party, a `condition` for text printed only sometimes, any value source, or `fixed` to keep the words (in black). `rescan: true` first adds the red passages of a template whose sheet predates them.",
  "NOT FOR: confirming many fields at once (talonic_doc_gen_confirm_fields).",
  "",
  "ARGS: `template_id`; optional `name`, `group`, `kind` letter|agreement, `pair_template_id`, `version` (null clears group/kind/pair/version); `fields[] { key, label?, source?, confirmed?, reason? }`; `rescan` (add the fields the file has and the sheet lacks; alone or before the changes); `dry_run`.",
  "RETURNS: { dry_run, template } with the field sheet; with `rescan` alone { template, added[] } (keys added).",
].join("\n")

export const updateTemplateInputSchema = {
  template_id: templateIdArg,
  name: z.string().min(1).max(300).optional().describe("New template name."),
  group: z.string().max(200).nullable().optional().describe("Group; null clears it."),
  kind: z.enum(["letter", "agreement"]).nullable().optional().describe("Letter or agreement."),
  pair_template_id: zUuid()
    .nullable()
    .optional()
    .describe("The companion template generated with this one (with_pair); null unpairs."),
  version: z.string().max(60).nullable().optional().describe("Version label; null clears it."),
  fields: z
    .array(
      z.object({
        key: z.string().min(1).max(200).describe("Field key from the field sheet."),
        label: z.string().max(120).optional(),
        source: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            "Field source as the sheet stores it, e.g. { type: 'product', field }, { type: 'reference', column }, { type: 'case', caseKey }, { type: 'user', profile }, { type: 'rule', rule }, { type: 'today' }, { type: 'party', role: addressee|owner_addressee|effective_partner|partner|manager|tenant|previous_owner|new_owner, attribute: name|salutation|greeting|street|postcode_town|address|address_block|email|kind|channel }, { type: 'variant', by: <party role>, map: { herr, frau, eheleute, person, company, association }, fallback } (grammar such as 'der/von'), { type: 'condition', when: { kind: 'party', role, present } | { kind: 'document', pattern, present } | { kind: 'field', field, present?, equals? } | { kind: 'ask' }, text? } (printed only when the condition holds; `ask`: the person generating decides per document, e.g. case variants), { type: 'fixed', text }.",
          ),
        confirmed: z.boolean().optional().describe("Only when the user asked to confirm."),
        reason: z.string().max(400).nullable().optional(),
      }),
    )
    .max(500)
    .optional()
    .describe("Field changes by key."),
  rescan: z
    .boolean()
    .optional()
    .describe(
      "Read the Word file again and add the fields the sheet lacks (red passages); existing fields stay.",
    ),
  dry_run: z.boolean().optional().describe("Return the sheet as it would be; nothing is saved."),
}

/** @internal */
export function handleUpdateTemplate(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    template_id: string
    name?: string
    group?: string | null
    kind?: "letter" | "agreement" | null
    pair_template_id?: string | null
    version?: string | null
    fields?: Array<Record<string, unknown>>
    rescan?: boolean
    dry_run?: boolean
  },
): Promise<ToolResult> {
  const { template_id, dry_run, rescan, ...changes } = args
  const body = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined))
  if (Object.keys(body).length === 0 && !rescan) {
    return Promise.resolve(
      validationError(
        "name nothing to change: pass name, group, kind, pair_template_id, version, fields or rescan.",
      ),
    )
  }
  if (rescan && dry_run) {
    return Promise.resolve(
      validationError("rescan saves the added fields; it cannot run as a dry run."),
    )
  }
  return runTool(async () => {
    const scanned = rescan
      ? await apiJson(getToken, baseUrl, "POST", `/v1/doc-gen/templates/${template_id}/rescan`)
      : null
    if (Object.keys(body).length === 0) return scanned
    return apiJson(getToken, baseUrl, "PATCH", `/v1/doc-gen/templates/${template_id}`, {
      body: { ...body, dry_run: dry_run ?? false },
    })
  })
}

const CONFIRM_DESCRIPTION = [
  "Confirm fields of a template's field sheet: the named keys, or every unconfirmed field (with include_entered false, leaving the fields entered per document unconfirmed). Confirming says a person checked the field's source; it is the user's decision, so only call this when the user asked to confirm. Run with dry_run first to list what would be confirmed.",
  "USE WHEN: the user reviewed the sheet and asks to confirm it (or some fields).",
  "NOT FOR: changing a field's source (talonic_doc_gen_update_template).",
  "",
  "ARGS: `template_id`, `keys[]` (omit for every unconfirmed field), `include_entered` (default true; only without keys), `dry_run`.",
  "RETURNS: { dry_run, confirmed[] { key, label, source } }.",
].join("\n")

export const confirmInputSchema = {
  template_id: templateIdArg,
  keys: z.array(z.string()).max(500).optional().describe("Field keys to confirm."),
  include_entered: z
    .boolean()
    .optional()
    .describe("Without keys: also confirm the fields entered per document (default true)."),
  dry_run: z.boolean().optional().describe("List what would be confirmed; nothing is saved."),
}

/** @internal */
export function handleConfirm(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { template_id: string; keys?: string[]; include_entered?: boolean; dry_run?: boolean },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", `/v1/doc-gen/templates/${args.template_id}/confirm`, {
      body: {
        ...(args.keys ? { keys: args.keys } : {}),
        ...(args.include_entered !== undefined ? { include_entered: args.include_entered } : {}),
        dry_run: args.dry_run ?? false,
      },
    }),
  )
}

const PROPOSE_DESCRIPTION = [
  "Propose a template's field sheet from a data product: the platform reads the product's columns (and its reference table) and suggests a source for every field; suggestions stay unconfirmed. One template runs in the background: pass `wait_seconds` to wait for it (polls every 3 s). Without template_id, starts proposals for several templates (bulk; dry_run first).",
  "USE WHEN: a template is new, never proposed, or should be mapped to another product. Then read the sheet with talonic_doc_gen_templates and fix fields by key.",
  "NOT FOR: setting one field (talonic_doc_gen_update_template).",
  "",
  "ARGS: `data_product_id`; one template: `template_id`, `force` (propose again although the sheet was proposed for this product), `wait_seconds` (0-120, default 0). Bulk: `template_ids[]` (omit for all), `only_unproposed` (default true), `force`, `limit` (1-50, default 10), `dry_run`.",
  "RETURNS: one template: { proposal { status running|done|failed, summary { fields, proposed, kept, fromData, derived, entered, profile, pending[] }, error }, template } or after a wait { template_id, proposal, waited_ms, still_running }. Bulk: { dry_run, started[] | would_start[], skipped }; poll each with talonic_doc_gen_templates.",
].join("\n")

export const proposeInputSchema = {
  data_product_id: productIdArg,
  template_id: templateIdArg.optional().describe("One template; omit for a bulk proposal."),
  force: z.boolean().optional().describe("Propose again although already proposed."),
  wait_seconds: z
    .number()
    .min(0)
    .max(PROPOSE_MAX_WAIT_S)
    .optional()
    .describe(`One template: seconds to wait for the proposal (0-${PROPOSE_MAX_WAIT_S}).`),
  template_ids: z.array(zUuid()).max(200).optional().describe("Bulk: only these templates."),
  only_unproposed: z
    .boolean()
    .optional()
    .describe("Bulk: only templates not yet proposed for this product (default true)."),
  limit: z.number().int().min(1).max(50).optional().describe("Bulk: at most this many."),
  dry_run: z.boolean().optional().describe("Bulk: list what would start."),
}

interface ProposalResponse {
  proposal?: { status?: string } | null
  template?: { id?: string } | null
}

/** @internal */
export function handlePropose(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    data_product_id: string
    template_id?: string
    force?: boolean
    wait_seconds?: number
    template_ids?: string[]
    only_unproposed?: boolean
    limit?: number
    dry_run?: boolean
  },
  deps: DocGenDeps = {},
): Promise<ToolResult> {
  if (!args.template_id) {
    return runTool(() =>
      apiJson(getToken, baseUrl, "POST", "/v1/doc-gen/templates/propose", {
        body: {
          data_product_id: args.data_product_id,
          ...(args.template_ids ? { template_ids: args.template_ids } : {}),
          ...(args.only_unproposed !== undefined ? { only_unproposed: args.only_unproposed } : {}),
          force: args.force ?? false,
          ...(args.limit ? { limit: args.limit } : {}),
          dry_run: args.dry_run ?? false,
        },
      }),
    )
  }
  const id = args.template_id
  const waitS = waitSeconds(args.wait_seconds, PROPOSE_MAX_WAIT_S)
  return runTool(async () => {
    const started = await apiJson<ProposalResponse>(
      getToken,
      baseUrl,
      "POST",
      `/v1/doc-gen/templates/${id}/propose`,
      { body: { data_product_id: args.data_product_id, force: args.force ?? false } },
    )
    if (waitS === 0) return started
    const polled = await pollUntilDone(
      started,
      () =>
        apiJson<ProposalResponse>(getToken, baseUrl, "GET", `/v1/doc-gen/templates/${id}/proposal`),
      (r) => r.proposal?.status === "running",
      waitS,
      deps,
    )
    return {
      template_id: id,
      proposal: polled.value.proposal ?? null,
      waited_ms: polled.waited_ms,
      still_running: polled.still_running,
      ...(polled.poll_error ? { poll_error: polled.poll_error } : {}),
      next: polled.still_running
        ? "Still running: call talonic_doc_gen_templates with this template_id later."
        : "Read the field sheet with talonic_doc_gen_templates and fix fields by key.",
    }
  })
}

const UPLOAD_DESCRIPTION = [
  "Upload a Word template (.docx or .dotx) to Document Generation. Its placeholders become the field sheet; propose it against a data product next.",
  "USE WHEN: the user gives a new letter or agreement template.",
  "NOT FOR: documents to read data from (talonic_request_upload / talonic_extract).",
  "",
  "ARGS: `filename` (with extension) and `content_base64` (the file bytes); in a local install `file_path` instead (the server reads the file). Optional `name`, `group`, `kind` letter|agreement, `version`.",
  "RETURNS: the new template with its fields.",
].join("\n")

const uploadBaseSchema = {
  filename: z
    .string()
    .min(1)
    .max(300)
    .optional()
    .describe("File name with extension, e.g. 'Kuendigung.docx'."),
  content_base64: z.string().min(1).optional().describe("The .docx / .dotx bytes, base64."),
  name: z.string().max(300).optional().describe("Template name (default: from the file)."),
  group: z.string().max(200).optional().describe("Group the template belongs to."),
  kind: z.enum(["letter", "agreement"]).optional().describe("Letter or agreement."),
  version: z.string().max(60).optional().describe("Version label."),
}

export const uploadInputSchema = uploadBaseSchema

/** The local-install upload schema: also takes a path the server reads. */
export const uploadLocalInputSchema = {
  ...uploadBaseSchema,
  file_path: z
    .string()
    .min(1)
    .optional()
    .describe("Local path to the .docx / .dotx (local installs only); replaces content_base64."),
}

/** @internal */
export async function handleUpload(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    filename?: string
    content_base64?: string
    file_path?: string
    name?: string
    group?: string
    kind?: "letter" | "agreement"
    version?: string
  },
  opts: { localFiles?: boolean } = {},
): Promise<ToolResult> {
  if (args.file_path !== undefined && !opts.localFiles) {
    return validationError("file_path works only in a local install; send content_base64.")
  }
  if ((args.file_path === undefined) === (args.content_base64 === undefined)) {
    return validationError(
      opts.localFiles
        ? "pass exactly one of content_base64 (with filename) or file_path."
        : "content_base64 (with filename) is required.",
    )
  }
  let content = args.content_base64
  let filename = args.filename
  if (args.file_path !== undefined) {
    try {
      content = (await readFile(args.file_path)).toString("base64")
    } catch (err) {
      return toolError(err)
    }
    filename = filename ?? basename(args.file_path)
  }
  if (!filename) return validationError("filename is required with content_base64.")
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", "/v1/doc-gen/templates", {
      body: {
        filename,
        content_base64: content,
        ...(args.name ? { name: args.name } : {}),
        ...(args.group ? { group: args.group } : {}),
        ...(args.kind ? { kind: args.kind } : {}),
        ...(args.version ? { version: args.version } : {}),
      },
    }),
  )
}

const DELETE_DESCRIPTION = [
  "Delete a template and its field sheet for good. Generated batches keep their documents. Cannot be undone; only when the user asked.",
  "USE WHEN: the user asks to remove a template.",
  "NOT FOR: replacing the Word file (upload the new one, then delete the old one if asked).",
  "",
  "ARGS: `template_id`.",
  "RETURNS: { ok: true }.",
].join("\n")

export const deleteInputSchema = { template_id: templateIdArg }

/** @internal */
export function handleDelete(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { template_id: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "DELETE", `/v1/doc-gen/templates/${args.template_id}`),
  )
}

// ── Data ───────────────────────────────────────────────────────────────────

const PRODUCTS_DESCRIPTION = [
  "The data products a template is filled from: the list, one product with its columns and reference table, or its rows (one document per row).",
  "USE WHEN: choosing the product to propose or generate against, or picking the rows (record ids) to generate for.",
  "NOT FOR: the template's fields (talonic_doc_gen_templates).",
  "",
  "ARGS: `product_id` (one product; omit for the list); with `records: true` its rows, filtered by `query` (label or any value contains) and `limit` (1-500, default 50).",
  "RETURNS: list { data[] }, one product { id, name, columns[], reference }, or rows { total, data[] { id, label, values, documents } }.",
].join("\n")

export const productsInputSchema = {
  product_id: productIdArg.optional(),
  records: z.boolean().optional().describe("List the product's rows (needs product_id)."),
  query: z.string().optional().describe("Rows whose label or any value contains this."),
  limit: z.number().int().min(1).max(500).optional().describe("Rows returned (default 50)."),
}

/** @internal */
export function handleProducts(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { product_id?: string; records?: boolean; query?: string; limit?: number },
): Promise<ToolResult> {
  if (args.records && !args.product_id) {
    return Promise.resolve(validationError("records needs a product_id."))
  }
  return runTool(() => {
    if (!args.product_id) return apiJson(getToken, baseUrl, "GET", "/v1/doc-gen/products")
    if (!args.records) {
      return apiJson(getToken, baseUrl, "GET", `/v1/doc-gen/products/${args.product_id}`)
    }
    return apiJson(getToken, baseUrl, "GET", `/v1/doc-gen/products/${args.product_id}/records`, {
      params: { q: args.query, limit: args.limit ?? 50 },
    })
  })
}

const RULES_DESCRIPTION = [
  "Read the workspace's rules (named derivations a field with source { type: 'rule', rule } uses, e.g. a salutation from a gender column), or replace them all with `rules`. Replacing deletes every rule not in the new list: read first, change, send the whole list, and only when the user asked.",
  "USE WHEN: explaining a rule-sourced value, or setting up the workspace's rules.",
  "NOT FOR: one field's source (talonic_doc_gen_update_template).",
  "",
  "ARGS: none to read; `rules[] { name, description?, definition }` to replace.",
  "RETURNS: { data[] { name, description, definition } } (after a replace: the stored list).",
].join("\n")

export const rulesInputSchema = {
  rules: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        definition: z.record(z.string(), z.unknown()).describe("The rule's definition object."),
      }),
    )
    .max(500)
    .optional()
    .describe("The complete new list; omit to read."),
}

/** @internal */
export function handleRules(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { rules?: Array<Record<string, unknown>> },
): Promise<ToolResult> {
  return runTool(() =>
    args.rules
      ? apiJson(getToken, baseUrl, "PUT", "/v1/doc-gen/rules", { body: { rules: args.rules } })
      : apiJson(getToken, baseUrl, "GET", "/v1/doc-gen/rules"),
  )
}

const PROFILE_KEYS = ["name", "kuerzel", "titel", "bereich", "unterschrift"] as const
type ProfileKey = (typeof PROFILE_KEYS)[number]

const PROFILE_DESCRIPTION = [
  "Read or change the writer's details a fill reads for fields with source { type: 'user' }: name, kuerzel (initials), titel, bereich (department), unterschrift (signature line). They belong to the person who owns the key or signed in. Changing merges the given details into the saved ones; only when the user asked.",
  "USE WHEN: a draft is missing a profile field, or the user asks to set their details. For one batch only, pass `profile` to talonic_doc_gen_draft / _generate instead.",
  "NOT FOR: per-document values (`values` on talonic_doc_gen_generate).",
  "",
  "ARGS: none to read; any of `name`, `kuerzel`, `titel`, `bereich`, `unterschrift` to save.",
  "RETURNS: { name, kuerzel, titel, bereich, unterschrift }.",
].join("\n")

export const profileInputSchema = Object.fromEntries(
  PROFILE_KEYS.map((k) => [k, z.string().max(200).optional()]),
) as Record<ProfileKey, z.ZodOptional<z.ZodString>>

/** @internal */
export function handleProfile(
  getToken: () => string,
  baseUrl: string | undefined,
  args: Partial<Record<ProfileKey, string>>,
): Promise<ToolResult> {
  const given = PROFILE_KEYS.filter((k) => typeof args[k] === "string")
  return runTool(async () => {
    const current = await apiJson<Record<string, unknown>>(
      getToken,
      baseUrl,
      "GET",
      "/v1/doc-gen/profile",
    )
    if (!given.length) return current
    // PUT replaces the whole profile; merge so details not named are kept.
    const body: Record<string, string> = {}
    for (const k of PROFILE_KEYS) {
      const v = typeof args[k] === "string" ? args[k] : current[k]
      if (typeof v === "string") body[k] = v
    }
    return apiJson(getToken, baseUrl, "PUT", "/v1/doc-gen/profile", { body })
  })
}

// ── Generation ─────────────────────────────────────────────────────────────

const batchSchema = {
  template_id: templateIdArg
    .optional()
    .describe("The template to fill (with_pair adds its companion). Or template_ids."),
  template_ids: z
    .array(zUuid())
    .min(1)
    .max(10)
    .optional()
    .describe("An explicit set of templates instead of template_id."),
  with_pair: z.boolean().optional().describe("Also fill template_id's companion template."),
  data_product_id: productIdArg,
  record_ids: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(500)
    .describe("Row ids from talonic_doc_gen_products (records: true): one document per row."),
  values: valuesArg.optional().describe(`Values for every document of the batch. ${ENTERED_RULE}`),
  documents: z
    .array(
      z.object({
        record_id: z.string().min(1).max(200),
        template_id: zUuid().optional().describe("Only this template's document."),
        values: valuesArg,
      }),
    )
    .max(5000)
    .optional()
    .describe("Values for single documents (over `values`)."),
  profile: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Writer details for this batch only (name, kuerzel, titel, bereich, unterschrift); the saved profile is unchanged.",
    ),
}

type BatchArgs = {
  template_id?: string
  template_ids?: string[]
  with_pair?: boolean
  data_product_id: string
  record_ids: string[]
  values?: Record<string, string>
  documents?: Array<{ record_id: string; template_id?: string; values: Record<string, string> }>
  profile?: Record<string, string>
}

function batchBody(args: BatchArgs): Record<string, unknown> {
  return {
    ...(args.template_id ? { template_id: args.template_id } : {}),
    ...(args.template_ids ? { template_ids: args.template_ids } : {}),
    ...(args.with_pair !== undefined ? { with_pair: args.with_pair } : {}),
    data_product_id: args.data_product_id,
    record_ids: args.record_ids,
    ...(args.values ? { values: args.values } : {}),
    ...(args.documents ? { documents: args.documents } : {}),
    ...(args.profile ? { profile: args.profile } : {}),
  }
}

function needsTemplate(args: BatchArgs): ToolResult | null {
  if (!args.template_id && !args.template_ids?.length) {
    return validationError("name a template_id (or template_ids).")
  }
  return null
}

const DRAFT_DESCRIPTION = [
  "Fill documents without generating them: for each row and template, every field's value with its origin, and what is still missing. Nothing is stored.",
  "USE WHEN: before talonic_doc_gen_generate, to check `missing` and the values the data gives.",
  ENTERED_RULE,
  "NOT FOR: making the files (talonic_doc_gen_generate).",
  "",
  "ARGS: `template_id` (+ `with_pair`) or `template_ids`, `data_product_id`, `record_ids[]`, optional `values`, `documents[] { record_id, template_id?, values }`, `profile`.",
  "RETURNS: { templates[] { id, name }, documents[] { template_id, template_name, record_id, record_label, filled, total, missing[] { key, label, source }, values } }.",
].join("\n")

export const draftInputSchema = batchSchema

/** @internal */
export function handleDraft(
  getToken: () => string,
  baseUrl: string | undefined,
  args: BatchArgs,
): Promise<ToolResult> {
  const invalid = needsTemplate(args)
  if (invalid) return Promise.resolve(invalid)
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", "/v1/doc-gen/drafts", { body: batchBody(args) }),
  )
}

const GENERATE_DESCRIPTION = [
  "Fill and generate the documents: one Word file (and PDF) per row and template, every value's origin kept in the document history. Refused while documents leave fields empty unless `allow_missing` (the empty fields are left out). The batch runs in the background: pass `wait_seconds` to wait for it (polls every 3 s). Run talonic_doc_gen_draft (or dry_run) first.",
  "USE WHEN: the user asks to generate letters or agreements for rows of a product.",
  ENTERED_RULE,
  "NOT FOR: checking values (talonic_doc_gen_draft).",
  "",
  "ARGS: as talonic_doc_gen_draft, plus `save_to_workspace` (default true; false deletes the files after 24 hours), `allow_missing`, `dry_run` (the drafts only), `wait_seconds` (0-300, default 0).",
  "RETURNS: { dry_run, documents[] (as draft), job { id, status running|completed|failed, documents[] { id, status, files[] { kind, name, size }, error, pdfError } } } and after a wait also { waited_ms, still_running }. Download with talonic_doc_gen_file.",
].join("\n")

export const generateInputSchema = {
  ...batchSchema,
  save_to_workspace: z
    .boolean()
    .optional()
    .describe("Keep the files in the workspace (default true); false deletes them after 24 h."),
  allow_missing: z
    .boolean()
    .optional()
    .describe("Generate although fields are empty (they are left out of the documents)."),
  dry_run: z.boolean().optional().describe("Return the drafts only; no batch is made."),
  wait_seconds: z
    .number()
    .min(0)
    .max(GENERATE_MAX_WAIT_S)
    .optional()
    .describe(`Seconds to wait for the batch to finish (0-${GENERATE_MAX_WAIT_S}).`),
}

interface JobEnvelope {
  dry_run?: boolean
  documents?: unknown
  job?: { id?: string; status?: string } | null
}

/** @internal */
export function handleGenerate(
  getToken: () => string,
  baseUrl: string | undefined,
  args: BatchArgs & {
    save_to_workspace?: boolean
    allow_missing?: boolean
    dry_run?: boolean
    wait_seconds?: number
  },
  deps: DocGenDeps = {},
): Promise<ToolResult> {
  const invalid = needsTemplate(args)
  if (invalid) return Promise.resolve(invalid)
  const waitS = waitSeconds(args.wait_seconds, GENERATE_MAX_WAIT_S)
  return runTool(async () => {
    const created = await apiJson<JobEnvelope>(getToken, baseUrl, "POST", "/v1/doc-gen/jobs", {
      body: {
        ...batchBody(args),
        ...(args.save_to_workspace !== undefined
          ? { save_to_workspace: args.save_to_workspace }
          : {}),
        allow_missing: args.allow_missing ?? false,
        dry_run: args.dry_run ?? false,
      },
    })
    const jobId = created.job?.id
    if (waitS === 0 || !jobId || created.job?.status !== "running") return created
    const polled = await pollUntilDone(
      created.job,
      () =>
        apiJson<NonNullable<JobEnvelope["job"]>>(
          getToken,
          baseUrl,
          "GET",
          `/v1/doc-gen/jobs/${jobId}`,
        ),
      (job) => job?.status === "running",
      waitS,
      deps,
    )
    return {
      ...created,
      job: polled.value,
      waited_ms: polled.waited_ms,
      still_running: polled.still_running,
      ...(polled.poll_error ? { poll_error: polled.poll_error } : {}),
    }
  })
}

const JOBS_DESCRIPTION = [
  "Generated batches: the history (newest first, with document, failed and PDF-missing counts), or one batch with its documents, their files and errors.",
  "USE WHEN: checking a batch started by talonic_doc_gen_generate, or finding the document ids to download.",
  "NOT FOR: the file itself (talonic_doc_gen_file).",
  "",
  "ARGS: `job_id` (one batch; omit for the history), `limit` (1-50, history only).",
  "RETURNS: { data[] } or one batch { id, status, templateNames, savedToWorkspace, filesExpireAt, filesExpired, documents[] { id, recordLabel, status, files[] { kind, name, size }, error, pdfError } }.",
].join("\n")

export const jobsInputSchema = {
  job_id: jobIdArg.optional(),
  limit: z.number().int().min(1).max(50).optional().describe("History entries (default 50)."),
}

/** @internal */
export function handleJobs(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { job_id?: string; limit?: number },
): Promise<ToolResult> {
  return runTool(() =>
    args.job_id
      ? apiJson(getToken, baseUrl, "GET", `/v1/doc-gen/jobs/${args.job_id}`)
      : apiJson(getToken, baseUrl, "GET", "/v1/doc-gen/jobs", { params: { limit: args.limit } }),
  )
}

const RETRY_PDF_DESCRIPTION = [
  "Make a batch's missing PDFs again (documents whose Word file was made but the PDF conversion failed).",
  "USE WHEN: talonic_doc_gen_issues reports pdf_missing, or a batch's documents carry pdfError.",
  "NOT FOR: failed documents (fix the data or values and generate again).",
  "",
  "ARGS: `job_id`.",
  "RETURNS: the batch as talonic_doc_gen_jobs returns it.",
].join("\n")

export const retryPdfInputSchema = { job_id: jobIdArg }

/** @internal */
export function handleRetryPdf(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { job_id: string },
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "POST", `/v1/doc-gen/jobs/${args.job_id}/pdf`))
}

const FILE_DESCRIPTION = [
  `Download one generated document as an embedded file (base64 blob with its media type and filename), up to ${DOC_GEN_MAX_FILE_BYTES / (1024 * 1024)} MB.`,
  "USE WHEN: the user wants the generated Word file or PDF of a document.",
  "NOT FOR: the batch's state (talonic_doc_gen_jobs).",
  "",
  "ARGS: `job_id`, `document_id` (documents[].id of the batch), `kind` docx|pdf (default docx).",
  "RETURNS: a text item { filename, mime_type, size } and a resource item { uri, mimeType, blob }. Files of a batch not kept in the workspace are gone after 24 hours.",
].join("\n")

export const fileInputSchema = {
  job_id: jobIdArg,
  document_id: zUuid().describe("documents[].id of the batch (talonic_doc_gen_jobs)."),
  kind: z.enum(["docx", "pdf"]).optional().describe("Word file or PDF (default docx)."),
}

/** A tool result carrying the file as an embedded resource. */
export interface FileToolResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "resource"; resource: { uri: string; mimeType: string; blob: string } }
  >
  structuredContent: Record<string, unknown>
  [key: string]: unknown
}

/** @internal */
export async function handleFile(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { job_id: string; document_id: string; kind?: "docx" | "pdf" },
  maxBytes = DOC_GEN_MAX_FILE_BYTES,
): Promise<ToolResult | FileToolResult> {
  const kind = args.kind ?? "docx"
  const path = `/v1/doc-gen/jobs/${args.job_id}/documents/${args.document_id}/file`
  try {
    const file = await apiBinary(getToken, baseUrl, path, { params: { kind }, maxBytes })
    const filename = file.filename ?? `${args.document_id}.${kind}`
    const meta = { filename, mime_type: file.mimeType, size: file.bytes.length, kind }
    return {
      content: [
        { type: "text", text: JSON.stringify(meta, null, 2) },
        {
          type: "resource",
          resource: {
            uri: buildUrl(baseUrl, path, { kind }),
            mimeType: file.mimeType,
            blob: file.bytes.toString("base64"),
          },
        },
      ],
      structuredContent: meta,
    }
  } catch (err) {
    return toolError(err)
  }
}

// ── Registration ───────────────────────────────────────────────────────────

/**
 * True when the platform behind `baseUrl` serves Document Generation to this
 * credential (`GET /v1/doc-gen/status` → 200). Both entrypoints call it before
 * registering the tools, so a deployment without the app never lists tools
 * that would 404. Any failure resolves `false`; never throws.
 *
 * @public
 */
export async function probeDocGenAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/doc-gen/status"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Register the sixteen `talonic_doc_gen_*` tools. `localFiles` (stdio
 * installs) lets the upload tool read a local `file_path`; the hosted server
 * never reads its own disk for a caller.
 *
 * @public
 */
export function registerDocGenTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
  opts: { localFiles?: boolean } = {},
): void {
  const tools: Array<
    [
      string,
      string,
      string,
      Record<string, z.ZodTypeAny>,
      ReturnType<typeof write> | typeof readOnly,
      (args: any) => Promise<ToolResult | FileToolResult>,
    ]
  > = [
    [
      "talonic_doc_gen_status",
      "Document Generation status",
      STATUS_DESCRIPTION,
      {},
      readOnly,
      () => handleStatus(getToken, baseUrl),
    ],
    [
      "talonic_doc_gen_issues",
      "Document Generation worklist",
      ISSUES_DESCRIPTION,
      {},
      readOnly,
      () => handleIssues(getToken, baseUrl),
    ],
    [
      "talonic_doc_gen_templates",
      "Word templates and field sheets",
      TEMPLATES_DESCRIPTION,
      templatesInputSchema,
      readOnly,
      (a) => handleTemplates(getToken, baseUrl, a),
    ],
    [
      "talonic_doc_gen_update_template",
      "Change a template and its fields",
      UPDATE_TEMPLATE_DESCRIPTION,
      updateTemplateInputSchema,
      // Overwrites field sources and metadata: destructive per OpenAI's annotation rules.
      write(true, true),
      (a) => handleUpdateTemplate(getToken, baseUrl, a),
    ],
    [
      "talonic_doc_gen_confirm_fields",
      "Confirm template fields",
      CONFIRM_DESCRIPTION,
      confirmInputSchema,
      write(true),
      (a) => handleConfirm(getToken, baseUrl, a),
    ],
    [
      "talonic_doc_gen_propose",
      "Propose a field sheet from a product",
      PROPOSE_DESCRIPTION,
      proposeInputSchema,
      write(false),
      (a) => handlePropose(getToken, baseUrl, a),
    ],
    [
      "talonic_doc_gen_upload_template",
      "Upload a Word template",
      UPLOAD_DESCRIPTION,
      opts.localFiles ? uploadLocalInputSchema : uploadInputSchema,
      write(false),
      (a) => handleUpload(getToken, baseUrl, a, { localFiles: opts.localFiles === true }),
    ],
    [
      "talonic_doc_gen_delete_template",
      "Delete a template",
      DELETE_DESCRIPTION,
      deleteInputSchema,
      write(true, true),
      (a) => handleDelete(getToken, baseUrl, a),
    ],
    [
      "talonic_doc_gen_products",
      "Data products and rows",
      PRODUCTS_DESCRIPTION,
      productsInputSchema,
      readOnly,
      (a) => handleProducts(getToken, baseUrl, a),
    ],
    [
      "talonic_doc_gen_rules",
      "Workspace rules",
      RULES_DESCRIPTION,
      rulesInputSchema,
      // With `rules` it replaces the whole list: destructive.
      write(true, true),
      (a) => handleRules(getToken, baseUrl, a),
    ],
    [
      "talonic_doc_gen_profile",
      "Writer profile",
      PROFILE_DESCRIPTION,
      profileInputSchema,
      // With details it overwrites the saved ones: destructive per OpenAI's annotation rules.
      write(true, true),
      (a) => handleProfile(getToken, baseUrl, a),
    ],
    [
      "talonic_doc_gen_draft",
      "Fill documents without generating",
      DRAFT_DESCRIPTION,
      draftInputSchema,
      readOnly,
      (a) => handleDraft(getToken, baseUrl, a),
    ],
    [
      "talonic_doc_gen_generate",
      "Generate documents",
      GENERATE_DESCRIPTION,
      generateInputSchema,
      write(false),
      (a) => handleGenerate(getToken, baseUrl, a),
    ],
    [
      "talonic_doc_gen_jobs",
      "Generated batches",
      JOBS_DESCRIPTION,
      jobsInputSchema,
      readOnly,
      (a) => handleJobs(getToken, baseUrl, a),
    ],
    [
      "talonic_doc_gen_retry_pdf",
      "Make missing PDFs again",
      RETRY_PDF_DESCRIPTION,
      retryPdfInputSchema,
      write(true),
      (a) => handleRetryPdf(getToken, baseUrl, a),
    ],
    [
      "talonic_doc_gen_file",
      "Download a generated document",
      FILE_DESCRIPTION,
      fileInputSchema,
      readOnly,
      (a) => handleFile(getToken, baseUrl, a),
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
