import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerWidget } from "./shared.js"
import { WIDGET_URIS } from "./types.js"
import { getExtractionResultWidgetHtml } from "./extraction-result.js"
import { getBalanceWidgetHtml } from "./balance.js"
import { getUploadLinkWidgetHtml } from "./upload-link.js"
import { getSchemaSavedWidgetHtml } from "./schema-saved.js"
import { getDocumentMetaWidgetHtml } from "./document-meta.js"
import { getMarkdownViewWidgetHtml } from "./markdown-view.js"
import { getSchemaListWidgetHtml } from "./schema-list.js"
import { getSearchResultsWidgetHtml } from "./search-results.js"
import { getFilterResultsWidgetHtml } from "./filter-results.js"

/**
 * Register the extraction-result widget as an MCP resource.
 *
 * Kept as a named export for back-compat; {@link registerWidgets} registers
 * this alongside every other tool widget.
 *
 * @internal
 */
export function registerExtractionResultWidget(server: McpServer): void {
  registerWidget(server, {
    name: "extraction-result-widget",
    uri: WIDGET_URIS.extract,
    title: "Talonic Extraction Result",
    description: "Inline view of extracted data, document metadata, and per-field confidence.",
    html: getExtractionResultWidgetHtml(),
  })
}

/**
 * Register every tool widget as an MCP resource. Each tool opts into its
 * widget by declaring `_meta["openai/outputTemplate"]` with the matching
 * `WIDGET_URIS` entry in its `registerTool` config.
 *
 * @internal
 */
export function registerWidgets(server: McpServer): void {
  registerExtractionResultWidget(server)

  registerWidget(server, {
    name: "search-results-widget",
    uri: WIDGET_URIS.search,
    title: "Talonic Search Results",
    description: "Inline view of documents, fields, schemas, and sources matching a query.",
    html: getSearchResultsWidgetHtml(),
  })

  registerWidget(server, {
    name: "filter-results-widget",
    uri: WIDGET_URIS.filter,
    title: "Talonic Filter Results",
    description: "Inline table of documents matching a filter, with any API warnings.",
    html: getFilterResultsWidgetHtml(),
  })

  registerWidget(server, {
    name: "document-meta-widget",
    uri: WIDGET_URIS.getDocument,
    title: "Talonic Document",
    description: "Inline view of a document's metadata, status, and triage flags.",
    html: getDocumentMetaWidgetHtml(),
  })

  registerWidget(server, {
    name: "markdown-view-widget",
    uri: WIDGET_URIS.toMarkdown,
    title: "Talonic Markdown",
    description: "Inline view of a document's OCR-converted markdown.",
    html: getMarkdownViewWidgetHtml(),
  })

  registerWidget(server, {
    name: "schema-list-widget",
    uri: WIDGET_URIS.listSchemas,
    title: "Talonic Schemas",
    description: "Inline table of saved schemas in the workspace.",
    html: getSchemaListWidgetHtml(),
  })

  registerWidget(server, {
    name: "schema-saved-widget",
    uri: WIDGET_URIS.saveSchema,
    title: "Talonic Schema Saved",
    description: "Inline confirmation of a newly saved schema.",
    html: getSchemaSavedWidgetHtml(),
  })

  registerWidget(server, {
    name: "balance-widget",
    uri: WIDGET_URIS.getBalance,
    title: "Talonic Balance",
    description: "Inline view of the workspace credit balance, tier, burn, and runway.",
    html: getBalanceWidgetHtml(),
  })

  registerWidget(server, {
    name: "upload-link-widget",
    uri: WIDGET_URIS.requestUpload,
    title: "Talonic Upload Link",
    description: "Inline browser-handoff upload link with document ID and expiry.",
    html: getUploadLinkWidgetHtml(),
  })
}
