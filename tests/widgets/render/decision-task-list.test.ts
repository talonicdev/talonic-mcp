import { describe, expect, it } from "vitest"
import { getDecisionTaskListWidgetHtml } from "../../../src/widgets/decision-task-list"
import { loadFixture, renderWidget } from "./harness"

describe("decision-task-list widget", () => {
  it("renders the worklist with status chips, ids, and pagination hint", () => {
    const r = renderWidget(getDecisionTaskListWidgetHtml(), loadFixture("decision-tasks"))
    expect(r.text).toContain("Decision tasks")
    expect(r.text).toContain("3 tasks")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(r.text).toContain("1 available")
    expect(r.text).toContain("1 claimed")
    expect(r.text).toContain("1 failed")
    expect(r.document.querySelector(".chip.info")?.textContent).toBe("1 available")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("1 claimed")
    expect(r.document.querySelector(".chip.bad")?.textContent).toBe("1 failed")
    expect(r.text).toContain("7d3c0001")
    expect(r.text).toMatch(/in \d+d/)
    expect(r.text).toContain("more available")
  })

  it("shows the empty state", () => {
    expect(renderWidget(getDecisionTaskListWidgetHtml(), { data: [] }).text).toBe(
      "No decision tasks for this app.",
    )
  })

  it("survives malformed rows", () => {
    const r = renderWidget(getDecisionTaskListWidgetHtml(), {
      data: [null, "x", { status: "released" }],
    })
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(r.document.querySelector(".chip.warn")).not.toBeNull()
  })
})
