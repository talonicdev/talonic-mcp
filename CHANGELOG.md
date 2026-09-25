# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> The publish workflow assigns the version on release; after the push that publishes it, promote this block to `## [<version>] - <date>` (the changelog lock accepts the current package version living here until then).

_No unpublished changes yet._

## [0.1.82] - 2026-09-25

### Added

- **`talonic_contracts_*` tools (13), registered where the platform serves the Contracts app.** Fill and clean the Contracts register over `/v1/contracts/*`: `register`, `contract`, `issues` (cleaning worklist with the documents concerned), `upcoming`, `import_candidates`, `import` (by ids, or every unread candidate with filters, `limit` and `dry_run`), `import_status`, `update_document` (role, exclude, re-key, remove), `merge`, `reread`, `decide`, `key_date`, `set_term` (value plus verbatim quote, verified by the platform). Probe-gated like the growth tools (`GET /v1/contracts/import/status` → 200), so they never appear where they would 404. `apiJson` gains `PUT`.

## [0.1.81] - 2026-09-24

### Fixed

- **`annotations.title` on every public tool.** The six Field Registry / agent-tool registrations (`talonic_list_fields`, `talonic_get_field`, `talonic_field_values`, `talonic_find_data`, `talonic_list_agent_tools`, `talonic_invoke_agent_tool`) set only the top-level `title`; Anthropic's Connectors Directory portal reads `annotations.title` and flagged them ("Missing title annotation"). All 36 tools now carry it, locked by `tests/widgets/tool-annotations.test.ts`.
- **Decision-task descriptions are session-independent.** The seven `talonic_*_decision_task` tools no longer prepend "NOT INVOCABLE IN THIS SESSION" to their descriptions when the OAuth token lacks `apps:decide`; the marker is `_meta["talonic/can_invoke"]: false` (+ `talonic/required_scope`) only, and each description's AUTH line already explains the 403. Directory scanners and clients that cache `tools/list` had frozen the prefix into the listing text.

## [0.1.80] - 2026-09-24

### Fixed

- **RFC 9728 path-suffixed protected-resource metadata.** The hosted server now also serves `/.well-known/oauth-protected-resource/mcp` with `resource` set to the exact `https://mcp.talonic.com/mcp` URL, and every `401` names the metadata document that matches the endpoint the client used (`/mcp` → the path-suffixed document, `/` → the root one) with `error="invalid_token"`. Claude's connector review requires the advertised `resource` to equal the server URL exactly as entered, path included; previously only the root document existed and the `/mcp` lookup returned 404. No change to the authorization server, scopes, or token handling.

## [0.1.79] - 2026-09-22

### Added

- **Specs, Run and Ask tools (7 new, 36 public).** `talonic_list_specs` / `talonic_get_spec` read the workspace's configured pipelines; `talonic_run_spec` runs one over `document_ids` (`POST /v1/pipelines`) or `file_urls` (`POST /v1/run`) behind a single normalised RunEnvelope; `talonic_get_run` polls status + progress and `talonic_get_run_results` reads the rows; `talonic_ask` answers questions over the corpus with citations and verification (bounded wait) and `talonic_get_answer` polls long asks. Each has a ChatGPT card; documented on both docs surfaces; manifest and preflight at 36.
- **Decision-task widgets.** The seven `talonic_*_decision_task` tools shipped in 0.1.77 get ChatGPT cards (worklist, claim bundle, package page, and lease/submit/release/fail metadata cards), manifest entries, mirror docs and website pages.
- **Widget parity for every public tool (36 with this release).** Eleven new ChatGPT Apps SDK cards: Field Registry list / concept card / values, find-data planes, agent-tool registry, shape-adaptive agent-tool result, agent-task worklist, task card, lease card (claim + heartbeat) and submit confirmation. Every public tool now declares `openai/toolInvocation/invoking|invoked` status text; every widget resource carries `openai/widgetDescription` and `openai/widgetPrefersBorder`. Locked by `tests/widgets/all-widgets.test.ts` (36/36), jsdom render tests per widget (`tests/widgets/render/`), template hygiene and hosted fast-path tests, and `scripts/chatgpt-preflight.mjs`.
- **`chatgpt-app-submission.json` describes all public tools** and is test-locked to the server's annotations (`tests/submission-manifest.test.ts`).

