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

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Decision Package",
  renderBody: RENDER_BODY,
})
