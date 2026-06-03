import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_list_schemas`. Renders the workspace schemas as a
 * table (name, short id, field count, description).
 *
 * @internal
 */
export function getSchemaListWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var data = Array.isArray(payload.data) ? payload.data : [];
    var total = (payload.pagination && payload.pagination.total) != null ? payload.pagination.total : data.length;

    var rows = data.map(function (s) {
      return '<tr>'
        + '<td>' + esc(s.name || "(unnamed)") + '</td>'
        + '<td class="mono muted">' + esc(s.short_id || s.id || "") + '</td>'
        + '<td class="val">' + esc(fmt(s.field_count)) + '</td>'
        + '<td class="muted small">' + esc(s.description || "") + '</td>'
        + '</tr>';
    }).join("");

    root.innerHTML = ''
      + '<div class="header"><div class="title">Saved schemas</div>'
      + '<span class="chip">' + esc(total) + '</span></div>'
      + '<table><thead><tr><th>Name</th><th>Short ID</th><th>Fields</th><th>Description</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="4" class="empty">No schemas saved yet.</td></tr>')
      + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Schemas",
  renderBody: RENDER_BODY,
})
