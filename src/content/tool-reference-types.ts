// Shapes of the generated tool registry snapshot (scripts/gen-docs.mjs) and
// the hand-written per-tool page overlay (src/content/tool-pages.ts).

/** One parameter of a tool's input, as tools/list declares it. */
export interface RegistryParam {
  name: string
  type: string
  required: boolean
  description?: string
  default?: string
  minimum?: number
  maximum?: number
  enum?: unknown[]
}

/** Inventory groups the reference documents (scripts/gen-docs.mjs REFERENCE_GROUPS). */
export type RegistryGroup =
  | "core"
  | "agent_tasks"
  | "decision_tasks"
  | "processes"
  | "spec_authoring"
  | "integrations"
  | "workspace_operations"
  | "review"
  | "cases"
  | "data_products"
  | "data_policies"
  | "workspace_data"
  | "schema_review"
  | "team_admin"
  | "records_admin"
  | "workspace_admin"
  | "thread"
  | "agent_turns"
  | "my_data"
  | "app_receivables"
  | "app_spend_audit"
  | "app_objects"
  | "app_payables_desk"
  | "app_workbook"
  | "app_record_sets"
  | "app_compliance"
  | "app_money_found"
  | "app_contract_check"
  | "app_chart_to_data"

/** One documented tool, as tools/list returns it. */
export interface RegistryTool {
  name: string
  /** Inventory group key (scripts/tool-inventory.mjs GROUPS). */
  group: RegistryGroup
  title: string
  description: string
  readOnly: boolean
  destructive: boolean
  openWorld: boolean
  /** Not listed to OpenAI / ChatGPT clients. */
  notForOpenAi: boolean
  params: RegistryParam[]
}

/** The task a tool serves on the "Tools by task" page. */
export type ToolTask =
  | "find"
  | "extract"
  | "ask"
  | "sources"
  | "organise"
  | "run"
  | "specs"
  | "review"
  | "data"
  | "build"
  | "automate"
  | "thread"
  | "apps"
  | "workspace"
  | "admin"

/** Hand-written page copy for one tool; everything else is generated. */
export interface ToolPage {
  task: ToolTask
  seoTitle: string
  /** Meta description, 150-160 characters. */
  description: string
  /** Uses credits when called (shown under "Cost"). */
  credits?: string
  examples?: { title: string; language?: string; code: string }[]
  faq?: { question: string; answer: string }[]
  related?: { label: string; slug: string }[]
  mentions?: string[]
}
