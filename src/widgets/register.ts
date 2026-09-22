import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerWidget, widgetMeta } from "./shared.js"
import { WIDGET_DESCRIPTIONS, WIDGET_URIS, widgetKeyForUri, type WidgetKey } from "./types.js"
import { getExtractionResultWidgetHtml } from "./extraction-result.js"
import { getBalanceWidgetHtml } from "./balance.js"
import { getUploadLinkWidgetHtml } from "./upload-link.js"
import { getSchemaSavedWidgetHtml } from "./schema-saved.js"
import { getDocumentMetaWidgetHtml } from "./document-meta.js"
import { getMarkdownViewWidgetHtml } from "./markdown-view.js"
import { getSchemaListWidgetHtml } from "./schema-list.js"
import { getSearchResultsWidgetHtml } from "./search-results.js"
import { getFilterResultsWidgetHtml } from "./filter-results.js"
import { getPricingWidgetHtml } from "./pricing.js"
import { getUsageWidgetHtml } from "./usage.js"
import { getFieldListWidgetHtml } from "./field-list.js"
import { getFieldCardWidgetHtml } from "./field-card.js"
import { getFieldValuesWidgetHtml } from "./field-values.js"
import { getFindDataWidgetHtml } from "./find-data.js"
import { getAgentToolsWidgetHtml } from "./agent-tools.js"
import { getAgentToolResultWidgetHtml } from "./agent-tool-result.js"
import { getAgentTaskListWidgetHtml } from "./agent-task-list.js"
import { getAgentTaskWidgetHtml } from "./agent-task.js"
import { getAgentTaskClaimWidgetHtml, getAgentTaskHeartbeatWidgetHtml } from "./agent-task-lease.js"
import { getAgentTaskSubmittedWidgetHtml } from "./agent-task-submitted.js"
import { getSpecListWidgetHtml } from "./spec-list.js"
import { getSpecCardWidgetHtml } from "./spec-card.js"
import { getRunStartedWidgetHtml } from "./run-started.js"
import { getRunStatusWidgetHtml } from "./run-status.js"
import { getRunResultsWidgetHtml } from "./run-results.js"
import { getAnswerWidgetHtml, getAnswerPolledWidgetHtml } from "./answer.js"

interface WidgetEntry {
  /** MCP resource name. */
  name: string
  /** Human-readable resource title. */
  title: string
  /** Template factory (templates are static; the factory keeps import order lazy). */
  html: () => string
}

/**
 * The one table every widget consumer reads from: resource registration,
 * the hosted server's public template fast path, and the tests. Adding a
 * widget = one `WIDGET_URIS` key (types.ts, with its description and status
 * strings) + one entry here + `_meta: widgetToolMeta(key)` on the tool.
 *
 * @internal
 */
