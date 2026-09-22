# Housekeeping and Directory Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every record of the Talonic MCP server (changelog, status, tool descriptions Anthropic will review, listing collateral) matches the 36-tool / 36-widget server (see the post-merge reality update below) now on local `main`, and a paste-ready Claude Connectors Directory resubmission package exists — so the only steps left are Hamlet's push (release) and his clicks in the Anthropic portal.

**Architecture:** Docs-only except for two tool descriptions (`talonic_invoke_agent_tool`, `talonic_list_agent_tools`) that gain the read-only-restriction and target-API sentences Anthropic's review criteria ask for. Two new test locks (changelog structure/coverage; description wording). No behaviour changes.

**Tech Stack:** Markdown, TypeScript (descriptions + tests), vitest 3, prettier.

**Spec:** `docs/superpowers/specs/2026-09-22-housekeeping-directory-readiness-design.md`

## Post-merge reality update (2026-09-22, after sub-project 2b Task 1) — BINDING over the task text below

The task text below was written when local `main` had 29 tools and `origin/main` was at 0.1.76. Between writing and execution, upstream shipped PR #22 (seven `talonic_*_decision_task` tools, published **0.1.77**) and PR #23 (CI: MCP Registry publish waits for npm, published **0.1.78**), and sub-project 2b merged them (merge commit 1da2e44) and gave the seven tools widgets, manifest entries, mirror docs and website pages. Wherever a task below says otherwise, these facts win:

| Was | Is now |
| --- | --- |
| 29 public tools / 29 widgets / manifest 29 / preflight 29 | **36** public tools / 36 widgets / manifest 36 / preflight 36 (22 read-only, 14 write-capable) |
| `docs/sections.json` mirror: 29 tool entries (43 total) | 36 tool entries (**50** total) |
| `@talonic/mcp` 0.1.76 live on npm / Registry / mcp.talonic.com | **0.1.78** live (verify with `curl -s https://mcp.talonic.com/health` and `npm view @talonic/mcp version` at execution time) |
| next push publishes 0.1.77 | next push publishes **0.1.79** |
| CHANGELOG backfill 0.1.53 → 0.1.76 | backfill **0.1.53 → 0.1.78**: add `## [0.1.77] - 2026-09-22` (move the "External-mode decision-task protocol … seven new tools" bullet there from `[Unreleased]`) and `## [0.1.78] - 2026-09-22` (`### Changed` — "CI: the MCP Registry publish waits up to four minutes for npm to serve the new version, retries three times, and warns instead of failing"); drop the `> 0.1.77 shipped …` note line that sub-project 2b left under `[Unreleased]` once the headings exist; `[Unreleased]` keeps sub-project 1/2/2b bullets (widget parity 36, Specs/Run/Ask, decision-task widgets, surface tagging fix, Apps SDK metadata, review fixes) |
| STATUS.md tool list 29 | 36: the 29 plus list_decision_tasks, claim_decision_task, read_decision_package, heartbeat_decision_task, submit_decision_task, release_decision_task, fail_decision_task (External-mode Apps; `apps:decide` OAuth scope advertised; non-invocable marking when the token lacks it) |
| website: 22 MCP pages live, 29 local | 22 live, **36** local (29 + 7 decision-task pages, website commits 25ce06a, e4ccb2a + the 2b website commit) |
| Claude directory package "29 public tools … Read-only (20)" | **36 public tools … Read-only (22)**: the 20 + `talonic_list_decision_tasks`, `talonic_read_decision_package`; write-capable (14): the 9 + claim/heartbeat/submit/release/fail decision task; add one sentence to the listing description: External-mode app decisions (claim → read package → submit / release / fail) behind the `apps:decide` scope |
| sweep regex `0\.1\.7[0-6]` | `0\.1\.7[0-8]` for "stale version" hits that claim to be current/pending (dated history stays) |
| Directory prepared "against 0.1.77 … portal syncs 29 tools" | against **0.1.79** … portal syncs **36** tools |

**Release-history corrections found during execution (binding):** 0.1.48 WAS published (npm lists it; tag v0.1.48 → the c95a678 poll-target fix), so the changelog test's skip set is empty and 0.1.48 has its own heading; 0.1.46 and 0.1.47 were bump-only re-publishes (Note entries); `talonic_request_upload` shipped in 0.1.45 (c86a455), not 0.1.46; the widget-scaffolding refactor (`src/widgets/shared.ts`) shipped in 0.1.56 (3f484e3), not 0.1.72; every heading's date is its tag's date (0.1.45 = 2026-05-27). Wherever Task 1's prepared text below says otherwise, git history wins.

Also true now: `tests/changelog.test.ts` coverage range ends at 0.1.78; `server.json`/`package.json` read 0.1.78 (CI-managed, never edit); `git log --oneline origin/main..main` is the unpublished set.


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

