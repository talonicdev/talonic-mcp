import { describe, expect, it } from "vitest"
import { getWidgetTemplateHtml } from "../../src/widgets/register"
import { WIDGET_URIS, type WidgetKey } from "../../src/widgets/types"
import { loadFixture, renderWidget } from "./render/harness"

/**
 * Generic hostile-payload lock: every widget must render a fully-escaped
 * card even when every string in its payload is an XSS attempt. This does
 * not replace the widget-specific tests (which assert real content); it is
 * a blanket net across all 22 widgets so a future widget that forgets `esc()`
 * fails loudly here.
 */
const HOSTILE = "<img src=x onerror=window.__pwned=1>\"'<svg/onload=1>"

/** Recursively replace every string value in a fixture with the hostile string. */
function hostileClone(value: unknown): unknown {
  if (typeof value === "string") return HOSTILE
  if (Array.isArray(value)) return value.map(hostileClone)
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = hostileClone(v)
    return out
  }
  return value
}

/**
 * Widget key -> fixture basename (in `tests/widgets/fixtures/`) supplying a
 * realistic payload shape to hostile-clone. `claimAgentTask` reuses the
 * `get-agent-task` fixture, same as its own render test.
 */
const FIXTURE_BY_WIDGET_KEY: Readonly<Record<WidgetKey, string>> = {
  extract: "extraction-result",
  search: "search-results",
  filter: "filter-results",
  getDocument: "document-meta",
  toMarkdown: "markdown-view",
  listSchemas: "schema-list",
  saveSchema: "schema-saved",
  getBalance: "balance",
  getPricing: "pricing",
  getUsage: "usage",
  requestUpload: "upload-link",
  listFields: "list-fields",
  getField: "get-field",
  fieldValues: "field-values",
  findData: "find-data",
  listAgentTools: "list-agent-tools",
  invokeAgentTool: "invoke-agent-tool-rows",
  listAgentTasks: "list-agent-tasks",
  getAgentTask: "get-agent-task",
  claimAgentTask: "get-agent-task",
  heartbeatAgentTask: "heartbeat-agent-task",
  submitAgentTask: "submit-agent-task",
}

describe("widget XSS lock: hostile string payloads never inject markup or execute", () => {
  const keys = Object.keys(WIDGET_URIS) as WidgetKey[]

  it("covers every widget key with a fixture mapping", () => {
    for (const key of keys) expect(FIXTURE_BY_WIDGET_KEY[key], key).toBeTruthy()
  })

  for (const key of keys) {
    it(`${key}: renders a hostile payload with zero live markup`, () => {
      const uri = WIDGET_URIS[key]
      const html = getWidgetTemplateHtml(uri)
      expect(html, `template for ${uri}`).toBeDefined()

      const fixture = loadFixture(FIXTURE_BY_WIDGET_KEY[key])
      const hostilePayload = hostileClone(fixture)

      const r = renderWidget(html as string, hostilePayload)

      expect(r.document.querySelectorAll("img, svg").length).toBe(0)

      const root = r.document.getElementById("root")
      const withHandlers = root ? root.querySelectorAll("[onerror], [onload]") : []
      expect(withHandlers.length).toBe(0)

      expect((r.window as { __pwned?: unknown }).__pwned).toBeUndefined()
    })
  }
})
