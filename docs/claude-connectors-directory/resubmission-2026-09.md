# Claude Connectors Directory — resubmission package (2026-09)

Prepared 2026-09-22 against `@talonic/mcp` **0.1.79** — local `main` at commit `4f27996`, 50 commits ahead of `origin/main`. `origin/main` (and the live server) is currently 0.1.78 (verified: `curl -s https://mcp.talonic.com/health` → `{"status":"ok","server":"talonic","version":"0.1.78"}`, `npm view @talonic/mcp version` → `0.1.78`). **Publish before submitting**, so the portal's automatic scan reads all 36 tools, not 29. Portal: https://claude.ai/admin-settings/directory/submissions/new. Pre-submission checklist: https://claude.com/docs/connectors/building/review-criteria.

## 0. Before you open the portal

- [ ] Release 0.1.79 is live (`curl -s https://mcp.talonic.com/health` shows the version).
- [ ] `npm run preflight:chatgpt` and `npm run smoke:live` green on that build.
- [ ] Test account: a Talonic workspace with a populated corpus (the workspace already contains sample documents — at least a couple of dozen processed documents, at least one published Spec, and a saved schema named "Invoice") and an API key — Anthropic requires "a fully populated account". `[Hamlet fills in: which workspace/account this is, and its OAuth sign-in details or API key]`. Credentials go in step 9's portal field, never in this repo.
- [ ] Icon: `Logo 400px.png` (square PNG; Hamlet has it — path outside this repo).

## 1. Connection

- Server URL: `https://mcp.talonic.com/mcp` (Streamable HTTP; the root `/` also serves MCP).
- Transport: Streamable HTTP.
- How users reach the server: **Universal URL** (one URL for everyone).

## 2. Tools (auto-synced from the server; recorded here for reviewers)

