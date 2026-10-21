import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, resolveFetch, runTool } from "./_http.js"
import { toolError, validationError, type ToolResult } from "./_shared.js"

/**
 * Price Baseline tools — turn a supply contract's price clause (Wärme, Kälte,
 * Strom, Gas) into one standard price model, recompute every price period
 * from the public indices the clause names, and check invoices against it.
 *
 * All tools hit the platform's `/v1/price-baseline/*` surface with the
 * caller's bearer (raw fetch — the SDK does not wrap these routes). The
 * platform owns every rule: each stated number carries a verified quote from
 * the contract, index values carry their publisher line, and a value whose
 * quote fails verification is reported missing, never used.
 */

/** Evaluation windows are whole months. */
const MONTH_RE = /^\d{4}-\d{2}$/
/** Index periods: year, month, quarter or half-year, as the platform stores them. */
const INDEX_PERIOD_RE = /^\d{4}(-\d{2}|-Q[1-4]|-H[12])?$/

const modelIdArg = z
  .string()
  .uuid()
  .describe("Price model id (from talonic_price_baseline_models).")
const fromArg = z
  .string()
  .regex(MONTH_RE)
  .describe("First month of the evaluation window, `YYYY-MM`.")
const toArg = z.string().regex(MONTH_RE).describe("Last month of the evaluation window, `YYYY-MM`.")

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

// ── Documents ──────────────────────────────────────────────────────────────

const DOCUMENTS_DESCRIPTION = [
  "Find contracts and invoices in the workspace to build a price baseline from.",
  "USE WHEN: picking the contract for talonic_price_baseline_extract or the invoice for talonic_price_baseline_compare.",
  "NOT FOR: general document search across all content (talonic_search).",
  "",
  "ARGS: `query` (filename contains, optional).",
  "RETURNS: data[] { id, filename, created_at }. Which contracts already have a model: talonic_price_baseline_models.",
].join("\n")

export const documentsInputSchema = {
  query: z.string().optional().describe("Filename contains match (e.g. 'Wärmeliefervertrag')."),
}

/** @internal */
export function handleDocuments(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { query?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/price-baseline/documents", {
      params: { q: args.query },
    }),
  )
}

// ── Models ─────────────────────────────────────────────────────────────────

const EXTRACT_DESCRIPTION = [
  "Read a contract's price clause into a standard price model: components (Arbeitspreis, Grundpreis, CO2, ...), their formulas, the named indices with base year and reference months, and every stated number with its verified contract quote. With `model_id` instead, read only the contract's identity (contract number, customer, site) and agreed quantities into that existing model, keeping its formulas and values.",
  "USE WHEN: a contract has no price model yet (`document_id`), or a model lacks its contract number or agreed quantities, e.g. the contract workbook asks for a quantity (`model_id`). Many contracts at once: talonic_price_baseline_import.",
  "NOT FOR: generic field extraction (talonic_extract); editing an existing model (talonic_price_baseline_update_model).",
  "",
  "ARGS: `document_id` (contract UUID) or `model_id` (enrich), `use_opus` (slower, for long or unusual clauses; document_id only).",
  "RETURNS: the stored model { id, document_id, contract_key, contract_label, status, model }. Costs one LLM call. A value whose quote does not verify carries `evidence.verified: false` and counts as missing. Enrich keys the model by its contract number when it has no key yet.",
].join("\n")

export const extractInputSchema = {
  document_id: z.string().uuid().optional().describe("Contract document UUID (new model)."),
  model_id: modelIdArg
    .optional()
    .describe(
      "Existing model to enrich with contract number, customer, site and agreed quantities.",
    ),
  use_opus: z
    .boolean()
    .optional()
    .describe("Use the larger model for long or unusual price clauses."),
}

/** @internal */
export function handleExtract(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { document_id?: string; model_id?: string; use_opus?: boolean },
): Promise<ToolResult> {
  if (!!args.document_id === !!args.model_id) {
    return Promise.resolve(
      validationError("provide either `document_id` (new model) or `model_id` (enrich), not both"),
    )
  }
  if (args.model_id) {
    return runTool(() =>
      apiJson(
        getToken,
        baseUrl,
        "POST",
        `/v1/price-baseline/models/${encodeURIComponent(args.model_id as string)}/enrich`,
      ),
    )
  }
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", "/v1/price-baseline/models", {
      body: { document_id: args.document_id, use_opus: args.use_opus },
    }),
  )
}

const MODELS_DESCRIPTION = [
  "List the workspace's price models, or read one in full when `model_id` is given.",
  "USE WHEN: finding a model id, or reviewing a model's components, formulas, indices and quotes before confirming it.",
  "NOT FOR: computed prices (talonic_price_baseline_prices); invoice checks (talonic_price_baseline_compare).",
  "",
  "ARGS: `model_id` (optional UUID).",
  "RETURNS: without id, data[] { id, document_id, contract_label, status, components, unverified_values, index_series, updated_at }; with id, the stored model with its full `model`.",
].join("\n")

export const modelsInputSchema = {
  model_id: modelIdArg.optional(),
}

/** @internal */
export function handleModels(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { model_id?: string },
): Promise<ToolResult> {
  const path = args.model_id
    ? `/v1/price-baseline/models/${encodeURIComponent(args.model_id)}`
    : "/v1/price-baseline/models"
  return runTool(() => apiJson(getToken, baseUrl, "GET", path))
}

