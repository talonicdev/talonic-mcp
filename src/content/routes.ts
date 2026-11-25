// ---------------------------------------------------------------------------
// Where each MCP docs section lives on talonic.com. The website owns routing
// (src/lib/docs-nav-routes.ts MCP_ROUTES); this map is the proposal it can
// import instead of keeping its own copy, and what in-page links use.
// Existing routes are unchanged; new sections get the paths below.
// ---------------------------------------------------------------------------

import { TOOL_REGISTRY } from "./generated/tool-registry"

const PAGES: Record<string, string> = {
  "mcp-introduction": "/docs/mcp",
  "why-mcp": "/docs/mcp/why",
  "get-api-key": "/docs/mcp/api-key",
  "install-overview": "/docs/mcp/install",
  "claude-desktop": "/docs/mcp/claude-desktop",
  cursor: "/docs/mcp/cursor",
  cline: "/docs/mcp/cline",
  continue: "/docs/mcp/continue",
  cowork: "/docs/mcp/cowork",
  "env-variables": "/docs/mcp/configuration",
  "tools-by-task": "/docs/mcp/tools",
  "agent-decision-guide": "/docs/mcp/tools",
  "files-and-uploads": "/docs/mcp/files",
  "drag-and-drop": "/docs/mcp/drag-and-drop",
  "how-it-works": "/docs/mcp/how-it-works",
  "recipe-set-up-workspace": "/docs/mcp/recipes/set-up-a-workspace",
  "recipe-process-inbox": "/docs/mcp/recipes/process-an-inbox",
  "recipe-audit-invoices": "/docs/mcp/recipes/audit-invoices",
  "recipe-contract-question": "/docs/mcp/recipes/answer-a-contract-question",
  "run-talonic-tasks": "/docs/mcp/run-talonic-tasks",
  "common-issues": "/docs/mcp/troubleshooting",
  "known-limitations": "/docs/mcp/known-limitations",
  upgrading: "/docs/mcp/upgrading",
}

/** URL path of a section on talonic.com, by slug. */
export const MCP_PATHS: Record<string, string> = {
  ...PAGES,
  ...Object.fromEntries(
    TOOL_REGISTRY.map((t) => [
      t.name.replace(/_/g, "-"),
      `/docs/mcp/tools/${t.name.replace(/^talonic_/, "").replace(/_/g, "-")}`,
    ]),
  ),
}

/** Inline link to another MCP docs section. */
export function link(slug: string, text: string): string {
  const path = MCP_PATHS[slug]
  if (!path) throw new Error(`No MCP docs path for ${slug}`)
  return `[${text}](${path})`
}

/** Inline link to a tool's reference page, with the tool name as code. */
export function tool(name: string): string {
  return link(name.replace(/_/g, "-"), `\`${name}\``)
}