**36 public tools**, every one with `title`, `readOnlyHint`, `destructiveHint`, and `openWorldHint` (Anthropic's portal groups by these). **None destructive.** `openWorldHint` is `true` only for `talonic_extract`, `talonic_to_markdown`, and `talonic_run_spec` — the three tools that can fetch a user-supplied public file URL (`file_url` / `file_urls`); every other tool stays inside the connected workspace. Verified 2026-09-22 against `tests/widgets/tool-annotations.test.ts` (`READ_ONLY_TOOLS` = 22, `WRITE_TOOLS` = 14) and the live server's registered-tool annotations.

**Read-only (22):**

- `talonic_search` — find documents, fields, schemas or sources in the workspace; one call returns ranked results across all types.
- `talonic_filter` — find documents by their extracted field values using composable conditions (e.g. "invoices where total > 1000").
- `talonic_get_document` — fetch one document's metadata and processing status.
- `talonic_list_schemas` — list the workspace's saved schemas as compact summaries.
- `talonic_get_balance` — read the workspace's credit balance, tier, 30-day burn, and projected runway.
- `talonic_get_pricing` — read Talonic's machine-readable credit pricing catalog so cost can be predicted before running anything.
- `talonic_get_usage` — read the workspace's per-function credit consumption over a trailing window.
- `talonic_list_fields` — list the workspace's Field Registry, the canonical concepts Talonic has discovered across every ingested document.
- `talonic_get_field` — get one Field Registry concept's definition, synonyms, occurrence stats, and value distribution.
- `talonic_field_values` — read one concept's current values across documents, with provenance (document, source text, confidence).
- `talonic_find_data` — resolve a natural-language concept to the registry fields, values, documents, and text passages that carry it.
- `talonic_list_agent_tools` — list the platform's agent tool registry and which tools this credential may invoke.
- `talonic_invoke_agent_tool` — invoke one named platform agent tool directly; for this credential type the platform restricts it to read-only `data.read` tools server-side (e.g. `query_data`, a read-only SQL SELECT over extracted data).
- `talonic_list_agent_tasks` — list Agent-stage tasks visible to this workspace credential.
- `talonic_get_agent_task` — fetch one Agent-stage task's immutable input snapshot, instructions, and declared output contract (an audited read).
- `talonic_list_specs` — list the workspace's configured Specs (pipelines).
- `talonic_get_spec` — get one Spec's structure: the authored rail, the compiled execution phases, and its fields.
- `talonic_get_run` — poll a Spec run's normalised status plus document- and phase-level progress.
- `talonic_get_run_results` — read a Spec run's structured rows, one per document, plus column definitions.
- `talonic_get_answer` — poll a `talonic_ask` call that was still processing when the wait ended.
- `talonic_list_decision_tasks` — list one External-mode Talonic App's decision-task inbox (runs parked for an outside agent to decide).
- `talonic_read_decision_package` — read one page of a claimed decision task's frozen input package, with provenance locators.

**Write-capable (14), none destructive:**

- `talonic_extract` — turn any document (PDF, scan, image, DOCX, photo) into structured, schema-validated JSON with per-field confidence scores.
- `talonic_to_markdown` — get a document's OCR-converted markdown; ingests the document first when given a raw file rather than an existing `document_id`.
- `talonic_save_schema` — save a reusable schema to the workspace for future extractions.
- `talonic_request_upload` — pre-allocate a document and return a browser upload link the user opens to add a file too large for a hosted tool-call payload.
- `talonic_claim_agent_task` — claim an available Agent-stage task, or reclaim it after its lease expires.
- `talonic_heartbeat_agent_task` — extend the lease on a claimed Agent-stage task.
- `talonic_submit_agent_task` — submit declared output fields for a claimed Agent-stage task and resume the parked document.
- `talonic_run_spec` — run a Spec (the workspace's configured pipeline) over documents already in the workspace or public file URLs.
- `talonic_ask` — ask a natural-language question over the workspace's documents and get a cited, verified answer.
- `talonic_claim_decision_task` — claim (or reclaim, after lease expiry) an available decision task and receive its decision bundle.
- `talonic_heartbeat_decision_task` — extend the lease on a claimed decision task, never past its SLA deadline.
- `talonic_submit_decision_task` — submit the decision for a claimed decision task; the platform verifies it transactionally and resumes the run.
- `talonic_release_decision_task` — release a claimed decision task back to `available` without deciding it.
- `talonic_fail_decision_task` — report a claimed decision task as undecidable; raises a Human Review and applies the app's declared fallback policy.

The seven decision-task tools are for **External-mode Talonic Apps** and require the `apps:decide` OAuth scope (or, for API-key installs, a per-app `decide` grant on the key). A connector session without that scope sees them marked non-invocable rather than failing silently; the agent is told to reconnect. Internal `talonic_growth_*` / `talonic_admin_*` tools are probe-gated and will not appear for the test account.

## 3. Listing

- Server name (≤ 100): **Talonic**
- Tagline (≤ 55): **Extract validated structured data from any document** (50 chars)
- Description (≤ 2000):

  Talonic turns any document — PDFs, scans, photos, invoices, contracts, certificates, statements, forms — into clean, schema-validated JSON, instead of the raw OCR-plus-guesswork that makes tables, dates, and totals drift. Through this connector, Claude can: extract structured fields from a document already in the workspace or from a public file URL, with per-field confidence scores and source provenance on every value; route files too large for a hosted tool-call payload through a one-time browser upload link the user opens themselves; convert a document to clean OCR markdown; search and filter the workspace by document content or by extracted field values; browse the Field Registry, the canonical set of concepts Talonic has discovered across a workspace's documents, each with a definition, synonyms, and a value distribution; define and save reusable extraction schemas; run the workspace's own configured Spec pipelines over a batch of documents and read back structured rows; and ask natural-language questions over a workspace's documents, getting back a cited, verified answer grounded in source spans. A separate set of tools lets an outside agent participate in a Talonic App's decision points — claim a parked run, read its frozen input package with full provenance, then submit, release, or fail the decision — gated behind the `apps:decide` OAuth scope so it only activates for authorized workspace roles. A free tier is available, no credit card required. The server is hosted at `mcp.talonic.com` and authenticates via OAuth 2.1 with PKCE and dynamic client registration, so no API key ever touches the connector configuration. Full documentation is at `talonic.com/docs/mcp`.

- Categories (1–5): Productivity; Developer Tools; Data & Analytics (choose the portal's closest labels).
- Documentation URL: `https://talonic.com/docs/mcp`
- Privacy policy URL: `https://talonic.com/privacy` (verified live 2026-09-22: `curl -s -o /dev/null -w '%{http_code}' https://talonic.com/privacy` → `200`)
- Support contact: `info@talonic.ai`
- Icon: `Logo 400px.png`
- URL slug: `talonic` (permanent once published; the legacy submission holds `pending-talonic` — if the portal refuses `talonic`, use `talonic-mcp` and note it here).

## 4. Use cases

1. Turn a PDF, scan, or photo into schema-validated JSON (with confidence and source provenance) in the chat, or via the browser upload link for files over the hosted size cap.
2. Work the workspace: search and filter documents by extracted values, read field values across documents with provenance, explore the Field Registry.
3. Run the workspace's own configured pipeline (Spec) over documents and ask cited questions across the corpus.
4. Decide on parked runs for the workspace's own Talonic Apps: claim an available decision task, read its frozen input package with source provenance, then submit, release, or fail the decision — gated by the `apps:decide` scope.

- Prerequisites: a Talonic account (free tier available) — users authenticate with OAuth in Claude, or paste an API key for local installs.
- Reads and writes data: **both** (writes = extraction runs, saved schemas, Spec runs, agent-task leases/submissions, decision-task leases/decisions).

## 5. Company

Talonic — https://talonic.com — primary contact pre-filled from the account (Hamlet Hayrapetyan, Head of Product).

## 6. Authentication

OAuth 2.1 — the answers below are copied verbatim from `STATUS.md` ("Form inputs as submitted", 2026-05-12):

- Authentication type: **OAuth 2.0** (implementation is OAuth 2.1 with PKCE, a strict superset).
- Auth Client: **Dynamic OAuth Client** (RFC 7591 DCR).
- Static Client ID/Secret: blank (N/A for dynamic).
- Transport Support: **Streamable HTTP** only (SSE not implemented).

Confirmed still live 2026-09-22: `curl -s https://mcp.talonic.com/.well-known/oauth-protected-resource` →
`{"resource":"https://mcp.talonic.com","authorization_servers":["https://api.talonic.com"],"scopes_supported":["extract:write","documents:read","schemas:read","apps:decide"],"bearer_methods_supported":["header"]}`.
One change since the 2026-05-12 submission: the scope list now also advertises `apps:decide` (added for the seven decision-task tools) alongside the original `extract:write`, `documents:read`, `schemas:read`. No per-tool on-demand auth.

## 7. Data handling

- Underlying API: **our own** (api.talonic.com).
- Personal health data: no (customers may upload documents of their choosing; Talonic does not target PHI).
- Sponsored content: no.

## 8. Allowed link URIs

- `https://app.talonic.com` (the `talonic_request_upload` browser-handoff page and `app_url` citations)
- `https://talonic.com` (docs links)

## 9. Test & launch

- Test account instructions text (for the reviewer):

  1. Sign in via **Add custom connector** in Claude.ai and connect with OAuth using the provided credentials — no API key needed for the hosted connector. `[Hamlet fills in: the actual test-account sign-in credentials / workspace name]`.
  2. The workspace already contains sample documents, at least one saved schema named "Invoice", and at least one configured Spec, so every tool below returns real data without any setup.
  3. Suggested prompts, one per tool (36 total), grouped to match the tool families above:

     **Extraction & documents**
     - `talonic_search` — "Search my Talonic workspace for invoice documents."
     - `talonic_filter` — "List the documents in my workspace that have an invoice number."
     - `talonic_get_document` — "Show the document details and processing status for the sample invoice in my workspace."
     - `talonic_extract` — "Extract the vendor name, total amount, and invoice date from the sample invoice in my workspace."
     - `talonic_to_markdown` — "Show me the text of the sample invoice as markdown."
     - `talonic_request_upload` — "I want to add a new file to my Talonic workspace — give me an upload link."

     **Schemas**
     - `talonic_list_schemas` — "What schemas do I have saved in my Talonic workspace?"
     - `talonic_save_schema` — "Save a new schema called 'Receipt Test' with fields vendor_name (string) and total (number)."

     **Metering**
     - `talonic_get_balance` — "What's my Talonic credit balance?"
     - `talonic_get_pricing` — "What does Talonic charge per page for extraction?"
     - `talonic_get_usage` — "Break down my Talonic credit usage over the last 30 days."

     **Field Registry**
     - `talonic_list_fields` — "What fields has Talonic discovered across my documents?"
     - `talonic_get_field` — "Tell me about the invoice_number field in my workspace's Field Registry."
     - `talonic_field_values` — "Show me every value captured for invoice_number, with sources."
     - `talonic_find_data` — "Where does my workspace track payment due dates?"

     **Platform agent tools**
     - `talonic_list_agent_tools` — "What agent tools does my Talonic workspace expose?"
     - `talonic_invoke_agent_tool` — "Run the describe_data agent tool on my workspace."

     **Agent tasks**
     - `talonic_list_agent_tasks` — "List the Agent-stage tasks visible to this credential."
     - `talonic_get_agent_task` — "Show me the details of the first available Agent-stage task."
     - `talonic_claim_agent_task` — "Claim the first available Agent-stage task."
     - `talonic_heartbeat_agent_task` — "Extend the lease on the Agent-stage task I just claimed."
     - `talonic_submit_agent_task` — "Submit the declared outputs for the Agent-stage task I claimed." (reviewer supplies sample values matching the task's contract)

     **Specs & pipelines**
     - `talonic_list_specs` — "What Specs are configured in my Talonic workspace?"
     - `talonic_get_spec` — "Show me the structure of my Invoice Spec."
     - `talonic_run_spec` — "Run my Invoice Spec over the documents already in my workspace."
     - `talonic_get_run` — "Check the status of the Spec run I just started."
     - `talonic_get_run_results` — "Show me the results of that Spec run as a table."

     **Ask**
     - `talonic_ask` — "What's the total across all invoices in my workspace, and where does that number come from?"
     - `talonic_get_answer` — "Check whether my last question has finished processing."

     **Decision tasks** (External-mode Apps; requires an OAuth session with the `apps:decide` scope, or an API key with a per-app `decide` grant)
     - `talonic_list_decision_tasks` — "List the decision tasks waiting on my Talonic App."
     - `talonic_claim_decision_task` — "Claim the next available decision task for my Talonic App."
     - `talonic_read_decision_package` — "Show me the input package for the decision task I just claimed."
     - `talonic_heartbeat_decision_task` — "Extend the lease on the decision task I'm working on."
     - `talonic_submit_decision_task` — "Submit my decision for the claimed task: outcome, evidence, and rationale." (reviewer supplies values matching the task's output contract)
     - `talonic_release_decision_task` — "Release the decision task I claimed back to available — I can't decide it right now."
     - `talonic_fail_decision_task` — "Mark the decision task I claimed as undecidable and explain why."

- Credentials: entered in the portal only, never in this repo.
- Confirmation that every tool was exercised: `[Hamlet fills in: MCP Inspector pass — date + who ran it]`; `[Hamlet fills in: Claude.ai custom-connector test — date]`.

## 10. Compliance (seven acknowledgements)

Directory guidelines; first-party API; no financial transactions; no AI media generation; no prompt-injection patterns in tool descriptions; no conversation-data collection beyond the tool call; public documentation exists. All true — tick all seven.

Re-verified 2026-09-22 across all 36 live tool descriptions (`createServer()._registeredTools`, grepped for `always call`, `you must`, `override`, `claude must`, `ignore previous/prior`, `system prompt`, `disregard`): one incidental match, `talonic_get_field`'s `USE WHEN: you must decide whether a field is the right concept...` — a usage-guidance clause describing when the *caller's task* needs this tool, not an instruction aimed at overriding model behavior. No actual prompt-injection pattern found. Our descriptions describe the tool and redirect to sibling tools only.

## 11. After submitting

Track at https://claude.ai/admin-settings/directory/submissions. Expect a Community listing after the automated scan; Verified review is Anthropic's call. Do not resubmit while pending. Escalations: `mcp-review@anthropic.com` (see `escalation-email.md` for the note about the stranded 2026-05-12 legacy submission).
