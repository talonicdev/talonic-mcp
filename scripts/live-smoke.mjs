#!/usr/bin/env node
// Live production smoke test for the Specs/Run/Ask tools. Boots the built
// hosted server (dist/http-server.js) on a free port EXACTLY like
// scripts/chatgpt-preflight.mjs, but does NOT override TALONIC_BASE_URL —
// every call goes to real production (https://api.talonic.com) with the
// real bearer token. This spends a small amount of the workspace's credits
// (one Spec run on one existing document, one scoped ask). Never run this
// in CI; it is a manual, deliberate, human-triggered check.
//
// Usage:
//   npm run build
//   TALONIC_API_KEY=tlnc_... npm run smoke:live
//
// Optional: TALONIC_BASE_URL to point the *document lookup* fetch (step 3)
// and the spawned server at a non-default origin. Leave unset for prod.
import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { setTimeout as sleep } from "node:timers/promises"

const API_KEY = process.env["TALONIC_API_KEY"]
if (!API_KEY || !API_KEY.startsWith("tlnc_")) {
  console.error("live-smoke: TALONIC_API_KEY (tlnc_...) must be set in the environment.")
  process.exit(1)
}

const DIRECT_BASE = process.env["TALONIC_BASE_URL"] ?? "https://api.talonic.com"
const RUN_POLL_INTERVAL_MS = 5_000
const RUN_POLL_TIMEOUT_MS = 10 * 60_000
const ANSWER_POLL_INTERVAL_MS = 5_000
const ANSWER_POLL_TIMEOUT_MS = 2 * 60_000

let step = "startup"
let nextId = 1

const port = await new Promise((resolve, reject) => {
  const s = createServer()
  s.listen(0, "127.0.0.1", () => {
    const { port } = s.address()
    s.close(() => resolve(port))
  })
  s.on("error", reject)
})

const child = spawn(process.execPath, ["dist/http-server.js"], {
  // Deliberately NOT setting TALONIC_BASE_URL — the server must default to
  // production (https://api.talonic.com), not the sandboxed preflight target.
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
})
child.on("error", (err) => {
  console.error(`live-smoke: could not start dist/http-server.js: ${err.message}`)
})
let logs = ""
child.stdout.on("data", (d) => (logs += d))
child.stderr.on("data", (d) => (logs += d))

const base = `http://127.0.0.1:${port}`
const auth = { Authorization: `Bearer ${API_KEY}` }

const rpc = async (body, headers, timeoutMs = 15_000) => {
  const res = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text()
  const m = text.match(/data: (\{[\s\S]*\})/)
  return { status: res.status, json: JSON.parse(m ? m[1] : text) }
}

/** Call an MCP tool and return its parsed payload, or throw a readable Error. */
const callTool = async (name, args, timeoutMs = 15_000) => {
  const { status, json } = await rpc(
    {
      jsonrpc: "2.0",
      id: nextId++,
      method: "tools/call",
      params: { name, arguments: args },
    },
    auth,
    timeoutMs,
  )
  if (status !== 200) throw new Error(`${name}: HTTP ${status} — ${JSON.stringify(json)}`)
  if (json.error) throw new Error(`${name}: JSON-RPC error — ${JSON.stringify(json.error)}`)
  const result = json.result
  if (result?.isError) {
    const text = result.content?.[0]?.text ?? JSON.stringify(result)
    throw new Error(`${name}: tool error — ${text}`)
  }
  if (result?.structuredContent) return result.structuredContent
  return JSON.parse(result?.content?.[0]?.text ?? "null")
}

const sleepUntil = (deadline) => sleep(Math.max(0, Math.min(5_000, deadline - Date.now())))

