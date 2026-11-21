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
    // No `ui.domain`: Claude validates it against
    // `{sha256(connector URL)[:32]}.claudemcpcontent.com` and refuses to
    // render the card on a mismatch. mcp.talonic.com is reachable as `/`,
    // `/mcp` and with trailing slashes, each hashing differently, so any
    // fixed value breaks some installs. Omitting it gives the host's default
    // sandbox origin. ChatGPT keeps its own `openai/widgetDomain` below.
    ui: {
      prefersBorder: true,
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
  /* Ink tokens (platform ink/restructure, src/app/globals.css --void-*). */
  :root {
    --bg: #FFFFFF; --fg: #1B1B1F; --muted: #5B5B64; --faint: #6A6A71;
    --border: rgba(20, 20, 30, 0.12); --divider: rgba(20, 20, 30, 0.07);
    --accent: #512DA8; --accent-dim: rgba(81, 45, 168, 0.07); --accent-tint: #EEE8F8;
    --good: #1F9D5B; --warn: #B97E14; --bad: #C94343;
    --chip: #F5F5F3; --surface-2: #F5F5F3;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #101013; --fg: #EDEDEF; --muted: #A2A2AB; --faint: #86868E;
      --border: rgba(255, 255, 255, 0.08); --divider: rgba(255, 255, 255, 0.06);
      --accent: #C9B6F5; --accent-dim: rgba(201, 182, 245, 0.10); --accent-tint: #2A1F3D;
      --good: #5BC98B; --warn: #E8B45A; --bad: #E36D6D;
      --chip: #1A1A1F; --surface-2: #16161A;
    }
  }
  :root[data-theme="dark"] {
    --bg: #101013; --fg: #EDEDEF; --muted: #A2A2AB; --faint: #86868E;
    --border: rgba(255, 255, 255, 0.08); --divider: rgba(255, 255, 255, 0.06);
    --accent: #C9B6F5; --accent-dim: rgba(201, 182, 245, 0.10); --accent-tint: #2A1F3D;
    --good: #5BC98B; --warn: #E8B45A; --bad: #E36D6D;
    --chip: #1A1A1F; --surface-2: #16161A;
  }
  :root[data-host="mcp-apps"] { --bg: transparent; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg);
    font: 14px/1.55 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased; }
  .root { padding: 20px; box-sizing: border-box; }
  * { box-sizing: border-box; }
  .empty { color: var(--muted); padding: 28px; text-align: center; }
  .muted { color: var(--muted); }
  .small { font-size: 12px; }
  .header { display: flex; align-items: flex-start; justify-content: space-between;
    gap: 12px; margin-bottom: 16px; }
  .title { font-weight: 600; font-size: 15px; letter-spacing: -0.01em; }
  .subtitle { color: var(--faint); font-size: 12px; }
  .eyebrow { color: var(--faint); font-size: 12px; font-weight: 500; margin-bottom: 2px; }
  .prose { font-size: 14.5px; line-height: 1.6; color: var(--fg); }
  .prose p { margin: 0 0 10px; }
  .prose p:last-child, .prose ul:last-child, .prose ol:last-child { margin-bottom: 0; }
  .prose ul, .prose ol { margin: 0 0 10px; padding-left: 20px; }
  .prose li { margin: 3px 0; }
  .prose h3, .prose h4 { font-size: 14.5px; font-weight: 600; margin: 14px 0 6px; }
  .prose code { font: 12.5px ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--chip);
    border: 1px solid var(--divider); border-radius: 4px; padding: 0 4px; }
  .prose strong { font-weight: 600; }
  .prose a { color: var(--accent); text-decoration: none; }
  .prose a:hover { text-decoration: underline; }
  .prose table { margin: 6px 0 12px; }
  .section { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--divider); }
  .section-label { color: var(--faint); font-size: 12px; font-weight: 500; margin-bottom: 8px; }
  .meta { color: var(--faint); font-size: 12px; margin-top: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--divider);
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
  a.btn.primary { background: var(--accent); color: var(--bg); border-color: var(--accent); }
  :root[data-host="mcp-apps"] a.btn.primary { color: #fff; }
  @media (prefers-color-scheme: dark) { :root[data-host="mcp-apps"]:not([data-theme="light"]) a.btn.primary { color: #17102A; } }
  :root[data-host="mcp-apps"][data-theme="dark"] a.btn.primary { color: #17102A; }
  .chip { display: inline-block; background: var(--chip); border-radius: 6px; color: var(--muted);
    padding: 1px 7px; font-size: 12px; font-weight: 500; margin: 2px 4px 2px 0; }
  .big { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px; margin-top: 14px; }
  /* Stat tile: label stacked above value, padded, never crowding an edge. */
  .kv { display: flex; flex-direction: column; gap: 3px;
    background: var(--surface-2); border: 1px solid var(--divider); border-radius: 10px;
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
  .chip.info { background: var(--accent-dim); color: var(--accent); }
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
  .loading { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px; color: var(--muted); }
  .tl-mark { color: var(--accent); }
  .tl-mark g, .tl-mark circle { transform-box: view-box; transform-origin: 0 0; }
  .tl-layer { fill: none; stroke: currentColor; stroke-width: 20; stroke-linecap: round; }
  .tl-spin { animation: tl-spin 4s infinite; }
  .tl-core { animation: tl-core 4s infinite; }
  .tl-arm { animation: tl-arm 4s infinite; animation-delay: calc(4s * var(--i) * -0.0075); }
  @keyframes tl-spin {
    0% { transform: rotate(0deg); animation-timing-function: cubic-bezier(.55, 0, .9, .45); }
    42% { transform: rotate(560deg); animation-timing-function: linear; }
    58% { transform: rotate(860deg); animation-timing-function: cubic-bezier(.1, .6, .25, 1); }
    100% { transform: rotate(1080deg); }
  }
  @keyframes tl-arm {
    0%, 24% { transform: scale(1); animation-timing-function: cubic-bezier(.6, 0, .85, .3); }
    48% { transform: scale(.06); animation-timing-function: linear; }
    60% { transform: scale(.06); animation-timing-function: cubic-bezier(.2, 1.5, .35, 1); }
    84%, 100% { transform: scale(1); }
  }
  @keyframes tl-core {
    0%, 28% { transform: scale(1); animation-timing-function: cubic-bezier(.6, 0, .85, .3); }
    48% { transform: scale(.5); animation-timing-function: ease-in-out; }
    58% { transform: scale(.44); animation-timing-function: cubic-bezier(.2, 1.6, .4, 1); }
    74% { transform: scale(1.1); animation-timing-function: ease-in-out; }
    88%, 100% { transform: scale(1); }
  }
  @media (prefers-reduced-motion: reduce) { .tl-spin, .tl-core, .tl-arm { animation: none; } }
`

/**
 * Helper JS injected into every widget. Defines `root` and a set of small
 * render utilities. The widget's own `render(payload)` body uses these.
 *
 * @internal
 */
/**
 * Escape-first markdown renderer injected into every widget (the answer card
 * uses it). Kept in String.raw so its regexes keep their backslashes; backticks
 * are written as \x60 because they cannot appear in a template literal.
 *
 * @internal
 */
const MD_JS = String.raw`
  // Minimal, escape-first markdown: paragraphs, - / 1. lists, ### headings,
  // **bold**, *em*, code spans, https links, pipe tables. Input is escaped before
  // any markup is added, so model text can never inject HTML.
  function mdInline(t) {
    return esc(t)
      .replace(/\x60([^\x60]+)\x60/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  function md(text) {
    var lines = String(text == null ? "" : text).replace(/\r/g, "").split("\n");
    var out = [], para = [], list = null, i = 0;
    function flushPara() { if (para.length) { out.push("<p>" + para.map(mdInline).join("<br>") + "</p>"); para = []; } }
    function flushList() { if (list) { out.push("<" + list.tag + ">" + list.items.map(function (x) { return "<li>" + mdInline(x) + "</li>"; }).join("") + "</" + list.tag + ">"); list = null; } }
    for (; i < lines.length; i++) {
      var l = lines[i], m;
      if (/^\s*$/.test(l)) { flushPara(); flushList(); continue; }
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flushPara(); flushList();
        var cells = function (row) { return row.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); };
        var head = cells(l); i += 2; var rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        i--;
        out.push("<table><thead><tr>" + head.map(function (h) { return "<th>" + mdInline(h) + "</th>"; }).join("") + "</tr></thead><tbody>"
          + rows.slice(0, 50).map(function (r) { return "<tr>" + r.map(function (c) { return '<td class="val">' + mdInline(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>");
        continue;
      }
      if ((m = /^\s*#{1,6}\s+(.*)$/.exec(l))) { flushPara(); flushList(); out.push("<h3>" + mdInline(m[1]) + "</h3>"); continue; }
      if ((m = /^\s*[-*•]\s+(.*)$/.exec(l))) { flushPara(); if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; } list.items.push(m[1]); continue; }
      if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(l))) { flushPara(); if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; } list.items.push(m[1]); continue; }
      if (list) { list.items[list.items.length - 1] += " " + l.trim(); continue; }
      para.push(l.trim());
    }
    flushPara(); flushList();
    return out.join("");
  }
`

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
${MD_JS}
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
  var lastPayload = null;
  function show(p) {
    if (!p) return;
    lastPayload = p;
    try { render(p); } catch (e) { empty("Could not render this result."); }
    reportSize();
  }

  // ── ChatGPT Apps SDK channel ──
  function renderFromOpenAI() {
    var p = window.openai && window.openai.toolOutput;
    if (p && p !== lastPayload) show(p);
  }
  renderFromOpenAI();
  window.addEventListener("openai:set_globals", function (event) {
    var globals = event && event.detail && event.detail.globals;
    var output = globals && globals.toolOutput;
    if (output) { window.openai = window.openai || {}; window.openai.toolOutput = output; }
    renderFromOpenAI();
  }, { passive: true });

  // ── MCP Apps channel (Claude, and any spec host) ──
  // The host sends nothing until the view has sent ui/initialize and then
  // ui/notifications/initialized. After that it delivers tool-input and
  // tool-result, and expects size-changed for the iframe height.
  var hasParent = window.parent && window.parent !== window;
  var initId = "talonic-init-" + Math.random().toString(36).slice(2);
  var initialized = false;
  var lastHeight = -1;
  function post(msg) { if (hasParent) window.parent.postMessage(msg, "*"); }
  function applyHostContext(ctx) {
    if (!ctx || typeof ctx !== "object") return;
    var el = document.documentElement;
    if (ctx.theme === "dark" || ctx.theme === "light") {
      el.setAttribute("data-theme", ctx.theme);
      el.style.colorScheme = ctx.theme;
    }
  }
  function reportSize() {
    if (!initialized) return;
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (h === lastHeight) return;
    lastHeight = h;
    var w = Math.ceil(document.documentElement.getBoundingClientRect().width);
    post({ jsonrpc: "2.0", method: "ui/notifications/size-changed", params: { width: w, height: h } });
  }
  function payloadFromToolResult(params) {
    if (!params) return null;
    if (params.structuredContent && typeof params.structuredContent === "object") return params.structuredContent;
    var c = params.content;
    if (Array.isArray(c)) {
      for (var i = 0; i < c.length; i++) {
        if (c[i] && c[i].type === "text") {
          try { var v = JSON.parse(c[i].text); if (v && typeof v === "object") return v; } catch (e) {}
        }
      }
    }
    return null;
  }
  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || msg.jsonrpc !== "2.0") return;
    if (msg.id === initId && !msg.method) {
      if (msg.result) applyHostContext(msg.result.hostContext);
      if (!initialized) {
        initialized = true;
        document.documentElement.setAttribute("data-host", "mcp-apps");
        post({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} });
        reportSize();
      }
      return;
    }
    if (msg.method === "ui/notifications/tool-result") {
      if (msg.params && msg.params.isError) {
        var t = Array.isArray(msg.params.content) && msg.params.content[0] && msg.params.content[0].text;
        empty(t ? String(t).slice(0, 300) : "The tool returned an error.");
        reportSize();
        return;
      }
      show(payloadFromToolResult(msg.params));
      return;
    }
    if (msg.method === "ui/notifications/tool-cancelled") { empty("Cancelled."); reportSize(); return; }
    if (msg.method === "ui/notifications/host-context-changed") { applyHostContext(msg.params); return; }
    if (msg.method && msg.id != null) {
      // Host request (ui/resource-teardown, ping, …): acknowledge.
      post({ jsonrpc: "2.0", id: msg.id, result: {} });
    }
  });
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(function () { reportSize(); }).observe(document.documentElement);
  }
  if (hasParent && !(window.openai && window.openai.toolOutput)) {
    post({
      jsonrpc: "2.0",
      id: initId,
      method: "ui/initialize",
      params: {
        protocolVersion: "2026-01-26",
        appInfo: { name: document.title || "talonic-widget", version: "1" },
        appCapabilities: {},
      },
    });
  }
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
    <meta name="color-scheme" content="light dark" />
<title>${opts.title}</title>
<style>
${BASE_CSS}
${opts.css ?? ""}
</style>
</head>
<body>
<div id="root" class="root"><div class="loading" role="status"><svg class="tl-mark" viewBox="-200 -200 400 400" width="36" height="36" aria-hidden="true" focusable="false"><g class="tl-layer"><g class="tl-spin"><circle class="tl-core" r="65.5" stroke-width="21"/><g transform="rotate(0)"><g class="tl-arm" style="--i:0"><path d="M-15 -66C-36 -90 -30 -118 4 -133"/><circle cy="-155" r="22"/></g></g><g transform="rotate(45)"><g class="tl-arm" style="--i:1"><path d="M-15 -66C-36 -90 -30 -118 4 -133"/><circle cy="-155" r="22"/></g></g><g transform="rotate(90)"><g class="tl-arm" style="--i:2"><path d="M-15 -66C-36 -90 -30 -118 4 -133"/><circle cy="-155" r="22"/></g></g><g transform="rotate(135)"><g class="tl-arm" style="--i:3"><path d="M-15 -66C-36 -90 -30 -118 4 -133"/><circle cy="-155" r="22"/></g></g><g transform="rotate(180)"><g class="tl-arm" style="--i:4"><path d="M-15 -66C-36 -90 -30 -118 4 -133"/><circle cy="-155" r="22"/></g></g><g transform="rotate(225)"><g class="tl-arm" style="--i:5"><path d="M-15 -66C-36 -90 -30 -118 4 -133"/><circle cy="-155" r="22"/></g></g><g transform="rotate(270)"><g class="tl-arm" style="--i:6"><path d="M-15 -66C-36 -90 -30 -118 4 -133"/><circle cy="-155" r="22"/></g></g><g transform="rotate(315)"><g class="tl-arm" style="--i:7"><path d="M-15 -66C-36 -90 -30 -118 4 -133"/><circle cy="-155" r="22"/></g></g></g></g></svg><span>Loading…</span></div></div>
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
