import { describe, expect, it } from "vitest"
import { getFieldValuesWidgetHtml } from "../../../src/widgets/field-values"
import { loadFixture, renderWidget } from "./harness"

describe("field-values widget", () => {
  it("renders value rows with document, confidence and provenance", () => {
    const r = renderWidget(getFieldValuesWidgetHtml(), loadFixture("field-values"))
    expect(r.text).toContain("invoice_number")
    expect(r.text).toContain("2 of 1116 values")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(r.text).toContain("INV-2026-04417")
    expect(r.text).toContain("invoice-0421.pdf")
    expect(r.text).toContain("Credit Note")
    expect(r.text).toContain("95%")
    expect(r.text).toContain("62%")
    expect(r.document.querySelector(".bar.bad")).not.toBeNull() // 0.62 < 0.7
    expect(r.text).toContain("Rechnungsnummer: RE-88120")
    expect(r.text).toContain("needs confirmation")
    expect(r.text).toContain("via redirect")
    expect(r.text).toContain("more available")
  })

  it("names the field in the empty state", () => {
    const r = renderWidget(getFieldValuesWidgetHtml(), { canonical_name: "vat_rate", data: [] })
    expect(r.text).toBe("No values recorded for vat_rate.")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getFieldValuesWidgetHtml(), { data: [null, 5, "x"] })
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(3)
  })
})
