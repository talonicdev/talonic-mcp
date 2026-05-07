# @talonic/mcp

Official Talonic MCP server. Lets AI agents extract structured, schema-validated data from any document via the [Model Context Protocol](https://modelcontextprotocol.io).

[![talonic-mcp MCP server](https://glama.ai/mcp/servers/talonicdev/talonic-mcp/badges/score.svg)](https://glama.ai/mcp/servers/talonicdev/talonic-mcp)
[![smithery badge](https://smithery.ai/badge/talonic/talonic)](https://smithery.ai/servers/talonic/talonic)

> **Status:** Listed on the [official MCP Registry](https://registry.modelcontextprotocol.io/) as `io.github.talonicdev/talonic-mcp`. Eight tools and two resources live: `talonic_extract`, `talonic_search`, `talonic_filter`, `talonic_get_document`, `talonic_to_markdown`, `talonic_list_schemas`, `talonic_save_schema`, `talonic_get_balance`, plus the `talonic://schemas` and `talonic://webhooks/reference` resources. Verified end-to-end against production.

## Why an agent should use this

When an agent needs to pull structured data out of a PDF, scan, image, or messy document, the usual approach is raw OCR plus an LLM call. Results are unreliable; tables get mangled, dates get misread, totals drift.

With this MCP server installed, the agent has a `talonic_extract` tool that returns schema-validated JSON with per-field confidence scores, a detected document type, and stable IDs for follow-up calls. Seven other tools cover the rest of the workflow: searching the workspace, filtering by extracted field values, fetching a document's metadata, getting OCR markdown, listing saved schemas, saving new ones, and reading the workspace credit balance for budget-aware behaviour.

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

The `-y` flag skips the npm install prompt.

**Version pinning.** `@latest` is fine for trying things out and for personal use. For production deployments and CI, pin to a specific version (e.g. `@talonic/mcp@0.1.16`) so a future release cannot silently change tool descriptions, validation rules, or the response shape your agent depends on. Bump the pin manually after reviewing the CHANGELOG.

Talonic uses a single API key per workspace. The same key authorises all tools. There is no scoping mechanism in v0.1; treat the key like any other secret and store it in your client's secret store rather than in version control.

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

Fully restart Claude Desktop (Cmd+Q on macOS, not just close the window). Talonic appears in the connected servers list with all eight tools.

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

### Claude.ai (hosted MCP)

Claude.ai's "Add custom connector" flow uses a remote MCP URL instead of a local stdio process. We host one at `mcp.talonic.com` so Claude.ai users can install Talonic without running anything locally:

1. Open https://claude.ai/settings/connectors.
2. Click "Add custom connector".
3. URL: `https://mcp.talonic.com/mcp?apiKey=tlnc_your_key_here`
4. Click Add. The 8 tools appear.

Claude.ai's UI does not currently accept a custom `Authorization` header on connectors, so the API key is passed as a `?apiKey=...` query parameter. Less secure than the Bearer header pattern (the key is persisted in the connector store and may appear in Anthropic-side logs), so rotate the key in your Talonic dashboard if you remove the connector. IDE-style clients (Cursor, Cline, Continue) that accept custom headers should use the Bearer header instead.

**Caveat:** drag-and-drop file uploads through `talonic_extract` currently stall on the hosted endpoint. Use `file_url` (a publicly reachable URL) or `document_id` (an already-uploaded document) for now. The local stdio install is unaffected.

## Tool reference

Each tool's description is written for an LLM, with explicit USE WHEN / DO NOT USE WHEN sections. Agents pick the right tool reliably without further prompting. Briefly:

- **`talonic_extract`**, status: stable. Extract structured, schema-validated data from a document. Inputs: one of `file_data` + `filename` (recommended for chat clients, see below), `file_path`, `file_url`, or `document_id`, plus a `schema` or `schema_id`. Returns JSON with `data`, per-field `confidence`, document metadata, and a `cost` block (per-call credits / EUR / post-call balance) parsed from the API's `X-Talonic-Cost-*` response headers. Schema is required; the MCP layer rejects schema-less calls.
- **`talonic_search`**, status: stable. Omnisearch across documents, fields, sources, and schemas in the workspace. Use for conceptual or fuzzy queries.
- **`talonic_filter`**, status: stable. Filter documents by extracted field values using composable conditions (`eq`, `gt`, `between`, `contains`, `is_empty`, etc.). Accepts canonical field names (e.g. `vendor.name`) which the Talonic API resolves to ids server-side, or UUIDs directly. `is_not_empty` is intentionally not exposed in v0.1; see [Known limitations](#known-limitations-v01).
- **`talonic_get_document`**, status: stable. Fetch full metadata for a single document by id, including processing log and link URLs.
- **`talonic_to_markdown`**, status: stable. Get OCR-converted markdown for a document. Accepts `document_id` (cheapest), `file_data` + `filename`, `file_path`, or `file_url`. Returns the same `cost` block as `talonic_extract` when an extract step ran (i.e., on the file inputs); `null` on the `document_id` path.
- **`talonic_list_schemas`**, status: stable. List all saved schemas with their definitions. Returns both UUID and SCH-XXXXXXXX short id; either is accepted by `talonic_extract`.
- **`talonic_save_schema`**, status: stable. Save a schema definition to the workspace for reuse.
- **`talonic_get_balance`**, status: stable. Read the workspace credit balance, EUR value, 30-day burn rate, projected runway, tier, and next-tier-reset timestamp. Use it for budget-aware decisions before kicking off large batches.

Two resources are also exposed for clients that browse them separately (Claude Desktop and Cowork render these in the UI):
- `talonic://schemas`: saved-schemas list.
- `talonic://webhooks/reference`: webhook event types, delivery behavior, signature verification algorithms, and retry policies. Use this when an agent needs to set up or troubleshoot a webhook integration without leaving the MCP context.

## Agent decision guide

Pick the right tool before you call. The wrong tool returns the wrong data, costs unnecessary credits, and slows the conversation.

**User has a file (or just dropped one in)**
- They want specific fields (vendor, total, dates, parties): `talonic_extract` with `schema` or `schema_id`.
- They want full text content for summarisation, translation, or analysis: `talonic_to_markdown`.
- They want both: `talonic_extract` with `include_markdown: true`, one upload.

**User is asking about existing documents**
- Conceptual or fuzzy ("any docs about indemnification"): `talonic_search`.
- Value-based on extracted fields ("invoices over 1000 EUR"): `talonic_filter`.
- They reference a `document_id`: `talonic_get_document` for metadata, `talonic_to_markdown` for text, `talonic_extract` to re-extract with a new schema. Re-using a `document_id` is cheaper than re-uploading.

**User is working with schemas**
- One-off extraction: pass schema inline.
- Same schema across many documents: `talonic_save_schema` once, then `talonic_extract` with `schema_id`.
- Discover existing schemas first: `talonic_list_schemas`.
- Iterate inline before saving. Avoid clutter.

**Confidence and human review**
- `confidence.overall` below ~0.7: tell the user the extraction may be unreliable, surface low-confidence fields, confirm before any downstream action.
- Per-field confidence below ~0.7: mark as "needs review", do not use silently in calculations or external API calls.
- Critical fields (amounts, legal terms, names, dates): confirm with user before acting, even at high confidence.
- Per-field source provenance (page, section, source text snippet) is available by passing `include_provenance: true` on `talonic_extract`. Use it when the user wants to cite the source of a value or verify against the original document.

**When not to call Talonic**
- General-knowledge or chat questions. Do not pre-emptively extract.
- The data is already in conversation history from a previous tool call. Re-use it.
- The user wants to discuss or revise an extraction you already produced. Reason over the previous result instead of re-extracting.
- Cost, EUR price, and remaining balance are not surfaced in v0.1 tool responses. If the user asks about cost or credit balance, point them to https://app.talonic.com.

## Drag-and-drop in chat clients

When the user drag-drops a PDF (or any supported file) into a chat-style MCP host such as Claude Desktop, Cowork, or Cursor, the file lands in a host-owned sandbox directory the MCP server cannot read. The path the host then hands the agent (something like `/mnt/user-data/uploads/abc.pdf`) is meaningless to a separately-running `npx` MCP process, so `file_path` calls fail with a filesystem error.

`@talonic/mcp@0.1.4` and later solve this by accepting **`file_data`** (base64-encoded file bytes) and **`filename`** on `talonic_extract` and `talonic_to_markdown`. The agent reads the file bytes from the conversation, base64-encodes them, and passes them through the MCP tool call. The MCP server decodes, infers MIME type from the filename, and uploads to the Talonic API as a normal multipart request. The file never has to live on the MCP server's disk.

This works reliably in **local-stdio installs** (Claude Desktop, Cursor, Cline, Continue, Cowork) where the MCP server runs as an `npx` process spawned by the host and tool-call arguments are passed directly between agent and server.

### Caveat: Claude.ai connectors and hosted MCP

When the hosted MCP at `mcp.talonic.com/mcp` is added as a custom connector inside Claude.ai's web UI, **Claude.ai imposes a small hard limit on tool-call argument size** (effectively under ~1KB per parameter). A real PDF base64-encoded is hundreds of KB, so the `file_data` string is truncated before reaching the MCP server. The Talonic API receives a few hundred bytes, registers an empty document, and returns a successful-looking response with `null` extracted fields. The agent often misdiagnoses this as a server bug and goes into recovery loops.

This is a Claude.ai platform limit on connector tool-call payloads, not a Talonic MCP server bug. There is no workaround at the MCP layer.

Recommended paths for Claude.ai users with real files:

1. **`file_url`** — host the file at a publicly reachable URL (S3, Drive share with public read, GitHub raw, etc.) and pass the URL.
2. **`document_id`** — upload the file at https://app.talonic.com first, take the resulting document id, and pass it.
3. **Use a local-stdio install** instead of the hosted connector. Claude Desktop, Cursor, Cline, Continue, and Cowork all spawn the MCP server locally and have no parameter cap.

A future architectural fix is pre-signed upload URLs (a tool that returns a one-time HTTPS PUT target so agents can upload outside the MCP tool-call channel). Tracked as an engineering follow-up.

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
Make sure the `command` is `npx` and the `args` are exactly `["-y", "@talonic/mcp@latest"]`. As a sanity check, in any terminal run `npx -y @talonic/mcp@latest --version`; it should print a version number. If you are on an older `0.1.x` and see no output at all, you are hitting the silent-bin bug fixed in `0.1.3`; upgrade by setting the args to `["-y", "@talonic/mcp@latest"]` and restarting the client.

**`talonic_extract` returns a validation error when no schema is given.**
By design in v0.1. Schema-less extraction is unreliable, so the MCP layer rejects calls that omit both `schema` and `schema_id` before they reach the API. Provide either an inline `schema` (full JSON Schema recommended) or a `schema_id` from `talonic_list_schemas`.

**`talonic_extract` rejects with `unsupported_file_type`.**
The MIME type was inferred as `application/octet-stream`. The SDK infers from common file extensions; if your filename has an unusual extension, pass `content_type` explicitly to the SDK call (the MCP layer does not yet expose this; a future tool version will).

**`talonic_filter` returns no results when you expect data.**
Two common causes. First, the field has not been extracted yet: call `talonic_search` first, then look at `fields[]` and `fieldMatches[]` in the response. Only entries with `filterable: true` are usable with `talonic_filter`. Second, schema-typing mismatch: numeric operators (`gt`, `gte`, `lt`, `lte`, `between`) require the schema field to be typed as `number`. A field typed as `string` that holds numeric content silently returns zero. Re-design the schema with the right type and re-extract.

**`talonic_extract` returns empty fields when I drag a file into Claude.ai.**
Claude.ai's connector pipeline imposes a small hard limit on tool-call argument size (effectively under ~1KB). The base64-encoded PDF is truncated before reaching the MCP server, so the API receives a stub document and the extracted fields come back `null`. This is a Claude.ai platform limit on connector tool-call payloads, not a Talonic MCP server or API bug. Workaround: use `file_url` (publicly reachable URL), `document_id` (file already uploaded at app.talonic.com), or use a local-stdio install (Claude Desktop, Cursor, Cline, Continue, Cowork) which has no parameter cap. See "Drag-and-drop in chat clients" above.

**Tool descriptions look wrong in my client.**
Some MCP clients cache tool descriptions. Restart the client after a server update.

## Known limitations (v0.1)

- **Schema is required on `talonic_extract`.** Schema-less extraction is unreliable in v0.1 and is rejected at the MCP layer with a validation error. Always pass a `schema` (full JSON Schema recommended) or a `schema_id`.
- **Schema definition: prefer full JSON Schema.** The flat key-type map (`{ vendor_name: "string", ... }`) is documented as accepted, but if you get a "no fields" error from the API, fall back to:
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
- **Filter requires `filterable: true` fields.** Call `talonic_search` first; only entries in the response where `filterable: true` can be used as `field` (or `field_id`) on `talonic_filter`. Entries with `filterable: false` exist in the schema but have no extracted data yet.
- **Schema field type affects filter operators.** Numeric operators (`gt`, `gte`, `lt`, `lte`, `between`) only work on fields typed as `number` in the schema. Numeric values stored as strings (with currency symbols, locale formatting, etc.) silently return zero results. Type your schema fields appropriately at design time.
- **`is_not_empty` filter is not exposed in v0.1.** It underreports against fields known to be populated. Workaround: filter with `eq`/`gt`/`contains` against a known value, or use `is_empty` and invert the result client-side.
- **Drag-and-drop file uploads in Claude.ai are capped by Claude.ai's tool-call argument size limit.** A base64-encoded real PDF (typically hundreds of KB) cannot fit through Claude.ai's connector tool-call pipe (which truncates parameters under ~1KB). The Talonic API receives a few hundred bytes, registers an empty document, and returns a response with `null` extracted fields. This is a Claude.ai platform limit on connectors, not a Talonic MCP server bug. Workaround for Claude.ai users: use `file_url` (publicly reachable URL), `document_id` (file uploaded at app.talonic.com), or use a local-stdio install (Claude Desktop, Cursor, Cline, Continue, Cowork). The architectural fix is pre-signed upload URLs (engineering follow-up).
- **Cost, EUR price, and remaining balance are not surfaced.** The API does not return them in tool responses yet. Credit balance must be checked in the Talonic dashboard.

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

## Privacy Policy

This MCP server is a thin client. It does not collect, store, log, or transmit any data on its own. Every tool call is forwarded directly to the Talonic API at `api.talonic.com` using your `TALONIC_API_KEY`, and the API response is returned verbatim to the MCP client.

The server does not:

- Persist API keys, tool inputs, tool outputs, document contents, extracted data, or any other information beyond the lifetime of a single tool call.
- Send analytics, telemetry, crash reports, or usage metrics to Talonic, Anthropic, or any third party.
- Read or write files on your machine other than the file paths you explicitly pass to `talonic_extract` / `talonic_to_markdown` (`file_path`), and only for the duration of that call.

What Talonic itself does with the data you upload via this server is governed by Talonic's privacy policy at [https://talonic.com/privacy](https://talonic.com/privacy). In summary, Talonic processes documents you submit so it can perform OCR and structured extraction, stores results in your isolated workspace at `app.talonic.com`, and does not share workspace data with third parties. For data retention, deletion requests, and contact information, refer to that policy.

If you uninstall the MCP server (e.g. remove `@talonic/mcp` from your client config), all server-side state is in your Talonic workspace, not on this server. To delete that state, sign in to `app.talonic.com` and remove the documents and schemas via the dashboard, or revoke the API key the server was using.

For privacy questions specific to this MCP integration, contact `info@talonic.ai`.

## License

MIT (c) Talonic GmbH