### Fixed

- **Raw-fetch tools now carry the `talonic-mcp/<v> <client>` User-Agent tag.** Field Registry, agent-tool, agent-task, upload-session and webhook-reference calls bypassed the tagged fetch, so the platform funnel could not attribute their client surface.
- **Run/Ask review fixes.** `talonic_get_run_results` now accepts `pipeline_id` alone, `run_id` alone, or `pipeline_id` together with `run_id` to scope a pipeline's rows to one submission (previously the two together were rejected); `talonic_run_spec`'s description states the actual polling rule — poll `talonic_get_run` with `pipeline_id` when `run_kind` is `pipeline`, `run_id` when it is `run`. The run-status widget renders unknown `total_documents` / `completed_documents` counters as `—` instead of a misleading `0`. `talonic_ask` bounds every poll request with its own timeout (not just the overall wait), guards `wait_seconds` against non-finite input, and keeps the `ask_id` on an aborted poll instead of losing it — the ask keeps running server-side and credits are already spent; `talonic_get_answer` now backfills `ask_id` onto its response too. `mapRunStatus` folds the API's `canceled` spelling, as well as `cancelled`, into `failed`.

## [0.1.78] - 2026-09-22

### Changed

- **CI: the MCP Registry publish waits up to four minutes for npm to serve the new version, retries three times, and warns instead of failing** (`.github/workflows/publish.yml`). `mcp-publisher publish` validates the release against npm, and npm's read replicas can lag `npm publish` by minutes — the 0.1.77 release was refused with a 404 about 70 seconds after the publish returned, and because the step is `continue-on-error` the run stayed green while the Registry silently kept the previous version. The workflow now polls `npm view @talonic/mcp@<version>` for up to four minutes before publishing to the Registry, retries the Registry publish three times, and emits a `::warning::` annotation when it still fails so the gap is visible in the run summary instead of hiding behind a green check. A new failure-mode row in `docs/architecture/docs-pipeline.md` documents the symptom and the manual recovery (`mcp-publisher login github && mcp-publisher publish`); the step stays soft — npm remains the source of truth for installs.

## [0.1.77] - 2026-09-22

### Added

- **External-mode decision-task protocol for Talonic Apps — seven new tools** (`src/tools/decision-tasks.ts`) wrapping the platform's `/v1/decision-tasks` surface (APPS-SPEC §B4): `talonic_list_decision_tasks` (one app's inbox, `GET /v1/apps/:id/decision-tasks`), `talonic_claim_decision_task` (the exclusive lease; the claim returns the output contract, precedents and the package descriptor — there is no separate get), `talonic_read_decision_package` (pages of the run's frozen input package with provenance locators, claimant-only, journaled), `talonic_heartbeat_decision_task`, `talonic_submit_decision_task` (contract-shaped `outcome`, required verbatim `evidence[]` locators, required `rationale`, optional `confidence` / `service_version`), `talonic_release_decision_task`, and `talonic_fail_decision_task` (raises a Human Review and applies the app's fallback policy). The platform's `decide` tier admits a `tlnc_` key holding a per-app `decide` grant, or an OAuth session carrying the `apps:decide` scope with a live `senior_member`-or-above role; every description says so. The hosted server now advertises `apps:decide` in its protected-resource `scopes_supported` (so Claude.ai's consent screen offers "Claim and decide tasks"), and lists the seven tools marked `NOT INVOCABLE IN THIS SESSION` (`_meta["talonic/can_invoke"]: false`) when an OAuth token visibly lacks the scope — a connector added before the scope existed keeps working, and the agent asks the user to reconnect. Handlers always forward; the platform decides. Docs sections, nav, README, AGENTS, and the server `instructions` string carry the list → claim → package → heartbeat → submit/release/fail flow. The rule-mining external-driver tool routes stay a follow-up.

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

### Changed

- **Widget scaffolding refactored into `src/widgets/shared.ts`** — shared base CSS, render helpers, the `window.openai` data-channel bootstrap, the `_meta` block (widget domain + CSP) and a `registerWidget()` helper; each widget supplies only its `render(payload)` body.

## [0.1.55] - 2026-06-03

