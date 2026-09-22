/**
 * MIME type for Apps SDK widget resources. The `profile=mcp-app` parameter
 * tells the host this is a renderable widget, not arbitrary HTML.
 *
 * @public
 */
export const WIDGET_MIME = "text/html;profile=mcp-app"

/**
 * Back-compat alias. Prefer {@link WIDGET_MIME}.
 *
 * @public
 */
export const EXTRACTION_RESULT_WIDGET_MIME = WIDGET_MIME

/**
 * Widget resource URIs, one per public tool. A tool opts into its widget by
 * declaring `_meta` via {@link widgetToolMeta} in its `registerTool` config.
 *
 * @public
 */
export const WIDGET_URIS = {
  extract: "ui://widget/extraction-result.html",
  search: "ui://widget/search-results.html",
  filter: "ui://widget/filter-results.html",
  getDocument: "ui://widget/document-meta.html",
  toMarkdown: "ui://widget/markdown-view.html",
  listSchemas: "ui://widget/schema-list.html",
  saveSchema: "ui://widget/schema-saved.html",
  getBalance: "ui://widget/balance.html",
  getPricing: "ui://widget/pricing.html",
  getUsage: "ui://widget/usage.html",
  requestUpload: "ui://widget/upload-link.html",
  listFields: "ui://widget/field-list.html",
  getField: "ui://widget/field-card.html",
  fieldValues: "ui://widget/field-values.html",
  findData: "ui://widget/find-data.html",
  listAgentTools: "ui://widget/agent-tools.html",
  invokeAgentTool: "ui://widget/agent-tool-result.html",
  listAgentTasks: "ui://widget/agent-task-list.html",
  getAgentTask: "ui://widget/agent-task.html",
  claimAgentTask: "ui://widget/agent-task-claim.html",
  heartbeatAgentTask: "ui://widget/agent-task-heartbeat.html",
  submitAgentTask: "ui://widget/agent-task-submitted.html",
  listSpecs: "ui://widget/spec-list.html",
  getSpec: "ui://widget/spec-card.html",
  runSpec: "ui://widget/run-started.html",
  getRun: "ui://widget/run-status.html",
  getRunResults: "ui://widget/run-results.html",
  ask: "ui://widget/answer.html",
  getAnswer: "ui://widget/answer-polled.html",
  listDecisionTasks: "ui://widget/decision-task-list.html",
  claimDecisionTask: "ui://widget/decision-bundle.html",
  readDecisionPackage: "ui://widget/decision-package.html",
  heartbeatDecisionTask: "ui://widget/decision-task-heartbeat.html",
  submitDecisionTask: "ui://widget/decision-task-submitted.html",
  releaseDecisionTask: "ui://widget/decision-task-released.html",
  failDecisionTask: "ui://widget/decision-task-failed.html",
} as const

/** A key of {@link WIDGET_URIS}. @public */
export type WidgetKey = keyof typeof WIDGET_URIS

/**
 * Back-compat alias for the extraction-result widget URI. Prefer
 * {@link WIDGET_URIS}.extract.
 *
 * @public
 */
export const EXTRACTION_RESULT_WIDGET_URI = WIDGET_URIS.extract

/**
 * Public tool name → widget key. This is the single source of truth for
 * "which card does this tool render"; tests derive the 36-tool lock from it.
 * Talonic-internal tools (`talonic_growth_*`, `talonic_admin_*`) have no
 * widget and are deliberately absent.
 *
 * @public
 */
export const TOOL_WIDGET_KEYS: Readonly<Record<string, WidgetKey>> = {
  talonic_extract: "extract",
  talonic_search: "search",
  talonic_filter: "filter",
  talonic_get_document: "getDocument",
  talonic_to_markdown: "toMarkdown",
  talonic_list_schemas: "listSchemas",
  talonic_save_schema: "saveSchema",
  talonic_get_balance: "getBalance",
  talonic_get_pricing: "getPricing",
  talonic_get_usage: "getUsage",
  talonic_request_upload: "requestUpload",
  talonic_list_fields: "listFields",
  talonic_get_field: "getField",
  talonic_field_values: "fieldValues",
  talonic_find_data: "findData",
  talonic_list_agent_tools: "listAgentTools",
  talonic_invoke_agent_tool: "invokeAgentTool",
  talonic_list_agent_tasks: "listAgentTasks",
  talonic_get_agent_task: "getAgentTask",
  talonic_claim_agent_task: "claimAgentTask",
  talonic_heartbeat_agent_task: "heartbeatAgentTask",
  talonic_submit_agent_task: "submitAgentTask",
  talonic_list_specs: "listSpecs",
  talonic_get_spec: "getSpec",
  talonic_run_spec: "runSpec",
  talonic_get_run: "getRun",
  talonic_get_run_results: "getRunResults",
  talonic_ask: "ask",
  talonic_get_answer: "getAnswer",
  talonic_list_decision_tasks: "listDecisionTasks",
  talonic_claim_decision_task: "claimDecisionTask",
  talonic_read_decision_package: "readDecisionPackage",
  talonic_heartbeat_decision_task: "heartbeatDecisionTask",
  talonic_submit_decision_task: "submitDecisionTask",
  talonic_release_decision_task: "releaseDecisionTask",
  talonic_fail_decision_task: "failDecisionTask",
}

