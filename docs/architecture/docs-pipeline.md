# Docs Pipeline — Architecture and Maintenance Map

**Audience:** anyone (human or agent) about to change MCP-tool documentation, add a new MCP tool, or debug why `talonic.com/docs/mcp/*` is stale.

**One-sentence summary:** this repo carries *two parallel docs surfaces* that feed *different parts* of `talonic.com/docs/*`; if you update the wrong one, your change will silently never appear on the user-visible page.

---

## The two surfaces

| Surface in `talonic-mcp` | Built into | Consumed by | Feeds these pages |
|---|---|---|---|
| **`src/content/sections/*.ts`** (typed TS modules) | `dist/content.js` via `tsup`, exported as `@talonic/mcp/content` subpath | the **website** (`@/app/docs/mcp/McpContentPage` calls `getMcpSection(slug)`) | **`talonic.com/docs/mcp/*`** — all MCP docs pages |
| **`docs/sections.json`** (hand-edited JSON) | shipped as-is; pulled at build time by the **platform** repo's `sync-external-docs.yml` workflow | the **`@talonic/docs`** npm package (published from the platform monorepo) | `talonic.com/docs/sdk/*`, `talonic.com/docs/api/*`, `talonic.com/docs/platform/*` — **NOT** `/docs/mcp/*` |

**Critical implication:** if you edit `docs/sections.json` thinking you are updating the MCP docs page, **nothing on `talonic.com/docs/mcp` will change** — that file feeds the SDK / API / Platform doc pages on the website, not MCP. To update MCP docs you must edit `src/content/sections/*.ts`.

