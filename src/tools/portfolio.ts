import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, runTool } from "./_http.js"
import type { ToolResult } from "./_shared.js"

/**
 * Portfolio tools: per portfolio company (an account), the KPIs its board
 * decks, monthly reports and models state, one value per KPI and period
 * (restated over actual over draft, newest document first), and the
 * conflicts where documents disagree, each with its sources and the question
 * to put to the company.
 *
 * All tools hit `/v1/portfolio/*` with the caller's bearer; the platform owns
 * every rule (Sources IAM on documents, scopes per route).
 *
 * Loop: talonic_portfolio_companies → talonic_portfolio_conflicts (where the
 * portfolio contradicts itself) or talonic_portfolio_company (one company's
 * table) → talonic_portfolio_refresh only when the user asks to read new
 * documents.
 */

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }

/** True when the caller's workspace has the Portfolio app (tools are listed only then). */
export async function probePortfolioAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/portfolio"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

const COMPANIES_DESCRIPTION =
  "List the portfolio companies (accounts) with how many of their documents were read for KPIs and how many conflicts each has. Start here; use the account_id with talonic_portfolio_company."
const COMPANY_DESCRIPTION =
  "One portfolio company's KPI table: rows are KPIs (cARR, ARR, revenue, gross margin, EBITDA, net burn, cash, runway, headcount, customers), columns are periods (newest first). Each cell carries the value shown, its basis (actual, restated, draft), the source document with page or sheet locator and a verbatim quote, and every other document's differing value. Cite the source filename and locator when you report a number."
const CONFLICTS_DESCRIPTION =
  "Every conflict across all portfolio companies: the same KPI for the same period reported with different values by different documents. Each conflict lists the distinct values, the documents stating each (filename, locator, quote) and a one-line explanation (restatement, draft vs final, or unexplained: ask the company). Use this for 'where does my portfolio contradict itself'."
const REFRESH_DESCRIPTION =
  "Read new or changed documents for KPIs (runs in the background, takes minutes, uses credits). Call only when the user asks to include new documents; then poll talonic_portfolio_companies until documents_read catches up."

/**
 * Register the four `talonic_portfolio_*` tools.
 *
 * @public
 */
export function registerPortfolioTools(server: McpServer, getToken: () => string, baseUrl?: string): void {
  const tools: Array<[string, string, string, Record<string, z.ZodTypeAny>, typeof readOnly | typeof write, (a: any) => Promise<ToolResult>]> = [
    ["talonic_portfolio_companies", "Portfolio companies", COMPANIES_DESCRIPTION, {}, readOnly,
      () => runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/portfolio"))],
    ["talonic_portfolio_company", "Portfolio company KPI table", COMPANY_DESCRIPTION,
      { account_id: z.string().uuid().describe("The company's account_id from talonic_portfolio_companies") }, readOnly,
      (a) => runTool(() => apiJson(getToken, baseUrl, "GET", `/v1/portfolio/companies/${encodeURIComponent(a.account_id)}`))],
    ["talonic_portfolio_conflicts", "Portfolio conflicts", CONFLICTS_DESCRIPTION, {}, readOnly,
      () => runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/portfolio/conflicts"))],
    ["talonic_portfolio_refresh", "Read new portfolio documents", REFRESH_DESCRIPTION, {}, write,
      () => runTool(() => apiJson(getToken, baseUrl, "POST", "/v1/portfolio/refresh"))],
  ]
  for (const [name, title, description, inputSchema, annotations, handler] of tools) {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations } },
      async (args: unknown) => handler(args) as Promise<any>,
    )
  }
}
