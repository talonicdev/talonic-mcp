# Apps SDK Developer-Mode Testing

This is the human-only verification path before app submission. Apps SDK
developer mode requires a ChatGPT Plus/Pro/Enterprise account with developer
mode enabled — that's outside what the local test suite can cover.

## Prerequisites (human)

1. ChatGPT Plus/Pro/Enterprise subscription.
2. Developer mode enabled: ChatGPT → Settings → Apps & Connectors → enable
   "Developer mode".
3. Deployed copy of this repo running at `mcp.talonic.com` (production) OR
   a local tunnel for pre-deploy testing (`ngrok http <port>` against
   `npm run start:http`).

## Pre-deploy local check (optional, recommended)

1. `cd talonic-mcp && npm run build`
2. `TALONIC_API_KEY=tlnc_test_<your-key> npm run start:http`  (binds to a
   local port — note it).
3. In another terminal: `ngrok http <port>` (or equivalent) — note the
   HTTPS URL.
4. In ChatGPT Developer Mode: "Add MCP Server" → paste the ngrok URL
   appended with `/mcp`.
5. In a new chat, type one of the conversation starters. Verify the
   `talonic_extract` response renders as a card (not plain JSON).

## Post-deploy check (required)

1. Deploy main to `mcp.talonic.com` (Railway).
2. In ChatGPT Developer Mode: "Add MCP Server" → `https://mcp.talonic.com/mcp`.
3. Complete the OAuth flow when prompted (consent screen on app.talonic.com).
4. Run each of the test prompts in `listing-copy.md` and capture screenshots
   of the responses for the submission form.

## What to look for

- **Card renders:** `talonic_extract` results show the widget, not raw JSON.
- **No secrets in the widget:** Open the iframe in browser devtools and
  confirm the loaded HTML has no `tlnc_` strings or Authorization headers
  (the tests assert this at build time, but a visual confirmation is cheap).
- **Confidence colors:** Fields with confidence ≥0.85 are green, 0.7-0.85
  are amber, <0.7 are red.
- **Copy/Download buttons** work (copies and downloads the extracted
  `data` JSON).
- **Tool cards render:** `list_schemas`, `get_balance`, `request_upload`, and
  the other tools render their matching Talonic cards instead of raw JSON.
- **OAuth refresh:** Sessions that span more than an hour still work
  without prompting the user to re-auth.

## Common rejection causes to self-check

