import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { resolveFetch } from "./_http.js"

/**
 * Growth analytics tools — Talonic-internal.
 *
 * These wrap the platform's `/v1/growth/*` read surface, which is gated by
 * `GrowthReaderGuard` server-side: the OAuth user (hosted connector) or the
 * API key's creator (stdio) must be an active Talonic superadmin or a listed
 * growth reader, or every call 403s. Registration is therefore conditional — both entrypoints
 * call {@link probeGrowthAccess} first and only register these tools when the
 * probe passes, so customers never see them in a tools listing. The probe is
 * a UX nicety, never the security boundary: the platform re-checks the
 * principal on every request.
 *
 * Deliberately absent from the public docs surfaces (`src/content/`,
 * `docs/sections.json`) — an internal surface has no place in customer docs.
 */

const DEFAULT_BASE = "https://api.talonic.com"

/** Trailing windows the ranged growth reads accept. */
const RANGES = ["7d", "30d", "90d"] as const

/** GET a `/v1/growth/*` route with the caller's bearer; shapes errors like every other tool. */
async function growthGet(
  getToken: () => string,
  baseUrl: string | undefined,
  path: string,
  params: Record<string, string | undefined>,
): Promise<ToolResult> {
  try {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, v)
    const url = `${baseUrl ?? DEFAULT_BASE}/v1/growth/${path}${qs.size ? `?${qs}` : ""}`
    const res = await resolveFetch(getToken)(url, {
      headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/json" },
    })
    if (res.status === 403) {
      return toolError(
        new Error(
          "Talonic growth analytics require a superadmin or growth-reader account. " +
            "Sign in to the connector with your Talonic staff account (or use an API key created by one).",
        ),
      )
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return toolError(
        new Error(`Talonic API error: HTTP ${res.status}${body ? ` — ${body}` : ""}`),
      )
    }
    return jsonOk(await res.json())
  } catch (err) {
    return toolError(err)
  }
}

/**
 * True when the credential's principal passes the platform's superadmin gate
 * (`GET /v1/growth/access` → 200). Used by both entrypoints to decide whether
 * to register the growth tools for this session. Any failure — 401/403,
 * network error, timeout — resolves `false`; never throws.
 *
 * @public
 */
