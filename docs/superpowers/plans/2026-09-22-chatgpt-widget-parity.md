# ChatGPT Widget Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every one of the 22 public `talonic_*` tools renders a branded ChatGPT Apps SDK widget, every tool and widget carries the Apps SDK status/description metadata, the raw-fetch tools carry the client surface tag, and the ChatGPT submission collateral describes the real 22-tool server — all locked by tests.

**Architecture:** Widgets are self-contained HTML documents produced by `buildWidgetHtml()` (`src/widgets/shared.ts`) from a per-widget `RENDER_BODY` JS string; they read `window.openai.toolOutput` and render into `#root`. A single registry (`src/widgets/types.ts` for URIs/descriptions/status strings, `src/widgets/register.ts` for the HTML table) drives resource registration, the hosted server's unauthenticated template fast path, and the tests. Tools opt in by `_meta: widgetToolMeta("<key>")`. Render tests execute each template in jsdom with fixture payloads.

**Tech Stack:** TypeScript (strict, ESM, `.js` import suffixes), `@modelcontextprotocol/sdk` `McpServer`, zod, vitest 3, prettier, tsup. New dev dependency: `jsdom`.

**Spec:** `docs/superpowers/specs/2026-09-22-chatgpt-widget-parity-design.md`

## Global Constraints

- **Never `git push`.** A push to `main` is a release (npm + Registry + redeploy). Commit locally on `main`; Hamlet gives the go for the push separately.
- Commits that touch `src/tools/**`, `src/http-server.ts` or `src/server-factory.ts` without a user-visible doc change MUST carry `[skip docs]` in the commit message (docs-drift guard), because these changes are metadata/telemetry only.
- Widget templates: no external scripts, styles, fonts or network (CSP stays `connectDomains: []`); no `tlnc_` strings; no `Authorization`; no backticks and no `${` inside any `RENDER_BODY`/helper JS string (they live inside TS template literals — use `'…' + x + '…'` concatenation only).
- Status strings (`openai/toolInvocation/*`) ≤ 64 characters. Widget isolation domain stays `https://talonic.com`.
- Fixtures under `tests/widgets/fixtures/` use generic names/ids only (`invoice-0421.pdf`, `11111111-…`), never customer filenames or real workspace ids.
- Before every commit in a task: `npm test` (whole suite) green, `npm run typecheck` green, `npm run format` applied (`format:check` green).
- Commit trailer on every commit: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Prettier config is the repo's (`printWidth` as configured; run `npm run format`, never hand-wrap).

## File structure

| File | Responsibility |
| --- | --- |
| `src/widgets/types.ts` | Widget keys/URIs (22), tool→widget key map, model-facing widget descriptions, invocation status strings, `widgetToolMeta()`, `widgetKeyForUri()` |
| `src/widgets/shared.ts` | Base CSS, helper JS (existing + `chip`, `clamp`, `shortId`, `idChip`, `relTime`, `dataTable`, `kvTiles`, `jsonTree`, `isFlat`, `isRowArray`), `widgetMeta(description?)`, `buildWidgetHtml`, `registerWidget` |
| `src/widgets/register.ts` | `WIDGET_REGISTRY` table (22 entries), `getWidgetTemplateHtml`, `getWidgetTemplateMeta`, `registerWidgets`, `registerExtractionResultWidget` |
| `src/widgets/field-list.ts`, `field-card.ts`, `field-values.ts`, `find-data.ts`, `agent-tools.ts`, `agent-tool-result.ts`, `agent-task-shared.ts`, `agent-task-list.ts`, `agent-task.ts`, `agent-task-lease.ts`, `agent-task-submitted.ts` | One widget (or shared task JS) each |
| `src/tools/_http.ts` | `TokenSource`, `withFetch`, `resolveFetch`; `apiJson` uses the resolved fetch |
| `tests/widgets/render/harness.ts` | jsdom render harness + fixture loader |
| `tests/widgets/render/*.test.ts` | Per-widget render tests (realistic / empty / malformed) |
| `tests/widgets/fixtures/*.json` | Synthetic payloads mirroring live API shapes |
| `tests/widgets/widget-registry.test.ts`, `shared-helpers.test.ts`, `template-hygiene.test.ts`, `tests/submission-manifest.test.ts` | New locks |
| `scripts/chatgpt-preflight.mjs` | Boots `dist/http-server.js`, checks tools/list + every template like ChatGPT does |

---

### Task 1: Widget registry types and tool meta helper

**Files:**
- Modify: `src/widgets/types.ts` (replace whole file)
- Test: `tests/widgets/widget-registry.test.ts` (new)

**Interfaces:**
- Produces: `WIDGET_URIS` (22 keys), `type WidgetKey`, `TOOL_WIDGET_KEYS: Record<string, WidgetKey>`, `TOOL_INVOCATION_STATUS: Record<WidgetKey, {invoking, invoked}>`, `WIDGET_DESCRIPTIONS: Record<WidgetKey, string>`, `widgetToolMeta(key: WidgetKey): Record<string, unknown>`, `widgetKeyForUri(uri: string): WidgetKey | undefined`. Back-compat exports `WIDGET_MIME`, `EXTRACTION_RESULT_WIDGET_MIME`, `EXTRACTION_RESULT_WIDGET_URI` stay.

- [ ] **Step 1: Write the failing test**

Create `tests/widgets/widget-registry.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  TOOL_INVOCATION_STATUS,
  TOOL_WIDGET_KEYS,
  WIDGET_DESCRIPTIONS,
  WIDGET_URIS,
  widgetKeyForUri,
  widgetToolMeta,
} from "../../src/widgets/types"

const KEYS = Object.keys(WIDGET_URIS) as Array<keyof typeof WIDGET_URIS>

describe("widget registry tables", () => {
  it("defines exactly 22 widgets with unique ui://widget/ URIs", () => {
    expect(KEYS).toHaveLength(22)
    const uris = Object.values(WIDGET_URIS)
    expect(new Set(uris).size).toBe(22)
    for (const uri of uris) expect(uri).toMatch(/^ui:\/\/widget\/[a-z-]+\.html$/)
  })

  it("maps every public tool to a widget key, one tool per widget", () => {
    const tools = Object.keys(TOOL_WIDGET_KEYS)
    expect(tools).toHaveLength(22)
    for (const t of tools) expect(t).toMatch(/^talonic_[a-z_]+$/)
    expect(new Set(Object.values(TOOL_WIDGET_KEYS)).size).toBe(22)
    for (const key of Object.values(TOOL_WIDGET_KEYS)) expect(KEYS).toContain(key)
  })

  it("has invocation status strings and a description for every widget", () => {
    for (const key of KEYS) {
      const s = TOOL_INVOCATION_STATUS[key]
      expect(s.invoking.length, `${key}.invoking`).toBeGreaterThan(0)
      expect(s.invoking.length, `${key}.invoking`).toBeLessThanOrEqual(64)
      expect(s.invoked.length, `${key}.invoked`).toBeGreaterThan(0)
      expect(s.invoked.length, `${key}.invoked`).toBeLessThanOrEqual(64)
      expect(WIDGET_DESCRIPTIONS[key].length, `${key}.description`).toBeGreaterThan(20)
    }
  })

  it("widgetToolMeta emits the ui + openai aliases and both status strings", () => {
    const meta = widgetToolMeta("getBalance") as any
    expect(meta.ui.resourceUri).toBe(WIDGET_URIS.getBalance)
    expect(meta["openai/outputTemplate"]).toBe(WIDGET_URIS.getBalance)
    expect(meta["openai/toolInvocation/invoking"]).toBe(TOOL_INVOCATION_STATUS.getBalance.invoking)
    expect(meta["openai/toolInvocation/invoked"]).toBe(TOOL_INVOCATION_STATUS.getBalance.invoked)
  })

  it("widgetKeyForUri round-trips every URI and rejects unknown ones", () => {
    for (const key of KEYS) expect(widgetKeyForUri(WIDGET_URIS[key])).toBe(key)
    expect(widgetKeyForUri("ui://widget/does-not-exist.html")).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/widgets/widget-registry.test.ts`
Expected: FAIL — `TOOL_WIDGET_KEYS` / `widgetToolMeta` are not exported (import error).

- [ ] **Step 3: Replace `src/widgets/types.ts`**

```ts
/**
 * MIME type for Apps SDK widget resources. The `profile=mcp-app` parameter
 * tells the host this is a renderable widget, not arbitrary HTML.
 *
 * @public
 */
export const WIDGET_MIME = "text/html;profile=mcp-app"

/**
 * Back-compat alias. Prefer {@link WIDGET_MIME}.
 *
 * @public
 */
export const EXTRACTION_RESULT_WIDGET_MIME = WIDGET_MIME

/**
 * Widget resource URIs, one per public tool. A tool opts into its widget by
 * declaring `_meta` via {@link widgetToolMeta} in its `registerTool` config.
 *
 * @public
 */
export const WIDGET_URIS = {
  extract: "ui://widget/extraction-result.html",
  search: "ui://widget/search-results.html",
  filter: "ui://widget/filter-results.html",
  getDocument: "ui://widget/document-meta.html",
  toMarkdown: "ui://widget/markdown-view.html",
  listSchemas: "ui://widget/schema-list.html",
  saveSchema: "ui://widget/schema-saved.html",
  getBalance: "ui://widget/balance.html",
  getPricing: "ui://widget/pricing.html",
  getUsage: "ui://widget/usage.html",
  requestUpload: "ui://widget/upload-link.html",
  listFields: "ui://widget/field-list.html",
  getField: "ui://widget/field-card.html",
  fieldValues: "ui://widget/field-values.html",
  findData: "ui://widget/find-data.html",
  listAgentTools: "ui://widget/agent-tools.html",
  invokeAgentTool: "ui://widget/agent-tool-result.html",
  listAgentTasks: "ui://widget/agent-task-list.html",
  getAgentTask: "ui://widget/agent-task.html",
  claimAgentTask: "ui://widget/agent-task-claim.html",
  heartbeatAgentTask: "ui://widget/agent-task-heartbeat.html",
  submitAgentTask: "ui://widget/agent-task-submitted.html",
} as const

/** A key of {@link WIDGET_URIS}. @public */
export type WidgetKey = keyof typeof WIDGET_URIS

/**
 * Back-compat alias for the extraction-result widget URI. Prefer
 * {@link WIDGET_URIS}.extract.
 *
 * @public
 */
export const EXTRACTION_RESULT_WIDGET_URI = WIDGET_URIS.extract

/**
 * Public tool name → widget key. This is the single source of truth for
 * "which card does this tool render"; tests derive the 22-tool lock from it.
 * Talonic-internal tools (`talonic_growth_*`, `talonic_admin_*`) have no
 * widget and are deliberately absent.
 *
 * @public
 */
export const TOOL_WIDGET_KEYS: Readonly<Record<string, WidgetKey>> = {
  talonic_extract: "extract",
  talonic_search: "search",
  talonic_filter: "filter",
  talonic_get_document: "getDocument",
  talonic_to_markdown: "toMarkdown",
  talonic_list_schemas: "listSchemas",
  talonic_save_schema: "saveSchema",
  talonic_get_balance: "getBalance",
  talonic_get_pricing: "getPricing",
  talonic_get_usage: "getUsage",
  talonic_request_upload: "requestUpload",
  talonic_list_fields: "listFields",
  talonic_get_field: "getField",
  talonic_field_values: "fieldValues",
  talonic_find_data: "findData",
  talonic_list_agent_tools: "listAgentTools",
  talonic_invoke_agent_tool: "invokeAgentTool",
  talonic_list_agent_tasks: "listAgentTasks",
  talonic_get_agent_task: "getAgentTask",
  talonic_claim_agent_task: "claimAgentTask",
  talonic_heartbeat_agent_task: "heartbeatAgentTask",
  talonic_submit_agent_task: "submitAgentTask",
}

/** Status text ChatGPT shows while a tool runs and once it has finished. @public */
export interface ToolInvocationStatus {
  /** Shown during the call. ≤ 64 characters. */
  invoking: string
  /** Shown after the call completes. ≤ 64 characters. */
  invoked: string
}

/**
 * `openai/toolInvocation/*` strings per widget. Kept short and factual: they
 * appear inline in the ChatGPT transcript above the card.
 *
 * @public
 */
export const TOOL_INVOCATION_STATUS: Readonly<Record<WidgetKey, ToolInvocationStatus>> = {
  extract: { invoking: "Extracting structured data…", invoked: "Extraction complete" },
  search: { invoking: "Searching the workspace…", invoked: "Search results ready" },
  filter: { invoking: "Filtering documents by field values…", invoked: "Filter results ready" },
  getDocument: { invoking: "Fetching document details…", invoked: "Document details ready" },
  toMarkdown: { invoking: "Converting document to markdown…", invoked: "Markdown ready" },
  listSchemas: { invoking: "Loading saved schemas…", invoked: "Schemas listed" },
  saveSchema: { invoking: "Saving schema…", invoked: "Schema saved" },
  getBalance: { invoking: "Checking credit balance…", invoked: "Balance ready" },
  getPricing: { invoking: "Loading pricing catalog…", invoked: "Pricing ready" },
  getUsage: { invoking: "Loading usage breakdown…", invoked: "Usage ready" },
  requestUpload: { invoking: "Preparing upload link…", invoked: "Upload link ready" },
  listFields: { invoking: "Loading the Field Registry…", invoked: "Fields listed" },
  getField: { invoking: "Loading field concept card…", invoked: "Field card ready" },
  fieldValues: { invoking: "Reading field values across documents…", invoked: "Field values ready" },
  findData: { invoking: "Locating data behind the concept…", invoked: "Matching data found" },
  listAgentTools: { invoking: "Listing platform agent tools…", invoked: "Agent tools listed" },
  invokeAgentTool: { invoking: "Running platform agent tool…", invoked: "Agent tool result ready" },
  listAgentTasks: { invoking: "Loading agent task worklist…", invoked: "Agent tasks listed" },
  getAgentTask: { invoking: "Loading agent task…", invoked: "Agent task ready" },
  claimAgentTask: { invoking: "Claiming agent task…", invoked: "Agent task claimed" },
  heartbeatAgentTask: { invoking: "Extending task lease…", invoked: "Lease extended" },
  submitAgentTask: { invoking: "Submitting task outputs…", invoked: "Task submitted" },
}

/**
 * Model-facing one-sentence summary of what each card shows. Emitted as
 * `_meta["openai/widgetDescription"]` on the widget resource so the model
 * knows what the user is looking at without re-reading the payload.
 *
 * @public
 */
export const WIDGET_DESCRIPTIONS: Readonly<Record<WidgetKey, string>> = {
  extract:
    "Card showing the extracted fields with per-field confidence, the source document, and the credit cost of the extraction.",
  search:
    "Card listing the documents, fields, schemas and sources that matched the query, grouped by type.",
  filter:
    "Table of documents whose extracted field values matched the filter, plus any API warnings about field types.",
  getDocument:
    "Card with one document's metadata, processing status, and triage flags.",
  toMarkdown: "Scrollable view of a document's OCR-converted markdown text.",
  listSchemas: "Table of the workspace's saved extraction schemas with their field counts.",
  saveSchema: "Confirmation card for a newly saved reusable schema.",
  getBalance:
    "Card with the workspace credit balance, EUR value, tier, 30-day burn and projected runway.",
  getPricing:
    "Table of Talonic's per-unit credit pricing with EUR values, free-tier badges and multipliers.",
  getUsage: "Breakdown of credits consumed per function over the trailing window, with proportion bars.",
  requestUpload:
    "Card with the browser upload link the user must open to add their file, plus the document id and expiry.",
  listFields:
    "Table of Field Registry concepts with data type, maturity (core, proven, candidate) and occurrence counts.",
  getField:
    "Concept card for one registry field: definition, synonyms, occurrence statistics, top values and schema usage.",
  fieldValues:
    "Table of one field's current values across documents with confidence and source-text provenance.",
  findData:
    "Ranked matches for a natural-language concept across four planes: fields, values, documents and passages.",
  listAgentTools:
    "Table of the platform agent tool registry with each tool's impact, capability and whether this key may invoke it.",
  invokeAgentTool:
    "Result of one platform agent tool call, rendered as a table, key-value tiles or a JSON tree, with citations.",
  listAgentTasks:
    "Worklist of Agent-stage tasks with status, document, lease expiry, timeout and execution epoch.",
  getAgentTask:
    "Card for one Agent-stage task: status, timing, instructions, declared output contract and the input snapshot.",
  claimAgentTask:
    "Lease card confirming the claim: execution epoch to keep, lease expiry, and the task's instructions and contract.",
  heartbeatAgentTask: "Lease card confirming the lease was extended, with the new expiry and execution epoch.",
  submitAgentTask:
    "Confirmation that the declared outputs were submitted and the parked document resumed its pipeline.",
}

/**
 * Build the `_meta` block a tool declares to opt into its widget: the modern
 * `ui.resourceUri` key, the `openai/outputTemplate` alias, and the two
 * `openai/toolInvocation/*` status strings.
 *
 * @public
 */
export function widgetToolMeta(key: WidgetKey): Record<string, unknown> {
  const uri = WIDGET_URIS[key]
  const status = TOOL_INVOCATION_STATUS[key]
  return {
    ui: { resourceUri: uri },
    "openai/outputTemplate": uri,
    "openai/toolInvocation/invoking": status.invoking,
    "openai/toolInvocation/invoked": status.invoked,
  }
}

/**
 * Reverse lookup: widget URI → key. Used by the hosted server's public
 * template fast path and by the registry.
 *
 * @public
 */
