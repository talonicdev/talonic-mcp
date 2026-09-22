import { describe, expect, it } from "vitest"
import { getSpecCardWidgetHtml } from "../../../src/widgets/spec-card"
import { loadFixture, renderWidget } from "./harness"

describe("spec-card widget", () => {
  it("renders identity, version chips, rail, phases, fields and versions", () => {
    const r = renderWidget(getSpecCardWidgetHtml(), loadFixture("get-spec"))
    expect(r.text).toContain("Purchase Order")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("v3 live")
    expect(r.text).toContain("4 fields")
    expect(r.text).toContain("Rail (4 stages)")
    expect(r.document.querySelectorAll(".rail .chip")).toHaveLength(4)
    expect(r.document.querySelector(".rail .chip")?.textContent).toContain("source")
    expect(r.text).toContain("Compiled plan (3 phases)")
    expect(r.document.querySelectorAll("table tbody tr").length).toBeGreaterThanOrEqual(3)
    expect(r.text).toContain("Totals check · gate 2")
    expect(r.text).toContain("po_number")
    expect(r.text).toContain("Versions")
    expect(r.text).toContain("sha256:aaa")
  })

  it("renders a never-published Spec without the optional sections", () => {
    const r = renderWidget(getSpecCardWidgetHtml(), {
      id: "x",
      name: "Draft",
      version: null,
      nodes: [],
      phases: [],
      fields: [],
    })
    expect(r.document.querySelector(".chip.bad")?.textContent).toBe("unpublished")
    expect(r.text).not.toContain("Rail (")
    expect(r.text).not.toContain("Compiled plan")
    expect(r.text).not.toContain("Versions")
  })

  it("shows the empty state and survives malformed input", () => {
    expect(renderWidget(getSpecCardWidgetHtml(), {}).text).toBe("No Spec.")
    expect(
      renderWidget(getSpecCardWidgetHtml(), {
        id: 5,
        name: 7,
        nodes: "x",
        phases: 3,
        fields: { a: 1 },
        versions: "y",
      }).text.length,
    ).toBeGreaterThan(0)
  })
})
