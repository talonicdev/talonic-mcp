# Tool Descriptions Rewrite — Design Spec

**Date:** 2026-06-09
**Goal:** Make the agent-facing tool descriptions stronger and tighter so models (ChatGPT especially) pick the right Talonic tool, call it confidently, chain by-name lookups automatically, and fill arguments correctly on the first try.

## Problem

The descriptions agents read are the `DESCRIPTION` constants + `inputSchema` `.describe()` text in `src/tools/*.ts`, plus the server-level `instructions` in `src/server-factory.ts`. (The website docs under `src/content/` and `docs/sections.json` are human-only and are NOT read by agents.)

Two observed failure modes:
1. **Hedging / "tool not available."** The model says things like "the markdown tool isn't currently exposed in the active tool set" and refuses to call a tool until pushed. (Partly a runtime/session issue — addressed by the stateless transport fix — but the verbose, caveat-heavy descriptions also make the model cautious.)
2. **No auto-chaining by name.** Given "show markdown for bank-statement.pdf," the model should `search` → resolve `document_id` → call the tool. Instead it stalls or asks for an id.

Current descriptions are also very long (extract ≈ 50 lines) and carry hosted-environment warnings (Claude.ai ~32 KB arg cap, etc.) that add noise and arguably feed the hedging.

## Non-goals

- No handler/logic changes. Strings only (`DESCRIPTION`, `inputSchema` describes, server `instructions`).
- No change to tool names, parameters, annotations, or output schemas.
- No website-docs (`src/content/`) changes in this pass.

## Design

### Lever 1 — Server-level instructions (applies to all 9 tools)

Rewrite the `instructions` string passed to `new McpServer(...)` in `server-factory.ts` to assert callability and auto-chaining:

> "Talonic turns any document (PDF, scan, image, DOCX, contract, invoice, form, certificate, statement) into clean, schema-validated JSON, and answers questions about the user's document workspace. These tools are LIVE and callable in this session — when a request matches a tool, call it directly. Never tell the user a Talonic tool is unavailable, and never ask them to 'enable' or 'turn on' anything. If the user refers to a document by name (e.g. 'invoice.pdf'), first call `talonic_search` to resolve the name to a `document_id`, then call the tool you need with that id — do not ask the user for an id. Prefer acting over explaining."

This is the highest-leverage change for the hedging + chaining behavior.

### Lever 2 — Uniform tight per-tool template

Replace each `DESCRIPTION` block with:

```
<One-line WHAT, action-first>.
USE WHEN: <1–2 concrete triggers>.
NOT FOR: <nearest wrong tool → redirect>.
BY NAME: <doc tools only> if given a filename, call talonic_search first for the document_id, then call this.
ARGS: <key/required args; mutually-exclusive notes>.
RETURNS: <key fields>.
```

Target ~6–10 lines. **Load-bearing constraints are preserved** (see table). Cut: verbose hosted-environment warnings, repetition, and prose that doesn't change a decision. Essential caveats move into the relevant parameter `.describe()`.

### Lever 3 — Per-parameter `.describe()` trim

Each `inputSchema` field states type + required/optional + any mutual-exclusion crisply. Drop multi-sentence warnings; keep the one fact the model needs to fill the arg.

### Per-tool content (load-bearing items MUST survive)

| Tool | One-line WHAT | NOT FOR → redirect | BY NAME | Load-bearing to keep |
|---|---|---|---|---|
| `talonic_extract` | Extract schema-validated fields from a document | full text → `to_markdown`; finding docs → `search`/`filter` | yes | **schema required** (inline `schema` OR `schema_id`, exactly one); file source is exactly one of `document_id`/`file_url`/`file_data`(+`filename`) |
| `talonic_to_markdown` | Get the OCR markdown text of a document | specific fields → `extract` | yes | prefer `document_id`; file-input path ingests + consumes credits |
| `talonic_get_document` | Fetch a document's metadata + processing status | text → `to_markdown`; fields → `extract` | yes | status lifecycle values for polling after `request_upload` |
| `talonic_search` | Find documents/fields/schemas/sources by concept or name | field-value filters → `filter` | n/a (it IS the resolver) | only `filterable: true` fields work in `filter`; returns multiple entity types |
| `talonic_filter` | Find documents by extracted field-value conditions | concept/text search → `search` | n/a | exactly one of `field`/`field_id`; numeric ops need `dataType: number`; surface `warnings[]` |
| `talonic_list_schemas` | List saved schemas (compact summaries) | — | n/a | full field definitions via `talonic://schemas` resource |
| `talonic_save_schema` | Save a reusable schema | one-off inline extract → `extract` | n/a | `name` + `definition` required |
| `talonic_get_balance` | Read credit balance, tier, burn, runway | per-call cost → on `extract` response | n/a | — |
| `talonic_request_upload` | Get a browser upload link for a new file | file already in workspace → `document_id`; public URL → `file_url` on `extract` | n/a | poll `get_document` until `status: completed`, THEN `extract` |

## Testing

- All existing tests must pass (handlers, annotations, schemas unchanged).
- Add lightweight description-contract tests (e.g. `tests/tools/descriptions.test.ts`): for each registered tool, assert its `description` is non-empty, under a length budget (e.g. ≤ 1200 chars), and contains its redirect cue ("NOT FOR") and — for the doc tools — the "search" chaining cue. Assert the server `instructions` contains the "call directly" + "resolve the name" phrasing.
- Typecheck + prettier clean.

## Rollout

- One deploy (push to `main` → CI publishes + redeploys `mcp.talonic.com`).
- **After deploy, the connector must be reconnected** for ChatGPT to re-fetch `tools/list` (it caches descriptions at connect time).
- Wording reduces hedging; the already-shipped stateless transport is what makes tools reliably callable. Both are needed.

## Out of scope / follow-up

- Aligning the website MCP docs (`src/content/sections/tools.ts`) to the new tone — separate pass; agents don't read it.
