# @talonic/mcp

Official Talonic MCP server. Lets AI agents extract structured, schema-validated data from any document via the [Model Context Protocol](https://modelcontextprotocol.io).

> **Status:** v0.1.3. Seven tools and one resource live: `talonic_extract`, `talonic_search`, `talonic_filter`, `talonic_get_document`, `talonic_to_markdown`, `talonic_list_schemas`, `talonic_save_schema`, plus the `talonic://schemas` resource. Verified end-to-end against production.

## Why an agent should use this

When an agent needs to pull structured data out of a PDF, scan, image, or messy document, the usual approach is raw OCR plus an LLM call. Results are unreliable; tables get mangled, dates get misread, totals drift.

With this MCP server installed, the agent has a `talonic_extract` tool that returns schema-validated JSON with per-field confidence scores, a detected document type, and stable IDs for follow-up calls. Six other tools cover the rest of the workflow: searching the workspace, filtering by extracted field values, fetching a document's metadata, getting OCR markdown, listing saved schemas, and saving new ones.

## Get an API key (30 seconds)

Each user runs against their own isolated Talonic workspace. Your documents and schemas are private to you.

1. Sign up at [https://app.talonic.com](https://app.talonic.com). Free tier: 50 extractions per day, no credit card.
2. Settings → API Keys → Create New Key.
3. Copy the `tlnc_` value into your MCP client config (snippets below).

## Install

The package is on npm. Every MCP client launches it the same way: a one-line `npx` invocation with your API key in the `env` block. No clone, no build.

```jsonc
{
  "command": "npx",
  "args": ["-y", "@talonic/mcp@latest"],
  "env": { "TALONIC_API_KEY": "tlnc_..." }
}
```

The `-y` flag skips the npm install prompt. Pinning to `@latest` means new versions are picked up on the next client restart. To pin to a specific version, replace `@latest` with `@0.1.3`.

Per-client snippets are below.

## MCP client setup

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "talonic": {
      "command": "npx",
      "args": ["-y", "@talonic/mcp@latest"],
      "env": {
        "TALONIC_API_KEY": "tlnc_your_key_here"
      }
    }
  }
}
```

Fully restart Claude Desktop (Cmd+Q on macOS, not just close the window). Talonic appears in the connected servers list with all seven tools.

### Cursor

Edit `~/.cursor/mcp.json` (or open Cursor settings → MCP → edit config):

```json
{
  "mcpServers": {
    "talonic": {
      "command": "npx",
      "args": ["-y", "@talonic/mcp@latest"],
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
  "command": "npx",
  "args": ["-y", "@talonic/mcp@latest"],
  "env": {
    "TALONIC_API_KEY": "tlnc_your_key_here"
  }
}
```

### Cowork

Open Cowork settings → MCP Servers → Add. Use the same shape as Claude Desktop above.

## Tool reference

Each tool's description is written for an LLM, with explicit USE WHEN / DO NOT USE WHEN sections. Agents pick the right tool reliably without further prompting. Briefly:

- **`talonic_extract`** — Extract structured, schema-validated data from a document. Inputs: one of `file_data` + `filename` (recommended for chat clients, see below), `file_path`, `file_url`, or `document_id`, plus a `schema` (or `schema_id`). Returns clean JSON with per-field confidence scores.
- **`talonic_search`** — Omnisearch across documents, fields, sources, and schemas in the workspace. Use for conceptual or fuzzy queries.
- **`talonic_filter`** — Filter documents by extracted field values using composable conditions (`eq`, `gt`, `between`, `contains`, etc.). Field names are auto-resolved to internal IDs (currently limited on production; see [Known limitations](#known-limitations-v01) for the recommended workaround).
- **`talonic_get_document`** — Fetch full metadata for a single document by id, including processing log and link URLs.
- **`talonic_to_markdown`** — Get OCR-converted markdown for a document. Accepts `document_id` (cheapest), `file_data` + `filename`, `file_path`, or `file_url`.
- **`talonic_list_schemas`** — List all saved schemas with their definitions.
- **`talonic_save_schema`** — Save a schema definition to the workspace for reuse.

The `talonic://schemas` resource exposes the saved-schemas list to clients that browse resources separately (Claude Desktop and Cowork render these in the UI).

## Drag-and-drop in chat clients

When the user drag-drops a PDF (or any supported file) into a chat-style MCP host such as Claude Desktop, Cowork, or Cursor, the file lands in a host-owned sandbox directory the MCP server cannot read. The path the host then hands the agent (something like `/mnt/user-data/uploads/abc.pdf`) is meaningless to a separately-running `npx` MCP process, so `file_path` calls fail with a filesystem error.

`@talonic/mcp@0.1.4` and later solve this by accepting **`file_data`** (base64-encoded file bytes) and **`filename`** on `talonic_extract` and `talonic_to_markdown`. The agent reads the file bytes from the conversation, base64-encodes them, and passes them through the MCP tool call. The MCP server decodes, infers MIME type from the filename, and uploads to the Talonic API as a normal multipart request. The file never has to live on the MCP server's disk.

Tool descriptions advertise `file_data` as the recommended input for chat-style clients, so well-trained agents will reach for it automatically. No client-side configuration is required beyond installing `@talonic/mcp@latest` (or `@0.1.4` or newer) as documented above.

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
Make sure the `command` is `npx` and the `args` are exactly `["-y", "@talonic/mcp@latest"]`. As a sanity check, in any terminal run `npx -y @talonic/mcp@latest --version`; it should print `talonic 0.1.3` (or newer). If you are on an older `0.1.x` and see no output at all, you are hitting the silent-bin bug fixed in `0.1.3`; upgrade by setting the args to `["-y", "@talonic/mcp@latest"]` and restarting the client.

**`talonic_extract` returns 500 INTERNAL_ERROR with auto-discovery.**
Known limitation. Always provide either an inline `schema` or a `schema_id`. The platform team is stabilising the auto-discovery code path.

**`talonic_extract` rejects with `unsupported_file_type`.**
The MIME type was inferred as `application/octet-stream`. The SDK now infers from common file extensions; if your filename has an unusual extension, pass `content_type` explicitly to the SDK call (the MCP layer does not yet expose this; a future tool version will).

**`talonic_filter` errors with `field_not_found`.**
Field-name resolution against `/v1/fields?search=` is currently limited on production: even names that `talonic_search` returns as live `displayName` / `canonicalName` values can fail. Until the API-side resolver is improved, the reliable path is to pass `field_id` directly. Get the id from a `talonic_search` response (`fields[].id`) and use the `field_id` parameter instead of `field` in your filter condition.

**Tool descriptions look wrong in my client.**
Some MCP clients cache tool descriptions. Restart the client after a server update.

## Known limitations (v0.1)

- **Auto-discovery extract (no schema) is not reliable on production.** Always pass a `schema` or `schema_id` to `talonic_extract`.
- **Only the full JSON Schema format is reliable today.** The flat key-type map (`{ vendor_name: "string", ... }`) is silently accepted by the API but currently saves with empty `properties`. The `{ fields: [...] }` simplified format is also unstable. Until the API normalises the simpler shapes, pass full JSON Schema:
  ```json
  {
    "type": "object",
    "properties": {
      "vendor_name": { "type": "string", "title": "Vendor Name" },
      "total_amount": { "type": "number", "title": "Total Amount" }
    },
    "required": ["vendor_name", "total_amount"]
  }
  ```
- **`talonic_filter` field-name resolution is limited on production.** Even names returned live by `talonic_search` can fail with `field_not_found`. Until the API-side resolver is improved, pass `field_id` directly (the value of `fields[].id` from a `talonic_search` response).

## Upgrading from 0.1.0 / 0.1.1 / 0.1.2

Versions before `0.1.3` had a bug where the bundled MCP server bin would exit silently when launched via the npm bin symlink, which is exactly how every MCP client invokes it via `npx`. If your client config is on an older version and you see no `talonic_*` tools surface despite the config looking correct, you are hitting that bug.

The fix is to point your `args` at `@latest` (or `@0.1.3` explicitly) and fully restart the client:

```jsonc
"args": ["-y", "@talonic/mcp@latest"]
```

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