### Fixed

- Widget resources declare the widget domain (required for App Directory submission); docs count corrected to nine tools.

## [0.1.54] - 2026-06-03

### Changed

- Comprehensive docs refresh (README / AGENTS / CLAUDE / STATUS / MCP docs) for the nine-tool surface and the verified browser-handoff upload flow.

## [0.1.53] - 2026-06-03

### Fixed

- Extraction-result widget reads tool output through `window.openai.toolOutput` (the Apps SDK data channel) and declares its CSP; the postMessage bridge stays as a fallback.

## [0.1.52] - 2026-06-01

### Fixed

- **ChatGPT Apps SDK widget** (`src/widgets/`) now reads tool output via `window.openai` and declares a Content-Security-Policy, fixing the extraction-result card rendering inside ChatGPT's iframe sandbox.

## [0.1.51] - 2026-05-28

### Added

- **`docs/architecture/docs-pipeline.md`** — canonical reference for the repo's two parallel docs surfaces (`src/content/sections/*.ts` → `/docs/mcp/*` vs `docs/sections.json` → `/docs/{sdk,api,platform}/*`), the four-file checklist for adding a tool, the failure-mode table, and the CI-token map. Agent-discovery surfaces (`AGENTS.md`, `CLAUDE.md`) point here.

### Changed

- `talonic_list_schemas` now returns **compact summaries** (id, short_id, name, description, version, field count) and drops the heavy full `definition` blob from the list response. Fetch a single schema's definition on demand instead of paying for every definition on every list call.

## [0.1.50] - 2026-05-28

### Fixed

- Closed the **MCP-docs gap on talonic.com**: `talonic_get_balance` and `talonic_request_upload` were missing from the MCP docs navigation, and the `dataType` / preventive-reactive filter guidance had not propagated to `talonic.com/docs/mcp/*`. Added the nav entries and content so the published MCP docs match the shipped tool surface.

## [0.1.49] - 2026-05-28

### Fixed

- **`talonic_get_document` output validation on pre-extraction documents.** A freshly created browser-handoff document returns `null` for `source.id`, `source.type`, and several `triage` fields until ingest completes. The Zod outputSchema used `.optional()` (accepts `undefined`, not `null`), so hosted clients rejected the response with a `-32602` output-validation error mid-poll. Those fields are now `.nullable().optional()`, so an agent can poll the document immediately after `talonic_request_upload` without tripping validation.

### Changed

- **`talonic_request_upload` polling guidance hardened.** The description now states explicitly that a user message like "done" or "uploaded" confirms only the browser-side upload — the agent must still poll `talonic_get_document` until `status` is `completed` before calling `talonic_extract`. `talonic_get_document`'s description documents the full lifecycle (`pending_upload → queued → extracting → completed`).

## [0.1.48] - 2026-05-28

### Changed

- **Aligned the browser-handoff poll target with the platform fix.** After the platform began enqueuing extraction on upload, the happy-path lifecycle became `pending_upload → queued → extracting → completed` and no longer surfaces `uploaded` in normal operation. `talonic_request_upload` and `talonic_get_document` descriptions now tell agents to poll for `completed`. Added unit tests for `talonic_request_upload` (happy path, custom base URL, per-call token refresh, non-2xx and network-error paths).

## [0.1.47] - 2026-05-28

### Note

- Version-bump-only release (`f64b0eb`): no commits landed between it and `v0.1.46` — an immediate re-publish with no code or doc changes. The next substantive change shipped in 0.1.48.

## [0.1.46] - 2026-05-28

### Note

- Version-bump-only release (`caf5ba7`): no commits landed between it and `v0.1.45` — an immediate re-publish with no code or doc changes.

## [0.1.45] - 2026-05-27

### Added

