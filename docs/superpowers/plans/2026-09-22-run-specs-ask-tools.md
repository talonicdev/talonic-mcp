# Run, Specs and Ask Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seven new public MCP tools — `talonic_list_specs`, `talonic_get_spec`, `talonic_run_spec`, `talonic_get_run`, `talonic_get_run_results`, `talonic_ask`, `talonic_get_answer` — so an agent can execute a customer's configured Spec pipeline and ask questions over the workspace; each with a ChatGPT widget (22 → 29), docs on both surfaces and the website, manifest entries, and test locks.

**Architecture:** Raw-fetch tools in `src/tools/{specs,run,ask}.ts` over `src/tools/_http.ts` (`apiJson`, new `apiForm` for multipart `/v1/run`, `sleep`) using the server's `TokenSource` fetch. `talonic_run_spec` fans out to `POST /v1/pipelines` (existing documents) or `POST /v1/run` (remote file URLs) and returns one normalised RunEnvelope; `talonic_get_run` / `talonic_get_run_results` accept `pipeline_id` or `run_id` and normalise likewise. `talonic_ask` starts an ask and polls with a bounded wait; `talonic_get_answer` is the read-only poll. Widgets follow the sub-project 1 scaffold and registry (`src/widgets/types.ts`, `register.ts`).

**Tech Stack:** TypeScript strict ESM (`.js` import suffixes), zod, `@modelcontextprotocol/sdk` McpServer, vitest 3 + jsdom, prettier (printWidth 100, no semicolons, double quotes, trailing commas), tsup. Website: Next.js app in `/Users/macman/Talonic/website`.

**Spec:** `docs/superpowers/specs/2026-09-22-run-specs-ask-tools-design.md`

## Global Constraints

- **Never `git push`** in either repo. A push to talonic-mcp `main` is a release; a push to website `main` deploys the site. Commit locally only.
- Commits touching `src/tools/**`, `src/http-server.ts` or `src/server-factory.ts` need EITHER a matching `docs/sections.json` change in the same push OR `[skip docs]` in the subject. Task 9 changes `docs/sections.json` for real, so tool commits in Tasks 1–4 and 8 carry `[skip docs]`; Task 9's commit must NOT carry it.
- Tool descriptions: one-line WHAT, then `USE WHEN:` / `NOT FOR:` / `ARGS:` / `RETURNS:` lines; ≤ 1500 characters; must contain the literal `NOT FOR` (locked by `tests/tools/descriptions.test.ts`).
- Annotations (binding): `talonic_list_specs`, `talonic_get_spec`, `talonic_get_run`, `talonic_get_run_results`, `talonic_get_answer` → `readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true`; `talonic_run_spec` → `readOnlyHint: false, destructiveHint: false, openWorldHint: true`; `talonic_ask` → `readOnlyHint: false, destructiveHint: false, openWorldHint: false`.
- Widget render bodies: JS inside TS template literals, no backticks, no `${`, concatenation only; every payload-derived string through `esc`/`chip`/`idChip`; no external assets (CSP stays empty). Fixtures use generic names/ids only.
- Status strings ≤ 64 chars; widget descriptions > 20 chars.
- Before every commit: `npm run typecheck && npm run format && npm test` green (website: `npm run typecheck` if present, else `npx tsc --noEmit -p .`; website build is NOT required locally — it needs 15 GB).
- Commit trailer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Never read or modify `.superpowers/sdd/2026-09-22-chatgpt-widget-parity/` (another plan's workspace).

## File structure

| File | Responsibility |
| --- | --- |
| `src/tools/_http.ts` | + `HttpMethod` union, `FormFields`, `apiForm()`, `sleep()` |
| `src/tools/specs.ts` | `handleListSpecs`, `handleGetSpec`, `registerSpecTools` |
| `src/tools/run.ts` | `mapRunStatus`, `handleRunSpec`, `handleGetRun`, `handleGetRunResults`, `registerRunTools` |
| `src/tools/ask.ts` | `handleAsk` (bounded poll), `handleGetAnswer`, `registerAskTools` |
| `src/widgets/types.ts` | + 7 keys in `WIDGET_URIS`, `TOOL_WIDGET_KEYS`, `TOOL_INVOCATION_STATUS`, `WIDGET_DESCRIPTIONS` |
| `src/widgets/{spec-list,spec-card,run-started,run-status,run-results,answer}.ts` | six widget files (answer.ts exports two factories) |
| `src/widgets/register.ts` | + 7 registry entries |
| `src/server-factory.ts` | + 3 `register*` calls (rawToken) |
| `src/content/sections/tools.ts`, `src/content/seo.ts`, `docs/sections.json` | docs on both surfaces |
| `tests/tools/{specs,run,ask}.test.ts`, `tests/widgets/render/*.test.ts`, `tests/widgets/fixtures/*.json`, `tests/content/tool-sections.test.ts`, `tests/scripts/preflight-constant.test.ts` | locks |
| `chatgpt-app-submission.json`, `scripts/chatgpt-preflight.mjs`, `scripts/live-smoke.mjs`, `AGENTS.md`, `README.md`, `CHANGELOG.md` | collateral |
| website: `src/app/docs/mcp/tools/<short>/page.tsx` ×7, `src/lib/docs-nav-routes.ts`, `src/lib/docs-sync.ts`, `next.config.ts`, `src/app/sitemap.ts`, `src/app/.well-known/mcp.json/route.ts`, `src/app/docs/mcp/page.tsx` | tool pages + registries |

---

### Task 1: Raw-fetch helper additions — `apiForm`, `sleep`, wider `HttpMethod`

**Files:**
- Modify: `src/tools/_http.ts`
- Test: `tests/tools/http-helpers.test.ts` (new)

**Interfaces:**
- Produces: `export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE"`; `apiJson(getToken, baseUrl, method: HttpMethod, path, opts?)` (signature otherwise unchanged); `export type FormFields = Record<string, string | string[] | undefined>`; `export async function apiForm<T = unknown>(getToken: () => string, baseUrl: string | undefined, path: string, fields: FormFields): Promise<T>`; `export function sleep(ms: number): Promise<void>`.

- [ ] **Step 1: Write the failing test** — `tests/tools/http-helpers.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { apiForm, apiJson, sleep } from "../../src/tools/_http"

const getToken = () => "tlnc_test"

describe("apiForm", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("posts multipart/form-data with repeated array fields and the bearer, skipping undefined", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        return new Response(JSON.stringify({ run_id: "r1", status: "processing" }), {
          status: 202,
          headers: { "content-type": "application/json" },
        })
      }),
    )
    const out = await apiForm<{ run_id: string }>(getToken, "https://api.example.test", "/v1/run", {
      spec_id: "s1",
      file_urls: ["https://a.example/x.pdf", "https://a.example/y.pdf"],
      name: undefined,
      pipeline_mode: "new",
    })
    expect(out.run_id).toBe("r1")
    expect(calls[0].url).toBe("https://api.example.test/v1/run")
    expect(calls[0].init.method).toBe("POST")
    const headers = new Headers(calls[0].init.headers)
    expect(headers.get("authorization")).toBe("Bearer tlnc_test")
    expect(headers.get("accept")).toBe("application/json")
    // undici sets the multipart boundary itself — we must NOT set Content-Type.
    expect(headers.get("content-type")).toBeNull()
    const body = calls[0].init.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get("spec_id")).toBe("s1")
    expect(body.getAll("file_urls")).toEqual(["https://a.example/x.pdf", "https://a.example/y.pdf"])
    expect(body.has("name")).toBe(false)
    expect(body.get("pipeline_mode")).toBe("new")
  })

  it("throws the API error envelope on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"error":"bad_request"}', { status: 400 })),
    )
    await expect(apiForm(getToken, undefined, "/v1/run", { spec_id: "s1" })).rejects.toThrow(
      /HTTP 400.*bad_request/,
    )
  })
})

describe("apiJson method union", () => {
  afterEach(() => vi.unstubAllGlobals())
  it("accepts PATCH and DELETE", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } }))
    vi.stubGlobal("fetch", fetchFn)
    await apiJson(getToken, undefined, "PATCH", "/v1/x", { body: { a: 1 } })
    await apiJson(getToken, undefined, "DELETE", "/v1/x")
    expect((fetchFn.mock.calls[0][1] as RequestInit).method).toBe("PATCH")
    expect((fetchFn.mock.calls[1][1] as RequestInit).method).toBe("DELETE")
  })
})

describe("sleep", () => {
  it("resolves after the given delay", async () => {
    vi.useFakeTimers()
    const p = sleep(500)
    vi.advanceTimersByTime(500)
    await expect(p).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run tests/tools/http-helpers.test.ts` → FAIL (`apiForm`/`sleep` not exported; `"PATCH"` not assignable).

- [ ] **Step 3: Implement** in `src/tools/_http.ts`:

Replace the `method: "GET" | "POST"` parameter of `apiJson` with `method: HttpMethod` and add, after `QueryParams`:

```ts
/** HTTP methods raw-fetch tools may use. */
export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE"

/** Multipart fields; arrays repeat the key (`file_urls`), `undefined` is skipped. */
export type FormFields = Record<string, string | string[] | undefined>
```

Add after `apiJson`:

```ts
/**
 * Raw multipart/form-data POST against the Talonic API (used by `/v1/run`,
 * which accepts files and `file_urls` only as form fields). Do NOT set
 * Content-Type: undici derives the boundary from the FormData body.
 *
 * @internal
 */
export async function apiForm<T = unknown>(
  getToken: () => string,
  baseUrl: string | undefined,
  path: string,
  fields: FormFields,
): Promise<T> {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (Array.isArray(value)) for (const item of value) form.append(key, item)
    else form.append(key, value)
  }
  const res = await resolveFetch(getToken)(buildUrl(baseUrl, path), {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/json" },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Talonic API error: HTTP ${res.status}${text ? ` — ${text}` : ""}`)
  }
  return (await res.json()) as T
}

/** Promise-based delay; injectable in tests. @internal */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/tools/http-helpers.test.ts` → PASS (4). `npm run typecheck && npm run format && npm test` → green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/_http.ts tests/tools/http-helpers.test.ts
git commit -m "feat(http): apiForm multipart helper, sleep, wider HttpMethod for raw-fetch tools [skip docs]

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Specs tools — `talonic_list_specs`, `talonic_get_spec`

**Files:**
- Create: `src/tools/specs.ts`
- Test: `tests/tools/specs.test.ts`

**Interfaces:**
- Consumes: `apiJson`, `runTool`, `QueryParams` (`_http.ts`); `validationError` (`_shared.ts`); `widgetToolMeta` (Task 5 adds the keys — until then registration uses NO `_meta`; Task 8 adds `_meta: widgetToolMeta("listSpecs")` / `("getSpec")`).
- Produces: `handleListSpecs(getToken, baseUrl, args: ListSpecsArgs)`, `handleGetSpec(getToken, baseUrl, args: GetSpecArgs)`, `registerSpecTools(server, getToken, baseUrl?)`.

- [ ] **Step 1: Failing test** — `tests/tools/specs.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { handleGetSpec, handleListSpecs } from "../../src/tools/specs"

type Call = { url: string; init: RequestInit }
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
function stubFetch(routes: Array<[string, unknown]>, status = 200) {
  const calls: Call[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      for (const [needle, body] of routes) if (url.includes(needle)) return jsonResponse(body, status)
      return jsonResponse({ error: "not_found" }, 404)
    }),
  )
  return calls
}
const getToken = () => "tlnc_test"
const parsed = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0]?.text ?? "")
const SPEC = {
  id: "b8ec7fe1-3656-42ab-8027-0238afbc930c",
  name: "Purchase Order",
  description: null,
  schema_id: "514f3610-0801-4ac3-af3b-3553fb582808",
  version: 1,
  materialized_version: 1,
  materialized_at: "2026-07-22T23:26:32.909Z",
  field_count: 12,
  node_count: 4,
  created_at: "2026-07-22T23:20:00.000Z",
  updated_at: "2026-07-22T23:26:32.909Z",
  links: { self: "/v1/specs/b8ec7fe1-3656-42ab-8027-0238afbc930c" },
}

describe("talonic_list_specs", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("GETs /v1/specs with only the defined params and returns data + pagination", async () => {
    const calls = stubFetch([["/v1/specs", { data: [SPEC], pagination: { total: 1, limit: 20, has_more: false, next_cursor: null } }]])
    const res = await handleListSpecs(getToken, "https://api.example.test", { search: "purchase", limit: 5 })
    expect(calls[0].url).toBe("https://api.example.test/v1/specs?search=purchase&limit=5")
    expect(calls[0].init.method).toBe("GET")
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe("Bearer tlnc_test")
    const body = parsed(res)
    expect(body.data[0].name).toBe("Purchase Order")
    expect(body.pagination.has_more).toBe(false)
  })

  it("returns the API error envelope as a tool error", async () => {
    stubFetch([["/v1/specs", { error: "unauthorized" }]], 401)
    const res = await handleListSpecs(getToken, undefined, {})
    expect((res as any).isError).toBe(true)
    expect(res.content[0].text).toMatch(/HTTP 401/)
  })
})

describe("talonic_get_spec", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("GETs /v1/specs/{id} and passes the structure through", async () => {
    const calls = stubFetch([[`/v1/specs/${SPEC.id}`, { ...SPEC, schema: { id: SPEC.schema_id, name: "PO" }, nodes: [{ node_id: "n1", position: 0, type: "source" }], phases: [], fields: [] }]])
    const res = await handleGetSpec(getToken, undefined, { spec_id: SPEC.id })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`https://api.talonic.com/v1/specs/${SPEC.id}`)
    const body = parsed(res)
    expect(body.nodes[0].type).toBe("source")
    expect(body.versions).toBeUndefined()
  })

  it("adds versions[] when include_versions is set", async () => {
    const calls = stubFetch([
      [`/v1/specs/${SPEC.id}/versions`, { data: [{ version: 1, content_hash: "abc", created_at: "2026-07-22T23:26:32.909Z", is_materialized: true }] }],
      [`/v1/specs/${SPEC.id}`, { ...SPEC, nodes: [], phases: [], fields: [] }],
    ])
    const res = await handleGetSpec(getToken, undefined, { spec_id: SPEC.id, include_versions: true })
    expect(calls.map((c) => c.url)).toEqual([
      `https://api.talonic.com/v1/specs/${SPEC.id}`,
      `https://api.talonic.com/v1/specs/${SPEC.id}/versions`,
    ])
    expect(parsed(res).versions[0].is_materialized).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — module not found.

- [ ] **Step 3: Implement `src/tools/specs.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, runTool, type QueryParams } from "./_http.js"
import type { ToolResult } from "./_shared.js"

/**
 * Spec tools — the configured pipelines a workspace runs. A Spec is the
 * authoring document behind `/specs/{id}` in the app; running it materializes
 * onto a schema (`schema_id`, a DIFFERENT id). Raw fetch over `/v1/specs*`
 * (the SDK does not wrap these routes).
 */

const LIST_DESCRIPTION = [
  "List the workspace's Specs — the configured pipelines (rail + fields) that talonic_run_spec executes. Each row: id, name, description, schema_id (the schema a run materializes onto — a DIFFERENT id from the Spec's), version / materialized_version (null = never published), field_count, node_count, timestamps.",
  "",
  "USE WHEN: the user wants to run 'their pipeline' / 'the invoice Spec', or you need a spec_id for talonic_run_spec / talonic_get_spec.",
  "NOT FOR: ad-hoc extraction schemas (talonic_list_schemas) or discovering fields (talonic_list_fields).",
  "ARGS: optional `search` (name contains, case-insensitive), `limit` (1–100, default 20), `cursor` (from pagination.next_cursor), `order` (asc|desc by updated_at).",
  "RETURNS: { data[] of { id, name, description, schema_id, version, materialized_version, materialized_at, field_count, node_count, created_at, updated_at, links }, pagination { total, limit, has_more, next_cursor } }.",
].join("\n")

const GET_DESCRIPTION = [
  "Get one Spec's structure: identity and version state, the schema it materializes onto, `nodes[]` (the rail as authored, in editing order) and `phases[]` (the compiled execution plan, in run order — a validation checkpoint expands to one phase per gate, so the two lists differ on purpose), and `fields[]` (Spec field ↔ schema field).",
  "",
  "USE WHEN: you need to explain what a run will do, confirm a Spec is published (`version` non-null) before talonic_run_spec, or map field names to keys.",
  "NOT FOR: listing Specs (talonic_list_specs) or starting a run (talonic_run_spec).",
  "ARGS: `spec_id` (UUID from talonic_list_specs); optional `include_versions` (adds `versions[]` — published versions newest first, each { version, content_hash, created_at, is_materialized }).",
  "RETURNS: the Spec object { id, name, description, schema_id, version, materialized_version, materialized_at, field_count, node_count, schema, nodes[], phases[], fields[], links } plus optional versions[].",
].join("\n")

const listSpecsInputSchema = {
  search: z.string().min(1).optional().describe("Case-insensitive contains match on the Spec name."),
  limit: z.number().int().min(1).max(100).optional().describe("Page size (default 20)."),
  cursor: z.string().min(1).optional().describe("Opaque cursor from pagination.next_cursor."),
  order: z.enum(["asc", "desc"]).optional().describe("Sort by updated_at (default desc)."),
}

const getSpecInputSchema = {
  spec_id: z.string().uuid().describe("Spec UUID (from talonic_list_specs)."),
  include_versions: z
    .boolean()
    .optional()
    .describe("Also fetch the published versions list (adds `versions[]`)."),
}

export interface ListSpecsArgs {
  search?: string
  limit?: number
  cursor?: string
  order?: "asc" | "desc"
}

export interface GetSpecArgs {
  spec_id: string
  include_versions?: boolean
}

/** @internal Exported for unit testing. */
export async function handleListSpecs(
  getToken: () => string,
  baseUrl: string | undefined,
  args: ListSpecsArgs,
): Promise<ToolResult> {
  const params: QueryParams = {
    search: args.search,
    limit: args.limit,
    cursor: args.cursor,
    order: args.order,
  }
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/specs", { params }))
}

/** @internal Exported for unit testing. */
export async function handleGetSpec(
  getToken: () => string,
  baseUrl: string | undefined,
  args: GetSpecArgs,
): Promise<ToolResult> {
  return runTool(async () => {
    const path = `/v1/specs/${encodeURIComponent(args.spec_id)}`
    const spec = await apiJson<Record<string, unknown>>(getToken, baseUrl, "GET", path)
    if (!args.include_versions) return spec
    const versions = await apiJson<{ data?: unknown[] }>(getToken, baseUrl, "GET", `${path}/versions`)
    return { ...spec, versions: versions.data ?? [] }
  })
}

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

/** Register the two Spec tools. @internal */
export function registerSpecTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_list_specs",
    {
      title: "List Specs",
      description: LIST_DESCRIPTION,
      inputSchema: listSpecsInputSchema,
      annotations: { title: "List Specs", ...READ_ONLY },
    },
    async (args) => handleListSpecs(getToken, baseUrl, args as ListSpecsArgs),
  )
  server.registerTool(
    "talonic_get_spec",
    {
      title: "Get a Spec's structure",
      description: GET_DESCRIPTION,
      inputSchema: getSpecInputSchema,
      annotations: { title: "Get a Spec's structure", ...READ_ONLY },
    },
    async (args) => handleGetSpec(getToken, baseUrl, args as GetSpecArgs),
  )
}
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/tools/specs.test.ts` → PASS (4). `npm run typecheck && npm run format && npm test` → green (the tools are not registered yet, so no lock changes).

- [ ] **Step 5: Commit**

```bash
git add src/tools/specs.ts tests/tools/specs.test.ts
git commit -m "feat(tools): talonic_list_specs + talonic_get_spec over /v1/specs [skip docs]

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Run tools — `talonic_run_spec`, `talonic_get_run`, `talonic_get_run_results`

**Files:**
- Create: `src/tools/run.ts`
- Test: `tests/tools/run.test.ts`

**Interfaces:**
- Consumes: `apiJson`, `apiForm`, `runTool`, `QueryParams` (`_http.ts`); `validationError`, `ToolResult` (`_shared.ts`).
- Produces: `mapRunStatus(raw: unknown): "processing" | "completed" | "failed"`; `handleRunSpec`, `handleGetRun`, `handleGetRunResults` (each `(getToken, baseUrl, args)`); `registerRunTools(server, getToken, baseUrl?)`; the **RunEnvelope** shape `{ run_kind, run_id, pipeline_id, spec_id, status, raw_status, input_count, … }`.

- [ ] **Step 1: Failing test** — `tests/tools/run.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { handleGetRun, handleGetRunResults, handleRunSpec, mapRunStatus } from "../../src/tools/run"

type Call = { url: string; init: RequestInit }
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
function stubFetch(routes: Array<[string, unknown]>, status = 200) {
  const calls: Call[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      for (const [needle, body] of routes) if (url.includes(needle)) return jsonResponse(body, status)
      return jsonResponse({ error: "not_found" }, 404)
    }),
  )
  return calls
}
const getToken = () => "tlnc_test"
const parsed = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0]?.text ?? "")
const SPEC = "b8ec7fe1-3656-42ab-8027-0238afbc930c"
const DOC1 = "d0c00001-0000-4000-8000-000000000001"
const DOC2 = "d0c00001-0000-4000-8000-000000000002"
const PIPE = "p1pe0001-0000-4000-8000-000000000001"
const RUN = "a0000001-0000-4000-8000-000000000001"

