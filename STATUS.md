# Talonic MCP and SDK Status

**Last audit:** 2026-05-13. **Audited by:** Claude (assisting Hamlet). **Scope:** post-Claude-Connectors-submission state refresh; sync versions, follow-ups, and resolved items across `@talonic/mcp`, `@talonic/node`, website, and the official MCP Registry.

This document captures the live state of the four Talonic developer surfaces ahead of the public v1 push: `@talonic/mcp`, `@talonic/node`, the website, and the official MCP Registry. Update before each release.

## TL;DR

`@talonic/mcp` is at **0.1.35** on npm, `@talonic/node` is at **0.1.15** on npm. All 8 MCP tools and 2 resources are stable in production via both stdio and the hosted endpoint. OAuth 2.1 connector flow on Claude.ai is live and verified. The Claude Connectors Directory submission was sent on 2026-05-12 and is awaiting Anthropic review. The remaining real-work item is **pre-signed upload URLs** to route around Claude.ai's tool-call argument cap on `file_data`; everything else is either resolved or operational.

**Headline changes since the previous audit:**

1. **`talonic_get_balance` tool shipped** (0.1.25). Wraps `GET /v1/credits/balance` so agents can make budget-aware decisions. Tool count: 7 → 8.
2. **Per-call `cost` block** on `talonic_extract` and `talonic_to_markdown` responses (0.1.25). Parsed from the API's `X-Talonic-Cost-*` headers by `@talonic/node@0.1.10+`.
3. **`is_not_empty` filter operator re-exposed** (0.1.29). The upstream materialized-values index now updates within seconds of extraction.
4. **OAuth 2.1 hosted-MCP path** complete with per-request bearer extraction, `/.well-known/oauth-protected-resource`, `WWW-Authenticate` header, and token rotation (shipped 0.1.18–0.1.19; verified end-to-end on Claude.ai 2026-05-08).
5. **Compliance hardening for the Claude Connectors Directory submission** (0.1.34–0.1.35): Origin-header allowlist (DNS-rebinding mitigation), `SECURITY.md` with `safety@talonic.ai` disclosure channel and 30-day fix target, and `/favicon.ico` + `/favicon.png` served from the hosted MCP.
6. **Three QA-reported `-32602 Output validation error` failures fixed** (0.1.22–0.1.23): `description`, `mime_type`, and `fields[].id` accept `null` where the API legitimately returns it. Regression tests added.

**Older follow-ups still open:**

- **Pre-signed upload URLs.** Architectural fix for Claude.ai's tool-call argument-size cap on `file_data`. Proposal drafted (tool surface sketch, nine open design questions). Parked pending OAuth; OAuth is now done — resume the proposal pass.
- **Wire `mcp-publisher publish` into the GitHub Actions release pipeline.** The Registry currently lags npm because the chain stops after `npm publish`.
- **Cowork directory submission.** Not yet done.

