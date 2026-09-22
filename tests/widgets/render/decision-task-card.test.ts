import { describe, expect, it } from "vitest"
import {
  getDecisionHeartbeatWidgetHtml,
  getDecisionSubmittedWidgetHtml,
  getDecisionReleasedWidgetHtml,
  getDecisionFailedWidgetHtml,
} from "../../../src/widgets/decision-task-card"
import { loadFixture, renderWidget } from "./harness"

describe("decision-task-card widgets", () => {
  it("heartbeat: headline, note, epoch, lease expiry", () => {
    const r = renderWidget(getDecisionHeartbeatWidgetHtml(), loadFixture("decision-task"))
    expect(r.text).toContain("Lease extended")
    expect(r.text).toContain("Keep heartbeating before the lease expires")
    expect(r.text).toContain("Execution epoch 2")
    expect(r.text).toMatch(/Lease expires in/)
  })

  it("submitted: headline, note, and a submitted-ago timestamp", () => {
    const fixture = loadFixture<Record<string, unknown>>("decision-task")
    const r = renderWidget(getDecisionSubmittedWidgetHtml(), {
      ...fixture,
      status: "submitted",
      submitted_at: "2026-09-22T09:14:00.000Z",
    })
    expect(r.text).toContain("Decision submitted")
    expect(r.text).toContain("The platform verified the decision")
    expect(r.text).toMatch(/ago/)
    expect(r.document.querySelector(".chip.good")).not.toBeNull()
  })

  it("released: headline, note, warn chip", () => {
    const fixture = loadFixture<Record<string, unknown>>("decision-task")
    const r = renderWidget(getDecisionReleasedWidgetHtml(), { ...fixture, status: "released" })
    expect(r.text).toContain("Task released")
    expect(r.text).toContain("available again for another claimant")
    expect(r.document.querySelector(".chip.warn")?.textContent).toBe("released")
  })

  it("failed: headline, note, bad chip", () => {
    const fixture = loadFixture<Record<string, unknown>>("decision-task")
    const r = renderWidget(getDecisionFailedWidgetHtml(), { ...fixture, status: "failed" })
    expect(r.text).toContain("Task failed")
    expect(r.text).toContain("Human Review was raised")
    expect(r.document.querySelector(".chip.bad")?.textContent).toBe("failed")
  })

  it("shows the empty state without a task id", () => {
    expect(renderWidget(getDecisionHeartbeatWidgetHtml(), {}).text).toBe("No decision task.")
    expect(renderWidget(getDecisionSubmittedWidgetHtml(), {}).text).toBe("No decision task.")
    expect(renderWidget(getDecisionReleasedWidgetHtml(), {}).text).toBe("No decision task.")
    expect(renderWidget(getDecisionFailedWidgetHtml(), {}).text).toBe("No decision task.")
  })

  it("the four templates differ only in headline, note and title", () => {
    const normalise = (html: string): string =>
      html
        .replace("Lease extended", "X")
        .replace(
          "Keep heartbeating before the lease expires; the SLA deadline is the hard stop.",
          "N",
        )
        .replace("Talonic — Decision Task Lease", "T")
        .replace("Decision submitted", "X")
        .replace("The platform verified the decision and resumes the run.", "N")
        .replace("Talonic — Decision Submitted", "T")
        .replace("Task released", "X")
        .replace(
          "The task is available again for another claimant; the next claim bumps the epoch.",
          "N",
        )
        .replace("Talonic — Decision Task Released", "T")
        .replace("Task failed", "X")
        .replace(
          "A Human Review was raised with your reason and the app's fallback policy applies.",
          "N",
        )
        .replace("Talonic — Decision Task Failed", "T")

    const heartbeat = normalise(getDecisionHeartbeatWidgetHtml())
    expect(normalise(getDecisionSubmittedWidgetHtml())).toBe(heartbeat)
    expect(normalise(getDecisionReleasedWidgetHtml())).toBe(heartbeat)
    expect(normalise(getDecisionFailedWidgetHtml())).toBe(heartbeat)
  })
})
