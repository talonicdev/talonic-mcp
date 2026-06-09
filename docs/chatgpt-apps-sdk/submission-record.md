# ChatGPT App Directory — Submission Record

**Submitted:** 2026-06-08
**App name:** Talonic — "Extract data and talk to docs"
**Publishing entity:** Talonic GmbH (business-verified on OpenAI Platform)
**Category:** Productivity

## Endpoints
- **MCP server:** `https://mcp.talonic.com/mcp` (Streamable HTTP, **stateless**)
- **Auth:** OAuth 2.1 (PKCE) against `https://app.talonic.com`
- **Deployed commit at v1 submission:** `481ec7a` (`@talonic/mcp` 0.1.58)
- **Deployed for v2 resubmission:** `@talonic/mcp` 0.1.64 (stateless transport +
  get_document null-scalar fix + rewritten tool descriptions — see "Post-v1 fixes").
- **Domain-verification challenge:** served at `/.well-known/openai-apps-challenge`
  via env `OPENAI_APPS_CHALLENGE_TOKEN` (default in `http-server.ts`). OpenAI
  **rotates** this token — if re-verification is ever requested, update the env
  var / default to the value shown in the form and redeploy.

## Tools (9) — annotations as submitted
| Tool | readOnly | openWorld | destructive |
|---|---|---|---|
| talonic_extract | false | **true** | false |
| talonic_to_markdown | false | **true** | false |
| talonic_search | true | false | false |
| talonic_filter | true | false | false |
| talonic_get_document | true | false | false |
| talonic_list_schemas | true | false | false |
| talonic_get_balance | true | false | false |
| talonic_save_schema | false | false | false |
| talonic_request_upload | false | false | false |

`openWorldHint` is true only for the two tools that fetch a user-supplied public
`file_url` (extract, to_markdown); all others are workspace-scoped. Per-tool
justifications are in `chatgpt-app-submission.json`.

## Screenshots (4, Card type, 706px wide, 400–860px tall)
Generated from the live widgets via `scripts/gen-screenshots.mjs` +
`scripts/capture-screenshots.mjs` → `screenshots/png/`. Order + example messages:
1. `extract.png` — "Extract the vendor, invoice number, total, and date from my sample-invoice.pdf"
2. `schema-list.png` — "What extraction schemas do I have saved in Talonic?"
3. `filter.png` — "Find my invoices over $1,000 and show their totals and currency"
4. `balance.png` — "What's my Talonic credit balance and projected runway?"

## Test cases (in `chatgpt-app-submission.json`)

**v1 (rejected 2026-06-08):** by-name extract / get_document / to_markdown /
filter / search / request_upload. Failed review — "one or more test cases did
not produce correct results." Root cause: they referenced pre-existing
documents/data that did not exist on the reviewer's (fresh) account, plus
file/URL/OCR fragility.

**v2 (resubmission 2026-06-09):** one simple case per tool (9 total), run
against the populated reviewer account, kept as single-line prompts. By-name
cases resolve via `talonic_search` first. `request_upload` is back in — it works
over OAuth; the earlier failure was the dead stateful session, not the tool.
1. `talonic_extract` — extract fields from `sample-invoice.pdf` (by name).
2. `talonic_to_markdown` — markdown of `sample-invoice.pdf` (by name).
3. `talonic_get_document` — status of `bank-statement.pdf` (by name).
4. `talonic_search` — "insurance certificates".
5. `talonic_filter` — invoices with total over 100 (needs pre-extracted numeric totals — verify in the reviewer account).
6. `talonic_list_schemas` — list saved schemas.
7. `talonic_save_schema` — save an "Invoice" schema.
8. `talonic_get_balance` — credits + tier.
9. `talonic_request_upload` — get an upload link.
Each must be re-run + confirmed in the reviewer account on web AND mobile before
resubmitting (the rejection demanded consistency on both). Watch #5 (may return
empty if no invoices are extracted there) and #1/#2 (confirm sample-invoice.pdf
is text-extractable).

## Reviewer access / demo account — OPEN ITEM
The submission form had **no field for demo credentials**. The app is OAuth-gated,
so a reviewer either self-registers (Talonic free tier) or uses a supplied demo
account. **The test cases reference specific pre-existing documents/schemas**, so
a fresh empty account would fail them. Resolution needed:
- Demo account: `chatgpt-review@talonic.ai` (no MFA), pre-populated with the
  referenced files + schemas. **Credentials stored in the team vault (1Password),
  not in this repo.**
- Deliver credentials via the Testing-step reviewer-instructions field if one
  exists, or via the post-submission review email (reply with the Case ID).

## Post-v1 fixes (root-cause work after the 2026-06-08 rejection)

The v1 rejection ("one or more test cases did not produce correct results") and
follow-on testing surfaced four issues — all fixed and live (0.1.64):

1. **OAuth `api_key_id` crash (platform, `1aa5f2b4`).** `/v1/extract` and
   `/v1/process` wrote the synthetic `oauth:<client_id>` into a uuid FK column →
   500 on every OAuth-token extract. Fixed in the platform repo (NULL for OAuth).
2. **Stateless MCP transport (`@talonic/mcp` 0.1.62).** The hosted server ran
   stateful in-memory sessions; every redeploy/restart wiped them, so connectors
   (ChatGPT) 404'd and reported tools as "not executable." Now stateless — fresh
   server per request, no session to lose. Survives restarts/redeploys/scaling.
3. **`talonic_get_document` null scalars (0.1.63).** A freshly-uploaded doc
   returns `size_bytes`/`pages`/`filename` null until OCR; the output schema
   rejected null → `-32602` mid-poll, stalling the upload flow. Made nullable.
4. **Tool descriptions + server instructions rewritten (0.1.64).** Tightened all
   9 descriptions to a uniform template and made the server instructions assert
   tools are live/callable and that filenames resolve via `talonic_search` first
   — to stop hedging ("isn't exposed") and enable confident by-name chaining.

**Operational note:** after any deploy, the connector must be **reconnected** in
the client (ChatGPT caches `tools/list` at connect time). The stateless transport
means an unexpected restart no longer breaks an already-connected session, but a
*new* tool surface (e.g. these description changes) still needs a reconnect to be
seen.

## Known risk carried into review
**OCR fallback is disabled in production** (platform commit `94b01b89`,
"disable Talonic OCR fallback and re-OCR for demo speed"). Image-only / scanned
PDFs return HTTP 422 "No document text available." Text-layer PDFs work. The
flagship extract test case was switched from a public-URL document to a
by-name workspace document to avoid this on the reviewer's path, but a reviewer
testing extract with their **own scanned document** can still hit it. Durable
fix = re-enable the fallback (`packages/api/config/pipeline.yaml`) in the
platform repo.

## Post-submission
- Review: ~30–120 days; status via dashboard + email.
- Only one version may be in review at a time — do not resubmit while pending.
- Rejections: reply to the rejection email with the Case ID.
