# Upstream Merge + Decision-Task Parity Implementation Plan (sub-project 2b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local `main` merges `origin/main` (PR #22 decision tasks, published as 0.1.77), the seven decision-task tools get the same ChatGPT widget parity, manifest, mirror and website coverage as the other 29 (→ 36), and the sub-project 2 final review's remaining findings are fixed — leaving a branch that fast-forwards onto `origin/main` and passes every lock at 36.

**Architecture:** One merge commit (keep both sides everywhere; counts → 36). Four new widget files on the existing scaffold (one factory yields four metadata cards). Small, tested edits in `src/tools/run.ts`, `ask.ts`, `_http.ts` and two widgets for the review findings. Website mirrors the seven pages.

**Tech Stack:** TypeScript strict ESM (`.js` suffixes), zod, MCP SDK, vitest 3 + jsdom, prettier (no semicolons, double quotes, printWidth 100), Next.js website.

**Spec:** `docs/superpowers/specs/2026-09-22-decision-task-parity-merge-design.md`

## Global Constraints

- **Never `git push`** in either repo. Never `git rebase`, never force anything: this is a **merge**.
- Commits touching `src/tools/**` / `src/http-server.ts` / `src/server-factory.ts` carry `[skip docs]` UNLESS the same commit changes `docs/sections.json` (Task 2 does, so Task 2's commit carries no marker; Task 3's tool-text commit also changes `docs/sections.json`, no marker).
- Widget render bodies: JS in TS template literals, no backticks, no `${`, concatenation only; every payload string through `esc`/`chip`/`idChip`/`clamp(fmt(…))`. Fixtures generic (`11111111-…`, `Musterfirma AG`).
- Descriptions ≤ 1500 chars, keep `NOT FOR`. Status strings ≤ 64 chars; widget descriptions > 20 chars.
- Every count that reads twenty-nine/29 (either lineage) becomes thirty-six/36 — except dated history (CHANGELOG released entries, STATUS "Resolved" sections, submission-record history).
- Before every commit: `npm run typecheck && npm run format && npm test` green (Task 1's merge commit is the one exception — see its steps). Trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Other plans' workspaces under `.superpowers/sdd/` are off-limits.

## File structure

| File | Responsibility |
| --- | --- |
| merge commit | union of both lineages, versions from upstream |
| `src/widgets/decision-task-shared.ts` | `DECISION_JS`: `decisionTone`, `decisionMeta` tiles |
| `src/widgets/decision-task-list.ts`, `decision-bundle.ts`, `decision-package.ts`, `decision-task-card.ts` | list, claim bundle, package page, and the 4-card factory (heartbeat/submit/release/fail) |
| `src/widgets/types.ts`, `register.ts`, `src/tools/decision-tasks.ts` | 7 keys + entries + `_meta` |
| `tests/widgets/render/decision-*.test.ts`, `tests/widgets/fixtures/decision-*.json`, `tests/widgets/xss.test.ts` | render + XSS locks |
| `chatgpt-app-submission.json`, `scripts/chatgpt-preflight.mjs`, `docs/sections.json`, README/AGENTS/CLAUDE/CHANGELOG | 36 everywhere |
| `src/tools/run.ts`, `ask.ts`, `_http.ts`, `src/widgets/run-status.ts`, `spec-list.ts`, `run-results.ts`, `src/content/sections/tools.ts`, tests | final-review fixes |
| website | 7 pages + registries + merge |

---

### Task 1: Merge `origin/main` into local `main`

**Files:** the nine conflicted files — `AGENTS.md`, `CHANGELOG.md`, `README.md`, `docs/sections.json`, `src/content/seo.ts`, `src/http-server.ts`, `src/server-factory.ts`, `tests/tools/descriptions.test.ts`, `tests/widgets/tool-annotations.test.ts`; auto-merged: `package.json`, `src/content/sections/tools.ts`, `tests/http-server.test.ts`.

- [ ] **Step 1: Merge** — `git fetch origin && git merge --no-ff origin/main` (expect the nine conflicts listed above; `git merge-tree` previewed exactly these).

- [ ] **Step 2: Resolve, file by file (keep BOTH sides everywhere):**
  - `src/server-factory.ts`: keep our import lines AND `import { registerDecisionTaskTools } …`; keep our `CreateServerOptions` AND their `decisionTasksInvocable?: boolean` (with its doc comment); in `instructions`, keep our Specs/Run/Ask sentence AND their decision-task paragraph (both before "Prefer acting over explaining."); in the registration block keep `registerSpecTools/registerRunTools/registerAskTools(server, rawToken, baseUrl)` AND `registerDecisionTaskTools(server, rawToken, baseUrl, { invocable: options.decisionTasksInvocable !== false })` — note **`rawToken`**, not `getToken` (surface tagging; the no-bare-fetch guard does not care, but consistency does).
  - `src/http-server.ts`: keep their `DECIDE_SCOPE` import + `scopes_supported` change + `decisionTasksInvocable: tokenHasDecideScope(token)` in the `createServer` options, AND our `baseUrl` passthrough (`...(process.env["TALONIC_BASE_URL"] ? { baseUrl: … } : {})`) + `getWidgetTemplateMeta` import/usage + growth-probe baseUrl argument.
  - `src/content/seo.ts`: `tools` children = our 29 entries then their 7 decision-task entries (order: ours first, theirs appended).
  - `tests/tools/descriptions.test.ts` and `tests/widgets/tool-annotations.test.ts`: union of both lists (our +7 and their +7). In `tool-annotations`, their two read-only tools (`talonic_list_decision_tasks`, `talonic_read_decision_package`) go to `READ_ONLY_TOOLS`, their five to `WRITE_TOOLS`; keep our `OPEN_WORLD_TOOLS` comment.
  - `AGENTS.md` / `README.md`: keep both sets of new rows; every "twenty-nine"/"29" → "thirty-six"/"36" (heading "The thirty-six public tools"; annotations sentence "(22 read-only lookup tools, 14 write-capable)" — recount from the final test lists; widgets "36/36"; README "What you get" table 36 rows; CLAUDE.md line 3 → "the thirty-six tools").
  - `CHANGELOG.md`: keep our `[Unreleased]` bullets AND their bullet(s) (their line(s) describe the decision-task tools shipped in 0.1.77 — move them under a new `## [0.1.77] - 2026-09-22` heading you create, with `### Added` — that IS the published release). In `[Unreleased]`: change "Widget parity at 22 tools" → "Widget parity for every public tool (36 with this release)" and "describes all 22 tools" → "describes all public tools"; replace the "29 public" mention in the Specs/Run/Ask bullet with "36 public"; add a bullet: `- **Decision-task widgets.** The seven `talonic_*_decision_task` tools shipped in 0.1.77 get ChatGPT cards (worklist, claim bundle, package page, and lease/submit/release/fail metadata cards), manifest entries, mirror docs and website pages.`; add the note line `> Next release is 0.1.78 (0.1.77 shipped PR #22 on 2026-09-22).` under the heading.
  - `docs/sections.json`: take OURS (43 entries, generated), then apply their non-tool prose edits only where ours still says twenty-nine → all "twenty-nine public tools" → "thirty-six public tools" (the seven decision entries themselves come from the generator in Task 2).
  - `package.json` / `server.json`: upstream's `0.1.77` (auto-merged; verify).

- [ ] **Step 3: Compile and see what is red** — `npm run typecheck` must be green after resolution. `npm test` is EXPECTED to fail only in: `tests/submission-manifest.test.ts` (36 server tools vs 29 manifest), `tests/content/tool-sections.test.ts` (7 decision tools lack mirror entries — their live sections and nav exist), `tests/scripts/preflight-constant.test.ts` (29 ≠ 36 once `TOOL_WIDGET_KEYS` grows — still 29 now, so this one passes until Task 2), and any hard-coded-29 assertion you find. Record the exact failing list in the report. Do NOT weaken tests.

- [ ] **Step 4: Commit the merge** — `git commit` (merge commit message: `Merge origin/main (0.1.77, decision tasks) into main — union of both lineages; counts to 36` + trailer). This single commit may carry red locks; Task 2 turns them green in the same dispatch.

---

### Task 2: Decision-task widgets, keys, manifest, mirror, counts (36/36)

**Files:**
- Create: `src/widgets/decision-task-shared.ts`, `decision-task-list.ts`, `decision-bundle.ts`, `decision-package.ts`, `decision-task-card.ts`
- Create fixtures: `tests/widgets/fixtures/decision-tasks.json`, `decision-bundle.json`, `decision-package.json`, `decision-task.json`
- Create tests: `tests/widgets/render/decision-task-list.test.ts`, `decision-bundle.test.ts`, `decision-package.test.ts`, `decision-task-card.test.ts`
- Modify: `src/widgets/types.ts`, `src/widgets/register.ts`, `src/tools/decision-tasks.ts` (`_meta` on 7 tools), `tests/widgets/xss.test.ts`, `tests/widgets/widget-registry.test.ts` (29 → 36 ×3), `tests/widgets/all-widgets.test.ts` (29 → 36 ×2), `tests/submission-manifest.test.ts` (29 → 36), `chatgpt-app-submission.json`, `scripts/chatgpt-preflight.mjs` (`EXPECTED_TOOLS = 36`), `docs/sections.json` (generator), README/AGENTS counts if any remain.

- [ ] **Step 1: Registry tables** (`src/widgets/types.ts`):

`WIDGET_URIS` +:
```ts
  listDecisionTasks: "ui://widget/decision-task-list.html",
  claimDecisionTask: "ui://widget/decision-bundle.html",
  readDecisionPackage: "ui://widget/decision-package.html",
  heartbeatDecisionTask: "ui://widget/decision-task-heartbeat.html",
  submitDecisionTask: "ui://widget/decision-task-submitted.html",
  releaseDecisionTask: "ui://widget/decision-task-released.html",
  failDecisionTask: "ui://widget/decision-task-failed.html",
```
`TOOL_WIDGET_KEYS` +:
```ts
  talonic_list_decision_tasks: "listDecisionTasks",
  talonic_claim_decision_task: "claimDecisionTask",
  talonic_read_decision_package: "readDecisionPackage",
  talonic_heartbeat_decision_task: "heartbeatDecisionTask",
  talonic_submit_decision_task: "submitDecisionTask",
  talonic_release_decision_task: "releaseDecisionTask",
  talonic_fail_decision_task: "failDecisionTask",
```
`TOOL_INVOCATION_STATUS` +:
```ts
  listDecisionTasks: { invoking: "Loading decision tasks…", invoked: "Decision tasks listed" },
  claimDecisionTask: { invoking: "Claiming decision task…", invoked: "Decision task claimed" },
  readDecisionPackage: { invoking: "Reading the decision package…", invoked: "Package page ready" },
  heartbeatDecisionTask: { invoking: "Extending the decision lease…", invoked: "Lease extended" },
  submitDecisionTask: { invoking: "Submitting the decision…", invoked: "Decision submitted" },
  releaseDecisionTask: { invoking: "Releasing the decision task…", invoked: "Task released" },
  failDecisionTask: { invoking: "Reporting the task as undecidable…", invoked: "Task failed" },
```
`WIDGET_DESCRIPTIONS` +:
```ts
  listDecisionTasks:
    "Worklist of an External-mode app's decision tasks with status, run, epoch, lease expiry and SLA deadline.",
  claimDecisionTask:
    "Claim bundle: the task's lease and epoch, the output contract to satisfy, precedents, and the input-package descriptor with its source documents.",
  readDecisionPackage:
    "One page of a claimed task's frozen input package: the records to decide from, page position, and the source documents on the first page.",
  heartbeatDecisionTask: "Lease card confirming the decision task's lease was extended, with the new expiry and SLA deadline.",
  submitDecisionTask: "Confirmation that the decision was submitted and verified; the run resumes.",
  releaseDecisionTask: "Confirmation that the decision task was released back to available for another claimant.",
  failDecisionTask: "Confirmation that the task was reported undecidable: a Human Review is raised and the app's fallback applies.",
```
Change the three `22`→`29` literals in `tests/widgets/widget-registry.test.ts` to `36`.

- [ ] **Step 2: Fixtures** (shapes from the platform controller `decision-tasks.controller.ts` `taskMetadata`, claim bundle and package page):

`decision-task.json` (metadata, used by the list rows and the four cards):
```json
{ "id": "7d3c0001-0000-4000-8000-000000000001", "customer_id": "c0000000-0000-4000-8000-000000000001", "run_id": "a9000001-0000-4000-8000-000000000001", "app_id": "app00001-0000-4000-8000-000000000001", "status": "claimed", "execution_epoch": 2, "input_package_ref": "pkg:run/a9000001", "lease_seconds": 900, "claimed_by": "external_agent:mcp", "claimed_at": "2026-09-22T09:10:00.000Z", "lease_expires_at": "2099-01-01T00:00:00.000Z", "heartbeat_at": "2026-09-22T09:12:00.000Z", "sla_deadline_at": "2099-01-02T00:00:00.000Z", "submitted_at": null, "created_at": "2026-09-22T09:00:00.000Z", "updated_at": "2026-09-22T09:12:00.000Z" }
```
`decision-tasks.json`:
```json
{ "data": [ { "id": "7d3c0001-0000-4000-8000-000000000001", "run_id": "a9000001-0000-4000-8000-000000000001", "app_id": "app00001-0000-4000-8000-000000000001", "status": "available", "execution_epoch": 1, "claimed_by": null, "claimed_at": null, "lease_expires_at": null, "sla_deadline_at": "2099-01-02T00:00:00.000Z", "created_at": "2026-09-22T09:00:00.000Z" }, { "id": "7d3c0002-0000-4000-8000-000000000002", "run_id": "a9000002-0000-4000-8000-000000000002", "app_id": "app00001-0000-4000-8000-000000000001", "status": "claimed", "execution_epoch": 3, "claimed_by": "external_agent:mcp", "claimed_at": "2026-09-22T09:10:00.000Z", "lease_expires_at": "2099-01-01T00:00:00.000Z", "sla_deadline_at": "2099-01-02T00:00:00.000Z", "created_at": "2026-09-22T08:00:00.000Z" }, { "id": "7d3c0003-0000-4000-8000-000000000003", "run_id": "a9000003-0000-4000-8000-000000000003", "app_id": "app00001-0000-4000-8000-000000000001", "status": "failed", "execution_epoch": 2, "claimed_by": null, "claimed_at": null, "lease_expires_at": null, "sla_deadline_at": "2026-09-21T00:00:00.000Z", "created_at": "2026-09-20T08:00:00.000Z" } ], "pagination": { "has_more": true, "next_cursor": "opaque" } }
```
`decision-bundle.json`:
```json
{ "task": { "id": "7d3c0001-0000-4000-8000-000000000001", "run_id": "a9000001-0000-4000-8000-000000000001", "app_id": "app00001-0000-4000-8000-000000000001", "status": "claimed", "execution_epoch": 2, "claimed_by": "external_agent:mcp", "claimed_at": "2026-09-22T09:10:00.000Z", "lease_expires_at": "2099-01-01T00:00:00.000Z", "sla_deadline_at": "2099-01-02T00:00:00.000Z", "lease_seconds": 900 }, "output_contract": { "type": "object", "required": ["approve"], "properties": { "approve": { "type": "boolean" }, "note": { "type": "string" } } }, "precedents": [ { "task_id": "7d3c0000-0000-4000-8000-000000000000", "outcome": { "approve": true }, "rationale": "Vendor known, total under threshold." } ], "package": { "package_kind": "records", "record_count": 3, "page_size": 500, "first_cursor": "eyJvZmZzZXQiOjB9", "documents": [ { "document_id": "d0c00001-0000-4000-8000-000000000001", "filename": "invoice-0421.pdf" }, { "document_id": "d0c00001-0000-4000-8000-000000000002", "filename": "po-1042.pdf" } ] } }
```
`decision-package.json`:
```json
{ "task_id": "7d3c0001-0000-4000-8000-000000000001", "run_id": "a9000001-0000-4000-8000-000000000001", "record_count": 3, "page_size": 2, "documents": [ { "document_id": "d0c00001-0000-4000-8000-000000000001", "filename": "invoice-0421.pdf" } ], "data": [ { "locator": "cell:inv-0421/total_amount", "field": "total_amount", "value": 1299, "document_id": "d0c00001-0000-4000-8000-000000000001" }, { "locator": "cell:po-1042/total_amount", "field": "total_amount", "value": 1299, "document_id": "d0c00001-0000-4000-8000-000000000002" } ], "pagination": { "has_more": true, "next_cursor": "eyJvZmZzZXQiOjJ9" } }
```

- [ ] **Step 3: Shared JS** — `src/widgets/decision-task-shared.ts`:

```ts
/**
 * JS shared by the decision-task widgets; prepended to each RENDER_BODY so it
 * runs inside render(payload) with the shared helpers in scope.
 * - decisionTone(status): chip tone incl. released / failed.
 * - decisionMeta(p): the metadata tile grid (run, app, epoch, claimant, lease, SLA).
 * @internal
 */
export const DECISION_JS = `
    function decisionTone(s) {
      return s === "available" ? "info" : s === "claimed" || s === "submitted" ? "good" : s === "failed" || s === "timed_out" ? "bad" : s === "released" || s === "cancelled" ? "warn" : "";
    }
    function decisionMeta(p) {
      return '<div class="grid">'
        + '<div class="kv"><span class="k">Run</span> <span class="val">' + idChip(p.run_id) + '</span></div>'
        + '<div class="kv"><span class="k">App</span> <span class="val">' + idChip(p.app_id) + '</span></div>'
        + '<div class="kv"><span class="k">Execution epoch</span> <span class="val">' + esc(p.execution_epoch != null ? p.execution_epoch : "—") + '</span></div>'
        + '<div class="kv"><span class="k">Claimed by</span> <span class="val">' + esc(p.claimed_by || "—") + '</span></div>'
        + '<div class="kv"><span class="k">Lease expires</span> <span class="val">' + esc(p.lease_expires_at ? relTime(p.lease_expires_at) : "—") + '</span></div>'
        + '<div class="kv"><span class="k">SLA deadline</span> <span class="val">' + esc(p.sla_deadline_at ? relTime(p.sla_deadline_at) : "—") + '</span></div>'
        + '</div>';
    }
`
```

- [ ] **Step 4: Widgets**

`src/widgets/decision-task-list.ts`:
```ts
import { DECISION_JS } from "./decision-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/** Worklist card for `talonic_list_decision_tasks`. @internal */
export function getDecisionTaskListWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY =
  DECISION_JS +
  `
    var rows = Array.isArray(payload.data) ? payload.data : [];
    var pg = payload.pagination && typeof payload.pagination === "object" ? payload.pagination : {};
    if (!rows.length) { empty("No decision tasks for this app."); return; }
    var body = rows.map(function (t) {
      t = t && typeof t === "object" ? t : {};
      return '<tr><td>' + idChip(t.id) + '</td><td>' + chip(t.status, decisionTone(t.status)) + '</td><td>' + idChip(t.run_id) + '</td>'
        + '<td class="val num">' + esc(t.execution_epoch != null ? t.execution_epoch : "—") + '</td>'
        + '<td class="val">' + esc(t.lease_expires_at ? relTime(t.lease_expires_at) : "—") + '</td>'
        + '<td class="val">' + esc(t.sla_deadline_at ? relTime(t.sla_deadline_at) : "—") + '</td></tr>';
    }).join("");
    var counts = {};
    rows.forEach(function (t) { var s = t && typeof t === "object" && t.status ? t.status : "unknown"; counts[s] = (counts[s] || 0) + 1; });
    var summary = Object.keys(counts).map(function (s) { return chip(counts[s] + " " + s, decisionTone(s)); }).join("");
    var app = rows[0] && typeof rows[0] === "object" ? rows[0].app_id : null;
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Decision tasks</div><div class="subtitle">' + rows.length + ' task' + (rows.length === 1 ? "" : "s") + (app ? ' · app ' + idChip(app) : "") + (pg.has_more ? " · more available" : "") + '</div></div><div>' + summary + '</div></div>'
      + '<table><thead><tr><th>Task</th><th>Status</th><th>Run</th><th class="num">Epoch</th><th>Lease</th><th>SLA</th></tr></thead><tbody>' + body + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Decision Tasks", renderBody: RENDER_BODY })
```

`src/widgets/decision-bundle.ts`:
```ts
import { DECISION_JS } from "./decision-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/** Claim bundle card for `talonic_claim_decision_task`. @internal */
export function getDecisionBundleWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY =
  DECISION_JS +
  `
    var task = payload && payload.task && typeof payload.task === "object" ? payload.task : null;
    if (!task || !task.id) { empty("No decision task was claimed."); return; }
    var contract = payload.output_contract;
    var precedents = Array.isArray(payload.precedents) ? payload.precedents : [];
    var pkg = payload.package && typeof payload.package === "object" ? payload.package : {};
    var docs = Array.isArray(pkg.documents) ? pkg.documents : [];
    var contractHtml = contract && typeof contract === "object" ? (isFlat(contract) ? kvTiles(contract) : jsonTree(contract)) : '<div class="muted small">No output contract on this task.</div>';
    var precHtml = precedents.length ? '<div class="plane"><div class="subtitle">Precedents (' + precedents.length + ')</div>' + precedents.slice(0, 5).map(function (p) {
      p = p && typeof p === "object" ? p : {};
      return '<div class="kv"><span class="val mono">' + esc(clamp(fmt(p.outcome), 100)) + '</span><span class="muted small">' + esc(clamp(p.rationale || "", 160)) + (p.task_id ? ' · task ' + esc(shortId(p.task_id)) : "") + '</span></div>';
    }).join("") + '</div>' : "";
    var docHtml = docs.length ? '<div class="plane"><div class="subtitle">Source documents (' + docs.length + ')</div>' + docs.slice(0, 20).map(function (d) { d = d && typeof d === "object" ? d : {}; return chip(d.filename || shortId(d.document_id), ""); }).join("") + '</div>' : "";
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Decision task claimed</div><div class="subtitle">task ' + idChip(task.id) + '</div></div><div>' + chip(task.status, decisionTone(task.status)) + '</div></div>'
      + '<div class="big">' + esc(task.execution_epoch != null ? task.execution_epoch : "—") + ' <span class="muted small">execution epoch</span></div>'
      + '<div class="muted small">Keep this epoch for heartbeat, submit, release or fail.' + (task.lease_expires_at ? ' Lease expires ' + esc(relTime(task.lease_expires_at)) + '.' : "") + '</div>'
      + decisionMeta(task)
      + '<div class="plane"><div class="subtitle">Output contract</div>' + contractHtml + '</div>'
      + '<div class="plane"><div class="subtitle">Input package</div><div class="grid">'
      + '<div class="kv"><span class="k">Kind</span> <span class="val">' + esc(pkg.package_kind || "—") + '</span></div>'
      + '<div class="kv"><span class="k">Records</span> <span class="val">' + esc(pkg.record_count != null ? pkg.record_count : "—") + '</span></div>'
      + '<div class="kv"><span class="k">Page size</span> <span class="val">' + esc(pkg.page_size != null ? pkg.page_size : "—") + '</span></div>'
      + '<div class="kv"><span class="k">First cursor</span> <span class="val mono">' + esc(pkg.first_cursor ? clamp(pkg.first_cursor, 24) : "—") + '</span></div>'
      + '</div>' + (pkg.first_cursor ? '<div class="small" style="margin-top:6px">Read the records with talonic_read_decision_package starting at first_cursor.</div>' : "") + '</div>'
      + precHtml + docHtml;
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Decision Task Claimed", renderBody: RENDER_BODY })
```

`src/widgets/decision-package.ts`:
```ts
import { buildWidgetHtml } from "./shared.js"

/** Package page card for `talonic_read_decision_package`. @internal */
export function getDecisionPackageWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    if (!payload || typeof payload !== "object" || !payload.task_id) { empty("No package page."); return; }
    var records = Array.isArray(payload.data) ? payload.data : [];
    var pg = payload.pagination && typeof payload.pagination === "object" ? payload.pagination : {};
    var docs = Array.isArray(payload.documents) ? payload.documents : [];
    var body = !records.length ? '<div class="empty">This page has no records.</div>' : (isRowArray(records) ? dataTable(records) : jsonTree(records));
    var docHtml = docs.length ? '<div class="plane"><div class="subtitle">Source documents (' + docs.length + ')</div>' + docs.slice(0, 20).map(function (d) { d = d && typeof d === "object" ? d : {}; return chip(d.filename || shortId(d.document_id), ""); }).join("") + '</div>' : "";
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Decision package</div><div class="subtitle">task ' + idChip(payload.task_id) + ' · run ' + idChip(payload.run_id) + '</div></div>'
      + '<div>' + chip(records.length + ' of ' + esc(payload.record_count != null ? payload.record_count : "?") + ' records', "") + (pg.has_more ? chip("more pages", "info") : chip("last page", "good")) + '</div></div>'
      + body
      + (pg.next_cursor ? '<div class="muted small" style="margin-top:6px">Next page cursor: <span class="mono">' + esc(clamp(pg.next_cursor, 32)) + '</span></div>' : "")
      + '<div class="small" style="margin-top:8px">Copy evidence locators verbatim from these records into talonic_submit_decision_task.</div>'
      + docHtml;
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Decision Package", renderBody: RENDER_BODY })
```

`src/widgets/decision-task-card.ts`:
```ts
import { DECISION_JS } from "./decision-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/**
 * Metadata card shared by the four decision-task mutations: heartbeat ("Lease
 * extended"), submit ("Decision submitted"), release ("Task released") and
 * fail ("Task failed"). The payload is the platform's task metadata.
 * @internal
 */
export function getDecisionHeartbeatWidgetHtml(): string {
  return HEARTBEAT_HTML
}
/** @internal */
export function getDecisionSubmittedWidgetHtml(): string {
  return SUBMITTED_HTML
}
/** @internal */
export function getDecisionReleasedWidgetHtml(): string {
  return RELEASED_HTML
}
/** @internal */
export function getDecisionFailedWidgetHtml(): string {
  return FAILED_HTML
}

const CARD_BODY = `
    if (!payload || typeof payload !== "object" || !payload.id) { empty("No decision task."); return; }
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + HEADLINE + '</div><div class="subtitle">task ' + idChip(payload.id) + (payload.submitted_at ? ' · ' + esc(relTime(payload.submitted_at)) : "") + '</div></div>'
      + '<div>' + chip(payload.status, decisionTone(payload.status)) + '</div></div>'
      + '<div class="small">' + NOTE + '</div>'
      + decisionMeta(payload);
`

function card(headline: string, note: string, title: string): string {
  return buildWidgetHtml({
    title,
    renderBody:
      DECISION_JS +
      "    var HEADLINE = " + JSON.stringify(headline) + ";\n" +
      "    var NOTE = " + JSON.stringify(note) + ";\n" +
      CARD_BODY,
  })
}

const HEARTBEAT_HTML = card("Lease extended", "Keep heartbeating before the lease expires; the SLA deadline is the hard stop.", "Talonic — Decision Task Lease")
const SUBMITTED_HTML = card("Decision submitted", "The platform verified the decision and resumes the run.", "Talonic — Decision Submitted")
const RELEASED_HTML = card("Task released", "The task is available again for another claimant; the next claim bumps the epoch.", "Talonic — Decision Task Released")
const FAILED_HTML = card("Task failed", "A Human Review was raised with your reason and the app's fallback policy applies.", "Talonic — Decision Task Failed")
```

- [ ] **Step 5: Render tests** (three cases each; assert DOM/text via `renderWidget`/`loadFixture`):
  - `decision-task-list.test.ts`: 3 rows; "3 tasks"; summary chips "1 available"(info) "1 claimed"(good) "1 failed"(bad); "7d3c0001"; `/in \d+d/`; "more available"; empty `{data:[]}` → "No decision tasks for this app."; malformed `{data:[null,"x",{status:"released"}]}` → 3 rows and a `.chip.warn`.
  - `decision-bundle.test.ts`: "Decision task claimed"; `.big` contains "2"; `.chip.good` = "claimed"; "Output contract" + `details.tree` present (nested contract); "Precedents (1)" + "Vendor known"; package tiles "records", "3", "500"; "Source documents (2)" + "invoice-0421.pdf"; "talonic_read_decision_package"; empty `{}` → "No decision task was claimed."; malformed `{task:{id:5,status:7},output_contract:"x",precedents:"y",package:3}` renders.
  - `decision-package.test.ts`: "Decision package"; "2 of 3 records"; `tbody tr` = 2; "cell:inv-0421/total_amount"; "more pages" chip; "Next page cursor"; "Source documents (1)"; page with `data: []` → "This page has no records."; empty `{}` → "No package page."; malformed `{task_id:"t", data:"x", pagination:2, documents:"y"}` renders.
  - `decision-task-card.test.ts`: heartbeat/submitted/released/failed each render their headline + note with the `decision-task.json` fixture (for submitted use `{...fixture, status:"submitted", submitted_at:"2026-09-22T09:14:00.000Z"}` and assert `/ago/`; for failed use `status:"failed"` → `.chip.bad`; released → `status:"released"` → `.chip.warn`); "Execution epoch 2"; "Lease expires in"; empty `{}` → "No decision task."; the four templates differ only in headline/note/title (normalise the three strings and assert equality pairwise against the heartbeat template).

- [ ] **Step 6: Registry + meta + XSS map + locks** — `register.ts`: seven entries (`decision-task-list-widget` "Talonic Decision Tasks", `decision-bundle-widget` "Talonic Decision Task Claimed", `decision-package-widget` "Talonic Decision Package", `decision-task-heartbeat-widget` "Talonic Decision Task Lease", `decision-task-submitted-widget` "Talonic Decision Submitted", `decision-task-released-widget` "Talonic Decision Task Released", `decision-task-failed-widget` "Talonic Decision Task Failed"). `src/tools/decision-tasks.ts`: `_meta: widgetToolMeta("<key>")` on the seven `registerTool` configs — NOTE upstream may already set `_meta: { "talonic/can_invoke": … }` when `invocable` is false: MERGE the objects (`_meta: { ...widgetToolMeta("listDecisionTasks"), ...(existing meta) }`) so neither key is lost; keep their `NOT_INVOCABLE_PREFIX` behaviour. `tests/widgets/xss.test.ts` map +7 (`listDecisionTasks: "decision-tasks"`, `claimDecisionTask: "decision-bundle"`, `readDecisionPackage: "decision-package"`, the four cards → `"decision-task"`). `all-widgets.test.ts` two literals → 36; `submission-manifest.test.ts` literal → 36; `scripts/chatgpt-preflight.mjs` `EXPECTED_TOOLS = 36`.

- [ ] **Step 7: Manifest** — seven entries with server-mirroring annotations (list/read: `readOnlyHint true, openWorldHint false, destructiveHint false`; claim/heartbeat/submit/release/fail: `false/false/false`) and honest justifications (claim = takes a lease; heartbeat = extends it; submit = writes the decision and resumes the run; release = gives the task back; fail = raises a Human Review and applies the app's fallback — "never deletes or overwrites data"), plus one test case: prompt "Any decisions waiting for the Invoice Approval app? Claim the first one, show me the package, and approve it if the total is under 5,000." with `tools_triggered` = all seven names, expected output describing the cards.

- [ ] **Step 8: Mirror + counts** — `npm run build && node …` (the sub-project 2 Task 9 generator, `.superpowers/sdd/2026-09-22-run-specs-ask-tools/task-9-brief.md` Step 4 — copy the snippet) → expect `added 7 entries; total 50`; then `grep -c -i "twenty-nine" docs/sections.json README.md AGENTS.md CLAUDE.md` = 0 (all → thirty-six).

- [ ] **Step 9: Verify + commit** — `npm run typecheck && npm run format && npm test && npm run build && npm run preflight:chatgpt` (36). Commit (no `[skip docs]` — docs/sections.json changes):
```bash
git add src/widgets src/tools/decision-tasks.ts tests/widgets chatgpt-app-submission.json scripts/chatgpt-preflight.mjs tests/submission-manifest.test.ts docs/sections.json README.md AGENTS.md CLAUDE.md
git commit -m "feat(widgets): decision-task cards (36/36) — worklist, claim bundle, package page, lease/submit/release/fail; manifest, mirror, counts at 36

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Sub-project 2 final-review fixes

**Files:** `src/tools/run.ts`, `src/tools/ask.ts`, `src/tools/_http.ts`, `src/widgets/run-status.ts`, `src/widgets/spec-list.ts`, `src/widgets/run-results.ts`, `src/content/sections/tools.ts`, `docs/sections.json`, tests `tests/tools/run.test.ts`, `tests/tools/ask.test.ts`, `tests/widgets/render/run-status.test.ts`, `tests/widgets/render/answer.test.ts`, `tests/tools/http-helpers.test.ts`.

- [ ] **F-A `get_run_results` run_id scoping** — `pickRef` stays for `handleGetRun`; in `handleGetRunResults` accept BOTH ids: if `pipeline_id` present → pipelines route with `params` `{ view: "documents", run_id: args.run_id, document_id, include, limit, cursor }` (run_id forwarded when given); if only `run_id` → `/v1/run/{id}/results`; neither → validationError. Update the `RunResultsArgs` doc and `RESULTS_DESCRIPTION` ARGS line: "`pipeline_id` (run_kind 'pipeline', optionally with the envelope's `run_id` to scope to that submission) or `run_id` alone (run_kind 'run')". Tests: pipeline_id + run_id → URL `?view=documents&run_id=…`; both absent → error; run_id alone → run route (existing).
- [ ] **F-B Description/docs qualifiers** — `RUN_DESCRIPTION` RETURNS line: "Then poll talonic_get_run with the `pipeline_id` when run_kind is 'pipeline', or with the `run_id` when it is 'run', every 5–10 s…"; `RESULTS_DESCRIPTION` as above; docs sections `talonic-get-run` / `talonic-get-run-results` / `talonic-run-spec` prose: replace "whichever the RunEnvelope returned" with the run_kind rule; `run_spec` response table adds `spec_name`, `enqueued_documents`, `appended`, `message`; `get-run-results` params table notes run_id may accompany pipeline_id. Mirror the same edits in `docs/sections.json` (three entries). Lock: `descriptions.test.ts` asserts `RESULTS_DESCRIPTION` contains "run_kind".
- [ ] **F-C `run-status` honest render** — unknown counters render "—": `var total = typeof pr.total_documents === "number" ? pr.total_documents : null` etc.; progress line "— of — documents" when both null and bar width 0; test with `progress: { total_documents: null, completed_documents: null, error_documents: null }` asserting the text contains "— of — documents".
- [ ] **F-D `handleGetAnswer` backfill** — return `{ ...withHint(body), ask_id: body.ask_id ?? args.ask_id }`; test with a body lacking `ask_id`.
- [ ] **F-E poll timeouts** — `apiJson` opts gain `signal?: AbortSignal` (forwarded to fetch); `handleAsk` passes `signal: AbortSignal.timeout(Math.max(1000, Math.min(15000, deadline - t)))` on each poll GET and the initial POST gets `AbortSignal.timeout(15000)`; guard `Number.isFinite(args.wait_seconds)` before the clamp (non-finite → default). Tests: the clamp test with injected clock + `wait_seconds: 999` asserting `waited_ms <= 55000` and ≤ 29 GETs; `wait_seconds: NaN` behaves as default (assert deadline math via `waited_ms` ≤ 45000 with an always-processing stub); http-helpers test that `apiJson` forwards `signal`.
- [ ] **F-F href negative test** — `answer.test.ts`: artifact `link: "javascript:alert(1)"` → `querySelector("a.btn")` null; same for `agent-tool-result.test.ts`.
- [ ] **F-G `mapRunStatus`** folds `canceled` → failed (+ test row).
- [ ] **F-H payload guards** — `spec-list.ts` and `run-results.ts` start with `if (!payload || typeof payload !== "object") { empty(...); return; }` using their existing empty strings; tests pass `null`-ish (e.g. `renderWidget(html, "garbage")` → empty text).
- [ ] Verify: `npm run typecheck && npm run format && npm test`; commit (changes `docs/sections.json` → no marker):
```bash
git add src/tools/run.ts src/tools/ask.ts src/tools/_http.ts src/widgets/run-status.ts src/widgets/spec-list.ts src/widgets/run-results.ts src/content/sections/tools.ts docs/sections.json tests
git commit -m "fix(tools,widgets): run_id scoping on pipeline results, run_kind polling rule in descriptions/docs, honest run-status counters, ask poll timeouts + clamp lock, get_answer ask_id backfill, href negative tests, canceled spelling, payload guards

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Website — merge upstream, seven decision-task pages, counts 36

**Repo:** `/Users/macman/Talonic/website`. Steps: `git fetch && git merge --no-ff origin/main` (lockfile-only upstream `9579934`; resolve `package-lock.json` by taking theirs if it conflicts). Then, mirroring sub-project 2 Task 10 exactly: pages `list-decision-tasks`, `claim-decision-task`, `read-decision-package`, `heartbeat-decision-task`, `submit-decision-task`, `release-decision-task`, `fail-decision-task` (slugs `talonic-<short>` — confirm they match `src/content/sections/tools.ts` slugs in the MCP repo, which PR #22 named `talonic-list-decision-tasks` etc.); `MCP_ROUTES` +7; `MCP_PAGE_MAP` +7 (mentions: decision task, external app, claim, package, epoch, lease, SLA, human review); tools description "Thirty-six MCP tools … Spec runs, cited question answering and External-mode app decisions"; `next.config.ts` +7 redirects; `sitemap.ts` +7 (priority 0.6, submit/claim 0.7); `.well-known/mcp.json` +7 entries (one-line descriptions from the tool descriptions' first sentence); hub prose "Thirty-six tools" + enumeration +7 and one `DocsRelated` card for `list-decision-tasks`. Verify with `npx tsc --noEmit -p .` (ignore stale `.next/types`). Commit locally (explicit paths; never CLAUDE.md or `.superpowers-*.md`): `docs(mcp): merge upstream; wire the seven decision-task tool pages, registries, sitemap and mcp.json (36 tools)` + trailer.

---

### Task 5: Final verification and hand-off

- [ ] `npm run typecheck && npm run format:check && npm test && npm run build && npm run preflight:chatgpt` → green, preflight 36; `git status --short` clean; `git status -sb` shows `main...origin/main [ahead N]` with **no "behind"**.
- [ ] `git log --oneline origin/main..main | wc -l` and the merge commit present; both repos unpushed.
- [ ] Report: commits (both repos), test totals, preflight line, and the release order (talonic-mcp push → CI 0.1.78 → website pin bump → website push).
