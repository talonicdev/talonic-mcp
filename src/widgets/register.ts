import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { getExtractionResultWidgetHtml } from "./extraction-result.js"
import { EXTRACTION_RESULT_WIDGET_URI, EXTRACTION_RESULT_WIDGET_MIME } from "./types.js"

/**
 * Unique HTTPS origin for this app's widgets. Required for ChatGPT app
 * submission; ChatGPT isolates the widget in a sandbox derived from it
 * (`<domain>.web-sandbox.oaiusercontent.com`). It is an isolation namespace,
 * not a served endpoint. One value for the whole app (must be unique per app).
 *
 * @internal
 */
const WIDGET_DOMAIN = "https://talonic.com"

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
          // Content Security Policy. The widget is fully self-contained — it
          // makes no external network calls, loads no external resources, and
          // embeds no external frames — so every domain list is empty. The CSP
          // must still be declared: ChatGPT flags the widget "CSP off"
          // otherwise, and the Apps SDK submission guidelines require it.
          // Both keys are emitted: `ui.csp` (modern) and `openai/widgetCSP`
          // (legacy ChatGPT compatibility).
          _meta: {
            ui: {
              // Unique HTTPS origin for this app's widget. Required for app
              // submission. ChatGPT renders the widget in an isolated sandbox
              // at <domain>.web-sandbox.oaiusercontent.com. It is an isolation
              // namespace, not a served endpoint — it need not host anything.
              domain: WIDGET_DOMAIN,
              csp: {
                connectDomains: [],
                resourceDomains: [],
                frameDomains: [],
              },
            },
            // OpenAI compatibility aliases for the two fields above.
            "openai/widgetDomain": WIDGET_DOMAIN,
            "openai/widgetCSP": {
              connect_domains: [],
              resource_domains: [],
              redirect_domains: [],
            },
          },
        },
      ],
    }),
  )
}