const WIDGET_REGISTRY: Readonly<Record<WidgetKey, WidgetEntry>> = {
  extract: {
    name: "extraction-result-widget",
    title: "Talonic Extraction Result",
    html: getExtractionResultWidgetHtml,
  },
  search: {
    name: "search-results-widget",
    title: "Talonic Search Results",
    html: getSearchResultsWidgetHtml,
  },
  filter: {
    name: "filter-results-widget",
    title: "Talonic Filter Results",
    html: getFilterResultsWidgetHtml,
  },
  getDocument: {
    name: "document-meta-widget",
    title: "Talonic Document",
    html: getDocumentMetaWidgetHtml,
  },
  toMarkdown: {
    name: "markdown-view-widget",
    title: "Talonic Markdown",
    html: getMarkdownViewWidgetHtml,
  },
  listSchemas: {
    name: "schema-list-widget",
    title: "Talonic Schemas",
    html: getSchemaListWidgetHtml,
  },
  saveSchema: {
    name: "schema-saved-widget",
    title: "Talonic Schema Saved",
    html: getSchemaSavedWidgetHtml,
  },
  getBalance: { name: "balance-widget", title: "Talonic Balance", html: getBalanceWidgetHtml },
  getPricing: { name: "pricing-widget", title: "Talonic Pricing", html: getPricingWidgetHtml },
  getUsage: { name: "usage-widget", title: "Talonic Usage", html: getUsageWidgetHtml },
  requestUpload: {
    name: "upload-link-widget",
    title: "Talonic Upload Link",
    html: getUploadLinkWidgetHtml,
  },
  listFields: {
    name: "field-list-widget",
    title: "Talonic Field Registry",
    html: getFieldListWidgetHtml,
  },
  getField: {
    name: "field-card-widget",
    title: "Talonic Field Card",
    html: getFieldCardWidgetHtml,
  },
  fieldValues: {
    name: "field-values-widget",
    title: "Talonic Field Values",
    html: getFieldValuesWidgetHtml,
  },
  findData: { name: "find-data-widget", title: "Talonic Find Data", html: getFindDataWidgetHtml },
  listAgentTools: {
    name: "agent-tools-widget",
    title: "Talonic Agent Tools",
    html: getAgentToolsWidgetHtml,
  },
  invokeAgentTool: {
    name: "agent-tool-result-widget",
    title: "Talonic Agent Tool Result",
    html: getAgentToolResultWidgetHtml,
  },
  listAgentTasks: {
    name: "agent-task-list-widget",
    title: "Talonic Agent Tasks",
    html: getAgentTaskListWidgetHtml,
  },
  getAgentTask: {
    name: "agent-task-widget",
    title: "Talonic Agent Task",
    html: getAgentTaskWidgetHtml,
  },
  claimAgentTask: {
    name: "agent-task-claim-widget",
    title: "Talonic Agent Task Claimed",
    html: getAgentTaskClaimWidgetHtml,
  },
  heartbeatAgentTask: {
    name: "agent-task-heartbeat-widget",
    title: "Talonic Agent Task Lease",
    html: getAgentTaskHeartbeatWidgetHtml,
  },
  submitAgentTask: {
    name: "agent-task-submitted-widget",
    title: "Talonic Agent Task Submitted",
    html: getAgentTaskSubmittedWidgetHtml,
  },
  listSpecs: { name: "spec-list-widget", title: "Talonic Specs", html: getSpecListWidgetHtml },
  getSpec: { name: "spec-card-widget", title: "Talonic Spec", html: getSpecCardWidgetHtml },
  runSpec: {
    name: "run-started-widget",
    title: "Talonic Run Started",
    html: getRunStartedWidgetHtml,
  },
  getRun: {
    name: "run-status-widget",
    title: "Talonic Run Progress",
    html: getRunStatusWidgetHtml,
  },
  getRunResults: {
    name: "run-results-widget",
    title: "Talonic Run Results",
    html: getRunResultsWidgetHtml,
  },
  ask: { name: "answer-widget", title: "Talonic Answer", html: getAnswerWidgetHtml },
  getAnswer: {
    name: "answer-polled-widget",
    title: "Talonic Answer (polled)",
    html: getAnswerPolledWidgetHtml,
  },
}

/**
 * Widget template HTML by resource URI. Used by the http-server's public
 * template fast path: ChatGPT's widget renderer fetches these from the
 * sandbox iframe context, and that fetch must never fail on auth or Accept
 * negotiation. The templates are static, secret-free HTML (asserted by
 * tests), so serving them unauthenticated is safe.
 *
 * @internal
 */
export function getWidgetTemplateHtml(uri: string): string | undefined {
  const key = widgetKeyForUri(uri)
  return key ? WIDGET_REGISTRY[key].html() : undefined
}

/**
 * The `_meta` the fast path must attach to a template — identical to what
 * `registerWidget` emits for the same URI (domain, CSP, description, border).
 *
 * @internal
 */
export function getWidgetTemplateMeta(uri: string): Record<string, unknown> | undefined {
  const key = widgetKeyForUri(uri)
  return key ? widgetMeta(WIDGET_DESCRIPTIONS[key]) : undefined
}

function registerOne(server: McpServer, key: WidgetKey): void {
  const entry = WIDGET_REGISTRY[key]
  registerWidget(server, {
    name: entry.name,
    uri: WIDGET_URIS[key],
    title: entry.title,
    description: WIDGET_DESCRIPTIONS[key],
    html: entry.html(),
  })
}

/**
 * Register the extraction-result widget as an MCP resource.
 *
 * Kept as a named export for back-compat; {@link registerWidgets} registers
 * this alongside every other tool widget.
 *
 * @internal
 */
export function registerExtractionResultWidget(server: McpServer): void {
  registerOne(server, "extract")
}

/**
 * Register every tool widget as an MCP resource. Each tool opts into its
 * widget by declaring `_meta: widgetToolMeta(key)` in its `registerTool`
 * config.
 *
 * @internal
 */
export function registerWidgets(server: McpServer): void {
  for (const key of Object.keys(WIDGET_REGISTRY) as WidgetKey[]) registerOne(server, key)
}