- **ChatGPT Apps SDK widget for `talonic_extract`.** New extraction-result widget (`ui://widget/extraction-result.html`, `src/widgets/`) registered as an MCP resource with MIME `text/html;profile=mcp-app`. `talonic_extract` declares `_meta["openai/outputTemplate"]` pointing at it, so ChatGPT renders extraction results as an inline card: document metadata, extracted fields, overall + per-field confidence bars, and copy/download-JSON controls. Pure HTML+CSS+vanilla-JS embedded as a string — no bundler, no new runtime dependencies. Render-only; no secrets cross into the iframe (asserted by tests). Other MCP clients ignore the widget resource and `outputTemplate` hint — no behavior change for them.
- **Tool-annotation regression test** (`tests/widgets/tool-annotations.test.ts`) locking the Apps-SDK-required hint contract: five pure-lookup tools are `readOnlyHint: true`; `extract`, `save_schema`, and `to_markdown` are `readOnlyHint: false`. (`to_markdown` is intentionally not read-only — its file-input path ingests a document via extract, uploading and consuming credits.)
- **`talonic_request_upload` — browser-handoff upload for hosted AI agents.** A new tool that routes file delivery around two structural limits of hosted connectors (Claude.ai web, ChatGPT): the ~32 KB tool-call argument cap and the sandbox egress allowlist. It returns a pre-allocated `document_id`, a browser-openable `upload_url` (`https://app.talonic.com/u/<token>`), and an `expires_at`. The user opens the link and drops the file; the agent polls `talonic_get_document` until `status === "completed"`, then calls `talonic_extract` with the `document_id`. Tool count: 8 → 9. `talonic_extract`'s description gained a "large files / hosted environments" note pointing at the new flow. Verified end-to-end against production Claude.ai.

### Note

- Versions 0.1.40–0.1.44 were patch bumps from the docs-sync / dispatch-token pipeline verification burst. No public tool-surface changes.
- Also added and removed within this release: an env-gated debug-instrumentation pass (`talonic_debug_echo` and two sibling tools, added in `3f7fb98`, removed in `4755142`) used to measure the Claude.ai connector argument cap ahead of the browser-handoff design above.

## [0.1.39] - 2026-05-19

### Added

- **`dataType` field on `talonic_search`'s outputSchema** for both `fieldMatches[]` and `fields[]` (`src/tools/search.ts`). Mirrors the API change (platform `c16f2656` + `0689c1b2`) that added `dataType` to the omnisearch response. The MCP outputSchema previously did not declare it, so Zod's strip mode would have dropped it from `structuredContent`. Field is `z.string().nullable().optional()` — accepts `"string"`, `"number"`, `"array"`, plus `null` for non-materialized entries, plus absent for older deploys.

### Changed

- `talonic_filter` SCHEMA TYPING block restructured into a **preventive / reactive** pair: agents call `talonic_search` first and gate numeric operators (`gt`/`gte`/`lt`/`lte`/`between`) on `field.dataType === "number"` before constructing the filter, with the API's `warnings[]` array remaining the reactive safety net. Closes the schema-typing footgun end-to-end.

## [0.1.38] - 2026-05-18

### Added

- **`warnings` field on `talonic_filter`'s outputSchema** (`src/tools/filter.ts`). The Talonic API surfaces a `warnings[]` array on filter responses when a numeric operator is applied to a string-typed field — the schema-typing footgun where `gt`/`gte`/`lt`/`lte`/`between` against a string-typed field like `invoice_total` (with currency symbols mixed in) silently returns zero matches. The MCP outputSchema previously did not declare `warnings`, so Zod's default strip mode dropped the field from `structuredContent` before the agent could read it. The schema now accepts an optional array of permissive (`.passthrough()`) warning objects covering `code`, `message`, `field`, `field_id`, and `suggestion`; all keys are optional and unknown keys forward through.

### Changed

- `talonic_filter` SCHEMA TYPING block extended with a one-line nudge telling agents to surface `warnings[].message` (and `suggestion`, when present) to the user verbatim rather than silently retrying.
- Internal: `outputSchema` is now `export`ed from `src/tools/filter.ts` so tests can validate it directly via `z.object(filterOutputSchema)`.

## [0.1.37] - 2026-05-18

### Added

- **Hosted MCP now serves Streamable HTTP at both `/` and `/mcp`** (`src/http-server.ts`). Clients that registered the bare origin (`https://mcp.talonic.com`) instead of appending `/mcp` previously received the discovery JSON when they expected a JSON-RPC frame — most visibly in Glama's hosted MCP Inspector. The root path now discriminates by method/Accept: plain `GET /` still returns the discovery JSON (humans, bots, monitors); POST/DELETE and SSE GETs at `/` route through the same auth + session + `StreamableHTTPServerTransport` block that serves `/mcp`. `/mcp` is unchanged; every existing client keeps working byte-for-byte.

