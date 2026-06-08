/**
 * Talonic MCP server, Streamable HTTP entry point.
 *
 * Hosts the MCP server over HTTP for remote clients. Designed for
 * deployment on Railway (or any container host) behind a custom domain
 * like `mcp.talonic.com`.
 *
 * Runs in **stateful mode** with in-memory sessions. Each initialize
 * request creates a new session keyed by a UUID. Subsequent requests
 * with the same Mcp-Session-Id are routed to the existing session.
 * If a session is lost (deploy, restart, or edge routing miss), the
 * server returns 404 and the client re-initializes, the standard MCP
 * reconnection behavior.
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
import { randomUUID } from "node:crypto"
import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import { createServer } from "./server-factory.js"
import { isOriginAllowed } from "./origin.js"
import { FAVICON_BYTES } from "./favicon.js"
import { SERVER_NAME, VERSION } from "./version.js"

const PORT = Number(process.env["PORT"] ?? 3000)

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
  process.env["OPENAI_APPS_CHALLENGE_TOKEN"] ?? "gnHvYDsKH6NV8NIeDkVK1vSt5QKZqsg8AIcXdS1pR_U"

/**
 * RFC 9728 OAuth Protected Resource Metadata.
 *
 * Returned at `/.well-known/oauth-protected-resource`. Clients use this
 * to discover which authorization server issues tokens for this resource
 * and which scopes are accepted.
 *
 * The scopes advertised are the ones our MCP tools actually exercise:
 * `extract:write` (extract, save_schema, to_markdown), `documents:read`
 * (filter, get_document, search), and `schemas:read` (list_schemas).
 * The Talonic authorization server supports more scopes than this; we
 * advertise only what the connector itself needs so the consent screen
 * stays tight.
 */
function renderProtectedResourceMetadata(): {
  resource: string
  authorization_servers: string[]
  scopes_supported: string[]
  bearer_methods_supported: string[]
} {
  return {
    resource: RESOURCE_URL,
    authorization_servers: [AUTHORIZATION_SERVER],
    scopes_supported: ["extract:write", "documents:read", "schemas:read"],
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
    if (param) return param
  }

  return undefined
}

/**
 * Per-session state. The MCP server attached to the transport reads its
 * bearer token via `tokenHolder` on every tool call and resource read,
 * so a token rotated mid-session is picked up automatically. This is the
 * mechanism that keeps an OAuth 2.1 session alive across the 1-hour
 * access-token rotation without forcing the agent to re-initialize.
 */
interface Session {
  transport: StreamableHTTPServerTransport
  tokenHolder: { current: string }
}

/** WWW-Authenticate header value for 401 responses, per RFC 9728. */
const WWW_AUTHENTICATE = `Bearer resource_metadata="${RESOURCE_URL}/.well-known/oauth-protected-resource"`

/**
 * Build the HTTP request handler for the Streamable HTTP entry point.
 *
 * The handler is exported as a factory so each call gets a fresh session
 * map. In production the bootstrap at the bottom of this file calls it
 * exactly once; in tests each case constructs its own isolated handler.
 *
 * Routes:
 *  - GET `/`                              discovery JSON (humans, bots, monitors)
 *  - GET `/health`                        health check
 *  - GET `/favicon.{ico,png}`             favicon for directory listings
 *  - GET `/.well-known/oauth-protected-resource`  RFC 9728 metadata
 *  - POST / DELETE `/` or `/mcp`          MCP Streamable HTTP transport
 *  - GET `/` or `/mcp` with `Accept: text/event-stream`  MCP SSE listen
 *
 * Serving the MCP protocol at both `/` and `/mcp` keeps the connector
 * working whether a directory entry registers the bare origin or appends
 * the explicit path. The discovery JSON at `/` is reserved for plain GET
 * requests that are not asking to open an SSE stream.
 *
 * @internal
 */
export function createRequestHandler(): (
  req: IncomingMessage,
  res: ServerResponse,
) => Promise<void> {
  const sessions = new Map<string, Session>()

  return async (req, res) => {
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

    // ── DELETE: explicit session termination ────────────────────────────
    if (req.method === "DELETE") {
      const sid = req.headers["mcp-session-id"] as string | undefined
      if (sid && sessions.has(sid)) {
        const session = sessions.get(sid)!
        await session.transport.close()
        sessions.delete(sid)
      }
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    // ── Auth ───────────────────────────────────────────────────────────
    const token = extractBearerToken(req)
    if (!token) {
      res.writeHead(401, {
        "Content-Type": "application/json",
        "WWW-Authenticate": WWW_AUTHENTICATE,
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

    // ── Session lookup ────────────────────────────────────────────────
    const sessionId = req.headers["mcp-session-id"] as string | undefined

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!
      // Update the per-session token holder so subsequent tool calls in
      // this request use the credential the client just sent. This is what
      // makes OAuth access-token rotation transparent: the previous request
      // may have used an older access token, this one uses the refreshed
      // one, and the SDK is rebuilt automatically inside createServer when
      // the token differs from what's cached.
      session.tokenHolder.current = token
      await session.transport.handleRequest(req, res)
      return
    }

    // ── New session (or session lost after restart) ───────────────────
    // Parse the body to check if it's an initialize request. If a client
    // sends a non-init request with an unknown session ID, return 404 so
    // it knows to re-initialize.
    const body = await new Promise<string>((resolve) => {
      let data = ""
      req.on("data", (chunk: Buffer) => {
        data += chunk.toString()
      })
      req.on("end", () => resolve(data))
    })

    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "bad_request", message: "Invalid JSON body." }))
      return
    }

    // If the client sent a session ID we don't know and it's not an init
    // request, tell it to re-initialize.
    if (sessionId && !isInitializeRequest(parsed)) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(
        JSON.stringify({
          error: "session_not_found",
          message: "Unknown session. Re-initialize without the Mcp-Session-Id header.",
        }),
      )
      return
    }

    // Create a new session.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    })

    // Per-session token holder. Read by the SDK provider inside
    // createServer on every tool call and resource read; updated by the
    // request handler on every subsequent request in this session so that
    // a rotated OAuth access token takes effect without re-initialization.
    const tokenHolder = { current: token }

    const mcpServer = createServer({ tokenProvider: () => tokenHolder.current })
    await mcpServer.connect(transport)

    // handleRequest processes the init and generates the session ID.
    // We must call it first, then read the session ID and store it.
    await transport.handleRequest(req, res, parsed)

    const newSessionId = transport.sessionId
    if (newSessionId) {
      sessions.set(newSessionId, { transport, tokenHolder })
    }
  }
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
