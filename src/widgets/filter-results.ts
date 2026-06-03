import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_filter`. Lists matching documents with their
 * extracted field values, and surfaces any API warnings (e.g. the numeric-
 * operator-on-string-field trap) prominently.
 *
 * @internal
 */
export function getFilterResultsWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var data = Array.isArray(payload.data) ? payload.data : [];
    var total = typeof payload.total === "number" ? payload.total : data.length;
    var warnings = Array.isArray(payload.warnings) ? payload.warnings : [];

    var warnHtml = warnings.map(function (w) {
      var msg = w.message || w.code || "Warning";
      var sug = w.suggestion ? '<div class="small">' + esc(w.suggestion) + '</div>' : "";
      return '<div class="kv" style="border-color:var(--warn)"><span class="val" style="color:var(--warn)">⚠ ' + esc(msg) + '</span></div>' + sug;
    }).join("");

    // Union of field keys across matches, for stable table columns (cap at 4).
    var keys = [];
    data.forEach(function (d) {
      Object.keys(d.fields || {}).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    });
    keys = keys.slice(0, 4);

    var head = '<tr><th>Document</th>' + keys.map(function (k) { return '<th>' + esc(k) + '</th>'; }).join("") + '</tr>';
    var rows = data.map(function (d) {
      var f = d.fields || {};
      return '<tr><td class="val">' + esc(d.filename || d.document_id || "") + '</td>'
        + keys.map(function (k) { return '<td class="val">' + esc(fmt(f[k])) + '</td>'; }).join("")
        + '</tr>';
    }).join("");

    root.innerHTML = ''
      + '<div class="header"><div class="title">Filtered documents</div><span class="chip">' + total + '</span></div>'
      + (warnHtml ? '<div style="margin-bottom:8px">' + warnHtml + '</div>' : "")
      + (data.length
          ? '<table><thead>' + head + '</thead><tbody>' + rows + '</tbody></table>'
          : '<div class="empty">No documents matched the filter.</div>');
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Filter Results",
  renderBody: RENDER_BODY,
})
