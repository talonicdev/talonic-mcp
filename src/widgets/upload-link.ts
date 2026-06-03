import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_request_upload`. Surfaces the browser upload link
 * as a prominent button, plus the pre-allocated document_id and expiry, with
 * a reminder that the agent must poll until the document is `completed`.
 *
 * @internal
 */
export function getUploadLinkWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var url = payload.upload_url || "";
    var docId = payload.document_id || "";
    var expires = payload.expires_at ? String(payload.expires_at).replace("T", " ").replace(/\\..*/, " UTC") : "—";

    root.innerHTML = ''
      + '<div class="header"><div class="title">Upload a document to Talonic</div></div>'
      + '<div class="muted small">Open this link in your browser and drop the file. It uploads directly to your workspace.</div>'
      + '<div class="actions">'
      + (url ? '<a class="btn primary" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Open upload link</a>' : '')
      + (url ? '<button id="copy-url">Copy link</button>' : '')
      + '</div>'
      + '<div class="grid">'
      + '  <div class="kv"><span class="k">Document ID</span><span class="val mono">' + esc(docId) + '</span></div>'
      + '  <div class="kv"><span class="k">Link expires</span><span class="val">' + esc(expires) + '</span></div>'
      + '</div>'
      + '<div class="muted small" style="margin-top:10px">After you upload, the assistant checks the document status until processing is complete before extracting.</div>';

    copyButton("copy-url", url);
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Upload Link",
  renderBody: RENDER_BODY,
})
