import { describe, expect, it } from "vitest"
import { getAgentTaskWidgetHtml } from "../../../src/widgets/agent-task"
import { loadFixture, renderWidget } from "./harness"

describe("agent-task widget", () => {
  it("renders status, timing tiles, instructions, output contract and input snapshot", () => {
    const r = renderWidget(getAgentTaskWidgetHtml(), loadFixture("get-agent-task"))
    expect(r.text).toContain("Agent task 7a5k0002")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("claimed")
    expect(r.text).toContain("Execution epoch 4")
    expect(r.text).toContain("Lease expires in")
    expect(r.text).toContain("Instructions")
    expect(r.text).toContain("auto-approved")
    expect(r.text).toContain("Output contract (2)")
    expect(r.text).toContain("approval_decision")
    expect(r.text).toContain("required")
    expect(r.text).toContain("optional")
    expect(r.text).toContain("Input snapshot")
    expect(r.text).toContain("Musterfirma AG")
    expect(r.document.querySelectorAll("details.tree").length).toBeGreaterThan(0) // nested line_items
    expect(r.text).toContain("On timeout: route to review")
  })

  it("renders a metadata-only task without the optional sections", () => {
    const r = renderWidget(getAgentTaskWidgetHtml(), {
      id: "abc",
      status: "available",
      execution_epoch: 1,
    })
    expect(r.text).toContain("Agent task abc")
    expect(r.text).not.toContain("Instructions")
    expect(r.text).not.toContain("Output contract")
    expect(r.text).not.toContain("Input snapshot")
  })

  it("shows the empty state", () => {
    expect(renderWidget(getAgentTaskWidgetHtml(), {}).text).toBe("No agent task.")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getAgentTaskWidgetHtml(), {
      id: 5,
      status: 7,
      created_at: 12345,
      document_id: 999,
      pipeline_id: [1, 2, 3],
      phase_index: "two",
      execution_epoch: "four",
      lease_expires_at: 123,
      timeout_at: {},
      instructions: 42,
      output_contract: "not-an-array",
      input_snapshot: [1, 2, 3],
      timeout_fallthrough: 99,
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