### Task 3: Review-criteria wording on `talonic_invoke_agent_tool` and `talonic_list_agent_tools`

**Files:**
- Modify: `src/tools/agent-tools.ts` (`INVOKE_DESCRIPTION`, `LIST_TOOLS_DESCRIPTION`), `src/content/sections/tools.ts` (the `talonic-invoke-agent-tool` and `talonic-list-agent-tools` sections), `docs/sections.json` (the two mirror entries), `tests/tools/descriptions.test.ts`

- [ ] **Step 1: Failing test** — append to `tests/tools/descriptions.test.ts` (inside the existing `describe("tool descriptions are tight and decision-oriented")` or as a new describe):

```ts
describe("Anthropic review criteria — custom-query tools name their API and their read-only guarantee", () => {
  const d = descriptions()
  it("invoke_agent_tool states the platform's read-only restriction for API keys and links the API docs", () => {
    expect(d["talonic_invoke_agent_tool"]).toMatch(/read-only/i)
    expect(d["talonic_invoke_agent_tool"]).toContain("data.read")
    expect(d["talonic_invoke_agent_tool"]).toContain("https://talonic.com/docs/api")
    expect(d["talonic_invoke_agent_tool"]).toContain("/v1/agent/tools/{name}/invoke")
  })
  it("list_agent_tools links the API docs", () => {
    expect(d["talonic_list_agent_tools"]).toContain("https://talonic.com/docs/api")
  })
  it.each(["talonic_invoke_agent_tool", "talonic_list_agent_tools"])("%s stays under the length budget", (name) => {
    expect(d[name].length).toBeLessThanOrEqual(1500)
  })
})
```

Run: `npx vitest run tests/tools/descriptions.test.ts` → FAIL (3 new assertions).

- [ ] **Step 2: Descriptions** — in `src/tools/agent-tools.ts`:

`INVOKE_DESCRIPTION`: after the first (WHAT) line insert two lines:

```ts
  "READ-ONLY BY CONSTRUCTION: API-key credentials are restricted by the platform to the registry's read-only tools (capability `data.read`); write-capable registry tools are never invocable through this credential, so this tool reads and never mutates workspace data.",
  "Target API: Talonic agent tool registry — https://talonic.com/docs/api (POST /v1/agent/tools/{name}/invoke; input schemas from talonic_list_agent_tools).",
```

`LIST_TOOLS_DESCRIPTION`: after the first line insert:

```ts
  "Target API: https://talonic.com/docs/api (GET /v1/agent/tools).",
```

If either description now exceeds 1500 characters, shorten its `RETURNS:` line (keep field names, drop prose) until it fits; report the final lengths.

