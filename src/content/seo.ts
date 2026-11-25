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
    children: [
      { id: "tools-by-task", label: "Tools by task" },
      ...TOOL_NAV,
      // App tools: listed only when the credential can read the workspace's apps.
      { id: "talonic-create-app", label: "talonic_create_app" },
      { id: "talonic-get-app", label: "talonic_get_app" },
      { id: "talonic-get-app-logic", label: "talonic_get_app_logic" },
      { id: "talonic-get-app-fields", label: "talonic_get_app_fields" },
      { id: "talonic-save-app-draft", label: "talonic_save_app_draft" },
      { id: "talonic-interpret-app-rules", label: "talonic_interpret_app_rules" },
      { id: "talonic-propose-app-edit", label: "talonic_propose_app_edit" },
      { id: "talonic-apply-app-edit", label: "talonic_apply_app_edit" },
      { id: "talonic-list-app-versions", label: "talonic_list_app_versions" },
      { id: "talonic-publish-app", label: "talonic_publish_app" },
      { id: "talonic-enable-app", label: "talonic_enable_app" },
      { id: "talonic-disable-app", label: "talonic_disable_app" },
      { id: "talonic-get-app-acceptance", label: "talonic_get_app_acceptance" },
      { id: "talonic-save-app-acceptance", label: "talonic_save_app_acceptance" },
      { id: "talonic-check-app-acceptance", label: "talonic_check_app_acceptance" },
      { id: "talonic-run-app", label: "talonic_run_app" },
      { id: "talonic-list-app-runs", label: "talonic_list_app_runs" },
      { id: "talonic-get-app-run", label: "talonic_get_app_run" },
      { id: "talonic-get-run-record", label: "talonic_get_run_record" },
      { id: "talonic-get-run-verdicts", label: "talonic_get_run_verdicts" },
      { id: "talonic-list-app-reviews", label: "talonic_list_app_reviews" },
      { id: "talonic-raise-app-review", label: "talonic_raise_app_review" },
      { id: "talonic-resolve-app-review", label: "talonic_resolve_app_review" },
      { id: "talonic-interview-app-review", label: "talonic_interview_app_review" },
      { id: "talonic-list-app-precedents", label: "talonic_list_app_precedents" },
      { id: "talonic-mining-list-rounds", label: "talonic_mining_list_rounds" },
      { id: "talonic-mining-get-round", label: "talonic_mining_get_round" },
      { id: "talonic-mining-start-round", label: "talonic_mining_start_round" },
      { id: "talonic-mining-list-round-tools", label: "talonic_mining_list_round_tools" },
      { id: "talonic-mining-call-round-tool", label: "talonic_mining_call_round_tool" },
      { id: "talonic-mining-get-round-tool-call", label: "talonic_mining_get_round_tool_call" },
    ],
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
    id: "tool-groups",
    label: "App and Admin Tools",
    children: [
      { id: "data-management-tools", label: "Documents, extractions, jobs and schemas" },
      { id: "events-tools", label: "Events" },
      { id: "aggregate-tools", label: "Workspace metrics" },
      { id: "admin-tools", label: "Workspace administration" },
      { id: "contract-desk-tools", label: "Contract Desk" },
      { id: "transport-folders-tools", label: "Transport Folders" },
      { id: "compliance-tools", label: "Compliance" },
      { id: "money-found-tools", label: "Money Found" },
      { id: "customs-declaration-tools", label: "Customs declaration" },
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