const UPDATE_DESCRIPTION = [
  "Edit a price model after review: replace its model, confirm it, place it in a contract, or exclude it.",
  "USE WHEN: a formula, index or reference month was read wrong; the reviewer confirms the model; a document belongs to another contract (`contract_key`); a document of the contract sets no price, e.g. a withdrawn letter or cover mail (`status: excluded`).",
  "NOT FOR: first extraction (talonic_price_baseline_extract); entering one missing contract value (talonic_price_baseline_answer).",
  "",
  "ARGS: `model_id`, and at least one of `model` (the full model object from talonic_price_baseline_models, edited), `status` (draft | confirmed | excluded), `contract_key` (the contract number every version of the contract shares; null clears a hand-set key), `superseded_by` (model of a later amendment that replaces this one from its valid_from; null unlinks).",
  "RETURNS: the stored model. The platform re-verifies every quote: an edited number only counts when its quote occurs in the contract and prints that number. Models with the same `contract_key` are versions of one contract, ordered by valid_from.",
].join("\n")

export const updateInputSchema = {
  model_id: modelIdArg,
  model: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("The full edited model object (the `model` field of the stored model)."),
  status: z
    .enum(["draft", "confirmed", "excluded"])
    .optional()
    .describe(
      "`confirmed` once a reviewer accepts the model; `excluded` for a document of the contract that sets no price.",
    ),
  contract_key: z
    .string()
    .max(64)
    .nullable()
    .optional()
    .describe(
      "Contract this document belongs to (its contract number); null clears a hand-set key.",
    ),
  superseded_by: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .describe("Model of the amendment or price sheet that replaces this one; null unlinks."),
}

/** @internal */
export function handleUpdate(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    model_id: string
    model?: Record<string, unknown>
    status?: "draft" | "confirmed" | "excluded"
    contract_key?: string | null
    superseded_by?: string | null
  },
): Promise<ToolResult> {
  const { model_id, ...patch } = args
  if (Object.values(patch).every((v) => v === undefined)) {
    return Promise.resolve(
      validationError("provide at least one of `model`, `status`, `contract_key`, `superseded_by`"),
    )
  }
  return runTool(() =>
    apiJson(getToken, baseUrl, "PUT", `/v1/price-baseline/models/${encodeURIComponent(model_id)}`, {
      body: patch,
    }),
  )
}

// ── Prices + workbook ──────────────────────────────────────────────────────

const PRICES_DESCRIPTION = [
  "Recompute every price of a model for each price period in a window, from the index values on file.",
  "USE WHEN: you need the contract's own price per period, independent of the biller's price sheet.",
  "NOT FOR: checking a specific invoice (talonic_price_baseline_compare); the Excel file (talonic_price_baseline_workbook).",
  "",
  "ARGS: `model_id`, `from`, `to` (YYYY-MM).",
  "RETURNS: prices[] { component, period { label, from, to }, price, unit, status, detail, indices[] { variable, series, months, value, sources, independent } } and the index values used. `status` other than ok (missing_index, missing_value, rebase_mismatch, custom_reference, formula_error) means `price` is null; nothing is estimated. Fetch missing public indices with talonic_price_baseline_refresh_indices.",
].join("\n")

export const pricesInputSchema = { model_id: modelIdArg, from: fromArg, to: toArg }

/** @internal */
export function handlePrices(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { model_id: string; from: string; to: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "GET",
      `/v1/price-baseline/models/${encodeURIComponent(args.model_id)}/prices`,
      {
        params: { from: args.from, to: args.to },
      },
    ),
  )
}

const WORKBOOK_DESCRIPTION = [
  "Download the standard Excel workbook for a model: Variablen, Preise (live formulas), Indizes, Rechnungsprüfung, Hinweise, Quellen. Every contract comes out in the same layout.",
  "USE WHEN: the user wants the baseline as a spreadsheet, or to hand over an invoice check.",
  "NOT FOR: reading prices as data (talonic_price_baseline_prices).",
  "",
  "ARGS: `model_id`, `from`, `to` (YYYY-MM), `comparison_id` (optional, fills the Rechnungsprüfung sheet).",
  "RETURNS: the .xlsx as an embedded resource (base64) plus its filename and size.",
].join("\n")

