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
    ],
    related: [
      { label: "Known Limitations", slug: "known-limitations" },
      { label: "Upgrading", slug: "upgrading" },
    ],
    faq: [
      {
        question: "Why does Talonic MCP not appear in Claude Desktop?",
        answer:
          'Check that command is "npx" and args are ["-y", "@talonic/mcp@latest"]. Run npx -y @talonic/mcp@latest --version in a terminal to verify. Fully restart Claude Desktop (Cmd+Q).',
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
    ],
    related: [
      { label: "Common Issues", slug: "common-issues" },
      { label: "talonic_extract", slug: "talonic-extract" },
    ],
    faq: [
      {
        question: "What are the known limitations of Talonic MCP?",
        answer:
          "Schema is required on talonic_extract. Filter requires filterable: true fields (use talonic_search first to discover them). Numeric filter operators require schema fields typed as number. is_not_empty filter is not exposed in v0.1. Drag-and-drop file uploads in Claude.ai currently stall via the hosted MCP; use file_url or document_id instead, or use the local stdio install. Cost and balance are not surfaced in tool responses yet.",
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
    ],
    mentions: ["upgrade", "silent-bin bug", "0.1.3"],
  },
]
