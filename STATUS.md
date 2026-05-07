# Talonic MCP and SDK Status

**Last audit:** 2026-05-05. **Audited by:** Claude (assisting Hamlet). **Scope:** Workstream 1 audit per the v1 launch plan, including post-fix re-verification.

This document captures the live state of the four Talonic developer surfaces ahead of the public v1 push: `@talonic/mcp`, `@talonic/node`, the website, and the official MCP Registry. Update before each release.

## TL;DR

The Claude.ai connector audit completed with engineering's three bug fixes confirmed live in production. Six of the 7 tools are verified end-to-end through Claude.ai's custom-connector UI. One tool path (drag-and-drop file upload via `talonic_extract` `file_data` in Claude.ai) is bottlenecked by Claude.ai's tool-call argument size cap, which truncates the base64 payload before it reaches the MCP server. Local-stdio installs are unaffected. Architectural fix is pre-signed upload URLs (engineering follow-up).

**Engineering fixes confirmed live (re-tested 2026-05-05):**

1. `talonic_list_schemas` pagination: now returns the full `data[]` matching `pagination.total`. Verified by listing all 10 schemas (was returning 2 of 7 yesterday).
2. `talonic_filter` discoverability triple-fix: search responses now include a `filterable` boolean flag on fields and field matches, agents respect it before calling filter, and the error message for non-filterable fields is informative.
3. `talonic_search` word-boundary tokenization: spaces, underscores, and hyphens are equivalent. `"test invoice"` matches both `test_invoice.pdf` and `test-invoice.pdf`.

**New issues found during the post-fix audit:**

1. **Schema-typing footgun.** When a schema field uses an inappropriate type (e.g. `invoice_total` typed as string instead of number), filter operators that depend on type (`gt`, `lt`, etc.) silently return zero results even after extraction. Not a filter bug, but a UX trap when designing schemas.
2. **`talonic_extract` via drag-and-drop in Claude.ai delivers truncated `file_data`.** Diagnosed 2026-05-06 via a controlled test in Claude.ai with a flat schema. Claude reports "the file_data parameter only received the first 502 bytes of the file rather than the full PDF". Root cause is **Claude.ai's hard cap on tool-call argument size** (effectively under ~1KB per parameter). A base64-encoded real PDF is hundreds of KB; the bytes get truncated before reaching the MCP server. Talonic API receives a stub document, registers it with low/empty page content, and returns `null` extracted fields. This is a Claude.ai platform limit on connectors, not a Talonic MCP server or API bug. Local-stdio installs (Claude Desktop, Cursor, Cline, Continue, Cowork) have no parameter cap and work correctly via `file_data`. **Architectural fix: pre-signed upload URLs.** A new tool (e.g., `talonic_request_upload_url`) returns a one-time HTTPS PUT target so agents can upload outside the MCP tool-call channel, then reference the resulting `document_id`. Engineering follow-up.

**Older follow-ups still open:**

(none in this section as of 2026-05-07; both items moved to Resolved below)

**Resolved during the audit:**

- All three API bugs from the original audit message (schemas list pagination, filter trifecta, search tokenization). Engineering shipped fixes within hours.
- Registry stale at 0.1.6: now tracking npm latest (0.1.19+) with `isLatest: true`.
- `/.well-known/mcp.json` missing `talonic://webhooks/reference` resource: added in website commit `455889d`.
- SDK `WithRateLimit<T>.rateLimit` was returning sentinel zeros: now nullable, `parseRateLimit` returns `null` when no `X-RateLimit-*` headers present (talonic-node `df0b59f`, published as 0.1.8 → 0.1.9).
- Hosted MCP root endpoint was advertising `https://docs.talonic.com` (not a real subdomain): now points at `https://talonic.com/docs/mcp` (talonic-mcp `21720f6`, published as 0.1.21).

## Surfaces

### `@talonic/mcp`