export const workbookInputSchema = {
  model_id: modelIdArg,
  from: fromArg,
  to: toArg,
  comparison_id: z
    .string()
    .uuid()
    .optional()
    .describe("Invoice comparison to include (from talonic_price_baseline_compare)."),
}

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** @internal */
export async function handleWorkbook(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { model_id: string; from: string; to: string; comparison_id?: string },
): Promise<ToolResult> {
  try {
    const url = buildUrl(
      baseUrl,
      `/v1/price-baseline/models/${encodeURIComponent(args.model_id)}/workbook.xlsx`,
      {
        from: args.from,
        to: args.to,
        comparison_id: args.comparison_id,
      },
    )
    const res = await resolveFetch(getToken)(url, {
      headers: { Authorization: `Bearer ${getToken()}`, Accept: XLSX_MIME },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Talonic API error: HTTP ${res.status}${text ? ` — ${text}` : ""}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const filename =
      /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ??
      `price-baseline-${args.model_id}.xlsx`
    // The envelope type only models text items; the MCP spec also allows an
    // embedded resource, which is how a binary file reaches the client.
    return {
      content: [
        { type: "text", text: JSON.stringify({ filename, bytes: buf.length }, null, 2) },
        {
          type: "resource",
          resource: {
            uri: `talonic://price-baseline/${args.model_id}/${filename}`,
            mimeType: XLSX_MIME,
            blob: buf.toString("base64"),
          },
        },
      ],
    } as unknown as ToolResult
  } catch (err) {
    return toolError(err)
  }
}

// ── Invoice comparison ─────────────────────────────────────────────────────

const COMPARE_DESCRIPTION = [
  "Check an invoice against a model: read the invoice's billed prices and quantities, recompute each price from the contract, and report the difference per line.",
  "USE WHEN: establishing Money Found for an invoice, or listing past checks (`list: true`).",
  "NOT FOR: prices without an invoice (talonic_price_baseline_prices).",
  "",
  "ARGS: `model_id`, `invoice_document_id` (invoice UUID, to run a new check) or `list: true` (past checks).",
  "RETURNS: { id, invoice, prices, comparison { lines[] { line, baseline_price, billed_price, unit, effect_eur, verdict, reason, independent }, totals { underbilled_eur, overbilled_eur, compared_lines, not_comparable_lines }, amendment_suspects[] } }. Suspected amendments are held out of totals. A baseline built on an index printed only on the invoice is `independent: false`. Costs one LLM call.",
].join("\n")

export const compareInputSchema = {
  model_id: modelIdArg,
  invoice_document_id: z.string().uuid().optional().describe("Invoice document UUID to check."),
  list: z
    .boolean()
    .optional()
    .describe("List this model's past comparisons instead of running one."),
}

/** @internal */
export function handleCompare(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { model_id: string; invoice_document_id?: string; list?: boolean },
): Promise<ToolResult> {
  const base = `/v1/price-baseline/models/${encodeURIComponent(args.model_id)}`
  if (args.list) return runTool(() => apiJson(getToken, baseUrl, "GET", `${base}/comparisons`))
  if (!args.invoice_document_id) {
    return Promise.resolve(
      validationError("provide `invoice_document_id`, or `list: true` for past comparisons"),
    )
  }
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", `${base}/compare`, {
      body: { invoice_document_id: args.invoice_document_id },
    }),
  )
}

// ── Audit-proof invoice ────────────────────────────────────────────────────

const PROOF_INVOICE_DESCRIPTION = [
  "Restate a checked invoice as the audit-proof invoice the contract supports: every line restated at the contract price, every input (base value, weight, index value, quantity) listed with its source (contract quote, publisher URL and line, the biller's invoice, or a marked assumption), and eight checks that say whether the restatement holds up without anyone's word for it.",
  "USE WHEN: an invoice was already checked (a comparison exists) and the user needs the corrected invoice to send, file or audit, or wants to know what still keeps it from being audit-proof.",
  "NOT FOR: running a new check or listing past checks (talonic_price_baseline_compare); prices without an invoice (talonic_price_baseline_prices).",
  "",
  "ARGS: `comparison_id` (from talonic_price_baseline_compare), `format` (json, default | html).",
  "RETURNS (json): { lines[] { label, quantity, unit_price, amount, billed_amount, delta, inputs[] { symbol, value, period, source }, verdict, independent }, totals { net, billed_net, delta, tax_rate, tax, gross }, checks[8] { key, label, passed, detail }, audit_proof, hash, sources[], restates, currency, pdf_url }. delta > 0 = billed too little. html: { html (self-contained page), pdf_url }. pdf_url needs the same bearer; this tool does not download it.",
].join("\n")

export const proofInvoiceInputSchema = {
  comparison_id: z.string().uuid().describe("Comparison UUID (talonic_price_baseline_compare)."),
  format: z
    .enum(["json", "html"])
    .optional()
    .describe("json (default): the restated invoice; html: the self-contained page."),
}

/** @internal */
export function handleProofInvoice(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { comparison_id: string; format?: "json" | "html" },
): Promise<ToolResult> {
  const path = `/v1/price-baseline/comparisons/${encodeURIComponent(args.comparison_id)}/proof-invoice`
  return runTool(async () => {
    const { invoice, html } = await apiJson<{ invoice: Record<string, unknown>; html: string }>(
      getToken,
      baseUrl,
      "GET",
      path,
    )
    const pdf_url = buildUrl(baseUrl, `${path}.pdf`)
    return args.format === "html" ? { html, pdf_url } : { ...invoice, pdf_url }
  })
}

// ── Indices ────────────────────────────────────────────────────────────────

const INDICES_DESCRIPTION = [
  "Show the index catalog (series the platform can fetch or accept manually), the sync state of the workspace's external series, or the stored values of given series.",
  "USE WHEN: a price period reports a missing index, to see which source a value came from, or to see which series are stale or failing (`view: sync`).",
  "NOT FOR: fetching new values (talonic_price_baseline_sync_series, talonic_price_baseline_refresh_indices) or entering them (talonic_price_baseline_add_index_values).",
  "",
  "ARGS: `series` (optional list of series keys, e.g. ['destatis.vpi', 'behg.co2']) for values; else `view` (catalog, default | sync).",
  "RETURNS: values data[] { series, period, value, unit, base_year, source, source_url, quote, document_id }; catalog data[] { key, label, provider, unit, base_year, note, stored { count, first, last } }; sync data[] { key, label, provider, connector (catalog | manual), shared, sync_hours, active, last_synced_at, last_status, last_error, due, stored, contracts (how many contracts read it) }.",
].join("\n")

export const indicesInputSchema = {
  series: z.array(z.string().min(1)).max(50).optional().describe("Series keys to read values for."),
  view: z
    .enum(["catalog", "sync"])
    .optional()
    .describe("Without `series`: the catalog (default) or each series' sync state."),
}

