import { describe, expect, it } from "vitest"
import { getUsageWidgetHtml } from "../../../src/widgets/usage"
import { loadFixture, renderWidget } from "./harness"

describe("usage widget", () => {
  it("renders total credits and a per-function breakdown", () => {
    const r = renderWidget(getUsageWidgetHtml(), loadFixture("usage"))
    expect(r.text).toContain("Credit usage")
    expect(r.text).toContain("last 30 days")
    expect(r.document.querySelector(".big")?.textContent).toContain("3,120")
    expect(r.text).toContain("extract")
    expect(r.text).toContain("412")
    expect(r.text).toContain("2,480")
    expect(r.text).toContain("to_markdown")
    expect(r.text).toContain("88")
    expect(r.text).toContain("640")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
  })

  it("shows the no-usage fallback for an empty payload", () => {
    const r = renderWidget(getUsageWidgetHtml(), {})
    expect(r.document.querySelector(".big")?.textContent).toContain("—")
    expect(r.text).toContain("No credit usage in this window yet.")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getUsageWidgetHtml(), {
      period_days: "thirty",
      total_credits: "lots",
      by_function: [{ operation_type: 1, operations: "many", credits: "high" }, "bad-func"],
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
