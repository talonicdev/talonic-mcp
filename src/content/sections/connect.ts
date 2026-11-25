// ---------------------------------------------------------------------------
// Connect: one page with a section per client. MCP_CLIENTS is exported so the
// website can render the sections as tabs; until it does, each client is an
// h3 under "Choose your client" (anchor = client id). The old per-client URLs
// (claude-desktop, cursor, cline, continue, cowork) render the same client
// data, so nothing is written twice and no URL breaks.
// ---------------------------------------------------------------------------

import type { DocBlock, RawSection } from "../types"
import { link, tool } from "../routes"

const HOSTED_URL = "https://mcp.talonic.com/mcp"

const LOCAL = `{
  "mcpServers": {
    "talonic": {
      "command": "npx",
      "args": ["-y", "@talonic/mcp@latest"],
      "env": { "TALONIC_API_KEY": "tlnc_your_key_here" }
    }
  }
}`

const HOSTED_KEY = `{
  "mcpServers": {
    "talonic": {
      "url": "${HOSTED_URL}",
      "headers": { "Authorization": "Bearer tlnc_your_key_here" }
    }
  }
}`

/** One client's connect instructions. */
export interface McpClient {
  /** Anchor on the connect page; also the old per-client page slug where one exists. */
  id: string
  label: string
  /** Has its own legacy page at this slug. */
  legacySlug?: string
  blocks: DocBlock[]
}

const connectorSteps = (where: string): DocBlock => ({
  type: "list",
  ordered: true,
  items: [
    `${where} and choose **Add custom connector**.`,
    `Enter the URL \`${HOSTED_URL}\`. No headers, no key.`,
    "Choose **Connect**, sign in to Talonic and approve access. If you belong to several workspaces, pick one.",
    "Start a new conversation. The Talonic tools are available.",
  ],
})

export const MCP_CLIENTS: McpClient[] = [
  {
    id: "claude",
    label: "Claude.ai and Claude Desktop",
    legacySlug: "claude-desktop",
    blocks: [
      {
        type: "paragraph",
        text: "Add Talonic once as a connector; it then works in Claude.ai and the Claude Desktop app.",
      },
      connectorSteps(
        "Open **Settings → Connectors** in [claude.ai](https://claude.ai/settings/connectors) or Claude Desktop",
      ),
      {
        type: "paragraph",
        text: "To run the server on your own machine instead (so the agent can read local files by path), add the local config to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\\Claude\\`) and quit and reopen Claude Desktop:",
      },
      { type: "code", language: "json", title: "Local (Claude Desktop)", code: LOCAL },
    ],
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    blocks: [
      {
        type: "list",
        ordered: true,
        items: [
          "In ChatGPT, open **Settings → Apps**.",
          "Find **Talonic** and choose **Connect**.",
          "Sign in to Talonic and approve access.",
          'In a new chat, ask for Talonic by name the first time ("Use Talonic to find my latest invoice").',
        ],
      },
      {
        type: "paragraph",
        text: `ChatGPT lists every tool except the two generic data-query tools; ask questions with ${tool("talonic_ask")} there. Results show as cards in the chat.`,
      },
    ],
  },
  {
    id: "claude-code",
    label: "Claude Code",
    blocks: [
      { type: "paragraph", text: "Hosted, signed in with your Talonic account:" },
      {
        type: "code",
        language: "bash",
        code: `claude mcp add --transport http talonic ${HOSTED_URL}\n# then run /mcp inside Claude Code and choose Authenticate`,
      },
      { type: "paragraph", text: "Local, with an API key:" },
      {
        type: "code",
        language: "bash",
        code: "claude mcp add talonic --env TALONIC_API_KEY=tlnc_your_key_here -- npx -y @talonic/mcp@latest",
      },
    ],
  },
  {
    id: "cursor",
    label: "Cursor",
    legacySlug: "cursor",
    blocks: [
      {
        type: "paragraph",
        text: "Open **Cursor Settings → MCP → Add new MCP server**, or edit `~/.cursor/mcp.json`. Use the local config to let the agent read files in your project by path:",
      },
      { type: "code", language: "json", title: "Local", code: LOCAL },
      { type: "code", language: "json", title: "Hosted, with an API key", code: HOSTED_KEY },
      {
        type: "paragraph",
        text: "Save and reload the window. The `talonic` entry turns green and lists its tools.",
      },
    ],
  },
  {
    id: "cline",
    label: "Cline",
    legacySlug: "cline",
    blocks: [
      {
        type: "paragraph",
        text: "In VS Code, open the Cline panel → **MCP Servers → Configure** and add one of these, then restart the panel:",
      },
      { type: "code", language: "json", title: "Local", code: LOCAL },
      { type: "code", language: "json", title: "Hosted, with an API key", code: HOSTED_KEY },
      {
        type: "paragraph",
        text: "Cline can auto-approve tools. Approving the read-only ones (search, look-ups, listings) lets it explore without asking; keep writes on manual approval.",
      },
    ],
  },
  {
    id: "continue",
    label: "Continue",
    legacySlug: "continue",
    blocks: [
      {
        type: "paragraph",
        text: "Edit `~/.continue/config.json` (shared by VS Code and JetBrains) and add an entry to `mcpServers`, then reload the IDE window:",
      },
      {
        type: "code",
        language: "json",
        title: "Local",
        code: `{
  "name": "talonic",
  "command": "npx",
  "args": ["-y", "@talonic/mcp@latest"],
  "env": { "TALONIC_API_KEY": "tlnc_your_key_here" }
}`,
      },
      {
        type: "code",
        language: "json",
        title: "Hosted, with an API key",
        code: `{
  "name": "talonic",
  "url": "${HOSTED_URL}",
  "headers": { "Authorization": "Bearer tlnc_your_key_here" }
}`,
      },
    ],
  },
  {
    id: "cowork",
    label: "Cowork",
    legacySlug: "cowork",
    blocks: [
      {
        type: "paragraph",
        text: "Open **Settings → MCP Servers → Add**, paste one of these and restart Cowork:",
      },
      { type: "code", language: "json", title: "Local", code: LOCAL },
      { type: "code", language: "json", title: "Hosted, with an API key", code: HOSTED_KEY },
      {
        type: "paragraph",
        text: "Cowork shows your saved schemas under resources (`talonic://schemas`), so you can pick one before extracting.",
      },
    ],
  },
]

