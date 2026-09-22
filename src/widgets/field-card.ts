import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_get_field`: the concept card of one Field
 * Registry field — name and maturity/tier chips, definition, synonyms,
 * occurrence and usage tiles, top values, and how the name was resolved.
 *
 * @internal
 */
export function getFieldCardWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    if (!payload || (!payload.canonical_name && !payload.id)) { empty("No field card."); return; }
    var def = payload.definition && typeof payload.definition === "object" ? payload.definition : {};
    var occ = payload.occurrence && typeof payload.occurrence === "object" ? payload.occurrence : {};
    var vals = payload.values && typeof payload.values === "object" ? payload.values : {};
    var usage = payload.usage && typeof payload.usage === "object" ? payload.usage : {};
    var ident = payload.identity && typeof payload.identity === "object" ? payload.identity : {};
    var res = payload.resolution && typeof payload.resolution === "object" ? payload.resolution : null;
    function maturityTone(m) { return m === "core" ? "good" : m === "proven" ? "info" : m === "candidate" ? "warn" : ""; }
    var name = payload.display_name || payload.canonical_name || payload.id;
    var definition = def.description || payload.description || def.instruction || payload.master_instruction || "";
    var synonymList = Array.isArray(def.synonyms) ? def.synonyms : Array.isArray(payload.synonyms) ? payload.synonyms : [];
    var synonyms = synonymList.slice(0, 12).map(function (s) { return chip(s, ""); }).join("");
    var top = Array.isArray(vals.top) ? vals.top.slice(0, 8) : [];
    var topHtml = top.map(function (t) {
      t = t && typeof t === "object" ? t : {};
      var share = typeof t.share === "number" ? Math.round(t.share * 100) : null;
      return '<tr><td class="val mono">' + esc(clamp(fmt(t.value), 60)) + '</td><td class="val num">' + esc(t.count != null ? t.count : "") + '</td><td>'
        + (share == null ? "" : '<span class="bar"><span style="width:' + share + '%"></span></span> <span class="muted small">' + share + '%</span>') + '</td></tr>';
    }).join("");
    var rate = typeof occ.occurrence_rate === "number" ? (Math.round(occ.occurrence_rate * 1000) / 10) + "%" : "—";
    var redirected = res && Array.isArray(res.redirected_from) && res.redirected_from.length ? res.redirected_from.join(", ") : "";
    var occCount = occ.occurrence_count != null ? occ.occurrence_count : payload.occurrence_count != null ? payload.occurrence_count : "—";
    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + esc(name) + '</div>'
      + (payload.canonical_name && payload.canonical_name !== name ? '<div class="subtitle mono">' + esc(payload.canonical_name) + '</div>' : "") + '</div>'
      + '<div>' + chip(payload.data_type, "") + chip(payload.maturity, maturityTone(payload.maturity))
      + (payload.tier != null ? chip("tier " + payload.tier, "") : "")
      + (ident.superseded_by || payload.superseded_by ? chip("superseded", "bad") : "")
      + (ident.link_key ? chip("link key", "info") : "") + '</div></div>'
      + (definition ? '<div class="small" style="white-space:pre-wrap">' + esc(clamp(definition, 600)) + '</div>' : '<div class="muted small">No definition recorded.</div>')
      + (synonyms ? '<div style="margin-top:8px"><div class="muted small">Also known as</div><div>' + synonyms + '</div></div>' : "")
      + '<div class="grid">'
      + '<div class="kv"><span class="k">Occurrences</span><span class="val">' + esc(occCount) + '</span></div>'
      + '<div class="kv"><span class="k">Documents</span><span class="val">' + esc(occ.document_count != null ? occ.document_count : "—") + '</span></div>'
      + '<div class="kv"><span class="k">Occurrence rate</span><span class="val">' + esc(rate) + '</span></div>'
      + '<div class="kv"><span class="k">Distinct values</span><span class="val">' + esc(vals.distinct_count != null ? vals.distinct_count : "—") + '</span></div>'
      + '<div class="kv"><span class="k">Used in schemas</span><span class="val">' + esc(usage.schema_count != null ? usage.schema_count : "—") + '</span></div>'
      + '<div class="kv"><span class="k">Last seen</span><span class="val">' + esc(occ.last_seen_at ? relTime(occ.last_seen_at) : "—") + '</span></div>'
      + '</div>'
      + (topHtml ? '<div class="plane"><div class="subtitle">Top values</div><table><thead><tr><th>Value</th><th class="num">Count</th><th>Share</th></tr></thead><tbody>' + topHtml + '</tbody></table></div>' : "")
      + (res ? '<div class="muted small" style="margin-top:10px">Resolved by ' + esc(res.matched_by || "id") + (redirected ? ' · redirected from ' + esc(redirected) : "") + '</div>' : "");
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Field Card",
  renderBody: RENDER_BODY,
})
