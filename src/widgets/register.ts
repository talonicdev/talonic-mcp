import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { getExtractionResultWidgetHtml } from "./extraction-result.js"
import { EXTRACTION_RESULT_WIDGET_URI, EXTRACTION_RESULT_WIDGET_MIME } from "./types.js"

/**
 * Register the extraction-result widget as an MCP resource.
 *
 * Apps SDK clients (ChatGPT) discover widgets by listing resources with the
 * `text/html;profile=mcp-app` MIME type. Tools opt into a widget by setting
 * `_meta["openai/outputTemplate"]` to the widget URI.
 *
 * @internal
 */
export function registerExtractionResultWidget(server: McpServer): void {
  server.registerResource(
    "extraction-result-widget",
    EXTRACTION_RESULT_WIDGET_URI,
    {
      title: "Talonic Extraction Result",
      description: "Inline view of extracted data, document metadata, and per-field confidence.",
      mimeType: EXTRACTION_RESULT_WIDGET_MIME,
    },
    async () => ({
      contents: [
        {
          uri: EXTRACTION_RESULT_WIDGET_URI,
          mimeType: EXTRACTION_RESULT_WIDGET_MIME,
          text: getExtractionResultWidgetHtml(),
        },
      ],
    }),
  )
}
