/**
 * Talonic MCP server, Streamable HTTP entry point.
 *
 * Hosts the MCP server over HTTP for remote clients. Designed for
 * deployment on Railway (or any container host) behind a custom domain
 * like `mcp.talonic.com`.
 *
 * Runs in **stateless mode**: each POST gets a fresh MCP server + transport
 * (no `Mcp-Session-Id`, no in-memory session map). This makes the endpoint
 * immune to container restarts, redeploys, and horizontal scaling — there is
 * no session state to lose. (Stateful in-memory sessions previously caused
 * hosted connectors like ChatGPT to go dead after every redeploy: the
 * client's session id 404'd and the client did not transparently
 * re-initialize.) Each request carries its own bearer token, so OAuth token
 * rotation is handled for free. GET (standalone SSE) returns 405; all tools
 * are request/response over POST.
 *
 * Supports two auth modes:
 *   1. `Authorization: Bearer ...` header
 *      Accepts a Talonic API key (`tlnc_...`) or an OAuth 2.1 access token
 *      issued by the Talonic authorization server. The bearer string is
 *      forwarded unchanged to the Talonic API; the API's dual-auth guard
 *      decides which path to take.
 *   2. `?apiKey=tlnc_...` query param
 *      Convenience for MCP client configs that cannot set custom headers.
 *      Use only with API keys; never put OAuth tokens in URLs.
 *
 * OAuth resource-server metadata is advertised at
 * `/.well-known/oauth-protected-resource` per RFC 9728 so clients can
 * discover the authorization server (`api.talonic.com`).
 *
 * @internal
 */

import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http"
import { createHash } from "node:crypto"
import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { createServer } from "./server-factory.js"
import { DECIDE_SCOPE, tokenHasDecideScope } from "./tools/decision-tasks.js"
import { probeAccessState, type ProbeAnswer } from "./tools/_http.js"
import { probeAgentTasksInUse, probeExternalAppsInUse } from "./tools/apps.js"
import { isOriginAllowed } from "./origin.js"
import { getWidgetTemplateHtml, getWidgetTemplateMeta } from "./widgets/register.js"
import { FAVICON_BYTES } from "./favicon.js"
import { SERVER_NAME, VERSION } from "./version.js"

const PORT = Number(process.env["PORT"] ?? 3000)

/** How long a probe answer is trusted; access changes only on deploy or app install. */
const PROBE_TTL_MS = 5 * 60 * 1000

/**
 * One per-token access cache. A probe answers true / false, or "unknown"
 * when the platform could not be asked (timeout, network, 5xx, 429). An
 * unknown answer never removes tools a session already had: it reuses the
 * last known answer (even an expired one) and is not cached, so the next
 * request asks again. Before this, one slow probe silently dropped a whole
 * app's tools for five minutes, mid-conversation, and calls to them then
 * failed as "unknown tool".
 */
function makeAccessCache(defaultProbe: (token: string) => Promise<ProbeAnswer>) {
  const cache = new Map<string, { ok: boolean; expiresAt: number }>()
  return async function accessCached(
    token: string,
    probe: (token: string) => Promise<ProbeAnswer> = defaultProbe,
    now: () => number = Date.now,
  ): Promise<boolean> {
    const hit = cache.get(token)
    if (hit && hit.expiresAt > now()) return hit.ok
    let answer: ProbeAnswer
    try {
      answer = await probe(token)
    } catch {
      answer = "unknown"
    }
    if (answer === "unknown") return hit?.ok ?? false
    if (cache.size >= 1000) cache.clear()
    cache.set(token, { ok: answer, expiresAt: now() + PROBE_TTL_MS })
    return answer
  }
}

const base = () => process.env["TALONIC_BASE_URL"]
const pathProbe = (path: string) => (t: string) => probeAccessState(t, base(), path)

