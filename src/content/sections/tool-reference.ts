// ---------------------------------------------------------------------------
// Tool reference: one page per public tool, rendered from the generated
// registry snapshot (src/content/generated/tool-registry.ts, written by
// `npm run docs:gen` from a real tools/list) plus the hand-written copy in
// src/content/tool-pages.ts. The summary, usage notes, parameters,
// availability and behaviour therefore always match what an agent sees.
// App-gated and Talonic-internal tool groups are never in the registry.
// ---------------------------------------------------------------------------

import type { DocBlock, Param, RawSection } from "../types"
import type { RegistryParam, RegistryTool, ToolPage } from "../tool-reference-types"
import { TOOL_REGISTRY } from "../generated/tool-registry"
import { TOOL_PAGES } from "../tool-pages"
import { link } from "../routes"

/** Labels the tool descriptions use for their sections (`USE WHEN: …`). */
const LABEL = /^([A-Z][A-Z -]*[A-Z])(?:\s*\(([^)]*)\))?:\s*(.*)$/

const LABEL_TEXT: Record<string, string> = {
  "USE WHEN": "Use it when",
  "NOT FOR": "Not for",
  "BY NAME": "By file name",
  ARGS: "Arguments",
  RETURNS: "Returns",
  COST: "Cost",
  AUTH: "Access",
}

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

/** Split a tool description into its lead paragraphs and labelled notes. */
export function parseDescription(description: string): {
  lead: string[]
  notes: { label: string; text: string }[]
} {
  const lead: string[] = []
  const notes: { label: string; text: string }[] = []
  // Some descriptions put two labels on one line ("ARGS: … RETURNS: …").
  const text = description.replace(
    /\.\s+(USE WHEN|NOT FOR|BY NAME|ARGS|RETURNS|COST|AUTH):/g,
    ".\n$1:",
  )
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    const m = LABEL.exec(line)
    if (m && !/^https?$/i.test(m[1]!)) {
      const key = m[1]!
      const label = (LABEL_TEXT[key] ?? titleCase(key)) + (m[2] ? ` (${m[2]})` : "")
      notes.push({ label, text: m[3]! })
    } else if (notes.length === 0) {
      lead.push(line)
    } else {
      notes.push({ label: "", text: line })
    }
  }
  return { lead, notes }
}

const RECHECKED =
  "Being listed only means the tool is visible: Talonic checks your role again on every call."

const app = (name: string) =>
  `Listed when the ${name} app is enabled for your workspace and your role can use it. ${RECHECKED}`

function availability(t: RegistryTool): string {
  const base: Record<RegistryTool["group"], string> = {
    core: "Listed in every Talonic MCP session, local or hosted.",
    agent_tasks:
      "Listed in every session by default. These tools only return work when your workspace hands tasks to an outside agent.",
    decision_tasks:
      "Listed in every session. Calling it needs a per-app `decide` grant on an API key, or, on a connector session, the `apps:decide` scope and a workspace role of senior member or above. Without it the tool stays listed but is marked not callable, and the agent can tell you to reconnect.",
    processes:
      "Listed when your workspace role has the Process Plane view permission. Changing, publishing and signing are checked again on every call against your role in the process.",
    spec_authoring: `Listed when your workspace role can build and change Specs. ${RECHECKED}`,
    integrations: `Listed when the session can read the workspace's sources (\`sources:read\` on a connector session); connecting, importing and sync settings need \`sources:write\`. ${RECHECKED}`,
    workspace_operations: `Listed per area (Spec runs, ingest, ingest settings, document organising, collections, saved filters, document types) when your role can use that area of the workspace. ${RECHECKED}`,
    review: `Listed when your role can review extracted values. ${RECHECKED}`,
    cases: `Listed when your workspace has cases and your role can open them. ${RECHECKED}`,
    data_products: `Listed when your role can see the workspace's data products; changes need \`products:write\` on a connector session. ${RECHECKED}`,
    data_policies: `Listed when your role can see the workspace's data policies. ${RECHECKED}`,
    workspace_data: `Listed when your role can read the workspace data catalog. ${RECHECKED}`,
    schema_review: `Listed when your role can review suggested fields and links. ${RECHECKED}`,
    team_admin: `Listed when your role may manage the workspace team. ${RECHECKED}`,
    records_admin: `Listed when your role holds the records-management permission (retention, legal holds, audit log, erasure). ${RECHECKED}`,
    workspace_admin: `Listed when your role can see the workspace's billing and account settings. ${RECHECKED}`,
    thread: `Listed when your account has a Talonic thread. ${RECHECKED}`,
    agent_turns: `Listed when your account can use the Talonic agent. ${RECHECKED}`,
    my_data: `Listed when your account has My Data. ${RECHECKED}`,
    app_receivables: app("Receivables"),
    app_spend_audit: app("Spend Audit"),
    app_objects: app("Business objects"),
    app_payables_desk: app("Payables Desk"),
    app_workbook: app("Workbook capture"),
    app_record_sets: app("Record sets"),
    app_compliance: app("Compliance"),
    app_money_found: app("Money Found"),
    app_contract_check: app("Contract Check"),
    app_chart_to_data: app("Chart reading"),
  }
  return (
    base[t.group] +
    (t.notForOpenAi
      ? " Not listed in ChatGPT; there, ask the question with `talonic_ask` instead."
      : "")
  )
}