export function widgetKeyForUri(uri: string): WidgetKey | undefined {
  for (const key of Object.keys(WIDGET_URIS) as WidgetKey[]) {
    if (WIDGET_URIS[key] === uri) return key
  }
  return undefined
}
```

- [ ] **Step 4: Run test to verify it passes, then the whole suite**

Run: `npx vitest run tests/widgets/widget-registry.test.ts` → PASS (5 tests).
Run: `npm test` → all green (the existing `all-widgets.test.ts` still asserts 11 via `Object.values(WIDGET_URIS)` — **it now fails with 22 ≠ 11.** Temporarily accepting that is NOT allowed: edit `tests/widgets/all-widgets.test.ts` line `expect(widgetUris).toHaveLength(11)` → `toHaveLength(22)` and change the loop to only check the 11 URIs in `TOOL_WIDGET_MAP` for now:

```ts
describe("widget coverage is complete", () => {
  it("declares 22 widget URIs (resources are locked per tool above)", () => {
    expect(Object.values(WIDGET_URIS)).toHaveLength(22)
    const server = buildServer()
    for (const [, uri] of TOOL_WIDGET_MAP) {
      expect(server._registeredResources[uri], `missing widget ${uri}`).toBeDefined()
    }
  })
})
```
Task 8 replaces this block with the full 22-entry lock.)

Run: `npm run typecheck && npm run format && npm test` → green.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/types.ts tests/widgets/widget-registry.test.ts tests/widgets/all-widgets.test.ts
git commit -m "feat(widgets): registry tables for 22 widgets — URIs, tool map, descriptions, invocation status, widgetToolMeta()

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Shared render helpers, enriched widget meta, jsdom render harness

**Files:**
- Modify: `src/widgets/shared.ts` (`widgetMeta`, `BASE_CSS`, `HELPERS_JS`, `registerWidget`)
- Modify: `package.json` (devDependency `jsdom`)
- Create: `tests/widgets/render/harness.ts`
- Test: `tests/widgets/shared-helpers.test.ts` (new)

**Interfaces:**
- Produces (JS, inside every widget): `chip(text, tone)`, `clamp(text, n)`, `shortId(id)` → text, `idChip(id)` → HTML, `relTime(iso)`, `dataTable(rows, columns?)`, `kvTiles(obj)`, `jsonTree(value)`, `isFlat(obj)`, `isRowArray(v)`; CSS classes `.chip.good|.warn|.bad|.info`, `.plane`, `.tree-body`, `.node`, `details.tree`, `.num`.
- Produces (TS): `widgetMeta(description?: string)`; `registerWidget` unchanged signature but passes `opts.description` into `widgetMeta`.
- Produces (tests): `renderWidget(templateHtml, payload) → { window, document, text, html }`, `loadFixture(name)`.

- [ ] **Step 1: Add jsdom**

Run: `npm install --save-dev jsdom@^26`
Expected: `package.json` devDependencies gains `"jsdom": "^26.x"`; lockfile updated.

- [ ] **Step 2: Write the harness**

Create `tests/widgets/render/harness.ts`:

```ts
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

export interface Rendered {
  window: any
  document: Document
  /** Whitespace-normalised textContent of #root. */
  text: string
  /** innerHTML of #root. */
  html: string
}

/**
 * Load a widget template into jsdom, hand it `payload` the way the Apps SDK
 * does (`window.openai.toolOutput`), run its inline scripts, and return the
 * rendered root. Scripts run via `window.eval` so the template's own
 * `<script>` is executed exactly once, in window scope.
 */
export function renderWidget(templateHtml: string, payload: unknown): Rendered {
  const dom = new JSDOM(templateHtml, { runScripts: "outside-only", pretendToBeVisual: true })
  const win = dom.window as any
  win.openai = { toolOutput: payload }
  for (const script of Array.from(win.document.querySelectorAll("script"))) {
    win.eval((script as HTMLScriptElement).textContent ?? "")
  }
  const root = win.document.getElementById("root")
  return {
    window: win,
    document: win.document,
    text: (root?.textContent ?? "").replace(/\s+/g, " ").trim(),
    html: root?.innerHTML ?? "",
  }
}

/** Read `tests/widgets/fixtures/<name>.json`. */
export function loadFixture<T = any>(name: string): T {
  const url = new URL(`../fixtures/${name}.json`, import.meta.url)
  return JSON.parse(readFileSync(url, "utf8")) as T
}
```

- [ ] **Step 3: Write the failing helper test**

Create `tests/widgets/shared-helpers.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { buildWidgetHtml, widgetMeta } from "../../src/widgets/shared"
import { renderWidget } from "./render/harness"

// A probe widget that exercises every shared helper against the payload.
const PROBE = buildWidgetHtml({
  title: "probe",
  renderBody: `
    root.innerHTML = ''
      + '<div id="chips">' + chip("core", "good") + chip("", "bad") + chip(null, "warn") + '</div>'
      + '<div id="clamp">' + esc(clamp(payload.long, 6)) + '</div>'
      + '<div id="short">' + esc(shortId(payload.id)) + '</div>'
      + '<div id="idchip">' + idChip(payload.id) + '</div>'
      + '<div id="rel">' + esc(relTime(payload.future)) + '|' + esc(relTime(payload.past)) + '|' + esc(relTime(null)) + '|' + esc(relTime("garbage")) + '</div>'
      + '<div id="table">' + dataTable(payload.rows) + '</div>'
      + '<div id="tiles">' + kvTiles(payload.obj) + '</div>'
      + '<div id="tree">' + jsonTree(payload.tree) + '</div>'
      + '<div id="flags">' + isFlat(payload.obj) + '|' + isFlat(payload.tree) + '|' + isRowArray(payload.rows) + '|' + isRowArray([1,2]) + '</div>';
  `,
})

describe("shared widget helpers", () => {
  const now = Date.now()
  const r = renderWidget(PROBE, {
    long: "abcdefghijklmnop",
    id: "0123456789abcdef-0000",
    future: new Date(now + 5 * 60_000).toISOString(),
    past: new Date(now - 3 * 3600_000).toISOString(),
    rows: Array.from({ length: 60 }, (_, i) => ({ a: i, b: `row ${i}`, nested: { x: i } })),
    obj: { alpha: 1, beta: "two", gamma: null, delta: { deep: true } },
    tree: { level1: { level2: { level3: [1, 2, { level5: "leaf" }] } }, scalar: 42 },
  })
  const q = (sel: string) => r.document.querySelector(sel)!

  it("chip renders text with a tone and skips empty values", () => {
    expect(q("#chips").querySelectorAll(".chip")).toHaveLength(1)
    expect(q("#chips .chip").className).toBe("chip good")
    expect(q("#chips .chip").textContent).toBe("core")
  })

  it("clamp truncates with an ellipsis", () => {
    expect(q("#clamp").textContent).toBe("abcde…")
  })

  it("shortId/idChip show the first 8 chars and keep the full id in title", () => {
    expect(q("#short").textContent).toBe("01234567")
    expect(q("#idchip .mono").getAttribute("title")).toBe("0123456789abcdef-0000")
  })

  it("relTime handles future, past, missing and unparsable input", () => {
    expect(q("#rel").textContent).toBe("in 5m|3h ago|—|garbage")
  })

  it("dataTable caps rows at 50, columns at 12, and flattens nested cells", () => {
    expect(q("#table tbody").querySelectorAll("tr")).toHaveLength(50)
    expect(q("#table thead").textContent).toBe("abnested")
    expect(q("#table").textContent).toContain("+10 more rows")
    expect(q("#table tbody tr td:nth-child(3)").textContent).toBe('{"x":0}')
  })

  it("kvTiles renders one tile per key with — for null", () => {
    const tiles = q("#tiles").querySelectorAll(".kv")
    expect(tiles).toHaveLength(4)
    expect(tiles[2].textContent).toBe("gamma—")
    expect(tiles[3].textContent).toContain('{"deep":true}')
  })

  it("jsonTree renders nested details with the deepest leaf reachable", () => {
    expect(q("#tree").querySelectorAll("details.tree").length).toBeGreaterThanOrEqual(3)
    expect(q("#tree").textContent).toContain("leaf")
    expect(q("#tree").textContent).toContain("42")
  })

  it("isFlat / isRowArray classify shapes", () => {
    expect(q("#flags").textContent).toBe("false|false|true|false")
  })
})

describe("widgetMeta", () => {
  it("adds the model-facing description and prefers a bordered card", () => {
    const meta = widgetMeta("Shows a thing.") as any
    expect(meta["openai/widgetDescription"]).toBe("Shows a thing.")
    expect(meta["openai/widgetPrefersBorder"]).toBe(true)
    expect(meta["openai/widgetDomain"]).toBe("https://talonic.com")
    expect(meta.ui.csp.connectDomains).toEqual([])
  })

  it("omits the description key when none is given", () => {
    expect("openai/widgetDescription" in widgetMeta()).toBe(false)
  })
})
```

Note on `isFlat(payload.obj)`: `obj.delta` is an object, so `isFlat` is `false` — the assertion string reflects that.

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/widgets/shared-helpers.test.ts`
Expected: FAIL — `chip is not defined` (ReferenceError inside the widget) and `widgetMeta` has no description key.

- [ ] **Step 5: Implement in `src/widgets/shared.ts`**

(a) Replace `widgetMeta()`:

```ts
export function widgetMeta(description?: string): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    ui: {
      domain: WIDGET_DOMAIN,
      csp: {
        connectDomains: [],
        resourceDomains: [],
        frameDomains: [],
      },
    },
    "openai/widgetDomain": WIDGET_DOMAIN,
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: [],
      redirect_domains: [],
    },
    "openai/widgetPrefersBorder": true,
  }
  if (description) meta["openai/widgetDescription"] = description
  return meta
}
```

Update its doc comment: "…Declares the widget domain (required for submission), an empty CSP, a bordered-card preference, and — when given — the model-facing `openai/widgetDescription`."

(b) Append to `BASE_CSS` (before the closing backtick):

```css
  .chip.good { background: rgba(22,163,74,.12); color: var(--good); }
  .chip.warn { background: rgba(217,119,6,.14); color: var(--warn); }
  .chip.bad { background: rgba(220,38,38,.12); color: var(--bad); }
  .chip.info { background: rgba(79,70,229,.12); color: var(--accent); }
  .plane { margin-top: 14px; }
  .plane .subtitle { margin-bottom: 4px; }
  .num { text-align: right; }
  .tree-body { padding-left: 12px; border-left: 1px solid var(--border); margin: 2px 0 2px 2px; }
  .node { padding: 2px 0; font-size: 13px; word-break: break-word; }
  .node .k, .tree-body summary .k { color: var(--muted); }
  details.tree { margin: 2px 0; }
  details.tree > summary { cursor: pointer; font-size: 13px; list-style: none; }
  details.tree > summary::before { content: "▸ "; color: var(--muted); }
  details.tree[open] > summary::before { content: "▾ "; }
```

(c) Append to `HELPERS_JS` (after `copyButton`, before the closing backtick). No backticks, no `${`:

```js
  function chip(text, tone) {
    if (text == null || text === "") return "";
    return '<span class="chip' + (tone ? " " + tone : "") + '">' + esc(text) + '</span>';
  }
  function clamp(s, n) {
    var t = String(s == null ? "" : s);
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }
  function shortId(id) {
    var s = String(id == null ? "" : id);
    if (!s) return "—";
    return s.length > 8 ? s.slice(0, 8) : s;
  }
  function idChip(id) {
    var s = String(id == null ? "" : id);
    if (!s) return '<span class="muted">—</span>';
    return '<span class="mono" title="' + esc(s) + '">' + esc(shortId(s)) + '</span>';
  }
  function relTime(iso) {
    if (!iso) return "—";
    var t = Date.parse(iso);
    if (isNaN(t)) return String(iso);
    var d = Math.round((t - Date.now()) / 1000);
    var a = Math.abs(d);
    var n, u;
    if (a < 60) { n = a; u = "s"; }
    else if (a < 3600) { n = Math.round(a / 60); u = "m"; }
    else if (a < 86400) { n = Math.round(a / 3600); u = "h"; }
    else { n = Math.round(a / 86400); u = "d"; }
    return d >= 0 ? "in " + n + u : n + u + " ago";
  }
  function isFlat(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
    return Object.keys(obj).every(function (k) { var v = obj[k]; return v == null || typeof v !== "object"; });
  }
  function isRowArray(v) {
    return Array.isArray(v) && v.length > 0 && v.every(function (r) { return !!r && typeof r === "object" && !Array.isArray(r); });
  }
  function dataTable(rows, columns) {
    if (!Array.isArray(rows) || !rows.length) return "";
    var cols = columns ? columns.slice() : [];
    if (!columns) {
      rows.forEach(function (r) {
        if (r && typeof r === "object" && !Array.isArray(r)) {
          Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); });
        }
      });
    }
    var extraCols = cols.length > 12 ? cols.length - 12 : 0;
    cols = cols.slice(0, 12);
    var shown = rows.slice(0, 50);
    var html = '<table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join("") + '</tr></thead><tbody>';
    shown.forEach(function (r) {
      html += '<tr>' + cols.map(function (c) {
        var v = r && typeof r === "object" && !Array.isArray(r) ? r[c] : r;
        var cell = v != null && typeof v === "object" ? clamp(JSON.stringify(v), 80) : fmt(v);
        return '<td class="val">' + esc(cell) + '</td>';
      }).join("") + '</tr>';
    });
    html += '</tbody></table>';
    var more = [];
    if (rows.length > shown.length) more.push("+" + (rows.length - shown.length) + " more rows");
    if (extraCols) more.push("+" + extraCols + " more columns");
    if (more.length) html += '<div class="muted small" style="margin-top:6px">' + esc(more.join(" · ")) + '</div>';
    return html;
  }
  function kvTiles(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return "";
    var keys = Object.keys(obj);
    if (!keys.length) return "";
    return '<div class="grid">' + keys.map(function (k) {
      var v = obj[k];
      var text = v != null && typeof v === "object" ? clamp(JSON.stringify(v), 120) : fmt(v);
      return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="val">' + esc(text === "" ? "—" : text) + '</span></div>';
    }).join("") + '</div>';
  }
  function jsonTree(value, depth, budget) {
    depth = depth || 0;
    budget = budget || { n: 400 };
    if (budget.n-- <= 0) return '<span class="muted">…</span>';
    if (value == null || typeof value !== "object") return '<span class="val mono">' + esc(fmt(value)) + '</span>';
    if (depth >= 6) return '<span class="muted">' + esc(clamp(JSON.stringify(value), 80)) + '</span>';
    var isArr = Array.isArray(value);
    var keys = isArr ? value.map(function (_, i) { return String(i); }) : Object.keys(value);
    if (!keys.length) return '<span class="muted">' + (isArr ? "[]" : "{}") + '</span>';
    var inner = keys.map(function (k) {
      var v = value[k];
      var label = '<span class="k mono">' + esc(k) + '</span>';
      if (v == null || typeof v !== "object") {
        return '<div class="node">' + label + ' <span class="val mono">' + esc(fmt(v)) + '</span></div>';
      }
      var size = Array.isArray(v) ? "[" + v.length + "]" : "{" + Object.keys(v).length + "}";
      return '<details class="tree"' + (depth < 1 ? " open" : "") + '><summary>' + label + ' <span class="muted small">' + size + '</span></summary>' + jsonTree(v, depth + 1, budget) + '</details>';
    }).join("");
    return '<div class="tree-body">' + inner + '</div>';
  }
```