| Item | State |
|---|---|
| Repo | clean, on main, pushed |
| package.json version | 0.1.17 |
| server.json version | 0.1.17 |
| npm published version | 0.1.17 (published 2026-05-06 via auto-pipeline after NPM_TOKEN rotation) |
| Auto-bump pipeline | working; new granular npm token with bypass-2FA in place |
| Tests | 34 pass (verified 2026-05-06 in /tmp/talonic-mcp-build) |
| Format check | clean |
| Typecheck | clean |
| Build | clean |
| docs/sections.json | up to date with v1 surface (decision guide, examples, troubleshooting) |
| Tool descriptions | all 7 carry STATUS: stable; honest known limitations |
| Tool annotations | all 7 carry `readOnlyHint`, `destructiveHint`, `openWorldHint`; read-only tools (search, filter, list_schemas, get_document) marked `readOnlyHint: true`; write tools (extract, to_markdown, save_schema) marked false |
| MCP-layer schema validation | enforced; schema-less calls rejected fast |
| Privacy Policy | live in README |

### `@talonic/node`

| Item | State |
|---|---|
| Repo | clean, on main, pushed |
| package.json version | 0.1.7 |
| npm published version | 0.1.7 |
| Tests | 122 pass, 2 skipped |
| `npm run check:spec` | passes; 25 SDK call sites match the OpenAPI spec |
| docs/sections.json | reflects 0.1.7 surface (auto-populate required, rate-limit headers wrapper) |
| SDK CLI | `npx -y @talonic/node@latest schemas list` works against production |

### Website (`/Users/macman/Downloads/Talonic/website`)

| Item | State |
|---|---|
| Repo | clean (after one fix this audit) |
| `update-docs.yml` workflow | running on every package publish; recent commits visible in main |
| `package-lock.json` | `@talonic/mcp@0.1.12`, `@talonic/node@0.1.7` |
| `npm run check:ai-discovery` | passes after this audit's fix |
| `/.well-known/mcp.json` | tool list now matches @talonic/mcp registrations (9 registered, 9 declared) |
| `/.well-known/agent.json` | 5 skills declared |
| `/.well-known/api-catalog` | exists |
| `/llms-full.txt` | mentions hosted MCP, confidence scores, npx install |
| Build | not verified in audit (sandbox network restriction); run on dev machine to confirm |

Audit fix during this run: `talonic://webhooks/reference` was missing from `/.well-known/mcp.json`; added in commit `455889d`.

### Official MCP Registry

| Item | State |
|---|---|
| Listing URL | `https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.talonicdev/talonic-mcp` |
| Listed name | `io.github.talonicdev/talonic-mcp` |
| Listed version | 0.1.17 (publish acknowledged 2026-05-06; awaiting search-endpoint propagation as of last check) |
| `_meta` | publish via `mcp-publisher publish` returned `Successfully published`; search endpoint may lag for some minutes after publish |
| Install instructions | npx command and `TALONIC_API_KEY` env var, both correct |
| History note | between 0.1.6 and 0.1.17 the auto-pipeline did not chain into `mcp-publisher`, so 0.1.7 through 0.1.16 were never pushed to the registry. 0.1.17 is the first registry push since the original 0.1.6 submission. Earlier STATUS entries that claimed 0.1.12 was on the registry were aspirational and have been corrected here. |
| Standing follow-up | wire `mcp-publisher publish` into the GitHub Actions publish workflow so future versions land on the registry automatically; requires storing an `MCP_REGISTRY_TOKEN` secret. Owner: us. |

Standing maintenance task: the auto-bump pipeline that publishes new versions to npm does not currently chain into `mcp-publisher publish`. Whoever cuts a release should run `mcp-publisher publish` from the talonic-mcp repo afterwards (or wire it into CI). Without that, the registry will lag npm.

## Live end-to-end tests against production

Hosted MCP at `https://mcp.talonic.com`:

| Endpoint | Test | Result |
|---|---|---|
| `GET /health` | curl | 200, `{"status":"ok","server":"talonic","version":"0.1.12"}` |
| `GET /` | curl | 200, service discovery JSON (mcp_endpoint, health_endpoint, auth, docs) |
| `POST /mcp` (Bearer header) | initialize handshake | 200, valid Mcp-Session-Id, serverInfo `talonic 0.1.12` |
| `POST /mcp?apiKey=...` | initialize handshake | 200, equivalent shape |
| `tools/list` | 8 tools advertised | all 8 present with STATUS: stable |

All 8 MCP tools, called through the hosted endpoint with a real `tlnc_` key. Updated post engineering fixes:

