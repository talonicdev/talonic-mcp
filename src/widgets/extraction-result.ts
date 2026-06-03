import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_extract`. Shows document metadata, the extracted
 * data as a field/value table with per-field confidence bars, an overall
 * confidence indicator, and copy/download-JSON controls.
 *
 * Reads `window.openai.toolOutput` (the tool's structuredContent: `document`,
 * `data`, `confidence`). Render-only; no secrets.
 *
 * @internal
 */
export function getExtractionResultWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var doc = payload.document || {};
    var data = payload.data || {};
    var conf = payload.confidence || {};
    var overall = typeof conf.overall === "number" ? conf.overall : null;
    var fields = conf.fields || {};

    var rows = Object.keys(data).map(function (k) {
      return '<tr>'
        + '<td class="mono muted">' + esc(k) + '</td>'
        + '<td class="val">' + esc(fmt(data[k])) + '</td>'
        + '<td>' + confBar(fields[k]) + '</td>'
        + '</tr>';
    }).join("");

    var meta = [
      doc.pages ? doc.pages + (doc.pages === 1 ? " page" : " pages") : "",
      doc.type_detected ? esc(doc.type_detected) : "",
      doc.language_detected ? esc(doc.language_detected) : "",
    ].filter(Boolean).join(" · ");

    root.innerHTML = ''
      + '<div class="header">'
      + '  <div><div class="title">' + esc(doc.filename || "Document") + '</div>'
      + '    <div class="subtitle">' + meta + '</div></div>'
      + (overall === null ? "" : '<div class="subtitle">Overall ' + confBar(overall) + '</div>')
      + '</div>'
      + '<table><thead><tr><th>Field</th><th>Value</th><th>Confidence</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="3" class="empty">No fields extracted.</td></tr>')
      + '</tbody></table>'
      + '<div class="actions">'
      + '  <button id="copy-json">Copy JSON</button>'
      + '  <button id="download-json">Download JSON</button>'
      + '</div>';

    var json = JSON.stringify(data, null, 2);
    copyButton("copy-json", json);
    var dl = document.getElementById("download-json");
    if (dl) dl.addEventListener("click", function () {
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = (doc.filename || "extraction") + ".json"; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Extraction Result",
  renderBody: RENDER_BODY,
})
