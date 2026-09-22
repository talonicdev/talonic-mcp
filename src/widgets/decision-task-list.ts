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
