# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.35] - 2026-05-12

### Added

- **`/favicon.ico` and `/favicon.png`** served from the hosted MCP, inlined as base64 in `src/favicon.ts`. Required for the Claude Connectors Directory listing and for browser preview surfaces. `Content-Type: image/png` with a 24-hour `Cache-Control` header.
- **`SECURITY.md`** at the repo root. Disclosure policy with `safety@talonic.ai` as the primary channel, two-business-day acknowledgement target, ten-business-day substantive response, and a 30-day fix target for confirmed production-affecting issues. Coordinated-disclosure model with a safe-harbour clause.

### Changed

- Disclosure email switched from a placeholder to `safety@talonic.ai` after the mailbox was stood up.

## [0.1.34] - 2026-05-12

### Added

- **Origin-header allowlist** (`src/origin.ts`) on the hosted Streamable HTTP server. DNS-rebinding mitigation. Allows three Claude.ai variants (`https://claude.ai`, `https://claude.com`, `https://www.claude.ai`) plus four MCP-directory surfaces (Cursor Directory, Smithery, mcp.so, `registry.modelcontextprotocol.io`). Empty Origin passes through (native clients and server-to-server traffic). Unknown origins receive a structured 403.

## [0.1.33] - 2026-05-12

### Changed

- README "Available on" section lists Cursor Directory in the first position.

## [0.1.32] - 2026-05-11

### Changed

- `docs/sections.json` refreshed: content brought up to date with the post-OAuth surface, prettier drift across all sections cleared.

## [0.1.31] - 2026-05-11

### Changed

- Prettier re-run on `src/tools/filter.ts` after the `is_not_empty` re-addition in 0.1.29.

## [0.1.30] - 2026-05-10

### Added

- **`is_not_empty` filter operator re-exposed.** Checks the materialized-values index, which the upstream API now updates within seconds of extraction completing. For batch-mode extractions, results reflect data after the batch poll cycle applies. The `talonic_filter` tool description, troubleshooting docs, and README "Known limitations" section have all been updated to reflect the new behavior; the "intentionally not exposed in v0.1" caveat is gone.

### Changed

- `talonic_filter` description gains type-mismatch guidance to complement the existing SCHEMA TYPING block.

## [0.1.29] - 2026-05-10

### Fixed

- `talonic_search` outputSchema: `fieldMatches[].documentCount` and `fields[].documentCount` accept `null`, matching the API's response shape for entries with no materialised data.

## [0.1.28] - 2026-05-09

### Changed

- README reframed around the Claude.ai OAuth connector flow as the primary install path, with the API-key URL kept as an alternative for clients that cannot complete the OAuth handshake.

## [0.1.27] - 2026-05-08

### Changed

- `docs/sections.json` enriched with code examples; per-page content expanded to at least 4 paragraphs each, with a 6K-character target on tool pages. Improves SEO and gives the website's auto-generated docs more substance.

## [0.1.26] - 2026-05-08

### Changed

- `docs/sections.json` enrichment pass: every MCP doc section has at least four paragraphs. Foundation for the further expansion in 0.1.27.

## [0.1.25] - 2026-05-07

### Added

- **`talonic_get_balance`** tool. Wraps `GET /v1/credits/balance` from the API and returns the enriched balance (`balance_credits`, `balance_eur`, `burn_rate_30d_credits`, `projected_runway_days`, `tier`, `tier_resets_at`). Lets agents make budget-aware decisions before kicking off large batches. Tool count goes 7 → 8.
- **`cost` field on `talonic_extract` and `talonic_to_markdown` outputSchemas.** Surfaces the per-call cost (`costCredits`, `costEur`), post-call balance (`balanceCredits`), and the registry-vs-AI cell-resolution split (`cellsResolvedRegistry`, `cellsResolvedAi`). Parsed by `@talonic/node@0.1.10` from the API's `X-Talonic-Cost-*` and `X-Talonic-Balance-*` response headers and threaded through the SDK's `WithRateLimit<T>` wrapper. `null` on the `talonic_to_markdown` `document_id` path because no extract call runs there.

### Fixed

- Three QA-reported MCP `-32602 Output validation error` failures, all with the same shape: outputSchema declared a non-null string where the API legitimately returns `null`. Fixed and locked in with regression tests.
  - `talonic_list_schemas` and `talonic_save_schema`: `data[].description` / `description` accept `null`.
  - `talonic_extract` and `talonic_get_document`: `document.mime_type` / `mime_type` accept `null`.
  - `talonic_search`: `fields[].id` accepts `null` (set by the API for "schema-only" field entries that have not yet been materialized into the field-registry index).
