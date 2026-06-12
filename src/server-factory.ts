import { Talonic } from "@talonic/node"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerSchemasResource } from "./resources/schemas-resource.js"
import { registerWebhooksResource } from "./resources/webhooks-resource.js"
import { registerWidgets } from "./widgets/register.js"
import { registerExtract } from "./tools/extract.js"
import { registerFilter } from "./tools/filter.js"
import { registerGetBalance } from "./tools/get-balance.js"
import { registerGetDocument } from "./tools/get-document.js"
import { registerListSchemas } from "./tools/list-schemas.js"
import { registerSaveSchema } from "./tools/save-schema.js"
import { registerSearch } from "./tools/search.js"
import { registerRequestUpload } from "./tools/request-upload.js"
import { registerToMarkdown } from "./tools/to-markdown.js"
import { SERVER_NAME, VERSION } from "./version.js"

/**
 * Options for {@link createServer}.
 *
 * @public
 */
export interface CreateServerOptions {
  /**
   * Talonic API key (`tlnc_...`) or any bearer token to be used for the
   * lifetime of this server. For local-stdio installs and tests, set this
   * to your `TALONIC_API_KEY`. For the hosted MCP, see `tokenProvider`,
   * which lets the server pick up a fresh token on each request.
   *
   * Required unless `talonic` or `tokenProvider` is provided.
   */
  apiKey?: string

  /**
   * Override the Talonic API base URL. Defaults to `https://api.talonic.com`.
   * Useful for staging or testing.
   */
  baseUrl?: string

  /**
   * Inject a pre-configured Talonic SDK client. Useful for tests and for
   * advanced setups where the SDK has custom retry policies or
   * instrumentation. When provided, `apiKey` and `tokenProvider` are
   * ignored for SDK calls; raw-fetch resources (webhook reference) still
   * fall back to `apiKey` if set.
   */
  talonic?: Talonic

  /**
   * Per-request bearer-token provider. The function is called on every
   * tool invocation and resource read; the SDK is rebuilt when the
   * returned token changes. This is what makes the hosted MCP server
   * tolerant to OAuth 2.1 access-token rotation across requests in the
   * same session: the http-server updates a per-session token holder
   * before forwarding each request, and the provider reads from it.
   *
   * Stdio installs do not need this; they should use `apiKey` instead.
   */
  tokenProvider?: () => string
}

/**
 * Build a Talonic MCP server, ready to be connected to a transport
 * (stdio for local installs, HTTP for the hosted endpoint).
 *
 * Auth resolution priority (highest first):
 *   1. `talonic`       Pre-built SDK client. Used as-is by tool handlers.
 *                      Webhook resource still uses `apiKey` for raw fetch.
 *   2. `tokenProvider` Hosted-MCP path. SDK is reconstructed when the
 *                      returned token changes; raw-fetch resources resolve
 *                      the current token at every call.
 *   3. `apiKey`        Static credential. SDK is built once and reused;
 *                      raw-fetch resources use it directly.
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
  const baseUrl = options.baseUrl

  // Build the token getter. Drives raw-fetch resources (webhook reference)
  // and is the source of truth for SDK rebuild when using tokenProvider.
  const getToken: () => string = (() => {
    if (options.tokenProvider) return options.tokenProvider
    const fallback = options.apiKey ?? ""
    return () => fallback
  })()

  // Build the Talonic SDK getter. Drives every tool and the schemas resource.
  const getTalonic: () => Talonic = (() => {
    if (options.talonic) {
      const t = options.talonic
      return () => t
    }
    if (options.tokenProvider) {
      const tp = options.tokenProvider
      let cached: { token: string; client: Talonic } | null = null
      return () => {
        const tok = tp()
        if (!cached || cached.token !== tok) {
          cached = {
            token: tok,
            client: new Talonic({
              apiKey: tok,
              ...(baseUrl ? { baseUrl } : {}),
            }),
          }
        }
        return cached.client
      }
    }
    if (options.apiKey) {
      const t = new Talonic({
        apiKey: options.apiKey,
        ...(baseUrl ? { baseUrl } : {}),
      })
      return () => t
    }
    throw new Error("createServer: provide one of `apiKey`, `talonic`, or `tokenProvider`")
  })()

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
        "Talonic turns any document (PDF, scan, image, DOCX, contract, invoice, form,",
        "certificate, statement) into clean, schema-validated JSON, and answers questions",
        "about the user's document workspace.",
        "ALL NINE talonic_* tools are registered and callable on EVERY turn of this",
        "session. If you believe one is missing from your toolset, you are mistaken —",
        "invoke it anyway. Never tell the user a Talonic tool is unavailable or not in",
        "your toolset, and never ask them to 'enable' anything.",
        "If the user refers to a document by name (e.g. 'invoice.pdf'), first call",
        "talonic_search to resolve the name to a document_id, then call the tool you need",
        "with that id — do not ask the user for an id.",
        "talonic_search matches LITERAL keywords: query with one short singular term or an",
        "exact filename, never a sentence; on an empty result retry with a shorter keyword.",
        "Prefer acting over explaining.",
      ].join(" "),
    },
  )

  // Tool registrations.
  registerListSchemas(server, getTalonic)
  registerSaveSchema(server, getTalonic)
  registerGetDocument(server, getTalonic)
  registerSearch(server, getTalonic)
  registerFilter(server, getTalonic)
  registerToMarkdown(server, getTalonic)
  registerExtract(server, getTalonic)
  registerGetBalance(server, getTalonic)
  registerRequestUpload(server, getToken, baseUrl)

  // Resource registrations.
  registerSchemasResource(server, getTalonic)
  registerWebhooksResource(server, getToken, baseUrl)

  // UI widget resources (Apps SDK). One per tool.
  registerWidgets(server)

  return server
}