const verify: DocBlock[] = [
  { type: "heading", level: 2, id: "check", text: "Check it works" },
  {
    type: "paragraph",
    text: `Ask your agent: "List my Talonic schemas." It calls ${tool("talonic_list_schemas")}, which is free and changes nothing. A list (or an empty list in a new workspace) means you are connected. An authentication error means the key or sign-in is wrong; see ${link("common-issues", "Troubleshooting")}.`,
  },
]

const choosing: DocBlock[] = [
  { type: "heading", level: 2, id: "hosted-or-local", text: "Hosted or local" },
  {
    type: "list",
    items: [
      `**Hosted** (\`${HOSTED_URL}\`): nothing to install, always the latest version, and you sign in with your Talonic account (OAuth). Files reach Talonic by URL, by document id or through an ${link("files-and-uploads", "upload link")}.`,
      `**Local** (\`npx -y @talonic/mcp@latest\`, Node.js 18 or later): needs an ${link("get-api-key", "API key")}. The agent can pass files on your machine by path. Pin an exact version (for example \`@talonic/mcp@0.1.100\`) for repeatable setups.`,
    ],
  },
  {
    type: "paragraph",
    text: "Both list the same tools and work on the same workspace. Signing in grants `extract:write`, `documents:read`, `schemas:read` and `apps:decide`; you can revoke access by removing the connector or the key.",
  },
]

