import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_list_agent_tools`: the platform agent tool
 * registry as a table — name + description, impact (read / draft_mutation /
 * live_mutation), capability, and whether this credential may invoke it.
 *
 * @internal
 */
export function getAgentToolsWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var tools = Array.isArray(payload.tools) ? payload.tools : [];
    if (!tools.length) { empty("No agent tools are visible to this credential."); return; }
    function impactTone(i) { return i === "read" ? "good" : i === "draft_mutation" ? "warn" : i === "live_mutation" ? "bad" : ""; }
    var body = tools.map(function (t) {
      t = t && typeof t === "object" ? t : {};
      return '<tr>'
        + '<td><div class="val mono">' + esc(t.name || "(tool)") + '</div><div class="muted small">' + esc(clamp(t.description, 140)) + '</div></td>'
        + '<td>' + chip(t.impact, impactTone(t.impact)) + '</td>'
        + '<td>' + chip(t.capability, "") + '</td>'
        + '<td>' + (t.can_invoke ? '<span class="chip good">✓ invocable</span>' : '<span class="muted small">—</span>') + '</td>'
        + '</tr>';
    }).join("");
    var inv = typeof payload.invocable_count === "number" ? payload.invocable_count : tools.filter(function (t) { return t && t.can_invoke; }).length;
    var total = typeof payload.totalCount === "number" ? payload.totalCount : tools.length;
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Platform agent tools</div><div class="subtitle">' + inv + ' invocable with this key · ' + total + ' in the registry</div></div></div>'
      + '<table><thead><tr><th>Tool</th><th>Impact</th><th>Capability</th><th>Access</th></tr></thead><tbody>' + body + '</tbody></table>';
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Agent Tools",
  renderBody: RENDER_BODY,
})
