#!/usr/bin/env node
// Boots the built hosted server on a free port and checks what ChatGPT's
// renderer and model will see: tools/list (22 public tools, each with an
// outputTemplate + status strings) and every widget template fetched through
// the UNAUTHENTICATED fast path with a JSON-only Accept header.
// Usage: npm run build && npm run preflight:chatgpt
import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { setTimeout as sleep } from "node:timers/promises"

const EXPECTED_TOOLS = 22

const port = await new Promise((resolve, reject) => {
  const s = createServer()
  s.listen(0, "127.0.0.1", () => {
    const { port } = s.address()
    s.close(() => resolve(port))
  })
  s.on("error", reject)
})

const failures = []

const child = spawn(process.execPath, ["dist/http-server.js"], {
  env: { ...process.env, PORT: String(port), TALONIC_BASE_URL: "http://127.0.0.1:9" },
  stdio: ["ignore", "pipe", "pipe"],
})
child.on("error", (err) => failures.push("could not start dist/http-server.js: " + err.message))
let logs = ""
child.stdout.on("data", (d) => (logs += d))
child.stderr.on("data", (d) => (logs += d))

const base = `http://127.0.0.1:${port}`
try {
  let up = false
  for (let i = 0; i < 50 && !up; i++) {
    try {
      up = (await fetch(`${base}/health`, { signal: AbortSignal.timeout(1_000) })).ok
    } catch {
      up = false
    }
    if (!up) await sleep(100)
  }
  if (!up) throw new Error(`server did not come up on ${base}\n${logs}`)

  const rpc = async (body, headers) => {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    const text = await res.text()
    const m = text.match(/data: (\{[\s\S]*\})/)
    return { status: res.status, json: JSON.parse(m ? m[1] : text) }
  }

  const auth = { Authorization: "Bearer tlnc_preflight" }
  const init = await rpc(
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "preflight", version: "0" } } },
    auth,
  )
  if (init.status !== 200) failures.push(`initialize -> HTTP ${init.status}`)

  const list = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, auth)
  const tools = list.json?.result?.tools ?? []
  const publicTools = tools.filter((t) => !t.name.startsWith("talonic_admin_") && !t.name.startsWith("talonic_growth_"))
  if (publicTools.length !== EXPECTED_TOOLS) failures.push(`tools/list: expected ${EXPECTED_TOOLS} public tools, got ${publicTools.length}`)
  const uris = []
  for (const t of publicTools) {
    const meta = t._meta ?? {}
    const uri = meta["openai/outputTemplate"]
    if (!uri) failures.push(`${t.name}: no openai/outputTemplate`)
    else uris.push([t.name, uri])
    for (const k of ["openai/toolInvocation/invoking", "openai/toolInvocation/invoked"]) {
      if (typeof meta[k] !== "string" || meta[k].length === 0 || meta[k].length > 64) failures.push(`${t.name}: bad ${k}`)
    }
    if (!t.annotations || typeof t.annotations.readOnlyHint !== "boolean") failures.push(`${t.name}: missing readOnlyHint`)
    if (!t.title && !t.annotations?.title) failures.push(`${t.name}: missing title`)
  }

  // Templates: unauthenticated, JSON-only Accept — exactly what the renderer does.
  for (const [name, uri] of uris) {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri } }),
      signal: AbortSignal.timeout(10_000),
    })
    const body = await res.json().catch(() => null)
    const item = body?.result?.contents?.[0]
    if (res.status !== 200 || !item) failures.push(`${name}: template ${uri} -> HTTP ${res.status}`)
    else {
      if (item.mimeType !== "text/html;profile=mcp-app") failures.push(`${name}: wrong mimeType ${item.mimeType}`)
      if (!/^<!doctype html>/i.test(item.text ?? "")) failures.push(`${name}: template is not an HTML document`)
      if (!item._meta?.["openai/widgetDescription"]) failures.push(`${name}: template lacks openai/widgetDescription`)
      if (item._meta?.["openai/widgetDomain"] !== "https://talonic.com") failures.push(`${name}: wrong widgetDomain`)
    }
  }

  console.log(`preflight: ${publicTools.length} public tools, ${uris.length} templates fetched`)
} catch (err) {
  failures.push(String(err?.message ?? err))
} finally {
  child.kill("SIGTERM")
  await Promise.race([
    new Promise((r) => child.once("exit", r)),
    sleep(2000),
  ])
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
}

if (failures.length) {
  console.error("PREFLIGHT FAILED:\n - " + failures.join("\n - "))
  process.exit(1)
}
console.log("PREFLIGHT OK — ChatGPT will see 22 tools, each with a fetchable widget template.")