/** Status text ChatGPT shows while a tool runs and once it has finished. @public */
export interface ToolInvocationStatus {
  /** Shown during the call. ≤ 64 characters. */
  invoking: string
  /** Shown after the call completes. ≤ 64 characters. */
  invoked: string
}

/**
 * `openai/toolInvocation/*` strings per widget. Kept short and factual: they
 * appear inline in the ChatGPT transcript above the card.
 *
 * @public
 */
export const TOOL_INVOCATION_STATUS: Readonly<Record<WidgetKey, ToolInvocationStatus>> = {
  extract: { invoking: "Extracting structured data…", invoked: "Extraction complete" },
  search: { invoking: "Searching the workspace…", invoked: "Search results ready" },
  filter: { invoking: "Filtering documents by field values…", invoked: "Filter results ready" },
  getDocument: { invoking: "Fetching document details…", invoked: "Document details ready" },
  toMarkdown: { invoking: "Converting document to markdown…", invoked: "Markdown ready" },
  listSchemas: { invoking: "Loading saved schemas…", invoked: "Schemas listed" },
  saveSchema: { invoking: "Saving schema…", invoked: "Schema saved" },
  getBalance: { invoking: "Checking credit balance…", invoked: "Balance ready" },
  getPricing: { invoking: "Loading pricing catalog…", invoked: "Pricing ready" },
  getUsage: { invoking: "Loading usage breakdown…", invoked: "Usage ready" },
  requestUpload: { invoking: "Preparing upload link…", invoked: "Upload link ready" },
  listFields: { invoking: "Loading the Field Registry…", invoked: "Fields listed" },
  getField: { invoking: "Loading field concept card…", invoked: "Field card ready" },
  fieldValues: {
    invoking: "Reading field values across documents…",
    invoked: "Field values ready",
  },
  findData: { invoking: "Locating data behind the concept…", invoked: "Matching data found" },
  listAgentTools: { invoking: "Listing platform agent tools…", invoked: "Agent tools listed" },
  invokeAgentTool: { invoking: "Running platform agent tool…", invoked: "Agent tool result ready" },
  listAgentTasks: { invoking: "Loading agent task worklist…", invoked: "Agent tasks listed" },
  getAgentTask: { invoking: "Loading agent task…", invoked: "Agent task ready" },
  claimAgentTask: { invoking: "Claiming agent task…", invoked: "Agent task claimed" },
  heartbeatAgentTask: { invoking: "Extending task lease…", invoked: "Lease extended" },
  submitAgentTask: { invoking: "Submitting task outputs…", invoked: "Task submitted" },
  listSpecs: { invoking: "Loading Specs…", invoked: "Specs listed" },
  getSpec: { invoking: "Loading Spec structure…", invoked: "Spec structure ready" },
  runSpec: { invoking: "Starting the Spec run…", invoked: "Run started" },
  getRun: { invoking: "Checking run progress…", invoked: "Run progress ready" },
  getRunResults: { invoking: "Loading run results…", invoked: "Run results ready" },
  ask: { invoking: "Asking Talonic over your documents…", invoked: "Answer ready" },
  getAnswer: { invoking: "Checking for the answer…", invoked: "Answer status ready" },
  listDecisionTasks: { invoking: "Loading decision tasks…", invoked: "Decision tasks listed" },
  claimDecisionTask: { invoking: "Claiming decision task…", invoked: "Decision task claimed" },
  readDecisionPackage: { invoking: "Reading the decision package…", invoked: "Package page ready" },
  heartbeatDecisionTask: { invoking: "Extending the decision lease…", invoked: "Lease extended" },
  submitDecisionTask: { invoking: "Submitting the decision…", invoked: "Decision submitted" },
  releaseDecisionTask: { invoking: "Releasing the decision task…", invoked: "Task released" },
  failDecisionTask: {
    invoking: "Reporting the task as undecidable…",
    invoked: "Task failed",
  },
}

/**
 * Model-facing one-sentence summary of what each card shows. Emitted as
 * `_meta["openai/widgetDescription"]` on the widget resource so the model
 * knows what the user is looking at without re-reading the payload.
 *
 * @public
 */