/** @internal Exported for tests. */
export const contractsAccessCached = makeAccessCache(pathProbe("/v1/contracts/import/status"))
/** @internal Exported for tests. */
export const apAccessCached = makeAccessCache(pathProbe("/v1/ap/config"))
/** @internal Exported for tests. */
export const masterRecordsAccessCached = makeAccessCache(pathProbe("/v1/master-records/config"))
/** @internal Exported for tests. */
export const submissionsAccessCached = makeAccessCache(pathProbe("/v1/submissions/specs"))
/** @internal Exported for tests. */
export const priceBaselineAccessCached = makeAccessCache(pathProbe("/v1/price-baseline/indices"))
/** @internal Exported for tests. */
export const docGenAccessCached = makeAccessCache(pathProbe("/v1/doc-gen/status"))
/** @internal Exported for tests. */
export const portfolioAccessCached = makeAccessCache(pathProbe("/v1/portfolio"))
/** @internal Exported for tests. */
export const processesAccessCached = makeAccessCache(pathProbe("/v1/processes"))
/** @internal Exported for tests. */
export const partiesAccessCached = makeAccessCache(pathProbe("/v1/parties/status"))
/** Superadmin / growth-reader only. @internal Exported for tests. */
export const growthAccessCached = makeAccessCache(pathProbe("/v1/growth/access"))
/** Superadmin only. @internal Exported for tests. */
export const adminAgentTaskAccessCached = makeAccessCache(pathProbe("/v1/agent-tasks/admin/access"))
/**
 * Agent-stage worker tools: only for workspaces whose pipelines have
 * produced at least one Agent task. @internal Exported for tests.
 */
export const agentTasksAccessCached = makeAccessCache((t) => probeAgentTasksInUse(t, base()))
/**
 * Decision-task tools: only for workspaces with an External-mode app.
 * @internal Exported for tests.
 */
export const decisionTasksAccessCached = makeAccessCache((t) => probeExternalAppsInUse(t, base()))

/** Largest JSON-RPC body from a caller with a credential (base64 `file_data`). */
const MAX_BODY_BYTES = 64 * 1024 * 1024
/** Without a credential only the small public widget-template read is legitimate. */
const MAX_ANON_BODY_BYTES = 64 * 1024

/**
 * Does the Talonic API reject this credential outright? Only a 401 counts, so
 * a narrow-scoped token (403) or a platform outage still passes: the API
 * re-authorizes every tool call, this exists to answer 401 per the MCP auth spec
 * and to stop an invalid token before the per-app probes fan out.
 */
async function probeTokenAccepted(token: string): Promise<boolean> {
  try {
    const base = process.env["TALONIC_BASE_URL"] ?? "https://api.talonic.com"
    const res = await fetch(`${base}/v1/account`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    return res.status !== 401
  } catch {
    return true
  }
}

const TOKEN_CHECK_TTL_MS = 60 * 1000
const tokenCheckCache = new Map<string, { ok: boolean; expiresAt: number }>()

/** @internal Exported for tests. Keyed by hash: this cache needs no raw credential. */
export async function tokenAcceptedCached(
  token: string,
  probe: (token: string) => Promise<boolean> = probeTokenAccepted,
  now: () => number = Date.now,
): Promise<boolean> {
  const key = createHash("sha256").update(token).digest("hex")
  const hit = tokenCheckCache.get(key)
  if (hit && hit.expiresAt > now()) return hit.ok
  const ok = await probe(token)
  if (tokenCheckCache.size >= 1000) tokenCheckCache.clear()
  tokenCheckCache.set(key, { ok, expiresAt: now() + TOKEN_CHECK_TTL_MS })
  return ok
}

/** Read a request body, or null once it passes `limit` bytes. */
function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        req.removeAllListeners("data")
        req.resume()
        resolve(null)
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks).toString()))
    req.on("error", reject)
  })
}

/**
 * Canonical public URL of this MCP resource. Advertised in the protected
 * resource metadata so OAuth clients know the audience their tokens are
 * good for. Defaults to the production hostname; override for staging.
 */
const RESOURCE_URL = process.env["MCP_RESOURCE_URL"] ?? "https://mcp.talonic.com"

/**
 * Base URL of the OAuth 2.1 authorization server. Advertised in the
 * protected resource metadata so OAuth clients can discover the AS at
 * `<AUTHORIZATION_SERVER>/.well-known/oauth-authorization-server`.
 * Defaults to production; override for staging or local dev.
 */
const AUTHORIZATION_SERVER = process.env["OAUTH_AUTHORIZATION_SERVER"] ?? "https://api.talonic.com"

/**
 * Verification token for the ChatGPT Apps SDK domain check. OpenAI's
 * submission flow scans `<mcp-host>/.well-known/openai-apps-challenge` and
 * expects this exact token back as plain text. Read from the environment so
 * it can be rotated without a code change; defaults to the value issued for
 * the current submission. Domain verification is a one-time gate — once the
 * domain is verified, the value can stay as a no-op.
 */