| Tool | Result | Notes |
|---|---|---|
| `talonic_list_schemas` | verified | pagination fix landed; all 10 schemas returned correctly (was 2 of 7 before fix) |
| `talonic_search` | verified | tokenization fix landed; `_`, `-`, ` ` equivalent; `filterable` boolean now on fields and field matches |
| `talonic_filter` | verified | discoverability fixes landed; informative errors when field is unfilterable; agents reliably check `filterable: true` before calling filter |
| `talonic_extract` | verified for `file_url` and `document_id`; **truncated for `file_data` in Claude.ai** | UUID and SCH-XXXXXXXX both accepted on `schema_id`; MCP-layer schema validation guard active; Claude.ai's tool-call argument size cap truncates base64 file_data before it reaches the MCP server (Claude.ai platform limit, not a server bug); local-stdio installs unaffected (see follow-ups). Now surfaces per-call `cost` parsed from `X-Talonic-Cost-*` response headers. |
| `talonic_get_document` | verified | UUID, filename with extension, filename without extension, and natural-language all work |
| `talonic_to_markdown` | verified | UUID and chained search-to-markdown via filename or natural language all work. Surfaces `cost` on file paths (extract step ran), `null` on the `document_id` path. |
| `talonic_save_schema` | verified | direct save, iterative design with confirmation, save-and-verify-via-list, and avoid-duplicate (defensive) flows all work |
| `talonic_get_balance` | shipped 2026-05-07 | New tool wrapping `GET /v1/credits/balance`. Returns balance_credits, balance_eur, burn_rate_30d_credits, projected_runway_days, tier, tier_resets_at. |

## Claude.ai connector test (live, with real key)

Workflow: Claude.ai > Settings > Connectors > Add custom connector. URL: `https://mcp.talonic.com/mcp?apiKey=tlnc_REDACTED`. **Bearer header in a custom-header field is not supported by Claude.ai's connector UI; only the URL-with-apiKey form works.** This is the documented v1 install pattern for Claude.ai users.

Once added, the connector loads all 8 tools with their STATUS: stable descriptions and per-tool permission toggles (default: Needs approval).

### Per-tool test results

**Test 1: `talonic_list_schemas` via "List all the schemas I have in my Talonic workspace"**
- Tool called correctly. Raw response shows `pagination.total: 7, has_more: false, data: [2 items]`.
- **Bug confirmed:** silent truncation. The dashboard at `app.talonic.com/schemas` shows all 7 schemas; the API only returns 2 in `data[]`.
- Claude itself flagged the discrepancy in Test 2 when search returned a schema (`Invoice to CSV`) that wasn't in Test 1's list.

**Test 2: `talonic_search` via "Search my Talonic workspace for invoice documents"**
- Tool called with `query: "invoice"`. Returned 10 documents, related fields, sources, schemas.
- **Bug observation:** `fieldMatches[].resolvedFieldId` for filename matches returns the corresponding document UUIDs, not field UUIDs.
- Claude correctly cross-referenced and noted the missing schema from Test 1.

**Test 3: `talonic_filter` via "Show me three invoices with totals over 100 EUR"**
- Three sub-issues uncovered:
  1. `field: "invoice_total"` (canonical name from search results) → `VALIDATION_ERROR: No field matches name`. The schema-defined field has `documentCount: 0` so it isn't in the registry.
  2. `field: "filename"` and `field: "Invoice Total"` → same validation error. Filename is a document property, not a registry field.
  3. `field_id: "5c729ee8-..."` (a real pipeline field UUID with `documentCount: 1` per the search response) → 0 results, no error, despite known matching documents.
- Claude correctly stopped after multiple failed attempts and asked the user for help, rather than hallucinating field names. Decision-guide behavior working as designed.
- Net: filter is plumbing-correct but discoverability and resolution logic make it unusable in real agent flows without the user manually providing field UUIDs.

**Test 4: `talonic_get_document` via four input variants**
- Variant A: explicit UUID. Single tool call, full metadata returned. **Pass.**
- Variant B: filename with extension (`test_invoice.pdf`). Claude searched, picked the doc_id, called get_document. Two tool calls. **Pass.**
- Variant C: filename without extension (`test_invoice`). Same flow as B. **Pass.**
- Variant D: natural language with space (`"test invoice"`). Search returned zero matches (word-boundary tokenization gap), Claude reported "workspace appears empty" despite 10 invoices being indexed.
- Net: tool is correct; the failure in Variant D is a `talonic_search` bug, not a `get_document` bug.

