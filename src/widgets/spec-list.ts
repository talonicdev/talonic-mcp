import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_list_specs`: one row per Spec — name (+ description),
 * version state chip (live / not live / unpublished), field and stage counts,
 * last update — with a pagination footer.
 *
 * @internal
 */
export function getSpecListWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    if (!payload || typeof payload !== "object") { empty("No Specs in this workspace."); return; }
    var rows = Array.isArray(payload.data) ? payload.data : [];
    var pg = payload.pagination && typeof payload.pagination === "object" ? payload.pagination : {};
    if (!rows.length) { empty("No Specs in this workspace."); return; }
    function versionChip(s) {
      if (s.version == null) return chip("unpublished", "bad");
      if (s.materialized_version != null && s.materialized_version === s.version) return chip("v" + s.version + " live", "good");
      return chip("v" + s.version + " not live", "warn");
    }
    var body = rows.map(function (s) {
      s = s && typeof s === "object" ? s : {};
      return '<tr>'
        + '<td><div class="val">' + esc(s.name || s.id || "(spec)") + '</div>' + (s.description ? '<div class="muted small">' + esc(clamp(s.description, 100)) + '</div>' : "") + '</td>'
        + '<td>' + versionChip(s) + '</td>'
        + '<td class="val num">' + esc(s.field_count != null ? s.field_count : "—") + '</td>'
        + '<td class="val num">' + esc(s.node_count != null ? s.node_count : "—") + '</td>'
        + '<td class="val">' + esc(s.updated_at ? relTime(s.updated_at) : "—") + '</td>'
        + '</tr>';
    }).join("");
    var total = typeof pg.total === "number" ? pg.total : rows.length;
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Specs</div><div class="subtitle">' + rows.length + ' of ' + total + ' Specs</div></div>'
      + (pg.has_more ? '<span class="chip">more available</span>' : "") + '</div>'
      + '<table><thead><tr><th>Spec</th><th>Version</th><th class="num">Fields</th><th class="num">Stages</th><th>Updated</th></tr></thead><tbody>' + body + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Specs", renderBody: RENDER_BODY })