function behaviour(t: RegistryTool, page: ToolPage): string[] {
  const out: string[] = []
  if (t.readOnly) out.push("**Reads only.** It never changes workspace data.")
  else if (t.destructive)
    out.push("**Changes workspace data and can't be undone.** Call it only when the user asked.")
  else out.push("**Not read-only.** It can add to or change workspace data.")
  if (t.openWorld)
    out.push("**Can reach outside the workspace**, for example a public file URL you pass.")
  if (page.credits) out.push(`**Cost:** ${page.credits}`)
  else if (t.readOnly) out.push("**Cost:** no credits.")
  return out
}

function paramDescription(p: RegistryParam): string {
  const parts = [p.description ?? ""]
  if (p.minimum !== undefined || p.maximum !== undefined) {
    const range =
      p.minimum !== undefined && p.maximum !== undefined
        ? `${p.minimum} to ${p.maximum}`
        : p.minimum !== undefined
          ? `at least ${p.minimum}`
          : `at most ${p.maximum}`
    parts.push(`Range: ${range}.`)
  }
  return parts.filter(Boolean).join(" ") || "—"
}

function params(t: RegistryTool): Param[] {
  return t.params.map((p) => ({
    name: p.name,
    type: p.type,
    required: p.required,
    description: paramDescription(p),
    ...(p.default !== undefined ? { default: p.default } : {}),
  }))
}

function sample(p: RegistryParam): unknown {
  if (p.enum?.length) return p.type.endsWith("[]") ? [p.enum[0]] : p.enum[0]
  if (p.default !== undefined) {
    try {
      return JSON.parse(p.default)
    } catch {
      /* fall through */
    }
  }
  if (p.type.startsWith("number") || p.type.startsWith("integer")) return p.minimum ?? 1
  if (p.type.startsWith("boolean")) return true
  if (p.type.endsWith("[]")) return [`<${p.name.replace(/s$/, "")}>`]
  if (p.type.startsWith("object")) return {}
  return `<${p.name}>`
}

/** A call with every required argument, for tools without a written example. */
function generatedExample(t: RegistryTool): DocBlock {
  const args = Object.fromEntries(
    t.params.filter((p) => p.required).map((p) => [p.name, sample(p)]),
  )
  return {
    type: "code",
    language: "json",
    title: "Tool input",
    code: JSON.stringify(args, null, 2),
  }
}

/** One reference page. */
export function toolSection(t: RegistryTool, page: ToolPage): RawSection {
  const { lead, notes } = parseDescription(t.description)
  const content: DocBlock[] = [
    ...lead.map((text): DocBlock => ({ type: "paragraph", text })),
    ...(notes.length
      ? ([
          { type: "heading", level: 2, id: "how-to-use", text: "How an agent uses it" },
          {
            type: "list",
            items: notes.map((n) => (n.label ? `**${n.label}:** ${n.text}` : n.text)),
          },
        ] satisfies DocBlock[])
      : []),
    { type: "heading", level: 2, id: "availability", text: "Availability" },
    { type: "paragraph", text: availability(t) },
    { type: "heading", level: 2, id: "behaviour", text: "Behaviour and cost" },
    { type: "list", items: behaviour(t, page) },
    { type: "heading", level: 2, id: "parameters", text: "Parameters" },
    t.params.length
      ? { type: "param-table", params: params(t) }
      : { type: "paragraph", text: "None." },
    { type: "heading", level: 2, id: "example", text: "Example" },
    ...(page.examples?.length
      ? page.examples.map(
          (e): DocBlock => ({
            type: "code",
            language: e.language ?? "json",
            title: e.title,
            code: e.code,
          }),
        )
      : [generatedExample(t)]),
    { type: "heading", level: 2, id: "errors", text: "Errors" },
    {
      type: "paragraph",
      text: `A failed call comes back as a tool error with the HTTP status and a message that says what to change. ${link("common-issues", "Troubleshooting")} lists the common ones.`,
    },
  ]
  return {
    slug: t.name.replace(/_/g, "-"),
    parentSlug: "tools",
    title: t.name,
    seoTitle: page.seoTitle,
    description: page.description,
    content,
    related: page.related ?? [{ label: "Tools by task", slug: "tools-by-task" }],
    faq: page.faq ?? [],
    mentions: page.mentions ?? [],
  }
}

export const sections: RawSection[] = TOOL_REGISTRY.map((t) => {
  const page = TOOL_PAGES[t.name]
  if (!page) throw new Error(`src/content/tool-pages.ts has no entry for ${t.name}`)
  return toolSection(t, page)
})