const APPS_CHALLENGE_TOKEN =
  process.env["OPENAI_APPS_CHALLENGE_TOKEN"] ?? "gnHvfQsKH6NVBNIeOWVK1vSt5QR2gsgBAIcXdSlpR_U"

/**
 * Ownership claim for the Glama connector directory. Glama fetches
 * `<mcp-host>/.well-known/glama.json` and expects this exact JSON; the token
 * is bound to the Talonic Glama account and must stay published to keep the
 * domain verified. Overridable from the environment for rotation.
 */
const GLAMA_CLAIM_TOKEN =
  process.env["GLAMA_CLAIM_TOKEN"] ?? "glama_claim_Md9ULtrJRI_KRroi6rbpNwAmP5X0nqI1"

/**
 * RFC 9728 OAuth Protected Resource Metadata.
 *
 * Returned at `/.well-known/oauth-protected-resource`. Clients use this
 * to discover which authorization server issues tokens for this resource
 * and which scopes are accepted.
 *
 * The scopes advertised are the ones our MCP tools actually exercise:
 * `extract:write` (extract, save_schema, to_markdown), `documents:read`
 * (filter, get_document, search), `schemas:read` (list_schemas), and
 * `apps:decide` (the seven decision-task tools; the platform's `decide`
 * tier needs it on an OAuth session, and it is never pre-consented, so the
 * consent page asks for it in person). Claude.ai requests exactly this
 * list, so an entry here is a consent-screen line; the platform's
 * `OAUTH_SCOPES` must contain every entry or `/oauth/authorize` 400s.
 * The Talonic authorization server supports more scopes than this; we
 * advertise only what the connector itself needs so the consent screen
 * stays tight. `processes:read` / `processes:write` are the Process Plane
 * tools' catalog scopes: the newer process routes accept only
 * `processes:write` for changes, and a legacy name in the same grant keeps
 * its old meaning.
 */
/** @internal Exported for tests. The scopes the hosted connector requests. */
export const SCOPES_SUPPORTED: readonly string[] = [
  "extract:write",
  "documents:read",
  "schemas:read",
  DECIDE_SCOPE,
  "processes:read",
  "processes:write",
]

function renderProtectedResourceMetadata(resourcePath = ""): {
  resource: string
  authorization_servers: string[]
  scopes_supported: string[]
  bearer_methods_supported: string[]
} {
  return {
    resource: `${RESOURCE_URL}${resourcePath}`,
    authorization_servers: [AUTHORIZATION_SERVER],
    scopes_supported: [...SCOPES_SUPPORTED],
    bearer_methods_supported: ["header"],
  }
}

/**
 * Extract the bearer token from the request. Accepts either a Talonic
 * API key (`tlnc_...`) or an OAuth 2.1 access token; the dual-auth guard
 * on the Talonic API decides which path to take based on the prefix.
 *
 * Checks the `Authorization` header first, then falls back to the
 * `apiKey` query parameter. The query parameter path is intended for
 * API keys only. OAuth access tokens should never travel in URLs.
 */
function extractBearerToken(req: {
  url?: string
  headers: Record<string, string | string[] | undefined>
}): string | undefined {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers["authorization"]
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim()
  }

  // 2. ?apiKey=tlnc_...
  if (req.url) {
    const url = new URL(req.url, "http://localhost")
    const param = url.searchParams.get("apiKey")
    // API keys only: an OAuth token in a URL would land in proxy logs.
    if (param?.startsWith("tlnc_")) return param
  }

  return undefined
}

/**
 * WWW-Authenticate header value for 401 responses, per RFC 6750 + RFC 9728.
 * The `resource_metadata` pointer is scoped to the endpoint the client used:
 * `/mcp` points at the path-suffixed document (RFC 9728 §3.1, which clients
 * try first for a resource with a path component) whose `resource` is the
 * exact `/mcp` URL; the root endpoint points at the root document.
 */
function wwwAuthenticate(path: string): string {
  const suffix = isMcpPath(path) ? "/mcp" : ""
  return `Bearer error="invalid_token", resource_metadata="${RESOURCE_URL}/.well-known/oauth-protected-resource${suffix}"`
}

