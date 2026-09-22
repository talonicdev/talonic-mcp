import { describe, expect, it } from "vitest"
import { getDecisionPackageWidgetHtml } from "../../../src/widgets/decision-package"
import { loadFixture, renderWidget } from "./harness"

describe("decision-package widget", () => {
  it("renders the page: records table, pagination, documents", () => {
    const r = renderWidget(getDecisionPackageWidgetHtml(), loadFixture("decision-package"))
    expect(r.text).toContain("Decision package")
    expect(r.text).toContain("2 of 3 records")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(r.text).toContain("cell:inv-0421/total_amount")
    expect(r.text).toContain("more pages")
    expect(r.text).toContain("Next page cursor")
    expect(r.text).toContain("Source documents (1)")
  })

  it("shows a no-records message for an empty page", () => {
    const r = renderWidget(getDecisionPackageWidgetHtml(), {
      task_id: "7d3c0001-0000-4000-8000-000000000001",
      run_id: "a9000001-0000-4000-8000-000000000001",
      record_count: 0,
      data: [],
      pagination: { has_more: false, next_cursor: null },
    })
    expect(r.text).toContain("This page has no records.")
  })

  it("shows the empty state without a task_id", () => {
    expect(renderWidget(getDecisionPackageWidgetHtml(), {}).text).toBe("No package page.")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getDecisionPackageWidgetHtml(), {
      task_id: "t",
      data: "x",
      pagination: 2,
      documents: "y",
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
