import type { RawSection } from "../types"
import { link } from "../routes"

export const sections: RawSection[] = [
  {
    slug: "env-variables",
    parentSlug: "install",
    title: "Configuration",
    seoTitle: "Talonic MCP Configuration: Environment Variables — Talonic",
    description:
      "Configure the local Talonic MCP server: TALONIC_API_KEY is required, TALONIC_BASE_URL is optional. Hosted connections need no settings beyond sign-in.",
    content: [
      {
        type: "paragraph",
        text: "Settings for the local server (`npx @talonic/mcp`). Hosted connections need none: you sign in, or send `Authorization: Bearer tlnc_…`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "TALONIC_API_KEY",
            type: "string",
            required: true,
            description: `Your API key, starting with \`tlnc_\`. ${link("get-api-key", "Get one")}.`,
          },
          {
            name: "TALONIC_BASE_URL",
            type: "string",
            description:
              "Only for a dedicated Talonic deployment your account team gave you a URL for.",
            default: "https://api.talonic.com",
          },
          {
            name: "HTTPS_PROXY",
            type: "string",
            description: "Standard proxy setting, if your network requires one.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "In your client config",
        code: `{
  "mcpServers": {
    "talonic": {
      "command": "npx",
      "args": ["-y", "@talonic/mcp@latest"],
      "env": { "TALONIC_API_KEY": "tlnc_your_key_here" }
    }
  }
}`,
      },
      {
        type: "paragraph",
        text: `If the key is missing, the server stops at start-up with \`TALONIC_API_KEY environment variable is required.\` See ${link("common-issues", "Troubleshooting")}.`,
      },
    ],
    related: [
      { label: "Connect your agent", slug: "install-overview" },
      { label: "Get an API key", slug: "get-api-key" },
      { label: "Troubleshooting", slug: "common-issues" },
    ],
    faq: [],
    mentions: ["TALONIC_API_KEY", "environment variables", "MCP configuration"],
  },
]
