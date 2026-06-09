# ChatGPT App Directory — Submission Record

**Submitted:** 2026-06-08
**App name:** Talonic — "Extract data and talk to docs"
**Publishing entity:** Talonic GmbH (business-verified on OpenAI Platform)
**Category:** Productivity

## Endpoints
- **MCP server:** `https://mcp.talonic.com/mcp` (Streamable HTTP)
- **Auth:** OAuth 2.1 (PKCE) against `https://app.talonic.com`
- **Deployed commit at submission:** `481ec7a` (`@talonic/mcp` ≥ 0.1.58)
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

**v2 (resubmission 2026-06-09):** replaced with three single-tool,
self-contained cases that work on any authenticated account with NO
pre-existing data, verified against production:
1. `talonic_get_balance` — always returns balance/tier.
2. `talonic_save_schema` — creates an "Invoice" schema, returns it.
3. `talonic_list_schemas` — lists schemas (incl. the one from case 2; run in order).
No file upload, no URL fetch, no OCR, deterministic → consistent on web + mobile.
`request_upload` was dropped (401 on the API-key path + it's an upload flow).

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
