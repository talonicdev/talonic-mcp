# Housekeeping and Claude Connectors Directory readiness — design

**Date:** 2026-09-22 · **Status:** approved in outline (Hamlet, 2026-09-22: "then do the housekeeping and, based on the fully updated MCP, we will do the Claude directory push") · **Sub-project:** 3 of 3 (1 = widget parity, 2 = Run/Specs/Ask tools — both local on `main`, unpushed)

## Goal

Bring every repo-facing and reviewer-facing record of the MCP server in line with what the code now is (29 tools, 29 widgets, 0.1.76 live → 0.1.77 pending), close the review-criteria risks Anthropic's checklist would flag, and produce a complete, paste-ready resubmission package for the Claude Connectors Directory — so that the only remaining step is Hamlet clicking through the portal after the release.

## Current debt (measured 2026-09-22)

- `CHANGELOG.md`: last versioned entry `0.1.52 — 2026-06-01`; 24 releases (v0.1.53 … v0.1.76) have no entries; the `[Unreleased]` section mixes shipped 0.1.56/0.1.72/0.1.76 items with the genuinely unreleased sub-project 1/2 bullets.
- `STATUS.md` (454 lines): TL;DR says 0.1.71 / 11 tools / 180 tests; Surfaces tables carry stale versions (npm 0.1.71, node 0.1.22, Registry 0.1.44), a Downloads path for the website repo, and a "Follow-ups" section written in May.
- `docs/sections.json`: brought to 29 by sub-project 2 Task 9 (verify).
- `talonic_invoke_agent_tool`: annotated `readOnlyHint: true` yet it is a pass-through into a 69-tool registry (22 live-mutation, 10 draft-mutation). Safe today because API-key credentials only receive `data.read` (verified live: all 36 invocable tools are read-impact), but Anthropic's review criteria reject "one tool for safe and unsafe operations" and require custom-query tools to name their target API docs. The description must make the restriction and the docs reference explicit.
- Claude Connectors Directory: our 2026-05-12 legacy-form submission has sat "In review / Not live" for 4+ months; the process moved to a Team-admin portal that auto-scans and lists as **Community** by default. No resubmission package exists.
- Cowork plugin submission: never done (optional, out of scope here beyond a one-line decision note).

## Design

### 1. CHANGELOG backfill (Keep a Changelog, SemVer)

