import { buildWidgetHtml } from "./shared.js"

/**
 * Cited-answer card shared by `talonic_ask` ("Answer") and `talonic_get_answer`
 * ("Answer (polled)"): verification verdict, the answer text (markdown kept
 * literal — no external renderer under the empty CSP), citations with kind
 * chips, artifacts, usage tiles; or the still-processing notice.
 *
 * @internal
 */
export function getAnswerWidgetHtml(): string {
  return ANSWER_HTML
}

/** @internal */
export function getAnswerPolledWidgetHtml(): string {
  return POLLED_HTML
}

const CSS = `
  .cites { list-style: none; padding: 0; margin: 0; counter-reset: c; display: grid; gap: 10px; }
  .cites li { counter-increment: c; display: grid; grid-template-columns: 22px 1fr; gap: 0 6px; font-size: 13px; }
  .cites li::before { content: counter(c); color: var(--accent); font-weight: 600; font-variant-numeric: tabular-nums; }
  .cites .q { color: var(--fg); }
  .cites .src { grid-column: 2; color: var(--faint); font-size: 12px; margin-top: 2px; }
  .correction { margin-top: 14px; padding: 10px 12px; border-radius: 8px; background: var(--accent-dim); font-size: 13px; }
  .thinking { display: flex; align-items: center; gap: 10px; color: var(--muted); }
`

const ANSWER_BODY = `
    if (!payload || typeof payload !== "object" || !payload.ask_id) { empty("No answer."); return; }
    var status = typeof payload.status === "string" ? payload.status : "processing";
    function obj(x) { return x && typeof x === "object" ? x : {}; }
    var ver = obj(payload.verification);
    var usage = obj(payload.usage);
    var cites = Array.isArray(payload.citations) ? payload.citations : [];
    var arts = Array.isArray(payload.artifacts) ? payload.artifacts : [];
    var verdict = { supported: ["Verified", "good"], issues: ["Has issues", "warn"], unverifiable: ["Unverified", "bad"] }[ver.verdict];
    var ids = "ask " + payload.ask_id + (payload.conversation_id ? " · conversation " + payload.conversation_id : "");
    var head = '<div class="header"><div class="title" title="' + esc(ids) + '">' + HEADLINE + '</div>'
      + '<div>' + (status === "completed" ? (verdict ? chip(verdict[0], verdict[1]) : "") : status === "error" ? chip("Error", "bad") : "") + '</div></div>';
    if (status === "processing") {
      root.innerHTML = head + '<div class="thinking">Still working on it. The answer appears here in a few seconds.</div>';
      return;
    }
    var answer = typeof payload.answer === "string" ? payload.answer : (payload.answer == null ? "" : fmt(payload.answer));
    var citeHtml = cites.length ? '<div class="section"><div class="section-label">Sources</div><ol class="cites">' + cites.slice(0, 12).map(function (c) {
      c = obj(c);
      var where = esc(c.filename || shortId(c.document_id)) + (c.reference ? ' · ' + esc(c.reference) : "");
      var link = typeof c.app_url === "string" && /^https:\\/\\//.test(c.app_url) ? c.app_url : "";
      return '<li><span class="q">' + (c.quote ? "“" + esc(clamp(c.quote, 220)) + "”" : where) + '</span>'
        + '<span class="src">' + (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer" style="color:inherit">' + where + '</a>' : where) + '</span></li>';
    }).join("") + '</ol>' + (cites.length > 12 ? '<div class="meta">+' + (cites.length - 12) + ' more sources</div>' : "") + '</div>' : "";
    var artHtml = arts.length ? '<div class="section"><div class="section-label">Files</div>' + arts.slice(0, 10).map(function (a) {
      a = obj(a);
      var link = typeof a.link === "string" && /^https:\\/\\//.test(a.link) ? a.link : "";
      return link ? '<a class="btn" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer" style="margin:0 6px 6px 0">' + esc(a.label || a.type || "Open file") + '</a>' : '<span class="chip">' + esc(a.label || a.type || "file") + '</span>';
    }).join("") + '</div>' : "";
    var meta = [];
    if (typeof usage.credits_charged === "number") meta.push(usage.credits_charged + " credits");
    if (typeof payload.tool_calls === "number") meta.push(payload.tool_calls + (payload.tool_calls === 1 ? " query" : " queries"));
    if (typeof payload.waited_ms === "number") meta.push((payload.waited_ms / 1000).toFixed(1) + " s");
    root.innerHTML = head
      + (answer ? '<div class="prose">' + md(answer) + '</div>' : '<div class="muted small">No answer text came back.</div>')
      + (ver.correction ? '<div class="correction"><strong>Correction.</strong> ' + esc(ver.correction) + '</div>' : "")
      + citeHtml + artHtml
      + (meta.length ? '<div class="meta">' + esc(meta.join(" · ")) + '</div>' : "");
`

function answerWidget(headline: string, title: string): string {
  return buildWidgetHtml({
    title,
    css: CSS,
    renderBody: "    var HEADLINE = " + JSON.stringify(headline) + ";\n" + ANSWER_BODY,
  })
}

const ANSWER_HTML = answerWidget("Answer", "Talonic — Answer")
const POLLED_HTML = answerWidget("Answer", "Talonic — Answer")