(d) In `registerWidget`, change `_meta: widgetMeta(),` → `_meta: widgetMeta(opts.description),`.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/widgets/shared-helpers.test.ts` → PASS (10 tests).
Run: `npm run typecheck && npm run format && npm test` → green (existing `all-widgets` meta assertions still hold; `widgetMeta` keeps every prior key).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/widgets/shared.ts tests/widgets/render/harness.ts tests/widgets/shared-helpers.test.ts
git commit -m "feat(widgets): shared render helpers (chip/table/tiles/tree/relTime), widgetDescription + prefersBorder meta, jsdom render harness

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Field Registry widgets — field list and field concept card

**Files:**
- Create: `src/widgets/field-list.ts`, `src/widgets/field-card.ts`
- Create: `tests/widgets/fixtures/list-fields.json`, `tests/widgets/fixtures/get-field.json`
- Test: `tests/widgets/render/field-list.test.ts`, `tests/widgets/render/field-card.test.ts`

**Interfaces:**
- Consumes: `buildWidgetHtml` (`src/widgets/shared.ts`), helpers `chip`, `clamp`, `relTime`, `esc`, `fmt`, `empty` (Task 2); `renderWidget`, `loadFixture` (Task 2).
- Produces: `getFieldListWidgetHtml(): string`, `getFieldCardWidgetHtml(): string` (registered in Task 8).

- [ ] **Step 1: Fixtures**

`tests/widgets/fixtures/list-fields.json` (shape of `GET /v1/fields` as returned by `talonic_list_fields`):

```json
{
  "data": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "canonical_name": "invoice_number",
      "display_name": "Invoice Number",
      "data_type": "string",
      "tier": 1,
      "maturity": "core",
      "admission_state": "canonical",
      "description": null,
      "synonyms": ["invoice_no", "inv_number"],
      "cluster_name": "invoice_number",
      "occurrence_count": 1116,
      "master_instruction": "Extract the invoice number exactly as printed.",
      "superseded_by": null,
      "created_at": "2026-06-17T23:39:29.785Z",
      "updated_at": "2026-09-10T11:10:00.664Z",
      "links": { "self": "/v1/fields/11111111-1111-4111-8111-111111111111" }
    },
    {
      "id": "22222222-2222-4222-8222-222222222222",
      "canonical_name": "total_amount",
      "display_name": "Total Amount",
      "data_type": "number",
      "tier": 2,
      "maturity": "proven",
      "admission_state": "canonical",
      "description": "Grand total including tax.",
      "synonyms": ["grand_total"],
      "cluster_name": "total_amount",
      "occurrence_count": 640,
      "master_instruction": null,
      "superseded_by": null,
      "created_at": "2026-06-20T10:00:00.000Z",
      "updated_at": "2026-09-01T09:00:00.000Z",
      "links": { "self": "/v1/fields/22222222-2222-4222-8222-222222222222" }
    },
    {
      "id": "33333333-3333-4333-8333-333333333333",
      "canonical_name": "vendor_vat_id",
      "display_name": null,
      "data_type": "string",
      "tier": 3,
      "maturity": "candidate",
      "admission_state": "candidate",
      "description": null,
      "synonyms": [],
      "cluster_name": null,
      "occurrence_count": 3,
      "master_instruction": null,
      "superseded_by": "22222222-2222-4222-8222-222222222222",
      "created_at": "2026-09-15T08:00:00.000Z",
      "updated_at": "2026-09-15T08:00:00.000Z",
      "links": { "self": "/v1/fields/33333333-3333-4333-8333-333333333333" }
    }
  ],
  "pagination": { "total": 8406, "limit": 3, "has_more": true, "next_cursor": "opaque-cursor" }
}
```

`tests/widgets/fixtures/get-field.json` (shape of `talonic_get_field` — the `/v1/fields/:id/card` payload plus `resolution`):

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "canonical_name": "invoice_number",
  "display_name": "Invoice Number",
  "data_type": "string",
  "tier": 1,
  "maturity": "core",
  "admission_state": "canonical",
  "description": null,
  "synonyms": ["invoice_no", "inv_number", "rechnungsnummer"],
  "cluster_name": "invoice_number",
  "occurrence_count": 1116,
  "master_instruction": "Extract the invoice number exactly as printed, including prefixes.",
  "superseded_by": null,
  "created_at": "2026-06-17T23:39:29.785Z",
  "updated_at": "2026-09-10T11:10:00.664Z",
  "links": { "self": "/v1/fields/11111111-1111-4111-8111-111111111111" },
  "redirected_from": [],
  "definition": {
    "description": null,
    "instruction": "Extract the invoice number exactly as printed, including prefixes.",
    "variance_notes": "Prefixes vary between INV- and RE-.",
    "synonyms": ["invoice_no", "inv_number", "rechnungsnummer"],
    "aliases": []
  },
  "identity": {
    "pinned": false,
    "source": null,
    "link_key": true,
    "link_key_category": "document_reference",
    "superseded_by": null,
    "absorbed": []
  },
  "occurrence": {
    "occurrence_count": 1116,
    "document_count": 855,
    "occurrence_rate": 0.1541,
    "first_seen_at": "2026-06-17T23:39:29.785Z",
    "last_seen_at": "2026-09-21T19:00:58.221Z",
    "promoted_at": "2026-06-28T15:18:27.247Z",
    "document_type_distribution": { "Invoice": 800, "Credit Note": 55 }
  },
  "values": {
    "total": 1116,
    "distinct_count": 164,
    "visible_document_count": 855,
    "top": [
      { "value": "INV-2026-04417", "count": 728, "share": 0.6523 },
      { "value": "RE-88120", "count": 91, "share": 0.0815 },
      { "value": "INV-2026-00021", "count": 40, "share": 0.0358 }
    ],
    "examples": ["INV-2026-04417", "RE-88120"]
  },
  "usage": { "schema_count": 1, "schema_field_count": 1 },
  "resolution": { "matched_by": "synonym", "redirected_from": ["invoice_no"] }
}
```

- [ ] **Step 2: Failing render tests**

`tests/widgets/render/field-list.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getFieldListWidgetHtml } from "../../../src/widgets/field-list"
import { loadFixture, renderWidget } from "./harness"

describe("field-list widget", () => {
  it("renders one row per field with maturity, type and occurrences", () => {
    const r = renderWidget(getFieldListWidgetHtml(), loadFixture("list-fields"))
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(r.text).toContain("Field Registry")
    expect(r.text).toContain("3 of 8406 fields")
    expect(r.text).toContain("Invoice Number")
    expect(r.text).toContain("vendor_vat_id") // falls back to canonical_name
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("core")
    expect(r.document.querySelector(".chip.info")?.textContent).toBe("proven")
    expect(r.document.querySelector(".chip.warn")?.textContent).toBe("candidate")
    expect(r.text).toContain("superseded")
    expect(r.text).toContain("1116")
    expect(r.text).toContain("more available")
  })

  it("shows the empty state for an empty page", () => {
    const r = renderWidget(getFieldListWidgetHtml(), { data: [], pagination: { total: 0 } })
    expect(r.text).toBe("No fields match.")
  })

  it("survives a malformed payload without throwing", () => {
    const r = renderWidget(getFieldListWidgetHtml(), { data: "nope", pagination: 7 })
    expect(r.text).toBe("No fields match.")
  })
})
```

`tests/widgets/render/field-card.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getFieldCardWidgetHtml } from "../../../src/widgets/field-card"
import { loadFixture, renderWidget } from "./harness"

describe("field-card widget", () => {
  it("renders the concept card: name, chips, definition, synonyms, stats, top values, resolution", () => {
    const r = renderWidget(getFieldCardWidgetHtml(), loadFixture("get-field"))
    expect(r.text).toContain("Invoice Number")
    expect(r.text).toContain("invoice_number")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("core")
    expect(r.text).toContain("tier 1")
    expect(r.text).toContain("link key")
    expect(r.text).toContain("Extract the invoice number exactly as printed")
    expect(r.text).toContain("rechnungsnummer")
    expect(r.text).toContain("1116")
    expect(r.text).toContain("855")
    expect(r.text).toContain("15.4%")
    expect(r.text).toContain("164")
    expect(r.text).toContain("INV-2026-04417")
    expect(r.text).toContain("65%")
    expect(r.text).toContain("Resolved by synonym")
    expect(r.text).toContain("redirected from invoice_no")
  })

  it("renders without optional sections when the card is minimal", () => {
    const r = renderWidget(getFieldCardWidgetHtml(), {
      id: "x",
      canonical_name: "plain_field",
      data_type: "string",
      maturity: "candidate",
    })
    expect(r.text).toContain("plain_field")
    expect(r.text).toContain("No definition recorded.")
    expect(r.document.querySelectorAll("table")).toHaveLength(0)
  })

  it("shows the empty state for an empty payload", () => {
    expect(renderWidget(getFieldCardWidgetHtml(), {}).text).toBe("No field card.")
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/widgets/render/field-list.test.ts tests/widgets/render/field-card.test.ts`
Expected: FAIL — cannot resolve `../../../src/widgets/field-list` / `field-card`.

- [ ] **Step 4: Implement `src/widgets/field-list.ts`**

```ts
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_list_fields`. One row per Field Registry concept:
 * display/canonical name, data type, maturity (core / proven / candidate),
 * occurrence count, with a superseded marker and a pagination footer.
 *
 * @internal
 */
export function getFieldListWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var rows = Array.isArray(payload.data) ? payload.data : [];
    var pg = payload.pagination && typeof payload.pagination === "object" ? payload.pagination : {};
    if (!rows.length) { empty("No fields match."); return; }
    function maturityTone(m) { return m === "core" ? "good" : m === "proven" ? "info" : m === "candidate" ? "warn" : ""; }
    var body = rows.map(function (f) {
      f = f && typeof f === "object" ? f : {};
      var name = f.display_name || f.canonical_name || f.id || "(field)";
      var sup = f.superseded_by ? ' <span class="chip bad" title="' + esc(f.superseded_by) + '">superseded</span>' : "";
      var canon = f.canonical_name && f.canonical_name !== name ? '<div class="muted small mono">' + esc(f.canonical_name) + '</div>' : "";
      return '<tr>'
        + '<td><div class="val">' + esc(name) + sup + '</div>' + canon + '</td>'
        + '<td>' + chip(f.data_type, "") + '</td>'
        + '<td>' + chip(f.maturity, maturityTone(f.maturity)) + (f.tier != null ? ' <span class="muted small">tier ' + esc(f.tier) + '</span>' : "") + '</td>'
        + '<td class="val num">' + esc(f.occurrence_count != null ? f.occurrence_count : "—") + '</td>'
        + '</tr>';
    }).join("");
    var total = typeof pg.total === "number" ? pg.total : rows.length;
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Field Registry</div><div class="subtitle">' + rows.length + ' of ' + total + ' fields</div></div>'
      + (pg.has_more ? '<span class="chip">more available</span>' : "") + '</div>'
      + '<table><thead><tr><th>Field</th><th>Type</th><th>Maturity</th><th class="num">Occurrences</th></tr></thead><tbody>' + body + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Field Registry",
  renderBody: RENDER_BODY,
})
```

- [ ] **Step 5: Implement `src/widgets/field-card.ts`**

```ts
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_get_field`: the concept card of one Field
 * Registry field — name and maturity/tier chips, definition, synonyms,
 * occurrence and usage tiles, top values, and how the name was resolved.
 *
 * @internal
 */
export function getFieldCardWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    if (!payload || (!payload.canonical_name && !payload.id)) { empty("No field card."); return; }
    var def = payload.definition && typeof payload.definition === "object" ? payload.definition : {};
    var occ = payload.occurrence && typeof payload.occurrence === "object" ? payload.occurrence : {};
    var vals = payload.values && typeof payload.values === "object" ? payload.values : {};
    var usage = payload.usage && typeof payload.usage === "object" ? payload.usage : {};
    var ident = payload.identity && typeof payload.identity === "object" ? payload.identity : {};
    var res = payload.resolution && typeof payload.resolution === "object" ? payload.resolution : null;
    function maturityTone(m) { return m === "core" ? "good" : m === "proven" ? "info" : m === "candidate" ? "warn" : ""; }
    var name = payload.display_name || payload.canonical_name || payload.id;
    var definition = def.description || payload.description || def.instruction || payload.master_instruction || "";
    var synonymList = Array.isArray(def.synonyms) ? def.synonyms : Array.isArray(payload.synonyms) ? payload.synonyms : [];
    var synonyms = synonymList.slice(0, 12).map(function (s) { return chip(s, ""); }).join("");
    var top = Array.isArray(vals.top) ? vals.top.slice(0, 8) : [];
    var topHtml = top.map(function (t) {
      t = t && typeof t === "object" ? t : {};
      var share = typeof t.share === "number" ? Math.round(t.share * 100) : null;
      return '<tr><td class="val mono">' + esc(clamp(fmt(t.value), 60)) + '</td><td class="val num">' + esc(t.count != null ? t.count : "") + '</td><td>'
        + (share == null ? "" : '<span class="bar"><span style="width:' + share + '%"></span></span> <span class="muted small">' + share + '%</span>') + '</td></tr>';
    }).join("");
    var rate = typeof occ.occurrence_rate === "number" ? (Math.round(occ.occurrence_rate * 1000) / 10) + "%" : "—";
    var redirected = res && Array.isArray(res.redirected_from) && res.redirected_from.length ? res.redirected_from.join(", ") : "";
    var occCount = occ.occurrence_count != null ? occ.occurrence_count : payload.occurrence_count != null ? payload.occurrence_count : "—";
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + esc(name) + '</div>'
      + (payload.canonical_name && payload.canonical_name !== name ? '<div class="subtitle mono">' + esc(payload.canonical_name) + '</div>' : "") + '</div>'
      + '<div>' + chip(payload.data_type, "") + chip(payload.maturity, maturityTone(payload.maturity))
      + (payload.tier != null ? chip("tier " + payload.tier, "") : "")
      + (ident.superseded_by || payload.superseded_by ? chip("superseded", "bad") : "")
      + (ident.link_key ? chip("link key", "info") : "") + '</div></div>'
      + (definition ? '<div class="small" style="white-space:pre-wrap">' + esc(clamp(definition, 600)) + '</div>' : '<div class="muted small">No definition recorded.</div>')
      + (synonyms ? '<div style="margin-top:8px"><div class="muted small">Also known as</div><div>' + synonyms + '</div></div>' : "")
      + '<div class="grid">'
      + '<div class="kv"><span class="k">Occurrences</span><span class="val">' + esc(occCount) + '</span></div>'
      + '<div class="kv"><span class="k">Documents</span><span class="val">' + esc(occ.document_count != null ? occ.document_count : "—") + '</span></div>'
      + '<div class="kv"><span class="k">Occurrence rate</span><span class="val">' + esc(rate) + '</span></div>'
      + '<div class="kv"><span class="k">Distinct values</span><span class="val">' + esc(vals.distinct_count != null ? vals.distinct_count : "—") + '</span></div>'
      + '<div class="kv"><span class="k">Used in schemas</span><span class="val">' + esc(usage.schema_count != null ? usage.schema_count : "—") + '</span></div>'
      + '<div class="kv"><span class="k">Last seen</span><span class="val">' + esc(occ.last_seen_at ? relTime(occ.last_seen_at) : "—") + '</span></div>'
      + '</div>'
      + (topHtml ? '<div class="plane"><div class="subtitle">Top values</div><table><thead><tr><th>Value</th><th class="num">Count</th><th>Share</th></tr></thead><tbody>' + topHtml + '</tbody></table></div>' : "")
      + (res ? '<div class="muted small" style="margin-top:10px">Resolved by ' + esc(res.matched_by || "id") + (redirected ? ' · redirected from ' + esc(redirected) : "") + '</div>' : "");
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Field Card",
  renderBody: RENDER_BODY,
})
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/widgets/render/field-list.test.ts tests/widgets/render/field-card.test.ts` → PASS (6 tests).
Run: `npm run typecheck && npm run format && npm test` → green.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/field-list.ts src/widgets/field-card.ts tests/widgets/fixtures/list-fields.json tests/widgets/fixtures/get-field.json tests/widgets/render/field-list.test.ts tests/widgets/render/field-card.test.ts
git commit -m "feat(widgets): Field Registry list and concept-card widgets with jsdom render tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Field values and find-data widgets

**Files:**
- Create: `src/widgets/field-values.ts`, `src/widgets/find-data.ts`
- Create: `tests/widgets/fixtures/field-values.json`, `tests/widgets/fixtures/find-data.json`
- Test: `tests/widgets/render/field-values.test.ts`, `tests/widgets/render/find-data.test.ts`

**Interfaces:**
- Consumes: Task 2 helpers (`chip`, `clamp`, `shortId`, `confBar`, `fmt`, `esc`, `empty`), harness.
- Produces: `getFieldValuesWidgetHtml(): string`, `getFindDataWidgetHtml(): string`.

- [ ] **Step 1: Fixtures**

`tests/widgets/fixtures/field-values.json`:

```json
{
  "field_id": "11111111-1111-4111-8111-111111111111",
  "canonical_name": "invoice_number",
  "concept_ids": ["11111111-1111-4111-8111-111111111111"],
  "data": [
    {
      "occurrence_id": "aaaaaaa1-0000-4000-8000-000000000001",
      "document_id": "d0c00001-0000-4000-8000-000000000001",
      "document_filename": "invoice-0421.pdf",
      "document_type": "Invoice",
      "value": "INV-2026-04417",
      "data_type": "string",
      "confidence": 0.95,
      "provenance": {
        "raw_field_name": "invoice_number",
        "source_text": "Invoice No. INV-2026-04417",
        "resolved_by": "label_cache",
        "needs_confirmation": false,
        "bound_field_id": "11111111-1111-4111-8111-111111111111",
        "via_redirect": false
      },
      "created_at": "2026-09-21T19:00:58.221Z",
      "links": { "document": "/v1/documents/d0c00001-0000-4000-8000-000000000001" }
    },
    {
      "occurrence_id": "aaaaaaa1-0000-4000-8000-000000000002",
      "document_id": "d0c00001-0000-4000-8000-000000000002",
      "document_filename": "credit-note-17.pdf",
      "document_type": "Credit Note",
      "value": "RE-88120",
      "data_type": "string",
      "confidence": 0.62,
      "provenance": {
        "raw_field_name": "rechnungsnummer",
        "source_text": "Rechnungsnummer: RE-88120",
        "resolved_by": "synonym",
        "needs_confirmation": true,
        "bound_field_id": "11111111-1111-4111-8111-111111111111",
        "via_redirect": true
      },
      "created_at": "2026-09-20T10:00:00.000Z",
      "links": { "document": "/v1/documents/d0c00001-0000-4000-8000-000000000002" }
    }
  ],
  "pagination": { "total": 1116, "limit": 2, "has_more": true, "next_cursor": "opaque" },
  "resolution": { "matched_by": "canonical_name", "redirected_from": [] }
}
```

`tests/widgets/fixtures/find-data.json` (shape of `talonic_find_data`: `{ tool, result }`):

```json
{
  "tool": "find_data",
  "result": {
    "query": "total amount on invoices",
    "semantic": true,
    "fields": [
      {
        "plane": "field",
        "canonical_name": "total_amount",
        "display_name": "Total Amount",
        "data_type": "number",
        "tier": 2,
        "occurrence_count": 640,
        "match": "semantic",
        "score": 0.8132,
        "field_keys": ["total_amount"],
        "samples": [
          { "value": "1299.00", "document_id": "d0c00001-0000-4000-8000-000000000001" },
          { "value": "88.50", "document_id": "d0c00001-0000-4000-8000-000000000002" }
        ]
      },
      {
        "plane": "field",
        "canonical_name": "net_amount",
        "display_name": null,
        "data_type": "number",
        "tier": 3,
        "occurrence_count": 12,
        "match": "lexical",
        "score": 0.41,
        "field_keys": ["net_amount"],
        "samples": []
      }
    ],
    "values": [
      {
        "plane": "value",
        "canonical_name": "total_amount",
        "value": "1299.00",
        "document_id": "d0c00001-0000-4000-8000-000000000001",
        "filename": "invoice-0421.pdf",
        "score": 0.77
      }
    ],
    "documents": [
      {
        "document_id": "d0c00001-0000-4000-8000-000000000001",
        "filename": "invoice-0421.pdf",
        "score": 0.5083,
        "best_passage": "Total amount due: 1,299.00 EUR",
        "char_offset": 464
      }
    ],
    "passages": [
      {
        "plane": "passage",
        "document_id": "d0c00001-0000-4000-8000-000000000001",
        "filename": "invoice-0421.pdf",
        "text": "Subtotal 1,092.00 EUR. VAT 19% 207.00 EUR. Total amount due: 1,299.00 EUR.",
        "char_offset": 464,
        "match": "semantic",
        "score": 0.5083
      }
    ]
  }
}
```

