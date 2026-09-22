import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { createServer } from "../src/server-factory"

const manifest = JSON.parse(
  readFileSync(new URL("../chatgpt-app-submission.json", import.meta.url), "utf8"),
) as {
  tools: Record<
    string,
    { annotations: Record<string, boolean>; justifications: Record<string, string> }
  >
  test_cases: Array<{ tools_triggered: string | null }>
}

const server = createServer({ apiKey: "tlnc_test" }) as any
const publicTools = Object.keys(server._registeredTools).filter(
  (n) => !n.startsWith("talonic_admin_") && !n.startsWith("talonic_growth_"),
)

describe("ChatGPT submission manifest mirrors the live public tool surface", () => {
  it("lists exactly the public tools", () => {
    expect(Object.keys(manifest.tools).sort()).toEqual([...publicTools].sort())
    expect(publicTools).toHaveLength(29)
  })

  it.each(publicTools)("%s annotations match the server", (name) => {
    const live = server._registeredTools[name].annotations
    const declared = manifest.tools[name]
    expect(declared, `${name} missing from manifest`).toBeDefined()
    expect(declared.annotations).toEqual({
      readOnlyHint: live.readOnlyHint,
      openWorldHint: live.openWorldHint,
      destructiveHint: live.destructiveHint,
    })
    for (const k of [
      "read_only_justification",
      "open_world_justification",
      "destructive_justification",
    ]) {
      expect(declared.justifications[k]?.length, `${name} ${k}`).toBeGreaterThan(20)
    }
  })

  it("every tool is exercised by at least one test case", () => {
    const triggered = new Set(
      manifest.test_cases
        .flatMap((c) => (c.tools_triggered ?? "").split(",").map((s) => s.trim()))
        .filter(Boolean),
    )
    for (const name of publicTools)
      expect(triggered.has(name), `${name} has no test case`).toBe(true)
  })
})
