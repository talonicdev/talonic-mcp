import { describe, expect, it } from "vitest"
import { JSDOM } from "jsdom"
import { getWidgetTemplateHtml } from "../../../src/widgets/register"
import { WIDGET_URIS } from "../../../src/widgets/types"
import { getBalanceWidgetHtml } from "../../../src/widgets/balance"

/**
 * Drive a widget the way Claude (an MCP Apps host) does: the widget lives in
 * an iframe, must send ui/initialize, then ui/notifications/initialized, and
 * only then receives ui/notifications/tool-result. No window.openai exists.
 */
function mountInFakeHost(html: string) {
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true })
  const win = dom.window as any
  const sent: any[] = []
  const parent = { postMessage: (m: unknown) => sent.push(m) }
  Object.defineProperty(win, "parent", { value: parent, configurable: true })
  for (const s of Array.from(win.document.querySelectorAll("script"))) {
    win.eval((s as HTMLScriptElement).textContent ?? "")
  }
  const deliver = (data: unknown) =>
    win.dispatchEvent(new win.MessageEvent("message", { data, source: parent }))
  const text = () =>
    (win.document.getElementById("root")?.textContent ?? "").replace(/\s+/g, " ").trim()
  return { win, sent, deliver, text }
}

const balancePayload = {
  balance_credits: 1000,
  eur_value: 1,
  tier: "enterprise",
}

describe("MCP Apps host handshake (Claude)", () => {
  it("sends ui/initialize first, nothing else", () => {
    const h = mountInFakeHost(getBalanceWidgetHtml())
    expect(h.sent).toHaveLength(1)
    expect(h.sent[0].method).toBe("ui/initialize")
    expect(h.sent[0].params.protocolVersion).toBe("2026-01-26")
    expect(h.sent[0].params.appCapabilities).toEqual({})
    expect(h.sent[0].id).toBeTruthy()
  })

  it("acknowledges initialize, applies host theme, then renders the tool result", () => {
    const h = mountInFakeHost(getBalanceWidgetHtml())
    const initId = h.sent[0].id
    h.deliver({ jsonrpc: "2.0", id: initId, result: { hostContext: { theme: "dark" } } })
    expect(h.sent.map((m) => m.method)).toContain("ui/notifications/initialized")
    expect(h.win.document.documentElement.getAttribute("data-theme")).toBe("dark")

    expect(h.text()).toBe("Loading…")
    h.deliver({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { content: [{ type: "text", text: "x" }], structuredContent: balancePayload },
    })
    expect(h.text()).not.toBe("Loading…")
    expect(h.text()).toContain("1,000")
  })

  it("falls back to JSON in content[0].text when structuredContent is absent", () => {
    const h = mountInFakeHost(getBalanceWidgetHtml())
    h.deliver({ jsonrpc: "2.0", id: h.sent[0].id, result: {} })
    h.deliver({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { content: [{ type: "text", text: JSON.stringify(balancePayload) }] },
    })
    expect(h.text()).toContain("1,000")
  })

  it("shows the tool error text instead of a blank card", () => {
    const h = mountInFakeHost(getBalanceWidgetHtml())
    h.deliver({ jsonrpc: "2.0", id: h.sent[0].id, result: {} })
    h.deliver({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { isError: true, content: [{ type: "text", text: "Out of credits." }] },
    })
    expect(h.text()).toBe("Out of credits.")
  })

  it("answers host requests such as ui/resource-teardown", () => {
    const h = mountInFakeHost(getBalanceWidgetHtml())
    h.deliver({ jsonrpc: "2.0", id: 99, method: "ui/resource-teardown", params: {} })
    expect(h.sent.find((m) => m.id === 99)).toEqual({ jsonrpc: "2.0", id: 99, result: {} })
  })

  it("ignores messages that do not come from the parent frame", () => {
    const h = mountInFakeHost(getBalanceWidgetHtml())
    h.win.dispatchEvent(
      new h.win.MessageEvent("message", {
        data: {
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: { structuredContent: balancePayload },
        },
        source: null,
      }),
    )
    expect(h.text()).toBe("Loading…")
  })

  it("every widget template performs the handshake", () => {
    for (const uri of Object.values(WIDGET_URIS)) {
      const html = getWidgetTemplateHtml(uri)!
      const h = mountInFakeHost(html)
      expect(h.sent[0]?.method, uri).toBe("ui/initialize")
      expect(html, uri).toContain('name="color-scheme"')
    }
  })
})
