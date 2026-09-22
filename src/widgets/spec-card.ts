import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_get_spec`: identity + version chips, the rail as
 * ordered stage chips, the compiled phase plan, the Spec's fields, and its
 * published versions when present.
 *
 * @internal
 */
export function getSpecCardWidgetHtml(): string {
  return WIDGET_HTML
}

const CSS = `
  .rail { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 6px; }
  .rail .arrow { color: var(--muted); font-size: 12px; }
`

const RENDER_BODY = `
    if (!payload || typeof payload !== "object" || (!payload.id && !payload.name)) { empty("No Spec."); return; }
    var nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
    var phases = Array.isArray(payload.phases) ? payload.phases : [];
    var fields = Array.isArray(payload.fields) ? payload.fields : [];
    var versions = Array.isArray(payload.versions) ? payload.versions : [];
    var schema = payload.schema && typeof payload.schema === "object" ? payload.schema : null;
    function obj(x) { return x && typeof x === "object" ? x : {}; }
    var versionChip = payload.version == null ? chip("unpublished", "bad")
      : (payload.materialized_version != null && payload.materialized_version === payload.version ? chip("v" + payload.version + " live", "good") : chip("v" + payload.version + " not live", "warn"));
    var fieldCount = typeof payload.field_count === "number" ? payload.field_count : fields.length;
    var railHtml = nodes.length ? '<div class="plane"><div class="subtitle">Rail (' + nodes.length + ' stages)</div><div class="rail">'
      + nodes.map(function (n, i) { n = obj(n); return (i ? '<span class="arrow">→</span>' : "") + '<span class="chip" title="' + esc(n.name || "") + '">' + esc(n.type || "stage") + (n.name ? ' · ' + esc(clamp(n.name, 28)) : "") + '</span>'; }).join("")
      + '</div></div>' : "";
    var phaseHtml = phases.length ? '<div class="plane"><div class="subtitle">Compiled plan (' + phases.length + ' phases)</div><table><thead><tr><th class="num">#</th><th>Type</th><th>Phase</th></tr></thead><tbody>'
      + phases.map(function (p, i) { p = obj(p); return '<tr><td class="val num">' + esc(p.number != null ? p.number : i + 1) + '</td><td>' + chip(p.type, "") + '</td><td class="val">' + esc(p.name || "—") + '</td></tr>'; }).join("")
      + '</tbody></table></div>' : "";
    var fieldHtml = fields.length ? '<div class="plane"><div class="subtitle">Fields (' + fields.length + ')</div><div>'
      + fields.slice(0, 12).map(function (f) { f = obj(f); return chip(f.name || f.field_id || "field", ""); }).join("") + (fields.length > 12 ? '<span class="muted small"> +' + (fields.length - 12) + ' more</span>' : "") + '</div></div>' : "";
    var versionHtml = versions.length ? '<div class="plane"><div class="subtitle">Versions</div><table><thead><tr><th class="num">Version</th><th>Published</th><th>Hash</th><th></th></tr></thead><tbody>'
      + versions.slice(0, 8).map(function (v) { v = obj(v); return '<tr><td class="val num">' + esc(v.version != null ? v.version : "—") + '</td><td class="val">' + esc(v.created_at ? relTime(v.created_at) : "—") + '</td><td class="mono small">' + esc(clamp(fmt(v.content_hash), 18)) + '</td><td>' + (v.is_materialized ? chip("live", "good") : "") + '</td></tr>'; }).join("")
      + '</tbody></table></div>' : "";
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + esc(payload.name || payload.id) + '</div>'
      + (payload.description ? '<div class="subtitle">' + esc(clamp(payload.description, 140)) + '</div>' : "") + '</div>'
      + '<div>' + versionChip + chip(fieldCount + " fields", "") + '</div></div>'
      + '<div class="grid">'
      + '<div class="kv"><span class="k">Spec id</span> <span class="val">' + idChip(payload.id) + '</span></div>'
      + '<div class="kv"><span class="k">Schema</span> <span class="val">' + (schema ? esc(schema.name || "") + " " + idChip(schema.id) : idChip(payload.schema_id)) + '</span></div>'
      + '<div class="kv"><span class="k">Materialized</span> <span class="val">' + esc(payload.materialized_at ? relTime(payload.materialized_at) : "—") + '</span></div>'
      + '<div class="kv"><span class="k">Updated</span> <span class="val">' + esc(payload.updated_at ? relTime(payload.updated_at) : "—") + '</span></div>'
      + '</div>'
      + railHtml + phaseHtml + fieldHtml + versionHtml;
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Spec", css: CSS, renderBody: RENDER_BODY })
