import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { TOOL_WIDGET_KEYS } from "../../src/widgets/types"

describe("chatgpt-preflight expects every public tool", () => {
  it("EXPECTED_TOOLS equals the public tools minus the workspace-gated worker tools", () => {
    const src = readFileSync(
      new URL("../../scripts/chatgpt-preflight.mjs", import.meta.url),
      "utf8",
    )
    const m = src.match(/const EXPECTED_TOOLS = (\d+)/)
    expect(m, "EXPECTED_TOOLS constant not found").not.toBeNull()
    // Agent-task and decision-task tools are hidden unless the workspace uses
    // them; the preflight's unreachable API makes both probes say no.
    const gated = Object.keys(TOOL_WIDGET_KEYS).filter((t) => /_agent_task|_decision_/.test(t))
    expect(gated).toHaveLength(12)
    expect(Number(m![1])).toBe(Object.keys(TOOL_WIDGET_KEYS).length - gated.length)
  })
})
