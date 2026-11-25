import type { RawSection } from "../types"
import { link, tool } from "../routes"
import { TOOL_REGISTRY } from "../generated/tool-registry"

const CORE = TOOL_REGISTRY.filter((t) => t.group !== "processes").length
const PROCESS = TOOL_REGISTRY.filter((t) => t.group === "processes").length

export const sections: RawSection[] = [
  {
    slug: "mcp-introduction",
    parentSlug: "overview",
    title: "What an agent can do with Talonic",
    seoTitle: "Talonic MCP Server: What Your AI Agent Can Do — Talonic",
    description:
      "Connect Claude.ai, ChatGPT, Cursor or any MCP client to Talonic. Your agent finds documents, extracts fields, answers cited questions and runs processes.",
    content: [
      {
        type: "paragraph",
        text: "The Talonic MCP server lets an AI agent work with the documents and data in your Talonic workspace the way you would in the web app: find a document, pull fields out of it, ask a question across everything, run a Spec, sign off a step, or set up a process. It is for anyone who wants their agent (in Claude.ai, Claude Desktop, ChatGPT, Cursor, Cline, Continue, Cowork or their own) to do document work for them.",
      },
      {
        type: "callout",
        variant: "info",
        text: `New here? ${link("install-overview", "Connect your agent")} in two minutes, then try the ${link("recipe-contract-question", "contract question recipe")}.`,
      },
      { type: "heading", level: 2, id: "what-you-can-do", text: "What your agent can do" },
      {
        type: "list",
        items: [
          `**Find.** Locate documents by name or keyword, filter them by extracted values ("invoices over 10,000 EUR"), and find which field holds a concept. ${link("tools-by-task", "Find tools")}.`,
          "**Read and extract.** Turn any PDF, scan, image, DOCX or email into JSON that matches the fields you ask for, with a confidence score per field and the page and passage each value came from. Or get the full text.",
          "**Ask.** Ask a question in plain words and get an answer with citations to the documents it rests on, checked before it is returned.",
          "**Run.** Run one of your workspace's Specs over a set of documents and read back one clean row per document.",
          "**Review and decide.** Sign off or send back items waiting for you, and take on checks or decisions your workspace hands to an outside agent.",
          "**Build and automate.** Describe a process in your own words (what comes in, what is checked, who signs, what goes out), test it on real documents, publish it, and watch its runs.",
          "**Look after the workspace.** Keep each company's documents apart, check credits, pricing and usage.",
        ],
      },
      { type: "heading", level: 2, id: "how-it-works", text: "How it fits together" },
      {
        type: "paragraph",
        text: "Your agent calls Talonic tools; Talonic does the reading and checking and returns structured results. Every call runs as you: it sees only your workspace and can do only what your role allows, exactly like the web app. Writes that send mail, call other systems or can't be undone say so in their description, and the agent is told to call them only when you ask.",
      },
      {
        type: "list",
        items: [
          `**${CORE} tools** are listed in every session.`,
          `**${PROCESS} process tools** are listed when your role can see processes in the workspace.`,
          "Apps you have enabled (for example Contracts or Accounts Payable) add their own tools to sessions that can use them; see [Apps](https://talonic.com/docs/apps).",
        ],
      },
      { type: "heading", level: 2, id: "two-ways-to-connect", text: "Two ways to connect" },
      {
        type: "list",
        items: [
          "**Hosted** at `https://mcp.talonic.com/mcp`. Sign in with your Talonic account; no key to copy. Best for Claude.ai, ChatGPT and Claude Code.",
          "**Local** with `npx -y @talonic/mcp@latest` and an API key. Best for desktop and IDE clients that start the server on your machine and can read local files.",
        ],
      },
      { type: "heading", level: 2, id: "first-call", text: "Your first call" },
      {
        type: "paragraph",
        text: `Once connected, ask your agent: "What documents do I have in Talonic about invoices?" It calls ${tool("talonic_search")} and lists them. Then: "Extract the vendor, total and due date from the first one." It calls ${tool("talonic_extract")} and returns JSON with a confidence score for each field.`,
      },
      { type: "heading", level: 2, id: "next", text: "Next" },
      {
        type: "list",
        items: [
          link("install-overview", "Connect your client"),
          link("tools-by-task", "Tools by task"),
          link("files-and-uploads", "Files and uploads"),
          link("recipe-set-up-workspace", "Recipe: set up a workspace end to end"),
        ],
      },
    ],
    related: [
      { label: "Connect your agent", slug: "install-overview" },
      { label: "Tools by task", slug: "tools-by-task" },
      { label: "Get an API key", slug: "get-api-key" },
    ],
    faq: [
      {
        question: "Which AI clients work with the Talonic MCP server?",
        answer:
          "Any client that speaks the Model Context Protocol. Claude.ai, Claude Desktop, Claude Code, ChatGPT, Cursor, Cline, Continue and Cowork have step-by-step instructions on the Connect page.",
      },
      {
        question: "Can the agent see other people's documents?",
        answer:
          "No. Every call runs with your credential and your workspace role, so the agent sees and changes exactly what you could in the web app, and nothing else.",
      },
      {
        question: "Does using the MCP server cost extra?",
        answer:
          "No. Tool calls use the same credits as the web app and the API. Reading, listing and searching are free; extracting, asking and running Specs use credits. Each tool page says what it costs.",
      },
    ],
    mentions: ["MCP server", "AI agent", "document extraction", "Model Context Protocol"],
  },
  {
    slug: "why-mcp",
    parentSlug: "overview",
    title: "Why connect your agent to Talonic",
    seoTitle: "Why Connect Your AI Agent to Talonic Over MCP — Talonic",
    description:
      "Reading documents inside a chat gives you text. Connecting Talonic gives your agent checked fields, cited answers, your saved Specs and processes it can run.",
    content: [
      {
        type: "paragraph",
        text: "An agent can read a PDF you paste into a chat. What it can't do on its own is give you the same fields every time, show where each value came from, remember the thousand documents you processed last quarter, or start the approval your team runs on every invoice. Connecting Talonic adds those.",
      },
      {
        type: "list",
        items: [
          "**Same fields, every time.** You say which fields you want once (or save them); every document comes back in that shape, with a confidence score per field.",
          "**Evidence.** Each value links to the page and passage it came from, and answers cite the documents they rest on, so you can check before you act.",
          "**Your whole workspace.** Questions run across every document you have added, not only the one in the chat.",
          "**Your rules.** The agent runs the Specs and processes your team already set up, with the same permissions and sign-offs as the web app.",
          "**Large files.** Files too big for a chat go through an upload link instead.",
        ],
      },
      {
        type: "paragraph",
        text: `Start with ${link("install-overview", "Connect your agent")}, or see ${link("mcp-introduction", "what an agent can do")}.`,
      },
    ],
    related: [
      { label: "What an agent can do", slug: "mcp-introduction" },
      { label: "Connect your agent", slug: "install-overview" },
    ],
    faq: [],
    mentions: ["MCP", "document extraction", "AI agents"],
  },
  {
    slug: "get-api-key",
    parentSlug: "overview",
    title: "Get an API key",
    seoTitle: "Get a Talonic API Key for the MCP Server — Talonic Docs",
    description:
      "Create a Talonic API key for local MCP installs and header-based clients. Hosted connectors in Claude.ai, ChatGPT and Claude Code sign you in without a key.",
    content: [
      {
        type: "paragraph",
        text: "A local install (`npx @talonic/mcp`) and clients that send their own headers need an API key. Hosted connectors in Claude.ai, ChatGPT and Claude Code sign you in with your Talonic account instead, so you can skip this page for those.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Sign in at [app.talonic.com](https://app.talonic.com).",
          "Open **Settings → API Keys** and choose **Create key**.",
          "Copy the key. It starts with `tlnc_` and is shown once.",
          `Put it in your client's config as \`TALONIC_API_KEY\` (local) or an \`Authorization: Bearer\` header (hosted). ${link("install-overview", "Connect your agent")} has the snippets.`,
        ],
      },
      {
        type: "paragraph",
        text: "A key acts as the person who created it, in one workspace, and never with more rights than that person's role. Create a separate key per workspace and per machine so you can revoke one without breaking the others.",
      },
      {
        type: "callout",
        variant: "warning",
        text: "Keep keys out of source control and screenshots. If a key leaks, revoke it under **Settings → API Keys** and create a new one.",
      },
    ],
    related: [
      { label: "Connect your agent", slug: "install-overview" },
      { label: "Configuration", slug: "env-variables" },
    ],
    faq: [
      {
        question: "Do I need an API key to use Talonic in Claude.ai or ChatGPT?",
        answer:
          "No. Hosted connectors sign you in with your Talonic account and keep the access token for you. You only need a key for a local install or a client that sends its own headers.",
      },
    ],
    mentions: ["API key", "tlnc_", "authentication"],
  },
  {
    slug: "agent-decision-guide",
    parentSlug: "overview",
    title: "Which tool to use",
    seoTitle: "Which Talonic MCP Tool Should My Agent Use? — Talonic",
    description:
      "This guide moved to Tools by task: every Talonic MCP tool grouped by what you want done, from finding documents to running and building your processes.",
    content: [
      {
        type: "paragraph",
        text: `This page moved. ${link("tools-by-task", "Tools by task")} groups every tool by what you want done.`,
      },
    ],
    related: [{ label: "Tools by task", slug: "tools-by-task" }],
    faq: [],
    mentions: [],
  },
]
