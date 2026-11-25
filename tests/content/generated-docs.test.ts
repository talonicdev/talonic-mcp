import { readFileSync } from "node:fs"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { describe, expect, it } from "vitest"
import { getAllMcpSections, MCP_NAV_SECTIONS, MCP_PATHS } from "../../src/content/index"
import { TOOL_REGISTRY } from "../../src/content/generated/tool-registry"
import { TOOL_PAGES } from "../../src/content/tool-pages"
import { createServer } from "../../src/server-factory"
import {
  MIRROR_FILE,
  REGISTRY_FILE,
  registrySnapshot,
  renderMirror,
  renderRegistryModule,
  // @ts-expect-error plain ESM script without types
} from "../../scripts/gen-docs.mjs"

const read = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8")
const sections = getAllMcpSections()
const bySlug = new Map(sections.map((s) => [s.slug, s]))

describe("generated docs files are current (regenerate: npm run docs:gen)", async () => {
  const snap = await registrySnapshot(createServer, { Client, InMemoryTransport })

  it(`${REGISTRY_FILE} matches a real tools/list`, () => {
    expect(read(REGISTRY_FILE)).toBe(renderRegistryModule(snap))
  })

  it(`${MIRROR_FILE} is rendered from the live sections`, () => {
    expect(read(MIRROR_FILE)).toBe(renderMirror(sections))
  })
})

describe("the tool reference covers exactly the public tools", () => {
  const INTERNAL_OR_APP =
    /talonic_(growth|admin|contracts|ap|parties|doc_gen|price_baseline|submissions|master_records|portfolio)_/

  it("has the public groups and the process tools", () => {
    const groups = new Set(TOOL_REGISTRY.map((t) => t.group))
    expect([...groups].sort()).toEqual(["agent_tasks", "core", "decision_tasks", "processes"])
    expect(TOOL_REGISTRY.filter((t) => t.group === "processes")).toHaveLength(21)
  })

  it("never names an internal or app-gated tool anywhere in the docs", () => {
    expect(TOOL_REGISTRY.filter((t) => INTERNAL_OR_APP.test(t.name))).toEqual([])
    const text = JSON.stringify(sections)
    expect(text.match(new RegExp(INTERNAL_OR_APP.source + "\\w+", "g")) ?? []).toEqual([])
  })

  it("has page copy for every tool and none for tools that do not exist", () => {
    expect(Object.keys(TOOL_PAGES).sort()).toEqual(TOOL_REGISTRY.map((t) => t.name).sort())
  })

  it.each(TOOL_REGISTRY.map((t) => [t.name, t] as const))(
    "%s: page, parameters, availability, on Tools by task",
    (name, t) => {
      const s = bySlug.get(name.replace(/_/g, "-"))
      expect(s?.title).toBe(name)
      const documented = s!.content.flatMap((b) =>
        b.type === "param-table" ? b.params.map((p) => p.name) : [],
      )
      expect(documented.sort()).toEqual(t.params.map((p) => p.name).sort())
      expect(s!.content.some((b) => b.type === "heading" && b.id === "availability")).toBe(true)
      expect(s!.content.some((b) => b.type === "code")).toBe(true)
      expect(JSON.stringify(bySlug.get("tools-by-task")!.content)).toContain(`\`${name}\``)
    },
  )

  it.each(
    Object.entries(TOOL_PAGES).flatMap(([name, p]) =>
      (p.examples ?? [])
        .filter((e) => /^Tool input(?! and)/i.test(e.title))
        .map((e) => [name, e.code] as const),
    ),
  )("%s: the written tool input uses only real parameters", (name, code) => {
    const json = code.replace(/^\s*\/\/.*$/gm, "")
    let args: Record<string, unknown>
    try {
      args = JSON.parse(json)
    } catch {
      return // annotated, not plain JSON
    }
    const known = new Set(TOOL_REGISTRY.find((t) => t.name === name)!.params.map((p) => p.name))
    expect(Object.keys(args).filter((k) => !known.has(k))).toEqual([])
  })
})

describe("every page is reachable and every link resolves", () => {
  const navIds = MCP_NAV_SECTIONS.flatMap((g) => (g.children ?? []).map((c) => c.id))

  it("every nav entry is a section, every section has a path", () => {
    for (const id of navIds) expect(bySlug.has(id), id).toBe(true)
    for (const s of sections) expect(MCP_PATHS[s.slug], s.slug).toBeDefined()
  })

  it("every related link names a section", () => {
    for (const s of sections)
      for (const r of s.related) expect(bySlug.has(r.slug), `${s.slug} → ${r.slug}`).toBe(true)
  })

  it("every in-page /docs/mcp link is a known path", () => {
    const paths = new Set(Object.values(MCP_PATHS))
    for (const s of sections)
      for (const m of JSON.stringify(s.content).matchAll(/\]\((\/docs\/mcp[^)#]*)/g))
        expect(paths.has(m[1]!), `${s.slug} links ${m[1]}`).toBe(true)
  })

  it("keeps every URL the old docs had", () => {
    for (const old of [
      "mcp-introduction",
      "why-mcp",
      "get-api-key",
      "agent-decision-guide",
      "install-overview",
      "claude-desktop",
      "cursor",
      "cline",
      "continue",
      "cowork",
      "drag-and-drop",
      "how-it-works",
      "env-variables",
      "common-issues",
      "known-limitations",
      "upgrading",
    ])
      expect(bySlug.has(old), old).toBe(true)
  })
})
