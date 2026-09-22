import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_find_data`: the ranked matches behind a concept,
 * one section per retrieval plane — fields (with samples), values, documents
 * (best passage), passages — each with its score bar. Empty planes are
 * skipped; no matches at all shows a single empty state.
 *
 * @internal
 */
export function getFindDataWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var res = payload && payload.result && typeof payload.result === "object" ? payload.result : (payload && typeof payload === "object" ? payload : {});
    var fields = Array.isArray(res.fields) ? res.fields : [];
    var values = Array.isArray(res.values) ? res.values : [];
    var docs = Array.isArray(res.documents) ? res.documents : [];
    var passages = Array.isArray(res.passages) ? res.passages : [];
    var total = fields.length + values.length + docs.length + passages.length;
    var query = typeof res.query === "string" ? res.query : "";
    if (!total) { empty("Nothing in the workspace matches" + (query ? " “" + query + "”" : "") + "."); return; }
    function scoreBar(s) {
      if (typeof s !== "number") return "";
      var p = Math.max(0, Math.min(100, Math.round(s * 100)));
      return '<span class="bar"><span style="width:' + p + '%"></span></span> <span class="muted small">' + p + '%</span>';
    }
    function obj(x) { return x && typeof x === "object" ? x : {}; }
    function plane(label, items, renderItem) {
      if (!items.length) return "";
      return '<div class="plane"><div class="subtitle">' + esc(label) + ' (' + items.length + ')</div>' + items.map(function (i) { return renderItem(obj(i)); }).join("") + '</div>';
    }
    var fieldsHtml = plane("Fields", fields, function (f) {
      var samples = Array.isArray(f.samples) ? f.samples.slice(0, 3).map(function (s) {
        var v = s && typeof s === "object" && "value" in s ? s.value : s;
        return chip(clamp(fmt(v), 40), "");
      }).join("") : "";
      return '<div class="kv"><div><span class="val">' + esc(f.display_name || f.canonical_name || "(field)") + '</span> ' + chip(f.data_type, "")
        + (f.tier != null ? chip("tier " + f.tier, "") : "") + (f.match ? chip(f.match, "info") : "") + '</div>'
        + '<div class="small muted">' + (f.occurrence_count != null ? esc(f.occurrence_count) + ' occurrences · ' : "") + scoreBar(f.score) + '</div>'
        + (samples ? '<div>' + samples + '</div>' : "") + '</div>';
    });
    var valuesHtml = plane("Values", values, function (v) {
      return '<div class="kv"><span class="val mono">' + esc(clamp(fmt(v.value), 80)) + '</span><span class="small muted">' + esc(v.canonical_name || v.field_key || "")
        + (v.filename ? ' · ' + esc(v.filename) : "") + ' ' + scoreBar(v.score) + '</span></div>';
    });
    var docsHtml = plane("Documents", docs, function (d) {
      return '<div class="kv"><span class="val">' + esc(d.filename || shortId(d.document_id)) + '</span><span class="small muted">' + scoreBar(d.score) + '</span>'
        + (d.best_passage ? '<span class="small">' + esc(clamp(d.best_passage, 160)) + '</span>' : "") + '</div>';
    });
    var passagesHtml = plane("Passages", passages, function (p) {
      return '<div class="kv"><span class="small muted">' + esc(p.filename || shortId(p.document_id)) + ' ' + scoreBar(p.score) + '</span><span class="small">' + esc(clamp(p.text, 220)) + '</span></div>';
    });
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Data behind “' + esc(query || "your concept") + '”</div><div class="subtitle">' + total + (total === 1 ? ' match' : ' matches') + (res.semantic ? " · semantic + lexical" : "") + '</div></div></div>'
      + fieldsHtml + valuesHtml + docsHtml + passagesHtml;
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Find Data",
  renderBody: RENDER_BODY,
})