/** @internal */
export function handleIndices(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { series?: string[]; view?: "catalog" | "sync" },
): Promise<ToolResult> {
  if (args.series?.length) {
    return runTool(() =>
      apiJson(getToken, baseUrl, "GET", "/v1/price-baseline/indices/values", {
        params: { series: args.series?.join(",") },
      }),
    )
  }
  if (args.view === "sync") {
    return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/price-baseline/data/series"))
  }
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/price-baseline/indices"))
}

const REFRESH_DESCRIPTION = [
  "Fetch index values from their publishers: BEHG CO2 price (§10 law text), Bundesbank VPI and Erzeugerpreise, Destatis GENESIS tables (needs the platform's GENESIS token).",
  "USE WHEN: talonic_price_baseline_prices reports a missing public index for a specific year range (backfill).",
  "NOT FOR: routine sync of every due series (talonic_price_baseline_sync_series); THE levies or grid tariffs, which have no free feed (talonic_price_baseline_add_index_values).",
  "",
  "ARGS: `series` (catalog keys), `from_year`, `to_year`.",
  "RETURNS: data[] { series, stored, error }. A failed series reports its error; it never succeeds empty.",
].join("\n")

export const refreshInputSchema = {
  series: z.array(z.string().min(1)).min(1).max(20).describe("Catalog series keys to fetch."),
  from_year: z.number().int().min(2000).max(2100).describe("First year to fetch."),
  to_year: z.number().int().min(2000).max(2100).describe("Last year to fetch."),
}

/** @internal */
export function handleRefresh(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { series: string[]; from_year: number; to_year: number },
): Promise<ToolResult> {
  if (args.to_year < args.from_year)
    return Promise.resolve(validationError("`to_year` is before `from_year`"))
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", "/v1/price-baseline/indices/refresh", { body: args }),
  )
}

const MANUAL_DESCRIPTION = [
  "Enter index values that have no free feed (EEX, THE levies, grid tariffs) for this workspace, each with its source.",
  "USE WHEN: a price needs an index talonic_price_baseline_refresh_indices cannot fetch.",
  "NOT FOR: public series with a feed (talonic_price_baseline_refresh_indices).",
  "",
  "ARGS: `values[]` { series, period (YYYY, YYYY-MM, YYYY-Qn, YYYY-Hn), value, unit?, base_year?, quote, source_url | document_id }. `quote` is the publisher's own line printing the value; a document-backed quote must verify in that document.",
  "RETURNS: { stored }. A value without a quote and a URL or document is rejected. Never enter a value you did not read from its publication.",
].join("\n")

export const manualInputSchema = {
  values: z
    .array(
      z.object({
        series: z.string().min(1),
        period: z.string().regex(INDEX_PERIOD_RE),
        value: z.number(),
        unit: z.string().optional(),
        base_year: z.number().int().optional(),
        quote: z.string().min(1).describe("The publisher's line that prints this value."),
        source_url: z.string().url().optional(),
        document_id: z.string().uuid().optional(),
      }),
    )
    .min(1)
    .max(500)
    .describe("Index values, each with its source."),
}

/** @internal */
export function handleManual(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { values: Array<{ source_url?: string; document_id?: string } & Record<string, unknown>> },
): Promise<ToolResult> {
  const unsourced = args.values.findIndex((v) => !v.source_url && !v.document_id)
  if (unsourced >= 0) {
    return Promise.resolve(
      validationError(`values[${unsourced}] needs a \`source_url\` or \`document_id\``),
    )
  }
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", "/v1/price-baseline/indices/manual", { body: args }),
  )
}

// ── Contract register + workbook grid ──────────────────────────────────────

const RULES =
  "RULES: every number needs a source: a verbatim contract quote that prints it, or a publisher URL plus the publisher's line. Nothing is estimated. An assumption is marked on every number built on it, is never independent, and is replaced by a real value automatically."

const REGISTER_DESCRIPTION = [
  "The contract register: one row per contract (all its documents as versions), with the expected invoice for a year and what is still open.",
  "USE WHEN: seeing what every contract should bill for a year, which contracts still have open inputs, or finding a contract's `id` and `contract_key`.",
  "NOT FOR: one contract's open inputs in detail (talonic_price_baseline_contract); single model documents (talonic_price_baseline_models).",
  "",
  "ARGS: `year` (optional; default the last full calendar year).",
  "RETURNS: data[] { id (latest version's model id), contract_key, contract_number, customer, customer_number, site, contract_label, valid_from, versions, amended, priced, expected { basis (invoice | plan), net, vat, gross, currency, complete, assumed_net }, invoice { comparison_id, invoice_number, period_from, period_to } | null, open { price (unanswered), waiting (source chosen), assumed, invoice (still missing), period } }. `complete: false` means the totals cover only what could be computed; `assumed_net` is the part resting on assumptions.",
].join("\n")

export const registerInputSchema = {
  year: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional()
    .describe("Calendar year the expected invoice is computed for."),
}

/** @internal */
export function handleRegister(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { year?: number },
): Promise<ToolResult> {
  return runTool(async () => ({
    data: await apiJson(getToken, baseUrl, "GET", "/v1/price-baseline/register", {
      params: { year: args.year },
    }),
  }))
}

