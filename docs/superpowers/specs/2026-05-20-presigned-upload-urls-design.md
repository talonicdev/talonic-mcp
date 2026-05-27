# Pre-signed Upload URLs — Investigation & Design (WIP)

**Status:** investigation in progress. Spec NOT finalised. Resume here.
**Started:** 2026-05-20
**Owner:** Hamlet (with Claude assist)
**Tracked in:** `STATUS.md` → "Pre-signed upload URLs" follow-up

---

## How to resume this work in a future session

1. Read this file end-to-end.
2. Read `STATUS.md` → §Follow-ups → entry titled "Pre-signed upload URLs".
3. Read the three debug-tool source files (still live in this repo behind `TALONIC_DEBUG_TOOLS=1`):
   - `src/tools/debug-echo.ts`
   - `src/tools/debug-upload-url.ts`
   - `src/http-server.ts` (the per-request header dump, env-gated)
4. The single open empirical question is **Scenario 4** below. Run it, capture the result, then write the final spec under `docs/superpowers/specs/`.
5. After the spec is approved, run cleanup (see "Cleanup checklist" at the bottom).

---

## Problem statement (one paragraph)

When `@talonic/mcp` is added as a hosted connector inside Claude.ai's web UI, dragging a real document into the chat and calling `talonic_extract` with `file_data` returns a stub document with `null` extracted fields. The agent misdiagnoses this as a server bug. The original 2026-05-06 diagnosis attributed this to a "~1 KB tool-call argument size cap" on Claude.ai's side. The 2026-05-20 measurement burst (below) revises this: **the real cap is ~32 KB of decoded payload (~43 KB of base64 string), not ~1 KB**, and it sits in the connector pipeline, not the MCP server. The cap silently truncates `file_data` to a clean, properly-padded base64 prefix — agents never see the truncation, only the empty result. Files under ~32 KB pass through intact; real invoices/contracts (typically 100 KB+) do not.

## What changed since the original diagnosis

The original "~1 KB" number in `STATUS.md` was a self-report from Claude in a 2026-05-06 chat that said "the file_data parameter only received the first 502 bytes of the file." That was Claude reasoning about what it had passed, not a server-side measurement. With the debug instrumentation in place, we now have authoritative server-side numbers. The cap is real but ~30× larger than documented.

## Empirical results (2026-05-20)

Instrumentation (env-gated by `TALONIC_DEBUG_TOOLS=1`, set in Railway):
- `talonic_debug_echo` — server-side echo of received tool-call arg bytes, base64 validity, SHA-256.
- `talonic_debug_request_upload_url` — mints an S3 presigned PUT URL.
- `talonic_debug_check_upload` — HEAD the resulting object.
- Per-request header dump in `http-server.ts`.

Test bucket: `talonic-hamlet-test-bucket` (`eu-central-1`, AWS S3). CORS + 1-day lifecycle confirmed by Hamlet.

### Scenario 1 — Baseline truncation reproduction

- **File**: `Tool-Factory/tool-factory/samples/receipts/receipt.pdf` (14,700 bytes).
- **Sandbox tool used by Claude**: Bash, `base64 -w 0 /mnt/user-data/uploads/receipt.pdf`.
- **Server received**: `raw_string_byte_length: 19,600`, `decoded_byte_length: 14,700`, `base64_valid: true`, `sha256_of_decoded: a09176df41…`.
- **Outcome**: full file arrived intact. The original "~1 KB cap" claim is disproved at the smallest realistic file size.

### Scenario 2 (200 KB) — First evidence of truncation

- **File**: `Tool-Factory/tool-factory/samples/contracts/dmb-wohnungsmietvertrag_engl.pdf` (250,595 bytes).
- **Sandbox tool used by Claude**: a Python "Script" (exact code not visible in trace).
- **Server received**: `raw_string_byte_length: 168`, `decoded_byte_length: 125`, `base64_valid: true`, `sha256_of_decoded: 63957d72…`.
- **Local verification**: `head -c 125 dmb-wohnungsmietvertrag_engl.pdf | shasum -a 256` produces exactly `63957d72…`. Claude sent the literal first 125 bytes of the file.
- **Outcome**: confirmed truncation, but the mechanism was still ambiguous — was Claude pre-truncating in Python, or was the wire capping?

### Scenario 2-diagnostic — Disambiguation (the conclusive run)

Same 250,595-byte PDF, Bash-only flow forced via explicit prompt instructing Claude to measure file size, base64 size, and then capture the full base64 into a Bash variable before calling `talonic_debug_echo`.

- **Step A** (`wc -c`): 250,595 bytes — sandbox sees the full file.
- **Step B** (`base64 | wc -c`): 334,128 chars — the sandbox can produce the full base64 string.
- **Step D** (server): `byte_lengths.file_data: 43,000`, `decoded_byte_length: 32,250`.
- **Outcome**: the cap is not in Claude's tools, not in our MCP server. **The Claude.ai hosted-connector pipeline silently truncates tool-call arguments at ~43,000 base64 chars (~32 KB decoded payload).** The truncation is clean — the resulting base64 is well-formed and properly padded, which is exactly why agents never realise the file was truncated.
- **Side observation**: this round-trip took ~40 minutes wall-clock. Even if Anthropic lifted the cap, pushing a few hundred KB of base64 through chat is a bad UX — Claude has to hold the string in its context, reason about it, and serialise it.