describe("mapRunStatus", () => {
  it.each([
    ["completed", "completed"],
    ["failed", "failed"],
    ["error", "failed"],
    ["cancelled", "failed"],
    ["active", "processing"],
    ["running", "processing"],
    ["finalizing", "processing"],
    ["processing", "processing"],
    [undefined, "processing"],
    [42, "processing"],
  ])("%s -> %s", (raw, expected) => {
    expect(mapRunStatus(raw)).toBe(expected)
  })
})

describe("talonic_run_spec", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("document_ids -> POST /v1/pipelines JSON and a pipeline RunEnvelope", async () => {
    const calls = stubFetch([
      ["/v1/pipelines", { id: PIPE, status: "active", schema: { id: SPEC, name: "Purchase Order" }, document_count: 2, enqueued_documents: 2, appended: false, run_id: RUN, message: "Pipeline created and queued for processing.", links: { self: `/v1/pipelines/${PIPE}`, progress: `/v1/pipelines/${PIPE}/progress` } }],
    ])
    const res = await handleRunSpec(getToken, "https://api.example.test", { spec_id: SPEC, document_ids: [DOC1, DOC2], name: "smoke", pipeline_mode: "new" })
    expect(calls[0].url).toBe("https://api.example.test/v1/pipelines")
    expect(calls[0].init.method).toBe("POST")
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ schema_id: SPEC, document_ids: [DOC1, DOC2], name: "smoke", pipeline_mode: "new" })
    const env = parsed(res)
    expect(env).toMatchObject({ run_kind: "pipeline", run_id: RUN, pipeline_id: PIPE, spec_id: SPEC, status: "processing", raw_status: "active", input_count: 2, enqueued_documents: 2, appended: false })
    expect(env.links.progress).toBe(`/v1/pipelines/${PIPE}/progress`)
  })

  it("file_urls -> POST /v1/run multipart and a run RunEnvelope", async () => {
    const calls = stubFetch([
      ["/v1/run", { run_id: RUN, spec_id: SPEC, status: "processing", input_count: 1, poll_url: `/v1/run/${RUN}`, documents: [{ document_id: DOC1, filename: "invoice-0421.pdf", size_bytes: 1024, source: "file_url", deduplicated: false }] }],
    ])
    const res = await handleRunSpec(getToken, undefined, { spec_id: SPEC, file_urls: ["https://files.example/invoice-0421.pdf"], batch_id: "b-1", metadata: { region: "EU", priority: 2 } })
    expect(calls[0].url).toBe("https://api.talonic.com/v1/run")
    const form = calls[0].init.body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(form.get("spec_id")).toBe(SPEC)
    expect(form.getAll("file_urls")).toEqual(["https://files.example/invoice-0421.pdf"])
    expect(form.get("batch_id")).toBe("b-1")
    expect(JSON.parse(String(form.get("metadata")))).toEqual({ region: "EU", priority: 2 })
    const env = parsed(res)
    expect(env).toMatchObject({ run_kind: "run", run_id: RUN, pipeline_id: null, spec_id: SPEC, status: "processing", input_count: 1 })
    expect(env.documents[0].filename).toBe("invoice-0421.pdf")
    expect(env.links.poll).toBe(`/v1/run/${RUN}`)
  })

  it.each([
    [{ spec_id: SPEC }, /exactly one of document_ids or file_urls/],
    [{ spec_id: SPEC, document_ids: [DOC1], file_urls: ["https://x.example/a.pdf"] }, /exactly one of document_ids or file_urls/],
    [{ spec_id: SPEC, document_ids: [] }, /exactly one of document_ids or file_urls/],
    [{ spec_id: SPEC, file_urls: ["http://x.example/a.pdf"] }, /https:\/\//],
    [{ spec_id: SPEC, document_ids: [DOC1], batch_id: "b" }, /batch_id and metadata only apply/],
    [{ spec_id: SPEC, document_ids: [DOC1], metadata: { a: 1 } }, /batch_id and metadata only apply/],
  ])("rejects %j at the MCP layer without calling the API", async (args, message) => {
    const calls = stubFetch([])
    const res = await handleRunSpec(getToken, undefined, args as any)
    expect((res as any).isError).toBe(true)
    expect(res.content[0].text).toMatch(message)
    expect(calls).toHaveLength(0)
  })
})

describe("talonic_get_run", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("run_id -> GET /v1/run/{id}, normalised", async () => {
    stubFetch([[`/v1/run/${RUN}`, { run_id: RUN, spec_id: SPEC, status: "completed", pipeline_id: PIPE, input_count: 1, progress: { total_documents: 1, completed_documents: 1, error_documents: 0 }, documents: [{ document_id: DOC1, filename: "invoice-0421.pdf", status: "completed" }], created_at: "2026-09-22T10:00:00Z", updated_at: "2026-09-22T10:01:00Z" }]])
    const env = parsed(await handleGetRun(getToken, undefined, { run_id: RUN }))
    expect(env).toMatchObject({ run_kind: "run", run_id: RUN, pipeline_id: PIPE, spec_id: SPEC, status: "completed", raw_status: "completed", input_count: 1 })
    expect(env.progress.completed_documents).toBe(1)
    expect(env.documents[0].status).toBe("completed")
  })

  it("pipeline_id -> GET /v1/pipelines/{id} + /progress, normalised to snake_case", async () => {
    const calls = stubFetch([
      [`/v1/pipelines/${PIPE}/progress`, { pipelineId: PIPE, status: "finalizing", totalDocuments: 2, completedDocuments: 1, errorDocuments: 0, finalizationPending: ["assembly"], phases: [{ phaseId: "ph1", name: "Extract", type: "extraction", completed: 1, running: 1, errors: 0 }] }],
      [`/v1/pipelines/${PIPE}`, { id: PIPE, name: "smoke", status: "active", schema: { id: SPEC }, phase_count: 1, created_at: "2026-09-22T10:00:00Z", links: {} }],
    ])
    const env = parsed(await handleGetRun(getToken, undefined, { pipeline_id: PIPE }))
    expect(calls.map((c) => c.url)).toEqual([`https://api.talonic.com/v1/pipelines/${PIPE}`, `https://api.talonic.com/v1/pipelines/${PIPE}/progress`])
    expect(env).toMatchObject({ run_kind: "pipeline", run_id: null, pipeline_id: PIPE, spec_id: SPEC, status: "processing", raw_status: "finalizing", name: "smoke" })
    expect(env.progress).toEqual({ total_documents: 2, completed_documents: 1, error_documents: 0, finalization_pending: ["assembly"], phases: [{ phase_id: "ph1", name: "Extract", type: "extraction", completed: 1, running: 1, errors: 0 }] })
  })

  it.each([[{}], [{ run_id: RUN, pipeline_id: PIPE }]])("rejects %j — exactly one id", async (args) => {
    const calls = stubFetch([])
    const res = await handleGetRun(getToken, undefined, args as any)
    expect((res as any).isError).toBe(true)
    expect(res.content[0].text).toMatch(/exactly one of run_id or pipeline_id/)
    expect(calls).toHaveLength(0)
  })
})

