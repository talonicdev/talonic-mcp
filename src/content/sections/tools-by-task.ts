// ---------------------------------------------------------------------------
// Tools by task: every documented tool, grouped by what the user wants done.
// The lists are built from the generated registry and each tool's `task` in
// src/content/tool-pages.ts, so a new tool can't be left off this page.
// ---------------------------------------------------------------------------

import type { DocBlock, RawSection } from "../types"
import type { ToolTask } from "../tool-reference-types"
import { TOOL_REGISTRY } from "../generated/tool-registry"
import { TOOL_PAGES } from "../tool-pages"
import { link, tool } from "../routes"
import { parseDescription } from "./tool-reference"

/** The tasks, in page order. */
export const TASKS: { task: ToolTask; id: string; title: string; intro: string }[] = [
  {
    task: "find",
    id: "find",
    title: "Find documents and data",
    intro: `Start here when the user names a document, a value or a concept. ${tool("talonic_search")} turns a file name or keyword into a \`document_id\`; ${tool("talonic_filter")} finds documents by an extracted value; ${tool("talonic_find_data")} finds which field holds a concept.`,
  },
  {
    task: "extract",
    id: "extract",
    title: "Read and extract",
    intro: `Get fields as JSON with ${tool("talonic_extract")}, or the full text with ${tool("talonic_to_markdown")}. Save field sets you reuse; hand the user an upload link when a file can't be passed directly (${link("files-and-uploads", "Files and uploads")}).`,
  },
  {
    task: "ask",
    id: "ask",
    title: "Ask questions",
    intro: `For any question about what the documents say (totals, duplicates, comparisons, a clause), call ${tool("talonic_ask")} first: one call returns a cited, checked answer.`,
  },
  {
    task: "sources",
    id: "sources",
    title: "Connect sources and bring documents in",
    intro:
      "Connect a drive, mailbox or other system with a sign-in link the user opens, browse it, import from it and set how often it syncs. Then follow what is being read, and tune how new files are taken in.",
  },
  {
    task: "organise",
    id: "organise",
    title: "Organise documents",
    intro:
      "Tag, move, rename and delete documents, group them into collections, keep saved filters, and confirm or correct the document type Talonic suggests.",
  },
  {
    task: "run",
    id: "run",
    title: "Run a Spec",
    intro:
      "A Spec is a saved set of fields and checks your team set up in Talonic. Run it over documents to get one clean row per document.",
  },
  {
    task: "specs",
    id: "specs",
    title: "Author a Spec",
    intro:
      "Create a Spec from a document, an export or a schema, edit it under its revision, check and test it on real documents, then publish it or roll back to an earlier version.",
  },
  {
    task: "review",
    id: "review",
    title: "Review and decide",
    intro: `Work that waits for a person or an outside agent: sign-offs and forms waiting for the user, checks a Spec hands to your agent, and decisions an app hands out. ${link("run-talonic-tasks", "Run Talonic tasks from your own agent")} explains the claim, work, submit loop.`,
  },
  {
    task: "data",
    id: "data",
    title: "Data products, policies and the catalog",
    intro:
      "Keep shared data products and data policies current, browse the workspace data catalog and its rows, and decide suggested questions, mappings and links.",
  },
  {
    task: "build",
    id: "build",
    title: "Build a process",
    intro: `Describe a process in plain words, check it, test it on real documents in a test copy, then publish it. Nothing runs for real until ${tool("talonic_process_publish")}. Process tools are listed when your role can see processes.`,
  },
  {
    task: "automate",
    id: "automate",
    title: "Run and watch processes",
    intro:
      "Start a published process for one item, see where its runs stand, follow one item through every step, and retry failed steps once the cause is fixed.",
  },
  {
    task: "thread",
    id: "thread",
    title: "Your thread, the agent and My Data",
    intro:
      "Read and write in your Talonic thread, decide approvals, drafts and sheets waiting in it, confirm an agent turn, and see and share the data Talonic holds about you.",
  },
  {
    task: "apps",
    id: "apps",
    title: "Apps",
    intro:
      "See which Talonic apps the workspace has, and work in the enabled ones: Receivables, Spend Audit, Payables Desk, Workbook capture, Compliance, Money Found, Contract Check, chart reading and business objects. Other apps (for example Contracts, Accounts Payable, Document Generation or Price Baseline) add their own tools to sessions that can use them; each app's page under [Apps](https://talonic.com/docs/apps) lists them.",
  },
  {
    task: "workspace",
    id: "workspace",
    title: "Companies, credits and usage",
    intro:
      "Keep each company's documents apart with accounts, and check balance, pricing and what credits went on.",
  },
  {
    task: "admin",
    id: "admin",
    title: "Team and records administration",
    intro:
      "Approve, invite and change access for team members (a change is proposed, then confirmed), and keep retention policies, legal holds, the audit log and erasure requests in order.",
  },
]

/** First sentence of a tool's description. */
function oneLine(description: string): string {
  const lead = parseDescription(description).lead.join(" ")
  const m = /^(.+?(?<!\be\.g|\bi\.e)[.!?])(?=\s+[A-Z`]|$)/.exec(lead)
  return (m ? m[1]! : lead).trim()
}

function taskBlocks(): DocBlock[] {
  return TASKS.flatMap(({ task, id, title, intro }): DocBlock[] => {
    const tools = TOOL_REGISTRY.filter((t) => TOOL_PAGES[t.name]?.task === task)
    return [
      { type: "heading", level: 2, id, text: title },
      { type: "paragraph", text: intro },
      {
        type: "list",
        items: tools.map((t) => `${tool(t.name)}: ${oneLine(t.description)}`),
      },
    ]
  })
}

export const sections: RawSection[] = [
  {
    slug: "tools-by-task",
    parentSlug: "tools",
    title: "Tools by task",
    seoTitle: "Talonic MCP Tools by Task: Find, Extract, Ask, Run — Talonic",
    description:
      "Every Talonic MCP tool grouped by the job: find documents, extract fields, ask cited questions, run Specs, review, build and run processes, check credits.",
    content: [
      {
        type: "paragraph",
        text: "Pick the job, then the tool. Your agent reads the same descriptions and usually chooses well on its own; this page is for you to see what is possible and to steer it.",
      },
      {
        type: "callout",
        variant: "info",
        text: `Rule of thumb: a question about what documents say goes to ${tool("talonic_ask")}; a named file goes through ${tool("talonic_search")} first; fields from one document come from ${tool("talonic_extract")}.`,
      },
      ...taskBlocks(),
    ],
    related: [
      { label: "What an agent can do", slug: "mcp-introduction" },
      { label: "Files and uploads", slug: "files-and-uploads" },
      { label: "Recipe: answer a contract question", slug: "recipe-contract-question" },
    ],
    faq: [
      {
        question: "Why does my agent not list some of these tools?",
        answer:
          "Process tools appear only when your role can see processes; Spec authoring, sources, workspace operations, review, data, administration and thread tools only when your role can use that part of the workspace; app tools only when the app is enabled for you; and ChatGPT omits the two generic data-query tools. Each tool's page says when it is listed. Everything else is listed in every session.",
      },
    ],
    mentions: ["MCP tools", "document extraction", "AI agent tools"],
  },
]
