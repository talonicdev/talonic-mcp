import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_search`. Groups matches by entity type (documents,
 * fields, schemas, sources). Field entries show their data type and whether
 * they are filterable.
 *
 * @internal
 */
export function getSearchResultsWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var documents = Array.isArray(payload.documents) ? payload.documents : [];
    var sources = Array.isArray(payload.sources) ? payload.sources : [];
    var schemas = Array.isArray(payload.schemas) ? payload.schemas : [];
    // Field matches come back under fieldMatches and/or fields; merge for display.
    var fields = []
      .concat(Array.isArray(payload.fieldMatches) ? payload.fieldMatches : [])
      .concat(Array.isArray(payload.fields) ? payload.fields : []);

    function section(label, count, bodyHtml) {
      if (!count) return "";
      return '<div style="margin-top:12px"><div class="subtitle">' + esc(label) + ' (' + count + ')</div>' + bodyHtml + '</div>';
    }

    var docHtml = documents.map(function (d) {
      return '<div class="kv"><span class="val">' + esc(d.name || d.id) + '</span>'
        + '<span class="k">' + esc(d.sourceName || "") + '</span></div>';
    }).join("");

    var fieldHtml = fields.map(function (f) {
      var name = f.displayName || f.canonicalName || f.matchedValue || f.resolvedFieldId || f.id || "(field)";
      var type = f.dataType ? '<span class="chip">' + esc(f.dataType) + '</span>' : "";
      var filt = f.filterable ? '<span class="chip">filterable</span>' : "";
      return '<div class="kv"><span class="val">' + esc(name) + '</span><span>' + type + filt + '</span></div>';
    }).join("");

    var schemaHtml = schemas.map(function (s) {
      return '<div class="kv"><span class="val">' + esc(s.name || s.id) + '</span></div>';
    }).join("");

    var sourceHtml = sources.map(function (s) {
      return '<div class="kv"><span class="val">' + esc(s.name || s.id) + '</span></div>';
    }).join("");

    var total = documents.length + fields.length + schemas.length + sources.length;
    if (!total) { empty("No matches found."); return; }

    root.innerHTML = ''
      + '<div class="header"><div class="title">Search results</div><span class="chip">' + total + '</span></div>'
      + section("Documents", documents.length, docHtml)
      + section("Fields", fields.length, fieldHtml)
      + section("Schemas", schemas.length, schemaHtml)
      + section("Sources", sources.length, sourceHtml);
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Search",
  renderBody: RENDER_BODY,
})
