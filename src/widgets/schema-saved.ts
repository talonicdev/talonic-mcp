import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_save_schema`. Confirms the saved schema with its
 * name, short id, field count, and version.
 *
 * @internal
 */
export function getSchemaSavedWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var name = payload.name || "Schema";
    var shortId = payload.short_id || payload.id || "";

    root.innerHTML = ''
      + '<div class="header"><div><div class="title">✓ Schema saved</div>'
      + '<div class="subtitle">' + esc(name) + '</div></div>'
      + (typeof payload.version === "number" ? '<span class="chip">v' + esc(payload.version) + '</span>' : '') + '</div>'
      + (payload.description ? '<div class="muted small">' + esc(payload.description) + '</div>' : '')
      + '<div class="grid">'
      + '  <div class="kv"><span class="k">Short ID</span><span class="val mono">' + esc(shortId) + '</span></div>'
      + '  <div class="kv"><span class="k">Fields</span><span class="val">' + esc(fmt(payload.field_count)) + '</span></div>'
      + '</div>'
      + '<div class="muted small" style="margin-top:8px">Use this schema in <span class="mono">talonic_extract</span> by passing its short ID as <span class="mono">schema_id</span>.</div>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Schema Saved",
  renderBody: RENDER_BODY,
})