### Changed

- Internal: HTTP request handler extracted into an exported `createRequestHandler()` factory with the session map scoped per-call (production builds exactly one; tests spin up isolated instances). `httpServer.listen` gated behind an `isDirectInvocation()` check mirroring `server.ts` so importing the module from a test does not bind to port 3000.

### Tests

- Six new tests in `tests/http-server.test.ts` cover the regression surface (GET `/`, `/health`, unknown paths, POST `/mcp`) plus the fix (POST `/` opens a session; POST `/` without auth returns 401 + `WWW-Authenticate`).

## [0.1.36] - 2026-05-13

### Changed

- Post-submission state refresh in `STATUS.md`: Claude Connectors Directory submission marked as submitted (2026-05-12); Smithery listing recorded at `https://smithery.ai/servers/talonic/talonic`; 8-tool / 2-resource surface re-verified in the surfaces table; documentation tightened in `docs/sections.json` and the corresponding website-sync content sections.

## [0.1.35] - 2026-05-12

### Added

- **`/favicon.ico` and `/favicon.png`** served from the hosted MCP, inlined as base64 in `src/favicon.ts`. Required for the Claude Connectors Directory listing and for browser preview surfaces. `Content-Type: image/png` with a 24-hour `Cache-Control` header.
- **`SECURITY.md`** at the repo root. Disclosure policy with `safety@talonic.ai` as the primary channel, two-business-day acknowledgement target, ten-business-day substantive response, and a 30-day fix target for confirmed production-affecting issues. Coordinated-disclosure model with a safe-harbour clause.

### Changed

- Disclosure email switched from a placeholder to `safety@talonic.ai` after the mailbox was stood up.

## [0.1.34] - 2026-05-12

### Added

- **Origin-header allowlist** (`src/origin.ts`) on the hosted Streamable HTTP server. DNS-rebinding mitigation. Allows three Claude.ai variants (`https://claude.ai`, `https://claude.com`, `https://www.claude.ai`) plus four MCP-directory surfaces (Cursor Directory, Smithery, mcp.so, `registry.modelcontextprotocol.io`). Empty Origin passes through (native clients and server-to-server traffic). Unknown origins receive a structured 403.

## [0.1.33] - 2026-05-12

### Changed

- README "Available on" section lists Cursor Directory in the first position.

## [0.1.32] - 2026-05-11

### Changed

- `docs/sections.json` refreshed: content brought up to date with the post-OAuth surface, prettier drift across all sections cleared.

## [0.1.31] - 2026-05-11

### Changed

- Prettier re-run on `src/tools/filter.ts` after the `is_not_empty` re-addition in 0.1.29.

## [0.1.30] - 2026-05-10

### Added

- **`is_not_empty` filter operator re-exposed.** Checks the materialized-values index, which the upstream API now updates within seconds of extraction completing. For batch-mode extractions, results reflect data after the batch poll cycle applies. The `talonic_filter` tool description, troubleshooting docs, and README "Known limitations" section have all been updated to reflect the new behavior; the "intentionally not exposed in v0.1" caveat is gone.

### Changed

- `talonic_filter` description gains type-mismatch guidance to complement the existing SCHEMA TYPING block.

## [0.1.29] - 2026-05-10

### Fixed

- `talonic_search` outputSchema: `fieldMatches[].documentCount` and `fields[].documentCount` accept `null`, matching the API's response shape for entries with no materialised data.

## [0.1.28] - 2026-05-09

### Changed

- README reframed around the Claude.ai OAuth connector flow as the primary install path, with the API-key URL kept as an alternative for clients that cannot complete the OAuth handshake.

## [0.1.27] - 2026-05-08

### Changed

- `docs/sections.json` enriched with code examples; per-page content expanded to at least 4 paragraphs each, with a 6K-character target on tool pages. Improves SEO and gives the website's auto-generated docs more substance.

## [0.1.26] - 2026-05-08

### Changed

- `docs/sections.json` enrichment pass: every MCP doc section has at least four paragraphs. Foundation for the further expansion in 0.1.27.

