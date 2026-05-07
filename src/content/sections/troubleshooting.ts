import type { RawSection } from "../types"

export const sections: RawSection[] = [
  {
    slug: "common-issues",
    parentSlug: "troubleshooting",
    title: "Common Issues",
    seoTitle: "Troubleshooting — Talonic MCP",
    description:
      "Solutions for common Talonic MCP server issues: missing API key, server not appearing, extract errors, and filter validation.",
    content: [
      {
        type: "paragraph",
        text: "This section covers the most frequently encountered issues when setting up and using the Talonic MCP server. Each issue includes a description, the root cause, and the fix. If your problem is not listed here, check the Known Limitations section or reach out via GitHub issues.",
      },
      {
        type: "paragraph",
        text: "Most issues fall into two categories: **configuration problems** (the server does not start or connect) and **tool errors** (the server is running but a specific tool call fails). Configuration problems are almost always caused by malformed JSON, a missing API key, or not restarting the MCP client after editing the config.",
      },
      {
        type: "paragraph",
        text: "Tool errors typically include a structured error message with an error type and description. Read the error message carefully — it usually tells you exactly what is wrong and how to fix it. For example, a `VALIDATION_ERROR` on `talonic_filter` means the field name is not in the API's registry.",
      },
      {
        type: "paragraph",
        text: "When debugging, start by verifying the MCP server is running. Check the connected servers list in your MCP client. If Talonic is not listed, the issue is in your config or client setup. If it is listed but a tool call fails, the issue is with the tool input or API-side.",
      },
      {
        type: "heading",
        level: 3,
        id: "missing-api-key",
        text: "TALONIC_API_KEY environment variable is required",
      },
      {
        type: "paragraph",
        text: "The `env` block in your MCP client config is missing or not being read. Double-check the JSON shape. After editing the config, fully restart the client (not just the conversation).",
      },

      {
        type: "heading",
        level: 3,
        id: "server-not-found",
        text: "Talonic does not appear in connected servers",
      },
      {
        type: "paragraph",
        text: 'Make sure the `command` is `npx` and the `args` are exactly `["-y", "@talonic/mcp@latest"]`. Sanity check: run `npx -y @talonic/mcp@latest --version` in any terminal — it should print a version number.',
      },

      {
        type: "heading",
        level: 3,
        id: "extract-no-schema",
        text: "talonic_extract returns a validation error when no schema is given",
      },
      {
        type: "paragraph",
        text: "By design in v0.1. Schema-less extraction is unreliable, so the MCP layer rejects calls that omit both `schema` and `schema_id` before they reach the API. Provide either an inline `schema` (full JSON Schema recommended) or a `schema_id` from `talonic_list_schemas`.",
      },

      {
        type: "heading",
        level: 3,
        id: "unsupported-file",
        text: "talonic_extract rejects with unsupported_file_type",
      },
      {
        type: "paragraph",
        text: "The MIME type was inferred as `application/octet-stream`. The SDK infers from common file extensions; if your filename has an unusual extension, this may occur. A future tool version will expose explicit `content_type` passthrough.",
      },

      {
        type: "heading",
        level: 3,
        id: "filter-validation",
        text: 'talonic_filter VALIDATION_ERROR / "No field matches name"',
      },
      {
        type: "paragraph",
        text: "The field name is not in the API's field registry. Field names must be canonical names (e.g. `vendor.name`, `policy.0_term_end`). Call `talonic_search` first; canonical names appear in `fields[].canonicalName`.",
      },

      {
        type: "heading",
        level: 3,
        id: "stale-descriptions",
        text: "Tool descriptions look wrong in my client",
      },
      {
        type: "paragraph",
        text: "Some MCP clients cache tool descriptions. Restart the client after a server update.",
      },
      {
        type: "callout",
        variant: "info",
        text: "When reporting issues, include the MCP server version (`npx -y @talonic/mcp@latest --version`), your MCP client name and version, and the full error message. This helps diagnose problems faster.",
      },
    ],
    related: [
      { label: "Known Limitations", slug: "known-limitations" },
      { label: "Upgrading", slug: "upgrading" },
      { label: "Environment Variables", slug: "env-variables" },
    ],
    faq: [
      {
        question: "Why does Talonic MCP not appear in Claude Desktop?",
        answer:
          'Check that command is "npx" and args are ["-y", "@talonic/mcp@latest"]. Run npx -y @talonic/mcp@latest --version in a terminal to verify. Fully restart Claude Desktop (Cmd+Q).',
      },
      {
        question: "Why does talonic_extract fail with a validation error?",
        answer:
          "The most common cause is a missing schema. In v0.1, schema-less extraction is disabled at the MCP layer. Always provide a schema (inline JSON Schema) or schema_id from talonic_list_schemas.",
      },
      {
        question: "How do I debug MCP server connection issues?",
        answer:
          "First verify the server runs standalone: npx -y @talonic/mcp@latest --version. Then check your config JSON is valid, the API key starts with tlnc_, and you have fully restarted your MCP client.",
      },
    ],
    mentions: ["troubleshooting", "API key", "VALIDATION_ERROR"],
  },
  {
    slug: "known-limitations",
    parentSlug: "troubleshooting",
    title: "Known Limitations",
    seoTitle: "Known Limitations — Talonic MCP",
    description:
      "Current limitations in the Talonic MCP server v0.1: schema requirement, filter discoverability and typing, Claude.ai drag-and-drop stall, and unsurfaced cost.",
    content: [
      {
        type: "paragraph",
        text: "The Talonic MCP server v0.1 is production-ready but has a number of known limitations that are planned for future releases. Understanding these limitations helps agents make better decisions about when and how to use each tool.",
      },
      {
        type: "paragraph",
        text: "Most limitations relate to the extraction pipeline's maturity in v0.1. Schema-less extraction, certain filter operators, cost information, and per-field provenance are not yet available. These are documented here so agent developers can set accurate expectations and build appropriate fallbacks.",
      },
      {
        type: "list",
        items: [
          "**Schema is required on `talonic_extract`.** Schema-less extraction is unreliable in v0.1 and is rejected at the MCP layer with a validation error. Always pass a `schema` (full JSON Schema recommended) or a `schema_id`.",
          "**Schema definition: prefer full JSON Schema.** The flat key-type map is documented as accepted; if you get a 'no fields' error from the API, fall back to JSON Schema.",
          "**Filter requires `filterable: true` fields.** Call `talonic_search` first; only entries in the response where `filterable: true` can be used as `field` (or `field_id`) on `talonic_filter`. Entries with `filterable: false` exist in the schema but have no extracted data yet.",
          "**Schema field type affects filter operators.** Numeric operators (`gt`, `gte`, `lt`, `lte`, `between`) only work on fields typed as `number` in the schema. Numeric values stored as strings (with currency symbols, locale formatting, etc.) silently return zero results. Type your schema fields appropriately at design time.",
          "**`is_not_empty` filter is not exposed in v0.1.** It underreports against fields known to be populated. Workaround: filter with `eq`/`gt`/`contains` against a known value, or use `is_empty` and invert the result client-side.",
          "**Drag-and-drop file uploads in Claude.ai are capped by Claude.ai's tool-call argument size limit.** A base64-encoded real PDF (typically hundreds of KB) cannot fit through Claude.ai's connector tool-call pipe, which truncates parameters under ~1KB. The Talonic API receives a few hundred bytes, registers an empty document, and returns a response with `null` extracted fields. This is a Claude.ai platform limit on connectors, not a Talonic MCP server bug. Workaround for Claude.ai users: use `file_url` (publicly reachable URL), `document_id` (file uploaded at app.talonic.com), or use a local-stdio install (`npx -y @talonic/mcp@latest` in Claude Desktop, Cursor, Cline, etc.) which has no parameter cap. The architectural fix is pre-signed upload URLs.",
          "**Cost, EUR price, and remaining balance are not surfaced.** The API does not return them yet. Credit balance must be checked in the Talonic dashboard.",
        ],
      },
      {
        type: "paragraph",
        text: "Agents should handle these limitations gracefully. For the schema requirement, always construct or reference a schema before calling `talonic_extract`. For the missing cost information, direct users to the Talonic dashboard at `https://app.talonic.com` when they ask about pricing or credit balance.",
      },
      {
        type: "paragraph",
        text: "For the `is_not_empty` filter gap, the recommended workaround is to use `is_empty` and invert the logic client-side, or filter against a known value with `eq`, `gt`, or `contains`. This is a server-side issue that will be resolved in a future API version.",
      },
      {
        type: "callout",
        variant: "warning",
        text: "Do not rely on schema-less extraction or `is_not_empty` filtering in automated workflows. Both are explicitly disabled in v0.1 and will return errors rather than unreliable results.",
      },
    ],
    related: [
      { label: "Common Issues", slug: "common-issues" },
      { label: "talonic_extract", slug: "talonic-extract" },
      { label: "talonic_filter", slug: "talonic-filter" },
    ],
    faq: [
      {
        question: "What are the known limitations of Talonic MCP?",
        answer:
          "Schema is required on talonic_extract. Filter requires filterable: true fields (use talonic_search first to discover them). Numeric filter operators require schema fields typed as number. is_not_empty filter is not exposed in v0.1. Drag-and-drop file uploads in Claude.ai currently stall via the hosted MCP; use file_url or document_id instead, or use the local stdio install. Cost and balance are not surfaced in tool responses yet.",
      },
      {
        question: "Will schema-less extraction be supported in the future?",
        answer:
          "Yes, it is planned for a future release. In v0.1, schema-less extraction is disabled because it produces unreliable results. Always provide a schema or schema_id.",
      },
      {
        question: "How do I check my credit balance or costs?",
        answer:
          "Cost information is not surfaced in v0.1 tool responses. Check your credit balance and usage in the Talonic dashboard at app.talonic.com.",
      },
    ],
    mentions: [
      "limitations",
      "schema",
      "filterable",
      "is_not_empty",
      "drag-and-drop",
      "rate limits",
    ],
  },
  {
    slug: "upgrading",
    parentSlug: "troubleshooting",
    title: "Upgrading",
    seoTitle: "Upgrading from Older Versions — Talonic MCP",
    description:
      "How to upgrade from older @talonic/mcp versions that had the silent-bin bug affecting MCP client launches.",
    content: [
      {
        type: "paragraph",
        text: "Versions before `0.1.3` had a bug where the bundled MCP server bin would exit silently when launched via the npm bin symlink, which is exactly how every MCP client invokes it. If you see no `talonic_*` tools despite correct config, you are hitting that bug.",
      },
      {
        type: "paragraph",
        text: "The fix: point your `args` at `@latest` (or `@0.1.3` explicitly) and fully restart the client:",
      },
      { type: "code", language: "jsonc", code: '"args": ["-y", "@talonic/mcp@latest"]' },
      {
        type: "paragraph",
        text: "Using `@latest` is the recommended approach because it ensures you automatically receive new features, bug fixes, and improved tool descriptions on every client restart. If you need version stability for a production workflow, pin to a specific version like `@0.1.6` instead.",
      },
      {
        type: "paragraph",
        text: "After updating the `args` in your MCP client config, you must fully restart the client application. Simply starting a new conversation is not enough — the MCP server process must be terminated and re-spawned. On Claude Desktop, use Cmd+Q (macOS) or close from the system tray (Windows). On Cursor and VS Code-based clients, reload the window.",
      },
      {
        type: "callout",
        variant: "info",
        text: "If you are using the hosted server at `mcp.talonic.com`, upgrades are automatic. You do not need to change any configuration — the hosted server always runs the latest version.",
      },
    ],
    related: [
      { label: "Install Overview", slug: "install-overview" },
      { label: "Common Issues", slug: "common-issues" },
    ],
    faq: [
      {
        question: "How do I upgrade the Talonic MCP server?",
        answer:
          'Set args to ["-y", "@talonic/mcp@latest"] in your MCP client config and fully restart the client. Versions before 0.1.3 had a silent-bin bug that prevented the server from booting.',
      },
      {
        question: "Do I need to upgrade if I use the hosted server?",
        answer:
          "No. The hosted server at mcp.talonic.com is automatically updated to the latest version. No configuration changes are needed on your end.",
      },
      {
        question: "Should I pin to a specific version or use @latest?",
        answer:
          "Use @latest for development and most use cases — it picks up fixes automatically. Pin to a specific version (e.g., @0.1.6) only if you need strict version stability in production workflows.",
      },
    ],
    mentions: ["upgrade", "silent-bin bug", "0.1.3", "@latest"],
  },
]
