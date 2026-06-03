# @talonic/mcp

**Official Talonic MCP server.** Give any AI agent the ability to extract structured, schema-validated data from any document — PDFs, scans, invoices, contracts, forms — via the [Model Context Protocol](https://modelcontextprotocol.io).

[![talonic-mcp MCP server](https://glama.ai/mcp/servers/talonicdev/talonic-mcp/badges/score.svg)](https://glama.ai/mcp/servers/talonicdev/talonic-mcp)
[![smithery badge](https://smithery.ai/badge/talonic/talonic)](https://smithery.ai/servers/talonic/talonic)

> **Status:** stable, listed on the [official MCP Registry](https://registry.modelcontextprotocol.io/) as `io.github.talonicdev/talonic-mcp`. **Nine tools and two resources**, verified end-to-end against production (including the Claude.ai hosted connector). Runs as a local stdio process for desktop/IDE clients and as a hosted Streamable HTTP server at `mcp.talonic.com` for Claude.ai connectors.

---

## What you get

One install gives an agent the whole document-extraction workflow:

| Tool | What it does |
| --- | --- |
| **`talonic_extract`** | Extract schema-validated JSON from a document, with per-field confidence scores. The primary tool. |
| **`talonic_request_upload`** | Get a browser upload link for files too large to pass through a hosted connector (e.g. Claude.ai). The robust path for real-world documents. |
| **`talonic_to_markdown`** | OCR a document to clean markdown. |
| **`talonic_search`** | Omnisearch across documents, fields, sources, and schemas. |
| **`talonic_filter`** | Filter documents by extracted field values (`eq`, `gt`, `between`, `contains`, …). |
| **`talonic_get_document`** | Fetch a document's metadata, processing status, and links. |
| **`talonic_list_schemas`** | List saved schemas (with definitions). |
| **`talonic_save_schema`** | Save a reusable schema to the workspace. |
| **`talonic_get_balance`** | Read credit balance, EUR value, burn rate, and runway for budget-aware behaviour. |

Plus two resources for clients that browse them (Claude Desktop, Cowork render these in-UI):

- **`talonic://schemas`** — the saved-schemas list.
- **`talonic://webhooks/reference`** — webhook event types, delivery semantics, signature verification, and retry policy.

Every tool description is written for an LLM, with explicit **USE WHEN / DO NOT USE WHEN** guidance, so agents pick the right tool without extra prompting.

## Why use it

When an agent needs structured data out of a PDF, scan, or messy document, the usual approach is raw OCR plus an LLM call — and the results drift: tables get mangled, dates get misread, totals come out wrong. `talonic_extract` instead returns **schema-validated JSON with per-field confidence scores**, a detected document type, and stable IDs for follow-up calls. The full pipeline (upload → OCR → extraction → validation) runs server-side in one request.

---

## Quick start

### 1. Get an API key (30 seconds)

Each user runs against their own isolated Talonic workspace — your documents and schemas are private to you.

1. Sign up at **[app.talonic.com](https://app.talonic.com)** — free tier, 50 extractions/day, no credit card.
2. Settings → API Keys → **Create New Key**.
3. Copy the `tlnc_…` value into your MCP client config (snippets below).

> **You don't need an API key for Claude.ai.** The hosted connector uses [OAuth](#claudeai-hosted-connector) — Claude.ai handles auth via PKCE and stores its own short-lived tokens. The API key is only needed for **local-stdio installs** (Claude Desktop, Cursor, Cline, Continue, Cowork) and the API-key URL fallback.

### 2. Install

Every local client launches the server the same way — a one-line `npx` invocation with your key in the `env` block. No clone, no build:

```jsonc
{
  "command": "npx",
  "args": ["-y", "@talonic/mcp@latest"],
  "env": { "TALONIC_API_KEY": "tlnc_..." }
}
```

**Version pinning.** `@latest` is fine for trying things out. For production and CI, pin a version (e.g. `@talonic/mcp@0.1.52`) so a release can't silently change tool descriptions, validation rules, or response shapes your agent depends on. Bump the pin after reviewing the [CHANGELOG](CHANGELOG.md).

---

## Client setup

<details>
<summary><strong>Claude Desktop</strong></summary>

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "talonic": {
      "command": "npx",
      "args": ["-y", "@talonic/mcp@latest"],
      "env": { "TALONIC_API_KEY": "tlnc_your_key_here" }
    }
  }
}
```

Fully restart Claude Desktop (Cmd+Q on macOS — not just close the window). Talonic appears in the connected-servers list with all nine tools.
</details>

<details>
<summary><strong>Cursor</strong></summary>

Edit `~/.cursor/mcp.json` (or Cursor settings → MCP → edit config):

```json
{
  "mcpServers": {
    "talonic": {
      "command": "npx",
      "args": ["-y", "@talonic/mcp@latest"],
      "env": { "TALONIC_API_KEY": "tlnc_your_key_here" }
    }
  }
}
```
</details>

<details>
<summary><strong>Cline (VS Code)</strong></summary>

Open the Cline panel → settings (gear) → MCP Servers → Edit. Add the entry above. Save and restart the panel.
</details>

<details>
<summary><strong>Continue (VS Code / JetBrains)</strong></summary>

Edit `~/.continue/config.json`, add to the `mcpServers` array:

```json
{
  "name": "talonic",
  "command": "npx",
  "args": ["-y", "@talonic/mcp@latest"],
  "env": { "TALONIC_API_KEY": "tlnc_your_key_here" }
}
```
</details>

<details>
<summary><strong>Cowork</strong></summary>

Open Cowork settings → MCP Servers → Add. Use the same shape as Claude Desktop above.
</details>

### Claude.ai (hosted connector)

Claude.ai's "Add custom connector" flow uses a remote MCP URL instead of a local process. We host one at `mcp.talonic.com`. **OAuth is the recommended path** — no API key in the config.

**Recommended — OAuth (no API key):**

1. Open [claude.ai/settings/connectors](https://claude.ai/settings/connectors) → **Add custom connector**.
2. URL: `https://mcp.talonic.com/mcp` (no query string, no headers).
3. Click **Connect** → you're redirected to Talonic → sign in (Google, Microsoft, or SSO).
4. Approve the consent screen (scopes: `extract:write`, `documents:read`, `schemas:read`). Pick a workspace if you have multiple.
5. You're returned to Claude.ai. All nine tools appear.

The flow uses PKCE (RFC 7636) and dynamic client registration (RFC 7591). Claude.ai stores a 1-hour access token + 30-day refresh token and refreshes automatically. No API key ever touches the connector config or any URL. Revoke by removing the connector or revoking the OAuth client in your Talonic dashboard.

**Alternative — API key in URL** (firewalled environments, automation, static credential):

```
https://mcp.talonic.com/mcp?apiKey=tlnc_your_key_here
```

Trade-off: the key is persisted in Claude.ai's connector store and may appear in Anthropic-side logs. Rotate it if you remove or share the connector.

> **Uploading files in Claude.ai?** Use [`talonic_request_upload`](#file-uploads-the-browser-handoff-flow) — see the next section. Dragging a real file straight into the chat does **not** work through hosted connectors (a platform limit, explained below).

---

## File uploads: the browser-handoff flow

This is the most important thing to understand about running Talonic inside a **hosted connector** (Claude.ai web, ChatGPT).

### The constraint

Hosted AI platforms cap the size of a single tool-call argument. On Claude.ai the effective ceiling is **~32 KB of decoded payload (~43 KB of base64)** — measured directly against production. A real PDF is hundreds of KB to several MB, so passing it as base64 `file_data` gets **silently truncated**: the server receives a clean-but-incomplete prefix, the API registers a stub document, and extraction returns `null` fields. The agent never sees the truncation. Separately, the agent's sandbox **cannot upload the bytes out-of-band** either — egress is allowlisted, so a direct `PUT` to storage is blocked.

These are deliberate, structural properties of hosted/sandboxed agent platforms — not a Talonic bug, and not something we can configure away. The same limits apply to ChatGPT connectors and similar surfaces.

### The solution: `talonic_request_upload`

Route the file transfer onto the **user's own browser**, which has neither the tool-call cap nor the egress allowlist:

```
1. Agent calls  talonic_request_upload(filename)
       → { document_id, upload_url: "https://app.talonic.com/u/<token>", expires_at }
2. Agent shows the upload_url to the user.
3. User opens it in a browser tab and drops the file.
4. Agent polls  talonic_get_document(document_id)  until status === "completed".
5. Agent calls  talonic_extract(document_id, schema)  — structured data comes back.
```

Cost to the user: one click. It's the same pattern as a Slack/Stripe "open in browser" link, and it works on every hosted agent. **Verified end-to-end in production Claude.ai.**

> **For the agent:** a user saying "done" or "uploaded" only confirms the *browser-side* upload finished — server-side OCR + processing take another ~10–30 s. Poll `talonic_get_document` until `status` is `"completed"` before calling `talonic_extract`. Calling early returns errors that look like the file is missing. (The tool descriptions enforce this; you generally don't need to prompt for it.)

### When you don't need it

- **Local-stdio installs** (Claude Desktop, Cursor, Cline, Continue, Cowork) have **no tool-call cap**. Drop a file in and the agent passes `file_data` directly — `talonic_request_upload` isn't needed.
- The file is already at a **public URL** → pass `file_url` to `talonic_extract`.
- The file was already uploaded at app.talonic.com → pass its `document_id`.

---

## Agent decision guide

Pick the right tool before calling — the wrong one returns the wrong data, costs credits, and slows the conversation.

**User has a file**

- Local client (Desktop, Cursor, …), small-to-medium file → `talonic_extract` with `file_data` + `filename`.
- Hosted connector (Claude.ai) → `talonic_request_upload`, then poll, then `talonic_extract` by `document_id`. (See [browser-handoff](#file-uploads-the-browser-handoff-flow).)
- File is at a public URL → `talonic_extract` with `file_url`.
- They want specific fields → pass a `schema` or `schema_id`. They want full text → `talonic_to_markdown`. Both → `talonic_extract` with `include_markdown: true`.

**User is asking about existing documents**

- Conceptual/fuzzy ("any docs about indemnification") → `talonic_search`.
- Value-based ("invoices over 1000 EUR") → `talonic_filter`.
- They reference a `document_id` → `talonic_get_document` (metadata), `talonic_to_markdown` (text), or `talonic_extract` (re-extract with a new schema). Re-using a `document_id` is cheaper than re-uploading.

**Working with schemas**

- One-off → pass the schema inline. Reused across many docs → `talonic_save_schema` once, then `talonic_extract` with `schema_id`. Discover existing → `talonic_list_schemas`.

**Confidence & human review**

- `confidence.overall` < ~0.7 → tell the user the extraction may be unreliable; surface low-confidence fields; confirm before downstream actions.
- Per-field confidence < ~0.7 → mark "needs review"; don't use silently in calculations or external calls.
- Critical fields (amounts, legal terms, names, dates) → confirm with the user even at high confidence.
- Need to cite sources? Pass `include_provenance: true` for per-field page/section/source-text.

**When *not* to call Talonic**

- General-knowledge or chat questions — don't pre-emptively extract.
- The data is already in the conversation from a prior call — reuse it.
- For cost/balance questions → `talonic_get_balance`. Per-call cost is on every `talonic_extract` / `talonic_to_markdown` response under `cost`.

---

## How it works

```
Agent (Claude Desktop / Cursor / Claude.ai / …)
  │  MCP protocol — stdio (local) or Streamable HTTP (hosted)
  ▼
Talonic MCP server (this package)
  │  HTTPS, Bearer auth (API key or OAuth token)
  ▼
api.talonic.com
```

Each tool call is one HTTP request to the Talonic API. The server handles auth, retries on transient failures (429, 5xx), MIME-type detection, multipart serialisation, and structured error formatting. It is a thin, stateless client — see [Privacy](#privacy).

## Configuration

Set via the `env` block in your MCP client config:

| Variable | Required | Description |
| --- | --- | --- |
| `TALONIC_API_KEY` | yes (local installs) | Your Talonic API key. Starts with `tlnc_`. Not needed for Claude.ai OAuth. |
| `TALONIC_BASE_URL` | no | Override the API base URL. Default: `https://api.talonic.com`. |

---

## Troubleshooting

**`Error: TALONIC_API_KEY environment variable is required.`**
The `env` block is missing or unread. Check the JSON shape, then fully restart the client (not just the conversation).

**Talonic doesn't appear in the connected-servers list.**
Confirm `command` is `npx` and `args` are exactly `["-y", "@talonic/mcp@latest"]`. Sanity check in a terminal: `npx -y @talonic/mcp@latest --version` should print a version.

**`talonic_extract` returns a validation error with no schema.**
By design. Schema-less extraction is unreliable, so the MCP layer rejects calls missing both `schema` and `schema_id`. Provide an inline `schema` (full JSON Schema recommended) or a `schema_id` from `talonic_list_schemas`.

**Dragging a file into Claude.ai gives empty/`null` fields.**
The hosted-connector tool-call cap (~32 KB) truncated `file_data`. Use [`talonic_request_upload`](#file-uploads-the-browser-handoff-flow) — the browser-handoff flow is the supported path. Local-stdio installs are unaffected.

**`talonic_request_upload` worked but `talonic_extract` errors right after.**
You extracted before processing finished. Poll `talonic_get_document` until `status === "completed"`, then extract. A user's "done" only means the browser upload landed, not that OCR is done.

**`talonic_filter` returns nothing when you expect data.**
Two causes: (1) the field isn't extracted/filterable yet — call `talonic_search` and check `filterable: true`; (2) schema-typing — numeric operators (`gt`, `gte`, `lt`, `lte`, `between`) need the field typed as `number`. A `string` field holding numeric content silently returns zero. Gate on `field.dataType === "number"` (from `talonic_search`) before constructing numeric filters.

**Tool descriptions look stale after an update.**
Some clients cache tool lists. For Claude.ai, remove and re-add the connector. For local clients, restart.

---

## Known limitations (v0.1)

- **Schema is required on `talonic_extract`.** Schema-less extraction is rejected at the MCP layer. Pass a `schema` (full JSON Schema recommended) or `schema_id`. If a flat key-type map (`{ vendor_name: "string" }`) yields a "no fields" error, use full JSON Schema:
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
- **Hosted-connector tool-call cap (~32 KB).** Real files can't pass through `file_data` on Claude.ai/ChatGPT — use [`talonic_request_upload`](#file-uploads-the-browser-handoff-flow). Local installs are unaffected.
- **Filter requires `filterable: true` fields.** Call `talonic_search` first; only entries with `filterable: true` are usable on `talonic_filter`.
- **Numeric filter operators need `number`-typed fields.** Numbers stored as strings (currency symbols, locale formatting) silently return zero. Type schema fields appropriately at design time; gate on `dataType` at query time.
- **Per-call cost is extract-only.** `talonic_extract` and `talonic_to_markdown` (file-input path) return a `cost` block (`costCredits`, `costEur`, `balanceCredits`, `cellsResolvedRegistry`, `cellsResolvedAi`) from the API's `X-Talonic-Cost-*` headers. Read tools don't consume credits and carry no `cost`; `talonic_to_markdown` on the `document_id` path returns `cost: null`. For balance any time → `talonic_get_balance`.

---

## Develop

```bash
git clone https://github.com/talonicdev/talonic-mcp.git
cd talonic-mcp
npm install
npm run build
npm test
node dist/server.js --version
```

Contributing to docs or adding a tool? Read [`AGENTS.md`](AGENTS.md) and [`docs/architecture/docs-pipeline.md`](docs/architecture/docs-pipeline.md) first — there are two parallel docs surfaces and it's easy to edit the wrong one.

## Privacy

This MCP server is a thin client. It does **not** collect, store, log, or transmit any data on its own. Every tool call is forwarded directly to `api.talonic.com` using your credential, and the response is returned verbatim. The server does not persist API keys, inputs, outputs, or document contents beyond a single tool call; sends no analytics or telemetry; and reads/writes files only at the `file_path` you explicitly pass, only for that call's duration.

What Talonic does with uploaded data is governed by [talonic.com/privacy](https://talonic.com/privacy): documents are processed for OCR + extraction, results live in your isolated workspace at app.talonic.com, and workspace data is not shared with third parties. To delete state, remove documents/schemas in the dashboard or revoke the API key. Privacy questions specific to this integration: `info@talonic.ai`.

## License

MIT © Talonic GmbH