## [0.1.25] - 2026-05-07

### Added

- **`talonic_get_balance`** tool. Wraps `GET /v1/credits/balance` from the API and returns the enriched balance (`balance_credits`, `balance_eur`, `burn_rate_30d_credits`, `projected_runway_days`, `tier`, `tier_resets_at`). Lets agents make budget-aware decisions before kicking off large batches. Tool count goes 7 → 8.
- **`cost` field on `talonic_extract` and `talonic_to_markdown` outputSchemas.** Surfaces the per-call cost (`costCredits`, `costEur`), post-call balance (`balanceCredits`), and the registry-vs-AI cell-resolution split (`cellsResolvedRegistry`, `cellsResolvedAi`). Parsed by `@talonic/node@0.1.10` from the API's `X-Talonic-Cost-*` and `X-Talonic-Balance-*` response headers and threaded through the SDK's `WithRateLimit<T>` wrapper. `null` on the `talonic_to_markdown` `document_id` path because no extract call runs there.

### Fixed

- Three QA-reported MCP `-32602 Output validation error` failures, all with the same shape: outputSchema declared a non-null string where the API legitimately returns `null`. Fixed and locked in with regression tests.
  - `talonic_list_schemas` and `talonic_save_schema`: `data[].description` / `description` accept `null`.
  - `talonic_extract` and `talonic_get_document`: `document.mime_type` / `mime_type` accept `null`.
  - `talonic_search`: `fields[].id` accepts `null` (set by the API for "schema-only" field entries that have not yet been materialized into the field-registry index).
- Hosted MCP root discovery `docs` URL was advertising `https://docs.talonic.com` (not a live subdomain). Now points at `https://talonic.com/docs/mcp`.
- `talonic_to_markdown` description now mirrors the Claude.ai parameter-cap warning from `talonic_extract` so chat clients and Claude.ai connector users get consistent guidance on `file_data`.
- Symlink test in `tests/server-symlink.test.ts` now skips with a console warning when `dist/server.js` is older than `package.json` (avoids confusing "expected '0.1.x' to contain '0.1.y'" failures during local dev).

### Changed

- Hosted MCP (`mcp.talonic.com`) is now token-rotation aware. The bearer token is extracted on every incoming MCP request and the SDK is rebuilt per request when the token changes; previously the credential was captured at session-init time and reused. Required for OAuth 2.1 access-token rotation across requests in the same session.
- `WWW-Authenticate: Bearer resource_metadata="..."` header on 401 responses, per RFC 9728. Lets OAuth clients (Claude.ai connector, MCP Inspector) discover the authorization server.
- `/.well-known/oauth-protected-resource` endpoint on the hosted MCP per RFC 9728. Advertises `https://api.talonic.com` as the authorization server and the three scopes the connector actually exercises (`extract:write`, `documents:read`, `schemas:read`).
- All seven existing tool registrations now take a `() => Talonic` getter rather than a `Talonic` instance. Internal refactor; no consumer-visible change beyond the OAuth token-rotation behaviour above.

## [0.1.16] - 2026-05-05

### Added

- `talonic_filter` description gains a SCHEMA TYPING block: numeric operators (`gt`, `gte`, `lt`, `lte`, `between`) only resolve correctly when the schema field is typed as `number`. String-typed fields holding numeric content silently return zero matches. Surfaced during the v1 audit and worth flagging at the tool layer so agents avoid the trap.

### Changed

- `Known Limitations` section in `src/content/sections/troubleshooting.ts` rewritten to reflect the post-engineering-fix state. Removed the now-stale "per-field provenance not surfaced" entry (engineering shipped `include_provenance` in 0.1.14). Added entries for `filterable: true` discoverability, schema-type-vs-operator compatibility, and the drag-and-drop file-upload stall in Claude.ai's hosted-MCP path (workaround: use `file_url` or `document_id`, or use the local stdio install).
- Filter callout in `src/content/sections/tools.ts` updated to highlight the `filterable: true` requirement alongside the `is_not_empty` caveat.

## [0.1.15] - 2026-05-05

### Changed

- Prettier-formatted `src/tools/extract.ts` after the 0.1.14 description update.

## [0.1.14] - 2026-05-05

### Added