(From OpenAI's [submission docs](https://developers.openai.com/apps-sdk/deploy/submission).)

- [ ] Submitting from a project with **global** data residency (EU-residency
      projects cannot submit — see `listing-copy.md`).
- [ ] MCP connectivity tested outside the company network (use a VPN exit
      or a non-office connection).
- [ ] Demo account has no MFA enabled.
- [ ] Privacy policy at talonic.com/privacy is live AND mentions every
      category of data the tools return.
- [ ] Tool descriptions contain no promotional language.
- [ ] No extraneous fields beyond what each tool needs (audited at
      `src/tools/*.ts` — looks clean as of this plan).
- [ ] `TALONIC_DEBUG_TOOLS` is NOT set in the production deploy — the debug
      tools (`talonic_debug_echo`, etc.) must not be exposed to reviewers.

## Post-release card checklist (22)

Run after every deploy that changes the tool surface or widgets. Reconnect
the connector first (ChatGPT caches `tools/list` at connect time). Prompts
are taken verbatim from `chatgpt-app-submission.json` test cases; "Card must
show" is taken from `WIDGET_DESCRIPTIONS` in `src/widgets/types.ts`.

| Tool | Prompt to trigger | Card must show | ✓ |
|---|---|---|---|
| `talonic_extract` | Extract the vendor name, total amount, and invoice date from sample-invoice.pdf. | Card showing the extracted fields with per-field confidence, the source document, and the credit cost of the extraction. | [ ] |
| `talonic_request_upload` | Create a link so I can upload a new document to Talonic. | Card with the browser upload link the user must open to add their file, plus the document id and expiry. | [ ] |
| `talonic_to_markdown` | Show me the text of sample-invoice.pdf as markdown. | Scrollable view of a document's OCR-converted markdown text. | [ ] |
| `talonic_get_document` | Show the document details and status for bank-statement.pdf. | Card with one document's metadata, processing status, and triage flags. | [ ] |
| `talonic_search` | Search my Talonic workspace for insurance certificates. | Card listing the documents, fields, schemas and sources that matched the query, grouped by type. | [ ] |
| `talonic_filter` | Using Talonic, list the documents in my workspace that have an invoice number. | Table of documents whose extracted field values matched the filter, plus any API warnings about field types. | [ ] |
| `talonic_list_schemas` | List the extraction schemas saved in my Talonic workspace. | Table of the workspace's saved extraction schemas with their field counts. | [ ] |
| `talonic_save_schema` | Save a schema named "Invoice" with vendor_name (text), total_amount (number), and invoice_date (text). | Confirmation card for a newly saved reusable schema. | [ ] |
| `talonic_get_balance` | What is my Talonic credit balance and tier? | Card with the workspace credit balance, EUR value, tier, 30-day burn and projected runway. | [ ] |
| `talonic_get_pricing` | How much would it cost to extract 200 invoices, and how many credits did we use this month? | Table of Talonic's per-unit credit pricing with EUR values, free-tier badges and multipliers. | [ ] |
| `talonic_get_usage` | How much would it cost to extract 200 invoices, and how many credits did we use this month? | Breakdown of credits consumed per function over the trailing window, with proportion bars. | [ ] |
| `talonic_list_fields` | Which proven fields does my Talonic workspace know about? | Table of Field Registry concepts with data type, maturity (core, proven, candidate) and occurrence counts. | [ ] |
| `talonic_get_field` | What does the field 'Invoice No' mean in my workspace and what values does it take? | Concept card for one registry field: definition, synonyms, occurrence statistics, top values and schema usage. | [ ] |
| `talonic_field_values` | List every invoice number captured across my documents with the document it came from. | Table of one field's current values across documents with confidence and source-text provenance. | [ ] |
| `talonic_find_data` | Where in my documents is the contract end date captured? | Ranked matches for a natural-language concept across four planes: fields, values, documents and passages. | [ ] |
| `talonic_list_agent_tools` | Use the platform's query_data tool to count captured cells per field in my workspace. | Table of the platform agent tool registry with each tool's impact, capability and whether this key may invoke it. | [ ] |
| `talonic_invoke_agent_tool` | Use the platform's query_data tool to count captured cells per field in my workspace. | Result of one platform agent tool call, rendered as a table, key-value tiles or a JSON tree, with citations. | [ ] |
| `talonic_list_agent_tasks` | Are there any Talonic agent tasks waiting for me? If so, claim the first one, tell me what it needs, and submit an approval decision of 'approve' with a short note. | Worklist of Agent-stage tasks with status, document, lease expiry, timeout and execution epoch. | [ ] |
| `talonic_get_agent_task` | Are there any Talonic agent tasks waiting for me? If so, claim the first one, tell me what it needs, and submit an approval decision of 'approve' with a short note. | Card for one Agent-stage task: status, timing, instructions, declared output contract and the input snapshot. | [ ] |
| `talonic_claim_agent_task` | Are there any Talonic agent tasks waiting for me? If so, claim the first one, tell me what it needs, and submit an approval decision of 'approve' with a short note. | Lease card confirming the claim: execution epoch to keep, lease expiry, and the task's instructions and contract. | [ ] |
| `talonic_heartbeat_agent_task` | Are there any Talonic agent tasks waiting for me? If so, claim the first one, tell me what it needs, and submit an approval decision of 'approve' with a short note. | Lease card confirming the lease was extended, with the new expiry and execution epoch. | [ ] |
| `talonic_submit_agent_task` | Are there any Talonic agent tasks waiting for me? If so, claim the first one, tell me what it needs, and submit an approval decision of 'approve' with a short note. | Confirmation that the declared outputs were submitted and the parked document resumed its pipeline. | [ ] |
