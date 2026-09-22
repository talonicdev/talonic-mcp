import { buildWidgetHtml } from "./shared.js"

/** Progress card for `talonic_get_run`. @internal */
export function getRunStatusWidgetHtml(): string {
  return WIDGET_HTML
}

const CSS = `
  .progress { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .progress .bar { width: 160px; height: 8px; }
`

const RENDER_BODY = `
    if (!payload || typeof payload !== "object" || (!payload.pipeline_id && !payload.run_id)) { empty("No run to show."); return; }
    function tone(s) { return s === "completed" ? "good" : s === "failed" ? "bad" : "info"; }
    var status = typeof payload.status === "string" ? payload.status : "processing";
    var pr = payload.progress && typeof payload.progress === "object" ? payload.progress : {};
    var total = typeof pr.total_documents === "number" ? pr.total_documents : (typeof payload.input_count === "number" ? payload.input_count : 0);
    var done = typeof pr.completed_documents === "number" ? pr.completed_documents : 0;
    var errs = typeof pr.error_documents === "number" ? pr.error_documents : 0;
    var pct = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : (status === "completed" ? 100 : 0);
    var phases = Array.isArray(pr.phases) ? pr.phases : [];
    var docs = Array.isArray(payload.documents) ? payload.documents : [];
    var pending = Array.isArray(pr.finalization_pending) ? pr.finalization_pending : [];
    var phaseHtml = phases.length ? '<div class="plane"><div class="subtitle">Phases</div><table><thead><tr><th>Phase</th><th>Type</th><th class="num">Done</th><th class="num">Running</th><th class="num">Errors</th></tr></thead><tbody>'
      + phases.map(function (p) { p = p && typeof p === "object" ? p : {}; return '<tr><td class="val">' + esc(p.name || p.phase_id || "—") + '</td><td>' + chip(p.type, "") + '</td><td class="val num">' + esc(p.completed != null ? p.completed : 0) + '</td><td class="val num">' + esc(p.running != null ? p.running : 0) + '</td><td class="val num">' + esc(p.errors != null ? p.errors : 0) + '</td></tr>'; }).join("")
      + '</tbody></table></div>' : "";
    var docHtml = docs.length ? '<div class="plane"><div class="subtitle">Documents (' + docs.length + ')</div><table><thead><tr><th>File</th><th>Status</th></tr></thead><tbody>'
      + docs.slice(0, 50).map(function (d) { d = d && typeof d === "object" ? d : {}; return '<tr><td class="val">' + esc(d.filename || shortId(d.document_id)) + '</td><td>' + chip(d.status, tone(d.status)) + '</td></tr>'; }).join("")
      + '</tbody></table></div>' : "";
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + esc(payload.name || "Spec run") + '</div><div class="subtitle">' + esc(payload.run_kind === "run" ? "run " + shortId(payload.run_id) : "pipeline " + shortId(payload.pipeline_id)) + (payload.raw_status && payload.raw_status !== status ? ' · ' + esc(payload.raw_status) : "") + '</div></div>'
      + '<div>' + chip(status, tone(status)) + '</div></div>'
      + '<div class="progress"><span class="bar ' + (errs ? "warn" : "") + '"><span style="width:' + pct + '%"></span></span><span class="val">' + done + ' of ' + total + ' documents</span>' + (errs ? '<span class="muted small">· ' + errs + ' error' + (errs === 1 ? "" : "s") + '</span>' : "") + '</div>'
      + (pending.length ? '<div class="muted small" style="margin-top:6px">Finalizing: ' + esc(pending.join(", ")) + '</div>' : "")
      + (payload.error_message ? '<div class="small" style="margin-top:8px;color:var(--bad)">' + esc(payload.error_message) + '</div>' : "")
      + phaseHtml + docHtml;
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Run Progress",
  css: CSS,
  renderBody: RENDER_BODY,
})
