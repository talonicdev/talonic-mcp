# AGENTS.md — Orientation for AI agents working in `talonic-mcp`

> This is the canonical agent-facing guide for this repository. It is read by Claude Code, Cursor, Codex, and other agent tools that look for `AGENTS.md`. [`CLAUDE.md`](CLAUDE.md) is a short Claude Code entry point that points here.

This repo is the **Talonic MCP server** — a Node package (`@talonic/mcp`) that exposes Talonic's document-extraction API as Model Context Protocol tools. It runs two ways from one codebase:

- **stdio** — for local installs (Claude Desktop, Cursor, Cline, Continue, Cowork) launched via `npx @talonic/mcp`.
- **Streamable HTTP** — the hosted server at `mcp.talonic.com`, used by Claude.ai connectors.

---

## ⚠️ #1 footgun: there are TWO parallel docs surfaces

Before changing **any** documentation content, internalise this — it has caused weeks of silent drift:

| Edit this… | …to change this page |
| --- | --- |
| `src/content/sections/*.ts` → `@talonic/mcp/content` | **`talonic.com/docs/mcp/*`** (the MCP docs) |
| `docs/sections.json` → `@talonic/docs` (synced via the platform repo) | `talonic.com/docs/{sdk,api,platform}/*` — **NOT** `/docs/mcp/` |

If you edit `docs/sections.json` expecting the MCP docs page to change, **nothing on `/docs/mcp` will move.** Full architecture, the four-file checklist for adding a tool, the failure-mode table, and the CI-token map live in **[`docs/architecture/docs-pipeline.md`](docs/architecture/docs-pipeline.md)** — read it before any non-trivial doc change.

`README.md`, `CHANGELOG.md`, `STATUS.md`, and this file are repo-local and feed neither website surface; they're for developers and agents reading the repo directly.

---

## The eleven tools (and what an agent should reach for)

Source: one file per tool in `src/tools/`. Each exports `handle<Name>()` (pure, unit-tested) and `register<Name>()` (wires it into the MCP server).

| Tool | File | Read-only? | Notes |
| --- | --- | --- | --- |
| `talonic_extract` | `extract.ts` | no | Primary tool. Schema **required** (rejected at MCP layer otherwise). Inputs: `file_data`+`filename`, `file_path`, `file_url`, or `document_id`. |
| `talonic_request_upload` | `request-upload.ts` | no | Browser-handoff upload for hosted connectors. See below. |
| `talonic_to_markdown` | `to-markdown.ts` | no* | OCR → markdown. *Not read-only: the file-input path ingests via extract and consumes credits. |
| `talonic_search` | `search.ts` | yes | Omnisearch. `fieldMatches[]`/`fields[]` carry `dataType` + `filterable`. |
| `talonic_filter` | `filter.ts` | yes | Field-value filtering. Numeric ops need `number`-typed fields; surfaces a `warnings[]` array. |
| `talonic_get_document` | `get-document.ts` | yes | Metadata + status. Used to poll the browser-handoff flow. |
| `talonic_list_schemas` | `list-schemas.ts` | yes | Saved schemas with definitions. |
| `talonic_save_schema` | `save-schema.ts` | no | Persist a reusable schema. |
| `talonic_get_balance` | `get-balance.ts` | yes | Credit balance, EUR, burn rate, runway. |
| `talonic_get_pricing` | `get-pricing.ts` | yes | Public per-unit credit pricing catalog + multipliers. Predict spend before running. |
| `talonic_get_usage` | `get-usage.ts` | yes | Per-function credit consumption over a trailing window (default 30 days). |

Read-only hints are locked by a regression test (`tests/widgets/tool-annotations.test.ts`) — seven lookup tools are `readOnlyHint: true`; `extract`, `save_schema`, `to_markdown`, `request_upload` are `false`.

Two resources: `talonic://schemas` and `talonic://webhooks/reference` (`src/resources/`).

---

## Key domain knowledge: the browser-handoff upload

This is the most load-bearing concept in the repo. Hosted AI platforms (Claude.ai web, ChatGPT) impose two hard limits an agent cannot configure around:

1. **Tool-call argument cap.** ~32 KB decoded / ~43 KB base64 on Claude.ai (measured against production). Larger `file_data` is silently truncated → stub document → `null` fields.
2. **Sandbox egress allowlist.** The agent's sandbox can't `PUT` bytes to arbitrary hosts, so out-of-band upload is also blocked.

The fix, shipped and verified live (2026-06-03), is `talonic_request_upload`: it returns a `document_id` + a browser `upload_url` (`https://app.talonic.com/u/<token>`) + `expires_at`. The user opens the link, drops the file; the browser upload triggers the extraction pipeline; the agent polls `talonic_get_document` until `status === "completed"`, then calls `talonic_extract` with the `document_id`.

Lifecycle of a handoff document: `pending_upload → uploading → queued → extracting → completed` (terminal failures: `error` / `ocr_failed` / `extraction_failed`). `uploading` is the transient state between the user opening the upload link and the file being fully stored server-side — it appears during polling and is not a stall. The `uploaded` status is a rare fallback when the extraction queue couldn't be enqueued; the platform's zombie sweep will eventually terminate truly stuck documents with `ocr_failed`. If polling returns a terminal failure status, stop and report the failure to the user. **Local-stdio installs don't need any of this** — they have no cap, so `file_data` works directly.

