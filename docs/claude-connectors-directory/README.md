# Claude Connectors Directory — submission collateral

Sibling of `../chatgpt-apps-sdk/` (the ChatGPT App Directory record). This folder holds what Anthropic's submission portal asks for, pre-filled from the live server, so a resubmission is a copy-paste exercise.

- `resubmission-2026-09.md` — every portal step with our answers (portal: https://claude.ai/admin-settings/directory/submissions/new — Team/Enterprise Owner only).
- `escalation-email.md` — the note to `mcp-review@anthropic.com` about the stranded 2026-05-12 legacy-form submission (slug `pending-talonic`).

## Before doing anything else

- [ ] Release 0.1.79 is live (`curl -s https://mcp.talonic.com/health` shows the version). As of 2026-09-22 the live version is still 0.1.78 (local `main` is 50 commits ahead, unpublished); publish first so the portal's automatic scan sees all 36 tools, then work through `resubmission-2026-09.md`.
- [ ] Test workspace seeded: sample documents; a saved schema named "Invoice"; a published Spec named "Invoice" (so `resubmission-2026-09.md` §9's Spec prompts read naturally); at least one **PARKED** Agent-stage task (an Agent stage waiting on an external claimant) and at least one **AVAILABLE** decision task (an External-mode app run parked for decision) — otherwise 9 of the 36 test prompts in §9 (the Agent-task and decision-task groups) return empty results.

## Current server surface (2026-09-22, binding over any older count in this folder)

36 public tools — 22 read-only, 14 write-capable, none destructive — plus two resources. Source of truth: `tests/widgets/tool-annotations.test.ts` (`READ_ONLY_TOOLS` / `WRITE_TOOLS`), cross-checked against the live server via `createServer()`'s `_registeredTools`.

Process facts (from claude.com/docs/connectors, fetched 2026-09-22): a submitted server is scanned automatically and listed as a **Community** connector by default; **Verified** review is escalated automatically for highly useful servers. Status and reviewer feedback live in the submissions dashboard (https://claude.ai/admin-settings/directory/submissions); the URL slug is permanent once published. Update this folder whenever the tool surface, listing text, docs URL or privacy URL changes; the tool list itself syncs from the live server at submission time.
