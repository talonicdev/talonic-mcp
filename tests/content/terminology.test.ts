import { describe, expect, it } from "vitest"
import { getAllMcpSections } from "../../src/content/index"
import { TOOL_REGISTRY } from "../../src/content/generated/tool-registry"
import { scanSection, scanText, type TermHit } from "./terminology"

// _common rule 6 / docs-overhaul-plan §0: public text names outcomes, never
// mechanics, models or vendors. Same denylist as the platform docs lint.
const fmt = (hits: TermHit[]) =>
  hits.map((h) => `${h.source} ${h.location}: "${h.match}" … ${h.excerpt}`).join("\n")

describe("public MCP docs pass the terminology denylist", () => {
  it.each(getAllMcpSections().map((s) => [s.slug, s] as const))("%s", (_slug, s) => {
    const hits = scanSection("mcp", s)
    expect(hits, fmt(hits)).toEqual([])
  })
})

describe("public tool descriptions and parameter text pass the denylist", () => {
  it.each(TOOL_REGISTRY.map((t) => [t.name, t] as const))("%s", (_name, t) => {
    const hits = [
      ...scanText(t.title, t.name, "title"),
      ...scanText(t.description, t.name, "description"),
      ...t.params.flatMap((p) => scanText(p.description, t.name, `params.${p.name}`)),
    ]
    expect(hits, fmt(hits)).toEqual([])
  })
})
