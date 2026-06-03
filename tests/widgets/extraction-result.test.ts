import { describe, expect, it } from "vitest"
import {
  EXTRACTION_RESULT_WIDGET_URI,
  EXTRACTION_RESULT_WIDGET_MIME,
} from "../../src/widgets/types"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { getExtractionResultWidgetHtml } from "../../src/widgets/extraction-result"
import { registerExtractionResultWidget } from "../../src/widgets/register"
import { createServer } from "../../src/server-factory"

describe("widget URI constants", () => {
  it("exports the extraction-result widget URI", () => {
    expect(EXTRACTION_RESULT_WIDGET_URI).toBe("ui://widget/extraction-result.html")
  })

  it("exports the Apps SDK widget MIME type", () => {
    expect(EXTRACTION_RESULT_WIDGET_MIME).toBe("text/html;profile=mcp-app")
  })
})

describe("getExtractionResultWidgetHtml", () => {
  it("returns a non-empty HTML document", () => {
    const html = getExtractionResultWidgetHtml()
    expect(html).toMatch(/^<!doctype html>/i)
    expect(html.length).toBeGreaterThan(500)
  })

  it("reads tool output from the Apps SDK window.openai channel", () => {
    const html = getExtractionResultWidgetHtml()
    // OpenAI's Apps SDK delivers structuredContent as window.openai.toolOutput
    // and fires "openai:set_globals" on update. This is the primary, documented
    // data channel — NOT the raw postMessage path.
    expect(html).toContain("window.openai")
    expect(html).toContain("toolOutput")
    expect(html).toContain("openai:set_globals")
    expect(html).toContain("addEventListener")
  })

  it("keeps the postMessage bridge as a fallback channel", () => {
    const html = getExtractionResultWidgetHtml()
    // Some host versions also post the raw MCP bridge notification; we keep
    // it as a belt-and-suspenders fallback behind the window.openai path.
    expect(html).toContain("ui/notifications/tool-result")
  })

  it("does not contain any 'tlnc_' API-key-looking strings", () => {
    const html = getExtractionResultWidgetHtml()
    expect(html).not.toMatch(/tlnc_[a-z]/i)
  })

  it("does not contain the word 'Authorization' (no header leakage)", () => {
    const html = getExtractionResultWidgetHtml()
    expect(html).not.toContain("Authorization")
  })

  it("renders 'data', 'confidence', and 'document' field names from the payload contract", () => {
    const html = getExtractionResultWidgetHtml()
    expect(html).toContain("data")
    expect(html).toContain("confidence")
    expect(html).toContain("document")
  })

  it("matches snapshot (catches unintended layout drift)", () => {
    expect(getExtractionResultWidgetHtml()).toMatchSnapshot()
  })
})

describe("registerExtractionResultWidget", () => {
  it("registers a resource at the widget URI with the Apps SDK MIME type", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" })
    registerExtractionResultWidget(server)

    const result = await (server as any)._registeredResources[
      EXTRACTION_RESULT_WIDGET_URI
    ].readCallback(new URL(EXTRACTION_RESULT_WIDGET_URI))

    expect(result.contents).toHaveLength(1)
    expect(result.contents[0].mimeType).toBe(EXTRACTION_RESULT_WIDGET_MIME)
    expect(result.contents[0].uri).toBe(EXTRACTION_RESULT_WIDGET_URI)
    expect(result.contents[0].text).toContain("<!doctype html>")
  })

  it("declares a Content Security Policy on the widget resource", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" })
    registerExtractionResultWidget(server)

    const result = await (server as any)._registeredResources[
      EXTRACTION_RESULT_WIDGET_URI
    ].readCallback(new URL(EXTRACTION_RESULT_WIDGET_URI))

    const meta = result.contents[0]._meta
    expect(meta).toBeDefined()
    // Modern key and legacy ChatGPT key both present. The widget makes no
    // external calls, so all domain lists are empty — but the CSP must be
    // declared (ChatGPT shows "CSP off" otherwise, and submission requires it).
    expect(meta.ui?.csp).toBeDefined()
    expect(meta.ui.csp.connectDomains).toEqual([])
    expect(meta["openai/widgetCSP"]).toBeDefined()
    expect(meta["openai/widgetCSP"].connect_domains).toEqual([])
  })

  it("declares a unique widget domain (required for app submission)", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" })
    registerExtractionResultWidget(server)

    const result = await (server as any)._registeredResources[
      EXTRACTION_RESULT_WIDGET_URI
    ].readCallback(new URL(EXTRACTION_RESULT_WIDGET_URI))

    const meta = result.contents[0]._meta
    // A unique HTTPS origin is required to submit the app. ChatGPT renders the
    // widget under <domain>.web-sandbox.oaiusercontent.com for iframe isolation.
    // Standard key + OpenAI alias, both a full https origin.
    expect(meta.ui?.domain).toBe("https://talonic.com")
    expect(meta["openai/widgetDomain"]).toBe("https://talonic.com")
  })
})

describe("talonic_extract widget linkage", () => {
  it("declares the extraction-result widget as outputTemplate", () => {
    const server = createServer({ apiKey: "tlnc_test" })
    const tool = (server as any)._registeredTools["talonic_extract"]
    expect(tool).toBeDefined()
    expect(tool._meta).toBeDefined()
    expect(tool._meta["openai/outputTemplate"]).toBe(EXTRACTION_RESULT_WIDGET_URI)
  })
})
