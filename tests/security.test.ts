/**
 * Regression tests from the November 2026 MCP security review. Each case pins
 * one confirmed defect; see the commit message for the exploit it reproduces.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createServer as createHttpServer, type Server } from "node:http"
import { connect, type AddressInfo } from "node:net"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { createRequestHandler, tokenAcceptedCached } from "../src/http-server"
import { createServer } from "../src/server-factory"
import { handleExtract } from "../src/tools/extract"
import { handleToMarkdown } from "../src/tools/to-markdown"

const off = async () => false

function listen(server: Server): Promise<string> {
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve(`127.0.0.1:${(server.address() as AddressInfo).port}`),
    ),
  )
}

function closeServer(server: Server): Promise<void> {
  server.closeAllConnections()
  return new Promise((resolve) => server.close(() => resolve()))
}

const allProbesOff = {
  growthAccess: off,
  adminAgentTaskAccess: off,
  contractsAccess: off,
  apAccess: off,
  docGenAccess: off,
  partiesAccess: off,
  masterRecordsAccess: off,
  submissionsAccess: off,
  priceBaselineAccess: off,
  portfolioAccess: off,
  processesAccess: off,
  agentTasksAccess: off,
  decisionTasksAccess: off,
  threadAccess: off,
  agentTurnsAccess: off,
  myDataAccess: off,
}

async function post(addr: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`http://${addr}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

/** Parse the JSON-RPC result from a Streamable HTTP (SSE-framed) response. */
async function rpcResult(res: Response): Promise<any> {
  const text = await res.text()
  const line = text.split("\n").find((l) => l.startsWith("data: "))
  return JSON.parse(line ? line.slice(6) : text).result
}

describe("request handling survives hostile input", () => {
  let server: Server
  let addr: string
  beforeAll(async () => {
    server = createHttpServer(
      createRequestHandler({ ...allProbesOff, tokenAccepted: async (t) => t !== "rejected" }),
    )
    addr = await listen(server)
  })
  afterAll(() => closeServer(server))

  it("answers 400 to an unparseable request target instead of crashing", async () => {
    const [host, port] = addr.split(":")
    const raw = await new Promise<string>((resolve, reject) => {
      const s = connect(Number(port), host!, () =>
        s.write("GET // HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n"),
      )
      let out = ""
      s.on("data", (d) => (out += d.toString()))
      s.on("end", () => resolve(out))
      s.on("error", reject)
    })
    expect(raw).toMatch(/^HTTP\/1\.1 400/)
    expect((await fetch(`http://${addr}/health`)).status).toBe(200)
  })

  it("caps the body of an unauthenticated request", async () => {
    const res = await post(addr, "x".repeat(70 * 1024))
    expect(res.status).toBe(413)
  })

  it("still serves the small public widget read without a credential", async () => {
    const res = await post(addr, {
      jsonrpc: "2.0",
      id: 1,
      method: "resources/read",
      params: { uri: "ui://widget/none" },
    })
    expect(res.status).toBe(200)
  })

  it("answers 401 with a discovery header to a credential the API rejects", async () => {
    const res = await post(
      addr,
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { authorization: "Bearer rejected" },
    )
    expect(res.status).toBe(401)
    expect(res.headers.get("www-authenticate")).toContain("resource_metadata=")
  })

  it("does not accept an OAuth token through the apiKey query parameter", async () => {
    const res = await fetch(`http://${addr}/mcp?apiKey=eyJhbGciOi.not-a-key`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    })
    expect(res.status).toBe(401)
  })
})