Background and the full investigation: `docs/superpowers/specs/2026-05-27-claude-file-upload-report.md` and `2026-05-20-presigned-upload-urls-design.md`.

---

## Repo map

```
src/
  index.ts            library entry — exports createServer, SERVER_NAME, VERSION
  server.ts           stdio entrypoint (npx @talonic/mcp)
  http-server.ts      Streamable HTTP entrypoint for mcp.talonic.com
                        · serves MCP at both / and /mcp (root-routing fix, 0.1.37)
                        · OAuth 2.1 protected-resource metadata at /.well-known/oauth-protected-resource
                        · Origin allowlist (DNS-rebinding mitigation, src/origin.ts)
  server-factory.ts   createServer() — shared by both entrypoints; registers tools/resources/widgets
  tools/*.ts          one file per MCP tool (handle<Name> + register<Name>)
  resources/*.ts      schemas-resource.ts, webhooks-resource.ts
  content/*.ts        docs content for talonic.com/docs/mcp/* (see footgun above)
  widgets/*.ts        ChatGPT Apps SDK widget HTML (extraction-result card)
  favicon.ts          base64 favicon served by the hosted server
tests/**/*.test.ts    vitest; HTTP side runs against a real http.Server on an ephemeral port,
                        tool side mocks the Talonic API at the fetch layer
docs/
  architecture/docs-pipeline.md   the docs-surface map — READ FIRST for doc changes
  sections.json                   SDK/API/Platform docs surface (NOT mcp)
  superpowers/specs/*.md          design specs + investigation reports
```

---

## Quick commands

```bash
npm test                # vitest — must pass before pushing
npm run typecheck       # tsc --noEmit
npm run format:check    # prettier check
npm run format          # prettier --write
npm run build           # tsup → dist/{index,server,http-server,content}.js
npm run start:http      # local hosted-MCP server on :3000
```

Always run typecheck + test + format:check before any push.

---

## CI & the publish chain

`.github/workflows/publish.yml` runs on push to `main` touching `src/**`, `docs/**`, or `package.json`:

1. **Docs-drift guard** — fails if `src/tools/**`, `src/http-server.ts`, `src/server-factory.ts`, or `src/resources/**` changed without `docs/sections.json`. Opt out with `[skip docs]` in a commit message **only** for genuinely non-doc-affecting changes (refactors, internal fixes, CI, debug instrumentation). ⚠️ This guard watches the *SDK/API/Platform* surface, not the MCP docs surface — it does **not** enforce that `src/content/sections/*.ts` was updated when tools change. Discipline + `docs-pipeline.md` are the only enforcement there.
2. Build, test, auto-bump patch version, sync `server.json`.
3. `npm publish` (`NPM_TOKEN`).
4. MCP Registry publish (`mcp-publisher`, GitHub OIDC).
5. GitHub Release (`gh release create`, idempotent).
6. `repository_dispatch` → `talonicdev/website` and `talonicdev/platform` rebuild docs.

**A push to `main` ships to npm and redeploys `mcp.talonic.com`.** Treat it as a release. Manual trigger: `gh workflow run publish.yml -r main`.

---

## Common workflows

**Add a new MCP tool** — touches *both* this repo and `talonicdev/website`. Follow the four-file checklist in [`docs/architecture/docs-pipeline.md`](docs/architecture/docs-pipeline.md#add-a-new-mcp-tool--four-file-checklist):
- here: `src/tools/<name>.ts`, register in `src/server-factory.ts`, add a section to `src/content/sections/tools.ts`, add a nav entry to `src/content/seo.ts`, add unit tests.
- website: a per-tool `page.tsx` plus three sibling registries (`docs-sync.ts`, `layout.tsx`, `next.config.ts`).

**Update an existing tool's description/schema** — edit `src/tools/<name>.ts` AND mirror the user-facing wording in `src/content/sections/tools.ts`. Output-schema changes need a matching test in `tests/tools/tools.test.ts`. If the API can return `null` for a field, the Zod outputSchema must be `.nullable()` — strip mode silently drops mismatches and hosted clients reject them with a `-32602` output-validation error.

**Debug the publish chain** — CI-token + failure-mode tables in `docs-pipeline.md`. First checks: did docs-drift block it? did the website `update-docs.yml` fire? is npm/Registry actually behind?

**Change hosted-server behaviour** — `src/http-server.ts`; end-to-end routing tests in `tests/http-server.test.ts` spin up a real `http.Server`.

---

## Conventions

- TypeScript, strict. Prettier-formatted (`format:check` is CI-gated indirectly via the test job).
- Tool handlers are pure functions returning the MCP result envelope via helpers in `src/tools/_shared.ts` (`jsonOk`, `toolError`, `validationError`). Validate at the MCP layer and fail fast with a clear message rather than forwarding a doomed call to the API.
- Tool descriptions are written **for an LLM**: explicit `USE WHEN` / `DO NOT USE WHEN`, and any cross-tool flow (like browser-handoff) spelled out so the agent doesn't have to infer it.
- Don't hardcode the API base URL — it's injectable (`TALONIC_BASE_URL`) for staging/tests.

---

## Where the running state lives

- **`STATUS.md`** — the live picture: package versions, in-flight follow-ups, resolved items by date, end-to-end test transcripts. Read the TL;DR first for "what is the team doing right now."
- **`CHANGELOG.md`** — release-by-release log (Keep a Changelog format, SemVer).
- **`docs/superpowers/specs/`** — design docs and investigation reports for larger initiatives.