(This split caused weeks of silent drift in May 2026; the fix that finally surfaced the gap is documented in this repo's git history under commit `eac4dd6 docs(content): close MCP-docs gap on talonic.com`.)

## End-to-end pipeline (MCP path)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ talonic-mcp (this repo)                                                 │
│                                                                          │
│   src/content/sections/*.ts                                              │
│         │ tsup build                                                     │
│         ▼                                                                │
│   dist/content.js  ←  @talonic/mcp/content (npm subpath export)          │
└─────────────────────────────────────────────────────────────────────────┘
                       │
                       │ git push to main triggers publish.yml
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ .github/workflows/publish.yml                                            │
│                                                                          │
│   1. Docs-drift guard (fails if src/tools changed without docs)          │
│   2. Auto-bump → npm publish → mcp-publisher publish → GitHub Release    │
│   3. Trigger website rebuild (repository_dispatch: mcp-updated)          │
└─────────────────────────────────────────────────────────────────────────┘
                       │
                       │ repository_dispatch lands on website repo
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ talonicdev/website                                                       │
│                                                                          │
│   .github/workflows/update-docs.yml runs:                                 │
│     npm update @talonic/mcp @talonic/node @talonic/docs                   │
│     git commit + push (chore: update @talonic/mcp to X.Y.Z)              │
│                                                                          │
│   Vercel picks up the lockfile commit → rebuilds Next.js app             │
│                                                                          │
│   At build time: src/app/docs/mcp/tools/*/page.tsx renders               │
│     <McpContentPage slug="talonic-extract" />                            │
│     which calls getMcpSection() from @talonic/mcp/content                │
│     (now at the just-published version)                                   │
└─────────────────────────────────────────────────────────────────────────┘
                       │
                       ▼
            talonic.com/docs/mcp/tools/extract  (etc.)
```

The other surface (`docs/sections.json`) has its own pipeline through the **platform** repo's `sync-external-docs.yml` → `publish-docs.yml` → `@talonic/docs` → website's `update-docs.yml`. That flow updates SDK/API/Platform docs only.

## "Add a new MCP tool" — four-file checklist

Adding a new tool surface (like `talonic_request_upload`, added in 0.1.46) requires changes in **both repos**. Missing any of the four files below produces a *specific, named* breakage — see the failure-mode table below.

### In `talonic-mcp`

1. **`src/content/sections/tools.ts`** — add the new section. Mirror the shape of an existing tool: `slug`, `parentSlug: "tools"`, `title`, `seoTitle`, `description`, `content[]`, `related[]`, `faq[]`, `mentions[]`.
2. **`src/content/seo.ts`** — add `{ id: "<slug>", label: "<tool_name>" }` to the `tools` entry of `MCP_NAV_SECTIONS`. Without this, breadcrumb + prev/next derivation in `helpers.ts` returns null/empty.

### In `talonicdev/website`

3. **`src/app/docs/mcp/tools/<short-name>/page.tsx`** — new 16-line file mirroring `filter/page.tsx`. The slug passed to `<McpContentPage slug="..." />` must match the section slug in `talonic-mcp/src/content/sections/tools.ts`.
4. **Three sibling registries**, all of which must include the new tool:
   - `src/lib/docs-sync.ts` → add to `MCP_PAGE_MAP` (drives `mcpPageMeta()` title + breadcrumbs).
   - `src/app/docs/layout.tsx` → add to the slug → URL map (drives the sidebar's active-state highlighting).
   - `next.config.ts` → add `/docs/mcp/<full-slug>` → `/docs/mcp/tools/<short>` redirect (because `McpContentPage` generates `related` URLs as `/docs/mcp/${slug}`, not `/docs/mcp/tools/<short>`).

That's the full list. After both pushes land, Vercel rebuilds and the new tool page is live.

## Failure-mode table

| Symptom | Likely cause | File to fix |
|---|---|---|
| `/docs/mcp/tools/<short>` returns 404 | Missing `page.tsx` route | Create `src/app/docs/mcp/tools/<short>/page.tsx` (website) |
| Page renders but content is empty | Page exists, but `getMcpSection(slug)` returned null | Section missing from `src/content/sections/tools.ts` (mcp), OR slug typo |
| `/docs/mcp/talonic-<slug>` 404s | Missing redirect | Add to `next.config.ts` (website) |
| Sidebar doesn't highlight the active tool | Missing slug → URL map entry | Add to `src/app/docs/layout.tsx` (website) |
| Wrong title / wrong breadcrumbs | Missing `MCP_PAGE_MAP` entry | Add to `src/lib/docs-sync.ts` (website) |
| Sidebar doesn't list the tool at all | Missing `MCP_NAV_SECTIONS` entry | Add to `src/content/seo.ts` (mcp) and republish |
| Edits to `docs/sections.json` don't appear on `/docs/mcp/*` | **You edited the wrong file.** | Edit `src/content/sections/*.ts` instead (mcp) |
| `Docs-drift guard` fails on push | Tool source changed without docs/sections.json | Either update `docs/sections.json` too, or add `[skip docs]` to a commit message in the push |
| Publish chain runs but `talonic.com/docs/mcp/*` still stale | Vercel cache OR website rebuild didn't fire | Check `gh run list --repo talonicdev/website --workflow=update-docs.yml`; manually fire `gh workflow run publish.yml -r main` from talonic-mcp |
| `sync-external-docs.yml` 403 on checkout | `PLATFORM_SYNC_TOKEN` secret missing or under-scoped | Re-issue PAT with `Contents: read/write` on `talonicdev/platform`; update the secret |

## CI tokens (purposes, scopes, where they live)

| Secret | Lives in | Used for | Required scope |
|---|---|---|---|
| `NPM_TOKEN` | talonic-mcp, talonic-node | `npm publish` | Granular npm automation token with **2FA bypass enabled**; `read/write` on `@talonic` org |
| `WEBSITE_DISPATCH_TOKEN` | talonic-mcp, talonic-node | Fires `repository_dispatch` events to website + platform | PAT with `repo` (classic) or `metadata:write + contents:write` on website + platform (fine-grained) |
| `PLATFORM_SYNC_TOKEN` | platform | `actions/checkout@v4` in `sync-external-docs.yml` so committed-by-PAT identity triggers downstream `publish-docs.yml` (GITHUB_TOKEN commits do NOT trigger downstream workflows by GitHub's anti-recursion policy) | Fine-grained PAT, **`Contents: read/write` on `talonicdev/platform` only** |
| GitHub OIDC | talonic-mcp | `mcp-publisher login github-oidc` for the MCP Registry publish | Workflow declares `id-token: write` |
| `GITHUB_TOKEN` (auto) | every workflow | Default per-run token | Permissions limited to what `permissions:` block in the workflow declares, **capped by org-level "Workflow permissions" setting** |

When something authenticated breaks, check (in order): (1) the secret value (did it expire?), (2) its scope (does it cover the target repo + permission?), (3) the workflow's `permissions:` block, (4) the org-level workflow permissions ceiling.

## The docs-drift CI guard

`publish.yml` has a `Docs-drift guard` step (in both `talonic-mcp` and `talonic-node`) that fails the publish run if any of:

- `src/tools/**` (mcp) or `src/resources/**`, `src/client.ts`, `src/index.ts`, `src/types.ts`, `src/errors.ts` (node)
- `src/http-server.ts` or `src/server-factory.ts` (mcp)

…changed in the push, but `docs/sections.json` did not. **Opt out** with `[skip docs]` in any commit message in the push, used only for genuinely-non-doc-affecting changes (refactors, internal-only fixes, CI infrastructure, debug instrumentation).

⚠️ **The guard watches `docs/sections.json`, which feeds the SDK/API/Platform docs surface — *not* the MCP docs surface.** It is an existing safety net for that surface, retained because it has caught real drift there. It does **NOT** enforce that `src/content/sections/*.ts` was updated when MCP tools change. That second guard could be added in the future but does not exist today — for MCP tools, discipline + this doc are the only enforcement.

## File pointers (quick reference)

**`talonic-mcp`:**

- `src/content/sections/*.ts` — MCP doc content modules. **Edit these to change `talonic.com/docs/mcp/*`.**
- `src/content/seo.ts` → `MCP_NAV_SECTIONS` — sidebar/nav structure.
- `src/content/index.ts` — registry that combines the modules, plus `getMcpSection()`/`getAllMcpSections()` exports.
- `src/content/helpers.ts` — breadcrumb + prev/next derivation.
- `docs/sections.json` — feeds the *other* surface (SDK/API/Platform).
- `.github/workflows/publish.yml` — auto-bump + publish chain; includes the docs-drift guard.

**`talonicdev/website`:**

- `src/app/docs/mcp/McpContentPage.tsx` — renders content from `@talonic/mcp/content` for any tool page.
- `src/app/docs/mcp/tools/<short>/page.tsx` — per-tool page files (one per tool).
- `src/app/docs/mcp/page.tsx` — MCP docs homepage with the tool grid.
- `src/app/docs/layout.tsx` → `MCP_SLUG_TO_URL` (the slug → URL map at lines ~215-235).
- `src/lib/docs-sync.ts` → `MCP_PAGE_MAP` (line ~410) and `MCP_SECTIONS` (line ~397).
- `next.config.ts` → `redirects()` (lines ~46+) — the `/docs/mcp/<slug>` → `/docs/mcp/tools/<short>` table.

**`talonicdev/platform`:**

- `packages/docs/src/content/{sdk,mcp}/sections.json` — synced from `talonic-mcp/docs/sections.json` (NOT from `src/content/sections/`).
- `.github/workflows/sync-external-docs.yml` — the sync workflow, requires `PLATFORM_SYNC_TOKEN`.
- `.github/workflows/publish-docs.yml` — publishes `@talonic/docs` to npm whenever `packages/docs/**` changes.

## Useful one-liners

```bash
# Has the MCP docs surface drifted from the published npm package?
diff <(node -e 'import("@talonic/mcp/content").then(m => console.log(JSON.stringify(m.MCP_NAV_SECTIONS, null, 2)))') \
     <(node -e 'import("./src/content/seo.ts").then(m => console.log(JSON.stringify(m.MCP_NAV_SECTIONS, null, 2)))')

# Quick probe: is a specific tool page live?
curl -sSL -o /dev/null -w "%{http_code}\n" https://talonic.com/docs/mcp/tools/<short>

# Did the latest publish chain reach the Registry?
curl -fsS 'https://registry.modelcontextprotocol.io/v0/servers?search=io.github.talonicdev/talonic-mcp' \
  | jq -r '.servers[] | select(._meta."io.modelcontextprotocol.registry/official".isLatest) | .server.version'

# Did the platform sync actually find a diff (and therefore commit/trigger publish-docs)?
gh run list --repo talonicdev/platform --workflow=sync-external-docs.yml --limit 5
```

## See also

- `STATUS.md` — running surface tables, follow-ups, resolved items.
- `CHANGELOG.md` — release-by-release log.
- Individual workflow files for the auth/permission inline comments that explain why a specific token or `permissions:` block exists.
