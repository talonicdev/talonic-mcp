# Run, Specs and Ask tools — design

**Date:** 2026-09-22 · **Status:** approved in outline (design walkthrough with Hamlet, 2026-09-22: "Run + Specs + Ask"); detailed design self-reviewed by Claude · **Sub-project:** 2 of 3 (1 = widget parity, shipped locally on `main`; 3 = housekeeping + Claude directory push)

## Goal

Let an MCP agent run a customer's **real configured pipeline** (a Spec) and **ask questions over the workspace**, instead of only one-shot schema extraction. Seven new public tools on the raw-fetch path, each with a ChatGPT widget so parity holds (22 → 29), documented on both docs surfaces and on the website, test-locked and listed in the ChatGPT submission manifest.

Live routes verified on 2026-09-22 against `api.talonic.com` with a workspace API key: `GET /v1/specs`, `GET /v1/specs/{id}`, `GET /v1/specs/{id}/versions`, `POST /v1/run`, `GET /v1/run/{id}`, `GET /v1/run/{id}/results`, `POST /v1/pipelines`, `GET /v1/pipelines/{id}`, `GET /v1/pipelines/{id}/progress`, `GET /v1/pipelines/{id}/results`, `POST /v1/ask`, `GET /v1/ask/{id}`.

## Decisions

- **Seven tools, not six.** The approved outline said "ask (start and wait, with poll fallback)". The poll fallback is a separate read-only tool, `talonic_get_answer`, rather than an `ask_id` mode on `talonic_ask`: Anthropic's review criteria reject tools that mix read and write behaviour, and a dedicated read tool is clearer for the model. Flagged for Hamlet in the report.
- **Two backends, one contract.** Running on documents already in the workspace uses `POST /v1/pipelines` (`schema_id` = the Spec id, `document_ids[]`); running on remote files uses `POST /v1/run` (multipart, `spec_id`, `file_urls[]`). `talonic_run_spec` accepts exactly one of `document_ids` / `file_urls` and returns one normalised envelope; `talonic_get_run` and `talonic_get_run_results` accept `pipeline_id` (pipelines path) or `run_id` (`/v1/run` path) and normalise the same way.
- **Bounded wait for Ask.** `talonic_ask` starts the ask and polls `GET /v1/ask/{id}` every 2 s for up to `wait_seconds` (default 45, max 55 — under the ~60 s tool-call ceiling of hosted clients). Completed → the answer; still processing → `{ status: "processing", ask_id, conversation_id }` and the description tells the agent to call `talonic_get_answer`.
- **No SDK dependency.** `@talonic/node` (0.1.25) has no specs/run/ask resources; the tools use `src/tools/_http.ts` (`apiJson`, new `apiForm`) with the server's `TokenSource` fetch so they carry the surface tag.
- **Widgets one-to-one.** Seven `WIDGET_URIS` keys; `ask` and `getAnswer` share one HTML factory (headline differs), like the lease widgets.

## Tools

All names, annotations and shapes below are binding.

| Tool | Method | Annotations | Purpose |
| --- | --- | --- | --- |
| `talonic_list_specs` | `GET /v1/specs` (`limit`, `cursor`, `search`, `order`) | readOnly, non-destructive, not open-world, idempotent | List the workspace's Specs: id, name, description, `schema_id`, `version`, `materialized_version`, `field_count`, `node_count`, timestamps, links; cursor pagination. |
| `talonic_get_spec` | `GET /v1/specs/{id}` (+ optional `GET /v1/specs/{id}/versions` when `include_versions`) | readOnly | One Spec's structure: identity, version state, `schema`, `nodes[]` (rail as authored), `phases[]` (compiled plan), `fields[]`, optional `versions[]`. |
| `talonic_run_spec` | `POST /v1/pipelines` or `POST /v1/run` | readOnly **false**, destructive false, **openWorld true** (file URLs are fetched) | Run a Spec over `document_ids[]` (1–500, workspace documents) **or** `file_urls[]` (1–20, `https://`); optional `name`, `pipeline_mode` (`new`/`append`), `batch_id`, `metadata` (flat object; `/v1/run` path only). Returns the normalised **RunEnvelope** (below). |
| `talonic_get_run` | `GET /v1/run/{id}` or `GET /v1/pipelines/{id}` + `GET /v1/pipelines/{id}/progress` | readOnly | Poll a run: normalised `status` (`processing` / `completed` / `failed`) + `raw_status`, `progress` (`total_documents`, `completed_documents`, `error_documents`, optional `phases[]` from the pipeline progress route), `documents[]` when the API returns them, `pipeline_id`, `run_id`, `spec_id`. |
| `talonic_get_run_results` | `GET /v1/run/{id}/results` or `GET /v1/pipelines/{id}/results?view=documents&run_id=` | readOnly | Structured rows: `columns[]` (`field_key`, `display_name`, `data_type`), `data[]` (document_id, filename, status, `fields` {key → value}, optional `cells`/`provenance` when `include`), `pagination`, `pending_review_count`, `status`. Args: `limit` (≤ 200), `cursor`, `document_id`, `include` (`cells`,`provenance`). |
| `talonic_ask` | `POST /v1/ask` then poll `GET /v1/ask/{id}` | readOnly **false** (consumes credits; may extract-and-persist fields), destructive false, not open-world | `question` (required), optional `scope` (document_ids, schema_id, pipeline_id, data_product_id, document_type, source_id, tags, ingested_after/before), `conversation_id`, `output_format` ({instruction, template}), `wait_seconds` (0–55, default 45). Returns the **AnswerEnvelope**. |
| `talonic_get_answer` | `GET /v1/ask/{id}` | readOnly | `ask_id` → the AnswerEnvelope (or `status: "processing"`). |

