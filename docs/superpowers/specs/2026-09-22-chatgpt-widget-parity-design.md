# ChatGPT widget parity and Apps SDK polish — design

**Date:** 2026-09-22 · **Status:** approved (design walkthrough with Hamlet, 2026-09-22) · **Sub-project:** 1 of 3 (2 = Run/Specs/Ask tools, 3 = housekeeping + Claude directory push)

## Goal

Every public tool on `mcp.talonic.com` renders a branded ChatGPT Apps SDK card, and the ChatGPT surface is complete and consistent: status strings, model-facing widget descriptions, submission manifest, listing copy, tests. Today 11 of 22 tools have a widget (`tests/widgets/all-widgets.test.ts` still locks "11 total"); the 6 Field Registry tools (0.1.76) and the 5 Agent-task tools (0.1.75) render as generic API entries in ChatGPT.

Decisions taken in the walkthrough:

- **All 22 tools stay visible in ChatGPT and all 22 get a widget** (agent-task tools included — ChatGPT agent mode is a legitimate worker surface; the descriptions already carry the USE WHEN / NOT FOR guard rails).
- **Purpose-built widget per tool on the existing scaffold** (`buildWidgetHtml` + `registerWidget`), not a generic JSON card and not a template-engine rewrite of the approved widgets.

## Non-goals

- New tools (sub-project 2). Docs surfaces are untouched except where a tool's description changes.
- Changing the widget isolation domain (`https://talonic.com`) or the empty CSP — both passed OpenAI review.
- Restyling the 11 approved widgets beyond what the shared-helper additions require.

## Design

### 1. Eleven new widgets

One file per widget in `src/widgets/`, each exporting `get<Name>WidgetHtml()` built from a `RENDER_BODY` string like the existing ones. Payload = the tool's `structuredContent` (the API JSON the tool returns; shapes captured live on 2026-09-22 and mirrored in the fixtures).

| Tool | Widget file · URI key | What the card shows |
| --- | --- | --- |
| `talonic_list_fields` | `field-list.ts` · `listFields` | Table: display/canonical name, data type chip, maturity chip (core / proven / candidate with distinct tones), occurrence count, `superseded_by` marker; footer with `pagination.total` and "more" hint. |
| `talonic_get_field` | `field-card.ts` · `getField` | Concept card: name + maturity/tier chips; definition (description or instruction, clamped), synonyms chips; occurrence tiles (occurrence_count, document_count, occurrence_rate %, first/last seen); top values bar list (`values.top[]` value/count/share); usage tiles (schema_count, schema_field_count); `resolution.matched_by` + `redirected_from` note when present. |
| `talonic_field_values` | `field-values.ts` · `fieldValues` | Header with canonical_name + total; table: value (mono), document filename + type, confidence bar, provenance (`raw_field_name`, `source_text` clamped, `needs_confirmation` badge). |
| `talonic_find_data` | `find-data.ts` · `findData` | Query header; four plane sections from `result.{fields,values,documents,passages}`: fields (name, type, tier, occurrence, score bar, sample values), values, documents (filename, score, best_passage clamped), passages (filename, text clamped). Empty planes are skipped; all-empty → empty state. |
| `talonic_list_agent_tools` | `agent-tools.ts` · `listAgentTools` | Header with `invocable_count` / `totalCount`; table: name (mono), description clamped, impact chip (read / draft_mutation / live_mutation tones), capability chip, invocable ✓/–. |
| `talonic_invoke_agent_tool` | `agent-tool-result.ts` · `invokeAgentTool` | Header "tool · result"; `result` rendered by shape: array of objects → data table (union of keys, first 12 columns, 50 rows, "+n more"); object of scalars → key/value tiles; nested → collapsible JSON tree (`<details>`); scalar/string → preformatted block. Citations and artifacts listed when present. |
| `talonic_list_agent_tasks` | `agent-task-list.ts` · `listAgentTasks` | Worklist table: task id (short mono), status chip (available / claimed / submitted / timed_out / cancelled tones), document id (short), phase, lease_expires_at, timeout_at (relative time text), epoch; empty state "No agent tasks". |
| `talonic_get_agent_task` | `agent-task.ts` · `getAgentTask` | Task card: status chip, ids, timing tiles (claimed_at, lease_expires_at, timeout_at, timeout_fallthrough); instructions block; output contract table (key, dataType chip, required); input snapshot as key/value table (or JSON tree when nested). |
| `talonic_claim_agent_task` | `agent-task-lease.ts` · `claimAgentTask` | Lease card: "Claimed" headline, execution_epoch (big), lease_expires_at + timeout_at tiles, then the same task payload sections as `agent-task.ts` (claim returns the full payload). Shared render helpers between the two files. |
| `talonic_heartbeat_agent_task` | `agent-task-lease.ts` (same HTML, different URI) · `heartbeatAgentTask` | Same lease card with "Lease extended" headline (the payload is metadata-only; sections without data are skipped). |
| `talonic_submit_agent_task` | `agent-task-submitted.ts` · `submitAgentTask` | Confirmation: "Submitted" headline, status chip, submitted_at, document/pipeline ids, epoch. |

