import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_list_apps`: the workspace's apps as a table
 * (name, description, mode, enabled).
 *
 * @internal
 */
export function getAppListWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var apps = Array.isArray(payload.apps) ? payload.apps : [];
    var rows = apps.map(function (a) {
      return '<tr>'
        + '<td>' + esc(a.display_name || a.slug || "(unnamed)") + '</td>'
        + '<td class="muted small">' + esc(clamp(a.description || "", 160)) + '</td>'
        + '<td>' + chip(a.mode || "—", a.mode === "external" ? "info" : "") + '</td>'
        + '<td>' + (a.enabled === false ? chip("off", "warn") : chip("on", "good")) + '</td>'
        + '</tr>';
    }).join("");
    root.innerHTML = ''
      + '<div class="header"><div class="title">Apps</div>'
      + '<span class="chip">' + esc(apps.length) + '</span></div>'
      + '<table><thead><tr><th>App</th><th>What it does</th><th>Mode</th><th>Enabled</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="4" class="empty">No apps in this workspace.</td></tr>')
      + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({ title: "Talonic — Apps", renderBody: RENDER_BODY })
