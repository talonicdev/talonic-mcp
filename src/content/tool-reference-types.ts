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

/** One documented tool, as tools/list returns it. */
export interface RegistryTool {
  name: string
  /** Inventory group key (scripts/tool-inventory.mjs GROUPS). */
  group: "core" | "agent_tasks" | "decision_tasks" | "processes"
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
  | "run"
  | "review"
  | "build"
  | "automate"
  | "apps"
  | "workspace"

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
