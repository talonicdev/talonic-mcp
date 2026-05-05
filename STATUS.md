# Talonic MCP and SDK Status

**Last audit:** 2026-05-05. **Audited by:** Claude (assisting Hamlet). **Scope:** Workstream 1 audit per the v1 launch plan, including post-fix re-verification.

This document captures the live state of the four Talonic developer surfaces ahead of the public v1 push: `@talonic/mcp`, `@talonic/node`, the website, and the official MCP Registry. Update before each release.

## TL;DR

The Claude.ai connector audit completed with engineering's three bug fixes confirmed live in production. Six of the 7 tools are verified end-to-end through Claude.ai's custom-connector UI. One tool path (drag-and-drop file upload via `talonic_extract` `file_data`) stalls and is the highest-priority unresolved item.

**Engineering fixes confirmed live (re-tested 2026-05-05):**

1. `talonic_list_schemas` pagination: now returns the full `data[]` matching `pagination.total`. Verified by listing all 10 schemas (was returning 2 of 7 yesterday).
2. `talonic_filter` discoverability triple-fix: search responses now include a `filterable` boolean flag on fields and field matches, agents respect it before calling filter, and the error message for non-filterable fields is informative.
3. `talonic_search` word-boundary tokenization: spaces, underscores, and hyphens are equivalent. `"test invoice"` matches both `test_invoice.pdf` and `test-invoice.pdf`.

**New issues found during the post-fix audit:**

1. **Schema-typing footgun.** When a schema field uses an inappropriate type (e.g. `invoice_total` typed as string instead of number), filter operators that depend on type (`gt`, `lt`, etc.) silently return zero results even after extraction. Not a filter bug, but a UX trap when designing schemas.
2. **`talonic_extract` via drag-and-drop in Claude.ai stalls.** Through the Claude.ai connector UI, dropping a PDF and asking for extraction never returns. No error, no result. The `file_data` path through the hosted MCP at `mcp.talonic.com/mcp` has not been verified end-to-end via this flow. Could be a Claude.ai tool-call timeout, a payload size cap, a hosted MCP buffering issue, or a Talonic API processing issue. Needs investigation.

**Older follow-ups still open:**

3. SDK's `WithRateLimit<T>` wrapper returns sentinel zeros (`{limit:0, remaining:0, resetAt:1970-01-01}`) instead of real `X-RateLimit-*` header values.
4. Hosted MCP root endpoint advertises `https://docs.talonic.com`, which may not be a real subdomain.

**Resolved during the audit:**

- All three API bugs from the original audit message (schemas list pagination, filter trifecta, search tokenization). Engineering shipped fixes within hours.
- Registry stale at 0.1.6: now at 0.1.12 with `isLatest: true`.
- `/.well-known/mcp.json` missing `talonic://webhooks/reference` resource: added in website commit `455889d`.

## Surfaces

### `@talonic/mcp`

| Item | State |
|---|---|
| Repo | clean, on main, pushed |
| package.json version | 0.1.12 |
| server.json version | 0.1.12 |
| npm published version | 0.1.12 |
| Auto-bump pipeline | working (verified after both v1-hardening commits) |
| Tests | 32 pass, 2 skipped (symlink tests, expected) |
| Format check | clean |
| Typecheck | clean |
| Build | clean |
| docs/sections.json | up to date with v1 surface (decision guide, examples, troubleshooting) |
| Tool descriptions | all 7 carry STATUS: stable; honest known limitations |
| MCP-layer schema validation | enforced; schema-less calls rejected fast |

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
| Listed version | 0.1.12 |
| `_meta` | active, `isLatest: true`, published 2026-05-04 |
| Install instructions | npx command and `TALONIC_API_KEY` env var, both correct |

Standing maintenance task: the auto-bump pipeline that publishes new versions to npm does not currently chain into `mcp-publisher publish`. Whoever cuts a release should run `mcp-publisher publish` from the talonic-mcp repo afterwards (or wire it into CI). Without that, the registry will lag npm.

## Live end-to-end tests against production

Hosted MCP at `https://mcp.talonic.com`:

| Endpoint | Test | Result |
|---|---|---|
| `GET /health` | curl | 200, `{"status":"ok","server":"talonic","version":"0.1.12"}` |
| `GET /` | curl | 200, service discovery JSON (mcp_endpoint, health_endpoint, auth, docs) |
| `POST /mcp` (Bearer header) | initialize handshake | 200, valid Mcp-Session-Id, serverInfo `talonic 0.1.12` |
| `POST /mcp?apiKey=...` | initialize handshake | 200, equivalent shape |
| `tools/list` | 7 tools advertised | all 7 present with STATUS: stable |

All 7 MCP tools, called through the hosted endpoint with a real `tlnc_` key. Updated post engineering fixes:

| Tool | Result | Notes |
|---|---|---|
| `talonic_list_schemas` | verified | pagination fix landed; all 10 schemas returned correctly (was 2 of 7 before fix) |
| `talonic_search` | verified | tokenization fix landed; `_`, `-`, ` ` equivalent; `filterable` boolean now on fields and field matches |
| `talonic_filter` | verified | discoverability fixes landed; informative errors when field is unfilterable; agents reliably check `filterable: true` before calling filter |
| `talonic_extract` | verified for `file_url` and `document_id`; **blocked for `file_data`** | UUID and SCH-XXXXXXXX both accepted on `schema_id`; MCP-layer schema validation guard active; drag-and-drop path stalls in Claude.ai (see follow-ups) |
| `talonic_get_document` | verified | UUID, filename with extension, filename without extension, and natural-language all work |
| `talonic_to_markdown` | verified | UUID and chained search-to-markdown via filename or natural language all work |
| `talonic_save_schema` | verified | direct save, iterative design with confirmation, save-and-verify-via-list, and avoid-duplicate (defensive) flows all work |

