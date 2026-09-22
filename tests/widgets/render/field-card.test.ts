import { describe, expect, it } from "vitest"
import { getFieldCardWidgetHtml } from "../../../src/widgets/field-card"
import { loadFixture, renderWidget } from "./harness"

describe("field-card widget", () => {
  it("renders the concept card: name, chips, definition, synonyms, stats, top values, resolution", () => {
    const r = renderWidget(getFieldCardWidgetHtml(), loadFixture("get-field"))
    expect(r.text).toContain("Invoice Number")
    expect(r.text).toContain("invoice_number")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("core")
    expect(r.text).toContain("tier 1")
    expect(r.text).toContain("link key")
    expect(r.text).toContain("Extract the invoice number exactly as printed")
    expect(r.text).toContain("rechnungsnummer")
    expect(r.text).toContain("1116")
    expect(r.text).toContain("855")
    expect(r.text).toContain("15.4%")
    expect(r.text).toContain("164")
    expect(r.text).toContain("INV-2026-04417")
    expect(r.text).toContain("65%")
    expect(r.text).toContain("Resolved by synonym")
    expect(r.text).toContain("redirected from invoice_no")
  })

  it("renders without optional sections when the card is minimal", () => {
    const r = renderWidget(getFieldCardWidgetHtml(), {
      id: "x",
      canonical_name: "plain_field",
      data_type: "string",
      maturity: "candidate",
    })
    expect(r.text).toContain("plain_field")
    expect(r.text).toContain("No definition recorded.")
    expect(r.document.querySelectorAll("table")).toHaveLength(0)
  })

  it("shows the empty state for an empty payload", () => {
    expect(renderWidget(getFieldCardWidgetHtml(), {}).text).toBe("No field card.")
  })
})
