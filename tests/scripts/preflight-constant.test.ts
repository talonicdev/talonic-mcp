import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { TOOL_WIDGET_KEYS } from "../../src/widgets/types"

describe("chatgpt-preflight expects every public tool", () => {
  it("EXPECTED_TOOLS equals the size of TOOL_WIDGET_KEYS", () => {
    const src = readFileSync(
      new URL("../../scripts/chatgpt-preflight.mjs", import.meta.url),
      "utf8",
    )
    const m = src.match(/const EXPECTED_TOOLS = (\d+)/)
    expect(m, "EXPECTED_TOOLS constant not found").not.toBeNull()
    expect(Number(m![1])).toBe(Object.keys(TOOL_WIDGET_KEYS).length)
  })
})
