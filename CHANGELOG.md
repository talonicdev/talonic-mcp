# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
