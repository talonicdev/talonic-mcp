/**
 * Talonic MCP server, Streamable HTTP entry point.
 *
 * Hosts the MCP server over HTTP for remote clients. Designed for
 * deployment on Railway (or any container host) behind a custom domain
 * like `mcp.talonic.com`.
 *
 * Supports two auth modes:
 *   1. Authorization: Bearer tlnc_...
 *   2. ?apiKey=tlnc_... query param (convenience for MCP client configs)
 *
 * @internal
 */

import { createServer as createHttpServer } from "node:http"
import { randomUUID } from "node:crypto"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { createServer } from "./server-factory.js"
import { SERVER_NAME, VERSION } from "./version.js"

const PORT = Number(process.env["PORT"] ?? 3000)

/**
 * Extract the Talonic API key from the request. Checks the Authorization
 * header first, then falls back to the `apiKey` query parameter.
 */
function extractApiKey(req: { url?: string; headers: Record<string, string | string[] | undefined> }): string | undefined {
  // 1. Authorization: Bearer tlnc_...
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
 * Per-session state: one MCP server + one transport per authenticated
 * session. Sessions are keyed by the transport's generated session ID.
 */
interface Session {
  transport: StreamableHTTPServerTransport
}

const sessions = new Map<string, Session>()

const httpServer = createHttpServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost")
  const path = url.pathname

  // ── Health check ──────────────────────────────────────────────────
  if (path === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ status: "ok", server: SERVER_NAME, version: VERSION }))
    return
  }

  // ── CORS preflight ────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id")
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id")

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  // ── Only serve /mcp ───────────────────────────────────────────────
  if (path !== "/mcp") {
    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "not_found", message: `No route for ${path}. Use /mcp for the MCP endpoint or /health for status.` }))
    return
  }

  // ── Auth ───────────────────────────────────────────────────────────
  const apiKey = extractApiKey(req)
  if (!apiKey) {
    res.writeHead(401, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "unauthorized", message: "Provide a Talonic API key via Authorization: Bearer tlnc_... header or ?apiKey=tlnc_... query param." }))
    return
  }

  // ── Session lookup or creation ────────────────────────────────────
  const sessionId = req.headers["mcp-session-id"] as string | undefined

  if (sessionId && sessions.has(sessionId)) {
    // Existing session — route request to its transport.
    const session = sessions.get(sessionId)!
    await session.transport.handleRequest(req, res)
    return
  }

  if (sessionId && !sessions.has(sessionId)) {
    // Client sent an unknown session ID — reject per spec.
    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "session_not_found", message: "Unknown session. Start a new session without the Mcp-Session-Id header." }))
    return
  }

  // ── New session (initialization request) ──────────────────────────
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  })

  const mcpServer = createServer({ apiKey })
  await mcpServer.connect(transport)

  // Track the session.
  const newSessionId = transport.sessionId
  if (newSessionId) {
    sessions.set(newSessionId, { transport })

    transport.onclose = () => {
      sessions.delete(newSessionId)
    }
  }

  await transport.handleRequest(req, res)
})

httpServer.listen(PORT, () => {
  console.log(`${SERVER_NAME} ${VERSION} listening on http://0.0.0.0:${PORT}/mcp`)
  console.log(`Health check: http://0.0.0.0:${PORT}/health`)
})
