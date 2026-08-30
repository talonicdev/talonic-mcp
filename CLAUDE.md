# CLAUDE.md — Claude Code entry point for `talonic-mcp`

**Full agent orientation lives in [`AGENTS.md`](AGENTS.md).** Read it first — it covers the repo map, the eleven tools, the browser-handoff upload architecture, the CI/publish chain, and the common workflows. This file repeats only the two things you must not get wrong, plus the commands you'll use every session.

This repo is the **Talonic MCP server** (`@talonic/mcp`): document-extraction API exposed as MCP tools, running over stdio (local installs) and Streamable HTTP (`mcp.talonic.com`, for Claude.ai connectors).

## ⚠️ Before touching docs content — two parallel surfaces

- `src/content/sections/*.ts` → `@talonic/mcp/content` → renders **`talonic.com/docs/mcp/*`**.
- `docs/sections.json` → `@talonic/docs` (synced via the platform repo) → becomes that package's `mcp` content domain, which **nothing currently renders**. It does *not* feed `/docs/{sdk,api,platform}/*` — those have their own content in the platform monorepo.

Edit the wrong one and your change silently never appears. `docs/sections.json` is maintained-but-dormant: the publish workflow's docs-drift guard still requires it to stay in step with `src/tools/**`, so keep it accurate, but user-visible MCP docs only come from `src/content/sections/*.ts`. The full map, the add-a-tool checklist, the failure-mode table, and the CI-token map are in [`docs/architecture/docs-pipeline.md`](docs/architecture/docs-pipeline.md). Read it before any non-trivial doc change.

## ⚠️ A push to `main` is a release

`.github/workflows/publish.yml` auto-bumps the version, publishes to npm + the MCP Registry, cuts a GitHub Release, and redeploys `mcp.talonic.com`. Don't push casually. The **docs-drift guard** fails the run if `src/tools/**`, `src/http-server.ts`, `src/server-factory.ts`, or `src/resources/**` changed without `docs/sections.json` — opt out with `[skip docs]` only for genuinely non-doc-affecting changes.

## Quick commands

```bash
npm test                # vitest, must pass before pushing
npm run typecheck       # tsc --noEmit
npm run format:check    # prettier check  (npm run format to fix)
npm run build           # tsup → dist/{index,server,http-server,content}.js
npm run start:http      # local hosted-MCP server on :3000
```

## Where to look

- **What is the team doing right now?** → `STATUS.md` (TL;DR at the top).
- **How is everything wired?** → [`AGENTS.md`](AGENTS.md).
- **Release history** → `CHANGELOG.md`.
- **Docs pipeline / adding a tool** → [`docs/architecture/docs-pipeline.md`](docs/architecture/docs-pipeline.md).
