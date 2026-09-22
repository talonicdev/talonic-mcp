import { describe, expect, it } from "vitest"
import { getDecisionBundleWidgetHtml } from "../../../src/widgets/decision-bundle"
import { loadFixture, renderWidget } from "./harness"

describe("decision-bundle widget", () => {
  it("renders the claim: epoch, contract, precedents, package, documents", () => {
    const r = renderWidget(getDecisionBundleWidgetHtml(), loadFixture("decision-bundle"))
    expect(r.text).toContain("Decision task claimed")
    expect(r.document.querySelector(".big")?.textContent).toContain("2")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("claimed")
    expect(r.text).toContain("Output contract")
    expect(r.document.querySelector("details.tree")).not.toBeNull()
    expect(r.text).toContain("Precedents (1)")
    expect(r.text).toContain("Vendor known")
    expect(r.text).toContain("records")
    expect(r.text).toContain("3")
    expect(r.text).toContain("500")
    expect(r.text).toContain("Source documents (2)")
    expect(r.text).toContain("invoice-0421.pdf")
    expect(r.text).toContain("talonic_read_decision_package")
  })

  it("shows the empty state without a claimed task", () => {
    expect(renderWidget(getDecisionBundleWidgetHtml(), {}).text).toBe(
      "No decision task was claimed.",
    )
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getDecisionBundleWidgetHtml(), {
      task: { id: 5, status: 7 },
      output_contract: "x",
      precedents: "y",
      package: 3,
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