describe("talonic_get_run_results", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("run_id -> GET /v1/run/{id}/results with include joined", async () => {
    const calls = stubFetch([[`/v1/run/${RUN}/results`, { run_id: RUN, pipeline_id: PIPE, spec_id: SPEC, status: "completed", view: "documents", generated_at: "2026-09-22T10:02:00Z", columns: [{ field_key: "total_amount", display_name: "Total Amount", data_type: "number" }], data: [{ document_id: DOC1, filename: "invoice-0421.pdf", run_id: RUN, pipeline_id: PIPE, record_id: "rec1", status: "complete", completed_at: null, fields: { total_amount: 1299 } }], pagination: { total: 1, limit: 50, has_more: false, next_cursor: null }, pending_review_count: 0, links: { self: "x", run: "y" } }]])
    const body = parsed(await handleGetRunResults(getToken, undefined, { run_id: RUN, include: ["cells", "provenance"], limit: 50 }))
    expect(calls[0].url).toBe(`https://api.talonic.com/v1/run/${RUN}/results?include=cells%2Cprovenance&limit=50`)
    expect(body.run_kind).toBe("run")
    expect(body.columns[0].field_key).toBe("total_amount")
    expect(body.data[0].fields.total_amount).toBe(1299)
  })

  it("pipeline_id -> GET /v1/pipelines/{id}/results?view=documents", async () => {
    const calls = stubFetch([[`/v1/pipelines/${PIPE}/results`, { pipeline_id: PIPE, spec_id: SPEC, status: "completed", view: "documents", generated_at: "x", columns: [], data: [], pagination: { total: 0, limit: 50, has_more: false, next_cursor: null }, pending_review_count: 0, links: {} }]])
    const body = parsed(await handleGetRunResults(getToken, undefined, { pipeline_id: PIPE, document_id: DOC1 }))
    expect(calls[0].url).toBe(`https://api.talonic.com/v1/pipelines/${PIPE}/results?view=documents&document_id=${DOC1}`)
    expect(body.run_kind).toBe("pipeline")
  })

  it("rejects both ids missing", async () => {
    const res = await handleGetRunResults(getToken, undefined, {} as any)
    expect((res as any).isError).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — module not found.

- [ ] **Step 3: Implement `src/tools/run.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiForm, apiJson, runTool, type QueryParams } from "./_http.js"
import { validationError, type ToolResult } from "./_shared.js"

/**
 * Run tools — execute a Spec's configured pipeline and read its results.
 *
 * Two backends behind one contract:
 * - `document_ids` (documents already in the workspace) → `POST /v1/pipelines`
 *   (`schema_id` = the Spec id). Poll with `pipeline_id`.
 * - `file_urls` (remote files) → `POST /v1/run` (multipart). Poll with `run_id`.
 *
 * Every response is normalised to the RunEnvelope so the agent never has to
 * know which route ran.
 */

export type RunStatus = "processing" | "completed" | "failed"

/** Fold the two routes' status vocabularies into processing | completed | failed. */
export function mapRunStatus(raw: unknown): RunStatus {
  if (raw === "completed") return "completed"
  if (raw === "failed" || raw === "error" || raw === "cancelled") return "failed"
  return "processing"
}

const RUN_DESCRIPTION = [
  "Run a Spec — the customer's configured pipeline — over documents, in one call. Two inputs: `document_ids` (documents already in the workspace; for a new file, first talonic_request_upload → poll talonic_get_document until completed) OR `file_urls` (public https files, max 20; Talonic ingests them first). Consumes credits.",
  "",
  "USE WHEN: the user wants to 'run the invoice pipeline on these documents', process files through their Spec, or produce the Spec's structured rows.",
  "NOT FOR: one-off extraction with an ad-hoc schema (talonic_extract), or checking progress (talonic_get_run) / reading rows (talonic_get_run_results).",
  "ARGS: `spec_id` (talonic_list_specs); exactly one of `document_ids[]` (1–500) or `file_urls[]` (1–20, https); optional `name`, `pipeline_mode` (`new` default | `append` to the Spec's existing pipeline); `batch_id` and flat `metadata` only with file_urls.",
  "RETURNS: RunEnvelope { run_kind ('pipeline'|'run'), run_id, pipeline_id, spec_id, status ('processing'|'completed'|'failed'), raw_status, input_count, documents?, message?, links }. Then poll talonic_get_run every 5–10 s with the pipeline_id (or run_id) until status is completed/failed, then talonic_get_run_results.",
].join("\n")

const GET_RUN_DESCRIPTION = [
  "Poll a Spec run started by talonic_run_spec: normalised status plus document-level progress and, for pipelines, per-phase progress.",
  "",
  "USE WHEN: waiting for a run to finish — poll every 5–10 s; stop on `completed` or `failed`.",
  "NOT FOR: reading the structured rows (talonic_get_run_results) or starting a run (talonic_run_spec).",
  "ARGS: exactly one of `pipeline_id` (run_kind 'pipeline') or `run_id` (run_kind 'run'), from the RunEnvelope.",
  "RETURNS: { run_kind, run_id, pipeline_id, spec_id, status, raw_status, input_count?, progress { total_documents, completed_documents, error_documents, phases?[] }, documents?[], error_message?, created_at, updated_at }.",
].join("\n")

const RESULTS_DESCRIPTION = [
  "Read a Spec run's structured rows — one row per document with the Spec's fields as clean values (held/pending-review cells serialize null), plus the column definitions.",
  "",
  "USE WHEN: talonic_get_run reports `completed` (partial rows are also readable while `processing`).",
  "NOT FOR: progress (talonic_get_run) or per-field provenance of a single value (include: ['provenance'] here, or talonic_field_values).",
  "ARGS: exactly one of `pipeline_id` or `run_id`; optional `document_id` (one document), `include` (['cells','provenance'] — heavier payload), `limit` (1–200, default 50), `cursor`.",
  "RETURNS: { run_kind, status, columns[] of { field_key, display_name, data_type }, data[] of { document_id, filename, record_id, status ('complete'|'partial'|'error'|'processing'), completed_at, fields { field_key: value }, cells?, provenance? }, pagination, pending_review_count, links }.",
].join("\n")

const uuid = z.string().uuid()
const documentIdsArg = z.array(uuid).min(1).max(500).optional().describe("Workspace document ids (1–500). Mutually exclusive with file_urls.")
const fileUrlsArg = z.array(z.string().url()).min(1).max(20).optional().describe("Public https file URLs (1–20). Mutually exclusive with document_ids.")
const metadataArg = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .optional()
  .describe("Flat caller tags stamped on every ingested document (file_urls path only).")

const runSpecInputSchema = {
  spec_id: uuid.describe("Spec UUID (talonic_list_specs)."),
  document_ids: documentIdsArg,
  file_urls: fileUrlsArg,
  name: z.string().min(1).max(200).optional().describe("Display name for the run."),
  pipeline_mode: z.enum(["new", "append"]).optional().describe("`new` (default) or `append` to the Spec's existing pipeline."),
  batch_id: z.string().min(1).max(200).optional().describe("Caller grouping key (file_urls path only)."),
  metadata: metadataArg,
}

const runRefInputSchema = {
  run_id: uuid.optional().describe("From a run_kind 'run' envelope (/v1/run)."),
  pipeline_id: uuid.optional().describe("From a run_kind 'pipeline' envelope (/v1/pipelines)."),
}

const resultsInputSchema = {
  ...runRefInputSchema,
  document_id: uuid.optional().describe("Restrict to one document."),
  include: z.array(z.enum(["cells", "provenance"])).optional().describe("Extra per-field detail; heavier payload."),
  limit: z.number().int().min(1).max(200).optional().describe("Page size (default 50)."),
  cursor: z.string().min(1).optional().describe("Opaque cursor from pagination.next_cursor."),
}

export interface RunSpecArgs {
  spec_id: string
  document_ids?: string[]
  file_urls?: string[]
  name?: string
  pipeline_mode?: "new" | "append"
  batch_id?: string
  metadata?: Record<string, string | number | boolean | null>
}

export interface RunRefArgs {
  run_id?: string
  pipeline_id?: string
}

export interface RunResultsArgs extends RunRefArgs {
  document_id?: string
  include?: Array<"cells" | "provenance">
  limit?: number
  cursor?: string
}

interface CreatePipelineResponse {
  id: string
  status?: string
  schema?: { id?: string; name?: string }
  document_count?: number
  enqueued_documents?: number
  appended?: boolean
  run_id?: string
  message?: string
  links?: Record<string, string>
}

interface CreateRunResponse {
  run_id: string
  spec_id?: string
  status?: string
  input_count?: number
  poll_url?: string
  documents?: unknown[]
}

interface PipelineProgressResponse {
  status?: string
  totalDocuments?: number
  completedDocuments?: number
  errorDocuments?: number
  finalizationPending?: string[] | null
  phases?: Array<{ phaseId?: string; name?: string; type?: string; completed?: number; running?: number; errors?: number }>
}

function pickRef(args: RunRefArgs): { kind: "run"; id: string } | { kind: "pipeline"; id: string } | null {
  const hasRun = typeof args.run_id === "string" && args.run_id.length > 0
  const hasPipe = typeof args.pipeline_id === "string" && args.pipeline_id.length > 0
  if (hasRun === hasPipe) return null
  return hasPipe ? { kind: "pipeline", id: args.pipeline_id as string } : { kind: "run", id: args.run_id as string }
}

/** @internal Exported for unit testing. */
export async function handleRunSpec(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RunSpecArgs,
): Promise<ToolResult> {
  const docs = Array.isArray(args.document_ids) && args.document_ids.length > 0 ? args.document_ids : null
  const urls = Array.isArray(args.file_urls) && args.file_urls.length > 0 ? args.file_urls : null
  if ((docs === null) === (urls === null)) {
    return validationError("provide exactly one of document_ids or file_urls (non-empty).")
  }
  if (urls && urls.some((u) => !u.startsWith("https://"))) {
    return validationError("every file_urls entry must start with https://.")
  }
  if (docs && (args.batch_id !== undefined || args.metadata !== undefined)) {
    return validationError("batch_id and metadata only apply to the file_urls path; drop them for document_ids.")
  }
  return runTool(async () => {
    if (docs) {
      const res = await apiJson<CreatePipelineResponse>(getToken, baseUrl, "POST", "/v1/pipelines", {
        body: {
          schema_id: args.spec_id,
          document_ids: docs,
          ...(args.name ? { name: args.name } : {}),
          ...(args.pipeline_mode ? { pipeline_mode: args.pipeline_mode } : {}),
        },
      })
      return {
        run_kind: "pipeline",
        run_id: res.run_id ?? null,
        pipeline_id: res.id,
        spec_id: res.schema?.id ?? args.spec_id,
        spec_name: res.schema?.name ?? null,
        status: mapRunStatus(res.status),
        raw_status: res.status ?? null,
        input_count: res.document_count ?? docs.length,
        enqueued_documents: res.enqueued_documents ?? null,
        appended: res.appended === true,
        message: res.message ?? null,
        links: res.links ?? {},
      }
    }
    const res = await apiForm<CreateRunResponse>(getToken, baseUrl, "/v1/run", {
      spec_id: args.spec_id,
      file_urls: urls as string[],
      name: args.name,
      pipeline_mode: args.pipeline_mode,
      batch_id: args.batch_id,
      metadata: args.metadata ? JSON.stringify(args.metadata) : undefined,
    })
    return {
      run_kind: "run",
      run_id: res.run_id,
      pipeline_id: null,
      spec_id: res.spec_id ?? args.spec_id,
      spec_name: null,
      status: mapRunStatus(res.status),
      raw_status: res.status ?? null,
      input_count: res.input_count ?? (urls as string[]).length,
      documents: res.documents ?? [],
      message: null,
      links: { poll: res.poll_url ?? `/v1/run/${res.run_id}` },
    }
  })
}

/** @internal Exported for unit testing. */
export async function handleGetRun(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RunRefArgs,
): Promise<ToolResult> {
  const ref = pickRef(args)
  if (!ref) return validationError("provide exactly one of run_id or pipeline_id.")
  return runTool(async () => {
    if (ref.kind === "run") {
      const r = await apiJson<Record<string, unknown>>(getToken, baseUrl, "GET", `/v1/run/${encodeURIComponent(ref.id)}`)
      return {
        run_kind: "run",
        run_id: (r["run_id"] as string) ?? ref.id,
        pipeline_id: (r["pipeline_id"] as string | undefined) ?? null,
        spec_id: (r["spec_id"] as string | undefined) ?? null,
        status: mapRunStatus(r["status"]),
        raw_status: r["status"] ?? null,
        input_count: r["input_count"] ?? null,
        progress: r["progress"] ?? null,
        documents: r["documents"] ?? undefined,
        error_message: r["error_message"] ?? null,
        batch_id: r["batch_id"] ?? null,
        created_at: r["created_at"] ?? null,
        updated_at: r["updated_at"] ?? null,
      }
    }
    const base = `/v1/pipelines/${encodeURIComponent(ref.id)}`
    const p = await apiJson<Record<string, unknown>>(getToken, baseUrl, "GET", base)
    const pr = await apiJson<PipelineProgressResponse>(getToken, baseUrl, "GET", `${base}/progress`)
    const raw = pr.status ?? (p["status"] as string | undefined)
    return {
      run_kind: "pipeline",
      run_id: null,
      pipeline_id: (p["id"] as string) ?? ref.id,
      spec_id: ((p["schema"] as { id?: string } | undefined)?.id ?? null),
      name: p["name"] ?? null,
      status: mapRunStatus(raw),
      raw_status: raw ?? null,
      progress: {
        total_documents: pr.totalDocuments ?? 0,
        completed_documents: pr.completedDocuments ?? 0,
        error_documents: pr.errorDocuments ?? 0,
        finalization_pending: pr.finalizationPending ?? null,
        phases: (pr.phases ?? []).map((ph) => ({
          phase_id: ph.phaseId ?? null,
          name: ph.name ?? null,
          type: ph.type ?? null,
          completed: ph.completed ?? 0,
          running: ph.running ?? 0,
          errors: ph.errors ?? 0,
        })),
      },
      created_at: p["created_at"] ?? null,
      links: p["links"] ?? {},
    }
  })
}

/** @internal Exported for unit testing. */
export async function handleGetRunResults(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RunResultsArgs,
): Promise<ToolResult> {
  const ref = pickRef(args)
  if (!ref) return validationError("provide exactly one of run_id or pipeline_id.")
  return runTool(async () => {
    const params: QueryParams = {
      ...(ref.kind === "pipeline" ? { view: "documents" } : {}),
      document_id: args.document_id,
      include: args.include?.length ? args.include.join(",") : undefined,
      limit: args.limit,
      cursor: args.cursor,
    }
    const path =
      ref.kind === "run"
        ? `/v1/run/${encodeURIComponent(ref.id)}/results`
        : `/v1/pipelines/${encodeURIComponent(ref.id)}/results`
    const body = await apiJson<Record<string, unknown>>(getToken, baseUrl, "GET", path, { params })
    return { run_kind: ref.kind, ...body }
  })
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const

/** Register the three run tools. @internal */
export function registerRunTools(server: McpServer, getToken: () => string, baseUrl?: string): void {
  server.registerTool(
    "talonic_run_spec",
    {
      title: "Run a Spec pipeline",
      description: RUN_DESCRIPTION,
      inputSchema: runSpecInputSchema,
      annotations: { title: "Run a Spec pipeline", readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (args) => handleRunSpec(getToken, baseUrl, args as RunSpecArgs),
  )
  server.registerTool(
    "talonic_get_run",
    {
      title: "Poll a Spec run",
      description: GET_RUN_DESCRIPTION,
      inputSchema: runRefInputSchema,
      annotations: { title: "Poll a Spec run", ...READ_ONLY },
    },
    async (args) => handleGetRun(getToken, baseUrl, args as RunRefArgs),
  )
  server.registerTool(
    "talonic_get_run_results",
    {
      title: "Read a Spec run's rows",
      description: RESULTS_DESCRIPTION,
      inputSchema: resultsInputSchema,
      annotations: { title: "Read a Spec run's rows", ...READ_ONLY },
    },
    async (args) => handleGetRunResults(getToken, baseUrl, args as RunResultsArgs),
  )
}
```

Note the `view=documents` param must be emitted first for the pipeline path so the URL in the test (`?view=documents&document_id=…`) matches — the object literal order above does that (`buildUrl` preserves insertion order).

- [ ] **Step 4: Run tests** — `npx vitest run tests/tools/run.test.ts` → PASS (10 + 6 + 3 + 2 + 3 = ~24 tests incl. `it.each` rows). `npm run typecheck && npm run format && npm test` → green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/run.ts tests/tools/run.test.ts
git commit -m "feat(tools): talonic_run_spec / talonic_get_run / talonic_get_run_results — one RunEnvelope over /v1/pipelines and /v1/run [skip docs]

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Ask tools — `talonic_ask` (bounded wait) and `talonic_get_answer`

**Files:**
- Create: `src/tools/ask.ts`
- Test: `tests/tools/ask.test.ts`

**Interfaces:**
- Consumes: `apiJson`, `runTool`, `sleep` (`_http.ts`); `validationError`, `ToolResult`.
- Produces: `handleAsk(getToken, baseUrl, args: AskArgs, deps?: { sleep?: (ms: number) => Promise<void>; now?: () => number })`, `handleGetAnswer(getToken, baseUrl, args: { ask_id: string })`, `registerAskTools(server, getToken, baseUrl?)`, constants `ASK_POLL_INTERVAL_MS = 2000`, `ASK_DEFAULT_WAIT_S = 45`, `ASK_MAX_WAIT_S = 55`.

- [ ] **Step 1: Failing test** — `tests/tools/ask.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { ASK_POLL_INTERVAL_MS, handleAsk, handleGetAnswer } from "../../src/tools/ask"

type Call = { url: string; init: RequestInit }
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
const getToken = () => "tlnc_test"
const parsed = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0]?.text ?? "")
const ASK = "a5k00001-0000-4000-8000-000000000001"
const CONV = "c0000001-0000-4000-8000-000000000001"
const DONE = {
  ask_id: ASK,
  status: "completed",
  conversation_id: CONV,
  answer: "The total is **1,299.00 EUR** [1].",
  citations: [{ quote: "Total amount due: 1,299.00 EUR", document_id: "d0c00001-0000-4000-8000-000000000001", kind: "field", filename: "invoice-0421.pdf" }],
  verification: { verdict: "supported", checks_total: 1, checks_unsupported: 0 },
  usage: { tokens: 812, credits_charged: 3 },
  tool_calls: 2,
}

/** Sequenced fetch: POST /v1/ask once, then GET /v1/ask/{id} answers in order. */
function stubSequence(gets: unknown[]) {
  const calls: Call[] = []
  let g = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      if (init.method === "POST") return jsonResponse({ ask_id: ASK, status: "processing", poll_url: `/v1/ask/${ASK}`, conversation_id: CONV }, 202)
      return jsonResponse(gets[Math.min(g++, gets.length - 1)])
    }),
  )
  return calls
}
const PROCESSING = { ask_id: ASK, status: "processing", conversation_id: CONV }

describe("talonic_ask", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("POSTs the question with scope, then polls until completed, sleeping between polls", async () => {
    const calls = stubSequence([PROCESSING, PROCESSING, DONE])
    const sleeps: number[] = []
    let t = 0
    const res = await handleAsk(
      getToken,
      "https://api.example.test",
      { question: "What is the total on invoice-0421?", scope: { document_ids: ["d0c00001-0000-4000-8000-000000000001"] }, wait_seconds: 30 },
      { sleep: async (ms) => { sleeps.push(ms); t += ms }, now: () => t },
    )
    expect(calls[0].url).toBe("https://api.example.test/v1/ask")
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ question: "What is the total on invoice-0421?", scope: { document_ids: ["d0c00001-0000-4000-8000-000000000001"] } })
    expect(calls.slice(1).map((c) => c.url)).toEqual(Array(3).fill(`https://api.example.test/v1/ask/${ASK}`))
    expect(sleeps).toEqual([ASK_POLL_INTERVAL_MS, ASK_POLL_INTERVAL_MS])
    const body = parsed(res)
    expect(body.status).toBe("completed")
    expect(body.answer).toContain("1,299.00")
    expect(body.citations[0].filename).toBe("invoice-0421.pdf")
    expect(body.waited_ms).toBe(2 * ASK_POLL_INTERVAL_MS)
    expect(body.poll_hint).toBeUndefined()
  })

  it("gives up at the deadline and returns the processing envelope with a poll hint", async () => {
    const calls = stubSequence([PROCESSING])
    let t = 0
    const res = await handleAsk(getToken, undefined, { question: "q", wait_seconds: 5 }, { sleep: async (ms) => { t += ms }, now: () => t })
    const body = parsed(res)
    expect(body.status).toBe("processing")
    expect(body.ask_id).toBe(ASK)
    expect(body.poll_hint).toMatch(/talonic_get_answer/)
    expect(body.waited_ms).toBe(5000)
    // polls at t=0, 2000, 4000, then a final one exactly at the 5000 deadline
    expect(calls.filter((c) => c.init.method !== "POST")).toHaveLength(4)
  })

  it("wait_seconds: 0 -> exactly one GET", async () => {
    const calls = stubSequence([PROCESSING])
    const res = await handleAsk(getToken, undefined, { question: "q", wait_seconds: 0 }, { sleep: async () => {}, now: () => 0 })
    expect(calls.filter((c) => c.init.method !== "POST")).toHaveLength(1)
    expect(parsed(res).status).toBe("processing")
  })

  it("clamps wait_seconds above the maximum and returns an error envelope on API failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "bad_request", message: "question required" }, 400)))
    const res = await handleAsk(getToken, undefined, { question: "q", wait_seconds: 999 })
    expect((res as any).isError).toBe(true)
    expect(res.content[0].text).toMatch(/HTTP 400/)
  })

  it("rejects an empty question at the MCP layer", async () => {
    const calls = stubSequence([])
    const res = await handleAsk(getToken, undefined, { question: "   " })
    expect((res as any).isError).toBe(true)
    expect(calls).toHaveLength(0)
  })
})

describe("talonic_get_answer", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("GETs /v1/ask/{id}; adds poll_hint while processing, none when completed", async () => {
    const calls: Call[] = []
    let n = 0
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, init }); return jsonResponse(n++ === 0 ? PROCESSING : DONE) }))
    const first = parsed(await handleGetAnswer(getToken, undefined, { ask_id: ASK }))
    expect(calls[0].url).toBe(`https://api.talonic.com/v1/ask/${ASK}`)
    expect(first.poll_hint).toMatch(/talonic_get_answer/)
    const second = parsed(await handleGetAnswer(getToken, undefined, { ask_id: ASK }))
    expect(second.status).toBe("completed")
    expect(second.poll_hint).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails** — module not found.

