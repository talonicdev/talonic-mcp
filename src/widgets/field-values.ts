import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_field_values`: one field's current values across
 * documents — value, document (filename + type), confidence bar, and the
 * provenance (raw label, source text, confirmation / redirect flags).
 *
 * @internal
 */
export function getFieldValuesWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var rows = Array.isArray(payload.data) ? payload.data : [];
    var pg = payload.pagination && typeof payload.pagination === "object" ? payload.pagination : {};
    var name = payload.canonical_name || payload.field_id || "field";
    if (!rows.length) { empty("No values recorded for " + name + "."); return; }
    var body = rows.map(function (r) {
      r = r && typeof r === "object" ? r : { value: r };
      var prov = r.provenance && typeof r.provenance === "object" ? r.provenance : {};
      var flags = (prov.needs_confirmation ? chip("needs confirmation", "warn") : "") + (prov.via_redirect ? chip("via redirect", "info") : "");
      return '<tr>'
        + '<td class="val mono">' + esc(clamp(fmt(r.value), 80)) + '</td>'
        + '<td><div class="val">' + esc(r.document_filename || shortId(r.document_id)) + '</div>' + (r.document_type ? '<div class="muted small">' + esc(r.document_type) + '</div>' : "") + '</td>'
        + '<td>' + confBar(r.confidence) + '</td>'
        + '<td class="small">' + (prov.raw_field_name ? '<div class="mono">' + esc(prov.raw_field_name) + '</div>' : "")
        + (prov.source_text ? '<div class="muted">“' + esc(clamp(prov.source_text, 90)) + '”</div>' : "") + flags + '</td>'
        + '</tr>';
    }).join("");
    var total = typeof pg.total === "number" ? pg.total : rows.length;
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + esc(name) + '</div><div class="subtitle">' + rows.length + ' of ' + total + ' values</div></div>'
      + (pg.has_more ? '<span class="chip">more available</span>' : "") + '</div>'
      + '<table><thead><tr><th>Value</th><th>Document</th><th>Confidence</th><th>Provenance</th></tr></thead><tbody>' + body + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Field Values",
  renderBody: RENDER_BODY,
})
