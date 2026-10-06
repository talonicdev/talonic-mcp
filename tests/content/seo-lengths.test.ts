import { describe, expect, it } from "vitest"
import { getAllMcpSections } from "../../src/content/index"

// Public docs pages only; internal tool families are not rendered on talonic.com/docs/mcp.
const INTERNAL = /^talonic-(contracts|ap|growth|admin)-/
const sections = getAllMcpSections().filter((s) => !INTERNAL.test(s.slug))

describe("public docs sections have SERP-sized meta copy", () => {
  it.each(sections.map((s) => [s.slug, s] as const))("%s", (_slug, s) => {
    expect(s.seoTitle.length, `seoTitle: ${s.seoTitle}`).toBeGreaterThanOrEqual(50)
    expect(s.seoTitle.length, `seoTitle: ${s.seoTitle}`).toBeLessThanOrEqual(60)
    expect(s.description.length, `description: ${s.description}`).toBeGreaterThanOrEqual(150)
    expect(s.description.length, `description: ${s.description}`).toBeLessThanOrEqual(160)
  })
})