- Hosted MCP root discovery `docs` URL was advertising `https://docs.talonic.com` (not a live subdomain). Now points at `https://talonic.com/docs/mcp`.
- `talonic_to_markdown` description now mirrors the Claude.ai parameter-cap warning from `talonic_extract` so chat clients and Claude.ai connector users get consistent guidance on `file_data`.
- Symlink test in `tests/server-symlink.test.ts` now skips with a console warning when `dist/server.js` is older than `package.json` (avoids confusing "expected '0.1.x' to contain '0.1.y'" failures during local dev).

### Changed

- Hosted MCP (`mcp.talonic.com`) is now token-rotation aware. The bearer token is extracted on every incoming MCP request and the SDK is rebuilt per request when the token changes; previously the credential was captured at session-init time and reused. Required for OAuth 2.1 access-token rotation across requests in the same session.
- `WWW-Authenticate: Bearer resource_metadata="..."` header on 401 responses, per RFC 9728. Lets OAuth clients (Claude.ai connector, MCP Inspector) discover the authorization server.
- `/.well-known/oauth-protected-resource` endpoint on the hosted MCP per RFC 9728. Advertises `https://api.talonic.com` as the authorization server and the three scopes the connector actually exercises (`extract:write`, `documents:read`, `schemas:read`).
- All seven existing tool registrations now take a `() => Talonic` getter rather than a `Talonic` instance. Internal refactor; no consumer-visible change beyond the OAuth token-rotation behaviour above.

## [0.1.16] - 2026-05-05

### Added

- `talonic_filter` description gains a SCHEMA TYPING block: numeric operators (`gt`, `gte`, `lt`, `lte`, `between`) only resolve correctly when the schema field is typed as `number`. String-typed fields holding numeric content silently return zero matches. Surfaced during the v1 audit and worth flagging at the tool layer so agents avoid the trap.

### Changed

- `Known Limitations` section in `src/content/sections/troubleshooting.ts` rewritten to reflect the post-engineering-fix state. Removed the now-stale "per-field provenance not surfaced" entry (engineering shipped `include_provenance` in 0.1.14). Added entries for `filterable: true` discoverability, schema-type-vs-operator compatibility, and the drag-and-drop file-upload stall in Claude.ai's hosted-MCP path (workaround: use `file_url` or `document_id`, or use the local stdio install).
- Filter callout in `src/content/sections/tools.ts` updated to highlight the `filterable: true` requirement alongside the `is_not_empty` caveat.

## [0.1.15] - 2026-05-05

### Changed

- Prettier-formatted `src/tools/extract.ts` after the 0.1.14 description update.

## [0.1.14] - 2026-05-05

### Added

- `include_provenance` parameter on `talonic_extract`. When true, response includes per-field source evidence (`source_text`, `section`, `page`) showing where each value was found in the document. Closes the long-standing "provenance not surfaced" gap.

### Changed

- Search and filter tool descriptions further refined for the `filterable` flag pattern; FAQ in `docs/sections.json` updated.

## [0.1.13] - 2026-05-04

### Changed

- `talonic_filter` and `talonic_search` descriptions updated to reflect the upstream API addition of a `filterable` boolean on `fields[]` and `fieldMatches[]` in search responses. Agents are now guided to only use `filterable: true` entries with `talonic_filter`, avoiding the silent zero-result queries that previously came back from non-materialized fields.

## [0.1.12] - 2026-05-04

### Added

- New top-level `agent-decision-guide` section in `src/content/sections/overview.ts`, mirrored as an `Agent decision guide` block in the README. Five sub-sections covering when to use which tool, confidence and human-review handling, and when not to call Talonic at all. FAQ entries for SEO ingestion.
- Complete tool-input-and-response examples for all 7 tools in `src/content/sections/tools.ts`, including the previously-missing response block on `talonic_extract` with `schema_id`.

### Changed

- `talonic_extract` response example shape aligned with the SDK's canonical `confidence: { overall, fields }` form.

## [0.1.11] - 2026-05-04

### Added

