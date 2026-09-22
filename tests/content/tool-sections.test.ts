import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { sections } from "../../src/content/sections/tools"
import { MCP_NAV_SECTIONS } from "../../src/content/seo"
import { TOOL_WIDGET_KEYS } from "../../src/widgets/types"

const TOOLS = Object.keys(TOOL_WIDGET_KEYS)
const slugOf = (tool: string) => tool.replace(/_/g, "-")
const navIds = new Set(
  (MCP_NAV_SECTIONS.find((s) => s.id === "tools")?.children ?? []).map((c) => c.id),
)
const mirror = JSON.parse(
  readFileSync(new URL("../../docs/sections.json", import.meta.url), "utf8"),
) as Array<{ slug: string }>
const mirrorSlugs = new Set(mirror.map((m) => m.slug))

describe("every public tool is documented on both surfaces", () => {
  it.each(TOOLS)("%s has a live docs section, a nav entry, and a mirror entry", (tool) => {
    const slug = slugOf(tool)
    const section = sections.find((s) => s.slug === slug)
    expect(section, `src/content/sections/tools.ts lacks slug ${slug}`).toBeDefined()
    expect(section!.title).toBe(tool)
    expect(section!.content.length).toBeGreaterThan(3)
    expect(navIds.has(slug), `src/content/seo.ts nav lacks ${slug}`).toBe(true)
    expect(mirrorSlugs.has(`mcp-${slug}`), `docs/sections.json lacks mcp-${slug}`).toBe(true)
  })
})
