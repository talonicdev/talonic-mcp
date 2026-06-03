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
 * domain (required for submission) and an empty Content Security Policy (the
 * widgets are fully self-contained — no external network, resources, or
 * frames). Both the modern `ui.*` keys and the `openai/*` aliases are emitted
 * for host compatibility.
 *
 * @internal
 */
export function widgetMeta(): Record<string, unknown> {
  return {
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
  }
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
  .root { padding: 16px; }
  .empty { color: var(--muted); padding: 24px; text-align: center; }
  .muted { color: var(--muted); }
  .small { font-size: 12px; }
  .header { display: flex; align-items: center; justify-content: space-between;
    gap: 12px; margin-bottom: 12px; }
  .title { font-weight: 600; }
  .subtitle { color: var(--muted); font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--border);
    vertical-align: top; font-size: 13px; }
  th { color: var(--muted); font-weight: 500; font-size: 12px; }
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
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-top: 8px; }
  .kv { display: flex; justify-content: space-between; gap: 12px;
    border-bottom: 1px solid var(--border); padding: 6px 0; }
  .kv .k { color: var(--muted); font-size: 12px; }
  pre.md { background: var(--chip); border: 1px solid var(--border); border-radius: 8px;
    padding: 12px; max-height: 360px; overflow: auto; white-space: pre-wrap;
    word-break: break-word; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px; }
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
    var msg = event.data;
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
          _meta: widgetMeta(),
        },
      ],
    }),
  )
}
