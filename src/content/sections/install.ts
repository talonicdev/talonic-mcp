import type { RawSection } from "../types"

const MCP_HOSTED_SNIPPET = `{
  "mcpServers": {
    "talonic": {
      "url": "https://mcp.talonic.com/mcp",
      "headers": {
        "Authorization": "Bearer tlnc_your_key_here"
      }
    }
  }
}`

const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "talonic": {
      "command": "npx",
      "args": ["-y", "@talonic/mcp@latest"],
      "env": {
        "TALONIC_API_KEY": "tlnc_your_key_here"
      }
    }
  }
}`

export const sections: RawSection[] = [
  {
    slug: "install-overview",
    parentSlug: "install",
    title: "Install Overview",
    seoTitle: "Install Talonic MCP — Talonic Docs",
    description:
      "Install the Talonic MCP server with a one-line npx invocation. No clone, no build. Works with every MCP client.",
    content: [
      {
        type: "paragraph",
        text: "Two ways to connect. The hosted server at `mcp.talonic.com` requires zero install — paste one URL into any MCP client. Or run locally via `npx` if you prefer.",
      },
      { type: "heading", level: 3, id: "hosted-recommended", text: "Hosted (recommended)" },
      {
        type: "paragraph",
        text: "No install, no Node.js required. Works with every MCP client that supports remote servers:",
      },
      {
        type: "code",
        language: "jsonc",
        title: "Hosted config",
        code: `{
  "url": "https://mcp.talonic.com/mcp",
  "headers": { "Authorization": "Bearer tlnc_..." }
}`,
      },
      {
        type: "paragraph",
        text: "The hosted server is maintained by Talonic and always runs the latest version. It communicates over HTTPS with streamable HTTP transport, so there is no local process to manage. Latency is comparable to the local option because the MCP server still makes the same HTTPS call to `api.talonic.com` either way.",
      },
      { type: "heading", level: 3, id: "local-npx", text: "Local (npx)" },
      { type: "paragraph", text: "Runs on your machine. Requires Node.js 18+:" },
      {
        type: "code",
        language: "jsonc",
        title: "Local config",
        code: `{
  "command": "npx",
  "args": ["-y", "@talonic/mcp@latest"],
  "env": { "TALONIC_API_KEY": "tlnc_..." }
}`,
      },
      {
        type: "paragraph",
        text: "The `-y` flag skips the npm install prompt. Pinning to `@latest` means new versions are picked up on the next client restart.",
      },
      {
        type: "paragraph",
        text: "Both options expose the same seven tools and one resource. The hosted option is recommended for most users because it eliminates Node.js as a dependency, simplifies debugging (no local process to inspect), and receives updates without any action on your part.",
      },
      {
        type: "callout",
        variant: "info",
        text: "If you are behind a corporate proxy or firewall that blocks outbound HTTPS to `mcp.talonic.com`, use the local `npx` option and configure your proxy via standard `HTTPS_PROXY` environment variables.",
      },
    ],
    related: [
      { label: "Claude Desktop", slug: "claude-desktop" },
      { label: "Cursor", slug: "cursor" },
    ],
    faq: [
      {
        question: "How do I install the Talonic MCP server?",
        answer:
          "Use the hosted server at mcp.talonic.com/mcp — just set the URL and your API key in any MCP client config. No install needed. Alternatively, run locally via npx @talonic/mcp.",
      },
      {
        question: "What is the difference between hosted and local MCP server?",
        answer:
          "Both expose the same tools and resource. Hosted requires zero local dependencies and auto-updates. Local runs on your machine via npx and requires Node.js 18+. Latency is comparable since both call the same API.",
      },
      {
        question: "Do I need to update the MCP server manually?",
        answer:
          "With the hosted server, updates are automatic. With the local npx option, pinning to @latest means new versions are fetched on the next client restart.",
      },
    ],
    mentions: ["npx", "npm", "MCP client", "install"],
  },
  {
    slug: "claude-desktop",
    parentSlug: "install",
    title: "Claude Desktop",
    seoTitle: "Claude Desktop Setup — Talonic MCP",
    description: "Configure the Talonic MCP server in Claude Desktop on macOS and Windows.",
    content: [
      {
        type: "paragraph",
        text: "Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\\Claude\\claude_desktop_config.json` (Windows).",
      },
      { type: "heading", level: 3, id: "claude-desktop-hosted", text: "Hosted (recommended)" },
      { type: "code", language: "json", code: MCP_HOSTED_SNIPPET },
      { type: "heading", level: 3, id: "claude-desktop-local", text: "Local (npx)" },
      { type: "code", language: "json", code: MCP_CONFIG_SNIPPET },
      {
        type: "paragraph",
        text: "Fully restart Claude Desktop (Cmd+Q on macOS, not just close the window). Talonic appears in the connected servers list with all eight tools.",
      },
      {
        type: "paragraph",
        text: "Claude Desktop is the most popular MCP client for Talonic. It natively supports drag-and-drop file uploads, which pairs well with `talonic_extract` via the `file_data` parameter. When you drop a PDF into the chat, Claude automatically base64-encodes it and passes it to the MCP tool.",
      },
      {
        type: "paragraph",
        text: "After connecting, you can verify the setup by asking Claude to list your schemas (`talonic_list_schemas`) or extract data from a sample document. If the tools do not appear, check that your JSON is valid and the config file is in the correct directory for your operating system.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Claude Desktop also renders the `talonic://schemas` resource in its UI, letting you browse saved schemas without making a tool call.",
      },
    ],
    related: [
      { label: "Cursor", slug: "cursor" },
      { label: "Tool Reference", slug: "talonic-extract" },
    ],
    faq: [
      {
        question: "How do I add Talonic to Claude Desktop?",
        answer:
          "Edit claude_desktop_config.json, add the Talonic MCP server config with your API key, and fully restart Claude Desktop (Cmd+Q on macOS).",
      },
      {
        question: "Why don't Talonic tools appear after adding the config?",
        answer:
          "Make sure you fully restart Claude Desktop (Cmd+Q, not just close the window). Also verify your JSON syntax is valid and the config file is in the correct directory for your OS.",
      },
      {
        question: "Does Claude Desktop support drag-and-drop with Talonic?",
        answer:
          "Yes. Claude Desktop natively supports drag-and-drop file uploads. When you drop a PDF, Claude base64-encodes it and passes it to talonic_extract via the file_data parameter.",
      },
    ],
    mentions: ["Claude Desktop", "macOS", "Windows"],
  },
  {
    slug: "cursor",
    parentSlug: "install",
    title: "Cursor",
    seoTitle: "Cursor Setup — Talonic MCP",
    description: "Configure the Talonic MCP server in Cursor IDE.",
    content: [
      {
        type: "paragraph",
        text: "Edit `~/.cursor/mcp.json` (or open Cursor settings → MCP → edit config):",
      },
      { type: "heading", level: 3, id: "cursor-hosted", text: "Hosted (recommended)" },
      { type: "code", language: "json", code: MCP_HOSTED_SNIPPET },
      { type: "heading", level: 3, id: "cursor-local", text: "Local (npx)" },
      { type: "code", language: "json", code: MCP_CONFIG_SNIPPET },
      {
        type: "paragraph",
        text: "After saving the config, restart Cursor or reload the window. The Talonic tools appear in the MCP tool list and can be invoked from Cursor's AI chat panel. Cursor's agent mode is particularly effective with Talonic because it can read local files from your project and pass them directly to `talonic_extract` via `file_path`.",
      },
      {
        type: "paragraph",
        text: "A common Cursor workflow is extracting data from documents within a codebase — for example, parsing specification PDFs, extracting configuration from scanned documents, or converting legacy documentation to structured data. The `file_path` input works directly with paths relative to your Cursor workspace.",
      },
      {
        type: "paragraph",
        text: "Cursor caches MCP tool descriptions between sessions. If you upgrade the MCP server and notice outdated tool descriptions, restart Cursor to force a refresh of the tool metadata.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Cursor supports both the hosted and local MCP options. The hosted option is simpler since Cursor can connect directly via HTTPS without spawning a local process.",
      },
    ],
    related: [
      { label: "Claude Desktop", slug: "claude-desktop" },
      { label: "Cline", slug: "cline" },
    ],
    faq: [
      {
        question: "How do I add Talonic MCP to Cursor?",
        answer: "Edit ~/.cursor/mcp.json and add the Talonic MCP server config with your API key.",
      },
      {
        question: "Can Cursor read local files for extraction?",
        answer:
          "Yes. Cursor's agent mode can read files from your project and pass them to talonic_extract via the file_path parameter, making it easy to extract data from documents within your codebase.",
      },
      {
        question: "Why are Talonic tool descriptions outdated in Cursor?",
        answer:
          "Cursor caches MCP tool descriptions between sessions. Restart Cursor to force a refresh after upgrading the MCP server.",
      },
    ],
    mentions: ["Cursor", "IDE"],
  },
  {
    slug: "cline",
    parentSlug: "install",
    title: "Cline",
    seoTitle: "Cline Setup — Talonic MCP",
    description: "Configure the Talonic MCP server in the Cline VS Code extension.",
    content: [
      {
        type: "paragraph",
        text: "Open the Cline panel → settings (gear icon) → MCP Servers → Edit. Save and restart the panel.",
      },
      { type: "heading", level: 3, id: "cline-hosted", text: "Hosted (recommended)" },
      { type: "code", language: "json", code: MCP_HOSTED_SNIPPET },
      { type: "heading", level: 3, id: "cline-local", text: "Local (npx)" },
      { type: "code", language: "json", code: MCP_CONFIG_SNIPPET },
      {
        type: "paragraph",
        text: "Cline runs inside VS Code and communicates with MCP servers over stdio (local) or HTTP (hosted). After adding the config, the Talonic tools become available in Cline's autonomous agent mode, where it can chain multiple tool calls without manual approval for each step.",
      },
      {
        type: "paragraph",
        text: "Cline's auto-approval feature works well with Talonic workflows. For example, the agent can search for documents, filter results, and extract data from the top match in a single turn. Configure Cline's auto-approve settings to control which Talonic tools run without confirmation.",
      },
      {
        type: "paragraph",
        text: "Because Cline operates within VS Code, it has access to your workspace file system. The `file_path` parameter on `talonic_extract` and `talonic_to_markdown` can reference any file in your open workspace, making it straightforward to process documents alongside code.",
      },
      {
        type: "callout",
        variant: "info",
        text: "If Cline shows the MCP server as disconnected after a VS Code update, re-open the Cline panel settings and verify the config is still present. Some VS Code updates can reset extension state.",
      },
    ],
    related: [
      { label: "Continue", slug: "continue" },
      { label: "Cursor", slug: "cursor" },
    ],
    faq: [
      {
        question: "How do I add Talonic MCP to Cline?",
        answer:
          "Open the Cline panel settings, go to MCP Servers, click Edit, and add the Talonic config entry.",
      },
      {
        question: "Does Cline support auto-approval for Talonic tools?",
        answer:
          "Yes. Configure Cline's auto-approve settings to allow specific Talonic tools to run without manual confirmation, enabling multi-step workflows in a single turn.",
      },
      {
        question: "Can Cline access local files for Talonic extraction?",
        answer:
          "Yes. Cline runs inside VS Code and has access to your workspace file system, so you can use file_path to reference any file in the open workspace.",
      },
    ],
    mentions: ["Cline", "VS Code"],
  },
  {
    slug: "continue",
    parentSlug: "install",
    title: "Continue",
    seoTitle: "Continue Setup — Talonic MCP",
    description: "Configure the Talonic MCP server in Continue for VS Code and JetBrains.",
    content: [
      { type: "paragraph", text: "Edit `~/.continue/config.json`. Add to the `mcpServers` array:" },
      { type: "heading", level: 3, id: "continue-hosted", text: "Hosted (recommended)" },
      {
        type: "code",
        language: "json",
        code: `{
  "name": "talonic",
  "url": "https://mcp.talonic.com/mcp",
  "headers": {
    "Authorization": "Bearer tlnc_your_key_here"
  }
}`,
      },
      { type: "heading", level: 3, id: "continue-local", text: "Local (npx)" },
      {
        type: "code",
        language: "json",
        code: `{
  "name": "talonic",
  "command": "npx",
  "args": ["-y", "@talonic/mcp@latest"],
  "env": {
    "TALONIC_API_KEY": "tlnc_your_key_here"
  }
}`,
      },
      {
        type: "paragraph",
        text: "Continue works across both VS Code and JetBrains IDEs, making Talonic tools available regardless of your editor choice. The `mcpServers` array in Continue's config supports multiple MCP servers, so Talonic runs alongside any other MCP tools you have configured.",
      },
      {
        type: "paragraph",
        text: "After saving the config, reload your IDE window to pick up the changes. Continue discovers Talonic's seven tools and one resource automatically. You can verify the connection by asking the agent to call `talonic_list_schemas` — it should return your saved schemas or an empty list.",
      },
      {
        type: "paragraph",
        text: "Continue's config format uses a `name` field instead of a key in the `mcpServers` object. Make sure to include `\"name\": \"talonic\"` in the entry. The rest of the config — `command`, `args`, `env` for local, or `url` and `headers` for hosted — follows the same pattern as other MCP clients.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Continue's MCP support works identically in VS Code and JetBrains. The same `~/.continue/config.json` file is shared across both editors.",
      },
    ],
    related: [
      { label: "Cowork", slug: "cowork" },
      { label: "Cline", slug: "cline" },
    ],
    faq: [
      {
        question: "How do I add Talonic MCP to Continue?",
        answer:
          "Edit ~/.continue/config.json and add a Talonic entry to the mcpServers array with your API key.",
      },
      {
        question: "Does Continue work with Talonic in JetBrains?",
        answer:
          "Yes. Continue shares the same config file (~/.continue/config.json) across VS Code and JetBrains, so Talonic works identically in both editors.",
      },
      {
        question: "Why does Continue use a different config format?",
        answer:
          "Continue uses an mcpServers array with a name field instead of an object keyed by server name. Include \"name\": \"talonic\" in the entry alongside the standard command/args/env or url/headers fields.",
      },
    ],
    mentions: ["Continue", "VS Code", "JetBrains"],
  },
  {
    slug: "cowork",
    parentSlug: "install",
    title: "Cowork",
    seoTitle: "Cowork Setup — Talonic MCP",
    description: "Configure the Talonic MCP server in Cowork.",
    content: [
      { type: "paragraph", text: "Open Cowork settings → MCP Servers → Add." },
      { type: "heading", level: 3, id: "cowork-hosted", text: "Hosted (recommended)" },
      { type: "code", language: "json", code: MCP_HOSTED_SNIPPET },
      { type: "heading", level: 3, id: "cowork-local", text: "Local (npx)" },
      { type: "code", language: "json", code: MCP_CONFIG_SNIPPET },
      {
        type: "paragraph",
        text: "Cowork is a chat-style MCP client that supports drag-and-drop file uploads and resource browsing. After adding the Talonic config, the seven tools appear in the tool picker and the `talonic://schemas` resource is browseable in the resources panel.",
      },
      {
        type: "paragraph",
        text: "Like Claude Desktop, Cowork renders MCP resources in its UI. This means your saved schemas are visible without making a tool call, which helps when you want to browse available schemas before starting an extraction workflow.",
      },
      {
        type: "paragraph",
        text: "After adding the config, restart Cowork to load the new MCP server. If you are using the hosted option, Cowork connects directly via HTTPS — no local process is spawned. For the local option, Cowork launches the `npx` command as a child process and communicates over stdio.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Cowork's resource panel lets you browse `talonic://schemas` visually, making it easy to discover existing schemas before designing new ones.",
      },
    ],
    related: [
      { label: "Claude Desktop", slug: "claude-desktop" },
      { label: "Tool Reference", slug: "talonic-extract" },
    ],
    faq: [
      {
        question: "How do I add Talonic MCP to Cowork?",
        answer:
          "Open Cowork settings, go to MCP Servers, click Add, and paste the standard Talonic config with your API key.",
      },
      {
        question: "Does Cowork support the talonic://schemas resource?",
        answer:
          "Yes. Cowork renders MCP resources in its UI, so you can browse your saved schemas visually in the resources panel without making a tool call.",
      },
      {
        question: "Does Cowork support drag-and-drop with Talonic?",
        answer:
          "Yes. Cowork supports drag-and-drop file uploads, which pairs with talonic_extract's file_data parameter for easy document extraction.",
      },
    ],
    mentions: ["Cowork"],
  },
]
