import { describe, expect, it } from "vitest"
import { getSearchResultsWidgetHtml } from "../../../src/widgets/search-results"
import { loadFixture, renderWidget } from "./harness"

describe("search-results widget", () => {
  it("groups matches by type with a total chip", () => {
    const r = renderWidget(getSearchResultsWidgetHtml(), loadFixture("search-results"))
    expect(r.text).toContain("Search results")
    expect(r.document.querySelector(".header .chip")?.textContent).toBe("5")
    expect(r.text).toContain("Documents (1)")
    expect(r.text).toContain("Fields (2)")
    expect(r.text).toContain("Schemas (1)")
    expect(r.text).toContain("Sources (1)")
    expect(r.text).toContain("invoice-0421.pdf")
    expect(r.text).toContain("Total Amount")
    expect(r.text).toContain("Vendor Name")
    expect(r.text).toContain("Invoice Schema")
    expect(r.text).toContain("filterable")
  })

  it("shows the empty state when nothing matched", () => {
    expect(renderWidget(getSearchResultsWidgetHtml(), {}).text).toBe("No matches found.")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getSearchResultsWidgetHtml(), {
      documents: [{ id: 5, name: 123, sourceName: 456 }],
      fieldMatches: "not-an-array",
      fields: [{ id: 5, canonicalName: 123, displayName: 456, dataType: 7, filterable: "yes" }],
      sources: ["not-an-object"],
      schemas: [42],
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