Replace the current `[Unreleased]` block and insert one heading per shipped release, dated from the tags, grouped by theme (each release's source commits are in the plan):

- 0.1.53–0.1.57 (2026-06-03): widget host channel fix, docs refresh for the 9-tool surface, widget domain declaration, branded cards for all 9 tools, stat-tile styling.
- 0.1.58–0.1.61 (2026-06-08): ChatGPT submission hardening (annotations, CSP/origin, bridge), Apps SDK domain-verification challenge, filter condition schema clarification, challenge token update.
- 0.1.62–0.1.66 (2026-06-09/12): stateless MCP transport, null scalars on pre-processing docs, tightened agent-facing descriptions, widget templates fetchable from the ChatGPT sandbox, literal-keyword search contract.
- 0.1.67 (2026-06-20): broadened semantic signal / softened schema-required (Phase 1); App Directory approval recorded.
- 0.1.68–0.1.70 (2026-06-21): `talonic_get_pricing` + `talonic_get_usage`, their docs.
- 0.1.71 (2026-06-23): outbound User-Agent client tagging.
- 0.1.72 (2026-07-07): widgets for pricing + usage (11/11).
- 0.1.73 (2026-07-22): npm keywords, provenance attestations, `smithery.yaml`.
- 0.1.74 (2026-08-17): superadmin-only growth analytics tools (internal), `uploading` status + failure terminals in the handoff lifecycle.
- 0.1.75 (2026-08-19): Agent task workflow (5 tenant tools + 5 admin variants).
- 0.1.76 (2026-09-05): six Field Registry tools, npm trusted publishing, docs quality pass.

`[Unreleased]` keeps ONLY the sub-project 1 and 2 bullets (widget parity 22/22 → 29/29, Apps SDK metadata, surface tagging fix, Specs/Run/Ask tools) with a note that the publish workflow assigns the version (0.1.77) on release. A lock test `tests/changelog.test.ts` asserts: headings are strictly descending semver, each `## [x.y.z] - YYYY-MM-DD` has a valid date, every tag from `v0.1.53` to the current `package.json` version has a heading (versions list hard-coded in the test from `package.json` down to 0.1.45 by decrementing the patch), and `[Unreleased]` is non-empty when the package version equals the latest heading.

### 2. STATUS.md re-audit

Rewrite the **TL;DR** and **Surfaces** tables to 2026-09-22 facts: `@talonic/mcp` 0.1.76 on npm and mcp.talonic.com, local `main` carries the unpublished 0.1.77 (29 tools, 29 widgets, test count from the final run), `@talonic/node` 0.1.25, website lockfile pins (read them), Registry 0.1.76 isLatest, `docs/sections.json` 29 entries. Replace the "Follow-ups (ordered by leverage)" section with a short **Open items 2026-09-22** list (release 0.1.77 pending go; Claude directory resubmission via portal; Cowork submission decision; PyPI publisher fix for the Python SDK; `[skip docs]`-guard note). Keep the resolved-history sections and the end-to-end test transcripts as they are (they are dated records), fix the website path to `~/Talonic/website`, and update the "Last audit" line. Add a one-line pointer to `docs/claude-connectors-directory/` (§4).

### 3. Review-criteria hardening of `talonic_invoke_agent_tool`

Description gains two sentences: "API-key credentials are restricted by the platform to the registry's read-only tools (capability `data.read`); write-capable registry tools are never invocable through this credential, so this tool reads and never mutates." and "Target API: Talonic agent tool registry — https://talonic.com/docs/api (POST /v1/agent/tools/{name}/invoke)." Keep `readOnlyHint: true`. Mirror the wording in `src/content/sections/tools.ts` (the `talonic-invoke-agent-tool` section) and the dormant mirror. Lock with a test in `tests/tools/descriptions.test.ts`: the description contains "read-only" and "https://talonic.com/docs/api". Also add the same docs URL sentence to `talonic_list_agent_tools` (it exposes `input_schema`s the model uses to construct arguments).

### 4. Claude Connectors Directory resubmission package

New folder `docs/claude-connectors-directory/` with three files:

- `resubmission-2026-09.md` — every portal field pre-filled (from claude.com/docs/connectors/building/submission, fetched 2026-09-22): Connection (server URL `https://mcp.talonic.com/mcp`, transport Streamable HTTP, Universal URL); Tools (auto-synced — 29, all with title + hints; note which are read vs write); Listing (name "Talonic", tagline ≤ 55 chars "Extract validated structured data from any document", description ≤ 2000 chars — written out, categories Productivity / Developer Tools / Data & Analytics, documentation URL `https://talonic.com/docs/mcp`, privacy URL `https://talonic.com/privacy`, support contact `info@talonic.ai`, slug `talonic`, icon `Logo 400px.png` (path noted; Hamlet uploads)); Use cases (3 written out; reads and writes; needs a Talonic account + API key or OAuth); Company; Authentication (OAuth 2.1 — reuse the 2026-05-12 answers recorded in STATUS.md, verify the authorization-server metadata endpoint responds); Data handling (own first-party API, no PHI, no sponsored content); Test & launch (placeholder for the test account Hamlet creates — instructions text written, credentials left blank); Compliance (the seven acknowledgements listed so he can pre-read them); Allowed link URIs (`https://app.talonic.com`, `https://talonic.com`); Pre-submission checklist results (every tool exercised — link to the live smoke + preflight outputs; MCP Inspector pass to be done by Hamlet or recorded if possible).
- `escalation-email.md` — a paste-ready email to `mcp-review@anthropic.com`: legacy-form submission of 2026-05-12, slug `pending-talonic`, still "In review", asking whether to resubmit through the portal or have the legacy entry advanced; states the server facts (22 → 29 tools, all annotated, public docs, privacy policy, OAuth 2.1).
- `README.md` — how the folder relates to the ChatGPT folder and when to update it.

Also refresh `docs/chatgpt-apps-sdk/listing-copy.md`'s Claude-facing counterpart if one exists (it does not — so the Claude listing copy lives in `resubmission-2026-09.md`).

### 5. Consistency sweep

A single `rg`-driven pass over the repo for stale counts and versions after sub-projects 1–2 (`eleven|sixteen|twenty-two|22 tools|11 tools|0\.1\.7[0-6]`) in `README.md`, `AGENTS.md`, `CLAUDE.md`, `STATUS.md`, `docs/**/*.md`, `src/content/sections/*.ts`, `docs/sections.json`, plus `smithery.yaml` / `glama.json` / `mcp.json` sanity. Fix what is wrong; leave dated historical records (submission-record.md history, STATUS resolved sections) untouched.

## Non-goals

- Pushing / releasing (Hamlet's go).
- Clicking through the Anthropic portal or sending the email (Hamlet; the package is paste-ready).
- Cowork plugin submission (a decision note only).
- Typing raw-fetch registrars as `TokenSource` (follow-up noted in sub-project 1's review).

## Tests

- `tests/changelog.test.ts` (structure + coverage lock, §1).
- `tests/tools/descriptions.test.ts` additions (§3).
- Existing suite stays green; `npm run preflight:chatgpt` green.

## Verification

Full chain (`typecheck`, `format:check`, `test`, `build`, `preflight:chatgpt`), `rg` sweep shows no stale counts, and a read-through of the three directory files against the fetched portal steps. Then the closing report to Hamlet with the push/go decision and the exact portal steps he performs.
