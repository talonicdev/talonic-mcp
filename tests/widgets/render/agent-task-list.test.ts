import { describe, expect, it } from "vitest"
import { getAgentTaskListWidgetHtml } from "../../../src/widgets/agent-task-list"
import { loadFixture, renderWidget } from "./harness"

describe("agent-task-list widget", () => {
  it("renders the worklist with status chips, ids, lease and timeout", () => {
    const r = renderWidget(getAgentTaskListWidgetHtml(), loadFixture("list-agent-tasks"))
    expect(r.text).toContain("Agent task worklist")
    expect(r.text).toContain("2 tasks")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(r.text).toContain("1 available")
    expect(r.text).toContain("1 claimed")
    expect(r.document.querySelector(".chip.info")?.textContent).toBe("1 available")
    expect(r.text).toContain("7a5k0001") // short task id
    expect(r.text).toContain("d0c00001") // short document id
    expect(r.text).toMatch(/in \d+d/) // relative lease/timeout in the future
    expect(r.text).toContain("4") // epoch
  })

  it("shows the empty state", () => {
    expect(renderWidget(getAgentTaskListWidgetHtml(), { data: [] }).text).toBe(
      "No agent tasks in this worklist.",
    )
    expect(renderWidget(getAgentTaskListWidgetHtml(), {}).text).toBe(
      "No agent tasks in this worklist.",
    )
  })

  it("survives malformed rows", () => {
    const r = renderWidget(getAgentTaskListWidgetHtml(), {
      data: [null, "x", { status: "timed_out" }],
    })
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(3)
    expect(r.document.querySelector(".chip.bad")).not.toBeNull()
  })
})
