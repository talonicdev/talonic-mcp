// ---------------------------------------------------------------------------
// Structured content export for @talonic/mcp documentation.
//
// ⚠ This module is the source-of-truth for talonic.com/docs/mcp/* pages.
// The website's <McpContentPage> calls getMcpSection(slug) at render time.
// docs/sections.json is a dormant mirror generated FROM these sections
// (npm run docs:gen); editing it changes no page.
// Full architecture, "add a new tool" checklist, and failure modes:
//   docs/architecture/docs-pipeline.md
//
// Usage:
//   import { getMcpSection, getAllMcpSections, MCP_NAV_SECTIONS } from '@talonic/mcp/content'
// ---------------------------------------------------------------------------

export type { DocBlock, DocSection, RawSection, Param, HttpMethod, NavSection } from "./types"

export { MCP_NAV_SECTIONS } from "./seo"
export { MCP_PATHS } from "./routes"
export { MCP_CLIENTS } from "./sections/connect"
export type { McpClient } from "./sections/connect"

import type { DocSection, RawSection } from "./types"
import { deriveBreadcrumbs, derivePrevNext } from "./helpers"
import { MCP_NAV_SECTIONS } from "./seo"

// --- Section imports ---
import { sections as overview } from "./sections/overview"
import { sections as connect } from "./sections/connect"
import { sections as configuration } from "./sections/configuration"
import { sections as toolsByTask } from "./sections/tools-by-task"
import { sections as toolReference } from "./sections/tool-reference"
import { sections as files } from "./sections/files"
import { sections as recipes } from "./sections/recipes"
import { sections as advanced } from "./sections/advanced"
import { sections as troubleshooting } from "./sections/troubleshooting"

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const ALL_RAW: RawSection[] = [
  ...overview,
  ...connect,
  ...configuration,
  ...toolsByTask,
  ...toolReference,
  ...files,
  ...recipes,
  ...advanced,
  ...troubleshooting,
]

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

function enrich(raw: RawSection[]): DocSection[] {
  return raw.map((r) => {
    const { prev, next } = derivePrevNext(MCP_NAV_SECTIONS, r.slug)
    return {
      ...r,
      breadcrumbs: deriveBreadcrumbs(MCP_NAV_SECTIONS, r.slug),
      prev,
      next,
    }
  })
}

let _sections: DocSection[] | null = null

function getSectionsAll(): DocSection[] {
  if (!_sections) {
    _sections = enrich(ALL_RAW)
  }
  return _sections
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get a single MCP section by slug, or null if not found. */
export function getMcpSection(slug: string): DocSection | null {
  return getSectionsAll().find((s) => s.slug === slug) ?? null
}

/** Get all MCP sections in reading order. */
export function getAllMcpSections(): DocSection[] {
  return getSectionsAll()
}
