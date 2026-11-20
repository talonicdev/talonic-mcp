import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_get_schema`: one saved schema and its fields
 * (name, type, description) read from the JSON Schema `definition`.
 *
 * @internal
 */
export function getSchemaCardWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var def = payload.definition && typeof payload.definition === "object" ? payload.definition : {};
    var props = def.properties && typeof def.properties === "object" ? def.properties : {};
    var required = Array.isArray(def.required) ? def.required : [];
    var names = Object.keys(props);
    var rows = names.map(function (n) {
      var p = props[n] && typeof props[n] === "object" ? props[n] : {};
      var type = Array.isArray(p.type) ? p.type.join(" | ") : (p.type || (p.enum ? "enum" : ""));
      return '<tr>'
        + '<td class="mono">' + esc(n) + (required.indexOf(n) >= 0 ? ' <span class="muted small">required</span>' : '') + '</td>'
        + '<td class="muted">' + esc(type) + '</td>'
        + '<td class="muted small">' + esc(clamp(p.description || "", 200)) + '</td>'
        + '</tr>';
    }).join("");
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + esc(payload.name || "Schema") + '</div>'
      + '<div class="subtitle mono">' + esc(payload.short_id || payload.id || "") + (payload.version != null ? ' · v' + esc(payload.version) : '') + '</div></div>'
      + '<span class="chip">' + esc(names.length) + ' fields</span></div>'
      + (payload.description ? '<div class="muted small">' + esc(payload.description) + '</div>' : '')
      + '<table><thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="3" class="empty">This schema has no fields.</td></tr>')
      + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Schema", renderBody: RENDER_BODY })
