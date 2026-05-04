# Talonic MCP and SDK Status

**Last audit:** 2026-05-04. **Audited by:** Claude (assisting Hamlet). **Scope:** Workstream 1 audit per the v1 launch plan.

This document captures the live state of the four Talonic developer surfaces ahead of the public v1 push: `@talonic/mcp`, `@talonic/node`, the website, and the official MCP Registry. Update before each release.

## TL;DR

All four surfaces are working. Seven MCP tools verified end-to-end against production. Hosted MCP at `mcp.talonic.com` is operational with both Bearer and apiKey query auth. The package versions, the website's package-lock, and the auto-discovery endpoints are in sync.

Three real follow-ups, none of which block launch:

1. The MCP Registry listing at `registry.modelcontextprotocol.io` is stale at v0.1.6. Needs a one-shot `mcp-publisher publish` to bring it to 0.1.12.
2. The SDK's `WithRateLimit<T>` wrapper returns sentinel zeros instead of real rate-limit headers. Either the API isn't sending `X-RateLimit-*` or the SDK transport isn't parsing them.
3. The hosted MCP root endpoint advertises `https://docs.talonic.com`, which I'm not aware of as a real subdomain. Verify and update.

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
| Listed version | **0.1.6 (stale)** |
| `_meta` | active, latest, last updated 2026-04-30 |
| Install instructions | npx command and `TALONIC_API_KEY` env var, both correct |

Action required: run `mcp-publisher publish` from the talonic-mcp repo so the registry advances from 0.1.6 to 0.1.12. The `server.json` in the repo is already at 0.1.12; it just needs to be pushed to the registry. The auto-bump pipeline does not currently chain into `mcp-publisher publish`.

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
| `talonic_list_schemas` | works | returned 6 saved schemas |
| `talonic_search` | works | returned ranked results across documents, fields, sources, schemas |
| `talonic_filter` | works | API correctly returned `VALIDATION_ERROR` on a non-existent field |
| `talonic_extract` | works | full response shape, `confidence.overall`, `confidence.fields`, `processing.region` etc. |
| `talonic_get_document` | works | returned full metadata, processing log, links |
| `talonic_to_markdown` | works | returned markdown for the document |
| `talonic_save_schema` | works | created `AUDIT_TEST_SCHEMA` (`SCH-DC88ABBB`); delete from dashboard after |

## Follow-ups (ordered by leverage)

1. **Refresh the MCP Registry listing.** One-shot `mcp-publisher publish` from `talonic-mcp/`. Long-term, wire this into the auto-bump pipeline so server.json on the registry tracks server.json in the repo.
2. **Fix the `WithRateLimit<T>` payload.** SDK currently returns `{limit:0, remaining:0, resetAt:1970-01-01}`. Verify whether `api.talonic.com` actually emits `X-RateLimit-*` response headers and confirm the SDK's transport layer is reading them.
3. **Verify or fix `docs.talonic.com`.** The hosted MCP root advertises this as the docs URL. If the subdomain doesn't exist, agents pointed at it land on a dead URL. Either set up the redirect or update the discovery payload to `https://talonic.com/docs/mcp`.
4. **Test in Claude.ai connectors.** The hosted MCP works in raw curl with both auth modes. We have not confirmed it works inside Claude.ai's "Add custom connector" flow. If Claude.ai's UI requires OAuth, this becomes a post-launch unlock with a real OAuth layer in front of `mcp.talonic.com`.
5. **Add `triage` and `mime_type` to the SDK's `Document` type.** The API returns these fields on `talonic_get_document`; the SDK passes them through but our type definitions are incomplete.
6. **Engineering API issues still open**: `is_not_empty` filter underreports (currently hidden at the MCP layer), cost/EUR/balance not surfaced in any tool response, per-field provenance (page, bbox) not surfaced. None of these block launch; all are documented honestly in the v1 surface.
7. **Glama listing release** (`https://glama.ai/mcp/servers/talonicdev/talonic-mcp`). Build was kicked off; unknown whether the release was published. Low priority per latest direction.
8. **Other directory submissions**: Smithery, Cursor, Cline, Continue, mcp.so, Cowork plugins. Workstream 2.

## Test artifact note

The `africau.edu/images/default/sample.pdf` URL used in the live extract test is now behind a captcha. Talonic correctly fetched the captcha HTML, OCR'd it, and returned a valid (if uninteresting) extraction. For future audits, use a Talonic-hosted test PDF or a stable public document. The audit-created `AUDIT_TEST_SCHEMA` (`SCH-DC88ABBB`) and the audit-created document (`756fba38-93ef-4b79-b309-8771422324f4`) can be deleted from the workspace dashboard.

## Audit method

- Sandbox-only checks (versions, repo state, tests, format, typecheck, AI-discovery validation): run from the agent sandbox.
- Live API tests (SDK CLI, hosted MCP, all 7 tools): run from operator's terminal with the operator's `tlnc_` API key. Sandbox is firewalled away from `api.talonic.com` and `mcp.talonic.com`, so direct runs from there are not possible.
- MCP Registry listing: fetched via the `web_fetch` tool against the registry's v0.1 servers endpoint.

Future audits should follow the same split.