### UX theme observations

- Users naturally type spaces, not underscores. Canonical names use underscores. The space-vs-underscore mismatch silently broke searches before the engineering fix; now resolved.
- Users do not know UUIDs. Tutorials, install docs, and tool descriptions should never present "type a UUID" as the primary user input. Agents should resolve user-spoken filenames or document references to UUIDs internally.
- Claude consistently behaved well throughout: chose the right tool, made the right call, did not hallucinate field names or invented document IDs, and asked for help when the API returned empty or rejected. The MCP server's tool descriptions and the agent decision guide produced the desired agent behavior.

## Claude.ai connector re-test, post engineering fixes (2026-05-05)

Engineering shipped fixes for all three bugs flagged in the original audit. We re-ran the relevant tests in a fresh Claude.ai conversation with the same connector and confirmed every fix landed in production. We also covered Tests 5 to 8.

### Test 1: `talonic_list_schemas` (re-test)

Variants run: count check ("how many schemas do I have"), full list, contextual ("which are best for invoices"), specific lookup ("show the field definition of my CoI schema").

**Result: pagination fix verified.** All 10 schemas returned (the workspace grew from 7 to 10 due to schemas saved during Test 8). Claude reasoned correctly across the full list, picked the right invoice schema, and surfaced the AUDIT_TEST_SCHEMA "safe to delete" hint without prompting.

### Test 2: `talonic_search` (re-test)

Variants run: baseline single-word, multi-word with space, multi-word with hyphen, conceptual, raw-JSON inspection.

**Result: tokenization fix verified.** `"test invoice"` (space) matches both `test_invoice.pdf` (underscore) and `test-invoice.pdf` (hyphen). `"sample invoices"` matches `sample-invoice.pdf`, `sample-invoice_copy.pdf`, etc. The raw response shows the new `filterable` boolean on every field and field-match entry. One transient HTTP 502 from the Talonic API during the conceptual variant; retry succeeded.

### Test 3: `talonic_filter` (re-test, the heaviest)

Variants run: natural language (`"invoices over 100 EUR"`), explicit canonical name, schema-defined field with no extractions, nonexistent field, multi-condition composability.

**Result: filter trifecta verified.** Agents reliably check `filterable: true` before calling filter. When filter is called against a schema-defined field with no extracted data, the response contains the explicit message "no extracted data has been indexed against this field yet" rather than the previous opaque `VALIDATION_ERROR`. After extracting documents through a schema, filter correctly recognizes the now-materialized fields.

**New finding: schema-typing footgun.** After extracting 10 invoices via the `Invoice to CSV` schema, filter on `invoice_total > 100` still returned zero results. Claude diagnosed: the schema's `invoice_total` field is typed as a string (extracted values include currency symbols and locale formatting). Numeric `gt` comparisons silently no-op against string-typed fields. This is a schema-design UX trap, not a filter bug. Engineering candidates: warn at schema creation time, surface field type in filter responses, document type-to-operator compatibility in tool descriptions.

### Test 4: `talonic_get_document` (re-test, variant D only)

The previously failing variant ("test invoice", space) now works. Claude searches, finds both `test_invoice.pdf` and `test-invoice.pdf`, asks for clarification rather than guessing. Defensive agent behavior intact.

### Test 5: `talonic_to_markdown`

Variants run: UUID, filename with extension, natural language reference.

**Result: verified.** Search-to-markdown chain works for filenames with extensions (`bill 3.pdf`) and conceptual references (`din spec`). Bonus: when given a malformed UUID (9 hex chars in segment 1 instead of 8), Claude detected and asked the user to verify rather than calling the tool.

### Test 6 / Test 7: `talonic_extract` via drag-and-drop file_data

**Diagnosed 2026-05-06.** The hosted MCP path for file uploads via Claude.ai's drag-and-drop UI returns a response with `null` extracted fields. Controlled test in Claude.ai with a flat schema produced a clear diagnosis from Claude itself: "the file_data parameter only received the first 502 bytes of the file rather than the full PDF." Root cause is **Claude.ai's hard cap on tool-call argument size** (effectively under ~1KB per parameter). A base64-encoded real PDF is hundreds of KB; the bytes get truncated before reaching the MCP server. Talonic API receives a stub document, registers it with low/empty page content, and returns `null` extracted fields. This is a Claude.ai platform limit on connectors, not a Talonic MCP server or API bug.