Registration: 11 entries added to `WIDGET_URIS` (`src/widgets/types.ts`), to the `getWidgetTemplateHtml` map and `registerWidgets()` (`src/widgets/register.ts`), and each tool's `registerTool` config gains `_meta: { ui: { resourceUri }, "openai/outputTemplate": uri }` (`fields.ts`, `agent-tools.ts`, `agent-tasks.ts`). The admin agent-task variants get **no** widget and no template (internal, probe-gated).

### 2. Shared helpers (`src/widgets/shared.ts`)

Add to `HELPERS_JS`, used by the new widgets and available to the old ones without changing their output:

- `chip(text, tone)` — tone ∈ `""|"good"|"warn"|"bad"|"info"`; CSS `.chip.good/.warn/.bad/.info`.
- `clamp(text, n)` — safe truncation with ellipsis.
- `shortId(uuid)` — first 8 chars, full id in `title`.
- `relTime(iso)` — "in 4m" / "3h ago" / "—".
- `dataTable(rows, columns?)` — array-of-objects → `<table>` (escapes cells, `fmt` for nested), caps at 50 rows / 12 columns with a "+n more" footer.
- `kvTiles(obj)` — flat object → `.grid` of `.kv` tiles.
- `jsonTree(value)` — nested value → `<details>` tree, depth-limited (6), node-limited (400).

CSS additions: chip tones, `.plane` section spacing, `details.tree` styling, `.clamp` overflow rule. No new fonts, no external assets (CSP stays empty).

### 3. Apps SDK metadata polish (all 22 tools, all 22 widget resources)

- Tool `_meta` gains `"openai/toolInvocation/invoking"` and `"openai/toolInvocation/invoked"` (≤ 64 chars each, e.g. `"Extracting structured data…"` / `"Extraction ready"`). One `TOOL_INVOCATION_STATUS` table in `src/widgets/types.ts` keyed by tool name, applied through a small `widgetToolMeta(uriKey)` helper so every tool builds its `_meta` the same way.
- Widget resource `_meta` gains `"openai/widgetDescription"` (one sentence the model sees when the component loads) and `"openai/widgetPrefersBorder": true`. `registerWidget()` takes the description from its existing `description` option; `widgetMeta()` takes an optional description.
- The public template fast path in `http-server.ts` already returns `widgetMeta()`; it must return the same enriched meta, so the fast path reads the description from a `WIDGET_DESCRIPTIONS` map (single source of truth shared with `registerWidgets`).

### 4. Alignment fix: surface tagging on raw-fetch tools

`src/tools/_http.ts#apiJson` and `agent-tasks.ts#callApi` call global `fetch`, so registry, agent-tool and agent-task calls carry no `User-Agent: talonic-mcp/<v> <client>` tag and the platform's funnel cannot attribute their surface. Fix: `createServer` exposes its `taggedFetch` to the raw-fetch tools (a `getFetch` accessor passed alongside `getToken`; default `fetch` keeps unit tests and library callers working), `apiJson`/`callApi` use it. Locked by extending `tests/surface-tagging.test.ts`.

### 5. ChatGPT submission record and listing collateral

