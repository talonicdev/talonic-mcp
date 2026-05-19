# Talonic MCP and SDK Status

**Last audit:** 2026-05-19 (targeted refresh on the MCP Registry / CI work and the dispatch-token testing churn from 2026-05-18; full audit dates back to 2026-05-13). **Audited by:** Claude (assisting Hamlet). **Scope:** post-Claude-Connectors-submission state refresh; sync versions, follow-ups, and resolved items across `@talonic/mcp`, `@talonic/node`, website, and the official MCP Registry.

This document captures the live state of the four Talonic developer surfaces ahead of the public v1 push: `@talonic/mcp`, `@talonic/node`, the website, and the official MCP Registry. Update before each release.

## TL;DR

`@talonic/mcp` is at **0.1.44** on npm, `@talonic/node` is at **0.1.22** on npm. All 8 MCP tools and 2 resources are stable in production via both stdio and the hosted endpoint. OAuth 2.1 connector flow on Claude.ai is live and verified. The Claude Connectors Directory submission was sent on 2026-05-12 and is awaiting Anthropic review (escalation point 2026-05-26 if Anthropic remains silent). The hosted MCP endpoint now serves Streamable HTTP at both `/` and `/mcp`, `mcp-publisher` and `gh release create` are both wired into the publish workflow via GitHub OIDC, and `talonic_filter` now surfaces the API `warnings` array on its outputSchema (schema-typing footgun option 1 shipped in 0.1.38). All three CI sync chains were verified end-to-end on 2026-05-18 by the dispatch-token testing burst: 0.1.39 → 0.1.44 all auto-published to npm, auto-pushed to the Registry (currently at 0.1.44), and auto-cut as GitHub Releases. The remaining real-work item is **pre-signed upload URLs** to route around Claude.ai's tool-call argument cap on `file_data`; everything else is either resolved or operational.

**Headline changes since the previous audit:**

