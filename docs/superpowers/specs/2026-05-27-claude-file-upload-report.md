# Talonic + Claude: Document Upload Blocker — Findings & Plan

**Date:** 2026-05-27 · **Audience:** internal (API, web, MCP) · **Status:** investigation closed, ready to plan
**Backing detail:** `talonic-mcp/docs/superpowers/specs/2026-05-20-presigned-upload-urls-design.md`

## TL;DR

A user dragging a document into Claude.ai and asking Talonic to extract it **fails today** for any real-sized file. We proved why with live instrumentation: Claude.ai caps tool-call arguments (~32 KB) *and* blocks the sandbox from uploading files out to the internet. Neither wall is something we can configure away, and the same structural limits apply to other hosted AI agents. The fix is a **browser-handoff upload**: Talonic hands the user a short link, they drop the file in their own browser, and the agent continues. It reuses three patterns already in our codebase.

## The desired path

1. User opens Claude.ai, drags in a document, says "extract this with Talonic, apply the invoice schema."
2. Claude delivers the document to the Talonic API.
3. Talonic extracts and returns structured data.
4. Claude completes the rest of the prompt.

Step 2 is where it breaks.

## Why it doesn't work today (measured, not assumed)

We deployed three debug tools to the production MCP server and ran controlled tests in real Claude.ai chats.

| Wall | What we measured | Implication |
|---|---|---|
| **Tool-call argument cap** | A 250 KB PDF passed as base64 `file_data` arrived at our server truncated to **43,000 chars (~32 KB decoded)**. A 14.7 KB file came through intact. The cut is silent and cleanly base64-padded — the agent never knows it was truncated. | Files above ~32 KB can't be passed through the MCP tool call. Real invoices/contracts/scans are typically 100 KB–several MB. |
| **Sandbox egress allowlist** | The agent *can* read the full file in its sandbox, but `curl PUT` to S3 returned **HTTP 403 "Host not in allowlist"**. `*.amazonaws.com` (and, by the same rule, `*.talonic.com`) is not an allowed outbound domain. | The agent can't upload the file out-of-band either — not to S3, not to our own API. |

Both walls confirmed against `mcp.talonic.com` on 2026-05-27. The long-standing "~1 KB cap" note in our docs was wrong by ~30×, but the conclusion is unchanged: **there is no path for a hosted Claude.ai agent to deliver a real file to us.** Today's only workarounds are `file_url` (user already has a public URL) or `document_id` (file already uploaded via the dashboard) — both push the work back onto the user.

## Why this won't work with other agents either

This is **not a Claude quirk we can wait out.** Tool-call size caps and sandbox egress allowlists are standard, deliberate properties of any hosted/sandboxed agent platform (the same shape applies to ChatGPT connectors/actions, Gemini extensions, etc.). Any hosted agent that (a) routes tool calls through a managed pipe and (b) sandboxes code execution will hit the same two walls. The exception is **local installs** (Claude Desktop, Cursor, Cline via `npx @talonic/mcp`) which have no cap and already work via `file_data` — but that is not the hosted-connector experience most users get. We need a platform-agnostic solution we own.

## Recommended solution: browser-handoff upload

Move the file transfer off the agent's constrained channel and onto the **user's own browser**, which has no tool-call cap and no egress allowlist.

```
1. Agent calls a new MCP tool  talonic_request_upload(filename)
       → returns { upload_url: "app.talonic.com/u/<token>", document_id, expires_at }
2. Agent shows upload_url to the user.
3. User opens it, drops the file. Browser uploads directly to Talonic (existing dashboard upload path).
4. Agent polls talonic_get_document(document_id) until status = ready.
5. Agent calls talonic_extract(document_id, schema) — the path that already works today.
```

Cost to the user: one click. That is the price of routing around platform limits we don't control — and it's the same pattern users already accept from Slack/Stripe/Linear "open in browser" links.

## How it's implemented (grounded in the current codebase)

The investigation found this fits existing patterns, so it is mostly *assembly*, not new infrastructure.

**1. API — `platform/packages/api`** (load-bearing)
- New `POST /v1/documents/upload-session`: allocates a `document_id` and a short-lived token, creates the document row in a new `pending_upload` status. Document IDs are *already* allocated before bytes arrive (`extraction.service.ts:2357`), and the `documents.status` enum already has an unused `pending` default — so this is an additive change, not a redesign.
- New public `POST /u/:token` (file-receive): accepts the multipart upload, stores via the existing **file-manager** service (already abstracts volume/S3/Azure — no new storage infra), flips status to `uploaded`/`queued`. Reuse the `@Public()` token-auth pattern from `data-products/share.controller.ts`.
- Expired-session GC.

**2. Web — `platform/packages/web`** (medium)
- New page `app/u/[token]/page.tsx`, cloned from the existing `app/share/[token]/page.tsx` public-token page.
- Reuse the existing `UploadDropzone` component and `api.upload()` flow.
- Add `/u` to `AuthGuard.PUBLIC_PATHS` so it renders without login (token is the credential).

**3. MCP — `talonic-mcp`** (small)
- New tool `talonic_request_upload` that calls the upload-session endpoint and returns the link + `document_id`.
- Tool-description updates steering hosted-connector agents to this flow (and away from `file_data`) for files over ~32 KB.
- Reuse the existing `talonic_get_document` tool for status polling. No new polling tool needed.

## Dependencies & open decisions

**Ownership / sequencing**
- **API team** owns the two new endpoints + `pending_upload` status + GC. **This is the critical-path dependency** — both web and MCP block on the endpoint contract.
- **Web team** owns the `/u/[token]` page (low risk — clones `/share/[token]`).
- **MCP** owns the new tool + descriptions; blocked only on the API contract.

**Decisions to confirm**
- Token TTL — suggest **15 min**.
- Upload size cap — reuse the existing **500 MB** extract limit.
- Upload-page auth — **token-only** (no login), matching `/share`, for frictionless UX. The token is a single-use capability. (Alternative: require login — more secure, more friction. Recommend token-only.)
- Whether to also surface the link for non-Claude clients (it's harmless everywhere; local installs will keep using `file_data`).

**Housekeeping (separate track)**
- Debug instrumentation (`TALONIC_DEBUG_TOOLS`, the S3 test bucket, the shared IAM key) is still live in production. Tear down after the design is signed off: revert the instrumentation commit, unset Railway env vars, rotate the IAM key, delete the test bucket. Details in the backing spec.

## Bottom line

The blocker is real, measured, and structural — not fixable by configuration or by waiting for Anthropic. Browser-handoff is the only path that works inside hosted agents, it is platform-agnostic, and it reuses document pre-allocation, the share-token route, and the existing upload UI we already run. The load-bearing work is two API endpoints; everything else is assembly.
