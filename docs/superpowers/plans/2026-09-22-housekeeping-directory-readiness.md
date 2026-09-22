# Housekeeping and Directory Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every record of the Talonic MCP server (changelog, status, tool descriptions Anthropic will review, listing collateral) matches the 29-tool / 29-widget server now on local `main`, and a paste-ready Claude Connectors Directory resubmission package exists — so the only steps left are Hamlet's push (release) and his clicks in the Anthropic portal.

**Architecture:** Docs-only except for two tool descriptions (`talonic_invoke_agent_tool`, `talonic_list_agent_tools`) that gain the read-only-restriction and target-API sentences Anthropic's review criteria ask for. Two new test locks (changelog structure/coverage; description wording). No behaviour changes.

**Tech Stack:** Markdown, TypeScript (descriptions + tests), vitest 3, prettier.

**Spec:** `docs/superpowers/specs/2026-09-22-housekeeping-directory-readiness-design.md`

## Global Constraints

- **Never `git push`.** Local `main` only.
- Tool-description edits touch `src/tools/**` → the commit changes `docs/sections.json` too (mirror the wording), so NO `[skip docs]` on that commit; docs-only commits need no marker.
- Descriptions stay ≤ 1500 chars and keep the `NOT FOR` line.
- Never rewrite dated historical records (STATUS "Resolved …" sections, end-to-end test transcripts, `submission-record.md` history). Update only present-tense state.
- Before every commit: `npm run typecheck && npm run format && npm test` green.
- Trailer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Never read or modify other plans' workspaces under `.superpowers/sdd/`.

## File structure

| File | Responsibility |
| --- | --- |
| `CHANGELOG.md` | full release history 0.1.45 → 0.1.76 + honest `[Unreleased]` |
| `tests/changelog.test.ts` | structure + coverage lock |
| `STATUS.md` | 2026-09-22 TL;DR, Surfaces, Open items; history untouched |
| `src/tools/agent-tools.ts`, `src/content/sections/tools.ts`, `docs/sections.json`, `tests/tools/descriptions.test.ts` | review-criteria wording + lock |
| `docs/claude-connectors-directory/{README,resubmission-2026-09,escalation-email}.md` | paste-ready directory package |
| repo-wide | stale count/version sweep |

---

### Task 1: CHANGELOG backfill 0.1.53 → 0.1.76 and a structure lock

**Files:**
- Modify: `CHANGELOG.md`
- Create: `tests/changelog.test.ts`

- [ ] **Step 1: Failing test** — `tests/changelog.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const md = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8")
const pkgVersion = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version

const HEADING = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/gm
const headings = [...md.matchAll(HEADING)].map((m) => ({ version: m[1], date: m[2] }))
const cmp = (a: string, b: string) => {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

describe("CHANGELOG.md", () => {
  it("has an [Unreleased] section first, then versioned headings in strictly descending order", () => {
    expect(md.indexOf("## [Unreleased]")).toBeGreaterThan(0)
    expect(md.indexOf("## [Unreleased]")).toBeLessThan(md.indexOf(`## [${headings[0].version}]`))
    for (let i = 1; i < headings.length; i++) {
      expect(cmp(headings[i - 1].version, headings[i].version), `${headings[i - 1].version} > ${headings[i].version}`).toBeGreaterThan(0)
    }
  })

  it("dates parse and never go backwards in time as versions increase", () => {
    for (let i = 1; i < headings.length; i++) {
      expect(Number.isNaN(Date.parse(headings[i].date))).toBe(false)
      expect(headings[i - 1].date >= headings[i].date, `${headings[i - 1].version} dated before ${headings[i].version}`).toBe(true)
    }
  })

  it("has a heading for every patch release from 0.1.45 up to the package version (releases 0.1.48 never shipped)", () => {
    const have = new Set(headings.map((h) => h.version))
    const [maj, min, patch] = pkgVersion.split(".").map(Number)
    const skipped = new Set(["0.1.48"]) // bump commit without a publish; no npm release exists
    for (let p = 45; p <= patch; p++) {
      const v = `${maj}.${min}.${p}`
      if (skipped.has(v)) continue
      expect(have.has(v), `missing ## [${v}]`).toBe(true)
    }
  })

  it("[Unreleased] is non-empty when the package version already has a heading", () => {
    const unreleased = md.slice(md.indexOf("## [Unreleased]"), md.indexOf(`## [${headings[0].version}]`))
    if (headings.some((h) => h.version === pkgVersion)) {
      expect(unreleased.replace(/## \[Unreleased\]|###\s*\w+|\s/g, "").length).toBeGreaterThan(40)
    }
  })
})
```

Run: `npx vitest run tests/changelog.test.ts` → FAIL on the coverage test (0.1.53–0.1.76 missing).

- [ ] **Step 2: Rewrite the top of `CHANGELOG.md`.** Keep the file header (lines 1–7) and everything from `## [0.1.52] - 2026-06-01` down unchanged. Replace the current `[Unreleased]` block with the following (verbatim; the shipped bullets that were sitting in Unreleased move into their real versions below):

