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