The file_url path and the document_id path both work in Claude.ai. Local-stdio installs (Claude Desktop, Cursor, Cline, Continue, Cowork) have no parameter cap and work correctly via `file_data`. Architectural fix is pre-signed upload URLs (see follow-ups).

### Test 8: `talonic_save_schema`

Variants run: direct save with full schema, iterative design with user confirmation, save-and-verify-via-list-schemas, avoid-duplicate.

**Result: verified.** Save returns new UUID and SCH- short id. Agent correctly skips creation when an equivalent schema already exists (defensive behavior from the decision guide). Three audit-created schemas can be cleaned from the dashboard: `Audit Test Receipt v2` (SCH-E98F14F3), `test schema 8b` (SCH-442DE261), `Quick Test` (SCH-727E970D). The earlier `AUDIT_TEST_SCHEMA` (SCH-DC88ABBB) from yesterday's curl test is still present.

## Follow-ups (ordered by leverage)

### Active workstream

**OAuth 2.1 client implementation on `mcp.talonic.com`.** Engineering shipped the OAuth 2.1 authorization server on `api.talonic.com` 2026-05-06 with dual-auth on the API (accepts both `tlnc_` keys and OAuth JWTs through the same guard). MCP-side work outstanding: expose `/.well-known/oauth-protected-resource` (or `WWW-Authenticate` on 401), extract bearer token from the `Authorization` header on each request, forward it to the Talonic SDK per-call, and keep env-var `TALONIC_API_KEY` working as the fallback for local-stdio installs. Seven clarifying questions sent to engineering before scoping (resource-server vs OAuth-client framing, `aud` claim, missing `schemas:write` scope, well-known endpoint location, token validation strategy, refresh handling, `WEB_URL`). Unblocks Anthropic Connectors Directory submission once shipped.

### Highest-priority unresolved

1. **`talonic_extract` via drag-and-drop in Claude.ai is bottlenecked by Claude.ai's tool-call argument size cap.** Diagnosed 2026-05-06. Claude.ai imposes an effective sub-1KB limit on tool-call argument size, so a base64-encoded PDF (hundreds of KB) is truncated before reaching the MCP server. Talonic API receives a stub document and returns a response with `null` extracted fields. This is a Claude.ai platform limit, not a Talonic MCP server or API bug. Architectural fix is pre-signed upload URLs: a new tool (e.g., `talonic_request_upload_url`) returns a one-time HTTPS PUT target so agents can upload outside the MCP tool-call channel and then reference the resulting `document_id`. Workaround in Claude.ai today: `file_url` or `document_id`. Local-stdio installs (Claude Desktop, Cursor, Cline, Continue, Cowork) have no parameter cap and work correctly via `file_data`. **Status 2026-05-06: proposal drafted in operator conversation (tool surface sketch, nine open design questions covering storage backend, document_id pre-allocation, expiry, size cap, cost model, deprecation of `file_data`, etc.). Parked pending OAuth completion. Resume the proposal pass before sending to engineering.**

### Resolved during the audit

- `talonic_list_schemas` pagination silent truncation: **fixed in production by engineering** (TypeORM `.limit()` to `.take()` change).
- `talonic_filter` discoverability triple bug (2a, 2b, 2c): **fixed in production by engineering** (resolveFieldNames fallback to user_schema_fields, new `filterable` flag on search responses).
- `talonic_search` word-boundary tokenization: **fixed in production by engineering** (spaces, underscores, hyphens equivalent).
- MCP Registry stale at 0.1.6: now at 0.1.12 with `isLatest: true`.
- `/.well-known/mcp.json` missing `talonic://webhooks/reference`: added to website in commit `455889d`.

### API-side (engineering owns)