const CONTRACT_DESCRIPTION = [
  "One contract's workbook: what it should bill for a period, every open input as a question with the ways to answer it, and the assumptions its numbers rest on.",
  "USE WHEN: finding what is missing for a contract before answering it, or checking the expected invoice after an answer.",
  "NOT FOR: the Excel file (talonic_price_baseline_workbook); all contracts at once (talonic_price_baseline_register).",
  "",
  "ARGS: `model_id` (any version), one period: `year`, `comparison_id` (an invoice check) or `from`+`to` (YYYY-MM); default the newest invoice check, else the last full year. `include_grid` adds all cells.",
  "RETURNS: { contract_key, period, expected { basis, net, vat, gross, complete, assumed_net }, open[] { key, kind, model_id, variable, series, periods, question, options, decision, assumption, assume_target }, assumptions[], gaps[], sources[], sheets[] }.",
  "ANSWER by the input's options: enter_contract_value, from_invoice, request → talonic_price_baseline_answer (with the input's `model_id`); enter_published → talonic_price_baseline_add_index_values; assume → talonic_price_baseline_assume (`assume_target`); upload_invoice → talonic_price_baseline_compare.",
  RULES,
].join("\n")

export const contractInputSchema = {
  model_id: modelIdArg,
  year: z.number().int().min(2000).max(2100).optional().describe("Calendar year to prepare."),
  comparison_id: z
    .string()
    .uuid()
    .optional()
    .describe("Invoice check whose period and quantities to use."),
  from: fromArg.optional(),
  to: toArg.optional(),
  include_grid: z
    .boolean()
    .optional()
    .describe("Include every sheet's cell rows (large). Default: sheet names and row counts only."),
}

/** @internal */
export function handleContract(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    model_id: string
    year?: number
    comparison_id?: string
    from?: string
    to?: string
    include_grid?: boolean
  },
): Promise<ToolResult> {
  if (!!args.from !== !!args.to) {
    return Promise.resolve(validationError("give `from` and `to` together"))
  }
  const periods = [args.year !== undefined, !!args.comparison_id, !!args.from].filter(Boolean)
  if (periods.length > 1) {
    return Promise.resolve(
      validationError("choose one period: `year`, `comparison_id`, or `from`+`to`"),
    )
  }
  if (args.from && args.to && args.from > args.to) {
    return Promise.resolve(validationError("`to` is before `from`"))
  }
  return runTool(async () => {
    const book = await apiJson<{ sheets?: Array<{ name: string; rows?: unknown[] }> }>(
      getToken,
      baseUrl,
      "GET",
      `/v1/price-baseline/models/${encodeURIComponent(args.model_id)}/sheets`,
      {
        params: {
          year: args.year,
          comparison_id: args.comparison_id,
          from: args.from,
          to: args.to,
        },
      },
    )
    if (args.include_grid || !Array.isArray(book?.sheets)) return book
    return {
      ...book,
      sheets: book.sheets.map((s) => ({ name: s.name, rows: s.rows?.length ?? 0 })),
    }
  })
}

// ── Answering open inputs ──────────────────────────────────────────────────

const ANSWER_DESCRIPTION = [
  "Answer an open input of a contract workbook: enter a contract value with its verbatim quote, or record where the value will come from.",
  "USE WHEN: talonic_price_baseline_contract lists an open input whose options include enter_contract_value, from_invoice or request.",
  "NOT FOR: published index values (talonic_price_baseline_add_index_values); stand-in values (talonic_price_baseline_assume); editing formulas (talonic_price_baseline_update_model).",
  "",
  "ARGS: `model_id` (the open input's own `model_id`: the version that states the value), `action`:",
  "- enter_contract_value: `variable` (the input's `variable`), `value`, `quote` (the contract's passage, copied verbatim, that prints the value).",
  "- choose_source: `key` (the input's `key`), `choice` (from_invoice | request; null clears), `note`.",
  "RETURNS: enter_contract_value, the stored model; choose_source, { key, decision }. A quote that does not occur in the contract or does not print the value is rejected and nothing is saved. A choice records a plan; it never fills a number.",
  RULES,
].join("\n")

export const answerInputSchema = {
  model_id: modelIdArg,
  action: z.enum(["enter_contract_value", "choose_source"]),
  variable: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe("Model variable name (enter_contract_value)."),
  value: z.number().optional().describe("The number the contract states (enter_contract_value)."),
  quote: z
    .string()
    .min(1)
    .max(2000)
    .optional()
    .describe("Verbatim contract passage that prints the value (enter_contract_value)."),
  key: z.string().min(1).max(300).optional().describe("Open input key (choose_source)."),
  choice: z
    .enum(["from_invoice", "request"])
    .nullable()
    .optional()
    .describe("Where the value will come from; null clears the choice (choose_source)."),
  note: z.string().max(2000).optional().describe("Why, or whom to ask (choose_source)."),
}

/** @internal */
export function handleAnswer(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    model_id: string
    action: "enter_contract_value" | "choose_source"
    variable?: string
    value?: number
    quote?: string
    key?: string
    choice?: "from_invoice" | "request" | null
    note?: string
  },
): Promise<ToolResult> {
  const base = `/v1/price-baseline/models/${encodeURIComponent(args.model_id)}`
  if (args.action === "enter_contract_value") {
    if (!args.variable || args.value === undefined || !args.quote?.trim()) {
      return Promise.resolve(
        validationError(
          "enter_contract_value needs `variable`, `value` and `quote` (the verbatim contract passage printing the value)",
        ),
      )
    }
    return runTool(() =>
      apiJson(getToken, baseUrl, "POST", `${base}/values`, {
        body: { variable: args.variable, value: args.value, quote: args.quote },
      }),
    )
  }
  if (!args.key || args.choice === undefined) {
    return Promise.resolve(
      validationError("choose_source needs `key` and `choice` (from_invoice | request | null)"),
    )
  }
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", `${base}/decide`, {
      body: { key: args.key, choice: args.choice, note: args.note ?? null },
    }),
  )
}

