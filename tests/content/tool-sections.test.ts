import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { getAllMcpSections } from "../../src/content/index"
import { createServer } from "../../src/server-factory"
import { sections } from "../../src/content/sections/tool-reference"
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
    expect(
      section,
      `no reference page ${slug}: add it to src/content/tool-pages.ts and run npm run docs:gen`,
    ).toBeDefined()
    expect(section!.title).toBe(tool)
    expect(section!.content.length).toBeGreaterThan(3)
    expect(navIds.has(slug), `src/content/seo.ts nav lacks ${slug}`).toBe(true)
    expect(mirrorSlugs.has(`mcp-${slug}`), `docs/sections.json lacks mcp-${slug}`).toBe(true)
  })
})

// docs/sections.json is a dormant mirror: talonic.com/docs/mcp renders only
// src/content. A tool documented only in the mirror is invisible to customers
// (0.1.102/0.1.103 shipped 21 talonic_process_* pages that way).
describe("no tool is documented only in docs/sections.json", () => {
  const live = new Map(getAllMcpSections().map((s) => [s.slug, s]))
  const mirrorTools = (
    JSON.parse(
      readFileSync(new URL("../../docs/sections.json", import.meta.url), "utf8"),
    ) as Array<{
      slug: string
      title: string
    }>
  ).filter((m) => m.title.startsWith("talonic_"))

  it("the mirror documents tools at all (the check is not vacuous)", () => {
    expect(mirrorTools.length).toBeGreaterThan(40)
  })

  it.each(mirrorTools.map((m) => [m.title, m.slug]))(
    "%s has a rendered section in src/content",
    (title, slug) => {
      const liveSlug = slug.replace(/^mcp-/, "")
      const section = live.get(liveSlug)
      expect(
        section,
        `${title} is only in docs/sections.json; add it to src/content/sections`,
      ).toBeDefined()
      expect(section!.title).toBe(title)
      expect(navIds.has(liveSlug), `src/content/seo.ts nav lacks ${liveSlug}`).toBe(true)
    },
  )
})

describe("the Process Plane tools have rendered, accurate pages", () => {
  const server = createServer({ apiKey: "tlnc_test", includeProcessesTools: true }) as any
  const tools = server._registeredTools as Record<string, { inputSchema?: unknown }>
  const processTools = Object.keys(tools).filter((n) => n.startsWith("talonic_process_"))
  const live = new Map(getAllMcpSections().map((s) => [s.slug, s]))
  const paramsOf = (schema: unknown): string[] => {
    if (!schema) return []
    const json = z.toJSONSchema(schema as z.ZodType, { unrepresentable: "any" }) as {
      properties?: Record<string, unknown>
    }
    return Object.keys(json.properties ?? {}).sort()
  }

  it("there are thirty-seven", () => {
    expect(processTools).toHaveLength(37)
  })

  it.each(processTools)(
    "%s: page, nav entry, visibility rule, example and every parameter",
    (tool) => {
      const slug = slugOf(tool)
      const section = live.get(slug)
      expect(section, `no rendered section ${slug}`).toBeDefined()
      expect(navIds.has(slug)).toBe(true)
      const text = JSON.stringify(section!.content)
      expect(text, "visibility rule").toContain("Process Plane view permission")
      expect(
        section!.content.some((b) => b.type === "code"),
        "example",
      ).toBe(true)
      const documented = section!.content
        .flatMap((b) => (b.type === "param-table" ? b.params.map((p) => p.name) : []))
        .sort()
      expect(documented).toEqual(paramsOf(tools[tool]!.inputSchema))
    },
  )
})