- MCP-layer validation guard on `talonic_extract`. Calls without `schema` or `schema_id` are rejected fast with a clear validation error before reaching the API. Schema-less extraction is no longer reachable through the MCP layer in v0.1; agents get a clean error rather than slow opaque API failures or silently empty results.
- `talonic_extract` response shape documented in the tool description: `confidence.overall`, `confidence.fields`, `document.*`, `extraction_id`, `request_id`, `processing.*`. Explicit notes about what is not surfaced in v0.1 (cost, EUR price, balance, per-field provenance, since updated by the 0.1.14 release for provenance).
- `STATUS: stable` line at the top of every tool description.
- New `validationError` helper in `src/tools/_shared.ts` for fast-fail input checks.

### Changed

- `talonic_extract` description: SCH- caveat removed (the upstream API now accepts both UUID and `SCH-XXXXXXXX` short ids on `/v1/extract`).
- `talonic_filter`: `is_not_empty` removed from the operator enum and `FilterArgs` union. The description has a NOT SUPPORTED IN v0.1 section with workarounds (`eq`/`gt`/`contains` against a known value, or `is_empty` then invert client-side).
- `talonic_to_markdown` internal `INGEST_ONLY_SCHEMA` replaced from `{}` to a minimal valid JSON Schema (single throwaway `document_title` field). Keeps the internal ingest call off the unreliable schema-less path that the MCP layer now blocks.
- README install section recommends version pinning for production, with a note about API key handling.
- `talonic_list_schemas` description mentions `short_id` (SCH-XXXXXXXX) returned alongside the UUID.

## [0.1.10] - 2026-05-03

### Added

- Webhooks reference resource (`talonic://webhooks/reference`). Aggregates four webhook info endpoints (events, delivery behavior, signature verification algorithms, retry policy) into a single resource so agents can look these up without leaving the MCP context.
- Root endpoint (`/`) on the hosted Streamable HTTP server returns a service-discovery JSON payload with name, version, MCP endpoint, health endpoint, auth pattern, and docs link.
- `docs/sections.json` and platform-docs sync workflow: every documentation change in `src/content/sections/` flows automatically into the website at publish time, becoming SEO-friendly doc pages.
- Complete working examples for all 7 MCP tools in `src/content/sections/tools.ts` (input + response).
- Hosted MCP install snippets added to all six client install pages (Claude Desktop, Cursor, Cline, Continue, Cowork, generic), leading with the hosted option.

### Changed

- `src/version.ts` derives the version from `package.json` at build time instead of being hardcoded, with a smoke test that asserts they match.
- Comprehensive rewrite of `docs/sections.json` to reflect the v0.1.10 surface.

### Fixed

- Strict null-check warning in `src/content/helpers.ts`.
- `install.ts` type errors in the content layer.

## [0.1.9] - 2026-05-02

### Fixed

- Session persistence for the Streamable HTTP transport. Per-session state (transport + MCP server) is now keyed by the `Mcp-Session-Id` header generated at `initialize` time, so multi-call agents on the hosted endpoint maintain context across requests instead of starting a fresh session per call.

## [0.1.8] - 2026-05-02

### Fixed

- Railway deployment now uses the correct entry point (`dist/http-server.js`) for the hosted Streamable HTTP server.

## [0.1.7] - 2026-05-01

### Added

- **Hosted Streamable HTTP transport.** New `src/http-server.ts` entry point hosts the same MCP server over HTTP for remote clients. Two auth modes: `Authorization: Bearer tlnc_...` header or `?apiKey=tlnc_...` query parameter. Designed for deployment on Railway behind `mcp.talonic.com`. The local `npx -y @talonic/mcp@latest` stdio install remains the recommended path for local-development clients (Claude Desktop, Cursor, Cline, Continue, Cowork); the hosted endpoint becomes the recommended path for chat clients that don't run local processes (Claude.ai connectors, etc.).
- New `src/server-factory.ts` shared `createServer()` so stdio and HTTP entries register the same 7 tools and 2 resources.
- `Dockerfile` and `railway.toml` for one-step Railway deploys.
- `/health` healthcheck endpoint.
- `/content` export from `package.json` so the website can consume the structured docs payload.

### Changed

- README: "Hosted MCP" install path mentioned as a primary option for Claude.ai users (URL plus apiKey query parameter pattern).

## [0.1.6] - 2026-04-30

### Added

- `mcpName` field in `package.json` set to `io.github.talonicdev/talonic-mcp`. This is the verification marker the official MCP Registry uses to confirm that a registry entry's npm package matches its claimed identity.