### Plumbing pre-check (2026-05-27, run from Claude Code on the Mac — NOT the Claude.ai sandbox)

Before running Scenario 4 in Claude.ai, the S3 round-trip was verified from a local Bash environment that has open egress, to confirm the instrumentation itself works:

- `talonic_debug_request_upload_url` → minted a valid presigned PUT URL + `object_key`.
- `curl -X PUT --data-binary @dmb-wohnungsmietvertrag_engl.pdf '<url>'` → **HTTP 200**.
- `talonic_debug_check_upload` → `found: true`, `size_bytes: 250595` (full file), `content_type: application/pdf`.
- **Conclusion**: bucket, IAM key, CORS, presigning, and check tool all work. A failure in the real Scenario 4 (run inside Claude.ai) is therefore attributable to Claude.ai sandbox egress, not the plumbing.
- **Caveat**: the presigned URL carries AWS SDK v3 checksum query params (`x-amz-checksum-crc32`, `x-amz-sdk-checksum-algorithm=CRC32`). Local curl tolerated them (HTTP 200). A different HTTP client could behave differently, but an egress block produces a connection/DNS error that is unmistakably distinct from a checksum error.

### Scenario 4 — UNRESOLVED. Direct PUT empirical disproof.

Not yet run **inside Claude.ai** (the only environment whose egress we actually care about). Needs a fresh Claude.ai chat with the 250 KB PDF dropped at the start.

**Prompt to use:**

> I dropped a PDF at `/mnt/user-data/uploads/dmb-wohnungsmietvertrag_engl.pdf`.
>
> Step 1: in Bash, run `wc -c` to confirm the file size.
>
> Step 2: call `talonic_debug_request_upload_url` with `filename: dmb-wohnungsmietvertrag_engl.pdf` and `content_type: application/pdf`. Quote me back the `upload_url` and `object_key`.
>
> Step 3: in Bash, attempt to PUT the file to that `upload_url`:
> ```
> curl -X PUT -H 'Content-Type: application/pdf' --data-binary @/mnt/user-data/uploads/dmb-wohnungsmietvertrag_engl.pdf '<upload_url>'
> ```
> Capture the HTTP status code, response headers, and any error verbatim.
>
> Step 4: call `talonic_debug_check_upload` with the `object_key` from Step 2. Quote me back `found`, `size_bytes`, `content_type`.
>
> Step 5: summarise — did the file land in S3 at full size?

**Why it still matters:** an earlier Claude self-report indicated the sandbox has a network allowlist that probably excludes arbitrary S3 endpoints. If true, the only viable architectural fix is browser-handoff. If false (S3 PUT works), direct-from-sandbox PUT becomes a viable additional path that doesn't require a user click.

**Pass criteria for "no, browser-handoff required":** Step 3 fails with a DNS / egress / TLS error and Step 4 reports `found: false`.

**Surprise outcome:** Step 3 returns HTTP 200 and Step 4 reports `size_bytes: 250595` — direct PUT works, and the design pivots to canonical presigned URLs.

**RESULT (2026-05-27, run inside Claude.ai hosted connector):**

- File confirmed in sandbox at `/mnt/user-data/uploads/dmb-wohnungsmietvertrag_engl.pdf`, 250,595 bytes.
- Step 1: presigned URL minted successfully.
- Step 2: `curl -X PUT` → **HTTP 403, response body `Host not in allowlist`.** The sandbox egress proxy blocked the request; `*.amazonaws.com` is not an allowed outbound domain. Zero bytes transferred.
- Step 3: `talonic_debug_check_upload` → `found: false`, `size_bytes: null`, `content_type: null`.
- **Verdict: the pass criteria for "browser-handoff required" are met.** Claude.ai's sandbox cannot PUT to arbitrary domains. Direct-PUT (Approach B) and the direct-PUT branch of the hybrid (Approach C) are both dead for the Claude.ai hosted connector. **Approach A (browser-handoff) is the design.**

## DECISION (2026-05-27): Approach A — browser-handoff

All empirical questions are now answered. The investigation phase is closed. The design is **browser-handoff**, for evidence-backed reasons:

- `file_data` truncates at ~32 KB → can't pass real files through the tool call.
- The sandbox can't reach S3 or any non-allowlisted domain → can't upload out-of-band from inside Claude.ai.
- The only channel that escapes Claude.ai's constraints is the **user's own browser**, which has no egress allowlist and no tool-call cap.

The remaining work is implementation, split across the MCP server (small) and the Talonic platform/API (load-bearing). See the implementation plan (to be written under `docs/superpowers/plans/`).

## Conclusion so far

The pre-signed upload URLs project is **still necessary**. The cap is real and at a ceiling far below realistic document sizes. The only open question is which fix shape best matches the constraints — and that hinges on Scenario 4's result.

## Two candidate fix shapes (decision pending Scenario 4)

### A) Browser-handoff upload page (recommended if Scenario 4 fails)

