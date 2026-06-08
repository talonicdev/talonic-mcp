import { describe, expect, it } from "vitest"
import { createServer } from "../../src/server-factory"
import { WIDGET_URIS, WIDGET_MIME } from "../../src/widgets/types"

// Every tool now renders a branded inline widget. This locks the full mapping:
// tool name -> outputTemplate URI -> a registered widget resource.
const TOOL_WIDGET_MAP: Array<[string, string]> = [
  ["talonic_extract", WIDGET_URIS.extract],
  ["talonic_search", WIDGET_URIS.search],
  ["talonic_filter", WIDGET_URIS.filter],
  ["talonic_get_document", WIDGET_URIS.getDocument],
  ["talonic_to_markdown", WIDGET_URIS.toMarkdown],
  ["talonic_list_schemas", WIDGET_URIS.listSchemas],
  ["talonic_save_schema", WIDGET_URIS.saveSchema],
  ["talonic_get_balance", WIDGET_URIS.getBalance],
  ["talonic_request_upload", WIDGET_URIS.requestUpload],
]

function buildServer() {
  return createServer({ apiKey: "tlnc_test" }) as any
}

describe("every tool declares its widget as outputTemplate", () => {
  it.each(TOOL_WIDGET_MAP)("%s -> %s", (toolName, uri) => {
    const server = buildServer()
    const tool = server._registeredTools[toolName]
    expect(tool, `${toolName} not registered`).toBeDefined()
    expect(tool._meta?.ui?.resourceUri).toBe(uri)
    expect(tool._meta?.["openai/outputTemplate"]).toBe(uri)
  })
})

describe("every widget resource is registered correctly", () => {
  it.each(TOOL_WIDGET_MAP)("resource for %s (%s)", async (_toolName, uri) => {
    const server = buildServer()
    const resource = server._registeredResources[uri]
    expect(resource, `no resource registered at ${uri}`).toBeDefined()

    const result = await resource.readCallback(new URL(uri))
    const item = result.contents[0]

    // Correct MIME and self-referential URI.
    expect(item.mimeType).toBe(WIDGET_MIME)
    expect(item.uri).toBe(uri)

    // Valid, self-contained HTML document.
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

    // Submission metadata: unique domain + CSP, modern keys + OpenAI aliases.
    const meta = item._meta
    expect(meta.ui?.domain).toBe("https://talonic.com")
    expect(meta.ui?.csp?.connectDomains).toEqual([])
    expect(meta["openai/widgetDomain"]).toBe("https://talonic.com")
    expect(meta["openai/widgetCSP"]?.connect_domains).toEqual([])
  })
})

describe("widget coverage is complete", () => {
  it("registers exactly one widget per tool (9 total)", () => {
    const server = buildServer()
    const widgetUris = Object.values(WIDGET_URIS)
    expect(widgetUris).toHaveLength(9)
    for (const uri of widgetUris) {
      expect(server._registeredResources[uri], `missing widget ${uri}`).toBeDefined()
    }
  })
})
