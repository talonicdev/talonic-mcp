import { describe, expect, it } from "vitest"
import { getAgentToolsWidgetHtml } from "../../../src/widgets/agent-tools"
import { loadFixture, renderWidget } from "./harness"

describe("agent-tools widget", () => {
  it("renders the registry with impact tones and invocable markers", () => {
    const r = renderWidget(getAgentToolsWidgetHtml(), loadFixture("list-agent-tools"))
    expect(r.text).toContain("Platform agent tools")
    expect(r.text).toContain("2 invocable with this key · 69 in the registry")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(4)
    expect(r.text).toContain("workspace_overview")
    expect(r.document.querySelectorAll(".chip.good").length).toBeGreaterThanOrEqual(2) // read impacts
    expect(r.document.querySelector(".chip.warn")?.textContent).toBe("draft_mutation")
    expect(r.document.querySelector(".chip.bad")?.textContent).toBe("live_mutation")
    expect(r.text).toContain("data.read")
    expect(r.text.match(/✓ invocable/g)).toHaveLength(2)
  })

  it("derives counts when the envelope omits them", () => {
    const r = renderWidget(getAgentToolsWidgetHtml(), {
      tools: [
        { name: "a", can_invoke: true },
        { name: "b", can_invoke: false },
      ],
    })
    expect(r.text).toContain("1 invocable with this key · 2 in the registry")
  })

  it("shows the empty state", () => {
    expect(renderWidget(getAgentToolsWidgetHtml(), { tools: [] }).text).toBe(
      "No agent tools are visible to this credential.",
    )
    expect(renderWidget(getAgentToolsWidgetHtml(), {}).text).toBe(
      "No agent tools are visible to this credential.",
    )
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getAgentToolsWidgetHtml(), {
      tools: [
        { name: 123, description: 456, impact: 7, capability: true, can_invoke: "yes" },
        "not-an-object",
        42,
      ],
      invocable_count: "two",
      totalCount: "lots",
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