## [0.1.5] - 2026-04-30

### Changed

- `@talonic/node` dependency bumped to `^0.1.3`. Picks up the SDK refactor that drops local field-name pre-resolution; canonical names like `vendor.name` are now passed straight through to the API for server-side resolution.
- `talonic_filter` description: documents that the API now resolves canonical field names server-side, and flags that `is_not_empty` currently underreports.
- `talonic_extract` description: re-introduces the flat key-type map as an accepted schema format with a fallback note (the API documents it; if normalisation fails, the agent should retry with full JSON Schema).
- `talonic_save_schema` description: same treatment as `talonic_extract`, plus mention that responses include `short_id` (e.g. `SCH-XXXXXXXX`) alongside the UUID.

### Fixed in upstream API (no MCP change required)

- `file_data` multipart uploads to `/v1/extract` no longer return `422 No document text available`.
- Error responses from `/v1/extract`, `/v1/schemas`, and `/v1/documents/filter` now include `request_id` and a useful `message`.
- `/v1/schemas/:id` accepts both UUIDs and `SCH-XXXXXXXX` short ids; responses include the `short_id` field.

### Known issues (still open at upstream)

- Schema flat-map normalisation rejects valid flat-map definitions with "Schema definition produced no fields" despite advertising the format. Workaround: send full JSON Schema.
- `is_not_empty` filter operator returns empty results for fields known to be populated.
- `/v1/extract` `schema_id` does not accept the SCH- short form yet; UUID required.

## [0.1.4] - 2026-04-29

### Added

- `file_data` (base64-encoded bytes) and `filename` inputs on `talonic_extract` and `talonic_to_markdown`. Lets agents pass uploaded files to Talonic when running inside chat-style MCP hosts (Claude Desktop, Cowork, Cursor) where the host's user-data directory is not readable by the MCP server process. Tool descriptions advertise `file_data` as the recommended path for chat clients.
- Tests covering `file_data` decoding, MIME inference from `filename`, and rejection of multiple file sources.

### Changed

- `talonic_extract` description: clarified when each file source is appropriate. `file_data` is the recommended path for chat clients; `file_path` only works when the MCP server has filesystem access to that path; `file_url` is for documents already on the public web; `document_id` re-extracts an existing workspace document.
- `talonic_to_markdown` description: added `file_data` + `filename` to the input list with the same chat-client guidance.
- `talonic_extract` description no longer recommends the flat key-type schema map; recommends full JSON Schema only (the flat map is silently empty-saved by the API; tracked separately).

## [0.1.3] - 2026-04-29

### Fixed

- MCP server bin (`talonic-mcp`) no longer exits silently when launched through the npm-managed `node_modules/.bin/` symlink, which is the path every MCP client uses (Claude Desktop, Cursor, Cline, Cowork) when they spawn the server via `npx -y @talonic/mcp@latest`. The auto-run guard previously compared `import.meta.url` to `file://${process.argv[1]}` as strings; the two disagree when reached via a symlink, so `main()` never ran, the stdio handshake never happened, and the server exited with code 0. The guard now resolves both sides with `fs.realpathSync` before comparing, so the server boots correctly regardless of how it is invoked.

### Added

- Regression test (`tests/server-symlink.test.ts`) that spawns the bundled server through a symlink and asserts `--version` prints `SERVER_NAME` and `VERSION`. Catches future regressions of the auto-run guard before publish.

### Changed

- `@talonic/node` dependency bumped to `^0.1.2` to pull in the matching SDK fix for the same bug in the SDK CLI bin.

## [Unreleased prior to 0.1.3]

### Added

- Project skeleton: TypeScript strict mode, `tsup` ESM build with shebang banner, Vitest, GitHub Actions CI matrix on Node 18, 20, 22.
- Stdio MCP server built on `@modelcontextprotocol/sdk` and `@talonic/node`.
- Seven tools registered: `talonic_extract`, `talonic_search`, `talonic_filter`, `talonic_get_document`, `talonic_to_markdown`, `talonic_list_schemas`, `talonic_save_schema`.
- One resource registered: `talonic://schemas` (browseable list of saved schemas).
- Field-name resolution in `talonic_filter`: pass human-readable field names; the SDK resolves them to internal field IDs via `/fields/autocomplete`.
- README with install snippets for Claude Desktop, Cursor, Cline, Continue, and Cowork.
- MIT license.
