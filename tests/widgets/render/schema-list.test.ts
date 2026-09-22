import { describe, expect, it } from "vitest"
import { getSchemaListWidgetHtml } from "../../../src/widgets/schema-list"
import { loadFixture, renderWidget } from "./harness"

describe("schema-list widget", () => {
  it("renders saved schemas as a table with a total chip", () => {
    const r = renderWidget(getSchemaListWidgetHtml(), loadFixture("schema-list"))
    expect(r.text).toContain("Saved schemas")
    expect(r.document.querySelector(".header .chip")?.textContent).toBe("2")
    expect(r.text).toContain("Invoice Schema")
    expect(r.text).toContain("SCH-00000001")
    expect(r.text).toContain("Core invoice fields.")
    expect(r.text).toContain("Receipt Schema")
    expect(r.text).toContain("SCH-00000002")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
  })

  it("shows the no-schemas fallback for an empty payload", () => {
    const r = renderWidget(getSchemaListWidgetHtml(), {})
    expect(r.document.querySelector(".header .chip")?.textContent).toBe("0")
    expect(r.text).toContain("No schemas saved yet.")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getSchemaListWidgetHtml(), {
      data: [
        { name: 123, short_id: 456, id: 789, field_count: "six", description: [1, 2, 3] },
        "bad-schema",
      ],
      pagination: "not-an-object",
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
