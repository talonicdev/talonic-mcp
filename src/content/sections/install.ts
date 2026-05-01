import type { RawSection } from '../types';

const MCP_HOSTED_SNIPPET = `{
  "mcpServers": {
    "talonic": {
      "url": "https://mcp.talonic.com/mcp",
      "headers": {
        "Authorization": "Bearer tlnc_your_key_here"
      }
    }
  }
}`;

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
}`;

export const sections: RawSection[] = [
  {
    slug: 'install-overview',
    parentSlug: 'install',
    title: 'Install Overview',
    seoTitle: 'Install Talonic MCP — Talonic Docs',
    description: 'Install the Talonic MCP server with a one-line npx invocation. No clone, no build. Works with every MCP client.',
    content: [
      { type: 'paragraph', text: 'Two ways to connect. The hosted server at `mcp.talonic.com` requires zero install — paste one URL into any MCP client. Or run locally via `npx` if you prefer.' },
      { type: 'heading', level: 3, text: 'Hosted (recommended)' },
      { type: 'paragraph', text: 'No install, no Node.js required. Works with every MCP client that supports remote servers:' },
      { type: 'code', language: 'jsonc', title: 'Hosted config', code: `{
  "url": "https://mcp.talonic.com/mcp",
  "headers": { "Authorization": "Bearer tlnc_..." }
}` },
      { type: 'heading', level: 3, text: 'Local (npx)' },
      { type: 'paragraph', text: 'Runs on your machine. Requires Node.js 18+:' },
      { type: 'code', language: 'jsonc', title: 'Local config', code: `{
  "command": "npx",
  "args": ["-y", "@talonic/mcp@latest"],
  "env": { "TALONIC_API_KEY": "tlnc_..." }
}` },
      { type: 'paragraph', text: 'The `-y` flag skips the npm install prompt. Pinning to `@latest` means new versions are picked up on the next client restart.' },
    ],
    related: [
      { label: 'Claude Desktop', slug: 'claude-desktop' },
      { label: 'Cursor', slug: 'cursor' },
    ],
    faq: [
      { question: 'How do I install the Talonic MCP server?', answer: 'Use the hosted server at mcp.talonic.com/mcp — just set the URL and your API key in any MCP client config. No install needed. Alternatively, run locally via npx @talonic/mcp.' },
    ],
    mentions: ['npx', 'npm', 'MCP client', 'install'],
  },
  {
    slug: 'claude-desktop',
    parentSlug: 'install',
    title: 'Claude Desktop',
    seoTitle: 'Claude Desktop Setup — Talonic MCP',
    description: 'Configure the Talonic MCP server in Claude Desktop on macOS and Windows.',
    content: [
      { type: 'paragraph', text: 'Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\\Claude\\claude_desktop_config.json` (Windows).' },
      { type: 'heading', level: 3, text: 'Hosted (recommended)' },
      { type: 'code', language: 'json', code: MCP_HOSTED_SNIPPET },
      { type: 'heading', level: 3, text: 'Local (npx)' },
      { type: 'code', language: 'json', code: MCP_CONFIG_SNIPPET },
      { type: 'paragraph', text: 'Fully restart Claude Desktop (Cmd+Q on macOS, not just close the window). Talonic appears in the connected servers list with all seven tools.' },
    ],
    related: [
      { label: 'Cursor', slug: 'cursor' },
      { label: 'Tool Reference', slug: 'talonic-extract' },
    ],
    faq: [
      { question: 'How do I add Talonic to Claude Desktop?', answer: 'Edit claude_desktop_config.json, add the Talonic MCP server config with your API key, and fully restart Claude Desktop (Cmd+Q on macOS).' },
    ],
    mentions: ['Claude Desktop', 'macOS', 'Windows'],
  },
  {
    slug: 'cursor',
    parentSlug: 'install',
    title: 'Cursor',
    seoTitle: 'Cursor Setup — Talonic MCP',
    description: 'Configure the Talonic MCP server in Cursor IDE.',
    content: [
      { type: 'paragraph', text: 'Edit `~/.cursor/mcp.json` (or open Cursor settings → MCP → edit config):' },
      { type: 'heading', level: 3, text: 'Hosted (recommended)' },
      { type: 'code', language: 'json', code: MCP_HOSTED_SNIPPET },
      { type: 'heading', level: 3, text: 'Local (npx)' },
      { type: 'code', language: 'json', code: MCP_CONFIG_SNIPPET },
    ],
    related: [
      { label: 'Claude Desktop', slug: 'claude-desktop' },
      { label: 'Cline', slug: 'cline' },
    ],
    faq: [
      { question: 'How do I add Talonic MCP to Cursor?', answer: 'Edit ~/.cursor/mcp.json and add the Talonic MCP server config with your API key.' },
    ],
    mentions: ['Cursor', 'IDE'],
  },
  {
    slug: 'cline',
    parentSlug: 'install',
    title: 'Cline',
    seoTitle: 'Cline Setup — Talonic MCP',
    description: 'Configure the Talonic MCP server in the Cline VS Code extension.',
    content: [
      { type: 'paragraph', text: 'Open the Cline panel → settings (gear icon) → MCP Servers → Edit. Save and restart the panel.' },
      { type: 'heading', level: 3, text: 'Hosted (recommended)' },
      { type: 'code', language: 'json', code: MCP_HOSTED_SNIPPET },
      { type: 'heading', level: 3, text: 'Local (npx)' },
      { type: 'code', language: 'json', code: MCP_CONFIG_SNIPPET },
    ],
    related: [
      { label: 'Continue', slug: 'continue' },
      { label: 'Cursor', slug: 'cursor' },
    ],
    faq: [
      { question: 'How do I add Talonic MCP to Cline?', answer: 'Open the Cline panel settings, go to MCP Servers, click Edit, and add the Talonic config entry.' },
    ],
    mentions: ['Cline', 'VS Code'],
  },
  {
    slug: 'continue',
    parentSlug: 'install',
    title: 'Continue',
    seoTitle: 'Continue Setup — Talonic MCP',
    description: 'Configure the Talonic MCP server in Continue for VS Code and JetBrains.',
    content: [
      { type: 'paragraph', text: 'Edit `~/.continue/config.json`. Add to the `mcpServers` array:' },
      { type: 'heading', level: 3, text: 'Hosted (recommended)' },
      { type: 'code', language: 'json', code: `{
  "name": "talonic",
  "url": "https://mcp.talonic.com/mcp",
  "headers": {
    "Authorization": "Bearer tlnc_your_key_here"
  }
}` },
      { type: 'heading', level: 3, text: 'Local (npx)' },
      { type: 'code', language: 'json', code: `{
  "name": "talonic",
  "command": "npx",
  "args": ["-y", "@talonic/mcp@latest"],
  "env": {
    "TALONIC_API_KEY": "tlnc_your_key_here"
  }
}` },
    ],
    related: [
      { label: 'Cowork', slug: 'cowork' },
      { label: 'Cline', slug: 'cline' },
    ],
    faq: [
      { question: 'How do I add Talonic MCP to Continue?', answer: 'Edit ~/.continue/config.json and add a Talonic entry to the mcpServers array with your API key.' },
    ],
    mentions: ['Continue', 'VS Code', 'JetBrains'],
  },
  {
    slug: 'cowork',
    parentSlug: 'install',
    title: 'Cowork',
    seoTitle: 'Cowork Setup — Talonic MCP',
    description: 'Configure the Talonic MCP server in Cowork.',
    content: [
      { type: 'paragraph', text: 'Open Cowork settings → MCP Servers → Add.' },
      { type: 'heading', level: 3, text: 'Hosted (recommended)' },
      { type: 'code', language: 'json', code: MCP_HOSTED_SNIPPET },
      { type: 'heading', level: 3, text: 'Local (npx)' },
      { type: 'code', language: 'json', code: MCP_CONFIG_SNIPPET },
    ],
    related: [
      { label: 'Claude Desktop', slug: 'claude-desktop' },
      { label: 'Tool Reference', slug: 'talonic-extract' },
    ],
    faq: [
      { question: 'How do I add Talonic MCP to Cowork?', answer: 'Open Cowork settings, go to MCP Servers, click Add, and paste the standard Talonic config with your API key.' },
    ],
    mentions: ['Cowork'],
  },
];
