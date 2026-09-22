import { describe, expect, it } from "vitest"
import { getAgentToolResultWidgetHtml } from "../../../src/widgets/agent-tool-result"
import { loadFixture, renderWidget } from "./harness"

describe("agent-tool-result widget", () => {
  it("renders an array of rows as a table, with citations and artifacts", () => {
    const r = renderWidget(getAgentToolResultWidgetHtml(), loadFixture("invoke-agent-tool-rows"))
    expect(r.text).toContain("query_data")
    expect(r.text).toContain("2 rows")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(r.text).toContain("Musterfirma AG")
    expect(r.text).toContain("Citations (1)")
    expect(r.text).toContain("Total amount due")
    expect(r.text).toContain("Artifacts (1)")
    expect(r.document.querySelector("a.btn")?.getAttribute("href")).toBe(
      "https://app.talonic.com/artifacts/art-1",
    )
  })

  it("renders a flat object as tiles", () => {
    const r = renderWidget(getAgentToolResultWidgetHtml(), loadFixture("invoke-agent-tool-flat"))
    expect(r.text).toContain("workspace_overview")
    expect(r.text).toContain("4 keys")
    expect(r.document.querySelectorAll(".kv")).toHaveLength(4)
    expect(r.text).toContain("364775")
  })

  it("renders a nested object as a JSON tree", () => {
    const r = renderWidget(getAgentToolResultWidgetHtml(), loadFixture("invoke-agent-tool-nested"))
    expect(r.document.querySelectorAll("details.tree").length).toBeGreaterThan(0)
    expect(r.text).toContain("invoices")
    expect(r.text).toContain("5549")
  })

  it("renders a scalar result and the no-data state", () => {
    expect(
      renderWidget(getAgentToolResultWidgetHtml(), { tool: "calculate", result: 42 }).text,
    ).toContain("42")
    expect(
      renderWidget(getAgentToolResultWidgetHtml(), { tool: "x", result: null }).text,
    ).toContain("The tool returned no data.")
    expect(renderWidget(getAgentToolResultWidgetHtml(), {}).text).toContain(
      "The tool returned no data.",
    )
  })

  it("shows the no-data state for empty objects and empty arrays, not a bare shell", () => {
    const emptyObj = renderWidget(getAgentToolResultWidgetHtml(), { tool: "x", result: {} })
    expect(emptyObj.text).toContain("The tool returned no data.")
    expect(emptyObj.text).not.toContain("keys")
    expect(emptyObj.text).not.toContain("rows")

    const emptyArr = renderWidget(getAgentToolResultWidgetHtml(), { tool: "x", result: [] })
    expect(emptyArr.text).toContain("The tool returned no data.")
    expect(emptyArr.text).not.toContain("keys")
    expect(emptyArr.text).not.toContain("rows")
  })

  it("pluralises the row/key count for a single row or key", () => {
    const oneRow = renderWidget(getAgentToolResultWidgetHtml(), {
      tool: "query_data",
      result: [{ vendor: "Musterfirma AG" }],
    })
    expect(oneRow.text).toContain("1 row")

    const oneKey = renderWidget(getAgentToolResultWidgetHtml(), {
      tool: "workspace_overview",
      result: { schemas: 212 },
    })
    expect(oneKey.text).toContain("1 key")
  })
})