- [ ] **Step 3: Mirror the wording** — in `src/content/sections/tools.ts` add, to the `talonic-invoke-agent-tool` section's first paragraph, the sentence "API-key credentials are restricted by the platform to the registry's read-only tools (capability `data.read`); write-capable registry tools are never invocable through this credential." and a `callout` block (variant "info") "Target API: [Talonic API reference](https://talonic.com/docs/api) — `POST /v1/agent/tools/{name}/invoke`." Add the equivalent one-line callout to `talonic-list-agent-tools`. Apply the same two edits to the matching entries in `docs/sections.json` (`mcp-talonic-invoke-agent-tool`, `mcp-talonic-list-agent-tools`) by hand (JSON, 2-space indent) — this is a real doc content change, so this commit needs NO `[skip docs]`.

- [ ] **Step 4: Run** — `npx vitest run tests/tools/descriptions.test.ts tests/content` → PASS. `npm run typecheck && npm run format && npm test` → green.

- [ ] **Step 5: Commit**

```bash
git add src/tools/agent-tools.ts src/content/sections/tools.ts docs/sections.json tests/tools/descriptions.test.ts
git commit -m "docs(tools): invoke/list agent tools state the read-only capability restriction and name the target API (Anthropic review criteria)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Claude Connectors Directory resubmission package

**Files:**
- Create: `docs/claude-connectors-directory/README.md`, `docs/claude-connectors-directory/resubmission-2026-09.md`, `docs/claude-connectors-directory/escalation-email.md`

- [ ] **Step 1: Facts to pull first (read-only):** the OAuth answers Anthropic already has — `STATUS.md` section "Claude Connectors Directory submission (submitted 2026-05-12…)" → "Form inputs as submitted" (around lines 243–300): copy the Authentication answers verbatim into the package. Verify the endpoints still respond: `curl -s https://mcp.talonic.com/.well-known/oauth-protected-resource` (expect JSON with `authorization_servers`) and `curl -s -o /dev/null -w '%{http_code}' https://talonic.com/privacy` (200). Count the current public tools and split read/write from `tests/widgets/tool-annotations.test.ts`'s lists (20 read-only, 9 write-capable after sub-project 2).

- [ ] **Step 2: `README.md`**

```md
# Claude Connectors Directory — submission collateral

Sibling of `../chatgpt-apps-sdk/` (the ChatGPT App Directory record). This folder holds what Anthropic's submission portal asks for, pre-filled from the live server, so a resubmission is a copy-paste exercise.

- `resubmission-2026-09.md` — every portal step with our answers (portal: https://claude.ai/admin-settings/directory/submissions/new — Team/Enterprise Owner only).
- `escalation-email.md` — the note to `mcp-review@anthropic.com` about the stranded 2026-05-12 legacy-form submission (slug `pending-talonic`).

Process facts (from claude.com/docs/connectors, fetched 2026-09-22): a submitted server is scanned automatically and listed as a **Community** connector by default; **Verified** review is escalated automatically for highly useful servers. Status and reviewer feedback live in the submissions dashboard (https://claude.ai/admin-settings/directory/submissions); the URL slug is permanent once published. Update this folder whenever the tool surface, listing text, docs URL or privacy URL changes; the tool list itself syncs from the live server at submission time.
```

- [ ] **Step 3: `resubmission-2026-09.md`** — write the full document with these sections and pre-filled answers (fill the counts from Step 1):

```md
# Claude Connectors Directory — resubmission package (2026-09)

Prepared 2026-09-22 against `@talonic/mcp` 0.1.77 (local `main`; publish before submitting so the portal syncs 29 tools). Portal: https://claude.ai/admin-settings/directory/submissions/new. Pre-submission checklist: https://claude.com/docs/connectors/building/review-criteria.

## 0. Before you open the portal
- [ ] Release 0.1.77 is live (`curl -s https://mcp.talonic.com/health` shows the version).
- [ ] `npm run preflight:chatgpt` and `npm run smoke:live` green on that build.
- [ ] Test account: a Talonic workspace with a populated corpus (≥ 20 processed documents, ≥ 1 published Spec, a saved schema) and an API key — Anthropic requires "a fully populated account". Credentials go in step 9, never in this repo.
- [ ] Icon: `Logo 400px.png` (square PNG; Hamlet has it — path outside this repo).

## 1. Connection
- Server URL: `https://mcp.talonic.com/mcp` (Streamable HTTP; the root `/` also serves MCP).
- Transport: Streamable HTTP.
- How users reach the server: **Universal URL** (one URL for everyone).

## 2. Tools (auto-synced from the server)
29 public tools, every one with `title`, `readOnlyHint` and `destructiveHint` (Anthropic's portal groups by these). Read-only (20): list_schemas, get_document, search, filter, get_balance, get_pricing, get_usage, list_fields, get_field, field_values, find_data, list_agent_tools, invoke_agent_tool (pass-through restricted by the platform to `data.read` tools — description states it), list_agent_tasks, get_agent_task, list_specs, get_spec, get_run, get_run_results, get_answer. Write (9): extract, request_upload, to_markdown (ingests when given a file), save_schema, claim_agent_task, heartbeat_agent_task, submit_agent_task, run_spec, ask. None destructive. Internal `talonic_growth_*` / `talonic_admin_*` tools are probe-gated and will not appear for the test account.

## 3. Listing
- Server name (≤ 100): **Talonic**
- Tagline (≤ 55): **Extract validated structured data from any document** (50 chars)
- Description (≤ 2000): [write ~1200 chars: what Talonic is (document → schema-validated JSON with confidence + provenance), what the connector lets Claude do (extract from any PDF/scan/image/DOCX; search/filter the workspace; run the customer's configured Spec pipelines; ask cited questions over the corpus; manage schemas; check credits/pricing), the browser-handoff upload for large files, free tier, hosted at mcp.talonic.com with OAuth 2.1, docs at talonic.com/docs/mcp. No internal metrics, no customer names.]
- Categories (1–5): Productivity; Developer Tools; Data & Analytics (choose the portal's closest labels).
- Documentation URL: `https://talonic.com/docs/mcp`
- Privacy policy URL: `https://talonic.com/privacy`
- Support contact: `info@talonic.ai`
- Icon: `Logo 400px.png`
- URL slug: `talonic` (permanent once published; the legacy submission holds `pending-talonic` — if the portal refuses `talonic`, use `talonic-mcp` and note it here).

## 4. Use cases
1. Turn a PDF, scan or photo into schema-validated JSON (with confidence and source provenance) in the chat, or via the browser upload link for files over the hosted size cap.
2. Work the workspace: search and filter documents by extracted values, read field values across documents, explore the Field Registry.
3. Run the customer's own configured pipeline (Spec) over documents and ask cited questions across the corpus.
- Prerequisites: a Talonic account (free tier available) — users authenticate with OAuth in Claude or paste an API key for local installs.
- Reads and writes data: **both** (writes = extraction runs, saved schemas, Spec runs, agent-task leases/submissions).

## 5. Company
Talonic — https://talonic.com — primary contact pre-filled from the account (Hamlet Hayrapetyan, Head of Product).

## 6. Authentication
OAuth 2.1 — copy the answers recorded in `STATUS.md` ("Form inputs as submitted", 2026-05-12) here verbatim: [paste], and confirm `https://mcp.talonic.com/.well-known/oauth-protected-resource` still returns the authorization server (`https://api.talonic.com`). No per-tool on-demand auth.

## 7. Data handling
- Underlying API: **our own** (api.talonic.com).
- Personal health data: no (customers may upload documents of their choosing; Talonic does not target PHI).
- Sponsored content: no.

## 8. Allowed link URIs
- `https://app.talonic.com` (the `talonic_request_upload` browser-handoff page and `app_url` citations)
- `https://talonic.com` (docs links)

## 9. Test & launch
- Test account instructions text: [write the step list a reviewer follows: sign in / connect via OAuth with the provided credentials; the workspace already contains documents; suggested prompts per tool group — one per the 29 tools, reusing `chatgpt-app-submission.json`'s test cases].
- Credentials: entered in the portal only.
- Confirmation that every tool was exercised: MCP Inspector pass (record date + who) and the Claude.ai custom-connector test (record date).

## 10. Compliance (seven acknowledgements)
Directory guidelines; first-party API; no financial transactions; no AI media generation; no prompt-injection patterns in tool descriptions (our descriptions describe the tool and redirect to sibling tools only); no conversation-data collection beyond the tool call; public documentation exists. All true — tick all seven.

## 11. After submitting
Track at https://claude.ai/admin-settings/directory/submissions. Expect a Community listing after the automated scan; Verified review is Anthropic's call. Do not resubmit while pending. Escalations: `mcp-review@anthropic.com`.
```

Write the Description and the Test-account instruction text out in full (no placeholders); keep them free of internal metrics and customer names.

- [ ] **Step 4: `escalation-email.md`**

```md
Subject: Legacy directory submission "Talonic" (slug pending-talonic) — resubmit via portal or advance?

Hello Anthropic MCP review team,

We submitted the Talonic remote MCP server (https://mcp.talonic.com) to the Connectors Directory through the original form on 2026-05-12. In the new submissions dashboard it appears as "Talonic (legacy form submission)", slug pending-talonic, review state "In review", health "Not live", and it has not moved since.

Since then the server has grown from 11 to 29 public tools — all with titles and read-only/destructive hints, every tool functionally tested — with OAuth 2.1, public documentation (https://talonic.com/docs/mcp), a privacy policy (https://talonic.com/privacy) and a security disclosure channel (safety@talonic.ai). It is already live in the ChatGPT App Directory and the official MCP Registry.

Could you tell us whether the legacy entry can be advanced, or whether we should withdraw it and resubmit through the portal (we have the full submission prepared)? If the slug "talonic" can be released for the new submission, that would be ideal.

Thank you,
Hamlet Hayrapetyan — Head of Product, Talonic (hamlet@talonic.ai)
```

- [ ] **Step 5: Commit**

```bash
git add docs/claude-connectors-directory
git commit -m "docs(directory): Claude Connectors Directory resubmission package + escalation email

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Consistency sweep and final verification

- [ ] **Step 1: Sweep** — run and fix every present-tense hit (leave dated history):

```bash
rg -n -i -E "\b(eleven|sixteen|twenty-two)\b|\b(11|16|22) (public )?tools\b|0\.1\.7[0-6]\b" README.md AGENTS.md CLAUDE.md STATUS.md docs/*.md docs/architecture docs/chatgpt-apps-sdk/*.md src/content/sections docs/sections.json smithery.yaml glama.json mcp.json server.json 2>/dev/null
```

Rules: `server.json`/`package.json` versions are managed by CI — do not edit. `docs/chatgpt-apps-sdk/submission-record.md` history stays; its top summary (if any) says 29. `STATUS.md` "Resolved …" sections stay. Anything else that states the CURRENT count/version wrong → fix.

- [ ] **Step 2: Final verification** — `npm run typecheck && npm run format:check && npm test && npm run build && npm run preflight:chatgpt` → all green; record the totals. `git status --short` → clean (only intended changes committed).

- [ ] **Step 3: Commit** (only if the sweep changed files)

```bash
git add -u README.md AGENTS.md CLAUDE.md STATUS.md docs src/content
git commit -m "docs: consistency sweep — 29 tools everywhere, no stale versions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

**Do not push.** Report: commits, the sweep's before/after hit counts, final test totals, preflight line, and the exact list of what Hamlet must do himself (push = release; portal steps 0, 3-icon, 6-verify, 9-credentials; send the email).