describe("a rejected credential does not fan out", () => {
  it("runs no per-app probe for it", async () => {
    const probe = vi.fn(off)
    const server = createHttpServer(
      createRequestHandler({
        growthAccess: probe,
        adminAgentTaskAccess: probe,
        contractsAccess: probe,
        apAccess: probe,
        docGenAccess: probe,
        partiesAccess: probe,
        masterRecordsAccess: probe,
        submissionsAccess: probe,
        priceBaselineAccess: probe,
        portfolioAccess: probe,
        processesAccess: probe,
        agentTasksAccess: probe,
        decisionTasksAccess: probe,
        tokenAccepted: off,
      }),
    )
    const addr = await listen(server)
    await post(addr, { jsonrpc: "2.0", id: 1 }, { authorization: "Bearer x" })
    await closeServer(server)
    expect(probe).not.toHaveBeenCalled()
  })

  it("caches per credential and never answers for another one", async () => {
    const probe = vi.fn(async (t: string) => t === "good-sec")
    expect(await tokenAcceptedCached("good-sec", probe)).toBe(true)
    expect(await tokenAcceptedCached("bad-sec", probe)).toBe(false)
    expect(await tokenAcceptedCached("good-sec", probe)).toBe(true)
    expect(probe).toHaveBeenCalledTimes(2)
  })
})

describe("the hosted server never reads its own disk for a caller", () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-sec-"))
  const secret = join(dir, "secret.txt")
  writeFileSync(secret, "CANARY")

  it("refuses file_path in talonic_extract before any SDK call", async () => {
    const extract = vi.fn()
    const res = await handleExtract({ extract } as any, { file_path: secret, auto_schema: true })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("local install")
    expect(extract).not.toHaveBeenCalled()
  })

  it("refuses file_path in talonic_to_markdown before any SDK call", async () => {
    const extract = vi.fn()
    const res = await handleToMarkdown({ extract } as any, { file_path: secret })
    expect(res.isError).toBe(true)
    expect(extract).not.toHaveBeenCalled()
  })

  it.each([
    ["hosted", { tokenProvider: () => "t" }, false],
    ["local", { apiKey: "tlnc_x" }, true],
  ])("%s server offers file_path: %s", async (_name, opts, offered) => {
    const mcp = createServer(opts as any)
    const client = new Client({ name: "t", version: "1" })
    const [a, b] = InMemoryTransport.createLinkedPair()
    await Promise.all([mcp.connect(a), client.connect(b)])
    const { tools } = await client.listTools()
    for (const name of ["talonic_extract", "talonic_to_markdown"]) {
      const tool = tools.find((t) => t.name === name)!
      expect("file_path" in (tool.inputSchema.properties ?? {})).toBe(offered)
    }
    await client.close()
  })
})

describe("cross-tenant isolation through one server process", () => {
  // Stateless per-request servers are what keep tenants apart here: a shared
  // client or a token cached across requests would mix these answers.
  it("binds every concurrent call to its own bearer", async () => {
    const seen: string[] = []
    const api = createHttpServer((req, res) => {
      const auth = String(req.headers.authorization)
      seen.push(auth)
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ data: [{ id: auth.slice(-1), name: auth }] }))
    })
    const apiAddr = await listen(api)
    const prev = process.env["TALONIC_BASE_URL"]
    process.env["TALONIC_BASE_URL"] = `http://${apiAddr}`
    const server = createHttpServer(
      createRequestHandler({ ...allProbesOff, tokenAccepted: async () => true }),
    )
    const addr = await listen(server)
    try {
      const calls = Array.from({ length: 40 }, (_, i) => (i % 2 ? "tenantA" : "tenantB")).map(
        async (tenant, i) => {
          const res = await post(
            addr,
            {
              jsonrpc: "2.0",
              id: i,
              method: "tools/call",
              params: { name: "talonic_list_specs", arguments: {} },
            },
            { authorization: `Bearer ${tenant}` },
          )
          return { tenant, text: JSON.stringify(await rpcResult(res)) }
        },
      )
      for (const { tenant, text } of await Promise.all(calls)) {
        const other = tenant === "tenantA" ? "tenantB" : "tenantA"
        expect(text).toContain(tenant)
        expect(text).not.toContain(other)
      }
      expect(seen.length).toBe(40)
    } finally {
      if (prev === undefined) delete process.env["TALONIC_BASE_URL"]
      else process.env["TALONIC_BASE_URL"] = prev
      await closeServer(server)
      await closeServer(api)
    }
  })
})
