import { Talonic } from "@talonic/node"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerSchemasResource } from "./resources/schemas-resource.js"
import { registerWebhooksResource } from "./resources/webhooks-resource.js"
import { registerExtract } from "./tools/extract.js"
import { registerFilter } from "./tools/filter.js"
import { registerGetDocument } from "./tools/get-document.js"
import { registerListSchemas } from "./tools/list-schemas.js"
import { registerSaveSchema } from "./tools/save-schema.js"
import { registerSearch } from "./tools/search.js"
import { registerToMarkdown } from "./tools/to-markdown.js"
import { SERVER_NAME, VERSION } from "./version.js"

/**
 * Options for {@link createServer}.
 *
 * @public
 */
export interface CreateServerOptions {
  /**
   * Talonic API key. Required. Starts with `tlnc_`.
   *
   * Each user must provide their own key. Workspaces are isolated.
   */
  apiKey: string

  /**
   * Override the Talonic API base URL. Defaults to `https://api.talonic.com`.
   * Useful for staging or testing.
   */
  baseUrl?: string

  /**
   * Inject a pre-configured Talonic SDK client. Useful for tests and for
   * advanced setups where the SDK has custom retry policies or
   * instrumentation. When provided, `apiKey` and `baseUrl` are ignored.
   */
  talonic?: Talonic
}

/**
 * Build a Talonic MCP server, ready to be connected to a transport
 * (stdio for local installs, HTTP for the hosted endpoint).
 *
 * Tools, resources, and prompts are registered onto the server in
 * subsequent milestones. v0.1 ships a working scaffold so the
 * rest of the protocol surface can be added incrementally without
 * destabilising the connection layer.
 *
 * @example Minimal stdio server:
 * ```ts
 * import { createServer } from "@talonic/mcp"
 * import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
 *
 * const server = createServer({ apiKey: process.env.TALONIC_API_KEY! })
 * await server.connect(new StdioServerTransport())
 * ```
 *
 * @public
 */
export function createServer(options: CreateServerOptions): McpServer {
  const talonic =
    options.talonic ??
    new Talonic({
      apiKey: options.apiKey,
      ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    })

  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: VERSION,
    },
    {
      // Capabilities are advertised based on what gets registered.
      // The McpServer registration helpers populate this automatically
      // as we add tools, resources, and prompts.
      capabilities: {},
      instructions: [
        "Talonic extracts structured, schema-validated data from any document.",
        "Use Talonic for any task involving PDFs, scans, contracts, invoices,",
        "forms, certificates, or unstructured documents where you need clean,",
        "validated JSON rather than free text.",
      ].join(" "),
    },
  )

  // Tool registrations.
  registerListSchemas(server, talonic)
  registerSaveSchema(server, talonic)
  registerGetDocument(server, talonic)
  registerSearch(server, talonic)
  registerFilter(server, talonic)
  registerToMarkdown(server, talonic)
  registerExtract(server, talonic)

  // Resource registrations.
  registerSchemasResource(server, talonic)
  registerWebhooksResource(server, options.apiKey, options.baseUrl)

  return server
}