```md
## [Unreleased]

> The publish workflow assigns the version on release (`npm version patch` on push to `main`); this block becomes that release's entry.

### Added

- **Specs, Run and Ask tools (7 new, 29 public).** `talonic_list_specs` / `talonic_get_spec` read the workspace's configured pipelines; `talonic_run_spec` runs one over `document_ids` (`POST /v1/pipelines`) or `file_urls` (`POST /v1/run`) behind a single normalised RunEnvelope; `talonic_get_run` polls status + progress and `talonic_get_run_results` reads the rows; `talonic_ask` answers questions over the corpus with citations and verification (bounded wait) and `talonic_get_answer` polls long asks. Each has a ChatGPT card; documented on both docs surfaces; manifest and preflight at 29.
- **Widget parity for every public tool.** Eleven new ChatGPT Apps SDK cards for the Field Registry and Agent-task tools (list / concept card / values, find-data planes, agent-tool registry, shape-adaptive agent-tool result, task worklist, task card, lease card for claim + heartbeat, submit confirmation). Every public tool declares `openai/toolInvocation/invoking|invoked`; every widget resource carries `openai/widgetDescription` and `openai/widgetPrefersBorder`. Single registry (`src/widgets/types.ts` + `register.ts`) drives resource registration, the hosted server's unauthenticated template fast path and the tests. Locked by jsdom render tests for all widgets, a hostile-payload XSS test, template hygiene, and `scripts/chatgpt-preflight.mjs` (`npm run preflight:chatgpt`).
- **`chatgpt-app-submission.json` lists every public tool** and is test-locked to the server's annotations.
- **Content lock:** every public tool must have a live docs section, a nav entry and a `docs/sections.json` mirror entry (`tests/content/tool-sections.test.ts`); the dormant mirror caught up from 15 to 29 tools.

### Fixed

- **Raw-fetch tools carry the `talonic-mcp/<v> <client>` User-Agent tag.** Field Registry, agent-tool, agent-task, upload-session and webhook-reference calls bypassed the tagged fetch, so the platform funnel could not attribute their client surface (`TokenSource` / `withFetch` / `resolveFetch` in `src/tools/_http.ts`; guarded by `tests/tools/no-bare-fetch.test.ts`).
- **Hosted server honours `TALONIC_BASE_URL`** for the SDK client and the growth-access probe (it was only used by the admin-task probe), so local preflight never touches production.
- `talonic_invoke_agent_tool` / `talonic_list_agent_tools` descriptions state the platform's read-only capability restriction for API-key credentials and name the target API docs (Anthropic review criteria).

### Changed

- CHANGELOG backfilled for 0.1.53 → 0.1.76; STATUS.md re-audited 2026-09-22.

## [0.1.76] - 2026-09-05

### Added

- **Field Registry as a source of truth for agents — six new read-only tools.** `talonic_list_fields` (concepts with stable ids, named maturity `core`/`proven`/`candidate`, synonyms, `superseded_by`), `talonic_get_field` (the concept card: definition, aliases, occurrence stats, value distribution, schema usage, identity links; accepts a NAME and resolves it through synonyms / merge aliases / the registry spelling fold, following redirects), `talonic_field_values` (one concept's current values across every document with provenance), `talonic_find_data` (the platform agent's concept→data retrieval, by meaning), and `talonic_list_agent_tools` + `talonic_invoke_agent_tool` (the whole platform agent tool registry — e.g. `query_data` SQL — callable with the caller's own arguments; the platform enforces the capability matrix). Backed by the new `/v1/fields/resolve`, `/v1/fields/:id/{card,values,history}` routes and `/v1/agent/tools`. Tool count 16 → 22.
- npm publishing switched to **trusted publishing (OIDC)** — no long-lived `NPM_TOKEN` in CI.

### Fixed

- **Docs accuracy pass over `src/content/sections/*.ts`** (the surface behind `talonic.com/docs/mcp/*`): Configuration claimed the server rejects a key whose prefix is not `tlnc_` at startup (it only checks the variable is set); Known Limitations claimed cost / EUR / balance are not surfaced (they are, since 0.1.25 / 0.1.68); two dead links to `talonic.com/docs/sdk/introduction`; stale "v0.1" framing.
- **Corrected the docs-pipeline map** in `docs/architecture/docs-pipeline.md`, `AGENTS.md` and `CLAUDE.md`: `docs/sections.json` feeds the `mcp` domain of `@talonic/docs`, which no page renders; the live MCP docs come from `src/content/sections/*.ts`.

### Changed

- **SEO metadata across all 32 doc sections** within the 50–60 character `seoTitle` and 150–160 character `description` targets, no dead `related[]` links; Configuration documents `PORT`, `MCP_RESOURCE_URL`, `OAUTH_AUTHORIZATION_SERVER`.
- ChatGPT submission manifest lists the six registry tools.

## [0.1.75] - 2026-08-19

### Added

- **Agent task workflow.** Five tenant tools — `talonic_list_agent_tasks`, `talonic_get_agent_task`, `talonic_claim_agent_task`, `talonic_heartbeat_agent_task`, `talonic_submit_agent_task` — turn the MCP into a worklist for external agents: a pipeline parks a document at an Agent stage, the agent claims it under a lease with an execution epoch, heartbeats while working, and submits declared output fields to resume the document. Five `talonic_admin_*_agent_task` variants are Talonic-internal, registered only after a superadmin access probe passes, and require a named tenant, a reason and a fresh TOTP code per payload call. Tool count 11 → 16.

## [0.1.74] - 2026-08-17

### Added

- **Superadmin-only growth analytics tools** (`talonic_growth_*`), registered conditionally after `probeGrowthAccess()` passes; invisible to normal keys; absent from the public docs by design.

### Fixed

- Browser-handoff lifecycle documents the transient `uploading` status and the terminal failures (`error`, `ocr_failed`, `extraction_failed`) so agents stop polling on failure instead of stalling.

## [0.1.73] - 2026-07-22

### Added

- npm **provenance attestations** on publish; `smithery.yaml` for the Smithery directory.

### Changed

- High-value npm keywords for discoverability.

## [0.1.72] - 2026-07-07

### Added

- **Widgets for the two metering tools** (`talonic_get_pricing`, `talonic_get_usage`) — added after the App Directory approval (0.1.67) without cards, they were the only two bare tools; this alignment pass restores one-widget-per-tool parity (11/11) and adds their missing MCP docs nav entries.

### Changed

- **Widget scaffolding refactored into `src/widgets/shared.ts`** — shared base CSS, render helpers, the `window.openai` data-channel bootstrap, the `_meta` block (widget domain + CSP) and a `registerWidget()` helper; each widget supplies only its `render(payload)` body.

## [0.1.71] - 2026-06-23

### Added

- Outbound API calls carry `User-Agent: talonic-mcp/<version> <client>` (client name from the MCP initialize handshake) so the platform can attribute usage to Claude Desktop / Cursor / ChatGPT etc.

## [0.1.70] - 2026-06-21

### Added

- MCP docs pages for `talonic_get_pricing` and `talonic_get_usage`.

## [0.1.69] - 2026-06-21

### Changed

- Formatting only (prettier pass on the pricing tool).

## [0.1.68] - 2026-06-21

### Added

- **`talonic_get_pricing`** — the public per-unit credit pricing catalog with EUR values and multipliers, so agents can predict spend before running; **`talonic_get_usage`** — per-function credit consumption over a trailing window (default 30 days). Tool count 9 → 11.

## [0.1.67] - 2026-06-20

### Changed

- **Phase 1 retrieval tuning:** broadened the semantic signal and softened the schema-required rule (decisions D1/D2/D3) so more real-world queries land.
- ChatGPT App Directory **approval** recorded (`docs/chatgpt-apps-sdk/submission-record.md`), with the approved submission JSON and screenshot tooling preserved.

## [0.1.66] - 2026-06-12

### Fixed

- **Search / filter query contract:** `talonic_search` descriptions teach the literal-keyword, singular-term contract and a zero-result hint, so models stop concluding a workspace is empty after a sentence-shaped query.

## [0.1.65] - 2026-06-12

### Fixed

- **Widget templates fetchable from the ChatGPT sandbox:** the hosted server answers `resources/read` for `ui://widget/*` templates without auth and with a JSON-only `Accept` header (the review failure "Error loading app, failed to fetch the template"); origin allowlist extended for the sandbox.

## [0.1.64] - 2026-06-09

### Changed

- **Agent-facing tool descriptions rewritten** — a one-line WHAT, `USE WHEN` / `NOT FOR` redirects to sibling tools, and explicit chaining cues (by-name → `talonic_search`), replacing the ~2.5k-character prose blocks that made models hesitate (design in `docs/superpowers/specs`).

## [0.1.63] - 2026-06-09

### Fixed

- `talonic_get_document` accepts `null` scalars on documents still pre-processing (no more `-32602` output-validation errors while polling).

## [0.1.62] - 2026-06-09

### Fixed

- **Stateless MCP transport** on the hosted server — sessions survive restarts and redeploys; ChatGPT no longer goes dead after every deploy.

## [0.1.61] - 2026-06-08

### Changed

- Apps SDK domain-verification challenge token updated to the current value.

## [0.1.60] - 2026-06-08

### Fixed

- `talonic_filter` condition schema clarified (clears the "Unclear Arguments" review flag).

## [0.1.59] - 2026-06-08

### Added

- Hosted server serves the **ChatGPT Apps SDK domain-verification challenge**.

## [0.1.58] - 2026-06-08

### Fixed

- **Submission-hardening pass:** accurate `readOnlyHint` / `destructiveHint` / `openWorldHint` on every tool, widget CSP + origin fixes, and the widget ↔ host bridge.

## [0.1.57] - 2026-06-03

### Changed

- Widget styling: padded stat tiles, larger margins, responsive grid.

## [0.1.56] - 2026-06-03

### Added

- **Branded inline widgets for every tool.** All nine tools render a ChatGPT Apps SDK card (previously only `talonic_extract` did): `talonic_search` (grouped matches), `talonic_filter` (results table + warnings), `talonic_get_document` (metadata + triage), `talonic_to_markdown` (scrollable markdown), `talonic_list_schemas` (schema table), `talonic_save_schema` (confirmation), `talonic_get_balance` (balance card), `talonic_request_upload` (upload-link card). Each tool declares `_meta["openai/outputTemplate"]`.

## [0.1.55] - 2026-06-03

### Fixed

- Widget resources declare the widget domain (required for App Directory submission); docs count corrected to nine tools.

## [0.1.54] - 2026-06-03

### Changed

- Comprehensive docs refresh (README / AGENTS / CLAUDE / STATUS / MCP docs) for the nine-tool surface and the verified browser-handoff upload flow.

## [0.1.53] - 2026-06-03

### Fixed

- Extraction-result widget reads tool output through `window.openai.toolOutput` (the Apps SDK data channel) and declares its CSP; the postMessage bridge stays as a fallback.
```

Then verify the existing `## [0.1.52]` … `## [0.1.45]` headings below are untouched. If any of 0.1.45–0.1.52 is missing, do NOT invent it — instead extend the `skipped` set in the test with a comment naming the reason after checking `git tag` (only `0.1.48` is known to have no published release).

- [ ] **Step 3: Run** — `npx vitest run tests/changelog.test.ts` → PASS (4). `npm test` → green.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md tests/changelog.test.ts
git commit -m "docs(changelog): backfill 0.1.53–0.1.76 from the release tags; honest Unreleased; structure lock test

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: STATUS.md re-audit (present-tense state only)

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Replace the TL;DR through the Registry table** (everything from `## TL;DR` up to but excluding `## Live end-to-end tests against production`) with:

```md
## TL;DR

**Re-audited 2026-09-22.** `@talonic/mcp` **0.1.76** is live on npm, the official MCP Registry and `mcp.talonic.com` (22 public tools). Local `main` carries the unpublished **0.1.77** — 29 public tools, one ChatGPT Apps SDK card per tool, Apps SDK status/description metadata everywhere, User-Agent surface tagging on every outbound call, the Specs / Run / Ask tool set, docs on both surfaces for all 29, a 29-tool ChatGPT submission manifest, and a preflight script that checks tools/list + every widget template the way ChatGPT does. Test suite: see the count in the latest `npm test` (600+). **Not pushed** — a push to `main` is a release and waits for Hamlet's go. Release history is now complete in `CHANGELOG.md` (0.1.45 → 0.1.76).

**Headline changes since the previous audit (2026-06-03):**

1. **Tool surface 11 → 29.** 0.1.68 pricing/usage; 0.1.75 Agent task workflow (5 + 5 admin); 0.1.76 Field Registry + agent-tool registry (6); unreleased Specs/Run/Ask (7).
2. **Widget parity restored** (unreleased): 11 → 29 cards; single registry in `src/widgets/types.ts` + `register.ts`; hostile-payload XSS lock; jsdom render tests for every card.
3. **Distribution:** npm trusted publishing (0.1.76), provenance attestations + `smithery.yaml` (0.1.73); Registry auto-tracks; Smithery / Glama / mcp.so listings live.
4. **ChatGPT:** approved 2026-06-16 on the 9-tool surface; OpenAI re-fetches tool definitions automatically, so the new cards go live on deploy; listing-text changes need a new version + review.
5. **Claude Connectors Directory:** the 2026-05-12 legacy-form submission is still "In review / Not live"; Anthropic moved to a Team-admin portal that lists servers as *Community* after an automatic scan. Resubmission package: `docs/claude-connectors-directory/`.

## Surfaces

### `@talonic/mcp`

| Item | State (2026-09-22) |
| --- | --- |
| Repo | local `main` ahead of `origin/main` (0.1.76 = 107e481); unpushed work = sub-projects 1–3 of the 2026-09-22 program |
| package.json / server.json version | 0.1.76 (auto-bumped to 0.1.77 on the next push) |
| npm published version | 0.1.76 (2026-09-06, trusted publishing) |
| Hosted endpoint | `https://mcp.talonic.com` serving 0.1.76; `/health` ok |
| Tests | `npm test` green on local main (run it for the exact count; 600+); `npm run preflight:chatgpt` OK |
| Typecheck / format / build | clean |
| Tools (local main) | 29 public: extract, request_upload, to_markdown, search, filter, get_document, list_schemas, save_schema, get_balance, get_pricing, get_usage, list_fields, get_field, field_values, find_data, list_agent_tools, invoke_agent_tool, list_agent_tasks, get_agent_task, claim_agent_task, heartbeat_agent_task, submit_agent_task, list_specs, get_spec, run_spec, get_run, get_run_results, ask, get_answer — plus 4 `talonic_growth_*` and 5 `talonic_admin_*` internal tools behind access probes |
| Widgets | 29/29 (`tests/widgets/all-widgets.test.ts`), XSS lock (`tests/widgets/xss.test.ts`), template hygiene, hosted fast path parametrised |
| Annotations | every tool: title + readOnlyHint / destructiveHint / openWorldHint (20 read-only, 9 write-capable); Anthropic portal would flag none |
| Docs surfaces | `src/content/sections/tools.ts` + `seo.ts` nav: 29 sections; `docs/sections.json` mirror: 29 tool entries (was 15); content lock `tests/content/tool-sections.test.ts` |
| ChatGPT manifest | `chatgpt-app-submission.json`: 29 tools, test-locked to server annotations |
| Resources | 2: `talonic://schemas`, `talonic://webhooks/reference` |
| OAuth 2.1 (hosted) | live; `/.well-known/oauth-protected-resource`; token rotation |
| Origin allowlist / SECURITY.md / favicon / privacy | unchanged, live (`safety@talonic.ai`; privacy at `talonic.com/privacy` and README §Privacy) |

### `@talonic/node`

| Item | State (2026-09-22) |
| --- | --- |
| Version | 0.1.25 on npm and in repo (0.1.24 pinned by the website) |
| Coverage gap | no `specs` / `run` / `ask` / `agent` resources — the MCP calls those routes raw (`src/tools/_http.ts`); SDK catch-up is a separate initiative |

### Website (`~/Talonic/website`)

| Item | State (2026-09-22) |
| --- | --- |
| Pins | `@talonic/mcp` 0.1.76, `@talonic/node` 0.1.24, `@talonic/docs` 0.21.37 |
| MCP tool pages | 22 live; 7 more (Specs/Run/Ask) committed locally, render once `@talonic/mcp` 0.1.77 publishes and `update-docs.yml` bumps the pin |
| `/.well-known/mcp.json` | lists 22 tools live; 29 in the local commit |

### Official MCP Registry

| Item | State (2026-09-22) |
| --- | --- |
| Listing | `io.github.talonicdev/talonic-mcp`, isLatest 0.1.76 (published 2026-09-06), status active; auto-tracked by `mcp-publisher` in `publish.yml` |

### Directories

| Directory | State (2026-09-22) |
| --- | --- |
| ChatGPT Apps / Plugins | LIVE since 2026-06-16; tools auto-re-fetched by OpenAI |
| Claude Connectors Directory | legacy submission "In review / Not live" since 2026-05-12 → resubmit via portal, see `docs/claude-connectors-directory/resubmission-2026-09.md` |
| Smithery / Glama / mcp.so | live (Glama shows 0.1.76) |
| Cowork plugin | not submitted (decision pending) |
```

- [ ] **Step 2: Replace the "Follow-ups" section** (from `## Follow-ups (ordered by leverage)` up to but excluding `### Resolved 2026-05-18: hosted MCP at root + Registry CI chain`) with:

```md
## Open items (2026-09-22)

1. **Release 0.1.77** — one push of local `main` ships sub-projects 1–3 (widgets, Specs/Run/Ask, housekeeping); needs Hamlet's go. Afterwards: reconnect the ChatGPT connector and walk `docs/chatgpt-apps-sdk/developer-mode-testing.md`'s 29-row card checklist.
2. **Claude Connectors Directory** — send `docs/claude-connectors-directory/escalation-email.md`, then resubmit through the portal with `resubmission-2026-09.md` (test account + icon are Hamlet's inputs).
3. **Cowork plugin submission** — decide; the install snippet and description already exist.
4. **Python SDK publish** — PyPI Trusted Publisher config still pending (separate repo).
5. **Follow-ups noted in review:** type raw-fetch registrars as `TokenSource`; JSON-envelope parsing in `toolError` for raw-fetch errors; `docs/sections.json` remains dormant (nothing renders it) — keep mirroring but do not invest.

The historical follow-up lists below are kept as dated records.

```

- [ ] **Step 3: Fix stale paths/lines elsewhere in the file:** replace `/Users/macman/Downloads/Talonic/website` with `~/Talonic/website`; update the `**Last audit:**` line (near the top banner) to `**Last audit:** 2026-09-22 (widget parity 29/29, Specs/Run/Ask tools, changelog backfill, directory resubmission package). Earlier: 2026-06-03, 2026-05-19.`; leave every `### Resolved …` section and the test transcripts untouched.

- [ ] **Step 4: Verify** — `grep -n -E "0\.1\.71|11 MCP tools|Downloads/Talonic" STATUS.md` returns nothing outside the dated "Resolved"/transcript sections. `npm test` green (no code change).

- [ ] **Step 5: Commit**

```bash
git add STATUS.md
git commit -m "docs(status): re-audit 2026-09-22 — 29 tools/widgets, 0.1.76 live / 0.1.77 pending, directories, open items

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---
