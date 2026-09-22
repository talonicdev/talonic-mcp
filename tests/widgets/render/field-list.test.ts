import { describe, expect, it } from "vitest"
import { getFieldListWidgetHtml } from "../../../src/widgets/field-list"
import { loadFixture, renderWidget } from "./harness"

describe("field-list widget", () => {
  it("renders one row per field with maturity, type and occurrences", () => {
    const r = renderWidget(getFieldListWidgetHtml(), loadFixture("list-fields"))
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(r.text).toContain("Field Registry")
    expect(r.text).toContain("3 of 8406 fields")
    expect(r.text).toContain("Invoice Number")
    expect(r.text).toContain("vendor_vat_id") // falls back to canonical_name
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("core")
    expect(r.document.querySelector(".chip.info")?.textContent).toBe("proven")
    expect(r.document.querySelector(".chip.warn")?.textContent).toBe("candidate")
    expect(r.text).toContain("superseded")
    expect(r.text).toContain("1116")
    expect(r.text).toContain("more available")
  })

  it("shows the empty state for an empty page", () => {
    const r = renderWidget(getFieldListWidgetHtml(), { data: [], pagination: { total: 0 } })
    expect(r.text).toBe("No fields match.")
  })

  it("survives a malformed payload without throwing", () => {
    const r = renderWidget(getFieldListWidgetHtml(), { data: "nope", pagination: 7 })
    expect(r.text).toBe("No fields match.")
  })
})
