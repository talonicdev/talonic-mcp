import { describe, expect, it } from "vitest"
import { getAppListWidgetHtml } from "../../../src/widgets/app-list"
import { getSchemaCardWidgetHtml } from "../../../src/widgets/schema-card"
import { loadFixture, renderWidget } from "./harness"

describe("schema-card widget", () => {
  it("lists every field with its type and marks required ones", () => {
    const r = renderWidget(getSchemaCardWidgetHtml(), loadFixture("schema-card"))
    expect(r.text).toContain("Invoice")
    expect(r.text).toContain("3 fields")
    expect(r.text).toContain("vendor_name required")
    expect(r.text).toContain("Gross total")
  })
  it("shows an empty state for a schema without fields", () => {
    expect(renderWidget(getSchemaCardWidgetHtml(), { name: "X" }).text).toContain(
      "This schema has no fields.",
    )
  })
})

describe("app-list widget", () => {
  it("renders each app with its mode", () => {
    const r = renderWidget(getAppListWidgetHtml(), loadFixture("app-list"))
    expect(r.text).toContain("Billing review")
    expect(r.text).toContain("external")
    expect(r.text).toContain("2")
  })
  it("shows an empty state", () => {
    expect(renderWidget(getAppListWidgetHtml(), { apps: [] }).text).toContain(
      "No apps in this workspace.",
    )
  })
})
