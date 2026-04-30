# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
