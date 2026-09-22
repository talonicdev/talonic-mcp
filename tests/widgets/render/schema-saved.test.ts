import { describe, expect, it } from "vitest"
import { getSchemaSavedWidgetHtml } from "../../../src/widgets/schema-saved"
import { loadFixture, renderWidget } from "./harness"

describe("schema-saved widget", () => {
  it("confirms the saved schema with name, version, short id and field count", () => {
    const r = renderWidget(getSchemaSavedWidgetHtml(), loadFixture("schema-saved"))
    expect(r.text).toContain("Schema saved")
    expect(r.text).toContain("Invoice Schema")
    expect(r.text).toContain("v1")
    expect(r.text).toContain("Core invoice fields.")
    expect(r.text).toContain("SCH-00000001")
    expect(r.text).toContain("6")
    expect(r.text).toContain("talonic_extract")
  })

  it("falls back to a generic name when the payload is empty", () => {
    const r = renderWidget(getSchemaSavedWidgetHtml(), {})
    expect(r.text).toContain("Schema saved")
    expect(r.text).toContain("Schema")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getSchemaSavedWidgetHtml(), {
      name: 123,
      short_id: 456,
      id: 789,
      version: "one",
      description: [1, 2, 3],
      field_count: "six",
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
