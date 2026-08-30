import type { RawSection } from "../types"

export const sections: RawSection[] = [
  {
    slug: "env-variables",
    parentSlug: "configuration",
    title: "Environment Variables",
    seoTitle: "Environment Variables — Talonic MCP Server Reference",
    description:
      "Configure the Talonic MCP server with environment variables: the required TALONIC_API_KEY, the optional TALONIC_BASE_URL override, and hosted-mode Bearer auth.",
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
      {
        type: "paragraph",
        text: "The `TALONIC_API_KEY` is the only required configuration. It authenticates every API call the MCP server makes on your behalf. Talonic keys start with `tlnc_`. The server checks only that the variable is set — it does not validate the prefix at startup, so a malformed or revoked key boots normally and then fails on the first tool call with a `401`.",
      },
      {
        type: "paragraph",
        text: "The `TALONIC_BASE_URL` override is rarely needed. It exists for enterprise customers with a dedicated Talonic deployment or for developers testing against a staging environment. Most users should leave this unset, which defaults to `https://api.talonic.com`.",
      },
      {
        type: "paragraph",
        text: "Environment variables are set differently depending on your MCP client and deployment mode. For local `npx` setups, they go in the `env` block of the MCP client config JSON. For the hosted server at `mcp.talonic.com`, the API key is passed as a `Bearer` token in the `Authorization` header instead of an environment variable.",
      },
      {
        type: "paragraph",
        text: "If the MCP server cannot read the API key at startup, it exits immediately with `Error: TALONIC_API_KEY environment variable is required.` and a pointer to `https://app.talonic.com`. Common causes include a malformed `env` block in the JSON config, a typo in the variable name, or the MCP client not passing environment variables through to the spawned process. Always fully restart the client after editing the config.",
      },
      {
        type: "heading",
        level: 3,
        id: "env-local-config",
        text: "Local npx configuration example",
      },
      {
        type: "code",
        language: "json",
        title: "Full MCP client config with environment variables",
        code: `{
  "mcpServers": {
    "talonic": {
      "command": "npx",
      "args": ["-y", "@talonic/mcp@latest"],
      "env": {
        "TALONIC_API_KEY": "tlnc_your_key_here"
      }
    }
  }
}`,
      },
      {
        type: "heading",
        level: 3,
        id: "env-base-url-override",
        text: "Base URL override for enterprise deployments",
      },
      {
        type: "code",
        language: "json",
        title: "Config with custom base URL for a dedicated Talonic deployment",
        code: `{
  "mcpServers": {
    "talonic": {
      "command": "npx",
      "args": ["-y", "@talonic/mcp@latest"],
      "env": {
        "TALONIC_API_KEY": "tlnc_your_key_here",
        "TALONIC_BASE_URL": "https://api.talonic.yourcompany.com"
      }
    }
  }
}`,
      },
      {
        type: "paragraph",
        text: "For teams managing multiple environments (development, staging, production), each environment should use a separate API key pointing to a different Talonic workspace. This ensures that test documents and schemas do not mix with production data. Create separate config files or use environment-specific variable values to switch between workspaces. The `TALONIC_BASE_URL` override is only needed for enterprise customers with a dedicated Talonic deployment — all other users should leave it unset.",
      },
      {
        type: "paragraph",
        text: "Some MCP clients support reading environment variables from the system shell rather than the config file. If your client supports this, you can set `TALONIC_API_KEY` in your shell profile (`.bashrc`, `.zshrc`, or equivalent) and omit the `env` block from the config. This approach is slightly more secure because the key is not stored in a JSON file that might be accidentally committed to version control. However, most MCP clients require the `env` block explicitly, so check your client's documentation.",
      },
      {
        type: "paragraph",
        text: "When using the hosted server at `mcp.talonic.com`, environment variables are not used at all. Instead, the API key is passed in the `Authorization` header as a `Bearer` token. This means the `env` block is irrelevant for hosted configurations — only the `url` and `headers` fields matter. If you switch from local to hosted, remove the `env`, `command`, and `args` fields and replace them with `url` and `headers`.",
      },
      {
        type: "heading",
        level: 3,
        id: "env-self-hosting",
        text: "Self-hosting the HTTP transport",
      },
      {
        type: "paragraph",
        text: "The two variables above are everything a local `npx` install reads. If you self-host the streamable-HTTP transport (`npm run start:http`) instead of using `mcp.talonic.com`, a few more variables shape how the server advertises itself to OAuth clients. These are irrelevant for stdio installs and for anyone using the hosted endpoint.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "PORT",
            type: "number",
            description: "Port the HTTP transport listens on.",
            default: "3000",
          },
          {
            name: "MCP_RESOURCE_URL",
            type: "string",
            description:
              "Public URL this deployment advertises as its OAuth protected-resource identifier.",
            default: "https://mcp.talonic.com",
          },
          {
            name: "OAUTH_AUTHORIZATION_SERVER",
            type: "string",
            description: "Authorization server clients are pointed at during OAuth discovery.",
            default: "https://api.talonic.com",
          },
        ],
      },
      {
        type: "callout",
        variant: "warning",
        text: "Never commit your `TALONIC_API_KEY` to version control. If using a shared MCP config template, replace the key with a placeholder like `tlnc_your_key_here` before sharing.",
      },
    ],
    related: [
      { label: "Install Overview", slug: "install-overview" },
      { label: "Get an API Key", slug: "get-api-key" },
      { label: "Common Issues", slug: "common-issues" },
    ],
    faq: [
      {
        question: "What environment variables does the Talonic MCP server need?",
        answer:
          "TALONIC_API_KEY (required, starts with tlnc_) and optionally TALONIC_BASE_URL to override the API endpoint.",
      },
      {
        question: "Where do I set environment variables for the MCP server?",
        answer:
          "For local npx setups, set them in the env block of your MCP client config JSON. For the hosted server, the API key is passed as a Bearer token in the Authorization header instead.",
      },
      {
        question: "What happens if the API key is missing or invalid?",
        answer:
          "A missing key exits at startup with 'Error: TALONIC_API_KEY environment variable is required.' An invalid key is different: the server does not validate the prefix at startup, so it boots normally and the first tool call fails with a 401. Check that the env block is correctly formatted, then restart the client.",
      },
      {
        question: "Can I set the API key in my shell profile instead of the config file?",
        answer:
          "Some MCP clients support reading environment variables from the system shell. If yours does, set TALONIC_API_KEY in .bashrc or .zshrc and omit the env block from the config. However, most clients require the env block explicitly, so check your client documentation first.",
      },
      {
        question: "Do I need TALONIC_BASE_URL for normal usage?",
        answer:
          "No. TALONIC_BASE_URL defaults to https://api.talonic.com and only needs to be overridden for enterprise customers with a dedicated Talonic deployment or developers testing against a staging environment. Leave it unset for standard usage.",
      },
    ],
    mentions: ["TALONIC_API_KEY", "TALONIC_BASE_URL", "environment variables"],
  },
]