**RunEnvelope** (both backends): `{ run_kind: "pipeline" | "run", run_id: string | null, pipeline_id: string | null, spec_id, status, raw_status, input_count, progress?: {...}, documents?: [...], message?, links }` — `run_kind: "pipeline"` when started via `document_ids` (`pipeline_id` set, `run_id` = the submission-group id the API returns), `"run"` when started via `file_urls` (`run_id` set, `pipeline_id` null until compiled). Status mapping for the pipelines path: `active|running|finalizing|queued|pending` → `processing`; `completed` → `completed`; `failed|error|cancelled` → `failed`; anything else → `processing` with the raw value preserved.

**AnswerEnvelope**: the `GET /v1/ask/{id}` body passed through (`ask_id`, `status`, `conversation_id`, `answer` markdown, `citations[]`, `cards[]`, `artifacts[]`, `tool_calls`, `verification` {verdict, checks_total, checks_unsupported, correction}, `usage` {tokens, credits_charged}), plus `waited_ms` (how long the tool waited) and, while processing, `poll_hint: "call talonic_get_answer with ask_id"`.

Validation at the MCP layer (fail fast with `validationError`): exactly one of `document_ids`/`file_urls`; `file_urls` must be `https://`; `metadata`/`batch_id` only with `file_urls` (the pipelines route has no such fields — reject with a clear message rather than dropping silently); `wait_seconds` clamped 0–55; exactly one of `run_id`/`pipeline_id` for the two poll tools.

Descriptions follow the repo convention (one-line WHAT, USE WHEN / NOT FOR, ARGS, RETURNS) and spell out the flow: list specs → run → poll `talonic_get_run` every 5–10 s until `completed`/`failed` → `talonic_get_run_results`; for documents not yet in the workspace: `talonic_request_upload` → poll `talonic_get_document` → `talonic_run_spec` with `document_ids`. `talonic_ask` says it costs credits and that `talonic_filter`/`talonic_field_values` are the free path for known fields.

## Raw-fetch helper additions (`src/tools/_http.ts`)

- `apiJson` gains `method: "GET" | "POST" | "PATCH" | "DELETE"` (type only; no behaviour change).
- `apiForm(getToken, baseUrl, path, fields: Record<string, string | string[] | undefined>)` — builds a `FormData` (Node 22 global), appends string fields and repeats array fields under the same key (`file_urls`), sends `POST` with the bearer, `Accept: application/json`, **no** manual `Content-Type` (undici sets the multipart boundary); same error envelope as `apiJson`; uses `resolveFetch(getToken)`.
- `sleep(ms)` helper for the ask poll loop, injectable for tests (`{ sleep?: (ms) => Promise<void> }` option on `handleAsk`).

## Widgets (7, `src/widgets/`)

| Key · file | Card |
| --- | --- |
| `listSpecs` · `spec-list.ts` | Table: name (+ description clamped), version / materialized (chip "v3 live" vs "draft"), field_count, node_count, updated relTime, schema id chip; pagination footer. Empty: "No Specs in this workspace." |
| `getSpec` · `spec-card.ts` | Header name + chips (version, materialized, field_count); rail as ordered chips of `nodes[].type` (source → … → deliver) with names; phases table (number, type, name); fields count + first 12 field names; versions list when present. Empty: "No Spec." |
| `runSpec` · `run-started.ts` | Headline "Run started" (or "Documents appended" when `appended`), run_kind chip, big input_count, tiles (spec, pipeline, run id, status), documents table when present (filename, size, deduplicated chip), hint "Poll with talonic_get_run". |
| `getRun` · `run-status.ts` | Status chip (processing=info, completed=good, failed=bad), progress bar completed/total with error count, phases table when present (name, type, completed/running/errors), documents table when present; message/error_message. |
| `getRunResults` · `run-results.ts` | Header (spec/pipeline/run ids, status chip, pending_review_count chip), `dataTable` built from `columns[]` display names and `data[].fields` (+ filename + status columns first), pagination footer. Empty: "No result rows yet." |
| `ask` · `answer.ts` (factory, headline "Answer") | Verification chip (supported=good / issues=warn / unverifiable=bad), answer rendered as pre-wrap text (markdown kept literal — no external renderer; links stay visible as text), citations list (quote clamped, filename, kind chip), artifacts, usage tiles (credits_charged, tokens, tool_calls), conversation id chip. Processing state: "Still thinking… ask talonic_get_answer with ask_id <id>" with the id chip. |
| `getAnswer` · same factory, headline "Answer (polled)" | Same card. |

