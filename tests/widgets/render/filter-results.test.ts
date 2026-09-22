import { describe, expect, it } from "vitest"
import { getFilterResultsWidgetHtml } from "../../../src/widgets/filter-results"
import { loadFixture, renderWidget } from "./harness"

describe("filter-results widget", () => {
  it("renders matching documents as a table with a warning banner", () => {
    const r = renderWidget(getFilterResultsWidgetHtml(), loadFixture("filter-results"))
    expect(r.text).toContain("Filtered documents")
    expect(r.document.querySelector(".header .chip")?.textContent).toBe("2")
    expect(r.text).toContain("invoice-0421.pdf")
    expect(r.text).toContain("Musterfirma AG")
    expect(r.text).toContain("invoice-0422.pdf")
    expect(r.text).toContain("Beispiel GmbH")
    expect(r.text).toContain("430.5")
    expect(r.text).toContain("typed as string")
    expect(r.text).toContain("Re-type total_amount as number")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
  })

  it("shows the no-matches state for an empty payload", () => {
    const r = renderWidget(getFilterResultsWidgetHtml(), {})
    expect(r.document.querySelector(".header .chip")?.textContent).toBe("0")
    expect(r.text).toContain("No documents matched the filter.")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getFilterResultsWidgetHtml(), {
      data: [{ document_id: 5, filename: 123, fields: "not-an-object" }, "bad-row"],
      total: "two",
      warnings: [{ message: 456, suggestion: 789 }, "bad-warning"],
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
