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
  "Read a contract's price clause into a standard price model: components (Arbeitspreis, Grundpreis, CO2, ...), their formulas, the named indices with base year and reference months, and every stated number with its verified contract quote.",
  "USE WHEN: a contract has no price model yet (talonic_price_baseline_models lists the ones that do).",
  "NOT FOR: generic field extraction (talonic_extract); editing an existing model (talonic_price_baseline_update_model).",
  "",
  "ARGS: `document_id` (contract UUID), `use_opus` (slower, for long or unusual clauses).",
  "RETURNS: the stored model { id, document_id, contract_label, status: draft, model }. Costs one LLM call. A value whose quote does not verify carries `evidence.verified: false` and counts as missing.",
].join("\n")

export const extractInputSchema = {
  document_id: z.string().uuid().describe("Contract document UUID."),
  use_opus: z
    .boolean()
    .optional()
    .describe("Use the larger model for long or unusual price clauses."),
}

/** @internal */
export function handleExtract(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { document_id: string; use_opus?: boolean },
): Promise<ToolResult> {
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
  "Replace a price model after review, and optionally confirm it.",
  "USE WHEN: a formula, index or reference month was read wrong, or the reviewer confirms the model.",
  "NOT FOR: first extraction (talonic_price_baseline_extract).",
  "",
  "ARGS: `model_id`, `model` (the full model object as returned by talonic_price_baseline_models, edited), `status` (draft | confirmed).",
  "RETURNS: the stored model. The platform re-verifies every quote: an edited number only counts when its quote occurs in the contract and prints that number.",
].join("\n")

export const updateInputSchema = {
  model_id: modelIdArg,
  model: z
    .record(z.string(), z.unknown())
    .describe("The full edited model object (the `model` field of the stored model)."),
  status: z
    .enum(["draft", "confirmed"])
    .optional()
    .describe("Set `confirmed` once a reviewer accepts the model."),
}

/** @internal */
export function handleUpdate(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { model_id: string; model: Record<string, unknown>; status?: "draft" | "confirmed" },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "PUT",
      `/v1/price-baseline/models/${encodeURIComponent(args.model_id)}`,
      {
        body: { model: args.model, status: args.status },
      },
    ),
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

// ── Indices ────────────────────────────────────────────────────────────────

const INDICES_DESCRIPTION = [
  "Show the index catalog (series the platform can fetch or accept manually), or the stored values of given series.",
  "USE WHEN: a price period reports a missing index, or to see which source a value came from.",
  "NOT FOR: fetching new values (talonic_price_baseline_refresh_indices) or entering them (talonic_price_baseline_add_index_values).",
  "",
  "ARGS: `series` (optional list of series keys, e.g. ['destatis.vpi', 'behg.co2']). Without it, returns the catalog.",
  "RETURNS: catalog data[] { key, label, provider (behg | bundesbank | destatis | manual), unit, base_year, note, stored { count, first, last } }, or values data[] { series, period, value, unit, base_year, source, source_url, quote, document_id }.",
].join("\n")

export const indicesInputSchema = {
  series: z.array(z.string().min(1)).max(50).optional().describe("Series keys to read values for."),
}

/** @internal */
export function handleIndices(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { series?: string[] },
): Promise<ToolResult> {
  if (args.series?.length) {
    return runTool(() =>
      apiJson(getToken, baseUrl, "GET", "/v1/price-baseline/indices/values", {
        params: { series: args.series?.join(",") },
      }),
    )
  }
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/price-baseline/indices"))
}

const REFRESH_DESCRIPTION = [
  "Fetch index values from their publishers: BEHG CO2 price (§10 law text), Bundesbank VPI and Erzeugerpreise, Destatis GENESIS tables (needs the platform's GENESIS token).",
  "USE WHEN: talonic_price_baseline_prices reports a missing public index.",
  "NOT FOR: EEX, THE or grid tariffs, which have no free feed (talonic_price_baseline_add_index_values).",
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
 * Register the ten `talonic_price_baseline_*` tools.
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
      title: "Build a price model from a contract",
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
}
