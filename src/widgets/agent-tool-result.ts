import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_invoke_agent_tool`. The result has no fixed
 * shape, so it is rendered by shape: array of row objects → data table;
 * flat object → key/value tiles; nested object → collapsible JSON tree;
 * scalar → preformatted block. Citations and artifacts follow when present.
 *
 * @internal
 */
export function getAgentToolResultWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var result = payload && typeof payload === "object" ? payload.result : undefined;
    var toolName = (payload && payload.tool) || "agent tool";
    var isEmptyResult = result == null || result === ""
      || (Array.isArray(result) && result.length === 0)
      || (typeof result === "object" && !Array.isArray(result) && Object.keys(result).length === 0);
    var body;
    if (isEmptyResult) body = '<div class="empty">The tool returned no data.</div>';
    else if (isRowArray(result)) body = dataTable(result);
    else if (isFlat(result)) body = kvTiles(result);
    else if (typeof result === "object") body = jsonTree(result);
    else body = '<pre class="md">' + esc(fmt(result)) + '</pre>';
    var cites = Array.isArray(payload.citations) ? payload.citations : [];
    var arts = Array.isArray(payload.artifacts) ? payload.artifacts : [];
    function obj(x) { return x && typeof x === "object" ? x : {}; }
    var citeHtml = cites.length ? '<div class="plane"><div class="subtitle">Citations (' + cites.length + ')</div>' + cites.slice(0, 20).map(function (c) {
      c = obj(c);
      return '<div class="kv"><span class="small">“' + esc(clamp(c.quote || c.text || fmt(c), 160)) + '”</span><span class="muted small">' + esc(c.filename || shortId(c.document_id)) + '</span></div>';
    }).join("") + '</div>' : "";
    var artHtml = arts.length ? '<div class="plane"><div class="subtitle">Artifacts (' + arts.length + ')</div>' + arts.slice(0, 20).map(function (a) {
      a = obj(a);
      var link = typeof a.link === "string" && /^https:\\/\\//.test(a.link) ? a.link : "";
      return '<div class="kv"><span class="val">' + esc(a.label || a.type || a.id || "artifact") + '</span>'
        + (link ? '<a class="btn small" href="' + esc(link) + '" target="_blank" rel="noopener">Open</a>' : "") + '</div>';
    }).join("") + '</div>' : "";
    var count = "";
    if (!isEmptyResult) {
      if (isRowArray(result)) count = result.length + (result.length === 1 ? " row" : " rows");
      else if (result && typeof result === "object" && !Array.isArray(result)) {
        var keyCount = Object.keys(result).length;
        count = keyCount + (keyCount === 1 ? " key" : " keys");
      }
    }
    root.innerHTML = ''
      + '<div class="header"><div><div class="title mono">' + esc(toolName) + '</div>' + (count ? '<div class="subtitle">' + esc(count) + '</div>' : "") + '</div></div>'
      + body + citeHtml + artHtml;
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Agent Tool Result",
  renderBody: RENDER_BODY,
})
