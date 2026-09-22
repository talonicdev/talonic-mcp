import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_list_fields`. One row per Field Registry concept:
 * display/canonical name, data type, maturity (core / proven / candidate),
 * occurrence count, with a superseded marker and a pagination footer.
 *
 * @internal
 */
export function getFieldListWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var rows = Array.isArray(payload.data) ? payload.data : [];
    var pg = payload.pagination && typeof payload.pagination === "object" ? payload.pagination : {};
    if (!rows.length) { empty("No fields match."); return; }
    function maturityTone(m) { return m === "core" ? "good" : m === "proven" ? "info" : m === "candidate" ? "warn" : ""; }
    var body = rows.map(function (f) {
      f = f && typeof f === "object" ? f : {};
      var name = f.display_name || f.canonical_name || f.id || "(field)";
      var sup = f.superseded_by ? ' <span class="chip bad" title="' + esc(f.superseded_by) + '">superseded</span>' : "";
      var canon = f.canonical_name && f.canonical_name !== name ? '<div class="muted small mono">' + esc(f.canonical_name) + '</div>' : "";
      return '<tr>'
        + '<td><div class="val">' + esc(name) + sup + '</div>' + canon + '</td>'
        + '<td>' + chip(f.data_type, "") + '</td>'
        + '<td>' + chip(f.maturity, maturityTone(f.maturity)) + (f.tier != null ? ' <span class="muted small">tier ' + esc(f.tier) + '</span>' : "") + '</td>'
        + '<td class="val num">' + esc(f.occurrence_count != null ? f.occurrence_count : "—") + '</td>'
        + '</tr>';
    }).join("");
    var total = typeof pg.total === "number" ? pg.total : rows.length;
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Field Registry</div><div class="subtitle">' + rows.length + ' of ' + total + ' fields</div></div>'
      + (pg.has_more ? '<span class="chip">more available</span>' : "") + '</div>'
      + '<table><thead><tr><th>Field</th><th>Type</th><th>Maturity</th><th class="num">Occurrences</th></tr></thead><tbody>' + body + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Field Registry",
  renderBody: RENDER_BODY,
})
