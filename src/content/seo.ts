import type { NavSection } from "./types"
import { TOOL_REGISTRY } from "./generated/tool-registry"
import { TOOL_PAGES } from "./tool-pages"
import { TASKS } from "./sections/tools-by-task"

const taskIndex = (name: string) => TASKS.findIndex((t) => t.task === TOOL_PAGES[name]?.task)

/** Tool reference entries, grouped by task in the order of the Tools by task page. */
const TOOL_NAV = TOOL_REGISTRY.map((t, i) => ({ t, i }))
  .sort((a, b) => taskIndex(a.t.name) - taskIndex(b.t.name) || a.i - b.i)
  .map(({ t }) => ({ id: t.name.replace(/_/g, "-"), label: t.name }))

/**
 * MCP documentation navigation — synced to website.
 *
 * Sections kept for old URLs but no longer in the nav: why-mcp,
 * agent-decision-guide, claude-desktop, cursor, cline, continue, cowork,
 * drag-and-drop, how-it-works.
 */
export const MCP_NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    children: [
      { id: "mcp-introduction", label: "What an agent can do" },
      { id: "get-api-key", label: "Get an API key" },
    ],
  },
  {
    id: "install",
    label: "Connect",
    children: [
      { id: "install-overview", label: "Connect your agent" },
      { id: "env-variables", label: "Configuration" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    children: [{ id: "tools-by-task", label: "Tools by task" }, ...TOOL_NAV],
  },
  {
    id: "files",
    label: "Files",
    children: [{ id: "files-and-uploads", label: "Files and uploads" }],
  },
  {
    id: "recipes",
    label: "Recipes",
    children: [
      { id: "recipe-set-up-workspace", label: "Set up a workspace" },
      { id: "recipe-process-inbox", label: "Process an inbox" },
      { id: "recipe-audit-invoices", label: "Audit invoices" },
      { id: "recipe-contract-question", label: "Answer a contract question" },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    children: [{ id: "run-talonic-tasks", label: "Run Talonic tasks from your agent" }],
  },
  {
    id: "troubleshooting",
    label: "Troubleshooting",
    children: [
      { id: "common-issues", label: "Troubleshooting" },
      { id: "known-limitations", label: "Limits" },
      { id: "upgrading", label: "Upgrading" },
    ],
  },
]
