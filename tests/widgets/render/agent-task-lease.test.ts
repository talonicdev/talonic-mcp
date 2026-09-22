import { describe, expect, it } from "vitest"
import {
  getAgentTaskClaimWidgetHtml,
  getAgentTaskHeartbeatWidgetHtml,
} from "../../../src/widgets/agent-task-lease"
import { loadFixture, renderWidget } from "./harness"

describe("agent-task lease widgets", () => {
  it("claim: headline, epoch, lease expiry and the full task payload", () => {
    const r = renderWidget(getAgentTaskClaimWidgetHtml(), loadFixture("get-agent-task"))
    expect(r.text).toContain("Task claimed")
    expect(r.document.querySelector(".big")?.textContent).toContain("4")
    expect(r.text).toContain("Keep this epoch for heartbeat and submit.")
    expect(r.text).toMatch(/Lease expires in \d+d/)
    expect(r.text).toContain("Output contract (2)")
    expect(r.text).toContain("Input snapshot")
  })

  it("heartbeat: headline, epoch, and no payload sections", () => {
    const r = renderWidget(getAgentTaskHeartbeatWidgetHtml(), loadFixture("heartbeat-agent-task"))
    expect(r.text).toContain("Lease extended")
    expect(r.document.querySelector(".big")?.textContent).toContain("4")
    expect(r.text).not.toContain("Output contract")
    expect(r.text).not.toContain("Instructions")
  })

  it("both show the empty state without a task id", () => {
    expect(renderWidget(getAgentTaskClaimWidgetHtml(), {}).text).toBe("No lease information.")
    expect(renderWidget(getAgentTaskHeartbeatWidgetHtml(), { status: "claimed" }).text).toBe(
      "No lease information.",
    )
  })

  it("survives a malformed payload (claim and heartbeat)", () => {
    const malformed = {
      id: 5,
      status: 3,
      execution_epoch: "four",
      lease_expires_at: {},
      document_id: 1,
      pipeline_id: 2,
      phase_index: "x",
      timeout_at: [1, 2],
      instructions: 5,
      output_contract: {},
      input_snapshot: "not-an-object",
      timeout_fallthrough: [1],
    }
    const claim = renderWidget(getAgentTaskClaimWidgetHtml(), malformed)
    const heartbeat = renderWidget(getAgentTaskHeartbeatWidgetHtml(), malformed)
    expect(claim.text.length).toBeGreaterThan(0)
    expect(heartbeat.text.length).toBeGreaterThan(0)
  })

  it("the two templates differ only in headline", () => {
    const a = getAgentTaskClaimWidgetHtml()
      .replace("Task claimed", "X")
      .replace("Talonic — Agent Task Claimed", "T")
    const b = getAgentTaskHeartbeatWidgetHtml()
      .replace("Lease extended", "X")
      .replace("Talonic — Agent Task Lease", "T")
    expect(a).toBe(b)
  })
})
