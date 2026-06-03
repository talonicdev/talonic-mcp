import { buildWidgetHtml } from "./shared.js"

/**
 * Inline card for `talonic_to_markdown`. Shows the OCR-converted markdown in
 * a scrollable block with a copy button.
 *
 * @internal
 */
export function getMarkdownViewWidgetHtml(): string {
  return WIDGET_HTML
}

const RENDER_BODY = `
    var md = typeof payload.markdown === "string" ? payload.markdown : "";
    var docId = payload.document_id || "";

    root.innerHTML = ''
      + '<div class="header"><div><div class="title">Document markdown</div>'
      + (docId ? '<div class="subtitle mono">' + esc(docId) + '</div>' : '') + '</div>'
      + '<button id="copy-md">Copy markdown</button></div>'
      + '<pre class="md">' + esc(md || "(no text content)") + '</pre>';

    copyButton("copy-md", md);
`

const WIDGET_HTML = buildWidgetHtml({
  title: "Talonic — Markdown",
  renderBody: RENDER_BODY,
})
