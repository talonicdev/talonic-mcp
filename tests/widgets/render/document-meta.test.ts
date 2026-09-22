import { describe, expect, it } from "vitest"
import { getDocumentMetaWidgetHtml } from "../../../src/widgets/document-meta"
import { loadFixture, renderWidget } from "./harness"

describe("document-meta widget", () => {
  it("renders filename, metadata line, status and triage flags", () => {
    const r = renderWidget(getDocumentMetaWidgetHtml(), loadFixture("document-meta"))
    expect(r.text).toContain("invoice-0421.pdf")
    expect(r.text).toContain("2 pages")
    expect(r.text).toContain("invoice")
    expect(r.text).toContain("180 KB")
    expect(r.text).toContain("completed")
    expect(r.text).toContain("d0c00001-0000-4000-8000-000000000010")
    expect(r.text).toContain("3")
    expect(r.text).toContain("Sensitivity: internal")
    expect(r.text).toContain("PII detected")
    expect(r.text).toContain("Jurisdiction: EU")
    expect(r.text).not.toContain("Regulated data")
  })

  it("renders the Document fallback title and no triage chips for an empty payload", () => {
    const r = renderWidget(getDocumentMetaWidgetHtml(), {})
    expect(r.text).toContain("Document")
    expect(r.text).not.toContain("Sensitivity")
    expect(r.text).not.toContain("PII detected")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getDocumentMetaWidgetHtml(), {
      id: 5,
      filename: 123,
      pages: "two",
      size_bytes: "big",
      type_detected: 7,
      language_detected: 8,
      status: 9,
      triage: "not-an-object",
      extraction_count: "three",
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