// ── Assumptions ────────────────────────────────────────────────────────────

const ASSUMPTIONS_DESCRIPTION = [
  "List the active assumptions: stand-in values used where no real value exists yet.",
  "USE WHEN: reviewing what the numbers rest on, or finding an assumption's id to replace or withdraw it.",
  "NOT FOR: making or changing one (talonic_price_baseline_assume).",
  "",
  "ARGS: `contract_key` (optional; the assumptions that apply to that contract, its own and the workspace's). Without it, every active assumption of the workspace.",
  "RETURNS: data[] { id, contract_key (null = workspace), target_kind, target, period_from, period_to, rule, value, unit, params { series, factor }, note, created_by }.",
].join("\n")

export const assumptionsInputSchema = {
  contract_key: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe("Contract key (from the register) to list the assumptions applying to it."),
}

/** @internal */
export function handleAssumptions(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { contract_key?: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/price-baseline/assumptions", {
      params: { contract_key: args.contract_key },
    }),
  )
}

const ASSUME_DESCRIPTION = [
  "Make, replace or withdraw an assumption: a marked stand-in for a value nobody has yet, for one contract or the whole workspace.",
  "USE WHEN: an open input offers `assume` and the real value cannot be had now (e.g. a levy not yet published, a quantity the customer has not sent). Use the input's `assume_target` as `target_kind` + `target`.",
  "NOT FOR: a value you can source: enter it (talonic_price_baseline_answer, talonic_price_baseline_add_index_values). Never assume a number you could read.",
  "",
  "ARGS: `action` (create | replace | withdraw), `assumption_id` (replace, withdraw). create/replace (full assumption): `scope` (contract + `contract_key` | workspace), `target_kind` (series | variable | quantity | profile), `target` (series key or variable; `*` = every series, carry_forward only), `rule`, `value`, `unit`, `params { series, factor }`, `period_from`/`period_to` (YYYY[-MM|-Qn|-Hn]; omit = open-ended), `note` (required: why).",
  "Rule value = this number; carry_forward = the series' last real value; proxy = `params.series` × `params.factor`. A contract assumption wins over a workspace one. Withdraw reopens the gap.",
  "RETURNS: the stored assumption, or { id, active: false }.",
  RULES,
].join("\n")

export const assumeInputSchema = {
  action: z.enum(["create", "replace", "withdraw"]),
  assumption_id: z.string().uuid().optional().describe("Assumption to replace or withdraw."),
  scope: z
    .enum(["contract", "workspace"])
    .optional()
    .describe("One contract (needs `contract_key`) or every contract of the workspace."),
  contract_key: z.string().min(1).max(64).optional().describe("Contract key (scope: contract)."),
  target_kind: z.enum(["series", "variable", "quantity", "profile"]).optional(),
  target: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("Series key or variable name; `*` = every series."),
  rule: z.enum(["value", "carry_forward", "proxy"]).optional(),
  value: z.number().optional().describe("The assumed number (rule: value)."),
  unit: z.string().max(40).optional(),
  params: z
    .object({
      series: z.string().min(1).max(120).optional().describe("Source series (proxy, profile)."),
      factor: z.number().optional().describe("Multiplier on the source series (proxy)."),
    })
    .optional(),
  period_from: z.string().regex(INDEX_PERIOD_RE).optional(),
  period_to: z.string().regex(INDEX_PERIOD_RE).optional(),
  note: z.string().min(1).max(2000).optional().describe("Why this assumption is made (required)."),
}

type AssumeArgs = {
  action: "create" | "replace" | "withdraw"
  assumption_id?: string
  scope?: "contract" | "workspace"
  contract_key?: string
  target_kind?: "series" | "variable" | "quantity" | "profile"
  target?: string
  rule?: "value" | "carry_forward" | "proxy"
  value?: number
  unit?: string
  params?: { series?: string; factor?: number }
  period_from?: string
  period_to?: string
  note?: string
}

/** Mirrors the platform's own checks so a doomed call fails fast with a clear reason. */
function assumptionProblem(a: AssumeArgs): string | null {
  if (!a.scope) return "`scope` is required: contract (with `contract_key`) or workspace"
  if (a.scope === "contract" && !a.contract_key?.trim())
    return "scope contract needs `contract_key`"
  if (a.scope === "workspace" && a.contract_key) return "scope workspace takes no `contract_key`"
  if (!a.target_kind || !a.target?.trim() || !a.rule)
    return "`target_kind`, `target` and `rule` are required"
  if (!a.note?.trim()) return "`note` is required: say why the value is assumed"
  if (a.rule === "value" && a.target_kind !== "profile" && a.value === undefined)
    return "rule value needs `value`"
  if (a.rule === "carry_forward" && a.target_kind !== "series")
    return "only a series value can be carried forward"
  if ((a.rule === "proxy" || a.target_kind === "profile") && !a.params?.series)
    return "name the series it is derived from in `params.series`"
  if (a.target === "*" && (a.target_kind !== "series" || a.rule !== "carry_forward"))
    return "a default for every series (*) can only carry the last value forward"
  return null
}