- [ ] **Step 3: Implement `src/tools/ask.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, runTool, sleep as defaultSleep } from "./_http.js"
import { validationError, type ToolResult } from "./_shared.js"

/**
 * Ask tools — natural-language questions over the workspace corpus, answered
 * by the Talonic agent with citations and verification (`POST /v1/ask` is
 * create-then-poll; the SSE stream is not usable over MCP, so we poll).
 *
 * `talonic_ask` starts the ask and waits a bounded time; `talonic_get_answer`
 * is the read-only poll for asks that outlive the wait.
 */

export const ASK_POLL_INTERVAL_MS = 2000
export const ASK_DEFAULT_WAIT_S = 45
export const ASK_MAX_WAIT_S = 55

const POLL_HINT = "still processing — call talonic_get_answer with this ask_id in a few seconds"

const ASK_DESCRIPTION = [
  "Ask a natural-language question over the workspace's documents and get a cited, verified answer (markdown). The Talonic agent plans over the structured field plane, runs read-only SQL over extracted cells, reads document text, and grounds every load-bearing claim in a source span. Consumes credits.",
  "",
  "USE WHEN: the user asks an open question about their documents ('which vendors invoiced us twice in May?'), wants a summary across documents, or the answer needs reasoning over several fields.",
  "NOT FOR: reading a known field's values (talonic_field_values, free) or filtering documents by a known value (talonic_filter, free); locating which field holds a concept (talonic_find_data).",
  "ARGS: `question`; optional `scope` { document_ids[], schema_id, pipeline_id, data_product_id, document_type, source_id, tags[], ingested_after, ingested_before } (ANDed), `conversation_id` (continue a thread), `output_format` { instruction, template }, `wait_seconds` (0–55, default 45).",
  "RETURNS: { ask_id, status ('completed'|'processing'|'error'), conversation_id, answer (markdown), citations[] { quote, document_id, kind, filename, app_url }, verification { verdict, checks_total, checks_unsupported, correction }, usage { tokens, credits_charged }, tool_calls, artifacts[], waited_ms }. If status is still 'processing' after the wait, call talonic_get_answer with the ask_id.",
].join("\n")

const GET_ANSWER_DESCRIPTION = [
  "Poll an ask started by talonic_ask that was still processing when the wait ended.",
  "",
  "USE WHEN: talonic_ask returned status 'processing' with an ask_id — poll every few seconds until 'completed' or 'error'.",
  "NOT FOR: asking a new question (talonic_ask).",
  "ARGS: `ask_id`.",
  "RETURNS: the same answer envelope as talonic_ask (answer, citations[], verification, usage) or { status: 'processing', poll_hint }.",
].join("\n")

const uuid = z.string().uuid()
const scopeSchema = z
  .object({
    document_ids: z.array(uuid).max(500).optional(),
    schema_id: uuid.optional(),
    pipeline_id: uuid.optional(),
    data_product_id: uuid.optional(),
    document_type: z.string().min(1).optional(),
    source_id: uuid.optional(),
    tags: z.array(z.string().min(1)).max(50).optional(),
    ingested_after: z.string().min(1).optional(),
    ingested_before: z.string().min(1).optional(),
  })
  .optional()
  .describe("Restrict the question to a slice of the workspace; present fields are ANDed.")

const askInputSchema = {
  question: z.string().min(1).max(4000).describe("The question, in the user's words."),
  scope: scopeSchema,
  conversation_id: uuid.optional().describe("Continue this conversation; the agent sees prior turns."),
  output_format: z
    .object({ instruction: z.string().max(1000).optional(), template: z.string().max(4000).optional() })
    .optional()
    .describe("Shape the answer (form only, never grounding)."),
  wait_seconds: z
    .number()
    .int()
    .min(0)
    .max(ASK_MAX_WAIT_S)
    .optional()
    .describe(`Seconds to wait for the answer before returning 'processing' (default ${ASK_DEFAULT_WAIT_S}, max ${ASK_MAX_WAIT_S}).`),
}

export interface AskArgs {
  question: string
  scope?: Record<string, unknown>
  conversation_id?: string
  output_format?: { instruction?: string; template?: string }
  wait_seconds?: number
}

export interface AskDeps {
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

interface AskCreateResponse {
  ask_id: string
  status?: string
  poll_url?: string
  conversation_id?: string
}

interface AskPollResponse extends Record<string, unknown> {
  ask_id?: string
  status?: string
}

function withHint(body: AskPollResponse): Record<string, unknown> {
  return body.status === "processing" ? { ...body, poll_hint: POLL_HINT } : body
}

/** @internal Exported for unit testing. */
export async function handleAsk(
  getToken: () => string,
  baseUrl: string | undefined,
  args: AskArgs,
  deps: AskDeps = {},
): Promise<ToolResult> {
  if (typeof args.question !== "string" || args.question.trim().length === 0) {
    return validationError("question must be a non-empty string.")
  }
  const sleep = deps.sleep ?? defaultSleep
  const now = deps.now ?? Date.now
  const waitS = Math.max(0, Math.min(ASK_MAX_WAIT_S, Math.floor(args.wait_seconds ?? ASK_DEFAULT_WAIT_S)))
  return runTool(async () => {
    const created = await apiJson<AskCreateResponse>(getToken, baseUrl, "POST", "/v1/ask", {
      body: {
        question: args.question,
        ...(args.scope ? { scope: args.scope } : {}),
        ...(args.conversation_id ? { conversation_id: args.conversation_id } : {}),
        ...(args.output_format ? { output_format: args.output_format } : {}),
      },
    })
    const pollPath = `/v1/ask/${encodeURIComponent(created.ask_id)}`
    const start = now()
    const deadline = start + waitS * 1000
    for (;;) {
      const body = await apiJson<AskPollResponse>(getToken, baseUrl, "GET", pollPath)
      const t = now()
      if (body.status !== "processing" || t >= deadline) {
        return { ...withHint(body), ask_id: body.ask_id ?? created.ask_id, waited_ms: t - start }
      }
      await sleep(Math.min(ASK_POLL_INTERVAL_MS, deadline - t))
    }
  })
}

/** @internal Exported for unit testing. */
export async function handleGetAnswer(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { ask_id: string },
): Promise<ToolResult> {
  return runTool(async () => {
    const body = await apiJson<AskPollResponse>(getToken, baseUrl, "GET", `/v1/ask/${encodeURIComponent(args.ask_id)}`)
    return withHint(body)
  })
}

/** Register the two ask tools. @internal */
export function registerAskTools(server: McpServer, getToken: () => string, baseUrl?: string): void {
  server.registerTool(
    "talonic_ask",
    {
      title: "Ask a question over the workspace",
      description: ASK_DESCRIPTION,
      inputSchema: askInputSchema,
      annotations: { title: "Ask a question over the workspace", readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async (args) => handleAsk(getToken, baseUrl, args as AskArgs),
  )
  server.registerTool(
    "talonic_get_answer",
    {
      title: "Poll an ask for its answer",
      description: GET_ANSWER_DESCRIPTION,
      inputSchema: { ask_id: uuid.describe("From talonic_ask.") },
      annotations: { title: "Poll an ask for its answer", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => handleGetAnswer(getToken, baseUrl, args as { ask_id: string }),
  )
}
```

Deadline trace for the test "gives up at the deadline": wait 5 s, `now` advances only through `sleep`: poll@0 → sleep 2000 → poll@2000 → sleep 2000 → poll@4000 → `t (4000) < deadline (5000)` → sleep(min(2000, 1000)) = 1000 → poll@5000 → `t >= deadline` → return with `waited_ms: 5000`. Four GETs, as the test asserts.

- [ ] **Step 4: Run tests** — `npx vitest run tests/tools/ask.test.ts` → PASS (6). `npm run typecheck && npm run format && npm test` → green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/ask.ts tests/tools/ask.test.ts
git commit -m "feat(tools): talonic_ask (bounded wait) + talonic_get_answer over /v1/ask [skip docs]

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Widget registry keys + Spec widgets (list, card)

**Files:**
- Modify: `src/widgets/types.ts` (7 new keys in `WIDGET_URIS`, `TOOL_WIDGET_KEYS`, `TOOL_INVOCATION_STATUS`, `WIDGET_DESCRIPTIONS`)
- Create: `src/widgets/spec-list.ts`, `src/widgets/spec-card.ts`
- Create: `tests/widgets/fixtures/list-specs.json`, `tests/widgets/fixtures/get-spec.json`
- Test: `tests/widgets/render/spec-list.test.ts`, `tests/widgets/render/spec-card.test.ts`
- Modify: `tests/widgets/widget-registry.test.ts` (22 → 29 in the three count assertions)

