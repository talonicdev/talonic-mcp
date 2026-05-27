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
- **Plain JSON for other tools:** `list_schemas`, `get_balance`, etc. render
  as plain JSON — that's intentional for v1.
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