/** @internal */
export function handleAssume(
  getToken: () => string,
  baseUrl: string | undefined,
  args: AssumeArgs,
): Promise<ToolResult> {
  const path = (id: string) => `/v1/price-baseline/assumptions/${encodeURIComponent(id)}`
  if (args.action !== "create" && !args.assumption_id) {
    return Promise.resolve(validationError(`${args.action} needs \`assumption_id\``))
  }
  if (args.action === "withdraw") {
    return runTool(() => apiJson(getToken, baseUrl, "DELETE", path(args.assumption_id as string)))
  }
  const problem = assumptionProblem(args)
  if (problem) return Promise.resolve(validationError(problem))
  const body = {
    contract_key: args.scope === "contract" ? args.contract_key?.trim() : null,
    target_kind: args.target_kind,
    target: args.target?.trim(),
    rule: args.rule,
    value: args.rule === "value" ? (args.value ?? null) : null,
    unit: args.unit ?? null,
    params: args.params,
    period_from: args.period_from ?? null,
    period_to: args.period_to ?? null,
    note: args.note?.trim(),
  }
  return args.action === "create"
    ? runTool(() => apiJson(getToken, baseUrl, "POST", "/v1/price-baseline/assumptions", { body }))
    : runTool(() => apiJson(getToken, baseUrl, "PUT", path(args.assumption_id as string), { body }))
}

// ── External data sync ─────────────────────────────────────────────────────

const SYNC_DESCRIPTION = [
  "Sync external price data now (BEHG, Bundesbank, Destatis, EEX via Energy-Charts, DWD degree days), or change how often a series syncs.",
  "USE WHEN: talonic_price_baseline_indices `view: sync` shows a series as due, failed or stale, or a contract waits on a published value that should be out by now.",
  "NOT FOR: series with no feed, e.g. THE levies and grid tariffs (talonic_price_baseline_add_index_values); a backfill for a specific year range (talonic_price_baseline_refresh_indices).",
  "",
  "ARGS: sync: `keys` (series keys; omit to sync every shared series whose interval has passed). Schedule: `key` with `sync_hours` (1–2160) and/or `active` (false pauses; a shared series changes for everyone).",
  "RETURNS: sync data[] { series, stored, error } (a failed series reports its error, never an empty success); schedule, the series definition. Values arriving replace any assumption standing in for them.",
].join("\n")

export const syncInputSchema = {
  keys: z.array(z.string().min(1)).max(50).optional().describe("Series keys to fetch now."),
  key: z.string().min(1).max(120).optional().describe("Series whose schedule to change."),
  sync_hours: z.number().int().min(1).max(2160).optional().describe("Sync interval in hours."),
  active: z.boolean().optional().describe("false pauses syncing."),
}

/** @internal */
export function handleSync(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { keys?: string[]; key?: string; sync_hours?: number; active?: boolean },
): Promise<ToolResult> {
  const schedule =
    args.key !== undefined || args.sync_hours !== undefined || args.active !== undefined
  if (schedule) {
    if (args.keys?.length) {
      return Promise.resolve(
        validationError("either sync (`keys`) or change a schedule (`key`), not both"),
      )
    }
    if (!args.key || (args.sync_hours === undefined && args.active === undefined)) {
      return Promise.resolve(
        validationError("a schedule change needs `key` and `sync_hours` or `active`"),
      )
    }
    return runTool(() =>
      apiJson(getToken, baseUrl, "PUT", "/v1/price-baseline/data/series", {
        body: { key: args.key, sync_hours: args.sync_hours, active: args.active },
      }),
    )
  }
  return runTool(async () => ({
    data: await apiJson(getToken, baseUrl, "POST", "/v1/price-baseline/data/series/sync", {
      body: args.keys?.length ? { keys: args.keys } : {},
    }),
  }))
}

// ── Import from data capture ───────────────────────────────────────────────

const IMPORTS_DESCRIPTION = [
  "Contract documents in data capture that have no price model yet, grouped by contract number, or the state of the import queue.",
  "USE WHEN: bringing a workspace's contracts into Price Baseline: pick candidates, queue them with talonic_price_baseline_import, then poll `view: status`.",
  "NOT FOR: documents that already have a model (talonic_price_baseline_register); invoices (talonic_price_baseline_documents).",
  "",
  "ARGS: `view` (candidates, default | status), `query` (filename contains; candidates only).",
  "RETURNS: candidates data[] { contract_key, documents[] { document_id, filename, kind (contract | amendment | price_sheet), created_at, import { status, error } | null } }; status { counts { pending, processing, done, failed }, failed[] { document_id, filename, error, attempts } }.",
].join("\n")

export const importsInputSchema = {
  view: z.enum(["candidates", "status"]).optional(),
  query: z.string().optional().describe("Filename contains match (candidates)."),
}

/** @internal */
export function handleImports(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { view?: "candidates" | "status"; query?: string },
): Promise<ToolResult> {
  if (args.view === "status") {
    return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/price-baseline/import/status"))
  }
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/price-baseline/import/candidates", {
      params: { q: args.query },
    }),
  )
}

const IMPORT_DESCRIPTION = [
  "Queue contract documents for import: each one's price model is read in the background, and documents sharing a contract number become versions of one contract.",
  "USE WHEN: importing several contracts at once from talonic_price_baseline_imports candidates, or retrying failed imports (a failed document is queued again).",
  "NOT FOR: one contract you want to read now and inspect (talonic_price_baseline_extract).",
  "",
  "ARGS: `document_ids` (1–500 document UUIDs).",
  "RETURNS: { queued, skipped } (a document already queued or done is skipped). Each document costs one LLM call. Poll talonic_price_baseline_imports `view: status`; finished contracts appear in talonic_price_baseline_register.",
].join("\n")