async function main() {
  step = "wait for /health"
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

  step = "initialize"
  const init = await rpc(
    {
      jsonrpc: "2.0",
      id: nextId++,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "live-smoke", version: "0" },
      },
    },
    auth,
  )
  if (init.status !== 200) throw new Error(`initialize -> HTTP ${init.status}`)

  // ── Step 1: list Specs, pick the smallest published one ────────────────
  step = "talonic_list_specs"
  let specsResult = await callTool("talonic_list_specs", { limit: 10 })
  let specs = (specsResult.data ?? []).filter((s) => s.version != null)
  if (specs.length === 0) {
    // Fall back to a bigger page before giving up — a 10-row page may simply
    // not contain any published Spec.
    specsResult = await callTool("talonic_list_specs", { limit: 100 })
    specs = (specsResult.data ?? []).filter((s) => s.version != null)
  }
  if (specs.length === 0) {
    throw new Error("no published Spec (version != null) found via talonic_list_specs")
  }
  specs.sort((a, b) => (a.field_count ?? Infinity) - (b.field_count ?? Infinity))
  console.log(
    `Candidate published Specs (smallest field_count first): ${specs
      .map((s) => `${s.name} (${s.id}, fields=${s.field_count})`)
      .join("; ")}`,
  )

  // ── Step 3: find a completed document (once — independent of Spec) ─────
  step = "find document"
  const docsRes = await fetch(`${DIRECT_BASE}/v1/documents?limit=1&status=completed`, {
    headers: { ...auth, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  })
  if (!docsRes.ok) {
    throw new Error(`GET /v1/documents -> HTTP ${docsRes.status} — ${await docsRes.text()}`)
  }
  const docsBody = await docsRes.json()
  const docRow = (docsBody.data ?? docsBody.documents ?? [])[0]
  const documentId = docRow?.id ?? docRow?.document_id
  if (!documentId) {
    throw new Error(
      `no completed document found via GET /v1/documents?limit=1&status=completed — body: ${JSON.stringify(docsBody)}`,
    )
  }
  console.log(`Document: ${documentId}`)

  // ── Steps 2 + 4: get_spec, then run_spec — retry once on a platform-side
  //    run failure (e.g. 400 "no composed rail") with the next candidate. ──
  let chosenSpec = null
  let runEnvelope = null
  let lastRunError = null
  for (let attempt = 0; attempt < Math.min(2, specs.length); attempt++) {
    const candidate = specs[attempt]
    step = `talonic_get_spec (${candidate.name})`
    const specDetail = await callTool("talonic_get_spec", {
      spec_id: candidate.id,
      include_versions: true,
    })
    const nodeTypes = [...new Set((specDetail.nodes ?? []).map((n) => n.type))]
    console.log(
      `Spec: ${specDetail.name} (${specDetail.id}) — version ${specDetail.version}, ` +
        `node types [${nodeTypes.join(", ")}], phases ${specDetail.phases?.length ?? 0}`,
    )

    step = `talonic_run_spec (${candidate.name})`
    try {
      runEnvelope = await callTool("talonic_run_spec", {
        spec_id: candidate.id,
        document_ids: [documentId],
        name: "mcp live smoke",
      })
      chosenSpec = specDetail
      console.log(`RunEnvelope: ${JSON.stringify(runEnvelope, null, 2)}`)
      break
    } catch (err) {
      lastRunError = err
      console.warn(`talonic_run_spec failed for Spec "${candidate.name}": ${err.message}`)
      runEnvelope = null
    }
  }
  if (!runEnvelope) {
    throw new Error(
      `talonic_run_spec failed on every candidate Spec tried; last error: ${lastRunError?.message}`,
    )
  }

  // ── Poll talonic_get_run until it leaves "processing" ───────────────────
  step = "talonic_get_run (poll)"
  const runRef = runEnvelope.pipeline_id
    ? { pipeline_id: runEnvelope.pipeline_id }
    : { run_id: runEnvelope.run_id }
  const runDeadline = Date.now() + RUN_POLL_TIMEOUT_MS
  let runStatus = null
  for (;;) {
    runStatus = await callTool("talonic_get_run", runRef)
    console.log(
      `  poll: status=${runStatus.status} progress=${JSON.stringify(runStatus.progress ?? null)}`,
    )
    if (runStatus.status !== "processing") break
    if (Date.now() >= runDeadline) {
      throw new Error(
        `talonic_get_run still "processing" after ${RUN_POLL_TIMEOUT_MS / 60_000} minutes`,
      )
    }
    await sleepUntil(Date.now() + RUN_POLL_INTERVAL_MS)
  }
  console.log(
    `Run final: status=${runStatus.status}, progress=${JSON.stringify(runStatus.progress ?? null)}`,
  )

  // ── Step 5: read results ─────────────────────────────────────────────
  step = "talonic_get_run_results"
  const results = await callTool("talonic_get_run_results", { ...runRef, limit: 5 })
  const rowCount = results.data?.length ?? 0
  const colCount = results.columns?.length ?? 0
  console.log(
    `Results: columns=${colCount}, rows=${rowCount}, pending_review_count=${results.pending_review_count ?? "n/a"}`,
  )

  // ── Step 6: ask ───────────────────────────────────────────────────────
  step = "talonic_ask"
  let ask = await callTool(
    "talonic_ask",
    {
      question: "What is the total amount on this document?",
      scope: { document_ids: [documentId] },
      wait_seconds: 50,
    },
    75_000,
  )
  if (ask.status === "processing") {
    step = "talonic_get_answer (poll)"
    const askDeadline = Date.now() + ANSWER_POLL_TIMEOUT_MS
    for (;;) {
      if (Date.now() >= askDeadline) {
        throw new Error(
          `talonic_get_answer still "processing" after ${ANSWER_POLL_TIMEOUT_MS / 60_000} minutes`,
        )
      }
      await sleepUntil(Date.now() + ANSWER_POLL_INTERVAL_MS)
      ask = await callTool("talonic_get_answer", { ask_id: ask.ask_id })
      if (ask.status !== "processing") break
    }
  }
  const answerExcerpt = (ask.answer ?? "").slice(0, 200)
  console.log(
    `Ask: status=${ask.status}, verdict=${ask.verification?.verdict ?? "n/a"}, ` +
      `credits_charged=${ask.usage?.credits_charged ?? "n/a"}`,
  )
  console.log(`Answer (first 200 chars): ${answerExcerpt}`)

  console.log(
    `LIVE SMOKE OK — spec ${chosenSpec.name}, pipeline ${runRef.pipeline_id ?? runRef.run_id} ${runStatus.status}, ` +
      `rows ${rowCount}, ask ${ask.status} (${ask.usage?.credits_charged ?? "n/a"} credits)`,
  )
}

try {
  await main()
} catch (err) {
  console.error(`LIVE SMOKE FAILED at step "${step}": ${err?.message ?? err}`)
  process.exitCode = 1
} finally {
  child.kill("SIGTERM")
  await Promise.race([new Promise((r) => child.once("exit", r)), sleep(2_000)])
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
}