/** Search-result copy for the old per-client pages. */
const LEGACY_META: Record<string, { seoTitle: string; description: string }> = {
  "claude-desktop": {
    seoTitle: "Connect Claude.ai and Claude Desktop to Talonic MCP",
    description:
      "Add Talonic to Claude.ai and Claude Desktop as a connector with your Talonic sign-in, or run it locally with npx and an API key, then check that it works.",
  },
  cursor: {
    seoTitle: "Connect Cursor to the Talonic MCP Server — Talonic Docs",
    description:
      "Add Talonic to Cursor in mcp.json: run it locally with npx and an API key so the agent can read project files, or use the hosted server, then check it works.",
  },
  cline: {
    seoTitle: "Connect Cline in VS Code to the Talonic MCP Server — Talonic",
    description:
      "Add Talonic to Cline in VS Code: run it locally with npx and an API key or use the hosted server, auto-approve the read-only tools, then check it works.",
  },
  continue: {
    seoTitle: "Connect Continue to the Talonic MCP Server — Talonic Docs",
    description:
      "Add Talonic to Continue in VS Code or JetBrains through config.json: run it locally with npx and an API key or use the hosted server, then check it works.",
  },
  cowork: {
    seoTitle: "Connect Cowork to the Talonic MCP Server — Talonic Docs",
    description:
      "Add Talonic to Cowork under Settings, MCP Servers: run it locally with npx and an API key or use the hosted server, browse saved schemas, then check it works.",
  },
}

export const sections: RawSection[] = [
  {
    slug: "install-overview",
    parentSlug: "install",
    title: "Connect your agent",
    seoTitle: "Connect Claude, ChatGPT or Cursor to Talonic MCP — Talonic",
    description:
      "Connect Talonic to Claude.ai, Claude Desktop, Claude Code, ChatGPT, Cursor, Cline, Continue or Cowork: hosted with sign-in, or local with npx and an API key.",
    content: [
      {
        type: "paragraph",
        text: "Connect Talonic to your AI client and your agent can work with your workspace. Pick your client below; most take under two minutes.",
      },
      ...choosing,
      { type: "heading", level: 2, id: "clients", text: "Choose your client" },
      ...MCP_CLIENTS.flatMap((c): DocBlock[] => [
        { type: "heading", level: 3, id: c.id, text: c.label },
        ...c.blocks,
      ]),
      {
        type: "heading",
        level: 3,
        id: "other-clients",
        text: "Any other MCP client",
      },
      {
        type: "paragraph",
        text: `Point a client that supports remote servers at \`${HOSTED_URL}\` (it will start a Talonic sign-in, or send \`Authorization: Bearer tlnc_…\`), or have it start \`npx -y @talonic/mcp@latest\` with \`TALONIC_API_KEY\` set. ${link("env-variables", "Configuration")} lists every setting.`,
      },
      ...verify,
    ],
    related: [
      { label: "Get an API key", slug: "get-api-key" },
      { label: "Configuration", slug: "env-variables" },
      { label: "Tools by task", slug: "tools-by-task" },
      { label: "Troubleshooting", slug: "common-issues" },
    ],
    faq: [
      {
        question: "Should I use the hosted server or the local one?",
        answer:
          "Use hosted for Claude.ai, ChatGPT and Claude Code: you sign in and there is nothing to install. Use local in desktop and IDE clients when you want the agent to pass files from your machine by path.",
      },
      {
        question: "Do the hosted and local servers offer the same tools?",
        answer:
          "Yes. The only difference is that a local install can read files on your machine by path; hosted sessions use a URL, a document id or an upload link.",
      },
      {
        question: "How do I disconnect?",
        answer:
          "Remove the connector in your client, or revoke the API key under Settings → API Keys in the Talonic web app.",
      },
    ],
    mentions: [
      "Claude.ai",
      "Claude Desktop",
      "Claude Code",
      "ChatGPT",
      "Cursor",
      "Cline",
      "Continue",
      "Cowork",
      "MCP install",
    ],
  },
  ...MCP_CLIENTS.filter((c) => c.legacySlug).map(
    (c): RawSection => ({
      slug: c.legacySlug!,
      parentSlug: "install",
      title: `Connect ${c.label}`,
      seoTitle: LEGACY_META[c.legacySlug!]!.seoTitle,
      description: LEGACY_META[c.legacySlug!]!.description,
      content: [
        {
          type: "paragraph",
          text: `Connect ${c.label} to Talonic. All clients are on one page now: ${link("install-overview", "Connect your agent")}.`,
        },
        ...c.blocks,
        ...verify,
      ],
      related: [
        { label: "Connect your agent", slug: "install-overview" },
        { label: "Troubleshooting", slug: "common-issues" },
      ],
      faq: [],
      mentions: [c.label, "MCP"],
    }),
  ),
]
