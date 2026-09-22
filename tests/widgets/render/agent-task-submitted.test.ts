import { describe, expect, it } from "vitest"
import { getAgentTaskSubmittedWidgetHtml } from "../../../src/widgets/agent-task-submitted"
import { loadFixture, renderWidget } from "./harness"

describe("agent-task-submitted widget", () => {
  it("confirms the submission with status, time and ids", () => {
    const r = renderWidget(getAgentTaskSubmittedWidgetHtml(), loadFixture("submit-agent-task"))
    expect(r.text).toContain("Outputs submitted")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("submitted")
    expect(r.text).toMatch(/ago/) // submitted_at is in the past
    expect(r.text).toContain("resumes its pipeline")
    expect(r.text).toContain("d0c00001")
    expect(r.text).toContain("Execution epoch 4")
  })

  it("shows the empty state", () => {
    expect(renderWidget(getAgentTaskSubmittedWidgetHtml(), {}).text).toBe("No submission recorded.")
  })
})