/** True for the `/mcp` MCP endpoint (with or without a trailing slash). */
function isMcpPath(path: string): boolean {
  return path === "/mcp" || path === "/mcp/"
}

/**
 * If the parsed JSON-RPC body is a single `resources/read` for a
 * `ui://widget/*` template, return its uri and request id; otherwise null.
 * Batched requests fall through to the normal authed path.
 */
function asWidgetTemplateRead(parsed: unknown): { uri: string; id: unknown } | null {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const msg = parsed as { method?: unknown; params?: { uri?: unknown }; id?: unknown }
  if (msg.method !== "resources/read") return null
  const uri = msg.params?.uri
  if (typeof uri !== "string" || !uri.startsWith("ui://widget/")) return null
  return { uri, id: msg.id ?? null }
}

/**
 * Build the HTTP request handler for the Streamable HTTP entry point.
 *
 * The handler is exported as a factory. In production the bootstrap at the
 * bottom of this file calls it exactly once; in tests each case constructs
 * its own isolated handler.
 *
 * Routes:
 *  - GET `/`                              discovery JSON (humans, bots, monitors)
 *  - GET `/health`                        health check
 *  - GET `/favicon.{ico,png}`             favicon for directory listings
 *  - GET `/.well-known/oauth-protected-resource`  RFC 9728 metadata
 *  - GET `/.well-known/openai-apps-challenge`      Apps SDK domain verification
 *  - GET `/.well-known/glama.json`                 Glama ownership claim
 *  - POST `/` or `/mcp`                   MCP Streamable HTTP (stateless)
 *  - DELETE `/` or `/mcp`                 no-op 200 (no session to terminate)
 *  - GET `/mcp` (SSE)                     405 (stateless: use POST)
 *
 * Serving the MCP protocol at both `/` and `/mcp` keeps the connector
 * working whether a directory entry registers the bare origin or appends
 * the explicit path. The discovery JSON at `/` is reserved for plain GET
 * requests that are not asking to open an SSE stream.
 *
 * @internal
 */
export interface CreateRequestHandlerOptions {
  /** Override the conditional growth-tool visibility check (primarily for tests). */
  growthAccess?: (token: string) => Promise<boolean>
  /** Override the Contracts tool visibility check (primarily for tests). */
  contractsAccess?: (token: string) => Promise<boolean>
  /** Override the AP tool visibility check (primarily for tests). */
  apAccess?: (token: string) => Promise<boolean>
  /** Override the Doc Gen tool visibility check (primarily for tests). */
  docGenAccess?: (token: string) => Promise<boolean>
  /** Override the Parties tool visibility check (primarily for tests). */
  partiesAccess?: (token: string) => Promise<boolean>
  /** Override the Portfolio tool visibility check (primarily for tests). */
  portfolioAccess?: (token: string) => Promise<boolean>
  /** Override the Process Plane tool visibility check (primarily for tests). */
  processesAccess?: (token: string) => Promise<boolean>
  /** Override the Agent-stage task tool visibility check (primarily for tests). */
  agentTasksAccess?: (token: string) => Promise<boolean>
  /** Override the decision-task tool visibility check (primarily for tests). */
  decisionTasksAccess?: (token: string) => Promise<boolean>
  /** Override the Master Records tool visibility check (primarily for tests). */
  masterRecordsAccess?: (token: string) => Promise<boolean>
  submissionsAccess?: (token: string) => Promise<boolean>
  /** Override the Price Baseline tool visibility check (primarily for tests). */
  priceBaselineAccess?: (token: string) => Promise<boolean>
  /** Override the conditional admin visibility check (primarily for tests). */
  adminAgentTaskAccess?: (token: string) => Promise<boolean>
  /** Override the credential check that answers 401 (primarily for tests). */
  tokenAccepted?: (token: string) => Promise<boolean>
}

