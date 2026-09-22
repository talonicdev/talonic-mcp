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

  it("survives a malformed payload", () => {
    const r = renderWidget(getAgentTaskSubmittedWidgetHtml(), {
      id: 5,
      status: 8,
      submitted_at: {},
      document_id: 42,
      pipeline_id: "abc",
      phase_index: [1],
      execution_epoch: null,
      lease_expires_at: 5,
      timeout_at: 6,
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
