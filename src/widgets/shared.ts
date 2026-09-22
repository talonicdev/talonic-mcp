import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WIDGET_MIME } from "./types.js"

/**
 * Unique HTTPS origin for this app's widgets. Required for ChatGPT app
 * submission; ChatGPT isolates the widget in a sandbox derived from it
 * (`<domain>.web-sandbox.oaiusercontent.com`). It is an isolation namespace,
 * not a served endpoint, and is shared by every widget in the app.
 *
 * @internal
 */
export const WIDGET_DOMAIN = "https://talonic.com"

/**
 * The `_meta` block attached to every widget resource. Declares the widget
 * domain (required for submission), an empty CSP, a bordered-card
 * preference, and — when given — the model-facing `openai/widgetDescription`.
 * Both the modern `ui.*` keys and the `openai/*` aliases are emitted for host
 * compatibility.
 *
 * @internal
 */
export function widgetMeta(description?: string): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    ui: {
      domain: WIDGET_DOMAIN,
      csp: {
        connectDomains: [],
        resourceDomains: [],
        frameDomains: [],
      },
    },
    "openai/widgetDomain": WIDGET_DOMAIN,
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: [],
      redirect_domains: [],
    },
    "openai/widgetPrefersBorder": true,
  }
  if (description) meta["openai/widgetDescription"] = description
  return meta
}

/**
 * Base CSS shared by every widget. Defines the colour tokens (light + dark),
 * typography, and the common primitives every card uses: header, key/value
 * tables, confidence bars, buttons, badges. Per-widget CSS is appended after
 * this.
 *
 * @internal
 */
const BASE_CSS = `
  :root {
    --bg: #ffffff; --fg: #111827; --muted: #6b7280; --border: #e5e7eb;
    --accent: #4f46e5; --good: #16a34a; --warn: #d97706; --bad: #dc2626;
    --chip: #f3f4f6;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1115; --fg: #f3f4f6; --muted: #9ca3af; --border: #1f2937;
      --chip: #1f2937;
    }
  }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg);
    font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  .root { padding: 20px; box-sizing: border-box; }
  * { box-sizing: border-box; }
  .empty { color: var(--muted); padding: 28px; text-align: center; }
  .muted { color: var(--muted); }
  .small { font-size: 12px; }
  .header { display: flex; align-items: flex-start; justify-content: space-between;
    gap: 12px; margin-bottom: 16px; }
  .title { font-weight: 600; }
  .subtitle { color: var(--muted); font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border);
    vertical-align: top; font-size: 13px; }
  th { color: var(--muted); font-weight: 500; font-size: 12px; }
  th:first-child, td:first-child { padding-left: 0; }
  th:last-child, td:last-child { padding-right: 0; }
  tr:last-child td { border-bottom: none; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .val { font-variant-numeric: tabular-nums; word-break: break-word; }
  .bar { display: inline-block; width: 60px; height: 6px; background: var(--border);
    border-radius: 3px; overflow: hidden; vertical-align: middle; }
  .bar > span { display: block; height: 100%; background: var(--good); }
  .bar.warn > span { background: var(--warn); }
  .bar.bad > span { background: var(--bad); }
  .actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
  button, a.btn { background: var(--bg); color: var(--fg); border: 1px solid var(--border);
    border-radius: 6px; padding: 6px 10px; font: inherit; cursor: pointer;
    text-decoration: none; display: inline-block; }
  button:hover, a.btn:hover { border-color: var(--accent); }
  a.btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .chip { display: inline-block; background: var(--chip); border-radius: 999px;
    padding: 1px 8px; font-size: 12px; margin: 2px 4px 2px 0; }
  .big { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px; margin-top: 14px; }
  /* Stat tile: label stacked above value, padded, never crowding an edge. */
  .kv { display: flex; flex-direction: column; gap: 3px;
    background: var(--chip); border: 1px solid var(--border); border-radius: 8px;
    padding: 10px 12px; min-width: 0; }
  .kv .k { color: var(--muted); font-size: 12px; }
  .kv .val { font-weight: 500; }
  pre.md { background: var(--chip); border: 1px solid var(--border); border-radius: 8px;
    padding: 12px; max-height: 360px; overflow: auto; white-space: pre-wrap;
    word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px; }
  .chip.good { background: rgba(22,163,74,.12); color: var(--good); }
  .chip.warn { background: rgba(217,119,6,.14); color: var(--warn); }
  .chip.bad { background: rgba(220,38,38,.12); color: var(--bad); }
  .chip.info { background: rgba(79,70,229,.12); color: var(--accent); }
  .plane { margin-top: 14px; }
  .plane .subtitle { margin-bottom: 4px; }
  .num { text-align: right; }
  .tree-body { padding-left: 12px; border-left: 1px solid var(--border); margin: 2px 0 2px 2px; }
  .node { padding: 2px 0; font-size: 13px; word-break: break-word; }
  .node .k, .tree-body summary .k { color: var(--muted); }
  details.tree { margin: 2px 0; }
  details.tree > summary { cursor: pointer; font-size: 13px; list-style: none; }
  details.tree > summary::before { content: "▸ "; color: var(--muted); }
  details.tree[open] > summary::before { content: "▾ "; }
`

