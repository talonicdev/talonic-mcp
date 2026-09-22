import { describe, expect, it } from "vitest"
import { getRunResultsWidgetHtml } from "../../../src/widgets/run-results"
import { loadFixture, renderWidget } from "./harness"

describe("run-results widget", () => {
  it("renders the rows table from columns + fields with status chips and review count", () => {
    const r = renderWidget(getRunResultsWidgetHtml(), loadFixture("run-results"))
    expect(r.text).toContain("Run results")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("completed")
    expect(r.text).toContain("1 held for review")
    const headers = Array.from(r.document.querySelectorAll("thead th")).map((th) => th.textContent)
    expect(headers).toEqual(["Document", "Status", "PO Number", "Vendor", "Total Amount"])
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(r.text).toContain("Musterfirma AG")
    expect(r.text).toContain("1299")
    expect(r.document.querySelectorAll("tbody .chip.warn")).toHaveLength(1) // partial
    expect(r.text).toContain("2 of 2 rows")
  })

  it("empty rows and malformed payloads", () => {
    expect(renderWidget(getRunResultsWidgetHtml(), { columns: [], data: [] }).text).toBe(
      "No result rows yet.",
    )
    expect(renderWidget(getRunResultsWidgetHtml(), {}).text).toBe("No result rows yet.")
    expect(
      renderWidget(getRunResultsWidgetHtml(), {
        columns: "x",
        data: [null, { fields: "y" }],
        pagination: 2,
      }).document.querySelectorAll("tbody tr"),
    ).toHaveLength(2)
  })
})
