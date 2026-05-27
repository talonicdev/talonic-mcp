/**
 * URI for the extraction-result widget resource.
 *
 * ChatGPT (Apps SDK) renders this as an inline iframe when a tool
 * registration declares `_meta["openai/outputTemplate"]` pointing at it.
 *
 * @public
 */
export const EXTRACTION_RESULT_WIDGET_URI = "ui://widget/extraction-result.html"

/**
 * MIME type for Apps SDK widget resources. The `profile=mcp-app` parameter
 * tells the host this is a renderable widget, not arbitrary HTML.
 *
 * @public
 */
export const EXTRACTION_RESULT_WIDGET_MIME = "text/html;profile=mcp-app"