- `chatgpt-app-submission.json`: add the 7 missing tools (`talonic_get_pricing`, `talonic_get_usage`, the 5 agent-task tools) with annotations + justifications mirroring the server's annotations, plus test cases for the metering pair and the agent-task loop; keep the schema (`chatgpt-app-submission.v1.json`). A test (`tests/submission-manifest.test.ts`) asserts the manifest's tool set == the server's public tool set and that each manifest annotation matches the registered annotation.
- `docs/chatgpt-apps-sdk/listing-copy.md`: tool list 9 → 22, grouped (extraction, workspace, metering, registry, agent tasks).
- `docs/chatgpt-apps-sdk/developer-mode-testing.md`: a 22-row card checklist for the live pass after release.
- `docs/chatgpt-apps-sdk/submission-record.md`: 2026-09-22 entry (22 tools, widget parity restored, OpenAI auto-tracks tool changes per their docs — metadata edits still need a new version).
- Commit the 5 untracked screenshots under `docs/chatgpt-apps-sdk/screenshots/` (drop `.DS_Store`).

## Tests

1. `tests/widgets/all-widgets.test.ts`: `TOOL_WIDGET_MAP` → 22 entries; coverage lock "22 total"; every resource meta has `openai/widgetDescription` (non-empty) and `openai/widgetPrefersBorder === true`.
2. `tests/widgets/tool-annotations.test.ts`: cover all 22 public tools (add the 6 registry tools: read-only, non-destructive, not open-world) and assert `openai/toolInvocation/*` strings exist and are ≤ 64 chars for all 22.
3. **New** `tests/widgets/render/*.test.ts` (jsdom, `// @vitest-environment jsdom`, `jsdom` added as a devDependency): for each of the 22 widgets, load the template into a jsdom window, inject `window.openai = { toolOutput: fixture }`, run the scripts, and assert visible text (names, counts, chips). Three cases per widget: realistic fixture, empty payload (`{}` → empty-state text, no throw), malformed payload (wrong types → no throw, empty state or partial render). Fixtures live in `tests/widgets/fixtures/*.json`, **synthesised from the live shapes with generic names and ids** (no customer filenames or workspace identifiers).
4. `tests/http-server.test.ts`: the unauthenticated template fast path serves every `WIDGET_URIS` value (parametrised), and its `_meta` carries the description.
5. `tests/widgets/template-hygiene.test.ts`: every template has no `tlnc_`, no `Authorization`, no unescaped `${`, no `<script src`, and parses as HTML (jsdom without errors).
6. `tests/surface-tagging.test.ts`: raw-fetch helper forwards the tagged fetch.
7. `tests/submission-manifest.test.ts`: manifest ↔ server parity (see §5).

Existing suites (265 tests) must stay green; `npm run typecheck`, `npm run format:check`, `npm run build` pass.

## Verification and release

- Local: `npm test`, `typecheck`, `format:check`, `build`; then `scripts/chatgpt-preflight.mjs` (new): starts `dist/http-server.js` on an ephemeral port with a dummy key, performs `initialize` + `tools/list`, asserts 22 public tools each with `openai/outputTemplate`, fetches every template through the unauthenticated fast path exactly as ChatGPT's renderer does, and exits non-zero on any miss. This script is also the manual smoke for future releases.
- Release: **one push to `main` after Hamlet's go** (a push is a release: npm 0.1.77, Registry, GitHub Release, redeploy of `mcp.talonic.com`). The commit touches `src/tools/**`, so `docs/sections.json` gets its tool descriptions mirrored (drift guard) — no user-visible doc change is expected on `/docs/mcp/*` beyond wording parity.
- Post-release: ChatGPT developer-mode pass over the 22-row checklist (reconnect the connector first — ChatGPT caches `tools/list` at connect time); record results in `submission-record.md`.

## File inventory

- New: `src/widgets/{field-list,field-card,field-values,find-data,agent-tools,agent-tool-result,agent-task-list,agent-task,agent-task-lease,agent-task-submitted}.ts`, `tests/widgets/render/*.test.ts`, `tests/widgets/fixtures/*.json`, `tests/widgets/template-hygiene.test.ts`, `tests/submission-manifest.test.ts`, `scripts/chatgpt-preflight.mjs`.
- Modified: `src/widgets/{shared,types,register}.ts`, `src/tools/{fields,agent-tools,agent-tasks,_http}.ts`, `src/server-factory.ts`, `src/http-server.ts`, `tests/widgets/{all-widgets,tool-annotations}.test.ts`, `tests/{http-server,surface-tagging}.test.ts`, `chatgpt-app-submission.json`, `docs/chatgpt-apps-sdk/*.md`, `docs/sections.json` (mirror), `package.json` (+jsdom dev), `CHANGELOG.md` (Unreleased), `AGENTS.md` (widget map note).
