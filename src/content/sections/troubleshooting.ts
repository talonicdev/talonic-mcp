import type { RawSection } from '../types';

export const sections: RawSection[] = [
  {
    slug: 'common-issues',
    parentSlug: 'troubleshooting',
    title: 'Common Issues',
    seoTitle: 'Troubleshooting — Talonic MCP',
    description: 'Solutions for common Talonic MCP server issues: missing API key, server not appearing, extract errors, and filter validation.',
    content: [
      { type: 'heading', level: 3, id: 'missing-api-key', text: 'TALONIC_API_KEY environment variable is required' },
      { type: 'paragraph', text: 'The `env` block in your MCP client config is missing or not being read. Double-check the JSON shape. After editing the config, fully restart the client (not just the conversation).' },

      { type: 'heading', level: 3, id: 'server-not-found', text: 'Talonic does not appear in connected servers' },
      { type: 'paragraph', text: 'Make sure the `command` is `npx` and the `args` are exactly `["-y", "@talonic/mcp@latest"]`. Sanity check: run `npx -y @talonic/mcp@latest --version` in any terminal — it should print `talonic 0.1.6` (or newer).' },

      { type: 'heading', level: 3, id: 'extract-500', text: 'talonic_extract returns 500 with auto-discovery' },
      { type: 'paragraph', text: 'Known limitation. Always provide either an inline `schema` or a `schema_id`. The auto-discovery code path is being stabilised.' },

      { type: 'heading', level: 3, id: 'unsupported-file', text: 'talonic_extract rejects with unsupported_file_type' },
      { type: 'paragraph', text: 'The MIME type was inferred as `application/octet-stream`. The SDK infers from common file extensions; if your filename has an unusual extension, this may occur. A future tool version will expose explicit `content_type` passthrough.' },

      { type: 'heading', level: 3, id: 'filter-validation', text: 'talonic_filter VALIDATION_ERROR / "No field matches name"' },
      { type: 'paragraph', text: 'The field name is not in the API\'s field registry. Field names must be canonical names (e.g. `vendor.name`, `policy.0_term_end`). Call `talonic_search` first; canonical names appear in `fields[].canonicalName`.' },

      { type: 'heading', level: 3, id: 'stale-descriptions', text: 'Tool descriptions look wrong in my client' },
      { type: 'paragraph', text: 'Some MCP clients cache tool descriptions. Restart the client after a server update.' },
    ],
    related: [
      { label: 'Known Limitations', slug: 'known-limitations' },
      { label: 'Upgrading', slug: 'upgrading' },
    ],
    faq: [
      { question: 'Why does Talonic MCP not appear in Claude Desktop?', answer: 'Check that command is "npx" and args are ["-y", "@talonic/mcp@latest"]. Run npx -y @talonic/mcp@latest --version in a terminal to verify. Fully restart Claude Desktop (Cmd+Q).' },
    ],
    mentions: ['troubleshooting', 'API key', 'VALIDATION_ERROR'],
  },
  {
    slug: 'known-limitations',
    parentSlug: 'troubleshooting',
    title: 'Known Limitations',
    seoTitle: 'Known Limitations — Talonic MCP',
    description: 'Current limitations in the Talonic MCP server v0.1: auto-discovery, schema format, filter operators, and schema_id format.',
    content: [
      { type: 'list', items: [
        '**Auto-discovery extract (no schema) is not reliable on production.** Always pass a `schema` or `schema_id` to `talonic_extract`.',
        '**Schema definition: prefer full JSON Schema for now.** The flat key-type map is documented as supported but the server-side normaliser does not translate it yet.',
        '**`is_not_empty` filter currently underreports.** Use specific operators (`eq`, `gt`, `contains`, etc.) against known values instead.',
        '**`schema_id` on `talonic_extract` requires the UUID form.** Other endpoints accept either UUID or `SCH-XXXXXXXX`, but `/v1/extract` currently only accepts UUIDs. Pass the UUID from `talonic_list_schemas`.',
      ]},
    ],
    related: [
      { label: 'Common Issues', slug: 'common-issues' },
      { label: 'talonic_extract', slug: 'talonic-extract' },
    ],
    faq: [
      { question: 'What are the known limitations of Talonic MCP?', answer: 'Auto-discovery extract without a schema is unreliable, flat key-type schema maps are not yet translated, is_not_empty filter underreports, and schema_id on extract requires UUID format.' },
    ],
    mentions: ['limitations', 'auto-discovery', 'is_not_empty', 'schema_id'],
  },
  {
    slug: 'upgrading',
    parentSlug: 'troubleshooting',
    title: 'Upgrading',
    seoTitle: 'Upgrading from Older Versions — Talonic MCP',
    description: 'How to upgrade from older @talonic/mcp versions that had the silent-bin bug affecting MCP client launches.',
    content: [
      { type: 'paragraph', text: 'Versions before `0.1.3` had a bug where the bundled MCP server bin would exit silently when launched via the npm bin symlink, which is exactly how every MCP client invokes it. If you see no `talonic_*` tools despite correct config, you are hitting that bug.' },
      { type: 'paragraph', text: 'The fix: point your `args` at `@latest` (or `@0.1.3` explicitly) and fully restart the client:' },
      { type: 'code', language: 'jsonc', code: '"args": ["-y", "@talonic/mcp@latest"]' },
    ],
    related: [
      { label: 'Install Overview', slug: 'install-overview' },
      { label: 'Common Issues', slug: 'common-issues' },
    ],
    faq: [
      { question: 'How do I upgrade the Talonic MCP server?', answer: 'Set args to ["-y", "@talonic/mcp@latest"] in your MCP client config and fully restart the client. Versions before 0.1.3 had a silent-bin bug that prevented the server from booting.' },
    ],
    mentions: ['upgrade', 'silent-bin bug', '0.1.3'],
  },
];
