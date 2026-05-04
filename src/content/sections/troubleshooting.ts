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
      "Current limitations in the Talonic MCP server v0.1: schema requirement, filter operators, cost surfacing, and provenance.",
    content: [
      {
        type: "list",
        items: [
          "**Schema is required on `talonic_extract`.** Schema-less extraction is unreliable in v0.1 and is rejected at the MCP layer with a validation error. Always pass a `schema` (full JSON Schema recommended) or a `schema_id`.",
          "**Schema definition: prefer full JSON Schema.** The flat key-type map is documented as accepted; if you get a 'no fields' error from the API, fall back to JSON Schema.",
          "**`is_not_empty` filter is not exposed in v0.1.** It underreports against fields known to be populated. Workaround: filter with `eq`/`gt`/`contains` against a known value, or use `is_empty` and invert the result client-side.",
          "**Cost, EUR price, and remaining balance are not surfaced.** The API does not return them yet. Tool responses include rate-limit info via the SDK's `WithRateLimit<T>` wrapper, but credit balance must be checked in the Talonic dashboard.",
          "**Per-field source provenance (page, bounding box) is not surfaced.** Confidence scores per field are returned in `confidence.fields`. Treat fields below ~0.7 as needing human review.",
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
          "Schema is required on talonic_extract (schema-less mode is disabled at the MCP layer). Flat key-type schema maps may need a JSON Schema fallback. is_not_empty filter is not exposed in v0.1. Cost and per-field provenance are not surfaced in tool responses yet.",
      },
    ],
    mentions: ["limitations", "schema", "is_not_empty", "confidence", "rate limits"],
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
