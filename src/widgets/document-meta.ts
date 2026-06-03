import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_get_document`. Shows document metadata, processing
 * status, extraction count, and any triage flags (sensitivity, PII, etc.).
 *
 * @internal
 */
export function getDocumentMetaWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var meta = [
      payload.pages ? payload.pages + (payload.pages === 1 ? " page" : " pages") : "",
      payload.type_detected ? esc(payload.type_detected) : "",
      payload.language_detected ? esc(payload.language_detected) : "",
      typeof payload.size_bytes === "number" ? Math.round(payload.size_bytes / 1024) + " KB" : "",
    ].filter(Boolean).join(" · ");

    var triage = payload.triage || {};
    var flags = [];
    if (triage.sensitivity) flags.push("Sensitivity: " + esc(triage.sensitivity));
    if (triage.pii_detected) flags.push("PII detected");
    if (triage.regulated_data) flags.push("Regulated data");
    if (triage.jurisdiction) flags.push("Jurisdiction: " + esc(triage.jurisdiction));
    var chips = flags.map(function (f) { return '<span class="chip">' + f + '</span>'; }).join("");

    root.innerHTML = ''
      + '<div class="header"><div><div class="title">' + esc(payload.filename || "Document") + '</div>'
      + '<div class="subtitle">' + meta + '</div></div>'
      + (payload.status ? '<span class="chip">' + esc(payload.status) + '</span>' : '') + '</div>'
      + '<div class="grid">'
      + '  <div class="kv"><span class="k">Document ID</span><span class="val mono">' + esc(payload.id || "") + '</span></div>'
      + '  <div class="kv"><span class="k">Extractions</span><span class="val">' + esc(fmt(payload.extraction_count != null ? payload.extraction_count : 0)) + '</span></div>'
      + '</div>'
      + (chips ? '<div style="margin-top:10px">' + chips + '</div>' : '');
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Document",
  renderBody: RENDER_BODY,
})
