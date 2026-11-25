import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { createServer } from "../../src/server-factory"
// @ts-expect-error plain ESM script without types
import { checkAll, loadPinned } from "../../scripts/check-routes.mjs"

/**
 * Runtime half of the route-drift guard (scripts/check-routes.mjs is the
 * static half). Every registered tool, with every gated group switched on, is
 * called with generated minimal arguments, and the tools that pick a route
 * from their arguments are called once per branch. Every request a tool sends
 * must be an operation of the pinned public spec (or a listed gap) with the
 * verb it uses.
 */

const UUID = "22222222-2222-4222-8222-222222222222"
const UUID2 = "33333333-3333-4333-8333-333333333333"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Never the real API: every request goes to a host that does not exist, through the stub below. */
const BASE = "https://api.example.test"

const ALL_GROUPS = {
  apiKey: "tlnc_test",
  baseUrl: BASE,
  includeAgentTaskTools: true,
  includeDecisionTaskTools: true,
  includeContractsTools: true,
  includeApTools: true,
  includeDocGenTools: true,
  includePartiesTools: true,
  includeMasterRecordsTools: true,
  includeSubmissionsTools: true,
  includePriceBaselineTools: true,
  includePortfolioTools: true,
  includeProcessesTools: true,
  includeGrowthTools: true,
  includeAdminAgentTaskTools: true,
}

/** Tools whose route depends on their arguments: one entry per branch. */
const BRANCHES: Record<string, Array<Record<string, unknown>>> = {
  talonic_parties_issues: [{}, { scope: "partners", product_id: UUID }],
  talonic_parties_contract: [{ product_id: UUID, row_id: "rec_1/2", on: "2026-01-31" }],
  talonic_parties_contracts: [{ party_id: UUID }],
  talonic_parties_documents: [{ party_id: UUID }],
  talonic_parties_history: [{ party_id: UUID }],
  talonic_parties_search: [{}, { scope: "all", query: "x" }],
  talonic_parties_party: [
    { party_id: UUID },
    { party_id: UUID, overview: true },
    { party_id: UUID, town: "Berlin" },
    { display_name: "Muster AG" },
  ],
  talonic_parties_names: [
    { party_id: UUID, name: "Muster", kind: "alias" },
    { name_id: UUID, state: "confirmed" },
    { name_id: UUID, remove: true },
  ],
  talonic_parties_directory_link: [
    { party_id: UUID, external_id: "ACC-1" },
    { party_id: UUID, external_id: null },
  ],
  talonic_parties_address_choice: [{ party_id: UUID, choice: "crm" }],
  talonic_parties_set_role: [
    { product_id: UUID, row_id: "rec_1", party_id: UUID2, role: "partner" },
    { role_id: UUID, state: "confirmed" },
  ],
  talonic_parties_confirm: [{ role_ids: [UUID, UUID2] }],
  talonic_parties_merge: [{ party_id: UUID, into: UUID2 }],
  talonic_parties_read: [
    { product_id: UUID, row_id: "rec_1" },
    { product_id: UUID, row_id: "rec_1", status: true },
    { product_id: UUID, row_id: "rec_1", wait_seconds: 5 },
    { status: true },
    { status: true, wait_seconds: 5 },
  ],
  talonic_parties_sync: [{}, { row_ids: ["rec_1"] }, { wait_seconds: 5 }],
  talonic_parties_members: [{ party_id: UUID, person_id: UUID2 }, { member_id: UUID }],
  talonic_parties_group_companies: [{}, { companies: [{ name: "Muster AG" }] }],
  talonic_ap_netsuite_runs: [{}, { run_id: UUID }],
  talonic_run_spec: [
    { spec_id: UUID, document_ids: [UUID] },
    { spec_id: UUID, file_urls: ["https://example.test/a.pdf"] },
  ],
  talonic_get_run: [{ pipeline_id: UUID }, { run_id: UUID }],
  talonic_get_run_results: [{ pipeline_id: UUID }, { run_id: UUID }],
}

// ── argument synthesis from the tool's input schema ─────────────────────────

type Json = Record<string, any>

function synth(s: Json | undefined): unknown {
  if (!s) return "x"
  if (s.const !== undefined) return s.const
  if (s.enum) return s.enum[0]
  const alt = s.anyOf ?? s.oneOf
  if (alt) return synth(alt.find((a: Json) => a.type !== "null") ?? alt[0])
  const type = Array.isArray(s.type) ? s.type.find((t: string) => t !== "null") : s.type
  switch (type) {
    case "string":
      if (s.format === "uuid") return UUID
      if (s.format === "uri" || s.format === "url") return "https://example.test/a.pdf"
      if (s.format === "email") return "a@example.test"
      if (s.format === "date" || /\\d\{4\}/.test(s.pattern ?? "")) return "2026-01-31"
      return "x".repeat(Math.max(1, s.minLength ?? 1))
    case "number":
    case "integer":
      return s.minimum ?? (s.exclusiveMinimum !== undefined ? s.exclusiveMinimum + 1 : 1)
    case "boolean":
      return false
    case "array":
      return Array.from({ length: Math.max(1, s.minItems ?? 1) }, () => synth(s.items))
    case "object": {
      const out: Json = {}
      for (const k of s.required ?? []) out[k] = synth(s.properties?.[k])
      return out
    }
    default:
      return "x"
  }
}

