import { describe, expect, it } from "vitest"
import {
  EXTRACTION_RESULT_WIDGET_URI,
  EXTRACTION_RESULT_WIDGET_MIME,
} from "../../src/widgets/types"
import { getExtractionResultWidgetHtml } from "../../src/widgets/extraction-result"

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

  it("listens for the Apps SDK tool-result notification", () => {
    const html = getExtractionResultWidgetHtml()
    // The widget bridge sends 'ui/notifications/tool-result' over postMessage.
    expect(html).toContain("ui/notifications/tool-result")
    expect(html).toContain("addEventListener")
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