/**
 * Helper JS injected into every widget. Defines `root` and a set of small
 * render utilities. The widget's own `render(payload)` body uses these.
 *
 * @internal
 */
const HELPERS_JS = `
  var root = document.getElementById("root");
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(v) {
    if (v == null) return "";
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  function confClass(v) {
    if (typeof v !== "number") return "";
    if (v >= 0.85) return "";
    if (v >= 0.7) return "warn";
    return "bad";
  }
  function confBar(v) {
    if (typeof v !== "number") return '<span class="muted small">—</span>';
    var p = Math.round(v * 100);
    return '<span class="bar ' + confClass(v) + '"><span style="width:' + p + '%"></span></span> <span class="muted small">' + p + '%</span>';
  }
  function empty(msg) { root.innerHTML = '<div class="empty">' + esc(msg) + '</div>'; }
  function copyButton(id, text) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", function () {
      if (navigator.clipboard) navigator.clipboard.writeText(text);
    });
  }
  function chip(text, tone) {
    if (text == null || text === "") return "";
    return '<span class="chip' + (tone ? " " + tone : "") + '">' + esc(text) + '</span>';
  }
  function clamp(s, n) {
    var t = String(s == null ? "" : s);
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }
  function shortId(id) {
    var s = String(id == null ? "" : id);
    if (!s) return "—";
    return s.length > 8 ? s.slice(0, 8) : s;
  }
  function idChip(id) {
    var s = String(id == null ? "" : id);
    if (!s) return '<span class="muted">—</span>';
    return '<span class="mono" title="' + esc(s) + '">' + esc(shortId(s)) + '</span>';
  }
  function relTime(iso) {
    if (!iso) return "—";
    var t = Date.parse(iso);
    if (isNaN(t)) return String(iso);
    var d = Math.round((t - Date.now()) / 1000);
    var a = Math.abs(d);
    var n, u;
    if (a < 60) { n = a; u = "s"; }
    else if (a < 3600) { n = Math.round(a / 60); u = "m"; }
    else if (a < 86400) { n = Math.round(a / 3600); u = "h"; }
    else { n = Math.round(a / 86400); u = "d"; }
    return d >= 0 ? "in " + n + u : n + u + " ago";
  }
  function isFlat(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
    return Object.keys(obj).every(function (k) { var v = obj[k]; return v == null || typeof v !== "object"; });
  }
  function isRowArray(v) {
    return Array.isArray(v) && v.length > 0 && v.every(function (r) { return !!r && typeof r === "object" && !Array.isArray(r); });
  }
  function dataTable(rows, columns) {
    if (!Array.isArray(rows) || !rows.length) return "";
    var cols = columns ? columns.slice() : [];
    if (!columns) {
      rows.forEach(function (r) {
        if (r && typeof r === "object" && !Array.isArray(r)) {
          Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); });
        }
      });
    }
    var extraCols = cols.length > 12 ? cols.length - 12 : 0;
    cols = cols.slice(0, 12);
    var shown = rows.slice(0, 50);
    var html = '<table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join("") + '</tr></thead><tbody>';
    shown.forEach(function (r) {
      html += '<tr>' + cols.map(function (c) {
        var v = r && typeof r === "object" && !Array.isArray(r) ? r[c] : r;
        var cell = v != null && typeof v === "object" ? clamp(JSON.stringify(v), 80) : fmt(v);
        return '<td class="val">' + esc(cell) + '</td>';
      }).join("") + '</tr>';
    });
    html += '</tbody></table>';
    var more = [];
    if (rows.length > shown.length) more.push("+" + (rows.length - shown.length) + " more rows");
    if (extraCols) more.push("+" + extraCols + " more columns");
    if (more.length) html += '<div class="muted small" style="margin-top:6px">' + esc(more.join(" · ")) + '</div>';
    return html;
  }
  function kvTiles(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return "";
    var keys = Object.keys(obj);
    if (!keys.length) return "";
    return '<div class="grid">' + keys.map(function (k) {
      var v = obj[k];
      var text = v != null && typeof v === "object" ? clamp(JSON.stringify(v), 120) : fmt(v);
      return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="val">' + esc(text === "" ? "—" : text) + '</span></div>';
    }).join("") + '</div>';
  }
  function jsonTree(value, depth, budget) {
    depth = depth || 0;
    budget = budget || { n: 400 };
    if (budget.n-- <= 0) return '<span class="muted">…</span>';
    if (value == null || typeof value !== "object") return '<span class="val mono">' + esc(fmt(value)) + '</span>';
    if (depth >= 6) return '<span class="muted">' + esc(clamp(JSON.stringify(value), 80)) + '</span>';
    var isArr = Array.isArray(value);
    var keys = isArr ? value.map(function (_, i) { return String(i); }) : Object.keys(value);
    if (!keys.length) return '<span class="muted">' + (isArr ? "[]" : "{}") + '</span>';
    var inner = keys.map(function (k) {
      var v = value[k];
      var label = '<span class="k mono">' + esc(k) + '</span>';
      if (v == null || typeof v !== "object") {
        return '<div class="node">' + label + ' <span class="val mono">' + esc(fmt(v)) + '</span></div>';
      }
      var size = Array.isArray(v) ? "[" + v.length + "]" : "{" + Object.keys(v).length + "}";
      return '<details class="tree"' + (depth < 1 ? " open" : "") + '><summary>' + label + ' <span class="muted small">' + size + '</span></summary>' + jsonTree(v, depth + 1, budget) + '</details>';
    }).join("");
    return '<div class="tree-body">' + inner + '</div>';
  }
`