**Resolved since the previous audit:**

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
| package.json version        | 0.1.35                                                                                                                                                                                                                 |
| server.json version         | 0.1.35                                                                                                                                                                                                                 |
| npm published version       | 0.1.35 (published 2026-05-12 via the auto-bump pipeline; see [Resolved 2026-05-12 onwards](#resolved-2026-05-12-onwards-claude-connectors-directory-hardening))                                                       |
| Auto-bump pipeline          | working; granular npm token with bypass-2FA in place; auto-bumps patch on every src/docs/package.json change                                                                                                          |
| Tests                       | 48 pass, 2 skipped (symlink tests skip when `dist/` is older than `package.json`; verified 2026-05-13)                                                                                                                  |
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
| package.json version  | 0.1.15                                                                                                               |
| npm published version | 0.1.15                                                                                                               |
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
| Listing URL          | `https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.talonicdev/talonic-mcp`                                                                                                                                                                                                                                 |
| Listed name          | `io.github.talonicdev/talonic-mcp`                                                                                                                                                                                                                                                                                              |
| Listed version       | 0.1.17 (last `mcp-publisher publish` was 2026-05-06; npm has since published through 0.1.35 without a Registry push, so the Registry is lagging npm by 18 patch versions)                                                                                                                                                       |
| Install instructions | npx command and `TALONIC_API_KEY` env var, both correct                                                                                                                                                                                                                                                                         |
| Standing follow-up   | wire `mcp-publisher publish` into `.github/workflows/publish.yml` so every npm publish automatically pushes to the Registry. Details under [Wire `mcp-publisher` into the release pipeline](#wire-mcp-publisher-into-the-release-pipeline). Owner: us.                                                                          |

Standing maintenance task: the auto-bump pipeline that publishes new versions to npm does not currently chain into `mcp-publisher publish`. Until that is wired in, whoever cuts a release should run `mcp-publisher publish` from the talonic-mcp repo afterwards. Without that, the Registry will continue to lag npm.

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

Lowest-cost mitigation we still have not done, ordered by leverage:

1. **Surface the API `warnings` array in `talonic_filter`'s outputSchema** (`src/tools/filter.ts`, lines 102-125). Today the MCP outputSchema does not declare `warnings`, so it is at risk of being filtered out depending on response normalisation. Adding `warnings: z.array(z.object({...})).optional()` would make the API's existing warning visible to the agent verbatim. Lowest-cost, biggest payoff. **Recommended.**
2. **Surface field type in `talonic_search` and `talonic_list_schemas` outputs** so agents can check `field.type === 'number'` before constructing a `gt`/`lt` condition. Needs upstream API to return `type` on field-registry and schema-field entries (it returns it on schema definitions today but not consistently on `search` fieldMatches). Engineering coordination required.
3. **Pre-check in the MCP filter handler.** Before forwarding to the API, look up the schema-field type for the conditions where the operator is numeric. Reject or warn if the type is string. Costs an extra API call per filter (or schema cache). Highest cost, hardest to keep correct as the schema surface evolves. **Not recommended.**
4. **Schema-creation-time warning at the API layer.** When a user types a numeric-looking field as `string` in `talonic_save_schema`, emit a warning in the response. Pure API-side change. **Engineering owns.**

Recommended next step: ship option 1 in the MCP repo (small, additive, no API dependency), then file option 2 with engineering.

### Wire `mcp-publisher` into the release pipeline

**Why.** Today `.github/workflows/publish.yml` ends after `npm publish`, so the Registry only updates when someone runs `mcp-publisher publish` by hand. The Registry is currently lagging npm by 18 patch versions (0.1.17 vs. 0.1.35). Wiring this into CI makes the Registry track npm automatically.

**Dependencies.**

- `mcp-publisher` CLI. Installable from npm as `@modelcontextprotocol/mcp-publisher` (or a single-binary release). Pin the version in the workflow to avoid surprise behavior changes.
- An auth credential the CLI can use in CI. Two options:
  - **GitHub OIDC (preferred).** The Registry supports federated identity, so a workflow running on `talonicdev/talonic-mcp` can mint a short-lived token against the Registry without a long-lived secret. This is the recommended path; no secret to rotate, and the publish is bound to a verified GitHub repo identity.
  - **`MCP_REGISTRY_TOKEN` GitHub secret.** A long-lived token stored as a repo secret. Simpler, but a secret to rotate and to keep out of logs.
- `server.json` already exists at the repo root with the correct `mcpName` (`io.github.talonicdev/talonic-mcp`) and is kept in sync with `package.json` version by the existing `Sync server.json version` step in the workflow. **No additional manifest work required.**

**Requirements / design.**

- Add a `Publish to MCP Registry` step **after** `Publish to npm` (so the Registry only sees versions that successfully landed on npm), and **before** `Trigger website rebuild` (so the website's docs sync does not race against a half-published state).
- Step should `continue-on-error: true` so a Registry hiccup does not block the rest of the post-publish chain. Treat a Registry miss as a soft failure; the next `chore: bump` will retry.
- Verify with a search against `https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.talonicdev/talonic-mcp` that the listed version matches the just-published npm version.

**Sketch.**

```yaml
- name: Publish to MCP Registry
  if: success()
  run: npx -y @modelcontextprotocol/mcp-publisher@latest publish
  env:
    MCP_REGISTRY_TOKEN: ${{ secrets.MCP_REGISTRY_TOKEN }} # if OIDC not set up
  continue-on-error: true
```

(Replace the package name with the canonical CLI distribution once confirmed; check `mcp-publisher --help` for the exact env var name and whether `--server-json server.json` needs to be passed explicitly.)

**What to verify before merging the workflow change.**

- A dry run against the Registry's staging endpoint, if one exists, or a deliberate `0.1.36` bump to confirm the chain works.
- Registry search returns the new version within a couple of minutes of `npm publish` succeeding.
- The workflow log shows `Successfully published` from `mcp-publisher`.

### Distribution

12. **Glama listing release** (`https://glama.ai/mcp/servers/talonicdev/talonic-mcp`). Build was kicked off; status unknown. Low priority.
13. **Cowork plugin submission.** Not yet done. Submission process: similar to a Cursor / Cline directory entry; needs an install snippet (already in the README), a screenshot or icon (use `Logo 400px.png`), and a short description (use the Connectors Directory tagline: "Extract validated structured data from any doc").
14. **Done:** Cursor Directory (live), Smithery (live, `https://smithery.ai/servers/talonic/talonic`), mcp.so (live), Glama listing page (live; release status pending), Official MCP Registry (live, lagging — see [Wire `mcp-publisher` into the release pipeline](#wire-mcp-publisher-into-the-release-pipeline)).

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