- [ ] **Step 2: Failing render tests**

`tests/widgets/render/field-values.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getFieldValuesWidgetHtml } from "../../../src/widgets/field-values"
import { loadFixture, renderWidget } from "./harness"

describe("field-values widget", () => {
  it("renders value rows with document, confidence and provenance", () => {
    const r = renderWidget(getFieldValuesWidgetHtml(), loadFixture("field-values"))
    expect(r.text).toContain("invoice_number")
    expect(r.text).toContain("2 of 1116 values")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(r.text).toContain("INV-2026-04417")
    expect(r.text).toContain("invoice-0421.pdf")
    expect(r.text).toContain("Credit Note")
    expect(r.text).toContain("95%")
    expect(r.text).toContain("62%")
    expect(r.document.querySelector(".bar.bad")).not.toBeNull() // 0.62 < 0.7
    expect(r.text).toContain("Rechnungsnummer: RE-88120")
    expect(r.text).toContain("needs confirmation")
    expect(r.text).toContain("via redirect")
    expect(r.text).toContain("more available")
  })

  it("names the field in the empty state", () => {
    const r = renderWidget(getFieldValuesWidgetHtml(), { canonical_name: "vat_rate", data: [] })
    expect(r.text).toBe("No values recorded for vat_rate.")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getFieldValuesWidgetHtml(), { data: [null, 5, "x"] })
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(3)
  })
})
```

`tests/widgets/render/find-data.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getFindDataWidgetHtml } from "../../../src/widgets/find-data"
import { loadFixture, renderWidget } from "./harness"

describe("find-data widget", () => {
  it("renders the four planes with counts, scores and samples", () => {
    const r = renderWidget(getFindDataWidgetHtml(), loadFixture("find-data"))
    expect(r.text).toContain("total amount on invoices")
    expect(r.text).toContain("5 matches")
    expect(r.text).toContain("semantic + lexical")
    expect(r.text).toContain("Fields (2)")
    expect(r.text).toContain("Values (1)")
    expect(r.text).toContain("Documents (1)")
    expect(r.text).toContain("Passages (1)")
    expect(r.text).toContain("Total Amount")
    expect(r.text).toContain("net_amount")
    expect(r.text).toContain("81%")
    expect(r.text).toContain("1299.00")
    expect(r.text).toContain("Total amount due")
    expect(r.document.querySelectorAll(".plane")).toHaveLength(4)
  })

  it("skips empty planes", () => {
    const r = renderWidget(getFindDataWidgetHtml(), {
      tool: "find_data",
      result: { query: "q", fields: [{ canonical_name: "only_field", score: 0.5 }], values: [], documents: [], passages: [] },
    })
    expect(r.document.querySelectorAll(".plane")).toHaveLength(1)
    expect(r.text).toContain("1 matches")
  })

  it("shows the empty state when nothing matched", () => {
    const r = renderWidget(getFindDataWidgetHtml(), { tool: "find_data", result: { query: "unicorns", fields: [] } })
    expect(r.text).toBe("Nothing in the workspace matches “unicorns”.")
  })

  it("accepts a bare result object (no tool envelope) and a malformed one", () => {
    expect(renderWidget(getFindDataWidgetHtml(), { fields: [{ canonical_name: "x" }] }).text).toContain("Fields (1)")
    expect(renderWidget(getFindDataWidgetHtml(), { result: "garbage" }).text).toContain("Nothing in the workspace matches")
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/widgets/render/field-values.test.ts tests/widgets/render/find-data.test.ts` → FAIL (modules not found).

- [ ] **Step 4: Implement `src/widgets/field-values.ts`**

```ts
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_field_values`: one field's current values across
 * documents — value, document (filename + type), confidence bar, and the
 * provenance (raw label, source text, confirmation / redirect flags).
 *
 * @internal
 */
export function getFieldValuesWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var rows = Array.isArray(payload.data) ? payload.data : [];
    var pg = payload.pagination && typeof payload.pagination === "object" ? payload.pagination : {};
    var name = payload.canonical_name || payload.field_id || "field";
    if (!rows.length) { empty("No values recorded for " + name + "."); return; }
    var body = rows.map(function (r) {
      r = r && typeof r === "object" ? r : { value: r };
      var prov = r.provenance && typeof r.provenance === "object" ? r.provenance : {};
      var flags = (prov.needs_confirmation ? chip("needs confirmation", "warn") : "") + (prov.via_redirect ? chip("via redirect", "info") : "");
      return '<tr>'
        + '<td class="val mono">' + esc(clamp(fmt(r.value), 80)) + '</td>'
        + '<td><div class="val">' + esc(r.document_filename || shortId(r.document_id)) + '</div>' + (r.document_type ? '<div class="muted small">' + esc(r.document_type) + '</div>' : "") + '</td>'
        + '<td>' + confBar(r.confidence) + '</td>'
        + '<td class="small">' + (prov.raw_field_name ? '<div class="mono">' + esc(prov.raw_field_name) + '</div>' : "")
        + (prov.source_text ? '<div class="muted">“' + esc(clamp(prov.source_text, 90)) + '”</div>' : "") + flags + '</td>'
        + '</tr>';
    }).join("");
    var total = typeof pg.total === "number" ? pg.total : rows.length;
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + esc(name) + '</div><div class="subtitle">' + rows.length + ' of ' + total + ' values</div></div>'
      + (pg.has_more ? '<span class="chip">more available</span>' : "") + '</div>'
      + '<table><thead><tr><th>Value</th><th>Document</th><th>Confidence</th><th>Provenance</th></tr></thead><tbody>' + body + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Field Values",
  renderBody: RENDER_BODY,
})
```

- [ ] **Step 5: Implement `src/widgets/find-data.ts`**

```ts
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_find_data`: the ranked matches behind a concept,
 * one section per retrieval plane — fields (with samples), values, documents
 * (best passage), passages — each with its score bar. Empty planes are
 * skipped; no matches at all shows a single empty state.
 *
 * @internal
 */
export function getFindDataWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var res = payload && payload.result && typeof payload.result === "object" ? payload.result : (payload && typeof payload === "object" ? payload : {});
    var fields = Array.isArray(res.fields) ? res.fields : [];
    var values = Array.isArray(res.values) ? res.values : [];
    var docs = Array.isArray(res.documents) ? res.documents : [];
    var passages = Array.isArray(res.passages) ? res.passages : [];
    var total = fields.length + values.length + docs.length + passages.length;
    var query = typeof res.query === "string" ? res.query : "";
    if (!total) { empty("Nothing in the workspace matches" + (query ? " “" + query + "”" : "") + "."); return; }
    function scoreBar(s) {
      if (typeof s !== "number") return "";
      var p = Math.max(0, Math.min(100, Math.round(s * 100)));
      return '<span class="bar"><span style="width:' + p + '%"></span></span> <span class="muted small">' + p + '%</span>';
    }
    function obj(x) { return x && typeof x === "object" ? x : {}; }
    function plane(label, items, renderItem) {
      if (!items.length) return "";
      return '<div class="plane"><div class="subtitle">' + esc(label) + ' (' + items.length + ')</div>' + items.map(function (i) { return renderItem(obj(i)); }).join("") + '</div>';
    }
    var fieldsHtml = plane("Fields", fields, function (f) {
      var samples = Array.isArray(f.samples) ? f.samples.slice(0, 3).map(function (s) {
        var v = s && typeof s === "object" && "value" in s ? s.value : s;
        return chip(clamp(fmt(v), 40), "");
      }).join("") : "";
      return '<div class="kv"><div><span class="val">' + esc(f.display_name || f.canonical_name || "(field)") + '</span> ' + chip(f.data_type, "")
        + (f.tier != null ? chip("tier " + f.tier, "") : "") + (f.match ? chip(f.match, "info") : "") + '</div>'
        + '<div class="small muted">' + (f.occurrence_count != null ? esc(f.occurrence_count) + ' occurrences · ' : "") + scoreBar(f.score) + '</div>'
        + (samples ? '<div>' + samples + '</div>' : "") + '</div>';
    });
    var valuesHtml = plane("Values", values, function (v) {
      return '<div class="kv"><span class="val mono">' + esc(clamp(fmt(v.value), 80)) + '</span><span class="small muted">' + esc(v.canonical_name || v.field_key || "")
        + (v.filename ? ' · ' + esc(v.filename) : "") + ' ' + scoreBar(v.score) + '</span></div>';
    });
    var docsHtml = plane("Documents", docs, function (d) {
      return '<div class="kv"><span class="val">' + esc(d.filename || shortId(d.document_id)) + '</span><span class="small muted">' + scoreBar(d.score) + '</span>'
        + (d.best_passage ? '<span class="small">' + esc(clamp(d.best_passage, 160)) + '</span>' : "") + '</div>';
    });
    var passagesHtml = plane("Passages", passages, function (p) {
      return '<div class="kv"><span class="small muted">' + esc(p.filename || shortId(p.document_id)) + ' ' + scoreBar(p.score) + '</span><span class="small">' + esc(clamp(p.text, 220)) + '</span></div>';
    });
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Data behind “' + esc(query || "your concept") + '”</div><div class="subtitle">' + total + ' matches' + (res.semantic ? " · semantic + lexical" : "") + '</div></div></div>'
      + fieldsHtml + valuesHtml + docsHtml + passagesHtml;
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Find Data",
  renderBody: RENDER_BODY,
})
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/widgets/render/field-values.test.ts tests/widgets/render/find-data.test.ts` → PASS (7 tests).
Run: `npm run typecheck && npm run format && npm test` → green.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/field-values.ts src/widgets/find-data.ts tests/widgets/fixtures/field-values.json tests/widgets/fixtures/find-data.json tests/widgets/render/field-values.test.ts tests/widgets/render/find-data.test.ts
git commit -m "feat(widgets): field-values table and find-data planes widgets with render tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Agent tool registry and agent tool result widgets

**Files:**
- Create: `src/widgets/agent-tools.ts`, `src/widgets/agent-tool-result.ts`
- Create: `tests/widgets/fixtures/list-agent-tools.json`, `tests/widgets/fixtures/invoke-agent-tool-rows.json`, `tests/widgets/fixtures/invoke-agent-tool-flat.json`, `tests/widgets/fixtures/invoke-agent-tool-nested.json`
- Test: `tests/widgets/render/agent-tools.test.ts`, `tests/widgets/render/agent-tool-result.test.ts`

**Interfaces:**
- Consumes: Task 2 helpers (`chip`, `clamp`, `dataTable`, `kvTiles`, `jsonTree`, `isFlat`, `isRowArray`, `shortId`, `fmt`, `esc`, `empty`).
- Produces: `getAgentToolsWidgetHtml(): string`, `getAgentToolResultWidgetHtml(): string`.

- [ ] **Step 1: Fixtures**

`tests/widgets/fixtures/list-agent-tools.json`:

```json
{
  "tools": [
    { "name": "workspace_overview", "description": "Get a high-level count of what exists in this workspace: schemas, documents, pipelines, and extracted data cells.", "impact": "read", "capability": "data.read", "can_invoke": true },
    { "name": "query_data", "description": "Run a read-only SQL SELECT over the extracted data.", "impact": "read", "capability": "data.read", "can_invoke": true },
    { "name": "spec2_put_draft", "description": "Save a Spec draft.", "impact": "draft_mutation", "capability": "spec.author", "can_invoke": false },
    { "name": "run_spec_pipeline", "description": "Run a Spec as a pipeline over documents.", "impact": "live_mutation", "capability": "pipeline.run", "can_invoke": false }
  ],
  "invocable_count": 2,
  "totalCount": 69
}
```

`tests/widgets/fixtures/invoke-agent-tool-rows.json`:

```json
{
  "tool": "query_data",
  "result": [
    { "vendor": "Musterfirma AG", "invoice_count": 12, "total": 14890.5 },
    { "vendor": "Beispiel GmbH", "invoice_count": 3, "total": 2100 }
  ],
  "citations": [
    { "quote": "Total amount due: 1,299.00 EUR", "document_id": "d0c00001-0000-4000-8000-000000000001", "filename": "invoice-0421.pdf" }
  ],
  "artifacts": [{ "type": "table", "id": "art-1", "label": "Vendor totals", "link": "https://app.talonic.com/artifacts/art-1" }]
}
```

`tests/widgets/fixtures/invoke-agent-tool-flat.json`:

```json
{ "tool": "workspace_overview", "result": { "schemas": 212, "documents": 5549, "pipelines": 5, "dataCells": 364775 } }
```

`tests/widgets/fixtures/invoke-agent-tool-nested.json`:

```json
{
  "tool": "describe_data",
  "result": {
    "tables": [{ "name": "invoices", "columns": [{ "name": "vendor", "type": "text" }, { "name": "total", "type": "numeric" }] }],
    "row_count": 5549
  }
}
```

- [ ] **Step 2: Failing render tests**

`tests/widgets/render/agent-tools.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getAgentToolsWidgetHtml } from "../../../src/widgets/agent-tools"
import { loadFixture, renderWidget } from "./harness"

describe("agent-tools widget", () => {
  it("renders the registry with impact tones and invocable markers", () => {
    const r = renderWidget(getAgentToolsWidgetHtml(), loadFixture("list-agent-tools"))
    expect(r.text).toContain("Platform agent tools")
    expect(r.text).toContain("2 invocable with this key · 69 in the registry")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(4)
    expect(r.text).toContain("workspace_overview")
    expect(r.document.querySelectorAll(".chip.good").length).toBeGreaterThanOrEqual(2) // read impacts
    expect(r.document.querySelector(".chip.warn")?.textContent).toBe("draft_mutation")
    expect(r.document.querySelector(".chip.bad")?.textContent).toBe("live_mutation")
    expect(r.text).toContain("data.read")
    expect(r.text.match(/✓ invocable/g)).toHaveLength(2)
  })

  it("derives counts when the envelope omits them", () => {
    const r = renderWidget(getAgentToolsWidgetHtml(), { tools: [{ name: "a", can_invoke: true }, { name: "b", can_invoke: false }] })
    expect(r.text).toContain("1 invocable with this key · 2 in the registry")
  })

  it("shows the empty state", () => {
    expect(renderWidget(getAgentToolsWidgetHtml(), { tools: [] }).text).toBe("No agent tools are visible to this credential.")
    expect(renderWidget(getAgentToolsWidgetHtml(), {}).text).toBe("No agent tools are visible to this credential.")
  })
})
```

`tests/widgets/render/agent-tool-result.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getAgentToolResultWidgetHtml } from "../../../src/widgets/agent-tool-result"
import { loadFixture, renderWidget } from "./harness"

describe("agent-tool-result widget", () => {
  it("renders an array of rows as a table, with citations and artifacts", () => {
    const r = renderWidget(getAgentToolResultWidgetHtml(), loadFixture("invoke-agent-tool-rows"))
    expect(r.text).toContain("query_data")
    expect(r.text).toContain("2 rows")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(r.text).toContain("Musterfirma AG")
    expect(r.text).toContain("Citations (1)")
    expect(r.text).toContain("Total amount due")
    expect(r.text).toContain("Artifacts (1)")
    expect(r.document.querySelector("a.btn")?.getAttribute("href")).toBe("https://app.talonic.com/artifacts/art-1")
  })

  it("renders a flat object as tiles", () => {
    const r = renderWidget(getAgentToolResultWidgetHtml(), loadFixture("invoke-agent-tool-flat"))
    expect(r.text).toContain("workspace_overview")
    expect(r.text).toContain("4 keys")
    expect(r.document.querySelectorAll(".kv")).toHaveLength(4)
    expect(r.text).toContain("364775")
  })

  it("renders a nested object as a JSON tree", () => {
    const r = renderWidget(getAgentToolResultWidgetHtml(), loadFixture("invoke-agent-tool-nested"))
    expect(r.document.querySelectorAll("details.tree").length).toBeGreaterThan(0)
    expect(r.text).toContain("invoices")
    expect(r.text).toContain("5549")
  })

  it("renders a scalar result and the no-data state", () => {
    expect(renderWidget(getAgentToolResultWidgetHtml(), { tool: "calculate", result: 42 }).text).toContain("42")
    expect(renderWidget(getAgentToolResultWidgetHtml(), { tool: "x", result: null }).text).toContain("The tool returned no data.")
    expect(renderWidget(getAgentToolResultWidgetHtml(), {}).text).toContain("The tool returned no data.")
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/widgets/render/agent-tools.test.ts tests/widgets/render/agent-tool-result.test.ts` → FAIL (modules not found).

- [ ] **Step 4: Implement `src/widgets/agent-tools.ts`**

```ts
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_list_agent_tools`: the platform agent tool
 * registry as a table — name + description, impact (read / draft_mutation /
 * live_mutation), capability, and whether this credential may invoke it.
 *
 * @internal
 */