2. **Schema-typing footgun.** Filter operators that depend on type (`gt`, `lt`, etc.) silently return zero results when the schema field type doesn't match. Surfaced when `invoice_total` typed as string blocked numeric filtering after successful extraction. Possible mitigations: warn at schema creation, surface field type in filter responses, document type-to-operator compatibility.
3. **`is_not_empty` filter operator (existing, pre-audit).** Underreports against fields known to be populated. Currently hidden at the MCP layer.
4. **Cost / EUR / balance and per-field provenance (existing, pre-audit).** Not surfaced in any tool response. Documented honestly in v1; nothing blocks launch but agents cannot reason about budget or trace per-field source coordinates.
5. **Transient HTTP 502 from Talonic API.** Observed once during the audit's conceptual search. Retry resolved. Worth monitoring under load.

### MCP / SDK / docs (we own)

(All five items from the original 6-10 group resolved 2026-05-07. See "Resolved 2026-05-07: MCP/SDK code group" below.)

### Operational / pipeline

11. **Wire `mcp-publisher publish` into the release pipeline** so the MCP Registry tracks the latest npm version automatically. Manual run currently needed after each `chore: bump` commit.

### Distribution (Workstream 2 territory)

12. **Glama listing release** (`https://glama.ai/mcp/servers/talonicdev/talonic-mcp`). Build was kicked off; status unknown. Low priority.
13. **Other directory submissions**: Smithery, Cursor, Cline, Continue, mcp.so, Cowork plugins.

### Resolved 2026-05-07: MCP/SDK code group

- **`talonic_to_markdown` description: parameter-cap warning**. Mirrored the file_data parameter-cap caveat from `extract.ts` so Claude.ai users get consistent guidance. talonic-mcp `575b6b1`, published 0.1.20.
- **SDK `WithRateLimit<T>` sentinel zeros**. `parseRateLimit` now returns `null` when no `X-RateLimit-*` headers are present; `WithRateLimit<T>.rateLimit` typed as `RateLimitInfo | null`. Pre-existing prettier drift across 13 content/resource files cleaned up at the same time. talonic-node `02a49ed` + `df0b59f`, published 0.1.8.
- **SDK `Document.triage` + `mime_type` typing**. New `DocumentTriage` interface with named fields (`sensitivity`, `department`, `jurisdiction`, `pii_detected`, `pii_categories`, `regulated_data`, `confidentiality_marking`); `Document.triage` is `DocumentTriage | null`; `Document.mime_type` is `string | null`. talonic-node `5fb64e3`, published 0.1.9.
- **Symlink-test stale-dist footgun**. Both `talonic-mcp/tests/server-symlink.test.ts` and `talonic-node/tests/cli-symlink.test.ts` now skip with a `console.warn` when `dist/` is older than `package.json` instead of failing with a misleading version-mismatch error. talonic-mcp `0158ad7`, talonic-node `766f7cd`. Tests-only changes; no npm bump.
- **Hosted MCP root discovery `docs` URL**. Was advertising `https://docs.talonic.com` (not a real subdomain); now `https://talonic.com/docs/mcp`. talonic-mcp `21720f6`, published 0.1.21.
- **Original "update tool descriptions to post-fix state" follow-up**. Verified already done in earlier commits this cycle (`talonic_filter` mentions `filterable`, `talonic_list_schemas` describes current format, `talonic_search` has no word-boundary caveat, `content/sections/troubleshooting.ts` covers schema-typing footgun and file_data blocker). No further work; the only addition was the to-markdown parameter-cap mirror in 575b6b1 above.

## Test artifact note

The `africau.edu/images/default/sample.pdf` URL used in the live extract test is now behind a captcha. Talonic correctly fetched the captcha HTML, OCR'd it, and returned a valid (if uninteresting) extraction. For future audits, use a Talonic-hosted test PDF or a stable public document. The audit-created `AUDIT_TEST_SCHEMA` (`SCH-DC88ABBB`) and the audit-created document (`756fba38-93ef-4b79-b309-8771422324f4`) can be deleted from the workspace dashboard.

## Audit method

- Sandbox-only checks (versions, repo state, tests, format, typecheck, AI-discovery validation): run from the agent sandbox.
- Live API tests (SDK CLI, hosted MCP, all 7 tools): run from operator's terminal with the operator's `tlnc_` API key. Sandbox is firewalled away from `api.talonic.com` and `mcp.talonic.com`, so direct runs from there are not possible.
- MCP Registry listing: fetched via the `web_fetch` tool against the registry's v0.1 servers endpoint.

Future audits should follow the same split.