0. **Hosted MCP now serves Streamable HTTP at `/` and `/mcp`** (0.1.37). The root path discriminates by method/Accept: plain `GET /` still returns the discovery JSON, but POST/DELETE and SSE GETs at `/` route through the same transport that serves `/mcp`. Closes a class of bug where directory listings (Glama's hosted MCP Inspector, etc.) register the bare origin and receive the discovery JSON when they expect a JSON-RPC frame. Verified against an isolated `http.Server` harness in `tests/http-server.test.ts`.
0. **`mcp-publisher` chained into the publish workflow** (commit `1e87668`). Authenticates via GitHub Actions OIDC (`id-token: write`, `mcp-publisher login github-oidc`); both install + publish steps run with `continue-on-error: true` so a Registry hiccup never blocks the website / platform-docs rebuilds. Pinned to `mcp-publisher v1.7.9`. The chain fires on the next change matching `paths: src/** | docs/** | package.json`; until then, the Registry remains at 0.1.28.
1. **`talonic_get_balance` tool shipped** (0.1.25). Wraps `GET /v1/credits/balance` so agents can make budget-aware decisions. Tool count: 7 → 8.
2. **Per-call `cost` block** on `talonic_extract` and `talonic_to_markdown` responses (0.1.25). Parsed from the API's `X-Talonic-Cost-*` headers by `@talonic/node@0.1.10+`.
3. **`is_not_empty` filter operator re-exposed** (0.1.29). The upstream materialized-values index now updates within seconds of extraction.
4. **OAuth 2.1 hosted-MCP path** complete with per-request bearer extraction, `/.well-known/oauth-protected-resource`, `WWW-Authenticate` header, and token rotation (shipped 0.1.18–0.1.19; verified end-to-end on Claude.ai 2026-05-08).
5. **Compliance hardening for the Claude Connectors Directory submission** (0.1.34–0.1.35): Origin-header allowlist (DNS-rebinding mitigation), `SECURITY.md` with `safety@talonic.ai` disclosure channel and 30-day fix target, and `/favicon.ico` + `/favicon.png` served from the hosted MCP.
6. **Three QA-reported `-32602 Output validation error` failures fixed** (0.1.22–0.1.23): `description`, `mime_type`, and `fields[].id` accept `null` where the API legitimately returns it. Regression tests added.

**Older follow-ups still open:**

- **Pre-signed upload URLs.** Architectural fix for Claude.ai's tool-call argument-size cap on `file_data`. Proposal drafted (tool surface sketch, nine open design questions). Parked pending OAuth; OAuth is now done — resume the proposal pass.
- **Cowork (Claude Cowork) directory submission.** Not yet done.
- **Wire auto-release CI into `talonic-node`'s publish workflow.** The SDK repo currently has no GitHub Releases (`gh release list --repo talonicdev/talonic-node` returns empty) despite shipping through 0.1.22 on npm. Mirror the `Create GitHub Release` step from `talonic-mcp`'s `publish.yml` so the SDK changelog is visible alongside npm publishes. Low-priority but small; useful for anyone tracking SDK changes via GitHub.
- **Schema-typing footgun option 2 re-test.** Before filing with the API team, re-test on the current production surface whether `type` is now returned on `talonic_search` fieldMatches and `talonic_list_schemas` entries. If yes, the MCP-side outputSchema work is trivial. If no, file the API request.

**Resolved since the previous audit:**

- Hosted MCP root-path routing: `POST /` and `DELETE /` (and `GET /` with `Accept: text/event-stream`) now route through the same transport as `/mcp`. Plain `GET /` still returns discovery JSON. Shipped 0.1.37 (commit `2cf0c43`). See [Resolved 2026-05-18: hosted MCP at root + Registry CI chain](#resolved-2026-05-18-hosted-mcp-at-root--registry-ci-chain).
- `mcp-publisher` chained into `.github/workflows/publish.yml` via GitHub OIDC (commit `1e87668`). Verified end-to-end on 2026-05-18: Registry now auto-tracks npm; current Registry isLatest is 0.1.44.
- Auto-create GitHub Releases on bump wired into `publish.yml` (commit `c18f652`). Verified by six successful Releases (v0.1.39 → v0.1.44) cut during the 2026-05-18 dispatch-token testing burst. Glama and other surfaces that track GitHub Releases now stay current automatically.
- Schema-typing footgun option 1 shipped: `warnings` field added to `talonic_filter`'s outputSchema (`src/tools/filter.ts`), plus a tool-description nudge telling agents to surface `warnings[].message` (and `suggestion`, when present) to the user rather than silently retrying. Shipped 0.1.38 (commit `eedbe11`). The schema-typing trap is now visible to agents that hit it.
- `talonic_filter` schema-typing footgun: tool description now carries a SCHEMA TYPING block (0.1.16) and the API returns a `warnings` array when a numeric operator is applied to a string-typed field. Surface the `warnings` array in the filter outputSchema as a small follow-up (see [Schema-typing footgun options](#schema-typing-footgun-options)).
- `is_not_empty` filter operator: re-exposed in 0.1.29; checks the materialized-values index.
- Cost / EUR / balance and per-field provenance not surfaced: closed by `talonic_get_balance` (0.1.25), per-call `cost` block (0.1.25), and `include_provenance` on `talonic_extract` (0.1.14).
- `SECURITY.md` disclosure policy: shipped 0.1.35; reports go to `safety@talonic.ai`.
- Favicon for the Connectors Directory listing: shipped 0.1.35 at `/favicon.ico` and `/favicon.png` (inlined as base64 in `src/favicon.ts`).
- Origin-header allowlist for DNS-rebinding mitigation: shipped 0.1.34 via `src/origin.ts`. Allowlists three Claude.ai variants plus four MCP-directory surfaces; rejects everything else with a structured 403. Empty Origin passes through (native + server-to-server clients).
- Three QA-reported `-32602 Output validation error` failures (descriptions, mime_type, fields[].id null acceptance): fixed in 0.1.22–0.1.23 with regression tests.
- Hosted MCP root endpoint advertising `https://docs.talonic.com`: now points at `https://talonic.com/docs/mcp` (0.1.21).
- SDK `WithRateLimit<T>.rateLimit` sentinel zeros: nullable in `@talonic/node@0.1.8+`.

## Surfaces

### `@talonic/mcp`

| Item                        | State                                                                                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo                        | clean, on main, pushed                                                                                                                                                                                                 |
| package.json version        | 0.1.44                                                                                                                                                                                                                 |
| server.json version         | 0.1.44                                                                                                                                                                                                                 |
| npm published version       | 0.1.44 (published 2026-05-18 via the auto-bump pipeline; verified end-to-end through the dispatch-token testing burst — see [Resolved 2026-05-18](#resolved-2026-05-18-hosted-mcp-at-root--registry-ci-chain))         |
| Auto-bump pipeline          | working; granular npm token with bypass-2FA in place; auto-bumps patch on every src/docs/package.json change. Also runs `mcp-publisher publish` (OIDC) and `gh release create` (OIDC, default GITHUB_TOKEN) after npm publish; both soft-fail. |
| Tests                       | 57 pass, 2 skipped (added 6 tests in `tests/http-server.test.ts` for `/` + `/mcp` routing, plus 3 in `tests/tools/tools.test.ts` for the `filter` warnings outputSchema; symlink tests still skip when `dist/` is older than `package.json`; verified 2026-05-19) |
| Format check                | clean                                                                                                                                                                                                                  |
| Typecheck                   | clean                                                                                                                                                                                                                  |
| Build                       | clean                                                                                                                                                                                                                  |
| docs/sections.json          | up to date with v1 surface (decision guide, examples, troubleshooting, post-OAuth install reframing, code-rich content sweep through 0.1.31)                                                                          |
| Tools                       | 8 stable: `talonic_extract`, `talonic_search`, `talonic_filter`, `talonic_get_document`, `talonic_to_markdown`, `talonic_list_schemas`, `talonic_save_schema`, `talonic_get_balance`                                  |
| Resources                   | 2: `talonic://schemas`, `talonic://webhooks/reference`                                                                                                                                                                  |
| Tool descriptions           | all 8 carry STATUS: stable; honest known limitations                                                                                                                                                                   |
| Tool annotations            | all 8 carry `readOnlyHint`, `destructiveHint`, `openWorldHint`; read-only tools (search, filter, list_schemas, get_document, get_balance) marked `readOnlyHint: true`; write tools (extract, to_markdown, save_schema) marked false |
| MCP-layer schema validation | enforced; schema-less calls rejected fast                                                                                                                                                                              |
| OAuth 2.1 (hosted)          | live; per-request bearer extraction; `/.well-known/oauth-protected-resource`; `WWW-Authenticate` header on 401 (RFC 9728); token rotation supported                                                                    |
| Origin allowlist (hosted)   | live in `src/origin.ts`; allows Claude.ai (3 variants) + MCP-directory surfaces; rejects others with structured 403; empty Origin passes through                                                                       |
| SECURITY.md                 | live; disclosure to `safety@talonic.ai`, 30-day fix target                                                                                                                                                              |
| Favicon                     | served at `/favicon.ico` and `/favicon.png` from the hosted MCP (inlined in `src/favicon.ts`)                                                                                                                          |
| Privacy Policy              | live in README                                                                                                                                                                                                         |

### `@talonic/node`

| Item                  | State                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Repo                  | clean, on main, pushed                                                                                               |
| package.json version  | 0.1.22                                                                                                               |
| npm published version | 0.1.22 (last functional release was 0.1.16 — 2026-05-11; 0.1.17 → 0.1.22 were dispatch-token churn bumps on 2026-05-18 with no source-code changes) |
| Tests                 | 122 pass, 2 skipped (last verified during the previous audit; re-run on next SDK touch)                              |
| `npm run check:spec`  | passes; SDK call sites match the OpenAPI spec                                                                        |
| docs/sections.json    | reflects current surface (`WithRateLimit<T>`, `CostInfo`, `Credits` resource, `DocumentTriage`, `autoPopulateRequired`) |
| SDK surface added     | `talonic.credits.getBalance()` + `EnhancedBalance`, `CostInfo` parsed from `X-Talonic-Cost-*` headers, `DocumentTriage` with named fields, `Document.mime_type` nullable |
| SDK CLI               | `npx -y @talonic/node@latest schemas list` works against production                                                  |

### Website (`/Users/macman/Downloads/Talonic/website`)

| Item                         | State                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Repo                         | clean (after one fix this audit)                                                   |
| `update-docs.yml` workflow   | running on every package publish; recent commits visible in main                   |
| `package-lock.json`          | `@talonic/mcp@0.1.12`, `@talonic/node@0.1.7`                                       |
| `npm run check:ai-discovery` | passes after this audit's fix                                                      |
| `/.well-known/mcp.json`      | tool list now matches @talonic/mcp registrations (9 registered, 9 declared)        |
| `/.well-known/agent.json`    | 5 skills declared                                                                  |
| `/.well-known/api-catalog`   | exists                                                                             |
| `/llms-full.txt`             | mentions hosted MCP, confidence scores, npx install                                |
| Build                        | not verified in audit (sandbox network restriction); run on dev machine to confirm |

Audit fix during this run: `talonic://webhooks/reference` was missing from `/.well-known/mcp.json`; added in commit `455889d`.

### Official MCP Registry

| Item                 | State                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listing URL          | `https://registry.modelcontextprotocol.io/v0/servers?search=io.github.talonicdev/talonic-mcp`                                                                                                                                                                                                                                   |
| Listed name          | `io.github.talonicdev/talonic-mcp`                                                                                                                                                                                                                                                                                              |
| Listed version       | 0.1.44 (latest, isLatest=true, published 2026-05-18). In sync with npm; the Registry now auto-tracks via the wired `mcp-publisher publish` step in CI.                                                                                                                                                                          |
| Install instructions | npx command and `TALONIC_API_KEY` env var, both correct                                                                                                                                                                                                                                                                         |
| Standing follow-up   | none.                                                                                                                                                                                                                                                                                                                           |

## Live end-to-end tests against production

> The endpoint snapshots below were captured during the 2026-05-05 audit; the recorded server version is `0.1.12`. The tool-by-tool verification rows still reflect the current behaviour. Re-run on the next live audit to refresh the captured version.

Hosted MCP at `https://mcp.talonic.com`:

| Endpoint                    | Test                 | Result                                                                  |
| --------------------------- | -------------------- | ----------------------------------------------------------------------- |
| `GET /health`               | curl                 | 200, `{"status":"ok","server":"talonic","version":"0.1.12"}`            |
| `GET /`                     | curl                 | 200, service discovery JSON (mcp_endpoint, health_endpoint, auth, docs) |
| `POST /mcp` (Bearer header) | initialize handshake | 200, valid Mcp-Session-Id, serverInfo `talonic 0.1.12`                  |
| `POST /mcp?apiKey=...`      | initialize handshake | 200, equivalent shape                                                   |
| `tools/list`                | 8 tools advertised   | all 8 present with STATUS: stable                                       |

All 8 MCP tools, called through the hosted endpoint with a real `tlnc_` key. Updated post engineering fixes:

| Tool                   | Result                                                                                | Notes                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `talonic_list_schemas` | verified                                                                              | pagination fix landed; all 10 schemas returned correctly (was 2 of 7 before fix)                                                                                                                                                                                                                                                                                                |
| `talonic_search`       | verified                                                                              | tokenization fix landed; `_`, `-`, ` ` equivalent; `filterable` boolean now on fields and field matches                                                                                                                                                                                                                                                                         |
| `talonic_filter`       | verified                                                                              | discoverability fixes landed; informative errors when field is unfilterable; agents reliably check `filterable: true` before calling filter                                                                                                                                                                                                                                     |
| `talonic_extract`      | verified for `file_url` and `document_id`; **truncated for `file_data` in Claude.ai** | UUID and SCH-XXXXXXXX both accepted on `schema_id`; MCP-layer schema validation guard active; Claude.ai's tool-call argument size cap truncates base64 file_data before it reaches the MCP server (Claude.ai platform limit, not a server bug); local-stdio installs unaffected (see follow-ups). Now surfaces per-call `cost` parsed from `X-Talonic-Cost-*` response headers. |
| `talonic_get_document` | verified                                                                              | UUID, filename with extension, filename without extension, and natural-language all work                                                                                                                                                                                                                                                                                        |
| `talonic_to_markdown`  | verified                                                                              | UUID and chained search-to-markdown via filename or natural language all work. Surfaces `cost` on file paths (extract step ran), `null` on the `document_id` path.                                                                                                                                                                                                              |
| `talonic_save_schema`  | verified                                                                              | direct save, iterative design with confirmation, save-and-verify-via-list, and avoid-duplicate (defensive) flows all work                                                                                                                                                                                                                                                       |
| `talonic_get_balance`  | shipped 2026-05-07                                                                    | New tool wrapping `GET /v1/credits/balance`. Returns balance_credits, balance_eur, burn_rate_30d_credits, projected_runway_days, tier, tier_resets_at.                                                                                                                                                                                                                          |

## Claude.ai connector test (live, with real key)

> The transcripts below are from the 2026-05-05 / 2026-05-07 audit runs. They predate the OAuth flow shipping (2026-05-08); the API-key URL form documented here still works as a fallback. The current recommended Claude.ai install path is the OAuth connector flow described in [Resolved 2026-05-08: OAuth connector flow](#resolved-2026-05-08-oauth-connector-flow).

Workflow: Claude.ai > Settings > Connectors > Add custom connector. URL: `https://mcp.talonic.com/mcp?apiKey=tlnc_REDACTED`. **Bearer header in a custom-header field is not supported by Claude.ai's connector UI; only the URL-with-apiKey form works.** This is the documented v1 fallback install pattern for Claude.ai users (OAuth is the recommended path).

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

**Claude Connectors Directory submission (submitted 2026-05-12, awaiting Anthropic review).** Submitted `@talonic/mcp` as a Remote MCP via the form at `https://clau.de/mcp-directory-submission`. Compliance audited against Anthropic's Software Directory Policy, Software Directory Terms, and the pre-submission checklist at `https://claude.com/docs/connectors/building/review-criteria`. Anthropic's status surface in Claude.ai is not yet live; escalate via `mcp-review@anthropic.com` only if no response after two weeks (so on or after 2026-05-26).

**Form inputs as submitted.**

- Company: Talonic, `https://talonic.com`.
- Primary contact: Hamlet Hayrapetyan, `hamlet@talonic.ai`, Head of Product.
- Anthropic POC: none.
- Server name (singular noun shown to users): **Talonic**.
- Server URL: `https://mcp.talonic.com/mcp`.
- Tagline (≤55 chars): "Extract validated structured data from any doc".
- MCP Server Description (50–100 words): single paragraph covering the eight tools, two resources, schema-validated extraction, confidence scores, HIPAA-compliant workspace, OAuth.
- Use Cases (Policy 3.E, ≥3): seven categorised prompts — Extract Structured Data, Find Documents in Workspace, Filter by Field Values, Get OCR Markdown, Save Reusable Schema, Re-extract with Different Schema, Check Budget Before Batch.
- Read/Write capability: **Read + Write**.
- MCP App (interactive UI): **No**.
- Third-party Connections / Web Access: **N/A** (first-party API only; `file_url` is a targeted user-pointed download, not arbitrary web browsing).
- Data Handling: server only accesses user-requested data ✓, HTTPS/TLS encryption ✓, GDPR-compliant ✓; "no data beyond session" intentionally unticked (the workspace is persistent by design).
- Health data access: **Other** with caveat — generic document extraction, users may upload health docs at their discretion, HIPAA-compliant with BAA available.
- Categories (radio, single-select): **Business & Productivity** primary; Data & Analytics was the secondary preference.
- Sponsored content / ads: **No, there is no sponsored content or advertisements**.
- Authentication type: **OAuth 2.0** (implementation is OAuth 2.1 with PKCE, a strict superset).
- Auth Client: **Dynamic OAuth Client** (RFC 7591 DCR).
- Static Client ID/Secret: blank (N/A for dynamic).
- Transport Support: **Streamable HTTP** only (SSE not implemented).
- Allowed link URIs: `https://app.talonic.com`, `https://talonic.com`.
- MCP documentation URL: `https://github.com/talonicdev/talonic-mcp#readme` (primary); `https://talonic.com/docs/mcp` (secondary).
- Privacy policy: `https://talonic.com/privacy` (covers MCP-connector data flow and GDPR/DPA).
- Data Processing Agreement URL: blank (DPA available on request, mentioned in privacy policy).
- Support channel: `info@talonic.ai`.
- Tools list (8): `talonic_extract` (Extract Data from Document), `talonic_search` (Search Talonic Workspace), `talonic_filter` (Filter Talonic Documents), `talonic_get_document` (Get Talonic Document), `talonic_to_markdown` (Document to Markdown), `talonic_list_schemas` (List Talonic Schemas), `talonic_save_schema` (Save Talonic Schema), `talonic_get_balance` (Get Talonic Credit Balance).
- Resources list (2): `talonic://schemas` (Talonic Schemas), `talonic://webhooks/reference` (Talonic Webhooks Reference).
- Prompts list: empty (no MCP prompts registered).
- GA date: 2026-04-01 (Talonic MCP has been live since early April 2026).
- Server logo: `Logo 400px.png` uploaded via the form's file field (no public SVG URL yet).
- Favicon: served at `https://mcp.talonic.com/favicon.ico` from commit `87f11e3` (in 0.1.35).
- Surfaces tested: Claude.ai (web) ✓, Claude Desktop ✓, Cowork ✓. Claude Code unconfirmed at submission time.
- Test account: `mcp-reviewer@talonic.ai`; OAuth flow handles sign-in; no 2FA on this account.
- Technical Requirements: all six boxes ticked (OAuth 2.0 fully implemented, annotations on all tools, HTTPS-only, CORS properly configured via Origin allowlist, Claude.ai/Code IPs allowlisted, tested with Claude.ai on latest build).
- Documentation Requirements: docs + setup/troubleshooting + privacy policy + terms of service all ticked.
- Testing Requirements: all three boxes ticked.
- Additional Information: short blurb noting npm version, HIPAA compliance, RFC 7591 DCR, existing directory listings, and the `safety@talonic.ai` security channel.

**Compliance audit findings.**

- Tool annotations (`title` + applicable `readOnlyHint`/`destructiveHint`) on all 8 tools.
- Tool names all ≤64 chars.
- Tool descriptions free of prompt-injection patterns (grepped for "always call", "override", "Claude must", "behavioral instructions"; zero hits).
- API ownership: all endpoints first-party.
- No unsupported use cases (no crypto, no AI image gen, no ads).
- Streamable HTTP transport.
- OAuth 2.1 (superset of OAuth 2.0) with recognised-CA certificates (Cloudflare/Let's Encrypt).
- Origin-header validation: shipped 2026-05-12 in commit `2365563` (published as 0.1.34). Allowlists three Claude.ai variants plus four MCP-directory surfaces; rejects everything else with a structured 403. Empty Origin passes through (native and server-to-server clients).
- `talonic_to_markdown` annotation polymorphism: `readOnlyHint: false, destructiveHint: false` because the tool ingests on the raw-file branch and is read-only on the `document_id` branch. Spec-correct (creates new records, does not modify/delete existing). Decision: leave as-is, polymorphism documented in the tool description.
- `SECURITY.md` with disclosure policy and 30-day fix target shipped 2026-05-12 (commits `386ed0b` and `e713580`, published as 0.1.35). Points reports to `safety@talonic.ai`.
- Favicon served at `/favicon.ico` and `/favicon.png` with `Content-Type: image/png` and a 24-hour cache header. Inlined as base64 in `src/favicon.ts`. Shipped 2026-05-12 in commit `87f11e3` (published as 0.1.35).

**Post-submission items (Hamlet owns).**

- [x] Populate the reviewer workspace with sample documents and saved schemas. **Done 2026-05-13.** The reviewer account is `demo-user@talonic.ai` (updated from the original `mcp-reviewer@talonic.ai`); the workspace has the sample documents and schemas a reviewer needs to drive the connector end-to-end.
- [x] Nudge `https://www.google.com/s2/favicons?domain=mcp.talonic.com&sz=64` from a browser so Google's scraper refreshes; verify the Talonic logo renders within a few hours. **Done 2026-05-13.**
- [ ] If no response from Anthropic within two weeks (i.e. on or after 2026-05-26), escalate via `mcp-review@anthropic.com`.

**References.**

- Policy: `https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy`
- Terms: `https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms`
- Pre-submission checklist: `https://claude.com/docs/connectors/building/review-criteria.md`
- Submission guide: `https://claude.com/docs/connectors/building/submission.md`

### Highest-priority unresolved

1. **`talonic_extract` via drag-and-drop in Claude.ai is bottlenecked by Claude.ai's tool-call argument size cap.** Diagnosed 2026-05-06. Claude.ai imposes an effective sub-1KB limit on tool-call argument size, so a base64-encoded PDF (hundreds of KB) is truncated before reaching the MCP server. Talonic API receives a stub document and returns a response with `null` extracted fields. This is a Claude.ai platform limit, not a Talonic MCP server or API bug. Architectural fix is pre-signed upload URLs: a new tool (e.g., `talonic_request_upload_url`) returns a one-time HTTPS PUT target so agents can upload outside the MCP tool-call channel and then reference the resulting `document_id`. Workaround in Claude.ai today: `file_url` or `document_id`. Local-stdio installs (Claude Desktop, Cursor, Cline, Continue, Cowork) have no parameter cap and work correctly via `file_data`. **Status 2026-05-13:** proposal was parked pending OAuth completion. OAuth shipped 2026-05-08 (see [Resolved 2026-05-08: OAuth connector flow](#resolved-2026-05-08-oauth-connector-flow)), so the proposal pass can now resume. Nine open design questions to resolve before sending to engineering: storage backend, document_id pre-allocation, expiry, size cap, cost model, deprecation of `file_data`, retry semantics on PUT failure, multipart vs. single-part, signed-URL signing key rotation.

### Schema-typing footgun options

The schema-typing footgun (numeric operators silently no-op against string-typed fields holding numeric content) is partially mitigated today:

- `talonic_filter` tool description carries a SCHEMA TYPING block since 0.1.16: callers are told that `gt`/`gte`/`lt`/`lte`/`between` only resolve correctly against `number`-typed fields.
- The upstream API returns a `warnings` array on filter responses when a numeric operator is applied to a string-typed field.
- `troubleshooting` section in `docs/sections.json` documents the trap.

Mitigation options, ordered by leverage:

1. ~~**Surface the API `warnings` array in `talonic_filter`'s outputSchema**~~ — **Shipped 0.1.38** (commit `eedbe11`). `warnings` is now declared as an optional array of permissive `.passthrough()` objects with `code`/`message`/`field`/`field_id`/`suggestion` keys, so the API's existing warning reaches the agent's `structuredContent` intact. Tool description nudges agents to surface `message` (and `suggestion`) verbatim rather than silently retrying.
2. **Surface field type in `talonic_search` and `talonic_list_schemas` outputs** so agents can check `field.type === 'number'` before constructing a `gt`/`lt` condition. Needs upstream API to return `type` on field-registry and schema-field entries (it returns it on schema definitions today but not consistently on `search` fieldMatches). **Engineering coordination required; status 2026-05-19: parked pending a re-test pass against the current API before filing.**
3. **Pre-check in the MCP filter handler.** Before forwarding to the API, look up the schema-field type for the conditions where the operator is numeric. Reject or warn if the type is string. Costs an extra API call per filter (or schema cache). Highest cost, hardest to keep correct as the schema surface evolves. **Not recommended.**
4. **Schema-creation-time warning at the API layer.** When a user types a numeric-looking field as `string` in `talonic_save_schema`, emit a warning in the response. Pure API-side change. **Engineering owns.**

Next step: re-test option 2's API behavior on the current production surface (`type` field presence in `search` fieldMatches and `list_schemas` entries) before filing with engineering. Until then, option 1 is the user-facing mitigation in flight.

### Distribution

12. **Glama listing release** (`https://glama.ai/mcp/servers/talonicdev/talonic-mcp`). Build was kicked off; status unknown. Low priority.
13. **Cowork plugin submission.** Not yet done. Submission process: similar to a Cursor / Cline directory entry; needs an install snippet (already in the README), a screenshot or icon (use `Logo 400px.png`), and a short description (use the Connectors Directory tagline: "Extract validated structured data from any doc").
14. **Done:** Cursor Directory (live), Smithery (live, `https://smithery.ai/servers/talonic/talonic`), mcp.so (live), Glama listing page (live; Inspector previously failed at the Glama proxy because clients were hitting `/` instead of `/mcp` — fixed 0.1.37, see [Resolved 2026-05-18](#resolved-2026-05-18-hosted-mcp-at-root--registry-ci-chain)), Official MCP Registry (live; CI auto-publish wired 2026-05-18; catches up from 0.1.28 → latest on next workflow run).

### Resolved 2026-05-18: hosted MCP at root + Registry CI chain

Two related items shipped on 2026-05-18 to remove a directory-listing failure mode and to close the standing Registry-lag follow-up.

**Hosted MCP serves Streamable HTTP at both `/` and `/mcp`** (commit `2cf0c43`, published as 0.1.37). Previously the root path always returned a discovery JSON document, so any client that registered `https://mcp.talonic.com` (bare origin) without appending `/mcp` received metadata where it expected a JSON-RPC frame. This surfaced as a Zod validation explosion in tools like Glama's hosted MCP Inspector, which proxies through `glama.ai/endpoints/<id>/mcp` and was hitting our `/` upstream. The fix discriminates at `/` by method and `Accept`:

- `GET /` with no `Accept: text/event-stream` → still the discovery JSON (unchanged for humans, browsers, monitors, bots).
- `POST /`, `DELETE /`, or `GET /` with `Accept: text/event-stream` → falls through to the same auth + session + `StreamableHTTPServerTransport` block that serves `/mcp`.
- `/mcp` itself is unchanged; every existing client keeps working byte-for-byte.

The request handler was extracted into an exported `createRequestHandler()` factory, with the session map scoped per-call (production builds exactly one; tests spin up isolated instances against an ephemeral-port `http.Server`). `httpServer.listen` is gated behind an `isDirectInvocation()` check mirroring `server.ts` so `import`-ing the module from a test does not bind port 3000. Six new tests in `tests/http-server.test.ts` cover the regression surface (GET `/`, `/health`, unknown paths, POST `/mcp`) plus the fix (POST `/` opens a session; POST `/` without auth returns 401 + `WWW-Authenticate`).

**`mcp-publisher` chained into the publish workflow** (commit `1e87668`). Two new steps land between `Publish to npm` and `Trigger website rebuild`:

```yaml
- name: Install mcp-publisher
  run: |
    set -euo pipefail
    MCP_PUBLISHER_VERSION="1.7.9"
    TMP="$(mktemp -d)"
    curl -fsSL "https://github.com/modelcontextprotocol/registry/releases/download/v${MCP_PUBLISHER_VERSION}/mcp-publisher_linux_amd64.tar.gz" \
      | tar -xz -C "$TMP"
    sudo install "$TMP/mcp-publisher" /usr/local/bin/
    mcp-publisher --version
  continue-on-error: true

- name: Publish to MCP Registry
  run: |
    set -euo pipefail
    mcp-publisher login github-oidc
    mcp-publisher publish
  continue-on-error: true
```

Design notes:

- **OIDC, not a static token.** `id-token: write` is added to the job's `permissions` block so `mcp-publisher login github-oidc` can mint a short-lived federated token. No `MCP_REGISTRY_TOKEN` secret in the repo; nothing to rotate; the publish identity is bound to the `talonicdev/talonic-mcp` repo at the GitHub level.
- **Pinned version.** `mcp-publisher v1.7.9` (the linux_amd64 single-binary tarball from `modelcontextprotocol/registry` releases). Bump the pin deliberately when needed; this avoids surprise CLI-behavior changes mid-pipeline.
- **Direct binary install, not Homebrew.** Linuxbrew on Actions runners takes 30–60s; the tarball install is ~2s and deterministic.
- **`continue-on-error: true` on both steps.** A Registry hiccup is treated as a soft failure; the next `chore: bump` retries. The website + platform-docs rebuild steps downstream are never blocked by a Registry miss.
- **No `server.json` changes required.** The existing `Sync server.json version` step in `publish.yml` already keeps the manifest pinned to the npm version at publish time.

**Catch-up.** The wire-up commit touched only `.github/workflows/publish.yml`, which does not match the workflow's `paths:` trigger (`src/** | docs/** | package.json`). The chain therefore did not fire on its own landing commit. Verification is deferred to the first subsequent `chore: bump` (any change matching the trigger). Until then, the Registry remains at 0.1.28 while npm is at 0.1.37; either wait for the next bump to close the gap, or run `mcp-publisher publish` once locally against the current `server.json` (already 0.1.37) to close it now.

**What to verify on first CI run.**

- Workflow log shows `Successfully published` (or equivalent) from `mcp-publisher`.
- Registry search at `https://registry.modelcontextprotocol.io/v0/servers?search=io.github.talonicdev/talonic-mcp` returns the new version within a couple of minutes; the entry with `_meta.io.modelcontextprotocol.registry/official.isLatest: true` should carry the npm version.

### Resolved 2026-05-12 onwards: Claude Connectors Directory hardening

Three batches shipped to clear the Connectors Directory pre-submission checklist.

- **Origin-header allowlist** (`src/origin.ts`, commit `2365563`, published as 0.1.34). DNS-rebinding mitigation. Allows three Claude.ai variants (`https://claude.ai`, `https://claude.com`, `https://www.claude.ai`) plus four MCP-directory surfaces (Cursor Directory, Smithery, mcp.so, registry.modelcontextprotocol.io). Empty Origin passes through (native + server-to-server clients). Rejects unknown origins with a structured 403.
- **`SECURITY.md` disclosure policy** (commits `386ed0b` and `e713580`, published as 0.1.35). Reports go to `safety@talonic.ai`; two-business-day acknowledgement; 30-day fix target. Coordinated-disclosure section and safe-harbour clause included. Both `safety@talonic.ai` and `info@talonic.ai` channels listed.
- **`/favicon.ico` and `/favicon.png`** (`src/favicon.ts`, commit `87f11e3`, published as 0.1.35). Served from the hosted MCP with `Content-Type: image/png` and a 24-hour cache header. Inlined as base64 so the binary lives in the source tree (no separate asset deploy).

Submission to the Claude Connectors Directory sent 2026-05-12 via `https://clau.de/mcp-directory-submission`. Awaiting Anthropic review.

### Resolved 2026-05-08: OAuth connector flow

End-to-end OAuth 2.1 install path live for the Claude.ai connector. Both authenticated and unauthenticated user paths verified.

**API side (engineering):**

- OAuth 2.1 authorization server on `api.talonic.com` (PKCE + dynamic client registration + revocation). Migration `129-oauth-server.ts` creates the three persistence tables (`oauth_clients`, `oauth_authorization_codes`, `oauth_refresh_tokens`).
- Dual-auth guard on `/v1/`: accepts both `tlnc_` keys and OAuth JWTs through the same `PublicApiKeyGuard`, with HS256 algorithm allowlist on the OAuth path.
- Block 1 fix: `tryExtractUser` in `oauth-server.controller.ts` does soft JWT extraction from `?token=` query, `Authorization` header, or form body. Both `GET /oauth/authorize` and `POST /oauth/authorize/consent` use it. Consent POST is `@Public()` so the browser form submit works without an `Authorization` header. Token threaded as a hidden HTML form field (escaped via `escapeHtml`) so it survives the consent round-trip.
- Block 2 fix (two parts): dashboard `/login/page.tsx` reads `return_to` from `searchParams`, validates it via `isValidOAuthReturnTo` (strict origin + pathname match against `NEXT_PUBLIC_API_URL`), persists in `sessionStorage`. `/auth/callback/page.tsx` reads `oauth_return_to` after SSO completes and redirects to the API authorize endpoint with the dashboard JWT appended as `?token=`. The post-login redirect path now uses `NEXT_PUBLIC_API_URL` as the base URL (was `window.location.origin`, which sent already-authenticated users to `app.talonic.com/oauth/authorize` and 404'd; fix shipped 2026-05-08).
- `iss` and `aud` claims added to issued JWTs (both set to `resolveApiUrl()`).
- `SCOPE_TO_LEGACY` mapping documented as intentional v1 coarseness with v2 plan note.
- Production `WEB_URL=https://app.talonic.com` env var set on Railway API service (initial deploy missed this; fixed post-launch).

**MCP side (we own; shipped earlier in the cycle as PR1 + PR2 in 0.1.18 / 0.1.19):**

- `/.well-known/oauth-protected-resource` endpoint advertising `api.talonic.com` as `authorization_servers` and the three scopes the connector exercises (`extract:write`, `documents:read`, `schemas:read`).
- `WWW-Authenticate: Bearer resource_metadata="..."` header on 401 responses.
- Per-request bearer-token extraction with per-session token holder; SDK rebuilds when the token changes (handles 1-hour OAuth access-token rotation transparently).
- Forward-and-trust validation strategy at the MCP layer; the API's dual-auth guard does the actual JWT verification.

**Verified live 2026-05-08:**

- Connector install with no API key in URL → consent screen renders → SSO completes → consent submitted → Claude.ai exchanges code for OAuth token → all 8 tools available in conversation.
- Tool calls succeed: `talonic_list_schemas`, `talonic_get_balance`, `talonic_search` all return expected results.
- Authenticated-user reconnect path (the post-Block-2-second-half-fix scenario) works after the dashboard redeploy.

**Soft concerns filed for v2 (non-blocking):**

- `tryExtractUser` does not pass `algorithms: ['HS256']` to `jwtService.verify`. The `alg: none` attack is blocked by default in modern `jsonwebtoken` and we don't expose RSA public keys, so the practical risk is zero, but the inconsistency with `PublicApiKeyGuard` (which does allowlist) is worth aligning.
- `tryExtractUser` does not filter `payload.grant_type === 'oauth2'`. A stolen OAuth access token could be used to authorize new clients on the AS itself. Bounded impact (1h token, PKCE on consumer side, consent screen still confirms) but worth a one-line filter.
- `aud` claim is set to the issuer (`api.talonic.com`), not per-resource (`mcp.talonic.com`). Acceptable because we use forward-and-trust at the MCP layer; should revisit if we ever want strict audience validation per resource server.

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
- Live API tests (SDK CLI, hosted MCP, all 8 tools): run from operator's terminal with the operator's `tlnc_` API key. Sandbox is firewalled away from `api.talonic.com` and `mcp.talonic.com`, so direct runs from there are not possible.
- MCP Registry listing: fetched via the `web_fetch` tool against the registry's v0.1 servers endpoint.

Future audits should follow the same split.