- `include_provenance` parameter on `talonic_extract`. When true, response includes per-field source evidence (`source_text`, `section`, `page`) showing where each value was found in the document. Closes the long-standing "provenance not surfaced" gap.

### Changed

- Search and filter tool descriptions further refined for the `filterable` flag pattern; FAQ in `docs/sections.json` updated.

## [0.1.13] - 2026-05-04

### Changed

- `talonic_filter` and `talonic_search` descriptions updated to reflect the upstream API addition of a `filterable` boolean on `fields[]` and `fieldMatches[]` in search responses. Agents are now guided to only use `filterable: true` entries with `talonic_filter`, avoiding the silent zero-result queries that previously came back from non-materialized fields.

## [0.1.12] - 2026-05-04

### Added

- New top-level `agent-decision-guide` section in `src/content/sections/overview.ts`, mirrored as an `Agent decision guide` block in the README. Five sub-sections covering when to use which tool, confidence and human-review handling, and when not to call Talonic at all. FAQ entries for SEO ingestion.
- Complete tool-input-and-response examples for all 7 tools in `src/content/sections/tools.ts`, including the previously-missing response block on `talonic_extract` with `schema_id`.

### Changed

- `talonic_extract` response example shape aligned with the SDK's canonical `confidence: { overall, fields }` form.

## [0.1.11] - 2026-05-04

### Added

- MCP-layer validation guard on `talonic_extract`. Calls without `schema` or `schema_id` are rejected fast with a clear validation error before reaching the API. Schema-less extraction is no longer reachable through the MCP layer in v0.1; agents get a clean error rather than slow opaque API failures or silently empty results.
- `talonic_extract` response shape documented in the tool description: `confidence.overall`, `confidence.fields`, `document.*`, `extraction_id`, `request_id`, `processing.*`. Explicit notes about what is not surfaced in v0.1 (cost, EUR price, balance, per-field provenance, since updated by the 0.1.14 release for provenance).
- `STATUS: stable` line at the top of every tool description.
- New `validationError` helper in `src/tools/_shared.ts` for fast-fail input checks.

### Changed

- `talonic_extract` description: SCH- caveat removed (the upstream API now accepts both UUID and `SCH-XXXXXXXX` short ids on `/v1/extract`).
- `talonic_filter`: `is_not_empty` removed from the operator enum and `FilterArgs` union. The description has a NOT SUPPORTED IN v0.1 section with workarounds (`eq`/`gt`/`contains` against a known value, or `is_empty` then invert client-side).
- `talonic_to_markdown` internal `INGEST_ONLY_SCHEMA` replaced from `{}` to a minimal valid JSON Schema (single throwaway `document_title` field). Keeps the internal ingest call off the unreliable schema-less path that the MCP layer now blocks.
- README install section recommends version pinning for production, with a note about API key handling.
- `talonic_list_schemas` description mentions `short_id` (SCH-XXXXXXXX) returned alongside the UUID.

## [0.1.10] - 2026-05-03

### Added

- Webhooks reference resource (`talonic://webhooks/reference`). Aggregates four webhook info endpoints (events, delivery behavior, signature verification algorithms, retry policy) into a single resource so agents can look these up without leaving the MCP context.
- Root endpoint (`/`) on the hosted Streamable HTTP server returns a service-discovery JSON payload with name, version, MCP endpoint, health endpoint, auth pattern, and docs link.
- `docs/sections.json` and platform-docs sync workflow: every documentation change in `src/content/sections/` flows automatically into the website at publish time, becoming SEO-friendly doc pages.
- Complete working examples for all 7 MCP tools in `src/content/sections/tools.ts` (input + response).
- Hosted MCP install snippets added to all six client install pages (Claude Desktop, Cursor, Cline, Continue, Cowork, generic), leading with the hosted option.

### Changed

- `src/version.ts` derives the version from `package.json` at build time instead of being hardcoded, with a smoke test that asserts they match.
- Comprehensive rewrite of `docs/sections.json` to reflect the v0.1.10 surface.

### Fixed

- Strict null-check warning in `src/content/helpers.ts`.
- `install.ts` type errors in the content layer.

## [0.1.9] - 2026-05-02

### Fixed

