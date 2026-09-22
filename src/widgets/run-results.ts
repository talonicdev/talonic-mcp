import { buildWidgetHtml } from "./shared.js"

/** Rows table for `talonic_get_run_results`. @internal */
export function getRunResultsWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var cols = Array.isArray(payload.columns) ? payload.columns.filter(function (c) { return c && typeof c === "object"; }) : [];
    var rows = Array.isArray(payload.data) ? payload.data : [];
    var pg = payload.pagination && typeof payload.pagination === "object" ? payload.pagination : {};
    if (!rows.length) { empty("No result rows yet."); return; }
    function tone(s) { return s === "complete" || s === "completed" ? "good" : s === "error" ? "bad" : s === "partial" ? "warn" : "info"; }
    var shownCols = cols.slice(0, 10);
    var head = '<tr><th>Document</th><th>Status</th>' + shownCols.map(function (c) { return '<th>' + esc(c.display_name || c.field_key || "") + '</th>'; }).join("") + '</tr>';
    var body = rows.slice(0, 50).map(function (r) {
      r = r && typeof r === "object" ? r : {};
      var f = r.fields && typeof r.fields === "object" ? r.fields : {};
      return '<tr><td class="val">' + esc(r.filename || shortId(r.document_id)) + '</td><td>' + chip(r.status, tone(r.status)) + '</td>'
        + shownCols.map(function (c) { var v = f[c.field_key]; var text = v == null ? "—" : (typeof v === "object" ? clamp(JSON.stringify(v), 60) : fmt(v)); return '<td class="val">' + esc(text) + '</td>'; }).join("") + '</tr>';
    }).join("");
    var total = typeof pg.total === "number" ? pg.total : rows.length;
    var held = typeof payload.pending_review_count === "number" ? payload.pending_review_count : 0;
    var more = [];
    if (rows.length > 50) more.push("+" + (rows.length - 50) + " more rows");
    if (cols.length > 10) more.push("+" + (cols.length - 10) + " more columns");
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Run results</div><div class="subtitle">' + Math.min(rows.length, 50) + ' of ' + total + ' rows' + (pg.has_more ? " · more available" : "") + '</div></div>'
      + '<div>' + chip(payload.status, payload.status === "completed" ? "good" : payload.status === "failed" ? "bad" : "info") + (held ? chip(held + " held for review", "warn") : "") + '</div></div>'
      + '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>'
      + (more.length ? '<div class="muted small" style="margin-top:6px">' + esc(more.join(" · ")) + '</div>' : "");
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Run Results", renderBody: RENDER_BODY })