function minimalArgs(inputSchema: unknown): Json {
  if (!inputSchema) return {}
  try {
    // The SDK stores a normalised (zod-mini) object schema; a raw shape is wrapped.
    const schema =
      typeof inputSchema === "object" && "_zod" in (inputSchema as object)
        ? (inputSchema as z.ZodType)
        : z.object(inputSchema as Record<string, z.ZodTypeAny>)
    return synth(z.toJSONSchema(schema, { unrepresentable: "any" }) as Json) as Json
  } catch {
    return {}
  }
}

// ── capture ────────────────────────────────────────────────────────────────

/** A body that ends every poll loop at once (done, not syncing, completed). */
const DONE_BODY = {
  status: "completed",
  state: "done",
  syncing: false,
  read: { status: "done" },
  reads: { pending: 0, running: 0 },
  data: [],
  id: UUID,
  run_id: UUID,
  ask_id: UUID,
  pipeline_id: UUID,
}

interface Call {
  tool: string
  method: string
  path: string
}

/**
 * The server captures `fetch` when it is created, so one stub is installed
 * before `createServer` and routes to whatever the current capture collects.
 * A request to any host but the fake base fails the test.
 */
let sink: Call[] | null = null
let foreign: string[] = []
const fetchStub = vi.fn().mockImplementation(async (url: string | URL, init?: RequestInit) => {
  const u = new URL(String(url))
  if (u.origin !== BASE) {
    foreign.push(String(url))
    throw new Error(`request to ${u.origin} refused in tests`)
  }
  sink?.push({ tool: "", method: (init?.method ?? "GET").toUpperCase(), path: u.pathname })
  return new Response(JSON.stringify(DONE_BODY), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
})

async function capture(tool: string, handler: (a: unknown, e: unknown) => unknown, args: Json) {
  const calls: Call[] = []
  sink = calls
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] })
  try {
    let settled = false
    const p = Promise.resolve()
      .then(() => handler(args, { signal: new AbortController().signal }))
      .catch(() => undefined)
      .finally(() => {
        settled = true
      })
    for (let i = 0; i < 50 && !settled; i++) await vi.advanceTimersByTimeAsync(30_000)
    await Promise.race([p, Promise.resolve()])
  } finally {
    vi.useRealTimers()
    sink = null
  }
  return calls.map((c) => ({ ...c, tool }))
}

/** A request path in the check's form: uuid segments become `{}`; the rest stay literal. */
const asRoute = (c: Call) => ({
  file: c.tool,
  line: 0,
  method: c.method,
  prefix: false,
  path:
    "/" +
    c.path
      .split("/")
      .filter(Boolean)
      .map((s) => (UUID_RE.test(s) ? "{}" : s))
      .join("/"),
})

afterEach(() => {
  vi.useRealTimers()
})
afterAll(() => {
  vi.unstubAllGlobals()
})

describe("every request a tool sends is a spec operation", () => {
  type Tools = Record<
    string,
    { handler: (a: unknown, e: unknown) => unknown; inputSchema?: unknown }
  >
  let tools: Tools = {}
  let names: string[] = []
  beforeAll(() => {
    vi.stubGlobal("fetch", fetchStub)
    foreign = []
    tools = (createServer(ALL_GROUPS as any) as any)._registeredTools as Tools
    names = Object.keys(tools).sort()
  })
  const pinned = loadPinned().paths

  it("the branch table names only registered tools", () => {
    for (const t of Object.keys(BRANCHES)) expect(names, t).toContain(t)
  })

  it("minimal arguments for every tool, and each listed branch", async () => {
    const calls: Call[] = []
    let reached = 0
    for (const name of names) {
      const runs = [minimalArgs(tools[name]!.inputSchema), ...(BRANCHES[name] ?? [])]
      let any = false
      for (const args of runs) {
        const got = await capture(name, tools[name]!.handler, args)
        if (got.length) any = true
        calls.push(...got)
      }
      if (any) reached++
    }
    // Each listed branch must reach the API (a branch that fails validation tests nothing).
    for (const [name, runs] of Object.entries(BRANCHES)) {
      for (const args of runs) {
        const got = await capture(name, tools[name]!.handler, args)
        expect(got.length, `${name} ${JSON.stringify(args)} sent no request`).toBeGreaterThan(0)
      }
    }
    expect(reached, "tools that sent a request").toBeGreaterThan(names.length * 0.8)
    const { misses } = checkAll(pinned, calls.map(asRoute))
    const seen = new Set<string>()
    const report = misses
      .map((m: any) => `${m.file}: ${m.method} ${m.path} (${m.why})`)
      .filter((l: string) => !seen.has(l) && seen.add(l))
    expect(report).toEqual([])
    expect(foreign, "requests outside the fake API host").toEqual([])
  }, 120_000)

  it("the matcher refuses a literal in a uuid slot (the 0.1.103 wildcard collision)", () => {
    const route = (method: string, path: string) => ({
      file: "t",
      line: 0,
      method,
      path,
      prefix: false,
    })
    const { misses } = checkAll(
      pinned,
      [
        route("GET", "/v1/parties/issues"),
        route("GET", "/v1/parties/contracts"),
        route("POST", "/v1/parties/read"),
        route("DELETE", "/v1/parties/status"),
        route("GET", "/v1/parties/{}"),
      ],
      [],
    )
    expect(misses.map((m: any) => `${m.method} ${m.path}`)).toEqual([
      "GET /v1/parties/issues",
      "GET /v1/parties/contracts",
      "POST /v1/parties/read",
      "DELETE /v1/parties/status",
    ])
  })
})