- Session persistence for the Streamable HTTP transport. Per-session state (transport + MCP server) is now keyed by the `Mcp-Session-Id` header generated at `initialize` time, so multi-call agents on the hosted endpoint maintain context across requests instead of starting a fresh session per call.

## [0.1.8] - 2026-05-02

### Fixed

- Railway deployment now uses the correct entry point (`dist/http-server.js`) for the hosted Streamable HTTP server.

## [0.1.7] - 2026-05-01

### Added

- **Hosted Streamable HTTP transport.** New `src/http-server.ts` entry point hosts the same MCP server over HTTP for remote clients. Two auth modes: `Authorization: Bearer tlnc_...` header or `?apiKey=tlnc_...` query parameter. Designed for deployment on Railway behind `mcp.talonic.com`. The local `npx -y @talonic/mcp@latest` stdio install remains the recommended path for local-development clients (Claude Desktop, Cursor, Cline, Continue, Cowork); the hosted endpoint becomes the recommended path for chat clients that don't run local processes (Claude.ai connectors, etc.).
- New `src/server-factory.ts` shared `createServer()` so stdio and HTTP entries register the same 7 tools and 2 resources.
- `Dockerfile` and `railway.toml` for one-step Railway deploys.
- `/health` healthcheck endpoint.
- `/content` export from `package.json` so the website can consume the structured docs payload.

### Changed

- README: "Hosted MCP" install path mentioned as a primary option for Claude.ai users (URL plus apiKey query parameter pattern).

## [0.1.6] - 2026-04-30

### Added

- `mcpName` field in `package.json` set to `io.github.talonicdev/talonic-mcp`. This is the verification marker the official MCP Registry uses to confirm that a registry entry's npm package matches its claimed identity.

## [0.1.5] - 2026-04-30

### Changed

- `@talonic/node` dependency bumped to `^0.1.3`. Picks up the SDK refactor that drops local field-name pre-resolution; canonical names like `vendor.name` are now passed straight through to the API for server-side resolution.
- `talonic_filter` description: documents that the API now resolves canonical field names server-side, and flags that `is_not_empty` currently underreports.
- `talonic_extract` description: re-introduces the flat key-type map as an accepted schema format with a fallback note (the API documents it; if normalisation fails, the agent should retry with full JSON Schema).
- `talonic_save_schema` description: same treatment as `talonic_extract`, plus mention that responses include `short_id` (e.g. `SCH-XXXXXXXX`) alongside the UUID.

### Fixed in upstream API (no MCP change required)

- `file_data` multipart uploads to `/v1/extract` no longer return `422 No document text available`.
- Error responses from `/v1/extract`, `/v1/schemas`, and `/v1/documents/filter` now include `request_id` and a useful `message`.
- `/v1/schemas/:id` accepts both UUIDs and `SCH-XXXXXXXX` short ids; responses include the `short_id` field.

### Known issues (still open at upstream)

- Schema flat-map normalisation rejects valid flat-map definitions with "Schema definition produced no fields" despite advertising the format. Workaround: send full JSON Schema.
- `is_not_empty` filter operator returns empty results for fields known to be populated.
- `/v1/extract` `schema_id` does not accept the SCH- short form yet; UUID required.

## [0.1.4] - 2026-04-29

### Added

- `file_data` (base64-encoded bytes) and `filename` inputs on `talonic_extract` and `talonic_to_markdown`. Lets agents pass uploaded files to Talonic when running inside chat-style MCP hosts (Claude Desktop, Cowork, Cursor) where the host's user-data directory is not readable by the MCP server process. Tool descriptions advertise `file_data` as the recommended path for chat clients.
- Tests covering `file_data` decoding, MIME inference from `filename`, and rejection of multiple file sources.

### Changed

- `talonic_extract` description: clarified when each file source is appropriate. `file_data` is the recommended path for chat clients; `file_path` only works when the MCP server has filesystem access to that path; `file_url` is for documents already on the public web; `document_id` re-extracts an existing workspace document.
- `talonic_to_markdown` description: added `file_data` + `filename` to the input list with the same chat-client guidance.
- `talonic_extract` description no longer recommends the flat key-type schema map; recommends full JSON Schema only (the flat map is silently empty-saved by the API; tracked separately).

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
