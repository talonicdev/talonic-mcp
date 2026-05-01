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
 * server returns 404 and the client re-initializes — standard MCP
 * reconnection behavior.
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
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
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
  const apiKey = extractApiKey(req)
  if (!apiKey) {
    res.writeHead(401, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "unauthorized", message: "Provide a Talonic API key via Authorization: Bearer tlnc_... header or ?apiKey=tlnc_... query param." }))
    return
  }

  // ── Session lookup ────────────────────────────────────────────────
  const sessionId = req.headers["mcp-session-id"] as string | undefined

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!
    await session.transport.handleRequest(req, res)
    return
  }

  // ── New session (or session lost after restart) ───────────────────
  // Parse the body to check if it's an initialize request. If a client
  // sends a non-init request with an unknown session ID, return 404 so
  // it knows to re-initialize.
  const body = await new Promise<string>((resolve) => {
    let data = ""
    req.on("data", (chunk: Buffer) => { data += chunk.toString() })
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
    res.end(JSON.stringify({ error: "session_not_found", message: "Unknown session. Re-initialize without the Mcp-Session-Id header." }))
    return
  }

  // Create a new session.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  })

  const mcpServer = createServer({ apiKey })
  await mcpServer.connect(transport)

  // handleRequest processes the init and generates the session ID.
  // We must call it first, then read the session ID and store it.
  await transport.handleRequest(req, res, parsed)

  const newSessionId = transport.sessionId
  if (newSessionId) {
    sessions.set(newSessionId, { transport })
  }
})

httpServer.listen(PORT, () => {
  console.log(`${SERVER_NAME} ${VERSION} listening on http://0.0.0.0:${PORT}/mcp`)
  console.log(`Health check: http://0.0.0.0:${PORT}/health`)
})
