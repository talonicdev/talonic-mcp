import type { RawSection } from "../types"

export const sections: RawSection[] = [
  {
    slug: "env-variables",
    parentSlug: "configuration",
    title: "Environment Variables",
    seoTitle: "Configuration — Talonic MCP",
    description:
      "Environment variables for configuring the Talonic MCP server: API key and optional base URL override.",
    content: [
      { type: "paragraph", text: "Set via the `env` block in your MCP client config:" },
      {
        type: "param-table",
        params: [
          {
            name: "TALONIC_API_KEY",
            type: "string",
            required: true,
            description: "Your Talonic API key. Starts with `tlnc_`.",
          },
          {
            name: "TALONIC_BASE_URL",
            type: "string",
            description: "Override the API base URL.",
            default: "https://api.talonic.com",
          },
        ],
      },
    ],
    related: [
      { label: "Install Overview", slug: "install-overview" },
      { label: "Get an API Key", slug: "get-api-key" },
    ],
    faq: [
      {
        question: "What environment variables does the Talonic MCP server need?",
        answer:
          "TALONIC_API_KEY (required, starts with tlnc_) and optionally TALONIC_BASE_URL to override the API endpoint.",
      },
    ],
    mentions: ["TALONIC_API_KEY", "TALONIC_BASE_URL", "environment variables"],
  },
]