- New MCP tool `talonic_request_upload` returns `{ upload_url, document_id, expires_at, upload_code }`.
- `upload_url` is a short-lived URL on `app.talonic.com/u/<token>` (or `upload.talonic.com/<token>`).
- Agent shows the URL to the user. User opens it in a browser, drags the file in.
- Browser uploads directly to Talonic storage (reuses existing `app.talonic.com` upload code).
- Agent polls `talonic_get_document` until status flips from `pending_upload` → `ready`, then calls `talonic_extract` with the pre-allocated `document_id`.
- Works inside Claude.ai's hosted connector with no agent-side network capability beyond MCP tool calls.
- Cost: one user click.

### B) Canonical presigned PUT URL (only viable if Scenario 4 succeeds)

- New MCP tool `talonic_request_upload_url` returns `{ upload_url (presigned S3/GCS PUT), document_id, expires_at }`.
- Agent uploads bytes directly from the sandbox via curl.
- Talonic backend's S3 webhook on upload completion finalises the document.
- Zero user clicks. Cleaner architecture.

### C) Hybrid (best case)

Ship both: the MCP tool returns both `upload_url` (browser page) and `direct_put_url` (presigned PUT). Agent attempts direct PUT first; if it fails (egress block, status != 200), falls back to showing the browser URL to the user. Works for everyone, optimal for clients that can PUT.

## Answers to the 9 prior open design questions (working draft, all under Approach A; revise after Scenario 4)

| # | Question | Working answer |
|---|---|---|
| 1 | Storage backend | Reuse the existing `app.talonic.com` upload path. No new infra. |
| 2 | document_id pre-allocation | Yes — returned on request. API creates a placeholder with `status: pending_upload`. |
| 3 | Expiry | 15 min default, max 1 hour. Past expiry → 404 and GC the placeholder. |
| 4 | Size cap | 500 MB to match `/v1/extract`. Shown on the upload page. |
| 5 | Cost model | Handoff is free. Charge as today at extract time. No new metering. |
| 6 | Deprecation of `file_data` | None. Keep as recommended path for local-stdio. New tool is the Claude.ai-specific fallback. |
| 7 | Retry semantics | Browser-side retry on the upload page. Agent retries the whole flow if expired. |
| 8 | Multipart vs single-part | Single-part (browser form upload). Revisit only if size cap >> 500 MB. |
| 9 | Signing-key rotation | N/A — token is an opaque DB session id, not an external signature. |

## Operational state as of 2026-05-20 17:00 UTC

| Item | State |
|---|---|
| Debug instrumentation deployed to Railway | YES (commit `3f7fb98` + unblock empty commit `5bc273e`) |
| npm version on the Registry | 0.1.45 (publish chain blocked by docs-drift on `3f7fb98`; will heal on next docs/ or src/ commit with proper docs or `[skip docs]`) |
| Railway env vars set | YES — `TALONIC_DEBUG_TOOLS=1`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` |
| S3 test bucket | `talonic-hamlet-test-bucket` (`eu-central-1`), CORS + 1-day lifecycle on |
| AWS IAM key | Live. Hamlet shared the access key + secret in chat 2026-05-20. Treat as burnable; rotate at cleanup. |
| Claude.ai connector | Reconnected once at 2026-05-20 ~16:30 UTC to refresh tool list. Debug tools visible in chat as `talonic_debug_*`. |
| Spec | This file. Status: WIP, pending Scenario 4. |

## Cleanup checklist (run AFTER Scenario 4 + spec are done)

1. Revert commit `3f7fb98` (the instrumentation). Single revert commit removes:
   - `src/tools/debug-echo.ts`
   - `src/tools/debug-upload-url.ts`
   - The three `register…` calls in `src/server-factory.ts`
   - The header dump block in `src/http-server.ts`
   - The 8 new tests in `tests/tools/tools.test.ts`
   - `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` from `package.json` / `package-lock.json`
2. Push to `main`. This change touches `src/**` and `package.json` so it will trigger publish. Include `[skip docs]` in the commit message (the revert doesn't introduce documentable surface). Publish bumps the npm patch + redeploys Railway clean.
3. In Railway: unset `TALONIC_DEBUG_TOOLS`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
4. In AWS IAM: rotate (delete) the access key for the bucket-scoped user; delete the user; delete the bucket.
5. Update `STATUS.md` → swap the "Pre-signed upload URLs" entry from "investigation" to "spec ready" or "shipped" depending on outcome.
6. Move this file to its final name without the `-design` suffix, or rename to `…-spec.md` once the design is settled.

## Quick-find anchors

- The cap value: **~32 KB decoded payload / ~43,000 base64 chars** on Claude.ai's hosted-connector tool-call pipeline (measured 2026-05-20).
- The instrumentation commit: `3f7fb98` on `main` of `talonicdev/talonic-mcp`.
- The test PDF used for the load measurement: `Talonic/Tool-Factory/tool-factory/samples/contracts/dmb-wohnungsmietvertrag_engl.pdf` (250,595 bytes).
- The Scenario 4 prompt: copy-paste from §Scenario 4 above into a fresh Claude.ai chat.