All shared helpers from sub-project 1 apply; concatenation-only JS, no `${`, empty CSP unchanged.

## Docs, website, manifest

- `src/content/sections/tools.ts`: seven sections mirroring the existing shape (slug `talonic-list-specs` … `talonic-get-answer`, When to use / When not to use / Parameters / Response shape / related / faq); `src/content/seo.ts` nav entries; `docs/sections.json` entries (`mcp-talonic-list-specs` …) so the drift guard passes AND the dormant mirror stays faithful; `mcp-introduction` counts 22 → 29.
- Website (`talonicdev/website`, separate commit, not pushed): seven `src/app/docs/mcp/tools/<short>/page.tsx`, `docs-nav-routes.ts` MCP_ROUTES, `docs-sync.ts` MCP_PAGE_MAP, `next.config.ts` redirects, `sitemap.ts`, `.well-known/mcp.json` tools list, `docs/mcp/page.tsx` grid (+ run-spec and ask cards).
- `chatgpt-app-submission.json`: seven tool entries + two test cases (run a Spec end-to-end; ask a question); parity test covers them automatically.
- `AGENTS.md` table + counts, `README.md` counts (22 → 29), `CHANGELOG.md` Unreleased, `scripts/chatgpt-preflight.mjs` `EXPECTED_TOOLS` 22 → 29 with a unit test that reads the script and asserts the constant equals `Object.keys(TOOL_WIDGET_KEYS).length`.

## Tests

- `tests/tools/specs.test.ts`, `run.test.ts`, `ask.test.ts` (stubbed fetch like `fields.test.ts`): URL/method/query, multipart fields for `file_urls` (parse the `FormData` body), JSON body for `document_ids`, both normalisations, status mapping table, every validation error, ask poll loop with an injected `sleep` (completes on 3rd poll; times out → processing envelope with `waited_ms`), `wait_seconds: 0` → single GET.
- Render tests for the seven widgets (fixtures synthesised from the live `/v1/specs` shape and the OpenAPI schemas, generic names), realistic / empty / malformed each.
- Existing locks extended: `descriptions.test.ts` ALL_TOOLS, `tool-annotations.test.ts` (5 read-only + 2 write; `talonic_run_spec` open-world), `widget-registry` (29), `all-widgets` (29), `submission-manifest` parity, `template-hygiene`, `http-server` template fast path (parametrised, automatic).
- Content lock: a test that every `TOOL_WIDGET_KEYS` tool has a `src/content/sections/tools.ts` section and a `seo.ts` nav entry (closes the "discipline only" gap the docs pipeline doc admits).

## Verification and release

Local: full chain (`typecheck`, `format:check`, `test`, `build`, `preflight:chatgpt`), plus a **live smoke against production with the workspace key**: `talonic_list_specs`, `talonic_get_spec` on the first Spec, `talonic_run_spec` with `document_ids` = one existing completed document on a small Spec, poll to completion, `talonic_get_run_results`; `talonic_ask` with a cheap scoped question. Record ids and credits in the report. Release: same single push after Hamlet's go (0.1.77 carries sub-projects 1 + 2 together unless he wants them split).

## File inventory

New: `src/tools/specs.ts`, `src/tools/run.ts`, `src/tools/ask.ts`, `src/widgets/{spec-list,spec-card,run-started,run-status,run-results,answer}.ts`, 7 fixtures, 7 render tests, 3 tool test files, `tests/content/tool-sections.test.ts`, `tests/scripts/preflight-constant.test.ts`. Modified: `src/tools/_http.ts`, `src/server-factory.ts`, `src/widgets/{types,register}.ts`, `src/content/sections/tools.ts`, `src/content/seo.ts`, `docs/sections.json`, `chatgpt-app-submission.json`, `AGENTS.md`, `README.md`, `CHANGELOG.md`, `scripts/chatgpt-preflight.mjs`, `tests/{tools/descriptions,widgets/tool-annotations}.test.ts`; website repo files listed above.
