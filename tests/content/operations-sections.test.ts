import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sections } from "../../src/content/sections/operations"
import { getMcpSection } from "../../src/content/index"
import { MCP_NAV_SECTIONS } from "../../src/content/seo"
import { OPERATIONS_TOOLS } from "../../src/tools/workspace-operations"
import { parseRoute } from "../../src/tools/_route-tools"

const nav = new Set(
  (MCP_NAV_SECTIONS.find((s) => s.id === "operations")?.children ?? []).map((c) => c.id),
)
const mirror = JSON.parse(
  readFileSync(new URL("../../docs/sections.json", import.meta.url), "utf8"),
) as Array<{ slug: string; parentSlug: string; content: unknown[] }>

/** The heading, the paragraphs and the parameter table that follow one tool's heading. */
function toolBlocks(name: string) {
  for (const s of sections) {
    const i = s.content.findIndex((b) => b.type === "heading" && b.text === name)
    if (i < 0) continue
    const rest = s.content.slice(i + 1)
    const end = rest.findIndex((b) => b.type === "heading" || b.type === "code")
    return { section: s, blocks: end < 0 ? rest : rest.slice(0, end) }
  }
  return null
}

describe("workspace operation docs", () => {
  it("every family page is rendered, in the nav and mirrored", () => {
    expect(sections).toHaveLength(6)
    for (const s of sections) {
      expect(s.parentSlug).toBe("operations")
      expect(nav.has(s.slug), `nav lacks ${s.slug}`).toBe(true)
      expect(getMcpSection(s.slug)?.breadcrumbs.length).toBeGreaterThan(0)
      const m = mirror.find((x) => x.slug === `mcp-${s.slug}`)
      expect(m, `docs/sections.json lacks mcp-${s.slug}`).toBeDefined()
      expect(m!.parentSlug).toBe("mcp-operations")
      expect(m!.content).toEqual(s.content)
    }
  })

  it.each(OPERATIONS_TOOLS.map((t) => [t.name, t] as const))(
    "%s is documented with its routes and parameters",
    (name, tool) => {
      const found = toolBlocks(name)
      expect(found, `no heading for ${name}`).not.toBeNull()
      const text = found!.blocks
        .filter((b) => b.type === "paragraph")
        .map((b) => (b as { text: string }).text)
        .join(" ")
      for (const r of [tool.route, ...(tool.alsoRoutes ?? [])]) {
        const { method, path } = parseRoute(r)
        expect(text).toContain(`\`${method} ${path}\``)
      }
      const table = found!.blocks.find((b) => b.type === "param-table") as
        | { params: Array<{ name: string }> }
        | undefined
      expect((table?.params ?? []).map((p) => p.name)).toEqual(Object.keys(tool.input))
    },
  )
})