export const WIDGET_DESCRIPTIONS: Readonly<Record<WidgetKey, string>> = {
  extract:
    "Card showing the extracted fields with per-field confidence, the source document, and the credit cost of the extraction.",
  search:
    "Card listing the documents, fields, schemas and sources that matched the query, grouped by type.",
  filter:
    "Table of documents whose extracted field values matched the filter, plus any API warnings about field types.",
  getDocument: "Card with one document's metadata, processing status, and triage flags.",
  toMarkdown: "Scrollable view of a document's OCR-converted markdown text.",
  listSchemas: "Table of the workspace's saved extraction schemas with their field counts.",
  saveSchema: "Confirmation card for a newly saved reusable schema.",
  getBalance:
    "Card with the workspace credit balance, EUR value, tier, 30-day burn and projected runway.",
  getPricing:
    "Table of Talonic's per-unit credit pricing with EUR values, free-tier badges and multipliers.",
  getUsage:
    "Breakdown of credits consumed per function over the trailing window, with proportion bars.",
  requestUpload:
    "Card with the browser upload link the user must open to add their file, plus the document id and expiry.",
  listFields:
    "Table of Field Registry concepts with data type, maturity (core, proven, candidate) and occurrence counts.",
  getField:
    "Concept card for one registry field: definition, synonyms, occurrence statistics, top values and schema usage.",
  fieldValues:
    "Table of one field's current values across documents with confidence and source-text provenance.",
  findData:
    "Ranked matches for a natural-language concept across four planes: fields, values, documents and passages.",
  listAgentTools:
    "Table of the platform agent tool registry with each tool's impact, capability and whether this key may invoke it.",
  invokeAgentTool:
    "Result of one platform agent tool call, rendered as a table, key-value tiles or a JSON tree, with citations.",
  listAgentTasks:
    "Worklist of Agent-stage tasks with status, document, lease expiry, timeout and execution epoch.",
  getAgentTask:
    "Card for one Agent-stage task: status, timing, instructions, declared output contract and the input snapshot.",
  claimAgentTask:
    "Lease card confirming the claim: execution epoch to keep, lease expiry, and the task's instructions and contract.",
  heartbeatAgentTask:
    "Lease card confirming the lease was extended, with the new expiry and execution epoch.",
  submitAgentTask:
    "Confirmation that the declared outputs were submitted and the parked document resumed its pipeline.",
  listSpecs:
    "Table of the workspace's Specs (configured pipelines) with version state, field and stage counts, and last update.",
  getSpec:
    "Card for one Spec: version state, the schema it materializes onto, the rail's stages in order, the compiled phases, and its fields.",
  runSpec:
    "Confirmation that a Spec run started: run kind, input count, spec/pipeline/run ids, status, and how to poll it.",
  getRun:
    "Progress card for a Spec run: normalised status, documents completed / total / errors, and per-phase progress when available.",
  getRunResults:
    "Table of a Spec run's structured rows — one row per document with the Spec's fields — plus review holds and pagination.",
  ask: "Cited answer card: the answer text, verification verdict, source citations, artifacts and credit usage.",
  getAnswer:
    "Polled answer card: the same cited answer with verification and citations, or a still-processing notice.",
  listDecisionTasks:
    "Worklist of an External-mode app's decision tasks with status, run, epoch, lease expiry and SLA deadline.",
  claimDecisionTask:
    "Claim bundle: the task's lease and epoch, the output contract to satisfy, precedents, and the input-package descriptor with its source documents.",
  readDecisionPackage:
    "One page of a claimed task's frozen input package: the records to decide from, page position, and the source documents on the first page.",
  heartbeatDecisionTask:
    "Lease card confirming the decision task's lease was extended, with the new expiry and SLA deadline.",
  submitDecisionTask: "Confirmation that the decision was submitted and verified; the run resumes.",
  releaseDecisionTask:
    "Confirmation that the decision task was released back to available for another claimant.",
  failDecisionTask:
    "Confirmation that the task was reported undecidable: a Human Review is raised and the app's fallback applies.",
}

/**
 * Build the `_meta` block a tool declares to opt into its widget: the modern
 * `ui.resourceUri` key, the `openai/outputTemplate` alias, and the two
 * `openai/toolInvocation/*` status strings.
 *
 * @public
 */
export function widgetToolMeta(key: WidgetKey): Record<string, unknown> {
  const uri = WIDGET_URIS[key]
  const status = TOOL_INVOCATION_STATUS[key]
  return {
    ui: { resourceUri: uri },
    "openai/outputTemplate": uri,
    "openai/toolInvocation/invoking": status.invoking,
    "openai/toolInvocation/invoked": status.invoked,
  }
}

/**
 * Reverse lookup: widget URI → key. Used by the hosted server's public
 * template fast path and by the registry.
 *
 * @public
 */
export function widgetKeyForUri(uri: string): WidgetKey | undefined {
  for (const key of Object.keys(WIDGET_URIS) as WidgetKey[]) {
    if (WIDGET_URIS[key] === uri) return key
  }
  return undefined
}
