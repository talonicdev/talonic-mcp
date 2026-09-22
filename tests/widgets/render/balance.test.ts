import { describe, expect, it } from "vitest"
import { getBalanceWidgetHtml } from "../../../src/widgets/balance"
import { loadFixture, renderWidget } from "./harness"

describe("balance widget", () => {
  it("renders credits, EUR value, tier, burn rate, runway and reset date", () => {
    const r = renderWidget(getBalanceWidgetHtml(), loadFixture("balance"))
    expect(r.text).toContain("Talonic balance")
    expect(r.text).toContain("growth")
    expect(r.document.querySelector(".big")?.textContent).toContain("48,820")
    expect(r.text).toContain("48.82")
    expect(r.text).toContain("3120")
    expect(r.text).toContain("469 days")
    expect(r.text).toContain("2026-10-01 00:00:00 UTC")
  })

  it("shows dashes and n/a for an empty payload", () => {
    const r = renderWidget(getBalanceWidgetHtml(), {})
    expect(r.document.querySelector(".big")?.textContent).toContain("—")
    expect(r.text).toContain("n/a")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getBalanceWidgetHtml(), {
      balance_credits: "many",
      balance_eur: "lots",
      burn_rate_30d_credits: [1, 2, 3],
      projected_runway_days: "soon",
      tier: 5,
      tier_resets_at: 12345,
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
