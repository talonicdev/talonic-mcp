import { describe, expect, it } from "vitest"
import { getMarkdownViewWidgetHtml } from "../../../src/widgets/markdown-view"
import { loadFixture, renderWidget } from "./harness"

describe("markdown-view widget", () => {
  it("renders the document id and markdown text with a copy button", () => {
    const r = renderWidget(getMarkdownViewWidgetHtml(), loadFixture("markdown-view"))
    expect(r.text).toContain("Document markdown")
    expect(r.text).toContain("d0c00001-0000-4000-8000-000000000010")
    expect(r.text).toContain("Invoice INV-2026-04417")
    expect(r.text).toContain("Musterfirma AG")
    expect(r.document.getElementById("copy-md")).not.toBeNull()
  })

  it("shows the no-text fallback for an empty payload", () => {
    expect(renderWidget(getMarkdownViewWidgetHtml(), {}).text).toContain("(no text content)")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getMarkdownViewWidgetHtml(), {
      markdown: 12345,
      document_id: { not: "a string" },
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
