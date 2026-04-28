# @talonic/mcp

Official Talonic MCP server. Lets AI agents extract structured, schema-validated data from any document via the [Model Context Protocol](https://modelcontextprotocol.io).

> **Status:** v0.1.0 with seven tools and one resource live: `talonic_extract`, `talonic_search`, `talonic_filter`, `talonic_get_document`, `talonic_to_markdown`, `talonic_list_schemas`, `talonic_save_schema`, plus the `talonic://schemas` resource.

## Why an agent should use this

When an agent needs to pull structured data out of a PDF, scan, image, or messy document, the usual approach is raw OCR plus an LLM call. Results are unreliable; tables get mangled, dates get misread, totals drift.

With this MCP server installed, the agent has a `talonic_extract` tool that returns schema-validated JSON with per-field confidence scores, a detected document type, and stable IDs for follow-up calls. Six other tools cover the rest of the workflow: searching the workspace, filtering by extracted field values, fetching a document's metadata, getting OCR markdown, listing saved schemas, and saving new ones.

## Get an API key (30 seconds)

Each user runs against their own isolated Talonic workspace. Your documents and schemas are private to you.

1. Sign up at [https://app.talonic.com](https://app.talonic.com). Free tier: 50 extractions per day, no credit card.
2. Settings → API Keys → Create New Key.
3. Copy the `tlnc_` value into your MCP client config (snippets below).

## Install

There are two paths today: a local-checkout path that works right now, and a one-line `npx` path that becomes available once we publish to npm.

### A. Local checkout (works today)

```bash
# 1. Clone the SDK and the MCP server
git clone https://github.com/talonicdev/talonic-node.git
git clone https://github.com/talonicdev/talonic-mcp.git

# 2. Build the SDK (the MCP server depends on it)
cd talonic-node
npm install
npm run build

# 3. Build the MCP server
cd ../talonic-mcp
npm install
npm run build
```

Then point your MCP client at the absolute path to `dist/server.js`. Snippets per client below.

### B. Published npm package (coming soon)

Once `@talonic/mcp` is on npm, the install becomes:

```jsonc
{
  "command": "npx",
  "args": ["-y", "@talonic/mcp"],
  "env": { "TALONIC_API_KEY": "tlnc_..." }
}
```

No clone, no build. The `-y` flag skips the install prompt.

## MCP client setup

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "talonic": {
      "command": "node",
      "args": ["/absolute/path/to/talonic-mcp/dist/server.js"],
      "env": {
        "TALONIC_API_KEY": "tlnc_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop. Talonic appears in the connected servers list with all seven tools.

### Cursor

Edit `~/.cursor/mcp.json` (or open Cursor settings → MCP → edit config):

```json
{
  "mcpServers": {
    "talonic": {
      "command": "node",
      "args": ["/absolute/path/to/talonic-mcp/dist/server.js"],
      "env": {
        "TALONIC_API_KEY": "tlnc_your_key_here"
      }
    }
  }
}
```

### Cline (VS Code extension)

Open the Cline panel → settings (gear icon) → MCP Servers → Edit. Add the entry above. Save and restart the panel.

### Continue (VS Code / JetBrains)

Edit `~/.continue/config.json`. Add to the `mcpServers` array:

```json
{
  "name": "talonic",
  "command": "node",
  "args": ["/absolute/path/to/talonic-mcp/dist/server.js"],
  "env": {
    "TALONIC_API_KEY": "tlnc_your_key_here"
  }
}
```

### Cowork

Open Cowork settings → MCP Servers → Add. Use the same shape as Claude Desktop.

## Tool reference

Each tool's description is written for an LLM, with explicit USE WHEN / DO NOT USE WHEN sections. Agents pick the right tool reliably without further prompting. Briefly:

- **`talonic_extract`** — Extract structured, schema-validated data from a document. Inputs: one of `file_path`, `file_url`, `document_id`, plus a `schema` (or `schema_id`). Returns clean JSON with per-field confidence scores.
- **`talonic_search`** — Omnisearch across documents, fields, sources, and schemas in the workspace. Use for conceptual or fuzzy queries.
- **`talonic_filter`** — Filter documents by extracted field values using composable conditions (`eq`, `gt`, `between`, `contains`, etc.). Field names are auto-resolved to internal IDs.
- **`talonic_get_document`** — Fetch full metadata for a single document by id, including processing log and link URLs.
- **`talonic_to_markdown`** — Get OCR-converted markdown for a document already in the workspace.
- **`talonic_list_schemas`** — List all saved schemas with their definitions.
- **`talonic_save_schema`** — Save a schema definition to the workspace for reuse.

The `talonic://schemas` resource exposes the saved-schemas list to clients that browse resources separately (Claude Desktop and Cowork render these in the UI).

## How it works

```
Agent (Claude Desktop / Cursor / Cline / etc.)
  ↓ MCP protocol over stdio
Talonic MCP server (this package)
  ↓ HTTPS, Bearer auth
api.talonic.com
```

Each tool call is one HTTP request to the Talonic API, using your API key. The server handles auth, retries on transient failures (429, 5xx), MIME-type detection on file uploads, multipart serialisation, and structured error formatting.

## Configuration

Set via the `env` block in your MCP client config:

| Variable | Required | Description |
|---|---|---|
| `TALONIC_API_KEY` | yes | Your Talonic API key. Starts with `tlnc_`. |
| `TALONIC_BASE_URL` | no | Override the API base URL. Default: `https://api.talonic.com`. |

## Troubleshooting

**Tool calls return `Error: TALONIC_API_KEY environment variable is required.`**
The `env` block in your MCP client config is missing or not being read. Double-check the JSON shape. After editing the config, fully restart the client (not just the conversation).

**Talonic does not appear in the connected servers list.**
Check the absolute path in `args` is correct and that `dist/server.js` exists. Try running it directly: `node /absolute/path/to/talonic-mcp/dist/server.js --version`. It should print `talonic 0.1.0`.

**`talonic_extract` returns 500 INTERNAL_ERROR with auto-discovery.**
Known limitation. Always provide either an inline `schema` or a `schema_id`. The platform team is stabilising the auto-discovery code path.

**`talonic_extract` rejects with `unsupported_file_type`.**
The MIME type was inferred as `application/octet-stream`. The SDK now infers from common file extensions; if your filename has an unusual extension, pass `content_type` explicitly to the SDK call (the MCP layer does not yet expose this; a future tool version will).

**`talonic_filter` errors with `field_not_found`.**
The field name does not exist in your workspace yet. Run `talonic_search` or `talonic_list_schemas` first to discover available field names.

**Tool descriptions look wrong in my client.**
Some MCP clients cache tool descriptions. Restart the client after a server update.

## Known limitations (v0.1)

- Auto-discovery extract (no schema) is not reliable on production. Always pass a schema.
- The simplified-fields schema format `{ fields: [...] }` is unstable on production. Use flat-map (`{ vendor_name: "string", ... }`) or full JSON Schema.
- `talonic_to_markdown` requires an existing `document_id`. To convert a fresh file, call `talonic_extract` first with a minimal schema, then `talonic_to_markdown` with the resulting `document.id`.
- The `@talonic/node` SDK is not yet on npm; install via local checkout for now.

## Develop

```bash
git clone https://github.com/talonicdev/talonic-mcp.git
cd talonic-mcp
npm install
npm run build
npm test
node dist/server.js --version
```

## License

MIT (c) Talonic GmbH
