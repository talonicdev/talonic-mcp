import { TASK_JS } from "./agent-task-shared.js"
import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_list_agent_tasks`: the Agent-stage worklist —
 * one row per task with status chip, document, phase, lease expiry, timeout
 * and execution epoch, plus a per-status summary in the header.
 *
 * @internal
 */
export function getAgentTaskListWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY =
  TASK_JS +
  `
    var rows = Array.isArray(payload.data) ? payload.data : [];
    var pg = payload.pagination && typeof payload.pagination === "object" ? payload.pagination : {};
    if (!rows.length) { empty("No agent tasks in this worklist."); return; }
    var body = rows.map(function (t) {
      t = t && typeof t === "object" ? t : {};
      return '<tr>'
        + '<td>' + idChip(t.id) + '</td>'
        + '<td>' + chip(t.status, statusTone(t.status)) + '</td>'
        + '<td>' + idChip(t.document_id) + '</td>'
        + '<td class="val num">' + esc(t.phase_index != null ? t.phase_index : "—") + '</td>'
        + '<td class="val">' + esc(t.lease_expires_at ? relTime(t.lease_expires_at) : "—") + '</td>'
        + '<td class="val">' + esc(t.timeout_at ? relTime(t.timeout_at) : "—") + '</td>'
        + '<td class="val num">' + esc(t.execution_epoch != null ? t.execution_epoch : "—") + '</td>'
        + '</tr>';
    }).join("");
    var counts = {};
    rows.forEach(function (t) { var s = t && typeof t === "object" && t.status ? t.status : "unknown"; counts[s] = (counts[s] || 0) + 1; });
    var summary = Object.keys(counts).map(function (s) { return chip(counts[s] + " " + s, statusTone(s)); }).join("");
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Agent task worklist</div><div class="subtitle">' + rows.length + ' task' + (rows.length === 1 ? "" : "s") + (pg.has_more ? " · more available" : "") + '</div></div><div>' + summary + '</div></div>'
      + '<table><thead><tr><th>Task</th><th>Status</th><th>Document</th><th class="num">Phase</th><th>Lease</th><th>Timeout</th><th class="num">Epoch</th></tr></thead><tbody>' + body + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Agent Tasks",
  renderBody: RENDER_BODY,
})
