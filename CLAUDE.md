# Agent Orientation — `talonic-mcp`

This is the Talonic MCP server: a Node package (`@talonic/mcp`) that runs an MCP server over stdio for local installs and over Streamable HTTP at `mcp.talonic.com` for hosted connectors.

## ⚠ Read this before touching docs content

This repo carries **two parallel docs surfaces** that feed *different* parts of `talonic.com/docs/*`:

- `src/content/sections/*.ts` → `@talonic/mcp/content` → renders **`talonic.com/docs/mcp/*`**
- `docs/sections.json` → `@talonic/docs` (via platform repo sync) → renders **`talonic.com/docs/{sdk,api,platform}/*`**, **NOT `/docs/mcp/`**

If you update the wrong one your change will silently never appear on the user-visible page. The full architecture, the four-file checklist for adding a new MCP tool, the failure-mode table, and the CI token map are in **[`docs/architecture/docs-pipeline.md`](docs/architecture/docs-pipeline.md)**. Read it before any non-trivial doc change.

## Quick commands

```bash
npm test                # vitest, must pass before pushing
npm run typecheck       # tsc --noEmit
npm run format:check    # prettier
npm run format          # prettier --write
npm run build           # tsup → dist/{index.js, server.js, http-server.js, content.js}
npm run start:http      # local hosted-MCP server on :3000
```

## CI

`.github/workflows/publish.yml` runs on push to `main` for changes under `src/**`, `docs/**`, or `package.json`. The chain is:

1. **Docs-drift guard** — fails if `src/tools/**`, `src/http-server.ts`, `src/server-factory.ts`, or `src/resources/**` changed without `docs/sections.json`. Opt out with `[skip docs]` in any commit message in the push *only* for genuinely-non-doc-affecting changes (refactors, internal-only fixes, CI infrastructure).
2. Build, test, auto-bump patch version, sync `server.json`.
3. Publish to npm (`NPM_TOKEN`).
4. Publish to the MCP Registry (`mcp-publisher`, GitHub OIDC).
5. Create GitHub Release (`gh release create`, idempotent tag-exists check).
6. Fire `repository_dispatch` events to `talonicdev/website` and `talonicdev/platform`.

Manual trigger: `gh workflow run publish.yml -r main` (safety valve, useful after a secret rotation or when the auto-trigger queue is stuck).

⚠ The docs-drift guard watches `docs/sections.json`, which feeds the **SDK/API/Platform** docs surface, **not** the MCP docs page. Updates to `src/content/sections/*.ts` are NOT enforced by any guard today — discipline + [`docs/architecture/docs-pipeline.md`](docs/architecture/docs-pipeline.md) are the only enforcement.

## Source layout (where code lives)

- `src/index.ts` — main library entry; exports `createServer`, `SERVER_NAME`, `VERSION`.
- `src/server.ts` — stdio entrypoint (`npx @talonic/mcp`).
- `src/http-server.ts` — Streamable HTTP entrypoint for `mcp.talonic.com`. Serves MCP at both `/` and `/mcp` (root routing fix shipped 0.1.37). OAuth 2.1 protected-resource metadata at `/.well-known/oauth-protected-resource`.
- `src/server-factory.ts` — `createServer()` factory used by both entrypoints.
- `src/tools/*.ts` — one file per MCP tool (`extract`, `search`, `filter`, `get-document`, `to-markdown`, `list-schemas`, `save-schema`, `get-balance`, `request-upload`). Each exports a `handle<Name>` function and `registerN ame()`.
- `src/resources/*.ts` — MCP resources (`schemas-resource.ts`, `webhooks-resource.ts`).
- `src/content/*.ts` — **docs content source for `talonic.com/docs/mcp/*`**; see the architecture doc.
- `src/widgets/*.ts` — Apps SDK widget HTML payloads (extraction-result widget, etc.).
- `tests/**/*.test.ts` — vitest tests, run against a real `http.Server` on an ephemeral port for the HTTP-side; mock the Talonic API at the fetch layer for the tool tests.

## Running state

`STATUS.md` carries the live, running picture: package versions, follow-ups in flight, resolved items by date, end-to-end test transcripts. Read it for "what is the team currently working on" context. The TL;DR at the top is the fastest orientation.

## Common workflows for agents

- **Adding a new MCP tool:** see the four-file checklist in [`docs/architecture/docs-pipeline.md`](docs/architecture/docs-pipeline.md#add-a-new-mcp-tool--four-file-checklist). Also requires three website-side registry updates.
- **Updating an existing tool's description / schema:** edit `src/tools/<name>.ts` AND `src/content/sections/tools.ts` (for the website page). Tests in `tests/tools/tools.test.ts` validate output schemas.
- **Debugging the publish chain:** see the CI tokens + failure-mode table in [`docs/architecture/docs-pipeline.md`](docs/architecture/docs-pipeline.md#ci-tokens-purposes-scopes-where-they-live).
- **Hosted MCP behavior:** `src/http-server.ts` is the source; `tests/http-server.test.ts` spins up a real `http.Server` for end-to-end routing tests.