**Interfaces:**
- Produces: keys `listSpecs`, `getSpec`, `runSpec`, `getRun`, `getRunResults`, `ask`, `getAnswer`; `getSpecListWidgetHtml()`, `getSpecCardWidgetHtml()`.
- **Dispatch note (binding):** adding keys to `WIDGET_URIS` makes `WIDGET_REGISTRY` in `register.ts` (typed `Record<WidgetKey, …>`) fail to compile until every new widget factory exists, and the 22/22 locks fail until the seven tools are registered with `_meta`. Therefore **Tasks 5, 6, 7 and 8 are ONE dispatch** (one implementer, one review, one full-suite green at the end of Task 8). Run only the focused render tests between them; commit at the end of Task 8 (one or several commits, implementer's choice; any commit that includes `src/tools/**` or `src/server-factory.ts` carries `[skip docs]`).

- [ ] **Step 1: Registry tables** — in `src/widgets/types.ts` append to `WIDGET_URIS`:

```ts
  listSpecs: "ui://widget/spec-list.html",
  getSpec: "ui://widget/spec-card.html",
  runSpec: "ui://widget/run-started.html",
  getRun: "ui://widget/run-status.html",
  getRunResults: "ui://widget/run-results.html",
  ask: "ui://widget/answer.html",
  getAnswer: "ui://widget/answer-polled.html",
```

to `TOOL_WIDGET_KEYS`:

```ts
  talonic_list_specs: "listSpecs",
  talonic_get_spec: "getSpec",
  talonic_run_spec: "runSpec",
  talonic_get_run: "getRun",
  talonic_get_run_results: "getRunResults",
  talonic_ask: "ask",
  talonic_get_answer: "getAnswer",
```

to `TOOL_INVOCATION_STATUS`:

```ts
  listSpecs: { invoking: "Loading Specs…", invoked: "Specs listed" },
  getSpec: { invoking: "Loading Spec structure…", invoked: "Spec structure ready" },
  runSpec: { invoking: "Starting the Spec run…", invoked: "Run started" },
  getRun: { invoking: "Checking run progress…", invoked: "Run progress ready" },
  getRunResults: { invoking: "Loading run results…", invoked: "Run results ready" },
  ask: { invoking: "Asking Talonic over your documents…", invoked: "Answer ready" },
  getAnswer: { invoking: "Checking for the answer…", invoked: "Answer status ready" },
```

to `WIDGET_DESCRIPTIONS`:

```ts
  listSpecs:
    "Table of the workspace's Specs (configured pipelines) with version state, field and stage counts, and last update.",
  getSpec:
    "Card for one Spec: version state, the schema it materializes onto, the rail's stages in order, the compiled phases, and its fields.",
  runSpec:
    "Confirmation that a Spec run started: run kind, input count, spec/pipeline/run ids, status, and how to poll it.",
  getRun:
    "Progress card for a Spec run: normalised status, documents completed / total / errors, and per-phase progress when available.",
  getRunResults:
    "Table of a Spec run's structured rows — one row per document with the Spec's fields — plus review holds and pagination.",
  ask: "Cited answer card: the answer text, verification verdict, source citations, artifacts and credit usage.",
  getAnswer:
    "Polled answer card: the same cited answer with verification and citations, or a still-processing notice.",
```

In `tests/widgets/widget-registry.test.ts` change the three `22` assertions (`KEYS` length, `tools` length, `Set` size) to `29`.

- [ ] **Step 2: Fixtures**

`tests/widgets/fixtures/list-specs.json`:

```json
{
  "data": [
    { "id": "b8ec7fe1-3656-42ab-8027-0238afbc930c", "name": "Purchase Order", "description": "PO header + line items", "schema_id": "514f3610-0801-4ac3-af3b-3553fb582808", "version": 3, "materialized_version": 3, "materialized_at": "2026-09-01T09:00:00.000Z", "field_count": 12, "node_count": 4, "created_at": "2026-07-22T23:20:00.000Z", "updated_at": "2026-09-01T09:00:00.000Z", "links": { "self": "/v1/specs/b8ec7fe1-3656-42ab-8027-0238afbc930c" } },
    { "id": "c9fd8ee2-4767-43bc-9138-1349bfcd041d", "name": "Invoice Intake", "description": null, "schema_id": "625a4721-1912-4bd4-b04c-4664ac693919", "version": 1, "materialized_version": null, "materialized_at": null, "field_count": 8, "node_count": 3, "created_at": "2026-09-10T08:00:00.000Z", "updated_at": "2026-09-20T08:00:00.000Z", "links": { "self": "/v1/specs/c9fd8ee2-4767-43bc-9138-1349bfcd041d" } },
    { "id": "d0ae9ff3-5878-44cd-a249-245acfde152e", "name": "Draft Contract Terms", "description": null, "schema_id": null, "version": null, "materialized_version": null, "materialized_at": null, "field_count": 0, "node_count": 1, "created_at": "2026-09-21T08:00:00.000Z", "updated_at": "2026-09-21T08:00:00.000Z", "links": {} }
  ],
  "pagination": { "total": 212, "limit": 3, "has_more": true, "next_cursor": "opaque" }
}
```

`tests/widgets/fixtures/get-spec.json`:

```json
{
  "id": "b8ec7fe1-3656-42ab-8027-0238afbc930c",
  "name": "Purchase Order",
  "description": "PO header + line items",
  "schema_id": "514f3610-0801-4ac3-af3b-3553fb582808",
  "version": 3,
  "materialized_version": 3,
  "materialized_at": "2026-09-01T09:00:00.000Z",
  "field_count": 4,
  "node_count": 4,
  "created_at": "2026-07-22T23:20:00.000Z",
  "updated_at": "2026-09-01T09:00:00.000Z",
  "links": { "self": "/v1/specs/b8ec7fe1-3656-42ab-8027-0238afbc930c", "versions": "/v1/specs/b8ec7fe1-3656-42ab-8027-0238afbc930c/versions" },
  "schema": { "id": "514f3610-0801-4ac3-af3b-3553fb582808", "name": "Purchase Order" },
  "nodes": [
    { "node_id": "n-source", "position": 0, "type": "source", "name": "Source", "schema_id": "514f3610-0801-4ac3-af3b-3553fb582808" },
    { "node_id": "n-schema", "position": 1, "type": "schema", "name": "Extract PO fields", "schema_id": "514f3610-0801-4ac3-af3b-3553fb582808" },
    { "node_id": "n-valid", "position": 2, "type": "valid", "name": "Totals check", "validation_stage_ids": ["vs-1", "vs-2"] },
    { "node_id": "n-deliver", "position": 3, "type": "deliver", "name": "Webhook" }
  ],
  "phases": [
    { "number": 1, "phase_id": "ph-1", "type": "extraction", "name": "Extract PO fields", "rail_stage_id": "n-schema" },
    { "number": 2, "phase_id": "ph-2", "type": "validation", "name": "Totals check · gate 1", "rail_stage_id": "n-valid", "validation_stage_id": "vs-1" },
    { "number": 3, "phase_id": "ph-3", "type": "validation", "name": "Totals check · gate 2", "rail_stage_id": "n-valid", "validation_stage_id": "vs-2" }
  ],
  "fields": [
    { "field_id": "f1", "user_schema_field_id": "usf1", "name": "po_number", "type": "string" },
    { "field_id": "f2", "user_schema_field_id": "usf2", "name": "vendor_name", "type": "string" },
    { "field_id": "f3", "user_schema_field_id": "usf3", "name": "total_amount", "type": "number" },
    { "field_id": "f4", "user_schema_field_id": "usf4", "name": "order_date", "type": "date" }
  ],
  "versions": [
    { "version": 3, "content_hash": "sha256:aaa", "created_at": "2026-09-01T09:00:00.000Z", "is_materialized": true },
    { "version": 2, "content_hash": "sha256:bbb", "created_at": "2026-08-15T09:00:00.000Z", "is_materialized": false }
  ]
}
```

- [ ] **Step 3: Failing render tests**

`tests/widgets/render/spec-list.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getSpecListWidgetHtml } from "../../../src/widgets/spec-list"
import { loadFixture, renderWidget } from "./harness"

describe("spec-list widget", () => {
  it("renders one row per Spec with version state, counts and pagination", () => {
    const r = renderWidget(getSpecListWidgetHtml(), loadFixture("list-specs"))
    expect(r.text).toContain("Specs")
    expect(r.text).toContain("3 of 212 Specs")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(r.text).toContain("Purchase Order")
    expect(r.text).toContain("PO header + line items")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("v3 live")
    expect(r.document.querySelector(".chip.warn")?.textContent).toBe("v1 not live")
    expect(r.document.querySelector(".chip.bad")?.textContent).toBe("unpublished")
    expect(r.text).toContain("12")
    expect(r.text).toContain("more available")
  })

  it("shows the empty state", () => {
    expect(renderWidget(getSpecListWidgetHtml(), { data: [] }).text).toBe("No Specs in this workspace.")
  })

  it("survives a malformed payload", () => {
    expect(renderWidget(getSpecListWidgetHtml(), { data: [null, 7, { name: 3 }], pagination: "x" }).document.querySelectorAll("tbody tr")).toHaveLength(3)
  })
})
```

`tests/widgets/render/spec-card.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getSpecCardWidgetHtml } from "../../../src/widgets/spec-card"
import { loadFixture, renderWidget } from "./harness"

describe("spec-card widget", () => {
  it("renders identity, version chips, rail, phases, fields and versions", () => {
    const r = renderWidget(getSpecCardWidgetHtml(), loadFixture("get-spec"))
    expect(r.text).toContain("Purchase Order")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("v3 live")
    expect(r.text).toContain("4 fields")
    expect(r.text).toContain("Rail (4 stages)")
    expect(r.document.querySelectorAll(".rail .chip")).toHaveLength(4)
    expect(r.document.querySelector(".rail .chip")?.textContent).toContain("source")
    expect(r.text).toContain("Compiled plan (3 phases)")
    expect(r.document.querySelectorAll("table tbody tr").length).toBeGreaterThanOrEqual(3)
    expect(r.text).toContain("Totals check · gate 2")
    expect(r.text).toContain("po_number")
    expect(r.text).toContain("Versions")
    expect(r.text).toContain("sha256:aaa")
  })

  it("renders a never-published Spec without the optional sections", () => {
    const r = renderWidget(getSpecCardWidgetHtml(), { id: "x", name: "Draft", version: null, nodes: [], phases: [], fields: [] })
    expect(r.document.querySelector(".chip.bad")?.textContent).toBe("unpublished")
    expect(r.text).not.toContain("Rail (")
    expect(r.text).not.toContain("Compiled plan")
    expect(r.text).not.toContain("Versions")
  })

  it("shows the empty state and survives malformed input", () => {
    expect(renderWidget(getSpecCardWidgetHtml(), {}).text).toBe("No Spec.")
    expect(renderWidget(getSpecCardWidgetHtml(), { id: 5, name: 7, nodes: "x", phases: 3, fields: { a: 1 }, versions: "y" }).text.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 4: Run to verify they fail** — modules not found.

- [ ] **Step 5: Implement `src/widgets/spec-list.ts`**

```ts
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_list_specs`: one row per Spec — name (+ description),
 * version state chip (live / not live / unpublished), field and stage counts,
 * last update — with a pagination footer.
 *
 * @internal
 */
export function getSpecListWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var rows = Array.isArray(payload.data) ? payload.data : [];
    var pg = payload.pagination && typeof payload.pagination === "object" ? payload.pagination : {};
    if (!rows.length) { empty("No Specs in this workspace."); return; }
    function versionChip(s) {
      if (s.version == null) return chip("unpublished", "bad");
      if (s.materialized_version != null && s.materialized_version === s.version) return chip("v" + s.version + " live", "good");
      return chip("v" + s.version + " not live", "warn");
    }
    var body = rows.map(function (s) {
      s = s && typeof s === "object" ? s : {};
      return '<tr>'
        + '<td><div class="val">' + esc(s.name || s.id || "(spec)") + '</div>' + (s.description ? '<div class="muted small">' + esc(clamp(s.description, 100)) + '</div>' : "") + '</td>'
        + '<td>' + versionChip(s) + '</td>'
        + '<td class="val num">' + esc(s.field_count != null ? s.field_count : "—") + '</td>'
        + '<td class="val num">' + esc(s.node_count != null ? s.node_count : "—") + '</td>'
        + '<td class="val">' + esc(s.updated_at ? relTime(s.updated_at) : "—") + '</td>'
        + '</tr>';
    }).join("");
    var total = typeof pg.total === "number" ? pg.total : rows.length;
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Specs</div><div class="subtitle">' + rows.length + ' of ' + total + ' Specs</div></div>'
      + (pg.has_more ? '<span class="chip">more available</span>' : "") + '</div>'
      + '<table><thead><tr><th>Spec</th><th>Version</th><th class="num">Fields</th><th class="num">Stages</th><th>Updated</th></tr></thead><tbody>' + body + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Specs", renderBody: RENDER_BODY })
```

- [ ] **Step 6: Implement `src/widgets/spec-card.ts`**

```ts
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_get_spec`: identity + version chips, the rail as
 * ordered stage chips, the compiled phase plan, the Spec's fields, and its
 * published versions when present.
 *
 * @internal
 */
export function getSpecCardWidgetHtml(): string {
  return WIDGET_HTML
}

const CSS = `
  .rail { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 6px; }
  .rail .arrow { color: var(--muted); font-size: 12px; }
`

const RENDER_BODY = `
    if (!payload || typeof payload !== "object" || (!payload.id && !payload.name)) { empty("No Spec."); return; }
    var nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    var phases = Array.isArray(payload.phases) ? payload.phases : [];
    var fields = Array.isArray(payload.fields) ? payload.fields : [];
    var versions = Array.isArray(payload.versions) ? payload.versions : [];
    var schema = payload.schema && typeof payload.schema === "object" ? payload.schema : null;
    function obj(x) { return x && typeof x === "object" ? x : {}; }
    var versionChip = payload.version == null ? chip("unpublished", "bad")
      : (payload.materialized_version != null && payload.materialized_version === payload.version ? chip("v" + payload.version + " live", "good") : chip("v" + payload.version + " not live", "warn"));
    var fieldCount = typeof payload.field_count === "number" ? payload.field_count : fields.length;
    var railHtml = nodes.length ? '<div class="plane"><div class="subtitle">Rail (' + nodes.length + ' stages)</div><div class="rail">'
      + nodes.map(function (n, i) { n = obj(n); return (i ? '<span class="arrow">→</span>' : "") + '<span class="chip" title="' + esc(n.name || "") + '">' + esc(n.type || "stage") + (n.name ? ' · ' + esc(clamp(n.name, 28)) : "") + '</span>'; }).join("")
      + '</div></div>' : "";
    var phaseHtml = phases.length ? '<div class="plane"><div class="subtitle">Compiled plan (' + phases.length + ' phases)</div><table><thead><tr><th class="num">#</th><th>Type</th><th>Phase</th></tr></thead><tbody>'
      + phases.map(function (p, i) { p = obj(p); return '<tr><td class="val num">' + esc(p.number != null ? p.number : i + 1) + '</td><td>' + chip(p.type, "") + '</td><td class="val">' + esc(p.name || "—") + '</td></tr>'; }).join("")
      + '</tbody></table></div>' : "";
    var fieldHtml = fields.length ? '<div class="plane"><div class="subtitle">Fields (' + fields.length + ')</div><div>'
      + fields.slice(0, 12).map(function (f) { f = obj(f); return chip(f.name || f.field_id || "field", ""); }).join("") + (fields.length > 12 ? '<span class="muted small"> +' + (fields.length - 12) + ' more</span>' : "") + '</div></div>' : "";
    var versionHtml = versions.length ? '<div class="plane"><div class="subtitle">Versions</div><table><thead><tr><th class="num">Version</th><th>Published</th><th>Hash</th><th></th></tr></thead><tbody>'
      + versions.slice(0, 8).map(function (v) { v = obj(v); return '<tr><td class="val num">' + esc(v.version != null ? v.version : "—") + '</td><td class="val">' + esc(v.created_at ? relTime(v.created_at) : "—") + '</td><td class="mono small">' + esc(clamp(fmt(v.content_hash), 18)) + '</td><td>' + (v.is_materialized ? chip("live", "good") : "") + '</td></tr>'; }).join("")
      + '</tbody></table></div>' : "";
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + esc(payload.name || payload.id) + '</div>'
      + (payload.description ? '<div class="subtitle">' + esc(clamp(payload.description, 140)) + '</div>' : "") + '</div>'
      + '<div>' + versionChip + chip(fieldCount + " fields", "") + '</div></div>'
      + '<div class="grid">'
      + '<div class="kv"><span class="k">Spec id</span> <span class="val">' + idChip(payload.id) + '</span></div>'
      + '<div class="kv"><span class="k">Schema</span> <span class="val">' + (schema ? esc(schema.name || "") + " " + idChip(schema.id) : idChip(payload.schema_id)) + '</span></div>'
      + '<div class="kv"><span class="k">Materialized</span> <span class="val">' + esc(payload.materialized_at ? relTime(payload.materialized_at) : "—") + '</span></div>'
      + '<div class="kv"><span class="k">Updated</span> <span class="val">' + esc(payload.updated_at ? relTime(payload.updated_at) : "—") + '</span></div>'
      + '</div>'
      + railHtml + phaseHtml + fieldHtml + versionHtml;
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Spec", css: CSS, renderBody: RENDER_BODY })
```

- [ ] **Step 7: Run the two render tests** — PASS (6). Do NOT run the full suite yet (register.ts will not compile until Task 7's registry entries land). Continue to Task 6 in the same session.

---

### Task 6: Run widgets — started, status, results

**Files:**
- Create: `src/widgets/run-started.ts`, `src/widgets/run-status.ts`, `src/widgets/run-results.ts`
- Create: `tests/widgets/fixtures/run-started.json`, `run-status.json`, `run-results.json`
- Test: `tests/widgets/render/run-started.test.ts`, `run-status.test.ts`, `run-results.test.ts`

**Interfaces:** produces `getRunStartedWidgetHtml()`, `getRunStatusWidgetHtml()`, `getRunResultsWidgetHtml()`.

- [ ] **Step 1: Fixtures**

`run-started.json` (pipeline RunEnvelope):

```json
{ "run_kind": "pipeline", "run_id": "a0000001-0000-4000-8000-000000000001", "pipeline_id": "p1pe0001-0000-4000-8000-000000000001", "spec_id": "b8ec7fe1-3656-42ab-8027-0238afbc930c", "spec_name": "Purchase Order", "status": "processing", "raw_status": "active", "input_count": 2, "enqueued_documents": 2, "appended": false, "message": "Pipeline created and queued for processing.", "links": { "self": "/v1/pipelines/p1pe0001-0000-4000-8000-000000000001", "progress": "/v1/pipelines/p1pe0001-0000-4000-8000-000000000001/progress" } }
```

`run-status.json` (pipeline path, finalizing):

```json
{ "run_kind": "pipeline", "run_id": null, "pipeline_id": "p1pe0001-0000-4000-8000-000000000001", "spec_id": "b8ec7fe1-3656-42ab-8027-0238afbc930c", "name": "smoke", "status": "processing", "raw_status": "finalizing", "progress": { "total_documents": 4, "completed_documents": 3, "error_documents": 1, "finalization_pending": ["assembly"], "phases": [ { "phase_id": "ph-1", "name": "Extract PO fields", "type": "extraction", "completed": 4, "running": 0, "errors": 0 }, { "phase_id": "ph-2", "name": "Totals check", "type": "validation", "completed": 3, "running": 0, "errors": 1 } ] }, "created_at": "2026-09-22T10:00:00.000Z", "links": {} }
```

`run-results.json`:

```json
{ "run_kind": "run", "run_id": "a0000001-0000-4000-8000-000000000001", "pipeline_id": "p1pe0001-0000-4000-8000-000000000001", "spec_id": "b8ec7fe1-3656-42ab-8027-0238afbc930c", "status": "completed", "view": "documents", "generated_at": "2026-09-22T10:05:00.000Z", "columns": [ { "field_key": "po_number", "display_name": "PO Number", "data_type": "string" }, { "field_key": "vendor_name", "display_name": "Vendor", "data_type": "string" }, { "field_key": "total_amount", "display_name": "Total Amount", "data_type": "number" } ], "data": [ { "document_id": "d0c00001-0000-4000-8000-000000000001", "filename": "po-1042.pdf", "run_id": "a0000001-0000-4000-8000-000000000001", "pipeline_id": "p1pe0001-0000-4000-8000-000000000001", "record_id": "rec-1", "status": "complete", "completed_at": "2026-09-22T10:04:00.000Z", "fields": { "po_number": "PO-1042", "vendor_name": "Musterfirma AG", "total_amount": 1299 } }, { "document_id": "d0c00001-0000-4000-8000-000000000002", "filename": "po-1043.pdf", "run_id": "a0000001-0000-4000-8000-000000000001", "pipeline_id": "p1pe0001-0000-4000-8000-000000000001", "record_id": "rec-2", "status": "partial", "completed_at": null, "fields": { "po_number": "PO-1043", "vendor_name": "Beispiel GmbH", "total_amount": null } } ], "pagination": { "total": 2, "limit": 50, "has_more": false, "next_cursor": null }, "pending_review_count": 1, "links": { "self": "x", "run": "y" } }
```

- [ ] **Step 2: Failing render tests**

`run-started.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getRunStartedWidgetHtml } from "../../../src/widgets/run-started"
import { loadFixture, renderWidget } from "./harness"

describe("run-started widget", () => {
  it("confirms a pipeline run with ids, count and the poll hint", () => {
    const r = renderWidget(getRunStartedWidgetHtml(), loadFixture("run-started"))
    expect(r.text).toContain("Run started")
    expect(r.document.querySelector(".chip.info")?.textContent).toBe("pipeline")
    expect(r.document.querySelector(".big")?.textContent).toContain("2")
    expect(r.text).toContain("Purchase Order")
    expect(r.text).toContain("p1pe0001")
    expect(r.text).toContain("a0000001")
    expect(r.text).toContain("Poll with talonic_get_run")
    expect(r.text).toContain("pipeline_id")
  })

  it("says Documents appended for append mode and lists file_urls documents", () => {
    const r = renderWidget(getRunStartedWidgetHtml(), { run_kind: "run", run_id: "a0000001-0000-4000-8000-000000000001", pipeline_id: null, spec_id: "s", status: "processing", input_count: 1, appended: true, documents: [{ document_id: "d0c00001-0000-4000-8000-000000000001", filename: "invoice-0421.pdf", size_bytes: 20480, source: "file_url", deduplicated: true }] })
    expect(r.text).toContain("Documents appended")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(1)
    expect(r.text).toContain("invoice-0421.pdf")
    expect(r.text).toContain("20 KB")
    expect(r.text).toContain("deduplicated")
    expect(r.text).toContain("run_id")
  })

  it("empty and malformed payloads", () => {
    expect(renderWidget(getRunStartedWidgetHtml(), {}).text).toBe("No run was started.")
    expect(renderWidget(getRunStartedWidgetHtml(), { run_kind: 3, input_count: "x", documents: "y", pipeline_id: 9 }).text.length).toBeGreaterThan(0)
  })
})
```

`run-status.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getRunStatusWidgetHtml } from "../../../src/widgets/run-status"
import { loadFixture, renderWidget } from "./harness"

describe("run-status widget", () => {
  it("renders status, document progress bar, phases and finalization", () => {
    const r = renderWidget(getRunStatusWidgetHtml(), loadFixture("run-status"))
    expect(r.document.querySelector(".chip.info")?.textContent).toBe("processing")
    expect(r.text).toContain("finalizing")
    expect(r.text).toContain("3 of 4 documents")
    expect(r.text).toContain("1 error")
    expect(r.document.querySelector(".bar span")?.getAttribute("style")).toContain("width:75%")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(r.text).toContain("Totals check")
    expect(r.text).toContain("Finalizing: assembly")
  })

  it("completed and failed tones; run path with documents", () => {
    const done = renderWidget(getRunStatusWidgetHtml(), { run_kind: "run", run_id: "r", status: "completed", raw_status: "completed", input_count: 1, progress: { total_documents: 1, completed_documents: 1, error_documents: 0 }, documents: [{ document_id: "d0c00001-0000-4000-8000-000000000001", filename: "invoice-0421.pdf", status: "completed" }] })
    expect(done.document.querySelector(".chip.good")?.textContent).toBe("completed")
    expect(done.text).toContain("invoice-0421.pdf")
    const failed = renderWidget(getRunStatusWidgetHtml(), { run_kind: "run", run_id: "r", status: "failed", raw_status: "failed", error_message: "Spec has no composed rail" })
    expect(failed.document.querySelector(".chip.bad")?.textContent).toBe("failed")
    expect(failed.text).toContain("Spec has no composed rail")
  })

  it("empty and malformed payloads", () => {
    expect(renderWidget(getRunStatusWidgetHtml(), {}).text).toBe("No run to show.")
    expect(renderWidget(getRunStatusWidgetHtml(), { run_kind: "pipeline", pipeline_id: "p", status: 5, progress: "x", documents: 3 }).text.length).toBeGreaterThan(0)
  })
})
```

`run-results.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getRunResultsWidgetHtml } from "../../../src/widgets/run-results"
import { loadFixture, renderWidget } from "./harness"

describe("run-results widget", () => {
  it("renders the rows table from columns + fields with status chips and review count", () => {
    const r = renderWidget(getRunResultsWidgetHtml(), loadFixture("run-results"))
    expect(r.text).toContain("Run results")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("completed")
    expect(r.text).toContain("1 held for review")
    const headers = Array.from(r.document.querySelectorAll("thead th")).map((th) => th.textContent)
    expect(headers).toEqual(["Document", "Status", "PO Number", "Vendor", "Total Amount"])
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(r.text).toContain("Musterfirma AG")
    expect(r.text).toContain("1299")
    expect(r.document.querySelectorAll("tbody .chip.warn")).toHaveLength(1) // partial
    expect(r.text).toContain("2 of 2 rows")
  })

  it("empty rows and malformed payloads", () => {
    expect(renderWidget(getRunResultsWidgetHtml(), { columns: [], data: [] }).text).toBe("No result rows yet.")
    expect(renderWidget(getRunResultsWidgetHtml(), {}).text).toBe("No result rows yet.")
    expect(renderWidget(getRunResultsWidgetHtml(), { columns: "x", data: [null, { fields: "y" }], pagination: 2 }).document.querySelectorAll("tbody tr")).toHaveLength(2)
  })
})
```

- [ ] **Step 3: Implement `src/widgets/run-started.ts`**

```ts
import { buildWidgetHtml } from "./shared.js"

/** Confirmation card for `talonic_run_spec`. @internal */
export function getRunStartedWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    if (!payload || typeof payload !== "object" || (!payload.pipeline_id && !payload.run_id)) { empty("No run was started."); return; }
    function kb(n) { return typeof n === "number" ? (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB") : "—"; }
    var kind = payload.run_kind === "run" ? "run" : "pipeline";
    var docs = Array.isArray(payload.documents) ? payload.documents : [];
    var pollArg = kind === "pipeline" && payload.pipeline_id ? "pipeline_id " + shortId(payload.pipeline_id) : "run_id " + shortId(payload.run_id);
    var docHtml = docs.length ? '<div class="plane"><div class="subtitle">Documents (' + docs.length + ')</div><table><thead><tr><th>File</th><th>Size</th><th></th></tr></thead><tbody>'
      + docs.slice(0, 20).map(function (d) { d = d && typeof d === "object" ? d : {}; return '<tr><td class="val">' + esc(d.filename || shortId(d.document_id)) + '</td><td class="val">' + esc(kb(d.size_bytes)) + '</td><td>' + (d.deduplicated ? chip("deduplicated", "info") : "") + '</td></tr>'; }).join("")
      + '</tbody></table>' + (docs.length > 20 ? '<div class="muted small">+' + (docs.length - 20) + ' more</div>' : "") + '</div>' : "";
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + (payload.appended ? "Documents appended" : "Run started") + '</div><div class="subtitle">' + esc(payload.spec_name || shortId(payload.spec_id)) + '</div></div>'
      + '<div>' + chip(kind, "info") + chip(payload.status, payload.status === "failed" ? "bad" : payload.status === "completed" ? "good" : "") + '</div></div>'
      + '<div class="big">' + esc(typeof payload.input_count === "number" ? payload.input_count : docs.length || "—") + ' <span class="muted small">documents</span></div>'
      + '<div class="grid">'
      + '<div class="kv"><span class="k">Spec</span> <span class="val">' + idChip(payload.spec_id) + '</span></div>'
      + '<div class="kv"><span class="k">Pipeline</span> <span class="val">' + idChip(payload.pipeline_id) + '</span></div>'
      + '<div class="kv"><span class="k">Run</span> <span class="val">' + idChip(payload.run_id) + '</span></div>'
      + '<div class="kv"><span class="k">Enqueued</span> <span class="val">' + esc(payload.enqueued_documents != null ? payload.enqueued_documents : "—") + '</span></div>'
      + '</div>'
      + (payload.message ? '<div class="muted small" style="margin-top:8px">' + esc(payload.message) + '</div>' : "")
      + '<div class="small" style="margin-top:8px">Poll with talonic_get_run (' + esc(pollArg) + ') every 5–10 s, then talonic_get_run_results.</div>'
      + docHtml;
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Run Started", renderBody: RENDER_BODY })
```

- [ ] **Step 4: Implement `src/widgets/run-status.ts`**

```ts
import { buildWidgetHtml } from "./shared.js"

/** Progress card for `talonic_get_run`. @internal */
export function getRunStatusWidgetHtml(): string {
  return WIDGET_HTML
}

const CSS = `
  .progress { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .progress .bar { width: 160px; height: 8px; }
`

const RENDER_BODY = `
    if (!payload || typeof payload !== "object" || (!payload.pipeline_id && !payload.run_id)) { empty("No run to show."); return; }
    function tone(s) { return s === "completed" ? "good" : s === "failed" ? "bad" : "info"; }
    var status = typeof payload.status === "string" ? payload.status : "processing";
    var pr = payload.progress && typeof payload.progress === "object" ? payload.progress : {};
    var total = typeof pr.total_documents === "number" ? pr.total_documents : (typeof payload.input_count === "number" ? payload.input_count : 0);
    var done = typeof pr.completed_documents === "number" ? pr.completed_documents : 0;
    var errs = typeof pr.error_documents === "number" ? pr.error_documents : 0;
    var pct = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : (status === "completed" ? 100 : 0);
    var phases = Array.isArray(pr.phases) ? pr.phases : [];
    var docs = Array.isArray(payload.documents) ? payload.documents : [];
    var pending = Array.isArray(pr.finalization_pending) ? pr.finalization_pending : [];
    var phaseHtml = phases.length ? '<div class="plane"><div class="subtitle">Phases</div><table><thead><tr><th>Phase</th><th>Type</th><th class="num">Done</th><th class="num">Running</th><th class="num">Errors</th></tr></thead><tbody>'
      + phases.map(function (p) { p = p && typeof p === "object" ? p : {}; return '<tr><td class="val">' + esc(p.name || p.phase_id || "—") + '</td><td>' + chip(p.type, "") + '</td><td class="val num">' + esc(p.completed != null ? p.completed : 0) + '</td><td class="val num">' + esc(p.running != null ? p.running : 0) + '</td><td class="val num">' + esc(p.errors != null ? p.errors : 0) + '</td></tr>'; }).join("")
      + '</tbody></table></div>' : "";
    var docHtml = docs.length ? '<div class="plane"><div class="subtitle">Documents (' + docs.length + ')</div><table><thead><tr><th>File</th><th>Status</th></tr></thead><tbody>'
      + docs.slice(0, 50).map(function (d) { d = d && typeof d === "object" ? d : {}; return '<tr><td class="val">' + esc(d.filename || shortId(d.document_id)) + '</td><td>' + chip(d.status, tone(d.status)) + '</td></tr>'; }).join("")
      + '</tbody></table></div>' : "";
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + esc(payload.name || "Spec run") + '</div><div class="subtitle">' + esc(payload.run_kind === "run" ? "run " + shortId(payload.run_id) : "pipeline " + shortId(payload.pipeline_id)) + (payload.raw_status && payload.raw_status !== status ? ' · ' + esc(payload.raw_status) : "") + '</div></div>'
      + '<div>' + chip(status, tone(status)) + '</div></div>'
      + '<div class="progress"><span class="bar ' + (errs ? "warn" : "") + '"><span style="width:' + pct + '%"></span></span><span class="val">' + done + ' of ' + total + ' documents</span>' + (errs ? '<span class="muted small">· ' + errs + ' error' + (errs === 1 ? "" : "s") + '</span>' : "") + '</div>'
      + (pending.length ? '<div class="muted small" style="margin-top:6px">Finalizing: ' + esc(pending.join(", ")) + '</div>' : "")
      + (payload.error_message ? '<div class="small" style="margin-top:8px;color:var(--bad)">' + esc(payload.error_message) + '</div>' : "")
      + phaseHtml + docHtml;
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Run Progress", css: CSS, renderBody: RENDER_BODY })
```

- [ ] **Step 5: Implement `src/widgets/run-results.ts`**

```ts
import { buildWidgetHtml } from "./shared.js"

/** Rows table for `talonic_get_run_results`. @internal */
export function getRunResultsWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var cols = Array.isArray(payload.columns) ? payload.columns.filter(function (c) { return c && typeof c === "object"; }) : [];
    var rows = Array.isArray(payload.data) ? payload.data : [];
    var pg = payload.pagination && typeof payload.pagination === "object" ? payload.pagination : {};
    if (!rows.length) { empty("No result rows yet."); return; }
    function tone(s) { return s === "complete" || s === "completed" ? "good" : s === "error" ? "bad" : s === "partial" ? "warn" : "info"; }
    var shownCols = cols.slice(0, 10);
    var head = '<tr><th>Document</th><th>Status</th>' + shownCols.map(function (c) { return '<th>' + esc(c.display_name || c.field_key || "") + '</th>'; }).join("") + '</tr>';
    var body = rows.slice(0, 50).map(function (r) {
      r = r && typeof r === "object" ? r : {};
      var f = r.fields && typeof r.fields === "object" ? r.fields : {};
      return '<tr><td class="val">' + esc(r.filename || shortId(r.document_id)) + '</td><td>' + chip(r.status, tone(r.status)) + '</td>'
        + shownCols.map(function (c) { var v = f[c.field_key]; var text = v == null ? "—" : (typeof v === "object" ? clamp(JSON.stringify(v), 60) : fmt(v)); return '<td class="val">' + esc(text) + '</td>'; }).join("") + '</tr>';
    }).join("");
    var total = typeof pg.total === "number" ? pg.total : rows.length;
    var held = typeof payload.pending_review_count === "number" ? payload.pending_review_count : 0;
    var more = [];
    if (rows.length > 50) more.push("+" + (rows.length - 50) + " more rows");
    if (cols.length > 10) more.push("+" + (cols.length - 10) + " more columns");
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Run results</div><div class="subtitle">' + Math.min(rows.length, 50) + ' of ' + total + ' rows' + (pg.has_more ? " · more available" : "") + '</div></div>'
      + '<div>' + chip(payload.status, payload.status === "completed" ? "good" : payload.status === "failed" ? "bad" : "info") + (held ? chip(held + " held for review", "warn") : "") + '</div></div>'
      + '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>'
      + (more.length ? '<div class="muted small" style="margin-top:6px">' + esc(more.join(" · ")) + '</div>' : "");
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Run Results", renderBody: RENDER_BODY })
```

- [ ] **Step 6: Run the three render tests** — PASS (8). Continue to Task 7.

---

### Task 7: Answer widget (ask + get_answer), registry entries, single commit for Tasks 5–7

**Files:**
- Create: `src/widgets/answer.ts` (exports `getAnswerWidgetHtml`, `getAnswerPolledWidgetHtml`)
- Create: `tests/widgets/fixtures/answer.json`
- Test: `tests/widgets/render/answer.test.ts`
- Modify: `src/widgets/register.ts` (+7 entries), `tests/widgets/xss.test.ts` (fixture map +7)

- [ ] **Step 1: Fixture** `tests/widgets/fixtures/answer.json`:

```json
{ "ask_id": "a5k00001-0000-4000-8000-000000000001", "status": "completed", "conversation_id": "c0000001-0000-4000-8000-000000000001", "answer": "The total on **invoice-0421.pdf** is 1,299.00 EUR [1]. It was issued by Musterfirma AG on 2026-04-17 [2].", "citations": [ { "quote": "Total amount due: 1,299.00 EUR", "document_id": "d0c00001-0000-4000-8000-000000000001", "kind": "field", "reference": "total_amount", "filename": "invoice-0421.pdf", "app_url": "https://app.talonic.com/documents/d0c00001-0000-4000-8000-000000000001" }, { "quote": "Musterfirma AG · Rechnungsdatum 17.04.2026", "document_id": "d0c00001-0000-4000-8000-000000000001", "kind": "quote", "filename": "invoice-0421.pdf" } ], "cards": [], "artifacts": [ { "type": "table", "id": "art-1", "label": "Invoice lines", "link": "https://app.talonic.com/artifacts/art-1" } ], "tool_calls": 3, "verification": { "verdict": "supported", "checks_total": 2, "checks_unsupported": 0 }, "usage": { "tokens": 812, "credits_charged": 3 }, "waited_ms": 4100 }
```

- [ ] **Step 2: Failing render test** `tests/widgets/render/answer.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getAnswerPolledWidgetHtml, getAnswerWidgetHtml } from "../../../src/widgets/answer"
import { loadFixture, renderWidget } from "./harness"

describe("answer widgets", () => {
  it("renders the answer, verification, citations, artifacts and usage", () => {
    const r = renderWidget(getAnswerWidgetHtml(), loadFixture("answer"))
    expect(r.text).toContain("Answer")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("supported")
    expect(r.document.querySelector("pre.md")?.textContent).toContain("1,299.00 EUR")
    expect(r.text).toContain("Citations (2)")
    expect(r.text).toContain("Total amount due")
    expect(r.document.querySelectorAll(".cite .chip").length).toBeGreaterThanOrEqual(2) // kind chips
    expect(r.text).toContain("Artifacts (1)")
    expect(r.document.querySelector("a.btn")?.getAttribute("href")).toBe("https://app.talonic.com/artifacts/art-1")
    expect(r.text).toContain("3 credits")
    expect(r.text).toContain("812 tokens")
    expect(r.text).toContain("3 tool calls")
    expect(r.text).toContain("4.1 s")
  })

  it("shows the processing notice with the ask id, and the error state", () => {
    const p = renderWidget(getAnswerPolledWidgetHtml(), { ask_id: "a5k00001-0000-4000-8000-000000000001", status: "processing", conversation_id: "c", poll_hint: "x" })
    expect(p.text).toContain("Answer (polled)")
    expect(p.text).toContain("Still thinking")
    expect(p.text).toContain("talonic_get_answer")
    expect(p.text).toContain("a5k00001")
    const e = renderWidget(getAnswerWidgetHtml(), { ask_id: "a", status: "error", answer: null })
    expect(e.document.querySelector(".chip.bad")?.textContent).toBe("error")
  })

  it("verification tones and empty/malformed payloads", () => {
    const issues = renderWidget(getAnswerWidgetHtml(), { ask_id: "a", status: "completed", answer: "x", verification: { verdict: "issues", checks_total: 3, checks_unsupported: 1, correction: "One claim lacked a source." } })
    expect(issues.document.querySelector(".chip.warn")?.textContent).toBe("issues")
    expect(issues.text).toContain("One claim lacked a source.")
    expect(renderWidget(getAnswerWidgetHtml(), {}).text).toBe("No answer.")
    expect(renderWidget(getAnswerWidgetHtml(), { ask_id: 5, status: 7, answer: { a: 1 }, citations: "x", usage: 3 }).text.length).toBeGreaterThan(0)
  })

  it("the two templates differ only in headline", () => {
    const a = getAnswerWidgetHtml().replace('"Answer"', "X").replace("Talonic — Answer", "T")
    const b = getAnswerPolledWidgetHtml().replace('"Answer (polled)"', "X").replace("Talonic — Answer (polled)", "T")
    expect(a).toBe(b)
  })
})
```

- [ ] **Step 3: Implement `src/widgets/answer.ts`**

```ts
import { buildWidgetHtml } from "./shared.js"

/**
 * Cited-answer card shared by `talonic_ask` ("Answer") and `talonic_get_answer`
 * ("Answer (polled)"): verification verdict, the answer text (markdown kept
 * literal — no external renderer under the empty CSP), citations with kind
 * chips, artifacts, usage tiles; or the still-processing notice.
 *
 * @internal
 */
export function getAnswerWidgetHtml(): string {
  return ANSWER_HTML
}

/** @internal */
export function getAnswerPolledWidgetHtml(): string {
  return POLLED_HTML
}

const CSS = `
  .cite { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; border-bottom: 1px solid var(--border); }
  .cite:last-child { border-bottom: none; }
  pre.md.answer { max-height: 480px; font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; }
`

const ANSWER_BODY = `
    if (!payload || typeof payload !== "object" || !payload.ask_id) { empty("No answer."); return; }
    var status = typeof payload.status === "string" ? payload.status : "processing";
    function obj(x) { return x && typeof x === "object" ? x : {}; }
    var ver = obj(payload.verification);
    var usage = obj(payload.usage);
    var cites = Array.isArray(payload.citations) ? payload.citations : [];
    var arts = Array.isArray(payload.artifacts) ? payload.artifacts : [];
    var verdictTone = ver.verdict === "supported" ? "good" : ver.verdict === "issues" ? "warn" : ver.verdict === "unverifiable" ? "bad" : "";
    var head = '<div class="header"><div><div class="title">' + HEADLINE + '</div><div class="subtitle">ask ' + idChip(payload.ask_id) + (payload.conversation_id ? ' · conversation ' + idChip(payload.conversation_id) : "") + '</div></div>'
      + '<div>' + (status === "completed" ? chip(ver.verdict, verdictTone) : chip(status, status === "error" ? "bad" : "info")) + '</div></div>';
    if (status === "processing") {
      root.innerHTML = head + '<div class="small">Still thinking… call talonic_get_answer with ask_id ' + idChip(payload.ask_id) + ' in a few seconds.</div>';
      return;
    }
    var answer = typeof payload.answer === "string" ? payload.answer : (payload.answer == null ? "" : fmt(payload.answer));
    var citeHtml = cites.length ? '<div class="plane"><div class="subtitle">Citations (' + cites.length + ')</div>' + cites.slice(0, 20).map(function (c, i) {
      c = obj(c);
      return '<div class="cite"><span class="small">[' + (i + 1) + '] “' + esc(clamp(c.quote || fmt(c), 200)) + '”</span><span class="muted small">' + chip(c.kind, c.kind === "field" ? "info" : "") + esc(c.filename || shortId(c.document_id)) + (c.reference ? ' · ' + esc(c.reference) : "") + '</span></div>';
    }).join("") + '</div>' : "";
    var artHtml = arts.length ? '<div class="plane"><div class="subtitle">Artifacts (' + arts.length + ')</div>' + arts.slice(0, 10).map(function (a) {
      a = obj(a);
      var link = typeof a.link === "string" && /^https:\\/\\//.test(a.link) ? a.link : "";
      return '<div class="kv"><span class="val">' + esc(a.label || a.type || a.id || "artifact") + '</span>' + (link ? '<a class="btn small" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Open</a>' : "") + '</div>';
    }).join("") + '</div>' : "";
    var tiles = [];
    if (typeof usage.credits_charged === "number") tiles.push(usage.credits_charged + " credits");
    if (typeof usage.tokens === "number") tiles.push(usage.tokens + " tokens");
    if (typeof payload.tool_calls === "number") tiles.push(payload.tool_calls + " tool call" + (payload.tool_calls === 1 ? "" : "s"));
    if (typeof payload.waited_ms === "number") tiles.push((payload.waited_ms / 1000).toFixed(1) + " s");
    if (typeof ver.checks_total === "number") tiles.push(ver.checks_total + " checks, " + (ver.checks_unsupported || 0) + " unsupported");
    root.innerHTML = head
      + (answer ? '<pre class="md answer">' + esc(answer) + '</pre>' : '<div class="muted small">The agent returned no answer text.</div>')
      + (ver.correction ? '<div class="small" style="margin-top:6px"><span class="muted">Correction:</span> ' + esc(ver.correction) + '</div>' : "")
      + citeHtml + artHtml
      + (tiles.length ? '<div class="muted small" style="margin-top:10px">' + esc(tiles.join(" · ")) + '</div>' : "");
`

function answerWidget(headline: string, title: string): string {
  return buildWidgetHtml({
    title,
    css: CSS,
    renderBody: "    var HEADLINE = " + JSON.stringify(headline) + ";\n" + ANSWER_BODY,
  })
}

const ANSWER_HTML = answerWidget("Answer", "Talonic — Answer")
const POLLED_HTML = answerWidget("Answer (polled)", "Talonic — Answer (polled)")
```

- [ ] **Step 4: Registry entries** — in `src/widgets/register.ts` add imports for the six new widget files and these entries to `WIDGET_REGISTRY` (after `submitAgentTask`):

```ts
  listSpecs: { name: "spec-list-widget", title: "Talonic Specs", html: getSpecListWidgetHtml },
  getSpec: { name: "spec-card-widget", title: "Talonic Spec", html: getSpecCardWidgetHtml },
  runSpec: { name: "run-started-widget", title: "Talonic Run Started", html: getRunStartedWidgetHtml },
  getRun: { name: "run-status-widget", title: "Talonic Run Progress", html: getRunStatusWidgetHtml },
  getRunResults: { name: "run-results-widget", title: "Talonic Run Results", html: getRunResultsWidgetHtml },
  ask: { name: "answer-widget", title: "Talonic Answer", html: getAnswerWidgetHtml },
  getAnswer: { name: "answer-polled-widget", title: "Talonic Answer (polled)", html: getAnswerPolledWidgetHtml },
```

- [ ] **Step 5: XSS fixture map** — in `tests/widgets/xss.test.ts` (from sub-project 1) extend the key → fixture map: `listSpecs: "list-specs"`, `getSpec: "get-spec"`, `runSpec: "run-started"`, `getRun: "run-status"`, `getRunResults: "run-results"`, `ask: "answer"`, `getAnswer: "answer"`.

- [ ] **Step 6: Focused check** — `npx vitest run tests/widgets/render` → PASS (all render tests incl. the four answer tests). `npm run typecheck` → green (register.ts now compiles with 29 entries). Do NOT run the full suite yet: `all-widgets.test.ts` iterates `TOOL_WIDGET_KEYS` (29 tools) and the seven new tools are not registered until Task 8. Continue immediately with Task 8.

---

### Task 8: Wiring — register the seven tools with widget meta, locks to 29, manifest, preflight constant

**Files:**
- Modify: `src/tools/specs.ts`, `src/tools/run.ts`, `src/tools/ask.ts` (add `_meta: widgetToolMeta("<key>")` to each `registerTool` config; import `widgetToolMeta` from `../widgets/types.js`)
- Modify: `src/server-factory.ts` (import + register the three groups with `rawToken`)
- Modify: `tests/tools/descriptions.test.ts` (ALL_TOOLS +7), `tests/widgets/tool-annotations.test.ts` (READ_ONLY +5, WRITE +2, OPEN_WORLD +1)
- Modify: `chatgpt-app-submission.json` (+7 tools, +2 test cases), `scripts/chatgpt-preflight.mjs` (`EXPECTED_TOOLS = 29`)
- Create: `tests/scripts/preflight-constant.test.ts`

- [ ] **Step 1: Tool meta.** Keys: `talonic_list_specs` → `"listSpecs"`, `talonic_get_spec` → `"getSpec"`, `talonic_run_spec` → `"runSpec"`, `talonic_get_run` → `"getRun"`, `talonic_get_run_results` → `"getRunResults"`, `talonic_ask` → `"ask"`, `talonic_get_answer` → `"getAnswer"`. Add `_meta: widgetToolMeta("…"),` after each `annotations: {…},`.

- [ ] **Step 2: server-factory.** Add imports `registerSpecTools` (`./tools/specs.js`), `registerRunTools` (`./tools/run.js`), `registerAskTools` (`./tools/ask.js`); after `registerAgentTaskTools(server, rawToken, baseUrl)` add:

```ts
  registerSpecTools(server, rawToken, baseUrl)
  registerRunTools(server, rawToken, baseUrl)
  registerAskTools(server, rawToken, baseUrl)
```

Also extend the server `instructions` string (same array) with one sentence, appended before "Prefer acting over explaining.":

```ts
        "To run the customer's configured pipeline: talonic_list_specs -> talonic_run_spec (document_ids for",
        "workspace documents, file_urls for remote files) -> poll talonic_get_run until completed ->",
        "talonic_get_run_results. For open questions across documents use talonic_ask (costs credits;",
        "if it returns status processing, poll talonic_get_answer).",
```

- [ ] **Step 3: Lock lists.** `tests/tools/descriptions.test.ts` `ALL_TOOLS` += the seven names. `tests/widgets/tool-annotations.test.ts`: `READ_ONLY_TOOLS` += `talonic_list_specs`, `talonic_get_spec`, `talonic_get_run`, `talonic_get_run_results`, `talonic_get_answer`; `WRITE_TOOLS` += `talonic_run_spec`, `talonic_ask`; `OPEN_WORLD_TOOLS` += `talonic_run_spec` (update its comment: "…and talonic_run_spec fetches public file URLs").

- [ ] **Step 4: Manifest.** In `chatgpt-app-submission.json` `tools` add:

```json
"talonic_list_specs": { "annotations": { "readOnlyHint": true, "openWorldHint": false, "destructiveHint": false }, "justifications": { "read_only_justification": "Lists the workspace's configured Specs (pipelines) with version state and counts; nothing is created or changed.", "open_world_justification": "Reads the connected Talonic workspace only; no public internet access.", "destructive_justification": "Read-only listing; nothing is deleted or overwritten." } },
"talonic_get_spec": { "annotations": { "readOnlyHint": true, "openWorldHint": false, "destructiveHint": false }, "justifications": { "read_only_justification": "Reads one Spec's structure (rail, compiled phases, fields, versions); nothing is created or changed.", "open_world_justification": "Reads the connected Talonic workspace only; no public internet access.", "destructive_justification": "Read-only fetch; nothing is deleted or overwritten." } },
"talonic_run_spec": { "annotations": { "readOnlyHint": false, "openWorldHint": true, "destructiveHint": false }, "justifications": { "read_only_justification": "Starts a pipeline run over the user's documents or remote file URLs, creating new structured rows and consuming credits the user is shown.", "open_world_justification": "With file_urls the platform fetches the user-supplied public https URLs to ingest them; with document_ids it stays inside the workspace.", "destructive_justification": "Creates a new run and new versioned data; existing documents and rows are never deleted or overwritten." } },
"talonic_get_run": { "annotations": { "readOnlyHint": true, "openWorldHint": false, "destructiveHint": false }, "justifications": { "read_only_justification": "Polls a run's status and progress; nothing is created or changed.", "open_world_justification": "Reads the connected Talonic workspace only; no public internet access.", "destructive_justification": "Read-only poll; nothing is deleted or overwritten." } },
"talonic_get_run_results": { "annotations": { "readOnlyHint": true, "openWorldHint": false, "destructiveHint": false }, "justifications": { "read_only_justification": "Reads a run's structured rows and columns; nothing is created or changed.", "open_world_justification": "Reads the connected Talonic workspace only; no public internet access.", "destructive_justification": "Read-only fetch; nothing is deleted or overwritten." } },
"talonic_ask": { "annotations": { "readOnlyHint": false, "openWorldHint": false, "destructiveHint": false }, "justifications": { "read_only_justification": "Starts an agent turn that may extract and persist missing field values at query time and consumes credits, so it is declared as a write.", "open_world_justification": "Answers only from the connected workspace's documents and extracted data; no public internet access.", "destructive_justification": "Adds cited answers and possibly new extracted values; nothing is deleted or overwritten." } },
"talonic_get_answer": { "annotations": { "readOnlyHint": true, "openWorldHint": false, "destructiveHint": false }, "justifications": { "read_only_justification": "Polls a previously started ask for its answer; nothing is created or changed.", "open_world_justification": "Reads the connected Talonic workspace only; no public internet access.", "destructive_justification": "Read-only poll; nothing is deleted or overwritten." } }
```

and to `test_cases`:

```json
{ "description": "Run the customer's configured Spec over documents already in the workspace and read the rows.", "user_prompt": "Run my Purchase Order pipeline on the two POs I uploaded yesterday and show me the resulting table.", "file_attachment_urls": null, "tools_triggered": "talonic_list_specs, talonic_get_spec, talonic_search, talonic_run_spec, talonic_get_run, talonic_get_run_results", "expected_output": "Shows the Specs card, resolves the documents, starts the run (run-started card), polls progress (run-progress card) until completed, then shows the results table card with one row per document.", "expected_output_url": null },
{ "description": "Ask a cited question over the workspace and poll if it takes long.", "user_prompt": "Which vendors invoiced us more than once in April, and what were the totals?", "file_attachment_urls": null, "tools_triggered": "talonic_ask, talonic_get_answer", "expected_output": "Shows the answer card with the verification verdict, the vendor list with totals, and citations into the source invoices; if the first call returns processing, polls with talonic_get_answer.", "expected_output_url": null }
```

Validate: `node -e "JSON.parse(require('fs').readFileSync('chatgpt-app-submission.json','utf8'))"`.

- [ ] **Step 5: Preflight constant + test.** In `scripts/chatgpt-preflight.mjs` set `const EXPECTED_TOOLS = 29` and change the final OK line to `` `PREFLIGHT OK — ChatGPT will see ${EXPECTED_TOOLS} tools, each with a fetchable widget template.` ``. Create `tests/scripts/preflight-constant.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { TOOL_WIDGET_KEYS } from "../../src/widgets/types"

describe("chatgpt-preflight expects every public tool", () => {
  it("EXPECTED_TOOLS equals the size of TOOL_WIDGET_KEYS", () => {
    const src = readFileSync(new URL("../../scripts/chatgpt-preflight.mjs", import.meta.url), "utf8")
    const m = src.match(/const EXPECTED_TOOLS = (\d+)/)
    expect(m, "EXPECTED_TOOLS constant not found").not.toBeNull()
    expect(Number(m![1])).toBe(Object.keys(TOOL_WIDGET_KEYS).length)
  })
})
```

- [ ] **Step 6: Full verification** — `npm run typecheck && npm run format && npm test && npm run build && npm run preflight:chatgpt` → all green; preflight prints `PREFLIGHT OK — ChatGPT will see 29 tools, each with a fetchable widget template.`

- [ ] **Step 7: Commit(s)** — e.g.

```bash
git add src/widgets/*.ts tests/widgets/fixtures/list-specs.json tests/widgets/fixtures/get-spec.json tests/widgets/fixtures/run-*.json tests/widgets/fixtures/answer.json tests/widgets/render/spec-*.test.ts tests/widgets/render/run-*.test.ts tests/widgets/render/answer.test.ts tests/widgets/widget-registry.test.ts tests/widgets/xss.test.ts
git commit -m "feat(widgets): Spec list/card, run started/progress/results, and cited-answer widgets (29/29)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git add src/tools/specs.ts src/tools/run.ts src/tools/ask.ts src/server-factory.ts tests/tools/descriptions.test.ts tests/widgets/tool-annotations.test.ts chatgpt-app-submission.json scripts/chatgpt-preflight.mjs tests/scripts/preflight-constant.test.ts
git commit -m "feat(tools): register Specs/Run/Ask tools with widget meta; locks, manifest and preflight at 29 [skip docs]

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Docs on both surfaces + content lock

**Files:**
- Modify: `src/content/sections/tools.ts` (+7 sections), `src/content/seo.ts` (+7 nav entries), `docs/sections.json` (+7 entries, intro counts 22 → 29)
- Create: `tests/content/tool-sections.test.ts`

- [ ] **Step 1: Failing content lock** — `tests/content/tool-sections.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sections } from "../../src/content/sections/tools"
import { MCP_NAV_SECTIONS } from "../../src/content/seo"
import { TOOL_WIDGET_KEYS } from "../../src/widgets/types"

const TOOLS = Object.keys(TOOL_WIDGET_KEYS)
const slugOf = (tool: string) => tool.replace(/_/g, "-")
const navIds = new Set((MCP_NAV_SECTIONS.find((s) => s.id === "tools")?.children ?? []).map((c) => c.id))
const mirror = JSON.parse(readFileSync(new URL("../../docs/sections.json", import.meta.url), "utf8")) as Array<{ slug: string }>
const mirrorSlugs = new Set(mirror.map((m) => m.slug))

describe("every public tool is documented on both surfaces", () => {
  it.each(TOOLS)("%s has a live docs section, a nav entry, and a mirror entry", (tool) => {
    const slug = slugOf(tool)
    const section = sections.find((s) => s.slug === slug)
    expect(section, `src/content/sections/tools.ts lacks slug ${slug}`).toBeDefined()
    expect(section!.title).toBe(tool)
    expect(section!.content.length).toBeGreaterThan(3)
    expect(navIds.has(slug), `src/content/seo.ts nav lacks ${slug}`).toBe(true)
    expect(mirrorSlugs.has(`mcp-${slug}`), `docs/sections.json lacks mcp-${slug}`).toBe(true)
  })
})
```

Run → FAIL for the seven new tools AND (pre-existing drift) for `talonic_get_pricing`, `talonic_get_usage` and the five agent-task tools in `docs/sections.json`. **Ruling for the implementer:** fix the pre-existing seven mirror gaps in this task too (they are the same kind of entry and the test would otherwise have to carve out exceptions) — generate ALL 14 missing mirror entries with the script in Step 4.

- [ ] **Step 2: Seven live sections** — append to `sections` in `src/content/sections/tools.ts`, mirroring the `talonic-list-fields` section's shape. Content for each (paragraph → "When to use" list → "When not to use" list → Parameters param-table → Response shape param-table; `related`, one `faq`, `mentions`):

`talonic-list-specs`: paragraph "List the workspace's **Specs** — the configured pipelines an agent can run with `talonic_run_spec`. Each row carries the Spec `id`, `name`, the `schema_id` it materializes onto (a different id from the Spec's own), the published `version` and `materialized_version` (null when never published), `field_count`, `node_count` and timestamps."; use-when: "You need a `spec_id` to run the customer's pipeline.", "The user refers to 'our invoice pipeline' and you must find it.", "You want to see which Specs are published (`version` non-null) before running."; not-when: "You want ad-hoc extraction schemas — `talonic_list_schemas`.", "You want to discover fields — `talonic_list_fields` / `talonic_find_data`."; params: search (string), limit (number, default 20, max 100), cursor (string), order (string, asc|desc); response: data[].id, data[].name, data[].schema_id, data[].version, data[].materialized_version, data[].field_count, data[].node_count, pagination.next_cursor; related: talonic-get-spec, talonic-run-spec; faq: "Why does a Spec have both an id and a schema_id?" → "The Spec is the authoring document; running it materializes onto a schema, which has its own id. `talonic_run_spec` takes the Spec id."; mentions: "specs", "list specs", "pipelines", "configured pipeline", "spec id".

`talonic-get-spec`: paragraph on `nodes[]` vs `phases[]` (as in the tool description), `fields[]`, optional `versions[]`; use-when: explain a run, confirm published, map names→keys; not-when: listing (list_specs), running (run_spec); params: spec_id (string, required), include_versions (boolean); response: id, name, version, materialized_version, schema.id, nodes[].type, nodes[].name, phases[].number, phases[].type, phases[].name, fields[].name, versions[].version, versions[].is_materialized; related: talonic-list-specs, talonic-run-spec; faq "Why do nodes and phases differ?"; mentions: "spec structure", "rail", "phases", "compiled plan", "spec versions".

`talonic-run-spec`: paragraph describing the two inputs and the RunEnvelope; a `callout` (variant "info") "Documents not yet in the workspace: `talonic_request_upload` → poll `talonic_get_document` → `talonic_run_spec` with `document_ids`. Remote public files: `file_urls` (max 20)."; use-when; not-when (talonic_extract for ad-hoc); params: spec_id (required), document_ids (string[]), file_urls (string[]), name, pipeline_mode (new|append), batch_id, metadata (object); response: run_kind, run_id, pipeline_id, spec_id, status, raw_status, input_count, documents[], links; related: talonic-get-run, talonic-get-run-results, talonic-request-upload; faq "Does this cost credits?" → "Yes — each ingested document and each pipeline stage meters credits like a run started in the app; check `talonic_get_balance` first for large batches."; mentions: "run spec", "run pipeline", "execute pipeline", "file_urls", "document_ids", "pipeline_mode".

`talonic-get-run`: paragraph; use-when (poll 5–10 s); not-when; params: run_id, pipeline_id (exactly one); response: status, raw_status, progress.total_documents, progress.completed_documents, progress.error_documents, progress.phases[], documents[], error_message; related: talonic-run-spec, talonic-get-run-results; faq "How long does a run take?" → "Seconds per document for extraction, plus validation and assembly stages; poll every 5–10 seconds and stop on completed or failed."; mentions: "run status", "poll run", "pipeline progress", "run progress".

`talonic-get-run-results`: paragraph on columns + rows, held cells serialize null, `include`; params: run_id, pipeline_id, document_id, include (string[]: cells|provenance), limit (max 200), cursor; response: columns[].field_key, columns[].display_name, columns[].data_type, data[].document_id, data[].filename, data[].status, data[].fields, pagination, pending_review_count; related: talonic-get-run, talonic-field-values; faq "Why is a value null?" → "Held (pending review) cells serialize as null until a reviewer approves them; `pending_review_count` tells you how many are held on the page."; mentions: "run results", "pipeline results", "structured rows", "columns", "pending review".

`talonic-ask`: paragraph (cited, verified answer; credits; bounded wait); callout (variant "warning") "Costs credits. For a known field's values use `talonic_field_values` or `talonic_filter` — they are free."; params: question (required), scope (object), conversation_id, output_format (object), wait_seconds (number, default 45, max 55); response: ask_id, status, conversation_id, answer, citations[].quote, citations[].document_id, citations[].filename, verification.verdict, usage.credits_charged, waited_ms; related: talonic-get-answer, talonic-find-data, talonic-field-values; faq "What if the answer is not ready in time?" → "The tool returns status `processing` with the `ask_id`; call `talonic_get_answer` with it a few seconds later. Passing `conversation_id` lets follow-up questions see earlier turns."; mentions: "ask", "question answering", "RAG", "cited answer", "verification", "conversation".

`talonic-get-answer`: short paragraph; params: ask_id (required); response: same as ask + poll_hint; related: talonic-ask; faq "How often should I poll?" → "Every 2–5 seconds; most asks complete within a minute."; mentions: "get answer", "poll ask", "answer status".

- [ ] **Step 3: Nav** — in `src/content/seo.ts` append to the `tools` children:

```ts
      { id: "talonic-list-specs", label: "talonic_list_specs" },
      { id: "talonic-get-spec", label: "talonic_get_spec" },
      { id: "talonic-run-spec", label: "talonic_run_spec" },
      { id: "talonic-get-run", label: "talonic_get_run" },
      { id: "talonic-get-run-results", label: "talonic_get_run_results" },
      { id: "talonic-ask", label: "talonic_ask" },
      { id: "talonic-get-answer", label: "talonic_get_answer" },
```

- [ ] **Step 4: Mirror (`docs/sections.json`)** — generate the missing `mcp-*` entries from the live sections instead of hand-copying. Run `npm run build` first (so `dist/content.js` is current), then:

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs"
import { getAllMcpSections } from "./dist/content.js"
const sections = getAllMcpSections().map(({ breadcrumbs, prev, next, ...rest }) => rest)
const path = "docs/sections.json"
const mirror = JSON.parse(readFileSync(path, "utf8"))
const have = new Set(mirror.map((m) => m.slug))
const rename = (s) => `mcp-${s}`
let added = 0
for (const s of sections.filter((x) => x.parentSlug === "tools")) {
  const slug = `mcp-${s.slug}`
  if (have.has(slug)) continue
  mirror.push({
    slug, parentSlug: "mcp-tools", title: s.title, seoTitle: s.seoTitle, description: s.description,
    content: s.content, related: s.related.map((r) => ({ label: r.label, slug: rename(r.slug) })), faq: s.faq, mentions: s.mentions,
  })
  added++
}
for (const m of mirror) {
  if (m.slug === "mcp-introduction") {
    m.description = m.description.replace(/twenty-two/gi, "twenty-nine")
    for (const b of m.content) if (b.text) b.text = b.text.replace(/twenty-two/gi, "twenty-nine")
  }
}
writeFileSync(path, JSON.stringify(mirror, null, 2) + "\n")
console.log("added", added, "entries; total", mirror.length)
'
```

(`dist/content.js` exports `getAllMcpSections()`, not a raw `sections` array; the destructuring above drops the derived `breadcrumbs`/`prev`/`next` fields.) Expected: `added 14` (7 new + 7 pre-existing gaps), total 43. Re-run `node -e "JSON.parse(...)"` to validate.

- [ ] **Step 5: Run** — `npx vitest run tests/content/tool-sections.test.ts` → PASS (29). `npm run typecheck && npm run format && npm test` → green.

- [ ] **Step 6: Commit** (real doc content change — NO `[skip docs]`):

```bash
git add src/content/sections/tools.ts src/content/seo.ts docs/sections.json tests/content/tool-sections.test.ts
git commit -m "docs(mcp): document the Specs, Run and Ask tools on both surfaces; mirror catches up to all 29 tools; content lock test

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Website tool pages and registries (repo `/Users/macman/Talonic/website`, local commit only)

**Files (website repo):**
- Create: `src/app/docs/mcp/tools/{list-specs,get-spec,run-spec,get-run,get-run-results,ask,get-answer}/page.tsx`
- Modify: `src/lib/docs-nav-routes.ts`, `src/lib/docs-sync.ts`, `next.config.ts`, `src/app/sitemap.ts`, `src/app/.well-known/mcp.json/route.ts`, `src/app/docs/mcp/page.tsx`

- [ ] **Step 1: Sync state** — `cd /Users/macman/Talonic/website && git fetch && git status -sb` (expect `main...origin/main` even; a dirty `CLAUDE.md` and untracked `.superpowers-*.md` files pre-exist — leave them alone and never stage them).

- [ ] **Step 2: Seven pages** — for each `<short>` ∈ {list-specs, get-spec, run-spec, get-run, get-run-results, ask, get-answer} create `src/app/docs/mcp/tools/<short>/page.tsx`:

```tsx
import { mcpPageMeta } from '@/lib/docs-helpers'
import { DocsPage, DocsH1, DocsBreadcrumbs } from '@/components/docs/DocsPage'
import McpContentPage from '../../McpContentPage'

const page = mcpPageMeta('tools/<short>')
export const metadata = page.metadata

export default function Page() {
  return (
    <DocsPage jsonLd={page.jsonLd}>
      <DocsBreadcrumbs items={page.breadcrumbs} />
      <DocsH1>{page.title}</DocsH1>
      <McpContentPage slug="talonic-<short>" />
    </DocsPage>
  )
}
```

- [ ] **Step 3: Registries** — append after the `talonic-submit-agent-task` lines:

`src/lib/docs-nav-routes.ts` (`MCP_ROUTES`):
```ts
  'talonic-list-specs': '/docs/mcp/tools/list-specs',
  'talonic-get-spec': '/docs/mcp/tools/get-spec',
  'talonic-run-spec': '/docs/mcp/tools/run-spec',
  'talonic-get-run': '/docs/mcp/tools/get-run',
  'talonic-get-run-results': '/docs/mcp/tools/get-run-results',
  'talonic-ask': '/docs/mcp/tools/ask',
  'talonic-get-answer': '/docs/mcp/tools/get-answer',
```

`src/lib/docs-sync.ts` (`MCP_PAGE_MAP`):
```ts
  'tools/list-specs': { section: 'tools', title: 'talonic_list_specs', mentions: ['specs', 'list specs', 'configured pipeline', 'spec id'] },
  'tools/get-spec': { section: 'tools', title: 'talonic_get_spec', mentions: ['spec structure', 'rail', 'phases', 'compiled plan', 'spec versions'] },
  'tools/run-spec': { section: 'tools', title: 'talonic_run_spec', mentions: ['run spec', 'run pipeline', 'execute pipeline', 'file_urls', 'document_ids'] },
  'tools/get-run': { section: 'tools', title: 'talonic_get_run', mentions: ['run status', 'poll run', 'pipeline progress'] },
  'tools/get-run-results': { section: 'tools', title: 'talonic_get_run_results', mentions: ['run results', 'structured rows', 'columns', 'pending review'] },
  'tools/ask': { section: 'tools', title: 'talonic_ask', mentions: ['ask', 'question answering', 'cited answer', 'verification', 'RAG'] },
  'tools/get-answer': { section: 'tools', title: 'talonic_get_answer', mentions: ['get answer', 'poll ask', 'answer status'] },
```
and in `MCP_SECTIONS` change the `tools` description's "Twenty-two MCP tools" to "Twenty-nine MCP tools" and add ", Spec runs and cited question answering" before the closing period if the sentence enumerates capabilities.

`next.config.ts` (redirects, after the `talonic-submit-agent-task` line):
```ts
      { source: '/docs/mcp/talonic-list-specs',        destination: '/docs/mcp/tools/list-specs',        permanent: true },
      { source: '/docs/mcp/talonic-get-spec',          destination: '/docs/mcp/tools/get-spec',          permanent: true },
      { source: '/docs/mcp/talonic-run-spec',          destination: '/docs/mcp/tools/run-spec',          permanent: true },
      { source: '/docs/mcp/talonic-get-run',           destination: '/docs/mcp/tools/get-run',           permanent: true },
      { source: '/docs/mcp/talonic-get-run-results',   destination: '/docs/mcp/tools/get-run-results',   permanent: true },
      { source: '/docs/mcp/talonic-ask',               destination: '/docs/mcp/tools/ask',               permanent: true },
      { source: '/docs/mcp/talonic-get-answer',        destination: '/docs/mcp/tools/get-answer',        permanent: true },
```

`src/app/sitemap.ts` (after the `submit-agent-task` line):
```ts
    { url: `${BASE}/docs/mcp/tools/list-specs`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/docs/mcp/tools/get-spec`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/docs/mcp/tools/run-spec`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/docs/mcp/tools/get-run`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/docs/mcp/tools/get-run-results`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/docs/mcp/tools/ask`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/docs/mcp/tools/get-answer`, changeFrequency: 'monthly', priority: 0.6 },
```

`src/app/.well-known/mcp.json/route.ts` (`tools` array, after `talonic_submit_agent_task`):
```ts
    { name: 'talonic_list_specs', description: 'List the workspace\'s Specs — the configured pipelines an agent can run.' },
    { name: 'talonic_get_spec', description: 'One Spec\'s structure: rail stages, compiled phases, fields and published versions.' },
    { name: 'talonic_run_spec', description: 'Run a Spec pipeline over workspace documents or public file URLs; returns a poll-able run.' },
    { name: 'talonic_get_run', description: 'Poll a Spec run: normalised status plus document and phase progress.' },
    { name: 'talonic_get_run_results', description: 'Read a Spec run\'s structured rows — one row per document with the Spec\'s fields.' },
    { name: 'talonic_ask', description: 'Ask a natural-language question over the workspace and get a cited, verified answer.' },
    { name: 'talonic_get_answer', description: 'Poll an ask started by talonic_ask that was still processing.' },
```

`src/app/docs/mcp/page.tsx` — add two `DocsRelated` cards after the `list-agent-tasks` card:
```tsx
        { href: '/docs/mcp/tools/run-spec', title: 'talonic_run_spec', description: 'Run the customer\'s configured Spec pipeline over documents or file URLs, then poll and read the rows.' },
        { href: '/docs/mcp/tools/ask', title: 'talonic_ask', description: 'Ask a natural-language question over the workspace and get a cited, verified answer.' },
```

- [ ] **Step 4: Verify** — `npx tsc --noEmit -p . 2>&1 | tail -3` (or the repo's typecheck script if `package.json` has one) → clean; `grep -c "talonic-" src/lib/docs-nav-routes.ts` shows the 7 new routes; `node -e "require('./next.config.ts')"` is not runnable — instead `npx tsc --noEmit` covers `next.config.ts`. Do NOT run `npm run build` (15 GB).

- [ ] **Step 5: Commit** (website repo, local only, explicit paths):

```bash
git add src/app/docs/mcp/tools/list-specs src/app/docs/mcp/tools/get-spec src/app/docs/mcp/tools/run-spec src/app/docs/mcp/tools/get-run src/app/docs/mcp/tools/get-run-results src/app/docs/mcp/tools/ask src/app/docs/mcp/tools/get-answer src/lib/docs-nav-routes.ts src/lib/docs-sync.ts next.config.ts src/app/sitemap.ts src/app/.well-known/mcp.json/route.ts src/app/docs/mcp/page.tsx
git commit -m "docs(mcp): wire the seven Specs/Run/Ask tool pages, registries, sitemap and mcp.json (29 tools)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Note: the pages render content from `@talonic/mcp/content` at the version installed in the website's `node_modules`; they will show real content only after `@talonic/mcp` 0.1.77+ publishes and the website's `update-docs.yml` bumps it. That is the normal pipeline (docs-pipeline.md) — record it in the report.

---

### Task 11: Repo docs, live production smoke, final verification

**Files:**
- Modify: `AGENTS.md` (heading "The twenty-nine public tools", +7 table rows, counts "22 read-only… 7 write" → recount: 20 read-only lookup tools, 9 write-capable), `README.md` (counts 22 → 29; "What you get" table +7 rows), `CHANGELOG.md` (Unreleased `### Added` bullets)
- Create: `scripts/live-smoke.mjs`; `package.json` script `"smoke:live": "node scripts/live-smoke.mjs"`

- [ ] **Step 1: Docs.** `AGENTS.md`: retitle the tools section, add seven rows (File `specs.ts` / `run.ts` / `ask.ts`; Read-only yes/no per the annotations; one-line notes), update the annotations sentence to "(20 read-only lookup tools, 9 write-capable)" and "(…, 29/29)". `README.md`: every "twenty-two"/"22" tool count → "twenty-nine"/"29"; add seven rows to the "What you get" table. `CHANGELOG.md` `## [Unreleased]` → `### Added`, prepend:

```md
- **Specs, Run and Ask tools (7 new, 29 public).** `talonic_list_specs` / `talonic_get_spec` read the workspace's configured pipelines; `talonic_run_spec` runs one over `document_ids` (`POST /v1/pipelines`) or `file_urls` (`POST /v1/run`) behind a single normalised RunEnvelope; `talonic_get_run` polls status + progress and `talonic_get_run_results` reads the rows; `talonic_ask` answers questions over the corpus with citations and verification (bounded wait) and `talonic_get_answer` polls long asks. Each has a ChatGPT card; documented on both docs surfaces; manifest and preflight at 29.
```

- [ ] **Step 2: Live smoke script** — `scripts/live-smoke.mjs` (dev-only; **spends a small amount of credits**; requires `TALONIC_API_KEY` in the env). It boots `dist/http-server.js` on a free port exactly like `chatgpt-preflight.mjs` (copy its `port`/spawn/health/`rpc`/shutdown code), then calls tools over JSON-RPC with the real bearer:

1. `talonic_list_specs` `{ limit: 10 }` → pick the first Spec with `version != null` and the smallest `field_count`; print name/id.
2. `talonic_get_spec` `{ spec_id, include_versions: true }` → print node types and phase count.
3. Find a document: raw `GET ${TALONIC_BASE_URL ?? "https://api.talonic.com"}/v1/documents?limit=1&status=completed` with the bearer → `document_id` (fail clearly if none).
4. `talonic_run_spec` `{ spec_id, document_ids: [document_id], name: "mcp live smoke" }` → print the RunEnvelope; then poll `talonic_get_run` `{ pipeline_id }` every 5 s up to 10 minutes until `status !== "processing"`; print the final status and progress.
5. `talonic_get_run_results` `{ pipeline_id, limit: 5 }` → print `columns.length`, `data.length`, `pending_review_count`.
6. `talonic_ask` `{ question: "What is the total amount on this document?", scope: { document_ids: [document_id] }, wait_seconds: 50 }`; if `processing`, poll `talonic_get_answer` up to 2 minutes; print `status`, `verification.verdict`, `usage.credits_charged`, first 200 chars of `answer`.
7. Exit 0 with a summary line `LIVE SMOKE OK — spec <name>, pipeline <id> <status>, rows <n>, ask <status> (<credits> credits)`; non-zero with the failing step otherwise; always kill the child.

Add `"smoke:live": "node scripts/live-smoke.mjs"` to `package.json`.

- [ ] **Step 3: Run the smoke against production** — `npm run build && TALONIC_API_KEY=$(python3 -c "import json;d=json.load(open('/Users/macman/.claude.json'));print(d['mcpServers']['talonic']['env']['TALONIC_API_KEY'])") npm run smoke:live`. Paste the full output in the report (ids, status, credits). If the run fails on the platform side (e.g. the chosen Spec has no composed rail → 400), pick the next Spec and retry once; report what happened either way. Never modify tool code to make the smoke pass without reporting the defect.

- [ ] **Step 4: Final verification** — `npm run typecheck && npm run format:check && npm test && npm run build && npm run preflight:chatgpt` → all green; report test totals. `git status --short` → only intended files.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md README.md CHANGELOG.md scripts/live-smoke.mjs package.json
git commit -m "docs+chore: 29-tool counts, changelog for Specs/Run/Ask, live production smoke script

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

**Do not push** either repo. Report: commits (both repos), test totals, preflight line, live smoke summary with credits spent, and anything the smoke revealed about the API.
