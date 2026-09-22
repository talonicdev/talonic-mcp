import { describe, expect, it } from "vitest"
import { getExtractionResultWidgetHtml } from "../../../src/widgets/extraction-result"
import { loadFixture, renderWidget } from "./harness"

describe("extraction-result widget", () => {
  it("renders document meta, extracted fields and confidence bars", () => {
    const r = renderWidget(getExtractionResultWidgetHtml(), loadFixture("extraction-result"))
    expect(r.text).toContain("invoice-0421.pdf")
    expect(r.text).toContain("2 pages")
    expect(r.text).toContain("invoice")
    expect(r.text).toContain("en")
    expect(r.text).toContain("Overall")
    expect(r.text).toContain("92%")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(4)
    expect(r.text).toContain("Musterfirma AG")
    expect(r.text).toContain("INV-2026-04417")
    expect(r.text).toContain("1299")
    expect(r.text).toContain("95%")
    expect(r.document.getElementById("copy-json")).not.toBeNull()
    expect(r.document.getElementById("download-json")).not.toBeNull()
  })

  it("shows the no-fields fallback and Document title for an empty payload", () => {
    const r = renderWidget(getExtractionResultWidgetHtml(), {})
    expect(r.text).toContain("Document")
    expect(r.text).toContain("No fields extracted.")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getExtractionResultWidgetHtml(), {
      document: "not-an-object",
      data: [1, 2, 3],
      confidence: "not-an-object",
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