export function createRequestHandler(
  options: CreateRequestHandlerOptions = {},
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // URL.canParse first: `new URL("//", base)` throws, and an unhandled
    // rejection here would kill the process for every tenant.
    if (!URL.canParse(req.url ?? "/", "http://localhost")) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "bad_request", message: "Malformed request URL." }))
      return
    }
    const url = new URL(req.url ?? "/", "http://localhost")
    const path = url.pathname

    // ── Origin allowlist (DNS-rebinding mitigation) ───────────────────
    // Browser clients send an `Origin` header on cross-origin requests;
    // native and server-to-server clients typically do not. We reject any
    // request that includes an Origin we don't recognise. See ALLOWED_ORIGINS.
    const incomingOrigin = req.headers["origin"]
    const incomingOriginValue = typeof incomingOrigin === "string" ? incomingOrigin : undefined
    if (!isOriginAllowed(incomingOriginValue)) {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          error: "origin_not_allowed",
          message: `Origin '${incomingOriginValue}' is not in the allowlist. Contact info@talonic.ai if you believe this is an error.`,
        }),
      )
      return
    }

    // ── Health check ──────────────────────────────────────────────────
    if (path === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ status: "ok", server: SERVER_NAME, version: VERSION }))
      return
    }

    // ── Favicon ───────────────────────────────────────────────────────
    // Served at /favicon.ico for browsers and for Google's favicon scraper,
    // which Anthropic's Connectors Directory uses to fetch the logo shown
    // on directory listings and tool-call previews.
    if (path === "/favicon.ico" || path === "/favicon.png") {
      if (FAVICON_BYTES.length === 0) {
        res.writeHead(404, { "Content-Type": "application/json" })
        res.end(
          JSON.stringify({
            error: "not_found",
            message: "Favicon asset not bundled with this build.",
          }),
        )
        return
      }
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
        "Content-Length": String(FAVICON_BYTES.length),
      })
      res.end(FAVICON_BYTES)
      return
    }

    // ── RFC 9728: Protected Resource Metadata ─────────────────────────
    // Lets OAuth clients (Claude.ai connectors, MCP Inspector) discover
    // which authorization server issues tokens for this resource. Public,
    // unauthenticated, cacheable. Always returns JSON regardless of method.
    if (path === "/.well-known/oauth-protected-resource") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      })
      res.end(JSON.stringify(renderProtectedResourceMetadata()))
      return
    }
    // Path-suffixed variant (RFC 9728 §3.1): clients connecting to `/mcp`
    // look here first, and Claude requires the `resource` value to equal
    // the server URL exactly as the user entered it, path included.
    if (path === "/.well-known/oauth-protected-resource/mcp") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      })
      res.end(JSON.stringify(renderProtectedResourceMetadata("/mcp")))
      return
    }

    // ── ChatGPT Apps SDK: domain verification challenge ───────────────
    // OpenAI's app-submission flow fetches this well-known path on the MCP
    // origin and expects the issued token back as plain text. Public,
    // unauthenticated. Paths are ignored by OpenAI — only the origin matters.
    if (path === "/.well-known/openai-apps-challenge") {
      res.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      })
      res.end(APPS_CHALLENGE_TOKEN)
      return
    }

    // ── Glama: connector ownership claim ──────────────────────────────
    if (path === "/.well-known/glama.json") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      })
      res.end(
        JSON.stringify({
          $schema: "https://glama.ai/mcp/schemas/connector.json",
          claim: GLAMA_CLAIM_TOKEN,
        }),
      )
      return
    }

    // ── Root: service discovery for AI agents ─────────────────────────
    // Plain GET / returns discovery JSON. Anything else at / (POST, DELETE,
    // GET asking for SSE) falls through to the MCP transport block below so
    // that clients which register the bare origin as the MCP endpoint work
    // without the explicit `/mcp` path.
    if (path === "/" && req.method === "GET") {
      const accept = String(req.headers["accept"] ?? "")
      if (!accept.includes("text/event-stream")) {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(
          JSON.stringify({
            name: SERVER_NAME,
            version: VERSION,
            description:
              "Talonic MCP server. Extract structured, schema-validated data from any document.",
            mcp_endpoint: "/mcp",
            health_endpoint: "/health",
            oauth_protected_resource_endpoint: "/.well-known/oauth-protected-resource",
            auth: "Provide a Talonic API key (tlnc_...) or an OAuth 2.1 access token via Authorization: Bearer ... header. API keys may also be passed via ?apiKey=tlnc_... query param; never put OAuth tokens in URLs.",
            docs: "https://talonic.com/docs/mcp",
          }),
        )
        return
      }
    }

    // ── CORS preflight ────────────────────────────────────────────────
    // Echo back the validated Origin (we've already rejected disallowed
    // ones above) and add `Vary: Origin` so caches do not collapse responses
    // for different Origins. When there is no incoming Origin (native clients),
    // we omit the header; CORS is a browser-only concept.
    if (incomingOriginValue) {
      res.setHeader("Access-Control-Allow-Origin", incomingOriginValue)
      res.setHeader("Vary", "Origin")
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id")
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id")

    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    // ── Only serve MCP at `/mcp` or `/` ───────────────────────────────
    // Accepting both keeps the connector working whether a directory entry
    // registers `https://mcp.talonic.com` (bare origin) or appends `/mcp`.
    if (path !== "/mcp" && path !== "/") {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          error: "not_found",
          message: `No route for ${path}. Use /mcp (or /) for the MCP endpoint or /health for status.`,
        }),
      )
      return
    }

    // ── Stateless MCP ─────────────────────────────────────────────────
    // Each request gets a fresh server + transport with NO session id. There
    // is no in-memory session map, so the endpoint is immune to container
    // restarts, redeploys, and horizontal scaling — there is nothing to lose.
    // (Stateful in-memory sessions were the cause of connectors going dead
    // after every redeploy: the client's Mcp-Session-Id 404'd and hosted
    // clients like ChatGPT did not transparently re-initialize.) The bearer
    // token on this request authorizes this request, so OAuth rotation is
    // handled automatically — every request simply carries its own token.

    // DELETE: no session to terminate in stateless mode.
    if (req.method === "DELETE") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    // GET: stateless servers do not maintain a standalone SSE stream. MCP
    // clients fall back to POST request/response, which is all our tools need.
    if (req.method === "GET") {
      res.writeHead(405, { "Content-Type": "application/json", Allow: "POST, DELETE, OPTIONS" })
      res.end(
        JSON.stringify({
          error: "method_not_allowed",
          message: "This MCP endpoint is stateless; send JSON-RPC over POST.",
        }),
      )
      return
    }

    const body = await readBody(req, extractBearerToken(req) ? MAX_BODY_BYTES : MAX_ANON_BODY_BYTES)
    if (body === null) {
      res.writeHead(413, { "Content-Type": "application/json", Connection: "close" })
      res.end(JSON.stringify({ error: "payload_too_large", message: "Request body too large." }))
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "bad_request", message: "Invalid JSON body." }))
      return
    }

    // ── Widget-template fast path (public, before auth) ───────────────
    // ChatGPT's widget renderer fetches `ui://widget/*` templates at render
    // time, sometimes without the user's OAuth token and sometimes with an
    // Accept header lacking text/event-stream — either killed the render
    // ("Error loading app, failed to fetch the template", OpenAI review
    // rejection 2026-06-10, test case #4). The templates are static,
    // secret-free HTML (asserted by tests), so a resources/read for one is
    // answered directly here: no auth, no SDK Accept negotiation, plain JSON.
    const widgetRead = asWidgetTemplateRead(parsed)
    if (widgetRead) {
      const html = getWidgetTemplateHtml(widgetRead.uri)
      res.writeHead(200, { "Content-Type": "application/json" })
      if (html === undefined) {
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            id: widgetRead.id,
            error: { code: -32002, message: `Resource not found: ${widgetRead.uri}` },
          }),
        )
        return
      }
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: widgetRead.id,
          result: {
            contents: [
              {
                uri: widgetRead.uri,
                mimeType: "text/html;profile=mcp-app",
                text: html,
                _meta: getWidgetTemplateMeta(widgetRead.uri),
              },
            ],
          },
        }),
      )
      return
    }

    // ── Auth ───────────────────────────────────────────────────────────
    const token = extractBearerToken(req)
    if (!token || !(await (options.tokenAccepted ?? tokenAcceptedCached)(token))) {
      res.writeHead(401, {
        "Content-Type": "application/json",
        "WWW-Authenticate": wwwAuthenticate(path),
      })
      res.end(
        JSON.stringify({
          error: "unauthorized",
          message:
            "Provide a Talonic API key (tlnc_...) or an OAuth 2.1 access token via Authorization: Bearer ... header. API keys may also be passed via ?apiKey=tlnc_... query param; never put OAuth tokens in URLs.",
        }),
      )
      return
    }

    // Fresh, stateless transport + server for this single request. The token
    // is fixed for the request, so a plain provider returning it suffices.
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    const [
      includeGrowthTools,
      includeAdminAgentTaskTools,
      includeContractsTools,
      includeApTools,
      includeDocGenTools,
      includePartiesTools,
      includeMasterRecordsTools,
      includeSubmissionsTools,
      includePriceBaselineTools,
      includePortfolioTools,
      includeProcessesTools,
      includeAgentTaskTools,
      includeDecisionTaskTools,
    ] = await Promise.all([
      (options.growthAccess ?? growthAccessCached)(token),
      (options.adminAgentTaskAccess ?? adminAgentTaskAccessCached)(token),
      (options.contractsAccess ?? contractsAccessCached)(token),
      (options.apAccess ?? apAccessCached)(token),
      (options.docGenAccess ?? docGenAccessCached)(token),
      (options.partiesAccess ?? partiesAccessCached)(token),
      (options.masterRecordsAccess ?? masterRecordsAccessCached)(token),
      (options.submissionsAccess ?? submissionsAccessCached)(token),
      (options.priceBaselineAccess ?? priceBaselineAccessCached)(token),
      (options.portfolioAccess ?? portfolioAccessCached)(token),
      (options.processesAccess ?? processesAccessCached)(token),
      (options.agentTasksAccess ?? agentTasksAccessCached)(token),
      (options.decisionTasksAccess ?? decisionTasksAccessCached)(token),
    ])
    const mcpServer = createServer({
      tokenProvider: () => token,
      includeGrowthTools,
      includeAdminAgentTaskTools,
      includeContractsTools,
      includeApTools,
      includeDocGenTools,
      includePartiesTools,
      includeMasterRecordsTools,
      includeSubmissionsTools,
      includePriceBaselineTools,
      includePortfolioTools,
      includeProcessesTools,
      includeAgentTaskTools,
      includeDecisionTaskTools,
      ...(process.env["TALONIC_BASE_URL"] ? { baseUrl: process.env["TALONIC_BASE_URL"] } : {}),
      // Listing UX only: an OAuth token that visibly lacks apps:decide gets
      // the decision-task tools marked non-invocable. The platform decides.
      decisionTasksInvocable: tokenHasDecideScope(token),
      // OpenAI's plugin review rejects generic executors; omit the
      // list/invoke registry pair for ChatGPT / OpenAI callers only.
      includeGenericExecutor: !isOpenAiClient(req.headers["user-agent"]),
    })
    res.on("close", () => {
      void transport.close()
      void mcpServer.close()
    })
    await mcpServer.connect(transport)
    await transport.handleRequest(req, res, parsed)
  }

  return (req, res) =>
    handle(req, res).catch((err: unknown) => {
      // Message only: never log a request (headers and URL carry credentials).
      console.error("Unhandled request error:", err instanceof Error ? err.message : "unknown")
      if (res.headersSent) {
        res.destroy()
        return
      }
      res.writeHead(500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "internal_error", message: "Internal server error." }))
    })
}

