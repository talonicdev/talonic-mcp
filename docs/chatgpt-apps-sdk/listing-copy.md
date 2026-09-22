# ChatGPT App Listing — Talonic

This file is the source of truth for the OpenAI Platform Dashboard submission
form. Copy fields directly into the dashboard.

## Identity

- **Publishing name:** Talonic GmbH (business verification required)
- **App name:** Talonic
- **Tagline (≤80 chars):** Schema-validated extraction from any document
- **Category (primary / secondary):** Productivity / Developer Tools

## Long description

Talonic turns any document — PDFs, scans, contracts, invoices, certificates,
forms — into clean, schema-validated JSON. Define the fields you want, point
Talonic at the document (URL or one already in your workspace), and get back
structured data with per-field confidence scores and document metadata.

Built for workflows that need reliable JSON, not free text. Every extraction
is validated against your schema, every field comes with a confidence score,
and every extraction is auditable via a stable extraction ID.

## Conversation starters

- "Extract vendor, total, and due date from this invoice URL"
- "What schemas do I have saved in my Talonic workspace?"
- "Show me my Talonic credit balance"
- "Re-extract document doc_abc123 with my Contract schema"

## Tool list (22)

**Extraction & documents**

1. `talonic_extract` — structured data extraction with schema validation (widget-enabled)
2. `talonic_request_upload` — browser-handoff upload: returns a link the user opens to drop a file (for hosted clients past the tool-arg size cap), plus a document_id to poll (widget-enabled)
3. `talonic_to_markdown` — OCR-converted markdown for a document (ingests the file if not already in the workspace) (widget-enabled)
4. `talonic_get_document` — fetch document metadata and processing status (widget-enabled)
5. `talonic_search` — search documents, fields, sources and schemas by content (widget-enabled)
6. `talonic_filter` — filter documents by extracted field values (widget-enabled)

**Schemas**

7. `talonic_list_schemas` — list saved schemas in the workspace (widget-enabled)
8. `talonic_save_schema` — save a schema for reuse (widget-enabled)

**Metering**

9. `talonic_get_balance` — workspace credit balance, tier, burn rate and projected runway (widget-enabled)
10. `talonic_get_pricing` — per-unit credit pricing catalog for estimating cost before running work (widget-enabled)
11. `talonic_get_usage` — credits consumed per function over a trailing window (widget-enabled)

**Field Registry**

12. `talonic_list_fields` — list Field Registry concepts with maturity, data type and synonyms (widget-enabled)
13. `talonic_get_field` — one concept's definition, synonyms, occurrence stats and example values (widget-enabled)
14. `talonic_field_values` — one concept's captured values across documents, with source provenance (widget-enabled)
15. `talonic_find_data` — locate the fields, values, documents and passages behind a concept (widget-enabled)

**Platform agent tools**

16. `talonic_list_agent_tools` — catalog of platform agent tools this credential may invoke (widget-enabled)
17. `talonic_invoke_agent_tool` — run one read-only platform agent tool with caller-supplied arguments (widget-enabled)

**Agent tasks**

18. `talonic_list_agent_tasks` — worklist of Agent-stage tasks visible to this workspace credential (widget-enabled)
19. `talonic_get_agent_task` — one task's immutable input snapshot, instructions and output contract (widget-enabled)
20. `talonic_claim_agent_task` — take a time-limited lease on an available task (widget-enabled)
21. `talonic_heartbeat_agent_task` — extend the lease on a task this agent already claimed (widget-enabled)
22. `talonic_submit_agent_task` — submit declared outputs for a claimed task and resume the parked document (widget-enabled)

## MCP server

- **URL:** `https://mcp.talonic.com/mcp`
- **Transport:** Streamable HTTP
- **Auth:** OAuth 2.1 (PKCE) against `https://app.talonic.com`
- **API-key fallback:** Bearer `tlnc_*` keys accepted but OAuth is the
  recommended path; the App Directory submission uses the OAuth flow.

## Test prompts (for OpenAI reviewers)

Each prompt should produce a reproducible result. Provide a demo workspace
account (see Demo Account section).

1. **Extract from URL**
   - Prompt: "Extract vendor_name, total_amount, and invoice_date from
     <PUBLIC_URL_TO_SAMPLE_INVOICE>"
     (ChatGPT cannot send a local file to the hosted MCP; the document must
     be a publicly fetchable URL or already in the workspace by document_id.)
   - Expected: Card widget renders with the requested fields, an overall
     confidence bar (~0.85 on the sample invoice), per-field confidence
     bars, and document metadata (filename + page count). Note:
     `type_detected` / `language_detected` may come back null and are simply
     omitted from the card — that is expected, not a failure.
     Verified against production 2026-06-01: data = {vendor_name "Acme
     Corporation", invoice_number "INV-2026-0472", total_amount 21428.75,
     invoice_date "2026-03-15"}, overall confidence 0.85.

2. **List schemas**
   - Prompt: "List the schemas in my Talonic workspace"
   - Expected: Plain JSON list including at least one demo schema named
     "Invoice".

3. **Get balance**
   - Prompt: "What's my Talonic credit balance?"
   - Expected: JSON with `balance_credits` and a non-zero number.

## Demo account

A demo workspace must be created on app.talonic.com before submission:

- Email: `chatgpt-review@talonic.ai` (or equivalent — pick one and document)
- Password: stored in 1Password / vault, included in submission form
- No MFA enabled (submission requirement)
- At least 100 credits pre-loaded
- At least one saved schema named "Invoice"
- At least one extracted document so search/filter tests have data

## Privacy policy and ToS

- Privacy policy: https://talonic.com/privacy  (must be live)
- Terms of service: https://talonic.com/terms  (must be live)
- Support contact: support@talonic.com

The privacy policy must explicitly disclose:
- That ChatGPT may send document URLs and schemas to Talonic for processing.
- That extraction results are stored in the user's Talonic workspace.
- Data retention policy (workspace lifetime / configurable).
- Data deletion procedure.

## Screenshots

Need 3-5 high-resolution screenshots (1600x1000 recommended) showing:

1. ChatGPT thread: user asks to extract from an invoice URL → widget card
   renders with fields, confidence bars, and metadata.
2. ChatGPT thread: list-schemas response (plain JSON, demonstrates non-widget
   tools also work).
3. ChatGPT thread: get-balance response showing the credit balance.
4. ChatGPT thread: re-extract via document_id with a different schema.
5. (Optional) ChatGPT thread: confidence visualization on a noisy scan.

Screenshots must be captured against the production MCP server, with the
widget rendering exactly as it ships.

## Logo

- Source: `Talonic/talonic-logo.png` (existing repo asset).
- Required: square PNG, transparent or white background.
- Dimensions: OpenAI's exact required dimensions are not published; aim for
  1024x1024 at submission time and resize if rejected.

## Pre-submission gotcha: project data residency

OpenAI does not currently accept App Directory submissions from API platform
projects configured with **EU data residency**. This is an OpenAI Platform
project setting, NOT about Talonic being a German company. Before submitting,
confirm the project you submit from uses **global** data residency (default).
If the project shows "Europe" as its region, create a fresh global-residency
project for the submission.
