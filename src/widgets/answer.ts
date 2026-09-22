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
  .cite { display: flex; flex-direction: column; gap: 2px; padding: 8px 0; border-bottom: 1px solid var(--border); }
  .cite:last-child { border-bottom: none; }
  pre.md.answer { max-height: 480px; font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; }
`

const ANSWER_BODY = `
    if (!payload || typeof payload !== "object" || !payload.ask_id) { empty("No answer."); return; }
    var status = typeof payload.status === "string" ? payload.status : "processing";
    function obj(x) { return x && typeof x === "object" ? x : {}; }
    var ver = obj(payload.verification);
    var usage = obj(payload.usage);
    var cites = Array.isArray(payload.citations) ? payload.citations : [];
    var arts = Array.isArray(payload.artifacts) ? payload.artifacts : [];
    var verdictTone = ver.verdict === "supported" ? "good" : ver.verdict === "issues" ? "warn" : ver.verdict === "unverifiable" ? "bad" : "";
    var head = '<div class="header"><div><div class="title">' + HEADLINE + '</div><div class="subtitle">ask ' + idChip(payload.ask_id) + (payload.conversation_id ? ' · conversation ' + idChip(payload.conversation_id) : "") + '</div></div>'
      + '<div>' + (status === "completed" ? chip(ver.verdict, verdictTone) : chip(status, status === "error" ? "bad" : "info")) + '</div></div>';
    if (status === "processing") {
      root.innerHTML = head + '<div class="small">Still thinking… call talonic_get_answer with ask_id ' + idChip(payload.ask_id) + ' in a few seconds.</div>';
      return;
    }
    var answer = typeof payload.answer === "string" ? payload.answer : (payload.answer == null ? "" : fmt(payload.answer));
    var citeHtml = cites.length ? '<div class="plane"><div class="subtitle">Citations (' + cites.length + ')</div>' + cites.slice(0, 20).map(function (c, i) {
      c = obj(c);
      return '<div class="cite"><span class="small">[' + (i + 1) + '] “' + esc(clamp(c.quote || fmt(c), 200)) + '”</span><span class="muted small">' + chip(c.kind, c.kind === "field" ? "info" : "") + esc(c.filename || shortId(c.document_id)) + (c.reference ? ' · ' + esc(c.reference) : "") + '</span></div>';
    }).join("") + '</div>' : "";
    var artHtml = arts.length ? '<div class="plane"><div class="subtitle">Artifacts (' + arts.length + ')</div>' + arts.slice(0, 10).map(function (a) {
      a = obj(a);
      var link = typeof a.link === "string" && /^https:\\/\\//.test(a.link) ? a.link : "";
      return '<div class="kv"><span class="val">' + esc(a.label || a.type || a.id || "artifact") + '</span>' + (link ? '<a class="btn small" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Open</a>' : "") + '</div>';
    }).join("") + '</div>' : "";
    var tiles = [];
    if (typeof usage.credits_charged === "number") tiles.push(usage.credits_charged + " credits");
    if (typeof usage.tokens === "number") tiles.push(usage.tokens + " tokens");
    if (typeof payload.tool_calls === "number") tiles.push(payload.tool_calls + " tool call" + (payload.tool_calls === 1 ? "" : "s"));
    if (typeof payload.waited_ms === "number") tiles.push((payload.waited_ms / 1000).toFixed(1) + " s");
    if (typeof ver.checks_total === "number") tiles.push(ver.checks_total + " checks, " + (ver.checks_unsupported || 0) + " unsupported");
    root.innerHTML = head
      + (answer ? '<pre class="md answer">' + esc(answer) + '</pre>' : '<div class="muted small">The agent returned no answer text.</div>')
      + (ver.correction ? '<div class="small" style="margin-top:6px"><span class="muted">Correction:</span> ' + esc(ver.correction) + '</div>' : "")
      + citeHtml + artHtml
      + (tiles.length ? '<div class="muted small" style="margin-top:10px">' + esc(tiles.join(" · ")) + '</div>' : "");
`

function answerWidget(headline: string, title: string): string {
  return buildWidgetHtml({
    title,
    css: CSS,
    renderBody: "    var HEADLINE = " + JSON.stringify(headline) + ";\n" + ANSWER_BODY,
  })
}

const ANSWER_HTML = answerWidget("Answer", "Talonic — Answer")
const POLLED_HTML = answerWidget("Answer (polled)", "Talonic — Answer (polled)")
