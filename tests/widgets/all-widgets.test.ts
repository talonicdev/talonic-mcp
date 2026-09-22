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
    expect(tool._meta?.["openai/toolInvocation/invoking"]).toBe(
      TOOL_INVOCATION_STATUS[key].invoking,
    )
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
  it("registers exactly one widget per public tool (29 total) and nothing else under ui://widget/", () => {
    const server = buildServer()
    expect(TOOL_WIDGET_MAP).toHaveLength(29)
    expect(Object.values(WIDGET_URIS)).toHaveLength(29)
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