/**
 * True when the request comes from ChatGPT or another OpenAI MCP client
 * (ChatGPT connectors, the plugin dashboard's scanner). Matches the
 * platform's `resolveSurface` rule: the User-Agent mentions openai or chatgpt.
 *
 * @internal
 */
export function isOpenAiClient(userAgent: string | string[] | undefined): boolean {
  const ua = (Array.isArray(userAgent) ? userAgent.join(" ") : (userAgent ?? "")).toLowerCase()
  return ua.includes("openai") || ua.includes("chatgpt")
}

/**
 * True when this module is the process entry point (i.e. invoked as
 * `node dist/http-server.js`). Guards the `listen` call so that importing
 * this module from a test does not bind to port 3000.
 *
 * Mirrors the pattern in `server.ts` — resolves both `process.argv[1]`
 * and `import.meta.url` through `realpathSync` so npm-bin symlinks and
 * `npx` do not break the comparison.
 *
 * @internal
 */
function isDirectInvocation(): boolean {
  if (!process.argv[1]) return false
  try {
    const argvPath = realpathSync(process.argv[1])
    const metaPath = realpathSync(fileURLToPath(import.meta.url))
    return argvPath === metaPath
  } catch {
    return false
  }
}

if (isDirectInvocation()) {
  const httpServer = createHttpServer(createRequestHandler())
  httpServer.listen(PORT, () => {
    console.log(`${SERVER_NAME} ${VERSION} listening on http://0.0.0.0:${PORT}/mcp`)
    console.log(`Health check: http://0.0.0.0:${PORT}/health`)
  })
}
