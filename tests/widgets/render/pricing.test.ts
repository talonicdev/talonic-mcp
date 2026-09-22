import { describe, expect, it } from "vitest"
import { getPricingWidgetHtml } from "../../../src/widgets/pricing"
import { loadFixture, renderWidget } from "./harness"

describe("pricing widget", () => {
  it("renders the currency, conversion rate, multipliers and per-unit table", () => {
    const r = renderWidget(getPricingWidgetHtml(), loadFixture("pricing"))
    expect(r.text).toContain("Talonic pricing")
    expect(r.document.querySelector(".header .chip")?.textContent).toBe("EUR")
    expect(r.text).toContain("1,000 credits")
    expect(r.text).toContain("realtime 1×")
    expect(r.text).toContain("batch 0.5×")
    expect(r.text).toContain("AI-resolved cell")
    expect(r.text).toContain("extract_cell_ai")
    expect(r.text).toContain("Registry-resolved cell")
    expect(r.text).toContain("free")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
  })

  it("shows the no-units fallback for an empty payload", () => {
    const r = renderWidget(getPricingWidgetHtml(), {})
    expect(r.document.querySelector(".header .chip")?.textContent).toBe("EUR")
    expect(r.text).toContain("No pricing units returned.")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getPricingWidgetHtml(), {
      currency: 5,
      credits_per_eur: "many",
      multipliers: "not-an-object",
      units: [{ unit: 1, label: 2, credits: "three", eur: "four", free: "yes" }, "bad-unit"],
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