export function getAgentToolsWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var tools = Array.isArray(payload.tools) ? payload.tools : [];
    if (!tools.length) { empty("No agent tools are visible to this credential."); return; }
    function impactTone(i) { return i === "read" ? "good" : i === "draft_mutation" ? "warn" : i === "live_mutation" ? "bad" : ""; }
    var body = tools.map(function (t) {
      t = t && typeof t === "object" ? t : {};
      return '<tr>'
        + '<td><div class="val mono">' + esc(t.name || "(tool)") + '</div><div class="muted small">' + esc(clamp(t.description, 140)) + '</div></td>'
        + '<td>' + chip(t.impact, impactTone(t.impact)) + '</td>'
        + '<td>' + chip(t.capability, "") + '</td>'
        + '<td>' + (t.can_invoke ? '<span class="chip good">✓ invocable</span>' : '<span class="muted small">—</span>') + '</td>'
        + '</tr>';
    }).join("");
    var inv = typeof payload.invocable_count === "number" ? payload.invocable_count : tools.filter(function (t) { return t && t.can_invoke; }).length;
    var total = typeof payload.totalCount === "number" ? payload.totalCount : tools.length;
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Platform agent tools</div><div class="subtitle">' + inv + ' invocable with this key · ' + total + ' in the registry</div></div></div>'
      + '<table><thead><tr><th>Tool</th><th>Impact</th><th>Capability</th><th>Access</th></tr></thead><tbody>' + body + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Agent Tools",
  renderBody: RENDER_BODY,
})
```

- [ ] **Step 5: Implement `src/widgets/agent-tool-result.ts`**

```ts
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_invoke_agent_tool`. The result has no fixed
 * shape, so it is rendered by shape: array of row objects → data table;
 * flat object → key/value tiles; nested object → collapsible JSON tree;
 * scalar → preformatted block. Citations and artifacts follow when present.
 *
 * @internal
 */
export function getAgentToolResultWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var result = payload && typeof payload === "object" ? payload.result : undefined;
    var toolName = (payload && payload.tool) || "agent tool";
    var body;
    if (result == null || result === "") body = '<div class="empty">The tool returned no data.</div>';
    else if (isRowArray(result)) body = dataTable(result);
    else if (isFlat(result)) body = kvTiles(result);
    else if (typeof result === "object") body = jsonTree(result);
    else body = '<pre class="md">' + esc(fmt(result)) + '</pre>';
    var cites = Array.isArray(payload.citations) ? payload.citations : [];
    var arts = Array.isArray(payload.artifacts) ? payload.artifacts : [];
    function obj(x) { return x && typeof x === "object" ? x : {}; }
    var citeHtml = cites.length ? '<div class="plane"><div class="subtitle">Citations (' + cites.length + ')</div>' + cites.slice(0, 20).map(function (c) {
      c = obj(c);
      return '<div class="kv"><span class="small">“' + esc(clamp(c.quote || c.text || fmt(c), 160)) + '”</span><span class="muted small">' + esc(c.filename || shortId(c.document_id)) + '</span></div>';
    }).join("") + '</div>' : "";
    var artHtml = arts.length ? '<div class="plane"><div class="subtitle">Artifacts (' + arts.length + ')</div>' + arts.slice(0, 20).map(function (a) {
      a = obj(a);
      var link = typeof a.link === "string" && /^https:\\/\\//.test(a.link) ? a.link : "";
      return '<div class="kv"><span class="val">' + esc(a.label || a.type || a.id || "artifact") + '</span>'
        + (link ? '<a class="btn small" href="' + esc(link) + '" target="_blank" rel="noopener">Open</a>' : "") + '</div>';
    }).join("") + '</div>' : "";
    var count = isRowArray(result) ? result.length + " rows" : (result && typeof result === "object" && !Array.isArray(result) ? Object.keys(result).length + " keys" : "");
    root.innerHTML = ''
      + '<div class="header"><div><div class="title mono">' + esc(toolName) + '</div>' + (count ? '<div class="subtitle">' + esc(count) + '</div>' : "") + '</div></div>'
      + body + citeHtml + artHtml;
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Agent Tool Result",
  renderBody: RENDER_BODY,
})
```

Note the regex `/^https:\\/\\//` — inside the TS template literal the backslashes are doubled so the emitted JS reads `/^https:\/\//`.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/widgets/render/agent-tools.test.ts tests/widgets/render/agent-tool-result.test.ts` → PASS (7 tests).
Run: `npm run typecheck && npm run format && npm test` → green.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/agent-tools.ts src/widgets/agent-tool-result.ts tests/widgets/fixtures/list-agent-tools.json tests/widgets/fixtures/invoke-agent-tool-*.json tests/widgets/render/agent-tools.test.ts tests/widgets/render/agent-tool-result.test.ts
git commit -m "feat(widgets): agent tool registry table and shape-adaptive agent tool result widgets

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Agent-task shared JS, worklist widget, task card widget

**Files:**
- Create: `src/widgets/agent-task-shared.ts`, `src/widgets/agent-task-list.ts`, `src/widgets/agent-task.ts`
- Create: `tests/widgets/fixtures/list-agent-tasks.json`, `tests/widgets/fixtures/get-agent-task.json`
- Test: `tests/widgets/render/agent-task-list.test.ts`, `tests/widgets/render/agent-task.test.ts`

**Interfaces:**
- Consumes: Task 2 helpers (`chip`, `clamp`, `idChip`, `relTime`, `kvTiles`, `jsonTree`, `isFlat`, `esc`, `empty`).
- Produces (TS): `TASK_JS: string` — JS defining `statusTone(status)`, `taskTiming(p)`, `taskSections(p)`; prepend it to any agent-task `RENDER_BODY`. `getAgentTaskListWidgetHtml(): string`, `getAgentTaskWidgetHtml(): string`.

- [ ] **Step 1: Fixtures**

`tests/widgets/fixtures/list-agent-tasks.json`:

```json
{
  "data": [
    {
      "id": "7a5k0001-0000-4000-8000-000000000001",
      "customer_id": "c0000000-0000-4000-8000-000000000001",
      "pipeline_id": "p1pe0001-0000-4000-8000-000000000001",
      "pipeline_document_id": "pd000001-0000-4000-8000-000000000001",
      "document_id": "d0c00001-0000-4000-8000-000000000001",
      "stage_id": "stage-agent-1",
      "phase_index": 3,
      "status": "available",
      "execution_epoch": 1,
      "claimed_at": null,
      "lease_expires_at": null,
      "timeout_at": "2099-01-01T00:00:00.000Z",
      "submitted_at": null,
      "created_at": "2026-09-22T09:00:00.000Z",
      "updated_at": "2026-09-22T09:00:00.000Z"
    },
    {
      "id": "7a5k0002-0000-4000-8000-000000000002",
      "customer_id": "c0000000-0000-4000-8000-000000000001",
      "pipeline_id": "p1pe0001-0000-4000-8000-000000000001",
      "pipeline_document_id": "pd000001-0000-4000-8000-000000000002",
      "document_id": "d0c00001-0000-4000-8000-000000000002",
      "stage_id": "stage-agent-1",
      "phase_index": 3,
      "status": "claimed",
      "execution_epoch": 4,
      "claimed_at": "2026-09-22T09:10:00.000Z",
      "lease_expires_at": "2099-01-01T00:00:00.000Z",
      "timeout_at": "2099-01-02T00:00:00.000Z",
      "submitted_at": null,
      "created_at": "2026-09-22T09:00:00.000Z",
      "updated_at": "2026-09-22T09:10:00.000Z"
    }
  ],
  "pagination": { "has_more": false, "next_cursor": null }
}
```

`tests/widgets/fixtures/get-agent-task.json`:

```json
{
  "id": "7a5k0002-0000-4000-8000-000000000002",
  "customer_id": "c0000000-0000-4000-8000-000000000001",
  "pipeline_id": "p1pe0001-0000-4000-8000-000000000001",
  "pipeline_document_id": "pd000001-0000-4000-8000-000000000002",
  "document_id": "d0c00001-0000-4000-8000-000000000002",
  "stage_id": "stage-agent-1",
  "phase_index": 3,
  "status": "claimed",
  "execution_epoch": 4,
  "claimed_at": "2026-09-22T09:10:00.000Z",
  "lease_expires_at": "2099-01-01T00:00:00.000Z",
  "timeout_at": "2099-01-02T00:00:00.000Z",
  "submitted_at": null,
  "created_at": "2026-09-22T09:00:00.000Z",
  "updated_at": "2026-09-22T09:10:00.000Z",
  "input_snapshot": { "vendor_name": "Musterfirma AG", "total_amount": 1299, "currency": "EUR", "line_items": [{ "sku": "A-1", "qty": 2 }] },
  "output_contract": [
    { "key": "approval_decision", "dataType": "string", "required": true },
    { "key": "approver_note", "dataType": "string", "required": false }
  ],
  "instructions": "Decide whether this invoice can be auto-approved. Approve only if the total is below 5,000 EUR and the vendor is known.",
  "timeout_fallthrough": "route_to_review"
}
```

- [ ] **Step 2: Failing render tests**

`tests/widgets/render/agent-task-list.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getAgentTaskListWidgetHtml } from "../../../src/widgets/agent-task-list"
import { loadFixture, renderWidget } from "./harness"

describe("agent-task-list widget", () => {
  it("renders the worklist with status chips, ids, lease and timeout", () => {
    const r = renderWidget(getAgentTaskListWidgetHtml(), loadFixture("list-agent-tasks"))
    expect(r.text).toContain("Agent task worklist")
    expect(r.text).toContain("2 tasks")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(r.text).toContain("1 available")
    expect(r.text).toContain("1 claimed")
    expect(r.document.querySelector(".chip.info")?.textContent).toBe("1 available")
    expect(r.text).toContain("7a5k0001") // short task id
    expect(r.text).toContain("d0c00001") // short document id
    expect(r.text).toMatch(/in \d+d/) // relative lease/timeout in the future
    expect(r.text).toContain("4") // epoch
  })

  it("shows the empty state", () => {
    expect(renderWidget(getAgentTaskListWidgetHtml(), { data: [] }).text).toBe("No agent tasks in this worklist.")
    expect(renderWidget(getAgentTaskListWidgetHtml(), {}).text).toBe("No agent tasks in this worklist.")
  })

  it("survives malformed rows", () => {
    const r = renderWidget(getAgentTaskListWidgetHtml(), { data: [null, "x", { status: "timed_out" }] })
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(r.document.querySelector(".chip.bad")).not.toBeNull()
  })
})
```

`tests/widgets/render/agent-task.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getAgentTaskWidgetHtml } from "../../../src/widgets/agent-task"
import { loadFixture, renderWidget } from "./harness"