/**
 * Bootstrap JS injected into every widget. Reads the tool output from the
 * OpenAI Apps SDK channel (`window.openai.toolOutput`), re-renders on
 * `openai:set_globals`, and keeps the raw MCP-bridge postMessage as a
 * fallback. The widget's `render(payload)` is only called with a non-null
 * payload; until one arrives the initial "Waiting…" state stays.
 *
 * @internal
 */
const BOOTSTRAP_JS = `
  function payloadFromHost() {
    return (window.openai && window.openai.toolOutput) || null;
  }
  function renderFromHost() {
    var p = payloadFromHost();
    if (!p) return;
    try { render(p); } catch (e) { empty("Could not render this result."); }
  }
  renderFromHost();
  window.addEventListener("openai:set_globals", function (event) {
    var globals = event && event.detail && event.detail.globals;
    var output = globals && globals.toolOutput;
    if (output) { window.openai = window.openai || {}; window.openai.toolOutput = output; }
    renderFromHost();
  }, { passive: true });
  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || msg.jsonrpc !== "2.0") return;
    if (!msg || msg.method !== "ui/notifications/tool-result") return;
    var sc = msg.params && msg.params.structuredContent;
    if (sc) { window.openai = window.openai || {}; window.openai.toolOutput = sc; renderFromHost(); }
  });
`

/**
 * Assemble a complete, self-contained widget HTML document from a per-widget
 * title, extra CSS, and the body of its `render(payload)` function. The shared
 * base CSS, helpers, and the window.openai bootstrap are wrapped around it.
 *
 * @internal
 */
export function buildWidgetHtml(opts: { title: string; css?: string; renderBody: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${opts.title}</title>
<style>
${BASE_CSS}
${opts.css ?? ""}
</style>
</head>
<body>
<div id="root" class="root"><div class="empty">Waiting for result…</div></div>
<script>
(function () {
${HELPERS_JS}
  function render(payload) {
${opts.renderBody}
  }
${BOOTSTRAP_JS}
})();
</script>
</body>
</html>`
}

/**
 * Register a widget as an MCP resource with the shared widget `_meta`
 * (domain + CSP). Apps SDK clients discover widgets by listing resources with
 * the `text/html;profile=mcp-app` MIME type.
 *
 * @internal
 */
export function registerWidget(
  server: McpServer,
  opts: { name: string; uri: string; title: string; description: string; html: string },
): void {
  server.registerResource(
    opts.name,
    opts.uri,
    { title: opts.title, description: opts.description, mimeType: WIDGET_MIME },
    async () => ({
      contents: [
        {
          uri: opts.uri,
          mimeType: WIDGET_MIME,
          text: opts.html,
          _meta: widgetMeta(opts.description),
        },
      ],
    }),
  )
}
