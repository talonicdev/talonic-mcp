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

  it("POST /mcp with an initialize body opens a session (regression)", async () => {
    const res = await fetch(`${h.baseUrl}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: initializeBody(),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("mcp-session-id")).toBeTruthy()
    await res.body?.cancel()
  })

  it("POST / with an initialize body opens a session (the fix)", async () => {
    const res = await fetch(`${h.baseUrl}/`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: initializeBody(),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get("mcp-session-id")).toBeTruthy()
    await res.body?.cancel()
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
