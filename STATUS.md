# Talonic MCP and SDK Status

**Last audit:** 2026-05-04. **Audited by:** Claude (assisting Hamlet). **Scope:** Workstream 1 audit per the v1 launch plan.

This document captures the live state of the four Talonic developer surfaces ahead of the public v1 push: `@talonic/mcp`, `@talonic/node`, the website, and the official MCP Registry. Update before each release.

## TL;DR

All four developer surfaces are working at the plumbing level: hosted MCP at `mcp.talonic.com` is live and reachable from Claude.ai's custom-connector UI; all 7 tools are exposed and respond; versions are in sync across npm, server.json, registry, website. The package-pipeline-and-distribution layer is solid for v1.

The Claude.ai connector test surfaced three new API-side bugs that materially degrade what agents can actually do with the tools. None block launch on the deployment side; all degrade real-world usefulness:

1. **`talonic_list_schemas`** silently truncates `data[]`: pagination reports `total: 7` with `has_more: false`, but `data[]` returns 2. Five schemas are missing.
2. **`talonic_filter`** is effectively unusable for natural agent flows. Three sub-issues: schema-defined field names with `documentCount: 0` are rejected as unresolvable; `fieldMatches[].resolvedFieldId` returns document UUIDs instead of field UUIDs; valid pipeline-field UUIDs with known matches return zero results without error.
3. **`talonic_search`** doesn't tokenize on word boundaries. `"test invoice"` (space) returns zero matches against `test_invoice.pdf` while `"invoice"` alone finds it. Multi-word natural-language queries silently fail.

Two earlier follow-ups also remain open:

4. SDK's `WithRateLimit<T>` wrapper returns sentinel zeros (`{limit:0, remaining:0, resetAt:1970-01-01}`) instead of real `X-RateLimit-*` header values.
5. Hosted MCP root endpoint advertises `https://docs.talonic.com`, which may not be a real subdomain.

Two earlier follow-ups have been resolved during the audit:

- Registry stale at 0.1.6: now lists 0.1.12 with `isLatest: true` (resolved during audit).
- `/.well-known/mcp.json` missing `talonic://webhooks/reference`: added in commit `455889d` (resolved during audit).

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

All 7 MCP tools, called through the hosted endpoint with a real `tlnc_` key:

| Tool | Result | Notes |
|---|---|---|
| `talonic_list_schemas` | plumbing works, **API bug** | call succeeds; pagination reports `total: 7` but `data[]` returns 2 silently |
| `talonic_search` | plumbing works, **API bug** | call succeeds; word-boundary tokenization missing (space-separated multi-word queries fail) |
| `talonic_filter` | plumbing works, **API bug (3x)** | call succeeds and rejects unknown fields cleanly; discoverability broken in three ways (see below) |
| `talonic_extract` | works | full response shape, `confidence.overall`, `confidence.fields`, `processing.region` etc. |
| `talonic_get_document` | works | returned full metadata, processing log, links |
| `talonic_to_markdown` | works | returned markdown for the document |
| `talonic_save_schema` | works | created `AUDIT_TEST_SCHEMA` (`SCH-DC88ABBB`); delete from dashboard after |

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

- Users naturally type spaces, not underscores. Canonical names use underscores. The space-vs-underscore mismatch silently breaks searches.
- Users do not know UUIDs. Tutorials, install docs, and tool descriptions should never present "type a UUID" as the primary user input. Agents should resolve user-spoken filenames or document references to UUIDs internally.
- Claude consistently behaved well throughout: chose the right tool, made the right call, did not hallucinate field names or invented document IDs, and asked for help when the API returned empty or rejected. The MCP server's tool descriptions and the agent decision guide produced the desired agent behavior. The failures captured in Tests 1 to 3 are all on the API side; the MCP layer correctly passed inputs through and returned what the API returned.

## Follow-ups (ordered by leverage)

### API-side (engineering owns; high impact on real agent usefulness)

1. **`talonic_list_schemas` silent truncation.** Returns `data[]` shorter than `pagination.total` claims, with `has_more: false`. Reproduces in SDK CLI and hosted MCP. Bug report sent to engineering. Workaround: agents should not promise users a complete count; route them to the dashboard if they need certainty.
2. **`talonic_filter` discoverability triple bug.** (a) Schema-defined fields with `documentCount: 0` aren't in the registry and are rejected; (b) `fieldMatches[].resolvedFieldId` returns document UUIDs in place of field UUIDs; (c) valid pipeline field UUIDs with known matches return zero results without error. Bug report sent to engineering. Possible mitigations include a new `/v1/fields` discovery endpoint that returns only registry-resolved fields with `documentCount > 0`.
3. **`talonic_search` word-boundary tokenization.** Multi-word natural-language queries fail to match underscore-named records. `_`, `-`, and space should be equivalent for matching. Bug report sent to engineering.
4. **`is_not_empty` filter operator (existing).** Underreports against fields known to be populated. Currently hidden at the MCP layer. Engineering team has not yet shipped a fix.
5. **Cost / EUR / balance and per-field provenance (existing).** Not surfaced in any tool response. Documented honestly in v1; nothing blocks launch but agents cannot reason about budget or trace per-field source coordinates.

### MCP / SDK / docs (we own; lower impact, easy to ship in 0.1.13)

6. **Update tool descriptions and known-limitations for the three new bugs.** Specifically: `talonic_list_schemas`, `talonic_filter`, `talonic_search` need KNOWN LIMITATION blocks. `content/sections/troubleshooting.ts` needs the three new entries. **Deferred:** batch with end-of-audit changes into one 0.1.13 release.
7. **`WithRateLimit<T>` returns sentinel zeros.** SDK currently returns `{limit:0, remaining:0, resetAt:1970-01-01}`. Either the API isn't emitting `X-RateLimit-*` or the SDK transport isn't parsing them. Verify and fix.
8. **`docs.talonic.com` discovery URL.** The hosted MCP root advertises this URL. Confirm whether the subdomain resolves; if not, change the discovery payload to `https://talonic.com/docs/mcp`.
9. **Add `triage` and `mime_type` to the SDK's `Document` type.** API returns them; SDK type doesn't declare them.

### Operational / pipeline

10. **Wire `mcp-publisher publish` into the release pipeline** so the MCP Registry tracks the latest npm version automatically. Manual run currently needed after each `chore: bump` commit.

### Distribution (Workstream 2 territory)

11. **Glama listing release** (`https://glama.ai/mcp/servers/talonicdev/talonic-mcp`). Build was kicked off; status unknown. Low priority.
12. **Other directory submissions**: Smithery, Cursor, Cline, Continue, mcp.so, Cowork plugins.

## Test artifact note

The `africau.edu/images/default/sample.pdf` URL used in the live extract test is now behind a captcha. Talonic correctly fetched the captcha HTML, OCR'd it, and returned a valid (if uninteresting) extraction. For future audits, use a Talonic-hosted test PDF or a stable public document. The audit-created `AUDIT_TEST_SCHEMA` (`SCH-DC88ABBB`) and the audit-created document (`756fba38-93ef-4b79-b309-8771422324f4`) can be deleted from the workspace dashboard.

## Audit method

- Sandbox-only checks (versions, repo state, tests, format, typecheck, AI-discovery validation): run from the agent sandbox.
- Live API tests (SDK CLI, hosted MCP, all 7 tools): run from operator's terminal with the operator's `tlnc_` API key. Sandbox is firewalled away from `api.talonic.com` and `mcp.talonic.com`, so direct runs from there are not possible.
- MCP Registry listing: fetched via the `web_fetch` tool against the registry's v0.1 servers endpoint.

Future audits should follow the same split.