describe("agent-task widget", () => {
  it("renders status, timing tiles, instructions, output contract and input snapshot", () => {
    const r = renderWidget(getAgentTaskWidgetHtml(), loadFixture("get-agent-task"))
    expect(r.text).toContain("Agent task 7a5k0002")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("claimed")
    expect(r.text).toContain("Execution epoch 4")
    expect(r.text).toContain("Lease expires in")
    expect(r.text).toContain("Instructions")
    expect(r.text).toContain("auto-approved")
    expect(r.text).toContain("Output contract (2)")
    expect(r.text).toContain("approval_decision")
    expect(r.text).toContain("required")
    expect(r.text).toContain("optional")
    expect(r.text).toContain("Input snapshot")
    expect(r.text).toContain("Musterfirma AG")
    expect(r.document.querySelectorAll("details.tree").length).toBeGreaterThan(0) // nested line_items
    expect(r.text).toContain("On timeout: route to review")
  })

  it("renders a metadata-only task without the optional sections", () => {
    const r = renderWidget(getAgentTaskWidgetHtml(), { id: "abc", status: "available", execution_epoch: 1 })
    expect(r.text).toContain("Agent task abc")
    expect(r.text).not.toContain("Instructions")
    expect(r.text).not.toContain("Output contract")
    expect(r.text).not.toContain("Input snapshot")
  })

  it("shows the empty state", () => {
    expect(renderWidget(getAgentTaskWidgetHtml(), {}).text).toBe("No agent task.")
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/widgets/render/agent-task-list.test.ts tests/widgets/render/agent-task.test.ts` → FAIL (modules not found).

- [ ] **Step 4: Implement `src/widgets/agent-task-shared.ts`**

```ts
/**
 * JS shared by the Agent-task widgets (list, card, lease, submitted). It is
 * prepended to each widget's `RENDER_BODY`, so these functions are defined
 * inside `render(payload)` and see the shared helpers (`chip`, `idChip`,
 * `relTime`, `kvTiles`, `jsonTree`, `isFlat`, `esc`, `clamp`).
 *
 * - `statusTone(status)`: chip tone for a task status.
 * - `taskTiming(p)`: the six-tile grid (document, pipeline, phase, epoch, lease, timeout). Note the literal space between the `.k` and `.val` spans — flex ignores it visually, but it keeps `textContent` readable ("Execution epoch 4"), which the render tests assert.
 * - `taskSections(p)`: instructions, output contract table, input snapshot, timeout fallthrough.
 *
 * @internal
 */
export const TASK_JS = `
    function statusTone(s) {
      return s === "available" ? "info" : s === "claimed" || s === "submitted" ? "good" : s === "timed_out" ? "bad" : s === "cancelled" ? "warn" : "";
    }
    function taskTiming(p) {
      return '<div class="grid">'
        + '<div class="kv"><span class="k">Document</span> <span class="val">' + idChip(p.document_id) + '</span></div>'
        + '<div class="kv"><span class="k">Pipeline</span> <span class="val">' + idChip(p.pipeline_id) + '</span></div>'
        + '<div class="kv"><span class="k">Phase</span> <span class="val">' + esc(p.phase_index != null ? p.phase_index : "—") + '</span></div>'
        + '<div class="kv"><span class="k">Execution epoch</span> <span class="val">' + esc(p.execution_epoch != null ? p.execution_epoch : "—") + '</span></div>'
        + '<div class="kv"><span class="k">Lease expires</span> <span class="val">' + esc(p.lease_expires_at ? relTime(p.lease_expires_at) : "—") + '</span></div>'
        + '<div class="kv"><span class="k">Times out</span> <span class="val">' + esc(p.timeout_at ? relTime(p.timeout_at) : "—") + '</span></div>'
        + '</div>';
    }
    function taskSections(p) {
      var html = "";
      if (typeof p.instructions === "string" && p.instructions) {
        html += '<div class="plane"><div class="subtitle">Instructions</div><div class="small" style="white-space:pre-wrap">' + esc(clamp(p.instructions, 1200)) + '</div></div>';
      }
      if (Array.isArray(p.output_contract) && p.output_contract.length) {
        html += '<div class="plane"><div class="subtitle">Output contract (' + p.output_contract.length + ')</div>'
          + '<table><thead><tr><th>Field</th><th>Type</th><th>Required</th></tr></thead><tbody>'
          + p.output_contract.map(function (f) {
              f = f && typeof f === "object" ? f : {};
              return '<tr><td class="val mono">' + esc(f.key || "") + '</td><td>' + chip(f.dataType, "") + '</td><td>'
                + (f.required ? chip("required", "warn") : '<span class="muted small">optional</span>') + '</td></tr>';
            }).join("")
          + '</tbody></table></div>';
      }
      var snap = p.input_snapshot;
      if (snap && typeof snap === "object" && !Array.isArray(snap) && Object.keys(snap).length) {
        html += '<div class="plane"><div class="subtitle">Input snapshot</div>' + (isFlat(snap) ? kvTiles(snap) : jsonTree(snap)) + '</div>';
      }
      if (p.timeout_fallthrough) {
        html += '<div class="muted small" style="margin-top:10px">On timeout: ' + esc(String(p.timeout_fallthrough).replace(/_/g, " ")) + '</div>';
      }
      return html;
    }
`
```

- [ ] **Step 5: Implement `src/widgets/agent-task-list.ts`**

```ts
import { TASK_JS } from "./agent-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_list_agent_tasks`: the Agent-stage worklist —
 * one row per task with status chip, document, phase, lease expiry, timeout
 * and execution epoch, plus a per-status summary in the header.
 *
 * @internal
 */
export function getAgentTaskListWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY =
  TASK_JS +
  `
    var rows = Array.isArray(payload.data) ? payload.data : [];
    var pg = payload.pagination && typeof payload.pagination === "object" ? payload.pagination : {};
    if (!rows.length) { empty("No agent tasks in this worklist."); return; }
    var body = rows.map(function (t) {
      t = t && typeof t === "object" ? t : {};
      return '<tr>'
        + '<td>' + idChip(t.id) + '</td>'
        + '<td>' + chip(t.status, statusTone(t.status)) + '</td>'
        + '<td>' + idChip(t.document_id) + '</td>'
        + '<td class="val num">' + esc(t.phase_index != null ? t.phase_index : "—") + '</td>'
        + '<td class="val">' + esc(t.lease_expires_at ? relTime(t.lease_expires_at) : "—") + '</td>'
        + '<td class="val">' + esc(t.timeout_at ? relTime(t.timeout_at) : "—") + '</td>'
        + '<td class="val num">' + esc(t.execution_epoch != null ? t.execution_epoch : "—") + '</td>'
        + '</tr>';
    }).join("");
    var counts = {};
    rows.forEach(function (t) { var s = t && typeof t === "object" && t.status ? t.status : "unknown"; counts[s] = (counts[s] || 0) + 1; });
    var summary = Object.keys(counts).map(function (s) { return chip(counts[s] + " " + s, statusTone(s)); }).join("");
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Agent task worklist</div><div class="subtitle">' + rows.length + ' task' + (rows.length === 1 ? "" : "s") + (pg.has_more ? " · more available" : "") + '</div></div><div>' + summary + '</div></div>'
      + '<table><thead><tr><th>Task</th><th>Status</th><th>Document</th><th class="num">Phase</th><th>Lease</th><th>Timeout</th><th class="num">Epoch</th></tr></thead><tbody>' + body + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Agent Tasks",
  renderBody: RENDER_BODY,
})
```

- [ ] **Step 6: Implement `src/widgets/agent-task.ts`**

```ts
import { TASK_JS } from "./agent-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_get_agent_task`: one Agent-stage task — status,
 * timing tiles, instructions, the declared output contract and the immutable
 * input snapshot.
 *
 * @internal
 */
export function getAgentTaskWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY =
  TASK_JS +
  `
    if (!payload || typeof payload !== "object" || !payload.id) { empty("No agent task."); return; }
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Agent task ' + idChip(payload.id) + '</div>'
      + '<div class="subtitle">' + esc(payload.created_at ? "created " + relTime(payload.created_at) : "") + '</div></div>'
      + '<div>' + chip(payload.status, statusTone(payload.status)) + '</div></div>'
      + taskTiming(payload) + taskSections(payload);
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Agent Task",
  renderBody: RENDER_BODY,
})
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/widgets/render/agent-task-list.test.ts tests/widgets/render/agent-task.test.ts` → PASS (6 tests).
Run: `npm run typecheck && npm run format && npm test` → green.

- [ ] **Step 8: Commit**

```bash
git add src/widgets/agent-task-shared.ts src/widgets/agent-task-list.ts src/widgets/agent-task.ts tests/widgets/fixtures/list-agent-tasks.json tests/widgets/fixtures/get-agent-task.json tests/widgets/render/agent-task-list.test.ts tests/widgets/render/agent-task.test.ts
git commit -m "feat(widgets): agent-task worklist and task card widgets with shared task JS

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Agent-task lease (claim + heartbeat) and submitted widgets

**Files:**
- Create: `src/widgets/agent-task-lease.ts`, `src/widgets/agent-task-submitted.ts`
- Create: `tests/widgets/fixtures/heartbeat-agent-task.json`, `tests/widgets/fixtures/submit-agent-task.json` (claim reuses `get-agent-task.json`)
- Test: `tests/widgets/render/agent-task-lease.test.ts`, `tests/widgets/render/agent-task-submitted.test.ts`

**Interfaces:**
- Consumes: `TASK_JS` (Task 6), Task 2 helpers.
- Produces: `getAgentTaskClaimWidgetHtml(): string`, `getAgentTaskHeartbeatWidgetHtml(): string`, `getAgentTaskSubmittedWidgetHtml(): string`.

- [ ] **Step 1: Fixtures**

`tests/widgets/fixtures/heartbeat-agent-task.json` (metadata-only, as the heartbeat route returns):

```json
{
  "id": "7a5k0002-0000-4000-8000-000000000002",
  "customer_id": "c0000000-0000-4000-8000-000000000001",
  "pipeline_id": "p1pe0001-0000-4000-8000-000000000001",
  "pipeline_document_id": "pd000001-0000-4000-8000-000000000002",
  "document_id": "d0c00001-0000-4000-8000-000000000002",
  "stage_id": "stage-agent-1",
  "phase_index": 3,
  "status": "claimed",
  "execution_epoch": 4,
  "claimed_at": "2026-09-22T09:10:00.000Z",
  "lease_expires_at": "2099-01-01T00:00:00.000Z",
  "timeout_at": "2099-01-02T00:00:00.000Z",
  "submitted_at": null,
  "created_at": "2026-09-22T09:00:00.000Z",
  "updated_at": "2026-09-22T09:12:00.000Z"
}
```

`tests/widgets/fixtures/submit-agent-task.json`:

```json
{
  "id": "7a5k0002-0000-4000-8000-000000000002",
  "customer_id": "c0000000-0000-4000-8000-000000000001",
  "pipeline_id": "p1pe0001-0000-4000-8000-000000000001",
  "pipeline_document_id": "pd000001-0000-4000-8000-000000000002",
  "document_id": "d0c00001-0000-4000-8000-000000000002",
  "stage_id": "stage-agent-1",
  "phase_index": 3,
  "status": "submitted",
  "execution_epoch": 4,
  "claimed_at": "2026-09-22T09:10:00.000Z",
  "lease_expires_at": null,
  "timeout_at": "2099-01-02T00:00:00.000Z",
  "submitted_at": "2026-09-22T09:14:00.000Z",
  "created_at": "2026-09-22T09:00:00.000Z",
  "updated_at": "2026-09-22T09:14:00.000Z"
}
```

- [ ] **Step 2: Failing render tests**

`tests/widgets/render/agent-task-lease.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  getAgentTaskClaimWidgetHtml,
  getAgentTaskHeartbeatWidgetHtml,
} from "../../../src/widgets/agent-task-lease"
import { loadFixture, renderWidget } from "./harness"

describe("agent-task lease widgets", () => {
  it("claim: headline, epoch, lease expiry and the full task payload", () => {
    const r = renderWidget(getAgentTaskClaimWidgetHtml(), loadFixture("get-agent-task"))
    expect(r.text).toContain("Task claimed")
    expect(r.document.querySelector(".big")?.textContent).toContain("4")
    expect(r.text).toContain("Keep this epoch for heartbeat and submit.")
    expect(r.text).toMatch(/Lease expires in \d+d/)
    expect(r.text).toContain("Output contract (2)")
    expect(r.text).toContain("Input snapshot")
  })

  it("heartbeat: headline, epoch, and no payload sections", () => {
    const r = renderWidget(getAgentTaskHeartbeatWidgetHtml(), loadFixture("heartbeat-agent-task"))
    expect(r.text).toContain("Lease extended")
    expect(r.document.querySelector(".big")?.textContent).toContain("4")
    expect(r.text).not.toContain("Output contract")
    expect(r.text).not.toContain("Instructions")
  })

  it("both show the empty state without a task id", () => {
    expect(renderWidget(getAgentTaskClaimWidgetHtml(), {}).text).toBe("No lease information.")
    expect(renderWidget(getAgentTaskHeartbeatWidgetHtml(), { status: "claimed" }).text).toBe("No lease information.")
  })

  it("the two templates differ only in headline", () => {
    const a = getAgentTaskClaimWidgetHtml().replace("Task claimed", "X").replace("Talonic — Agent Task Claimed", "T")
    const b = getAgentTaskHeartbeatWidgetHtml().replace("Lease extended", "X").replace("Talonic — Agent Task Lease", "T")
    expect(a).toBe(b)
  })
})
```

`tests/widgets/render/agent-task-submitted.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getAgentTaskSubmittedWidgetHtml } from "../../../src/widgets/agent-task-submitted"
import { loadFixture, renderWidget } from "./harness"

describe("agent-task-submitted widget", () => {
  it("confirms the submission with status, time and ids", () => {
    const r = renderWidget(getAgentTaskSubmittedWidgetHtml(), loadFixture("submit-agent-task"))
    expect(r.text).toContain("Outputs submitted")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("submitted")
    expect(r.text).toMatch(/ago/) // submitted_at is in the past
    expect(r.text).toContain("resumes its pipeline")
    expect(r.text).toContain("d0c00001")
    expect(r.text).toContain("Execution epoch 4")
  })

  it("shows the empty state", () => {
    expect(renderWidget(getAgentTaskSubmittedWidgetHtml(), {}).text).toBe("No submission recorded.")
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/widgets/render/agent-task-lease.test.ts tests/widgets/render/agent-task-submitted.test.ts` → FAIL (modules not found).

- [ ] **Step 4: Implement `src/widgets/agent-task-lease.ts`**

```ts
import { TASK_JS } from "./agent-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/**
 * Lease card shared by `talonic_claim_agent_task` ("Task claimed") and
 * `talonic_heartbeat_agent_task` ("Lease extended"): the execution epoch to
 * keep, lease expiry, timing tiles, and — when the payload carries them (the
 * claim route returns the full task) — instructions, output contract and
 * input snapshot.
 *
 * @internal
 */
export function getAgentTaskClaimWidgetHtml(): string {
  return CLAIM_HTML
}

/** @internal */
export function getAgentTaskHeartbeatWidgetHtml(): string {
  return HEARTBEAT_HTML
}

const LEASE_BODY = `
    if (!payload || typeof payload !== "object" || !payload.id) { empty("No lease information."); return; }
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + HEADLINE + '</div><div class="subtitle">Task ' + idChip(payload.id) + '</div></div>'
      + '<div>' + chip(payload.status, statusTone(payload.status)) + '</div></div>'
      + '<div class="big">' + esc(payload.execution_epoch != null ? payload.execution_epoch : "—") + ' <span class="muted small">execution epoch</span></div>'
      + '<div class="muted small">Keep this epoch for heartbeat and submit.' + (payload.lease_expires_at ? ' Lease expires ' + esc(relTime(payload.lease_expires_at)) + '.' : "") + '</div>'
      + taskTiming(payload) + taskSections(payload);
`

function leaseWidget(headline: string, title: string): string {
  return buildWidgetHtml({
    title,
    renderBody: TASK_JS + "    var HEADLINE = " + JSON.stringify(headline) + ";\n" + LEASE_BODY,
  })
}

const CLAIM_HTML = leaseWidget("Task claimed", "Talonic — Agent Task Claimed")
const HEARTBEAT_HTML = leaseWidget("Lease extended", "Talonic — Agent Task Lease")
```

- [ ] **Step 5: Implement `src/widgets/agent-task-submitted.ts`**

```ts
import { TASK_JS } from "./agent-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline confirmation for `talonic_submit_agent_task`: the declared outputs
 * were accepted and the parked document resumed its pipeline.
 *
 * @internal
 */
export function getAgentTaskSubmittedWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY =
  TASK_JS +
  `
    if (!payload || typeof payload !== "object" || !payload.id) { empty("No submission recorded."); return; }
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Outputs submitted</div><div class="subtitle">Task ' + idChip(payload.id)
      + (payload.submitted_at ? ' · ' + esc(relTime(payload.submitted_at)) : "") + '</div></div>'
      + '<div>' + chip(payload.status, statusTone(payload.status)) + '</div></div>'
      + '<div class="small">The parked document resumes its pipeline from this stage.</div>'
      + taskTiming(payload);
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Agent Task Submitted",
  renderBody: RENDER_BODY,
})
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/widgets/render/agent-task-lease.test.ts tests/widgets/render/agent-task-submitted.test.ts` → PASS (6 tests).
Run: `npm run typecheck && npm run format && npm test` → green.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/agent-task-lease.ts src/widgets/agent-task-submitted.ts tests/widgets/fixtures/heartbeat-agent-task.json tests/widgets/fixtures/submit-agent-task.json tests/widgets/render/agent-task-lease.test.ts tests/widgets/render/agent-task-submitted.test.ts
git commit -m "feat(widgets): agent-task lease (claim/heartbeat) and submitted confirmation widgets

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Registry wiring — 22 widgets registered, every tool opts in, hosted fast path enriched, locks at 22

**Files:**
- Modify: `src/widgets/register.ts` (replace whole file)
- Modify: `src/tools/fields.ts` (3 `registerTool` configs), `src/tools/agent-tools.ts` (3), `src/tools/agent-tasks.ts` (5 tenant tools in `registerAgentTaskTools` only)
- Modify (swap `_meta` to `widgetToolMeta`): `src/tools/extract.ts`, `search.ts`, `filter.ts`, `get-document.ts`, `to-markdown.ts`, `list-schemas.ts`, `save-schema.ts`, `get-balance.ts`, `get-pricing.ts`, `get-usage.ts`, `request-upload.ts`
- Modify: `src/http-server.ts` (fast path `_meta`, imports)
- Modify: `tests/widgets/all-widgets.test.ts` (22-lock), `tests/widgets/tool-annotations.test.ts` (+6 registry tools, status-string lock), `tests/http-server.test.ts` (parametrised template test)
- Create: `tests/widgets/template-hygiene.test.ts`

**Interfaces:**
- Consumes: Task 1 (`WIDGET_URIS`, `WIDGET_DESCRIPTIONS`, `TOOL_WIDGET_KEYS`, `widgetToolMeta`, `widgetKeyForUri`), Task 2 (`widgetMeta(description)`, `registerWidget`), the 11 `get*WidgetHtml` functions from Tasks 3–7.
- Produces: `getWidgetTemplateHtml(uri)`, `getWidgetTemplateMeta(uri)`, `registerWidgets(server)`, `registerExtractionResultWidget(server)`.

- [ ] **Step 1: Failing tests — rewrite the coverage lock**

Replace `tests/widgets/all-widgets.test.ts` entirely:

```ts
import { describe, expect, it } from "vitest"
import { createServer } from "../../src/server-factory"
import {
  TOOL_INVOCATION_STATUS,
  TOOL_WIDGET_KEYS,
  WIDGET_DESCRIPTIONS,
  WIDGET_MIME,
  WIDGET_URIS,
  type WidgetKey,
} from "../../src/widgets/types"

// Every public tool renders a branded inline widget. The mapping lives in
// TOOL_WIDGET_KEYS; this suite locks tool -> outputTemplate URI -> registered
// widget resource for all of them.
const TOOL_WIDGET_MAP: Array<[string, WidgetKey, string]> = Object.entries(TOOL_WIDGET_KEYS).map(
  ([tool, key]) => [tool, key, WIDGET_URIS[key]],
)

function buildServer() {
  return createServer({ apiKey: "tlnc_test" }) as any
}

describe("every tool declares its widget as outputTemplate", () => {
  it.each(TOOL_WIDGET_MAP)("%s -> %s", (toolName, key, uri) => {
    const server = buildServer()
    const tool = server._registeredTools[toolName]
    expect(tool, `${toolName} not registered`).toBeDefined()
    expect(tool._meta?.ui?.resourceUri).toBe(uri)
    expect(tool._meta?.["openai/outputTemplate"]).toBe(uri)
    expect(tool._meta?.["openai/toolInvocation/invoking"]).toBe(TOOL_INVOCATION_STATUS[key].invoking)
    expect(tool._meta?.["openai/toolInvocation/invoked"]).toBe(TOOL_INVOCATION_STATUS[key].invoked)
  })
})

describe("every widget resource is registered correctly", () => {
  it.each(TOOL_WIDGET_MAP)("resource for %s (%s)", async (_toolName, key, uri) => {
    const server = buildServer()
    const resource = server._registeredResources[uri]
    expect(resource, `no resource registered at ${uri}`).toBeDefined()

    const result = await resource.readCallback(new URL(uri))
    const item = result.contents[0]

    expect(item.mimeType).toBe(WIDGET_MIME)
    expect(item.uri).toBe(uri)
    expect(item.text).toMatch(/^<!doctype html>/i)

    // Reads the Apps SDK data channel (not just the postMessage fallback).
    expect(item.text).toContain("window.openai")
    expect(item.text).toContain("toolOutput")
    expect(item.text).toContain("openai:set_globals")
    expect(item.text).toContain("event.source !== window.parent")
    expect(item.text).toContain('msg.jsonrpc !== "2.0"')

    // No secrets ever cross into the iframe.
    expect(item.text).not.toMatch(/tlnc_[a-z]/i)
    expect(item.text).not.toContain("Authorization")

    // Submission metadata: unique domain + CSP, modern keys + OpenAI aliases,
    // model-facing description, bordered card.
    const meta = item._meta
    expect(meta.ui?.domain).toBe("https://talonic.com")
    expect(meta.ui?.csp?.connectDomains).toEqual([])
    expect(meta["openai/widgetDomain"]).toBe("https://talonic.com")
    expect(meta["openai/widgetCSP"]?.connect_domains).toEqual([])
    expect(meta["openai/widgetDescription"]).toBe(WIDGET_DESCRIPTIONS[key])
    expect(meta["openai/widgetPrefersBorder"]).toBe(true)
  })
})

describe("widget coverage is complete", () => {
  it("registers exactly one widget per public tool (22 total) and nothing else under ui://widget/", () => {
    const server = buildServer()
    expect(TOOL_WIDGET_MAP).toHaveLength(22)
    expect(Object.values(WIDGET_URIS)).toHaveLength(22)
    for (const uri of Object.values(WIDGET_URIS)) {
      expect(server._registeredResources[uri], `missing widget ${uri}`).toBeDefined()
    }
    const registeredWidgetUris = Object.keys(server._registeredResources).filter((u) =>
      u.startsWith("ui://widget/"),
    )
    expect(registeredWidgetUris.sort()).toEqual([...Object.values(WIDGET_URIS)].sort())
  })

  it("internal tools have no widget", () => {
    const server = createServer({
      apiKey: "tlnc_test",
      includeAdminAgentTaskTools: true,
    }) as any
    for (const name of Object.keys(server._registeredTools)) {
      if (name.startsWith("talonic_admin_")) {
        expect(server._registeredTools[name]._meta?.["openai/outputTemplate"]).toBeUndefined()
      }
    }
  })
})
```

In `tests/widgets/tool-annotations.test.ts` add the six registry tools to `READ_ONLY_TOOLS` (after `"talonic_get_usage"`):

```ts
  "talonic_list_fields",
  "talonic_get_field",
  "talonic_field_values",
  "talonic_find_data",
  "talonic_list_agent_tools",
  "talonic_invoke_agent_tool",
```

and append a new describe block at the end of the file:

```ts
describe("Apps SDK invocation status strings", () => {
  it.each(ALL_TOOLS)("%s declares invoking/invoked text ≤ 64 chars", (name) => {
    const server = createServer({ apiKey: "tlnc_test" }) as any
    const meta = server._registeredTools[name]?._meta ?? {}
    for (const k of ["openai/toolInvocation/invoking", "openai/toolInvocation/invoked"]) {
      expect(typeof meta[k], `${name} ${k}`).toBe("string")
      expect(meta[k].length, `${name} ${k}`).toBeGreaterThan(0)
      expect(meta[k].length, `${name} ${k}`).toBeLessThanOrEqual(64)
    }
  })
})
```

In `tests/http-server.test.ts`, replace the single-URI test `"widget template resources/read works WITHOUT auth and with JSON-only Accept (review fix)"` with a parametrised version (keep its comment):

```ts
  it.each(Object.values(WIDGET_URIS))(
    "widget template %s is served WITHOUT auth and with JSON-only Accept (review fix)",
    async (uri) => {
      // OpenAI review failed test case #4 with "Error loading app, failed to
      // fetch the template". Widget templates are static, secret-free HTML;
      // their fetch must never die on a missing/stale token (401) or a missing
      // text/event-stream Accept (406). Served via a public fast path.
      const res = await fetch(`${h.baseUrl}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "resources/read", params: { uri } }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("application/json")
      const body = (await res.json()) as any
      expect(body.id).toBe(7)
      expect(body.result.contents[0].uri).toBe(uri)
      expect(body.result.contents[0].mimeType).toBe("text/html;profile=mcp-app")
      expect(body.result.contents[0].text).toMatch(/^<!doctype html>/i)
      expect(body.result.contents[0]._meta?.["openai/widgetDomain"]).toBe("https://talonic.com")
      expect(typeof body.result.contents[0]._meta?.["openai/widgetDescription"]).toBe("string")
      expect(body.result.contents[0]._meta?.["openai/widgetPrefersBorder"]).toBe(true)
    },
  )
```

and add `import { WIDGET_URIS } from "../src/widgets/types"` at the top of that file.

Create `tests/widgets/template-hygiene.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { JSDOM } from "jsdom"
import { getWidgetTemplateHtml } from "../../src/widgets/register"
import { WIDGET_URIS } from "../../src/widgets/types"

// Every template is a static, self-contained document: no secrets, no
// external scripts/styles/fonts (CSP is empty), no leaked TS template syntax.
describe("widget template hygiene", () => {
  it.each(Object.values(WIDGET_URIS))("%s", (uri) => {
    const html = getWidgetTemplateHtml(uri)
    expect(html, `no template for ${uri}`).toBeDefined()
    expect(html).not.toMatch(/tlnc_[a-z0-9]/i)
    expect(html).not.toContain("Authorization")
    expect(html).not.toContain("${")
    expect(html).not.toMatch(/<script[^>]+src=/i)
    expect(html).not.toMatch(/<link[^>]+href=/i)
    expect(html).not.toMatch(/url\(\s*['"]?https?:/i)
    expect(html).not.toMatch(/@import/i)
    // Parses as a document with exactly one inline script and a #root.
    const dom = new JSDOM(html!)
    expect(dom.window.document.querySelectorAll("script")).toHaveLength(1)
    expect(dom.window.document.getElementById("root")).not.toBeNull()
    // The inline script is syntactically valid JavaScript.
    const src = dom.window.document.querySelector("script")!.textContent ?? ""
    expect(() => new Function(src)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the new/changed tests to verify they fail**

Run: `npx vitest run tests/widgets tests/http-server.test.ts`
Expected: FAIL — 11 tools have no `_meta`, 11 URIs have no resource, existing tools lack invocation strings, `getWidgetTemplateHtml` returns undefined for the new URIs.

- [ ] **Step 3: Replace `src/widgets/register.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerWidget, widgetMeta } from "./shared.js"
import { WIDGET_DESCRIPTIONS, WIDGET_URIS, widgetKeyForUri, type WidgetKey } from "./types.js"
import { getExtractionResultWidgetHtml } from "./extraction-result.js"
import { getBalanceWidgetHtml } from "./balance.js"
import { getUploadLinkWidgetHtml } from "./upload-link.js"
import { getSchemaSavedWidgetHtml } from "./schema-saved.js"
import { getDocumentMetaWidgetHtml } from "./document-meta.js"
import { getMarkdownViewWidgetHtml } from "./markdown-view.js"
import { getSchemaListWidgetHtml } from "./schema-list.js"
import { getSearchResultsWidgetHtml } from "./search-results.js"
import { getFilterResultsWidgetHtml } from "./filter-results.js"
import { getPricingWidgetHtml } from "./pricing.js"
import { getUsageWidgetHtml } from "./usage.js"
import { getFieldListWidgetHtml } from "./field-list.js"
import { getFieldCardWidgetHtml } from "./field-card.js"
import { getFieldValuesWidgetHtml } from "./field-values.js"
import { getFindDataWidgetHtml } from "./find-data.js"
import { getAgentToolsWidgetHtml } from "./agent-tools.js"
import { getAgentToolResultWidgetHtml } from "./agent-tool-result.js"
import { getAgentTaskListWidgetHtml } from "./agent-task-list.js"
import { getAgentTaskWidgetHtml } from "./agent-task.js"
import {
  getAgentTaskClaimWidgetHtml,
  getAgentTaskHeartbeatWidgetHtml,
} from "./agent-task-lease.js"
import { getAgentTaskSubmittedWidgetHtml } from "./agent-task-submitted.js"

interface WidgetEntry {
  /** MCP resource name. */
  name: string
  /** Human-readable resource title. */
  title: string
  /** Template factory (templates are static; the factory keeps import order lazy). */
  html: () => string
}

/**
 * The one table every widget consumer reads from: resource registration,
 * the hosted server's public template fast path, and the tests. Adding a
 * widget = one `WIDGET_URIS` key (types.ts, with its description and status
 * strings) + one entry here + `_meta: widgetToolMeta(key)` on the tool.
 *
 * @internal
 */
const WIDGET_REGISTRY: Readonly<Record<WidgetKey, WidgetEntry>> = {
  extract: {
    name: "extraction-result-widget",
    title: "Talonic Extraction Result",
    html: getExtractionResultWidgetHtml,
  },
  search: { name: "search-results-widget", title: "Talonic Search Results", html: getSearchResultsWidgetHtml },
  filter: { name: "filter-results-widget", title: "Talonic Filter Results", html: getFilterResultsWidgetHtml },
  getDocument: { name: "document-meta-widget", title: "Talonic Document", html: getDocumentMetaWidgetHtml },
  toMarkdown: { name: "markdown-view-widget", title: "Talonic Markdown", html: getMarkdownViewWidgetHtml },
  listSchemas: { name: "schema-list-widget", title: "Talonic Schemas", html: getSchemaListWidgetHtml },
  saveSchema: { name: "schema-saved-widget", title: "Talonic Schema Saved", html: getSchemaSavedWidgetHtml },
  getBalance: { name: "balance-widget", title: "Talonic Balance", html: getBalanceWidgetHtml },
  getPricing: { name: "pricing-widget", title: "Talonic Pricing", html: getPricingWidgetHtml },
  getUsage: { name: "usage-widget", title: "Talonic Usage", html: getUsageWidgetHtml },
  requestUpload: { name: "upload-link-widget", title: "Talonic Upload Link", html: getUploadLinkWidgetHtml },
  listFields: { name: "field-list-widget", title: "Talonic Field Registry", html: getFieldListWidgetHtml },
  getField: { name: "field-card-widget", title: "Talonic Field Card", html: getFieldCardWidgetHtml },
  fieldValues: { name: "field-values-widget", title: "Talonic Field Values", html: getFieldValuesWidgetHtml },
  findData: { name: "find-data-widget", title: "Talonic Find Data", html: getFindDataWidgetHtml },
  listAgentTools: { name: "agent-tools-widget", title: "Talonic Agent Tools", html: getAgentToolsWidgetHtml },
  invokeAgentTool: {
    name: "agent-tool-result-widget",
    title: "Talonic Agent Tool Result",
    html: getAgentToolResultWidgetHtml,
  },
  listAgentTasks: { name: "agent-task-list-widget", title: "Talonic Agent Tasks", html: getAgentTaskListWidgetHtml },
  getAgentTask: { name: "agent-task-widget", title: "Talonic Agent Task", html: getAgentTaskWidgetHtml },
  claimAgentTask: {
    name: "agent-task-claim-widget",
    title: "Talonic Agent Task Claimed",
    html: getAgentTaskClaimWidgetHtml,
  },
  heartbeatAgentTask: {
    name: "agent-task-heartbeat-widget",
    title: "Talonic Agent Task Lease",
    html: getAgentTaskHeartbeatWidgetHtml,
  },
  submitAgentTask: {
    name: "agent-task-submitted-widget",
    title: "Talonic Agent Task Submitted",
    html: getAgentTaskSubmittedWidgetHtml,
  },
}

/**
 * Widget template HTML by resource URI. Used by the http-server's public
 * template fast path: ChatGPT's widget renderer fetches these from the
 * sandbox iframe context, and that fetch must never fail on auth or Accept
 * negotiation. The templates are static, secret-free HTML (asserted by
 * tests), so serving them unauthenticated is safe.
 *
 * @internal
 */
export function getWidgetTemplateHtml(uri: string): string | undefined {
  const key = widgetKeyForUri(uri)
  return key ? WIDGET_REGISTRY[key].html() : undefined
}

/**
 * The `_meta` the fast path must attach to a template — identical to what
 * `registerWidget` emits for the same URI (domain, CSP, description, border).
 *
 * @internal
 */
export function getWidgetTemplateMeta(uri: string): Record<string, unknown> | undefined {
  const key = widgetKeyForUri(uri)
  return key ? widgetMeta(WIDGET_DESCRIPTIONS[key]) : undefined
}

function registerOne(server: McpServer, key: WidgetKey): void {
  const entry = WIDGET_REGISTRY[key]
  registerWidget(server, {
    name: entry.name,
    uri: WIDGET_URIS[key],
    title: entry.title,
    description: WIDGET_DESCRIPTIONS[key],
    html: entry.html(),
  })
}

/**
 * Register the extraction-result widget as an MCP resource.
 *
 * Kept as a named export for back-compat; {@link registerWidgets} registers
 * this alongside every other tool widget.
 *
 * @internal
 */
export function registerExtractionResultWidget(server: McpServer): void {
  registerOne(server, "extract")
}

/**
 * Register every tool widget as an MCP resource. Each tool opts into its
 * widget by declaring `_meta: widgetToolMeta(key)` in its `registerTool`
 * config.
 *
 * @internal
 */
export function registerWidgets(server: McpServer): void {
  for (const key of Object.keys(WIDGET_REGISTRY) as WidgetKey[]) registerOne(server, key)
}
```

- [ ] **Step 4: Opt the eleven new tools in**

`src/tools/fields.ts`: add `import { widgetToolMeta } from "../widgets/types.js"` and, in `registerFieldTools`, add after each `annotations: {...},` block:
- `talonic_list_fields` → `_meta: widgetToolMeta("listFields"),`
- `talonic_get_field` → `_meta: widgetToolMeta("getField"),`
- `talonic_field_values` → `_meta: widgetToolMeta("fieldValues"),`

`src/tools/agent-tools.ts`: same import; in `registerAgentRegistryTools`:
- `talonic_find_data` → `_meta: widgetToolMeta("findData"),`
- `talonic_list_agent_tools` → `_meta: widgetToolMeta("listAgentTools"),`
- `talonic_invoke_agent_tool` → `_meta: widgetToolMeta("invokeAgentTool"),`

`src/tools/agent-tasks.ts`: same import; in `registerAgentTaskTools` (NOT in `registerAdminAgentTaskTools`):
- `talonic_list_agent_tasks` → `_meta: widgetToolMeta("listAgentTasks"),`
- `talonic_get_agent_task` → `_meta: widgetToolMeta("getAgentTask"),`
- `talonic_claim_agent_task` → `_meta: widgetToolMeta("claimAgentTask"),`
- `talonic_heartbeat_agent_task` → `_meta: widgetToolMeta("heartbeatAgentTask"),`
- `talonic_submit_agent_task` → `_meta: widgetToolMeta("submitAgentTask"),`

- [ ] **Step 5: Swap the eleven existing tools to `widgetToolMeta`**

In each of `extract.ts`, `search.ts`, `filter.ts`, `get-document.ts`, `to-markdown.ts`, `list-schemas.ts`, `save-schema.ts`, `get-balance.ts`, `get-pricing.ts`, `get-usage.ts`, `request-upload.ts` replace the block

```ts
      _meta: {
        ui: { resourceUri: WIDGET_URIS.<key> },
        "openai/outputTemplate": WIDGET_URIS.<key>,
      },
```

with `_meta: widgetToolMeta("<key>"),` using keys `extract`, `search`, `filter`, `getDocument`, `toMarkdown`, `listSchemas`, `saveSchema`, `getBalance`, `getPricing`, `getUsage`, `requestUpload` respectively (`extract.ts` currently references `EXTRACTION_RESULT_WIDGET_URI`). Change each file's import from `import { WIDGET_URIS } from "../widgets/types.js"` (or the `EXTRACTION_RESULT_WIDGET_URI` import) to `import { widgetToolMeta } from "../widgets/types.js"`. `npm run typecheck` flags any leftover unused import.

- [ ] **Step 6: Hosted fast path meta**

`src/http-server.ts`: change the import on line 47 to `import { getWidgetTemplateHtml, getWidgetTemplateMeta } from "./widgets/register.js"`, delete line 48 (`import { widgetMeta } …`), and in the fast path replace `_meta: widgetMeta(),` with `_meta: getWidgetTemplateMeta(widgetRead.uri),`.

- [ ] **Step 7: Run everything**

Run: `npm run typecheck && npm run format && npm test`
Expected: green. Counts: `all-widgets` 22+22+2, `tool-annotations` includes 22 status tests, `http-server` 22 template tests, `template-hygiene` 22.

Run: `npm run build` → green (tsup).

- [ ] **Step 8: Commit** (metadata-only tool changes → `[skip docs]`)

```bash
git add src/widgets/register.ts src/tools/*.ts src/http-server.ts tests/widgets/all-widgets.test.ts tests/widgets/tool-annotations.test.ts tests/widgets/template-hygiene.test.ts tests/http-server.test.ts
git commit -m "feat(widgets): every public tool renders a widget — 22/22 registered, invocation status + widgetDescription on all, hosted fast path serves all templates [skip docs]

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Surface tagging on raw-fetch tools

**Files:**
- Modify: `src/tools/_http.ts` (add `TokenSource`, `withFetch`, `resolveFetch`; `apiJson` uses `resolveFetch`)
- Modify: `src/tools/agent-tasks.ts` (`agentTaskRequest` uses `resolveFetch(getToken)`), `src/tools/request-upload.ts` (`handleRequestUpload` fetch), `src/resources/webhooks-resource.ts` (fetch), `src/tools/growth.ts` (line ~37 fetch inside the tool helper — NOT the `probeGrowthAccess` boot probe, which takes a raw token string)
- Modify: `src/server-factory.ts` (build `rawToken = withFetch(getToken, taggedFetch)`, pass it to the raw-fetch registrations)
- Test: `tests/surface-tagging.test.ts` (extend)

**Interfaces:**
- Produces: `type TokenSource = (() => string) & { fetch?: typeof fetch }`, `withFetch(getToken, fetchImpl): TokenSource`, `resolveFetch(getToken): typeof fetch`.

- [ ] **Step 1: Failing tests** — append to `tests/surface-tagging.test.ts`:

```ts
import { apiJson, resolveFetch, withFetch } from "../src/tools/_http.js"
import { handleListAgentTasks } from "../src/tools/agent-tasks.js"
import { createServer } from "../src/server-factory.js"

describe("raw-fetch tools use the server's tagged fetch", () => {
  it("withFetch attaches a fetch to the token getter and resolveFetch reads it back", async () => {
    const base = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } }))
    const tagged = makeTaggedFetch(() => "ChatGPT", base as unknown as typeof fetch)
    const source = withFetch(() => "tlnc_x", tagged)
    expect(source()).toBe("tlnc_x")
    expect(resolveFetch(source)).toBe(tagged)
    expect(resolveFetch(() => "plain")).toBe(fetch)

    await apiJson(source, "https://api.example.test", "GET", "/v1/fields")
    const init = base.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get("user-agent")).toBe(`talonic-mcp/${VERSION} ChatGPT`)
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tlnc_x")
  })

  it("agent-task requests carry the tag too", async () => {
    const base = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { headers: { "content-type": "application/json" } }))
    const source = withFetch(() => "tlnc_x", makeTaggedFetch(() => "Cursor", base as unknown as typeof fetch))
    await handleListAgentTasks(source, "https://api.example.test", {})
    const init = base.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get("user-agent")).toBe(`talonic-mcp/${VERSION} Cursor`)
  })

  it("createServer wires the tagged fetch into the field tools", async () => {
    const base = vi.fn(async () => new Response(JSON.stringify({ data: [], pagination: {} }), { headers: { "content-type": "application/json" } }))
    vi.stubGlobal("fetch", base)
    try {
      const server = createServer({ apiKey: "tlnc_test", baseUrl: "https://api.example.test" }) as any
      const tool = server._registeredTools["talonic_list_fields"]
      await tool.callback({}, {})
      const init = base.mock.calls[0][1] as RequestInit
      expect(new Headers(init.headers).get("user-agent")).toMatch(new RegExp(`^talonic-mcp/${VERSION.replace(/\./g, "\\.")}`))
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
```

(The file already imports `describe, it, expect, vi` from vitest and `makeTaggedFetch`, `VERSION`.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/surface-tagging.test.ts` → FAIL (`withFetch` not exported; user-agent header missing on the agent-task and field calls).

- [ ] **Step 3: Implement**

`src/tools/_http.ts` — add after `DEFAULT_BASE`:

```ts
/**
 * A bearer-token getter that may carry the `fetch` implementation raw-fetch
 * tools must use. `createServer` attaches its User-Agent-tagging fetch so the
 * platform can attribute these calls to a client surface, exactly like the
 * SDK-backed tools. Plain getters (tests, library callers) fall back to the
 * global fetch.
 */
export type TokenSource = (() => string) & { fetch?: typeof fetch }

/** Wrap a token getter with the fetch implementation raw-fetch tools should use. */
export function withFetch(getToken: () => string, fetchImpl: typeof fetch): TokenSource {
  const source = (() => getToken()) as TokenSource
  source.fetch = fetchImpl
  return source
}

/** The fetch a raw-fetch tool must call for this token getter. */
export function resolveFetch(getToken: () => string): typeof fetch {
  return (getToken as TokenSource).fetch ?? fetch
}
```

and in `apiJson` replace `const res = await fetch(url, {` with `const res = await resolveFetch(getToken)(url, {`.

`src/tools/agent-tasks.ts`: `import { resolveFetch } from "./_http.js"`; in `agentTaskRequest` replace `await fetch(apiUrl(` with `await resolveFetch(getToken)(apiUrl(`. Leave `probeAgentTaskAdminAccess` (takes a raw token string) untouched.

`src/tools/request-upload.ts`: `import { resolveFetch } from "./_http.js"`; in `handleRequestUpload` replace `await fetch(` with `await resolveFetch(getToken)(`.

`src/resources/webhooks-resource.ts`: `import { resolveFetch } from "../tools/_http.js"`; replace `await fetch(` (line ~60) with `await resolveFetch(getToken)(`.

`src/tools/growth.ts`: `import { resolveFetch } from "./_http.js"`; the tool-call helper at line ~37 receives `getToken` — replace its `await fetch(url, {` with `await resolveFetch(getToken)(url, {`. Leave `probeGrowthAccess` untouched.

`src/server-factory.ts`: `import { withFetch } from "./tools/_http.js"`; after `getToken` is built add `const rawToken = withFetch(getToken, taggedFetch)` and pass `rawToken` instead of `getToken` to `registerRequestUpload`, `registerFieldTools`, `registerAgentRegistryTools`, `registerAgentTaskTools`, `registerGrowthTools`, `registerAdminAgentTaskTools`, `registerWebhooksResource`.

- [ ] **Step 4: Run tests**

Run: `npm run typecheck && npm run format && npm test` → green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/_http.ts src/tools/agent-tasks.ts src/tools/request-upload.ts src/tools/growth.ts src/resources/webhooks-resource.ts src/server-factory.ts tests/surface-tagging.test.ts
git commit -m "fix(telemetry): raw-fetch tools carry the talonic-mcp User-Agent surface tag [skip docs]

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: ChatGPT submission manifest, listing collateral, screenshots

**Files:**
- Modify: `chatgpt-app-submission.json` (add 7 tools + test cases), `docs/chatgpt-apps-sdk/listing-copy.md`, `docs/chatgpt-apps-sdk/developer-mode-testing.md`, `docs/chatgpt-apps-sdk/submission-record.md`
- Add: `docs/chatgpt-apps-sdk/screenshots/*.png` (the 5 untracked files; delete `docs/chatgpt-apps-sdk/.DS_Store`, add `.DS_Store` to `.gitignore` if absent)
- Test: `tests/submission-manifest.test.ts` (new)

- [ ] **Step 1: Failing test**

```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createServer } from "../src/server-factory"

const manifest = JSON.parse(
  readFileSync(new URL("../chatgpt-app-submission.json", import.meta.url), "utf8"),
) as {
  tools: Record<string, { annotations: Record<string, boolean>; justifications: Record<string, string> }>
  test_cases: Array<{ tools_triggered: string | null }>
}

const server = createServer({ apiKey: "tlnc_test" }) as any
const publicTools = Object.keys(server._registeredTools).filter(
  (n) => !n.startsWith("talonic_admin_") && !n.startsWith("talonic_growth_"),
)

describe("ChatGPT submission manifest mirrors the live public tool surface", () => {
  it("lists exactly the public tools", () => {
    expect(Object.keys(manifest.tools).sort()).toEqual([...publicTools].sort())
    expect(publicTools).toHaveLength(22)
  })

  it.each(publicTools)("%s annotations match the server", (name) => {
    const live = server._registeredTools[name].annotations
    const declared = manifest.tools[name]
    expect(declared, `${name} missing from manifest`).toBeDefined()
    expect(declared.annotations).toEqual({
      readOnlyHint: live.readOnlyHint,
      openWorldHint: live.openWorldHint,
      destructiveHint: live.destructiveHint,
    })
    for (const k of ["read_only_justification", "open_world_justification", "destructive_justification"]) {
      expect(declared.justifications[k]?.length, `${name} ${k}`).toBeGreaterThan(20)
    }
  })

  it("every tool is exercised by at least one test case", () => {
    const triggered = new Set(
      manifest.test_cases.flatMap((c) => (c.tools_triggered ?? "").split(",").map((s) => s.trim())).filter(Boolean),
    )
    for (const name of publicTools) expect(triggered.has(name), `${name} has no test case`).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/submission-manifest.test.ts` → FAIL (15 ≠ 22; missing test cases).

- [ ] **Step 3: Add the seven tools to `chatgpt-app-submission.json`** (inside `"tools"`, keep JSON valid, 2-space indent like the file):

```json
"talonic_get_pricing": {
  "annotations": { "readOnlyHint": true, "openWorldHint": false, "destructiveHint": false },
  "justifications": {
    "read_only_justification": "Only reads Talonic's public credit pricing catalog so the assistant can estimate cost before running work.",
    "open_world_justification": "Reads a fixed Talonic pricing endpoint; it does not reach the public internet or modify external state.",
    "destructive_justification": "Read-only catalog lookup; nothing is created, changed, or deleted."
  }
},
"talonic_get_usage": {
  "annotations": { "readOnlyHint": true, "openWorldHint": false, "destructiveHint": false },
  "justifications": {
    "read_only_justification": "Only reads the workspace's own per-function credit consumption over a trailing window.",
    "open_world_justification": "Reads private Talonic usage data for the connected workspace only; no public internet access.",
    "destructive_justification": "Read-only usage report; nothing is created, changed, or deleted."
  }
},
"talonic_list_agent_tasks": {
  "annotations": { "readOnlyHint": true, "openWorldHint": false, "destructiveHint": false },
  "justifications": {
    "read_only_justification": "Lists Agent-stage task metadata (status, lease, timeout) visible to the connected workspace credential; it never returns payload data.",
    "open_world_justification": "Reads the connected workspace's task worklist only; no public internet access.",
    "destructive_justification": "Metadata listing; nothing is claimed, changed, or deleted."
  }
},
"talonic_get_agent_task": {
  "annotations": { "readOnlyHint": true, "openWorldHint": false, "destructiveHint": false },
  "justifications": {
    "read_only_justification": "Fetches one task's immutable input snapshot, instructions and output contract; the read is audited by the platform.",
    "open_world_justification": "Reads the connected workspace's own task; no public internet access.",
    "destructive_justification": "Read-only fetch; the task, its lease and its document are unchanged."
  }
},
"talonic_claim_agent_task": {
  "annotations": { "readOnlyHint": false, "openWorldHint": false, "destructiveHint": false },
  "justifications": {
    "read_only_justification": "Takes a time-limited lease on an available task so this agent can work it; the platform rejects conflicting claims with HTTP 409.",
    "open_world_justification": "Acts on the connected workspace's own task queue; no public internet access.",
    "destructive_justification": "A lease is reversible: it expires automatically and can be reclaimed; no data is deleted or overwritten."
  }
},
"talonic_heartbeat_agent_task": {
  "annotations": { "readOnlyHint": false, "openWorldHint": false, "destructiveHint": false },
  "justifications": {
    "read_only_justification": "Extends the current lease on a task this agent already claimed, using the execution epoch from the claim.",
    "open_world_justification": "Acts on the connected workspace's own task; no public internet access.",
    "destructive_justification": "Only moves the lease expiry forward; nothing is deleted or overwritten."
  }
},
"talonic_submit_agent_task": {
  "annotations": { "readOnlyHint": false, "openWorldHint": false, "destructiveHint": false },
  "justifications": {
    "read_only_justification": "Writes the declared output fields for a claimed task and resumes the parked document's pipeline.",
    "open_world_justification": "Writes to the connected workspace's own pipeline; no public internet access.",
    "destructive_justification": "Adds new cell values validated against the task's declared contract; existing data is versioned, not deleted, and the platform rejects undeclared fields."
  }
}
```

Append to `"test_cases"`:

```json
{
  "description": "Estimate cost before a batch using the pricing catalog and current usage.",
  "user_prompt": "How much would it cost to extract 200 invoices, and how many credits did we use this month?",
  "file_attachment_urls": null,
  "tools_triggered": "talonic_get_pricing, talonic_get_usage, talonic_get_balance",
  "expected_output": "Shows the pricing card with per-unit credit rates, the usage breakdown card for the trailing 30 days, and the balance card, then answers with an estimate.",
  "expected_output_url": null
},
{
  "description": "Work the Agent-stage task loop end to end.",
  "user_prompt": "Are there any Talonic agent tasks waiting for me? If so, claim the first one, tell me what it needs, and submit an approval decision of 'approve' with a short note.",
  "file_attachment_urls": null,
  "tools_triggered": "talonic_list_agent_tasks, talonic_get_agent_task, talonic_claim_agent_task, talonic_heartbeat_agent_task, talonic_submit_agent_task",
  "expected_output": "Shows the worklist card, the task card with instructions and output contract, the lease card with the execution epoch, and the submitted confirmation; the document resumes its pipeline.",
  "expected_output_url": null
}
```

Also confirm the existing test cases already trigger `talonic_list_fields`, `talonic_get_field`, `talonic_field_values`, `talonic_find_data`, `talonic_list_agent_tools`, `talonic_invoke_agent_tool` (they were added 2026-09-05). If any of the 22 is still missing from the union of `tools_triggered`, add a test case for it in the same format.

- [ ] **Step 4: Collateral**

`docs/chatgpt-apps-sdk/listing-copy.md`: replace the `## Tool list (9)` section with `## Tool list (22)` grouped as **Extraction & documents** (extract, request_upload, to_markdown, get_document, search, filter), **Schemas** (list_schemas, save_schema), **Metering** (get_balance, get_pricing, get_usage), **Field Registry** (list_fields, get_field, field_values, find_data), **Platform agent tools** (list_agent_tools, invoke_agent_tool), **Agent tasks** (list, get, claim, heartbeat, submit) — one line each: `` `talonic_x` — what it does (widget-enabled) ``. Every line ends with "(widget-enabled)".

`docs/chatgpt-apps-sdk/developer-mode-testing.md`: append a section `## Post-release card checklist (22)` — a markdown table with columns Tool · Prompt to trigger · Card must show · ✓, one row per tool, prompts taken from the manifest test cases, "Card must show" taken from `WIDGET_DESCRIPTIONS`.

`docs/chatgpt-apps-sdk/submission-record.md`: append

```md
## 2026-09-22 — widget parity restored at 22 tools

The live surface grew to 22 tools (0.1.75 agent tasks, 0.1.76 Field Registry) while only the original 11 had cards. This change adds the eleven missing widgets, `openai/toolInvocation/*` status strings on every tool, `openai/widgetDescription` + `openai/widgetPrefersBorder` on every widget resource, and brings `chatgpt-app-submission.json` to the full 22 (test-locked against the server: `tests/submission-manifest.test.ts`).

OpenAI's current guidance (developers.openai.com/apps-sdk/deploy/submission): tool definitions are re-fetched periodically — "New and changed tool definitions become available after automated checks pass" — while listing metadata changes "require a new version, review, and publication". So: the new cards go live on their own after the deploy; only if we change the listing text do we resubmit. Reconnect the connector after deploy (ChatGPT caches `tools/list` at connect time), then run the 22-row checklist in `developer-mode-testing.md`.
```

Screenshots: `git rm --cached -q docs/chatgpt-apps-sdk/.DS_Store 2>/dev/null; rm -f docs/chatgpt-apps-sdk/.DS_Store`; ensure `.gitignore` contains `.DS_Store`; `git add docs/chatgpt-apps-sdk/screenshots/*.png`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/submission-manifest.test.ts` → PASS. Run: `npm test` → green. Run: `node -e "JSON.parse(require('fs').readFileSync('chatgpt-app-submission.json','utf8')); console.log('manifest ok')"`.

- [ ] **Step 6: Commit**

```bash
git add chatgpt-app-submission.json docs/chatgpt-apps-sdk tests/submission-manifest.test.ts .gitignore
git commit -m "docs(chatgpt): submission manifest at 22 tools (test-locked), listing copy + 22-card checklist, screenshots committed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: ChatGPT preflight script, repo docs, final verification

**Files:**
- Create: `scripts/chatgpt-preflight.mjs`
- Modify: `package.json` (script `"preflight:chatgpt": "node scripts/chatgpt-preflight.mjs"`), `CHANGELOG.md` (Unreleased), `AGENTS.md` (widget map + counts), `README.md` (if it states a widget count)

- [ ] **Step 1: Write `scripts/chatgpt-preflight.mjs`**

```js
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

const child = spawn(process.execPath, ["dist/http-server.js"], {
  env: { ...process.env, PORT: String(port), TALONIC_BASE_URL: "http://127.0.0.1:9" },
  stdio: ["ignore", "pipe", "pipe"],
})
let logs = ""
child.stdout.on("data", (d) => (logs += d))
child.stderr.on("data", (d) => (logs += d))

const base = `http://127.0.0.1:${port}`
const failures = []
try {
  let up = false
  for (let i = 0; i < 50 && !up; i++) {
    try {
      up = (await fetch(`${base}/health`)).ok
    } catch {
      await sleep(100)
    }
  }
  if (!up) throw new Error(`server did not come up on ${base}\n${logs}`)

  const rpc = async (body, headers) => {
    const res = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
      body: JSON.stringify(body),
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
}

if (failures.length) {
  console.error("PREFLIGHT FAILED:\n - " + failures.join("\n - "))
  process.exit(1)
}
console.log("PREFLIGHT OK — ChatGPT will see 22 tools, each with a fetchable widget template.")
```

Add to `package.json` scripts: `"preflight:chatgpt": "node scripts/chatgpt-preflight.mjs"`.

- [ ] **Step 2: Run it**

Run: `npm run build && npm run preflight:chatgpt`
Expected: `PREFLIGHT OK — ChatGPT will see 22 tools, each with a fetchable widget template.` If it reports missing `title`, note that the registry/agent tools set `title` at the tool level (the MCP SDK forwards it), which the check accepts.

- [ ] **Step 3: Repo docs**

`CHANGELOG.md` → under `## [Unreleased]` → `### Added`, prepend:

```md
- **Widget parity at 22 tools.** Eleven new ChatGPT Apps SDK cards: Field Registry list / concept card / values, find-data planes, agent-tool registry, shape-adaptive agent-tool result, agent-task worklist, task card, lease card (claim + heartbeat) and submit confirmation. Every public tool now declares `openai/toolInvocation/invoking|invoked` status text; every widget resource carries `openai/widgetDescription` and `openai/widgetPrefersBorder`. Locked by `tests/widgets/all-widgets.test.ts` (22/22), jsdom render tests per widget (`tests/widgets/render/`), template hygiene and hosted fast-path tests, and `scripts/chatgpt-preflight.mjs`.
- **`chatgpt-app-submission.json` describes all 22 tools** and is test-locked to the server's annotations (`tests/submission-manifest.test.ts`).
```

and under `### Fixed`, prepend:

```md
- **Raw-fetch tools now carry the `talonic-mcp/<v> <client>` User-Agent tag.** Field Registry, agent-tool, agent-task, upload-session and webhook-reference calls bypassed the tagged fetch, so the platform funnel could not attribute their client surface.
```

`AGENTS.md`: in the repo map change `widgets/*.ts        ChatGPT Apps SDK widget HTML (extraction-result card)` → `widgets/*.ts        ChatGPT Apps SDK widget HTML — one card per public tool (22); registry in widgets/types.ts + widgets/register.ts`. In the tools section replace the sentence starting "Read-only hints are locked by a regression test" with: "Annotations are locked by `tests/widgets/tool-annotations.test.ts` (15 read-only lookup tools, 7 write-capable); every public tool renders a widget (`tests/widgets/all-widgets.test.ts`, 22/22) and declares Apps SDK status strings. Adding a tool = also adding a widget: one `WIDGET_URIS` key + description + status in `src/widgets/types.ts`, one entry in `src/widgets/register.ts`, `_meta: widgetToolMeta(key)` on the tool, a fixture + render test under `tests/widgets/`, and an entry in `chatgpt-app-submission.json`." Add `npm run preflight:chatgpt   # boot dist/http-server.js, check 22 tools + every template like ChatGPT does` to the Quick commands block.

`README.md`: `grep -n -i widget README.md` — if it states a widget count or "eleven", update to 22 / "every tool".

- [ ] **Step 4: Final verification**

```bash
npm run typecheck && npm run format:check && npm test && npm run build && npm run preflight:chatgpt
git status --short   # only intended files; no stray fixtures/scratch
```

All green. Record the test count from `npm test` output for the report.

- [ ] **Step 5: Commit**

```bash
git add scripts/chatgpt-preflight.mjs package.json CHANGELOG.md AGENTS.md README.md
git commit -m "chore(chatgpt): preflight script + changelog/agents docs for 22-widget parity

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

**Do not push.** Report to Hamlet with: test count, preflight output, the list of commits, and the note that the push is the release that makes the cards visible in ChatGPT.