export async function probeGrowthAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl ?? DEFAULT_BASE}/v1/growth/access`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

const rangeArg = z.enum(RANGES).optional().describe("Trailing window (default 30d).")

interface RangeArgs {
  range?: (typeof RANGES)[number]
}

const FUNNEL_DESCRIPTION = [
  "Read Talonic's agentic product funnel: WAEW (weekly active extracting workspaces — the North Star),",
  "time-to-first-extraction p50/p90 + 24h activation rate, W2/W4 creation-cohort retention, and",
  "acquisition by surface (claude_ai, cursor, raw_api, ...).",
  "",
  "USE WHEN: asked about WAEW, activation, retention, or which surfaces drive extractions.",
  "INTERNAL: Talonic-superadmin-only; other accounts are rejected by the platform.",
  "ARGS: range (optional: 7d | 30d | 90d, default 30d).",
  "RETURNS: { configured, rangeDays, waew, ttfe, retention[], bySurface[] } — configured:false means PostHog is unwired, not zero usage.",
].join("\n")

const FUNNELS_DESCRIPTION = [
  "Read Talonic's website conversion funnels: Platform registration (Visit → Sign-up click → Account created → Activated)",
  "and Sales call booking (Visit → Book-demo click → Contact page → Demo booked).",
  "",
  "USE WHEN: asked about signups, activation counts, demo bookings, or website conversion.",
  "INTERNAL: Talonic-superadmin-only; other accounts are rejected by the platform.",
  "ARGS: range (optional: 7d | 30d | 90d, default 30d).",
  "RETURNS: { rangeDays, funnels[] } — each stage carries { count, pending }; pending:true means that stage's source is not wired yet, not zero.",
].join("\n")

const TRAFFIC_DESCRIPTION = [
  "Read talonic.com traffic: visitors, pageviews, top pages, and referrers split into AI assistants",
  "(ChatGPT, Claude, Perplexity, ...) vs other domains.",
  "",
  "USE WHEN: asked about website traffic, top pages, or how many visitors AI assistants refer.",
  "INTERNAL: Talonic-superadmin-only; other accounts are rejected by the platform.",
  "ARGS: range (optional: 7d | 30d | 90d, default 30d).",
  "RETURNS: { configured, visitors, pageviews, topPages[], topReferrers[], aiReferrers[] }.",
].join("\n")

const TOOLS_USAGE_DESCRIPTION = [
  "Read anonymous visitor behavior on the free tools at talonic.com/tools: views, attempt/success/bounce",
  "rates, dwell, CTA clicks, per-tool leaderboard, and country/device/acquisition splits.",
  "",
  "USE WHEN: asked how the free tools perform, which tools convert, or where tool visitors come from.",
  "INTERNAL: Talonic-superadmin-only; other accounts are rejected by the platform.",
  "ARGS: all optional — range (today | 7d | 30d | 90d | all, default 30d), tool (slug), category, country (ISO code), device (desktop | mobile | tablet), source (utm/referrer key), funnel_stage (attempted | succeeded | downloaded | cta).",
  "RETURNS: the Tools Usage dashboard payload: totals, rates, tools[] leaderboard, breakdowns, trend. Rates are ratios of independent counts, not per-visitor funnels.",
].join("\n")

const toolsUsageInput = {
  range: z.enum(["today", "7d", "30d", "90d", "all"]).optional().describe("Window (default 30d)."),
  tool: z.string().optional().describe("Restrict to one tool slug (e.g. 'pdf-to-csv')."),
  category: z.string().optional().describe("Restrict to a tool category."),
  country: z.string().optional().describe("Restrict to a visitor country (ISO code, e.g. 'DE')."),
  device: z.string().optional().describe("Restrict to a device type: desktop, mobile, or tablet."),
  source: z
    .string()
    .optional()
    .describe("Restrict to an acquisition source (UTM value or referrer host)."),
  funnel_stage: z
    .enum(["attempted", "succeeded", "downloaded", "cta"])
    .optional()
    .describe("Keep only tools with at least one event at this funnel stage."),
}

interface ToolsUsageArgs {
  range?: string
  tool?: string
  category?: string
  country?: string
  device?: string
  source?: string
  funnel_stage?: string
}

const pageArgs = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe("Rows per page (default 100, max 500)."),
  offset: z.number().int().min(0).optional().describe("Rows to skip, for paging."),
}

const ATTRIBUTION_DESCRIPTION = [
  "Read where conversions come from: per landing page or per source, the page views, website conversions",
  "(total and per event, e.g. lead_submitted, demo_booked), signups and activated signups.",
  "",
  "USE WHEN: asked which landing pages or sources produce leads, demo bookings or signups.",
  "INTERNAL: Talonic growth data; other accounts are rejected by the platform.",
  "ARGS: range (optional: 7d | 30d | 90d, default 30d), by (optional: landing_page | source, default landing_page).",
  "RETURNS: { rangeDays, by, rows[] } with each row { key, page_views, conversions, by_event, signups, activated }. Page views are anonymous event counts, conversions and signups are people: three independent totals, not a per-visitor funnel. Signups without stored attribution fall under '(unknown)'.",
].join("\n")

const EVENTS_DESCRIPTION = [
  "List identified website conversions (any event the website sent with an email: lead forms, demo bookings, ...),",
  "newest first, with landing page, UTM tags, referrer and the event's own properties.",
  "",
  "USE WHEN: asked who converted, to check that a new website event arrives, or to inspect one person's conversions.",
  "INTERNAL: Talonic growth data, contains personal data (emails); other accounts are rejected by the platform.",
  "ARGS: all optional: range (7d | 30d | 90d, default all time), event (exact name), email, source (UTM source or referrer host), limit, offset.",
  "RETURNS: { events[], total, limit, offset }; hubspot_synced_at is null until the row reached HubSpot.",
].join("\n")

const SIGNUPS_DESCRIPTION = [
  "List platform signups, newest first: email, signup method, organisation, where they came from",
  "(acquisition + acquisition_origin: 'signup' = stored at signup, 'lead' = inherited from an earlier website conversion) and usage so far.",
  "",
  "USE WHEN: asked who signed up, from which source or landing page, or what a signup did afterwards.",
  "INTERNAL: Talonic growth data, contains personal data (emails); other accounts are rejected by the platform.",
  "ARGS: all optional: range (7d | 30d | 90d, default all time), limit, offset.",
  "RETURNS: { signups[], total, limit, offset }. private:true marks a personal (non-company) signup; documents and credits_used are per user for those only, company usage lives in talonic_growth_accounts.",
].join("\n")

const ACCOUNTS_DESCRIPTION = [
  "List usage per organisation, newest first: users, last login, documents (total and last 30 days),",
  "API calls and credits (last 30 days), plan, status, and where its first user came from.",
  "",
  "USE WHEN: asked how much an organisation uses Talonic, which accounts are active, or usage by acquisition source.",
  "INTERNAL: Talonic growth data; other accounts are rejected by the platform.",
  "ARGS: limit, offset (both optional).",
  "RETURNS: { accounts[], total, limit, offset }. Personal signups are not organisations; they are in talonic_growth_signups.",
].join("\n")

interface PageArgs {
  limit?: number
  offset?: number
}

const page = (a: PageArgs) => ({ limit: a.limit?.toString(), offset: a.offset?.toString() })

/** @internal Exported for unit testing. */
export async function handleGrowthAttribution(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RangeArgs & { by?: string },
): Promise<ToolResult> {
  return growthGet(getToken, baseUrl, "attribution", { range: args.range, by: args.by })
}

/** @internal Exported for unit testing. */
export async function handleGrowthEvents(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RangeArgs & PageArgs & { event?: string; email?: string; source?: string },
): Promise<ToolResult> {
  return growthGet(getToken, baseUrl, "events", {
    range: args.range,
    event: args.event,
    email: args.email,
    source: args.source,
    ...page(args),
  })
}

/** @internal Exported for unit testing. */
export async function handleGrowthSignups(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RangeArgs & PageArgs,
): Promise<ToolResult> {
  return growthGet(getToken, baseUrl, "signups", { range: args.range, ...page(args) })
}

/** @internal Exported for unit testing. */
export async function handleGrowthAccounts(
  getToken: () => string,
  baseUrl: string | undefined,
  args: PageArgs,
): Promise<ToolResult> {
  return growthGet(getToken, baseUrl, "accounts", page(args))
}

const SITE_EVENTS_DESCRIPTION = [
  "Count anonymous website events (page views, CTA clicks, and any custom event the website sends, e.g. a calculator",
  "interaction), grouped by one dimension.",
  "",
  "USE WHEN: asked which website events exist, how often a custom event fired, or how one splits by page, source or one of its own properties.",
  "INTERNAL: Talonic growth data; other accounts are rejected by the platform.",
  "ARGS: all optional: range (7d | 30d | 90d, default 30d), event (exact name), page (exact path), by (event | page | landing_page | source | country | device | prop:<key>, default event). prop:<key> groups by a property the website attached to the event.",
  "RETURNS: { rangeDays, by, rows[] } with each row { key, count, first_seen, last_seen }. Event counts, never visitors: anonymous events carry no visitor identity.",
].join("\n")

interface SiteEventsArgs extends RangeArgs {
  event?: string
  page?: string
  by?: string
}

/** @internal Exported for unit testing. */
export async function handleGrowthSiteEvents(
  getToken: () => string,
  baseUrl: string | undefined,
  args: SiteEventsArgs,
): Promise<ToolResult> {
  return growthGet(getToken, baseUrl, "site-events", {
    range: args.range,
    event: args.event,
    page: args.page,
    by: args.by,
  })
}

/** @internal Exported for unit testing. */
export async function handleGrowthFunnel(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RangeArgs,
): Promise<ToolResult> {
  return growthGet(getToken, baseUrl, "funnel", { range: args.range })
}

/** @internal Exported for unit testing. */
export async function handleGrowthFunnels(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RangeArgs,
): Promise<ToolResult> {
  return growthGet(getToken, baseUrl, "funnels", { range: args.range })
}

/** @internal Exported for unit testing. */
export async function handleGrowthTraffic(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RangeArgs,
): Promise<ToolResult> {
  return growthGet(getToken, baseUrl, "traffic", { range: args.range })
}

/** @internal Exported for unit testing. */
export async function handleGrowthToolsUsage(
  getToken: () => string,
  baseUrl: string | undefined,
  args: ToolsUsageArgs,
): Promise<ToolResult> {
  return growthGet(getToken, baseUrl, "tools-usage", {
    range: args.range,
    tool: args.tool,
    category: args.category,
    country: args.country,
    device: args.device,
    source: args.source,
    funnelStage: args.funnel_stage,
  })
}

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const

/**
 * Register the growth tools. Call ONLY after {@link probeGrowthAccess}
 * passed for the session's credential — see the module doc for why.
 *
 * @public
 */
export function registerGrowthTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_growth_funnel",
    {
      title: "Growth: Product Funnel",
      description: FUNNEL_DESCRIPTION,
      inputSchema: { range: rangeArg },
      annotations: { title: "Growth: Product Funnel", ...READ_ONLY },
    },
    async (args: RangeArgs) => handleGrowthFunnel(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_growth_funnels",
    {
      title: "Growth: Conversion Funnels",
      description: FUNNELS_DESCRIPTION,
      inputSchema: { range: rangeArg },
      annotations: { title: "Growth: Conversion Funnels", ...READ_ONLY },
    },
    async (args: RangeArgs) => handleGrowthFunnels(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_growth_traffic",
    {
      title: "Growth: Website Traffic",
      description: TRAFFIC_DESCRIPTION,
      inputSchema: { range: rangeArg },
      annotations: { title: "Growth: Website Traffic", ...READ_ONLY },
    },
    async (args: RangeArgs) => handleGrowthTraffic(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_growth_tools_usage",
    {
      title: "Growth: Free-Tools Usage",
      description: TOOLS_USAGE_DESCRIPTION,
      inputSchema: toolsUsageInput,
      annotations: { title: "Growth: Free-Tools Usage", ...READ_ONLY },
    },
    async (args: ToolsUsageArgs) => handleGrowthToolsUsage(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_growth_attribution",
    {
      title: "Growth: Attribution",
      description: ATTRIBUTION_DESCRIPTION,
      inputSchema: {
        range: rangeArg,
        by: z
          .enum(["landing_page", "source"])
          .optional()
          .describe("Group by (default landing_page)."),
      },
      annotations: { title: "Growth: Attribution", ...READ_ONLY },
    },
    async (args: RangeArgs & { by?: string }) => handleGrowthAttribution(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_growth_events",
    {
      title: "Growth: Website Conversions",
      description: EVENTS_DESCRIPTION,
      inputSchema: {
        range: z.enum(RANGES).optional().describe("Trailing window (default all time)."),
        event: z.string().optional().describe("Exact event name, e.g. 'lead_submitted'."),
        email: z.string().optional().describe("One person's conversions."),
        source: z.string().optional().describe("UTM source or referrer host."),
        ...pageArgs,
      },
      annotations: { title: "Growth: Website Conversions", ...READ_ONLY },
    },
    async (args: RangeArgs & PageArgs & { event?: string; email?: string; source?: string }) =>
      handleGrowthEvents(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_growth_signups",
    {
      title: "Growth: Signups",
      description: SIGNUPS_DESCRIPTION,
      inputSchema: {
        range: z.enum(RANGES).optional().describe("Trailing window (default all time)."),
        ...pageArgs,
      },
      annotations: { title: "Growth: Signups", ...READ_ONLY },
    },
    async (args: RangeArgs & PageArgs) => handleGrowthSignups(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_growth_accounts",
    {
      title: "Growth: Account Usage",
      description: ACCOUNTS_DESCRIPTION,
      inputSchema: pageArgs,
      annotations: { title: "Growth: Account Usage", ...READ_ONLY },
    },
    async (args: PageArgs) => handleGrowthAccounts(getToken, baseUrl, args),
  )
  server.registerTool(
    "talonic_growth_site_events",
    {
      title: "Growth: Anonymous Website Events",
      description: SITE_EVENTS_DESCRIPTION,
      inputSchema: {
        range: rangeArg,
        event: z.string().optional().describe("Exact event name, e.g. 'page_cta_clicked'."),
        page: z.string().optional().describe("Exact page path, e.g. '/pricing'."),
        by: z
          .string()
          .optional()
          .describe(
            "Group by: event | page | landing_page | source | country | device | prop:<key> (default event).",
          ),
      },
      annotations: { title: "Growth: Anonymous Website Events", ...READ_ONLY },
    },
    async (args: SiteEventsArgs) => handleGrowthSiteEvents(getToken, baseUrl, args),
  )
}
