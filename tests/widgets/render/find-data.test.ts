import { describe, expect, it } from "vitest"
import { getFindDataWidgetHtml } from "../../../src/widgets/find-data"
import { loadFixture, renderWidget } from "./harness"

describe("find-data widget", () => {
  it("renders the four planes with counts, scores and samples", () => {
    const r = renderWidget(getFindDataWidgetHtml(), loadFixture("find-data"))
    expect(r.text).toContain("total amount on invoices")
    expect(r.text).toContain("5 matches")
    expect(r.text).toContain("semantic + lexical")
    expect(r.text).toContain("Fields (2)")
    expect(r.text).toContain("Values (1)")
    expect(r.text).toContain("Documents (1)")
    expect(r.text).toContain("Passages (1)")
    expect(r.text).toContain("Total Amount")
    expect(r.text).toContain("net_amount")
    expect(r.text).toContain("81%")
    expect(r.text).toContain("1299.00")
    expect(r.text).toContain("Total amount due")
    expect(r.document.querySelectorAll(".plane")).toHaveLength(4)
  })

  it("skips empty planes", () => {
    const r = renderWidget(getFindDataWidgetHtml(), {
      tool: "find_data",
      result: {
        query: "q",
        fields: [{ canonical_name: "only_field", score: 0.5 }],
        values: [],
        documents: [],
        passages: [],
      },
    })
    expect(r.document.querySelectorAll(".plane")).toHaveLength(1)
    expect(r.text).toContain("1 match")
    expect(r.text).not.toContain("1 matches")
  })

  it("shows the empty state when nothing matched", () => {
    const r = renderWidget(getFindDataWidgetHtml(), {
      tool: "find_data",
      result: { query: "unicorns", fields: [] },
    })
    expect(r.text).toBe("Nothing in the workspace matches “unicorns”.")
  })

  it("accepts a bare result object (no tool envelope) and a malformed one", () => {
    expect(
      renderWidget(getFindDataWidgetHtml(), { fields: [{ canonical_name: "x" }] }).text,
    ).toContain("Fields (1)")
    expect(renderWidget(getFindDataWidgetHtml(), { result: "garbage" }).text).toContain(
      "Nothing in the workspace matches",
    )
  })
})