## Claude.ai connector test (live, with real key)

Workflow: Claude.ai > Settings > Connectors > Add custom connector. URL: `https://mcp.talonic.com/mcp?apiKey=tlnc_REDACTED`. **Bearer header in a custom-header field is not supported by Claude.ai's connector UI; only the URL-with-apiKey form works.** This is the documented v1 install pattern for Claude.ai users.

Once added, the connector loads all 7 tools with their STATUS: stable descriptions and per-tool permission toggles (default: Needs approval).

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

**Blocked.** The hosted MCP path for file uploads via Claude.ai's drag-and-drop UI never returns. Claude reads the file and reports it's encoding to base64 and sending, but no tool result and no error appears. We have not isolated whether the bottleneck is Claude.ai's tool-call timeout, payload size cap, the hosted MCP at `mcp.talonic.com` buffering or stalling, or the Talonic API. Highest-priority unresolved item.

The file_url path (covered yesterday in Test 6 and re-confirmed today) and the document_id path both work. So extract itself is fine; the file_data delivery channel through Claude.ai is the suspect.

### Test 8: `talonic_save_schema`

Variants run: direct save with full schema, iterative design with user confirmation, save-and-verify-via-list-schemas, avoid-duplicate.

**Result: verified.** Save returns new UUID and SCH- short id. Agent correctly skips creation when an equivalent schema already exists (defensive behavior from the decision guide). Three audit-created schemas can be cleaned from the dashboard: `Audit Test Receipt v2` (SCH-E98F14F3), `test schema 8b` (SCH-442DE261), `Quick Test` (SCH-727E970D). The earlier `AUDIT_TEST_SCHEMA` (SCH-DC88ABBB) from yesterday's curl test is still present.

## Follow-ups (ordered by leverage)

### Highest-priority unresolved

1. **`talonic_extract` via drag-and-drop in Claude.ai stalls.** Drop a PDF, ask for extraction, the call never returns. No error, no result. Possible causes: Claude.ai tool-call timeout, payload size cap on the connector, hosted MCP buffering bug, Talonic API stall on multipart upload. Diagnostic plan: try a tiny (sub-100KB) PDF first to isolate; if still stalls, file_data path through the hosted MCP is suspect; verify against local stdio for comparison.

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

### MCP / SDK / docs (we own; ship in next 0.1.x release)

6. **Update tool descriptions and known-limitations to reflect the post-fix state.** `talonic_filter` description should mention the `filterable` flag and recommend agents check it. `talonic_list_schemas` should describe the format that survives in real-world use. `talonic_search` description can drop the word-boundary caveat. `content/sections/troubleshooting.ts` known-limitations needs to list the schema-typing footgun and the file_data Claude.ai blocker. Add a brief note about preferring number-typed schema fields when filtering. (This is the planned 0.1.15+ release work.)
7. **`WithRateLimit<T>` returns sentinel zeros.** SDK currently returns `{limit:0, remaining:0, resetAt:1970-01-01}`. Either the API isn't emitting `X-RateLimit-*` or the SDK transport isn't parsing them. Verify and fix.
8. **`docs.talonic.com` discovery URL.** The hosted MCP root advertises this URL. Confirm whether the subdomain resolves; if not, change the discovery payload to `https://talonic.com/docs/mcp`.
9. **Add `triage` and `mime_type` to the SDK's `Document` type.** API returns them; SDK type doesn't declare them.
10. **Symlink test stale-dist footgun.** Both `talonic-mcp` and `talonic-node` symlink tests fail when `dist/` was built at an older version. Either make `npm test` depend on `npm run build`, or have the test rebuild before spawning the symlinked CLI.

### Operational / pipeline

11. **Wire `mcp-publisher publish` into the release pipeline** so the MCP Registry tracks the latest npm version automatically. Manual run currently needed after each `chore: bump` commit.

### Distribution (Workstream 2 territory)

12. **Glama listing release** (`https://glama.ai/mcp/servers/talonicdev/talonic-mcp`). Build was kicked off; status unknown. Low priority.
13. **Other directory submissions**: Smithery, Cursor, Cline, Continue, mcp.so, Cowork plugins.

## Test artifact note

The `africau.edu/images/default/sample.pdf` URL used in the live extract test is now behind a captcha. Talonic correctly fetched the captcha HTML, OCR'd it, and returned a valid (if uninteresting) extraction. For future audits, use a Talonic-hosted test PDF or a stable public document. The audit-created `AUDIT_TEST_SCHEMA` (`SCH-DC88ABBB`) and the audit-created document (`756fba38-93ef-4b79-b309-8771422324f4`) can be deleted from the workspace dashboard.

## Audit method

- Sandbox-only checks (versions, repo state, tests, format, typecheck, AI-discovery validation): run from the agent sandbox.
- Live API tests (SDK CLI, hosted MCP, all 7 tools): run from operator's terminal with the operator's `tlnc_` API key. Sandbox is firewalled away from `api.talonic.com` and `mcp.talonic.com`, so direct runs from there are not possible.
- MCP Registry listing: fetched via the `web_fetch` tool against the registry's v0.1 servers endpoint.

Future audits should follow the same split.
