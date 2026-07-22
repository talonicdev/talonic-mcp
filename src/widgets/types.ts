/**
 * MIME type for Apps SDK widget resources. The `profile=mcp-app` parameter
 * tells the host this is a renderable widget, not arbitrary HTML.
 *
 * @public
 */
export const WIDGET_MIME = "text/html;profile=mcp-app"

/**
 * Back-compat alias. Prefer {@link WIDGET_MIME}.
 *
 * @public
 */
export const EXTRACTION_RESULT_WIDGET_MIME = WIDGET_MIME

/**
 * Widget resource URIs, one per tool that renders an inline card in ChatGPT.
 * A tool opts into its widget by declaring `_meta["openai/outputTemplate"]`
 * with the matching URI in its `registerTool` config.
 *
 * @public
 */
export const WIDGET_URIS = {
  extract: "ui://widget/extraction-result.html",
  search: "ui://widget/search-results.html",
  filter: "ui://widget/filter-results.html",
  getDocument: "ui://widget/document-meta.html",
  toMarkdown: "ui://widget/markdown-view.html",
  listSchemas: "ui://widget/schema-list.html",
  saveSchema: "ui://widget/schema-saved.html",
  getBalance: "ui://widget/balance.html",
  getPricing: "ui://widget/pricing.html",
  getUsage: "ui://widget/usage.html",
  requestUpload: "ui://widget/upload-link.html",
} as const

/**
 * Back-compat alias for the extraction-result widget URI. Prefer
 * {@link WIDGET_URIS}.extract.
 *
 * @public
 */
export const EXTRACTION_RESULT_WIDGET_URI = WIDGET_URIS.extract
