# Upstream merge + decision-task parity — design (sub-project 2b)

**Date:** 2026-09-22 · **Status:** controller ruling R11 on the sub-project 2 final review (Hamlet's standing directive: "fully align the MCP tools with the ChatGPT widget … ChatGPT works perfectly"); to be confirmed by Hamlet in the closing report · **Position:** between sub-project 2 (Run/Specs/Ask) and sub-project 3 (housekeeping + directory)

## Why this exists

While sub-projects 1–2 were built on local `main`, `origin/main` moved: PR #22 (`feat(tools): wrap the /v1/decision-tasks protocol for External-mode Apps`, nordsiek, 2026-09-22) landed and CI published **@talonic/mcp 0.1.77** with seven new public tools — `talonic_list_decision_tasks`, `talonic_claim_decision_task`, `talonic_read_decision_package`, `talonic_heartbeat_decision_task`, `talonic_submit_decision_task`, `talonic_release_decision_task`, `talonic_fail_decision_task` — plus their docs sections, nav entries, description/annotation test rows, an `apps:decide` OAuth scope, and a `decisionTasksInvocable` listing flag. Local `main` is ahead 33 / behind 3 and cannot be pushed. After a merge the public surface is **36** tools, and this program's own locks (widget parity, manifest parity, preflight constant, content lock) go red for the seven decision-task tools, which have no widgets, manifest entries or mirror entries.

Exempting them would reopen exactly the gap Hamlet asked to close, so the ruling is: **merge, then bring the seven to full parity**, and fold in the sub-project 2 final review's remaining findings. The release becomes **0.1.79** (upstream also shipped 0.1.78 = PR #23, a CI-only registry-wait fix).

## Scope

1. **Merge `origin/main` into local `main`** (merge commit, not rebase — the reviewed commits keep their SHAs). Conflict rules: keep BOTH sides' tool registrations, instruction sentences, docs sections, nav entries and test-list rows; take upstream's `package.json` / `server.json` versions (0.1.77); keep our `http-server.ts` changes (TALONIC_BASE_URL passthrough, `getWidgetTemplateMeta`) and theirs (`DECIDE_SCOPE`, `decisionTasksInvocable`); `docs/sections.json` → ours (43 entries) then regenerate for the seven decision tools; every count that either side wrote as twenty-nine/29 becomes thirty-six/36.
2. **Seven widget keys + four widget files:** `decision-task-list.ts` (worklist), `decision-bundle.ts` (the claim: task metadata, output contract, precedents, package descriptor, documents), `decision-package.ts` (one package page: records table/tree, page info, first-page documents), and `decision-task-card.ts` — one factory producing the four metadata cards for heartbeat ("Lease extended"), submit ("Decision submitted"), release ("Task released"), fail ("Task failed"). Shared `DECISION_JS` (status tones incl. `released`/`failed`, metadata tiles: run, app, epoch, claimed_by, lease, SLA). `_meta: widgetToolMeta(key)` on all seven (also when `invocable: false` — the card still renders the 403 explanation path? No: a non-invocable tool returns an error, not structuredContent; the meta is harmless).
3. **Locks and collateral at 36:** `TOOL_WIDGET_KEYS` (+7), `widget-registry` counts, `all-widgets`/`submission-manifest` literals, `EXPECTED_TOOLS`, manifest entries (annotations mirror the server: list/read = read-only; claim/heartbeat/submit/release/fail = write, none destructive, none open-world) + one test case covering the seven, `docs/sections.json` (+7 via the generator → 50), counts in README / AGENTS / CLAUDE.md / mirror intro ("thirty-six"), CHANGELOG `[Unreleased]` (remove the 22-vs-29 self-contradiction; note the release is 0.1.78; add a bullet for the decision-task widgets).
4. **Sub-project 2 final-review fixes:** `talonic_get_run_results` accepts `run_id` together with `pipeline_id` (forwarded as the `run_id` query param on the pipelines route; XOR only when neither or both ids are absent); `RUN_DESCRIPTION` / `RESULTS_DESCRIPTION` and the two docs sections say "poll with `pipeline_id` when `run_kind` is 'pipeline', with `run_id` when it is 'run'"; `run-status` widget renders unknown counters as "—" not 0; `handleGetAnswer` backfills `ask_id` from the argument; ask polls carry `AbortSignal.timeout(max(1000, deadline − now))` (an optional `signal` in `apiJson` opts); `wait_seconds` clamp test with injected clock + `Number.isFinite` guard; artifact-href negative test (`javascript:` link renders no anchor); `mapRunStatus` also folds `canceled`; `spec-list` / `run-results` get the `!payload || typeof payload !== "object"` guard; `run_spec` docs response table lists `spec_name`, `enqueued_documents`, `appended`, `message`.
5. **Website:** merge `origin/main` (lockfile-only upstream commit), seven decision-task pages + registries + sitemap + mcp.json entries + hub prose at thirty-six; **push order** recorded: talonic-mcp first → CI publishes 0.1.79 → website `npm update @talonic/mcp` + lockfile commit → website push.

## Non-goals

Changing decision-task tool behaviour (upstream's code stands); the platform observations from the smoke (handed to the platform team); sub-project 3's housekeeping (follows this).

## Tests

Render tests (realistic / empty / malformed) for the four widget files (seven cards — the factory cards share one test file), XSS map +7, all existing locks at 36, new tests for each item in §4, mirror content lock 36/36, preflight 36. Full chain green; `npm run preflight:chatgpt` prints 36.

## Verification and release

Full chain + preflight; `git status` clean; local `main` ahead of `origin/main` with no divergence (`behind 0`). Release 0.1.79 on Hamlet's go; website after the pin bump.