export const importInputSchema = {
  document_ids: z
    .array(z.string().uuid())
    .min(1)
    .max(500)
    .describe("Contract document UUIDs (from talonic_price_baseline_imports)."),
}

/** @internal */
export function handleImport(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { document_ids: string[] },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "POST", "/v1/price-baseline/import", {
      body: { document_ids: [...new Set(args.document_ids)] },
    }),
  )
}

// ── Registration ───────────────────────────────────────────────────────────

/**
 * True when the platform behind `baseUrl` serves Price Baseline to this
 * credential (`GET /v1/price-baseline/indices` → 200). Both entrypoints call
 * it before registering the tools, so a deployment without the app never lists
 * tools that would 404. Any failure resolves `false`; never throws.
 *
 * @public
 */
export async function probePriceBaselineAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/price-baseline/indices"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Register the nineteen `talonic_price_baseline_*` tools.
 *
 * @public
 */
export function registerPriceBaselineTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const write = (idempotent: boolean) =>
    ({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: idempotent,
      openWorldHint: false,
    }) as const

  server.registerTool(
    "talonic_price_baseline_documents",
    {
      title: "Find contracts and invoices",
      description: DOCUMENTS_DESCRIPTION,
      inputSchema: documentsInputSchema,
      annotations: readOnly,
    },
    async (args) => handleDocuments(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_extract",
    {
      title: "Build or enrich a price model from a contract",
      description: EXTRACT_DESCRIPTION,
      inputSchema: extractInputSchema,
      annotations: write(false),
    },
    async (args) => handleExtract(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_models",
    {
      title: "List or read price models",
      description: MODELS_DESCRIPTION,
      inputSchema: modelsInputSchema,
      annotations: readOnly,
    },
    async (args) => handleModels(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_update_model",
    {
      title: "Edit or confirm a price model",
      description: UPDATE_DESCRIPTION,
      inputSchema: updateInputSchema,
      annotations: write(true),
    },
    async (args) => handleUpdate(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_prices",
    {
      title: "Recompute contract prices",
      description: PRICES_DESCRIPTION,
      inputSchema: pricesInputSchema,
      annotations: readOnly,
    },
    async (args) => handlePrices(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_workbook",
    {
      title: "Download the price baseline workbook",
      description: WORKBOOK_DESCRIPTION,
      inputSchema: workbookInputSchema,
      annotations: readOnly,
    },
    async (args) => handleWorkbook(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_compare",
    {
      title: "Check an invoice against the contract",
      description: COMPARE_DESCRIPTION,
      inputSchema: compareInputSchema,
      annotations: write(false),
    },
    async (args) => handleCompare(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_proof_invoice",
    {
      title: "Audit-proof invoice",
      description: PROOF_INVOICE_DESCRIPTION,
      inputSchema: proofInvoiceInputSchema,
      annotations: readOnly,
    },
    async (args) => handleProofInvoice(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_indices",
    {
      title: "Index catalog and values",
      description: INDICES_DESCRIPTION,
      inputSchema: indicesInputSchema,
      annotations: readOnly,
    },
    async (args) => handleIndices(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_refresh_indices",
    {
      title: "Fetch public index values",
      description: REFRESH_DESCRIPTION,
      inputSchema: refreshInputSchema,
      annotations: { ...write(true), openWorldHint: true },
    },
    async (args) => handleRefresh(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_add_index_values",
    {
      title: "Enter sourced index values",
      description: MANUAL_DESCRIPTION,
      inputSchema: manualInputSchema,
      annotations: write(true),
    },
    async (args) => handleManual(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_register",
    {
      title: "Contract register and expected invoices",
      description: REGISTER_DESCRIPTION,
      inputSchema: registerInputSchema,
      annotations: readOnly,
    },
    async (args) => handleRegister(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_contract",
    {
      title: "Contract workbook and open inputs",
      description: CONTRACT_DESCRIPTION,
      inputSchema: contractInputSchema,
      annotations: readOnly,
    },
    async (args) => handleContract(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_answer",
    {
      title: "Answer an open contract input",
      description: ANSWER_DESCRIPTION,
      inputSchema: answerInputSchema,
      annotations: write(true),
    },
    async (args) => handleAnswer(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_assumptions",
    {
      title: "List assumptions",
      description: ASSUMPTIONS_DESCRIPTION,
      inputSchema: assumptionsInputSchema,
      annotations: readOnly,
    },
    async (args) => handleAssumptions(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_assume",
    {
      title: "Make, replace or withdraw an assumption",
      description: ASSUME_DESCRIPTION,
      inputSchema: assumeInputSchema,
      annotations: { ...write(false), destructiveHint: true },
    },
    async (args) => handleAssume(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_sync_series",
    {
      title: "Sync external price data",
      description: SYNC_DESCRIPTION,
      inputSchema: syncInputSchema,
      annotations: { ...write(true), openWorldHint: true },
    },
    async (args) => handleSync(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_imports",
    {
      title: "Import candidates and status",
      description: IMPORTS_DESCRIPTION,
      inputSchema: importsInputSchema,
      annotations: readOnly,
    },
    async (args) => handleImports(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_price_baseline_import",
    {
      title: "Import contracts from data capture",
      description: IMPORT_DESCRIPTION,
      inputSchema: importInputSchema,
      annotations: write(true),
    },
    async (args) => handleImport(getToken, baseUrl, args),
  )
}
