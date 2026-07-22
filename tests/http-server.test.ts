/**
 * Tests for the Streamable HTTP entry point.
 *
 * Each test spins up the real Node http.Server bound to an ephemeral port,
 * makes real fetch requests, and asserts on the response. We exercise the
 * exported request handler rather than mocking req/res so the assertions
 * cover header / status / streaming behavior end-to-end.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createServer as createHttpServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { createRequestHandler } from "../src/http-server"

interface HarnessServer {
  server: Server
  baseUrl: string
}

async function startHarness(): Promise<HarnessServer> {
  const server = createHttpServer(createRequestHandler())
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo
  return { server, baseUrl: `http://127.0.0.1:${port}` }
}

async function stopHarness(h: HarnessServer): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    h.server.close((err) => (err ? reject(err) : resolve())),
  )
}

function initializeBody(): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "vitest", version: "0.0.0" },
    },
  })
}

const MCP_HEADERS = {
  Authorization: "Bearer tlnc_test",
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
}

describe("HTTP server routing", () => {
  let h: HarnessServer

  beforeEach(async () => {
    h = await startHarness()
  })

  afterEach(async () => {
    await stopHarness(h)
  })

  it("GET / returns discovery JSON (baseline, must not regress)", async () => {
    const res = await fetch(`${h.baseUrl}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toMatch(/application\/json/)
    const body = (await res.json()) as Record<string, unknown>
    expect(body["name"]).toBe("talonic")
    expect(body["mcp_endpoint"]).toBe("/mcp")
  })

  it("GET /health returns ok (regression)", async () => {
    const res = await fetch(`${h.baseUrl}/health`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body["status"]).toBe("ok")
  })

  it("GET /unknown returns 404 (regression)", async () => {
    const res = await fetch(`${h.baseUrl}/unknown`)
    expect(res.status).toBe(404)
  })

  it("GET /.well-known/openai-apps-challenge returns the token as plain text", async () => {
    const res = await fetch(`${h.baseUrl}/.well-known/openai-apps-challenge`)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/plain")
    const body = (await res.text()).trim()
    // Default token (no env override in tests). Non-empty, no JSON wrapping.
    expect(body.length).toBeGreaterThan(0)
    expect(body).toBe("gnHvfQsKH6NVBNIeOWVK1vSt5QR2gsgBAIcXdSlpR_U")
  })

  it("POST /mcp initialize succeeds with no session id (stateless)", async () => {
    const res = await fetch(`${h.baseUrl}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: initializeBody(),
    })
    expect(res.status).toBe(200)
    // Stateless: the server must NOT hand out a session id to track.
    expect(res.headers.get("mcp-session-id")).toBeNull()
    const text = await res.text()
    expect(text).toContain("serverInfo")
  })

  it("POST / initialize succeeds with no session id (stateless)", async () => {
    const res = await fetch(`${h.baseUrl}/`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: initializeBody(),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("mcp-session-id")).toBeNull()
  })

  it("tools/list works on a fresh request with NO session id (the fix)", async () => {
    // This is the regression guard for the connector-dies-after-redeploy bug:
    // a stateless server must answer tool requests without any prior session,
    // so a client whose old session was wiped never gets stuck.
    const res = await fetch(`${h.baseUrl}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain("talonic_extract")
    expect(text).toContain("talonic_get_balance")
  })

  it("widget template resources/read works WITHOUT auth and with JSON-only Accept (review fix)", async () => {
    // OpenAI review failed test case #4 with "Error loading app, failed to
    // fetch the template". Widget templates are static, secret-free HTML;
    // their fetch must never die on a missing/stale token (401) or a missing
    // text/event-stream Accept (406). Served via a public fast path.
    const res = await fetch(`${h.baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 7,
        method: "resources/read",
        params: { uri: "ui://widget/markdown-view.html" },
      }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("application/json")
    const body = (await res.json()) as any
    expect(body.id).toBe(7)
    expect(body.result.contents[0].mimeType).toBe("text/html;profile=mcp-app")
    expect(body.result.contents[0].text).toMatch(/^<!doctype html>/i)
    expect(body.result.contents[0]._meta?.["openai/widgetDomain"]).toBe("https://talonic.com")
  })

  it("non-widget resources/read still requires auth (fast path is widgets-only)", async () => {
    const res = await fetch(`${h.baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 8,
        method: "resources/read",
        params: { uri: "talonic://schemas" },
      }),
    })
    expect(res.status).toBe(401)
  })

  it("unknown ui://widget/ uri returns a JSON-RPC resource-not-found error, not a crash", async () => {
    const res = await fetch(`${h.baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 9,
        method: "resources/read",
        params: { uri: "ui://widget/does-not-exist.html" },
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.error?.code).toBe(-32002)
  })

  it("GET /mcp is 405 in stateless mode", async () => {
    const res = await fetch(`${h.baseUrl}/mcp`, {
      method: "GET",
      headers: { Authorization: "Bearer tlnc_test", Accept: "text/event-stream" },
    })
    expect(res.status).toBe(405)
  })

  it("POST / without auth returns 401 (the fix preserves auth)", async () => {
    const res = await fetch(`${h.baseUrl}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: initializeBody(),
    })
    expect(res.status).toBe(401)
    expect(res.headers.get("www-authenticate")).toMatch(/^Bearer /)
  })
})
