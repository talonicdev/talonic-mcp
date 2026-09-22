import { describe, expect, it } from "vitest"
import { getSpecListWidgetHtml } from "../../../src/widgets/spec-list"
import { loadFixture, renderWidget } from "./harness"

describe("spec-list widget", () => {
  it("renders one row per Spec with version state, counts and pagination", () => {
    const r = renderWidget(getSpecListWidgetHtml(), loadFixture("list-specs"))
    expect(r.text).toContain("Specs")
    expect(r.text).toContain("3 of 212 Specs")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(r.text).toContain("Purchase Order")
    expect(r.text).toContain("PO header + line items")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("v3 live")
    expect(r.document.querySelector(".chip.warn")?.textContent).toBe("v1 not live")
    expect(r.document.querySelector(".chip.bad")?.textContent).toBe("unpublished")
    expect(r.text).toContain("12")
    expect(r.text).toContain("more available")
  })

  it("shows the empty state", () => {
    expect(renderWidget(getSpecListWidgetHtml(), { data: [] }).text).toBe(
      "No Specs in this workspace.",
    )
  })

  it("survives a malformed payload", () => {
    expect(
      renderWidget(getSpecListWidgetHtml(), {
        data: [null, 7, { name: 3 }],
        pagination: "x",
      }).document.querySelectorAll("tbody tr"),
    ).toHaveLength(3)
  })
})
