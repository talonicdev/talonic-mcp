import { Talonic } from "@talonic/node"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { withFetch } from "./tools/_http.js"
import { registerSchemasResource } from "./resources/schemas-resource.js"
import { registerWebhooksResource } from "./resources/webhooks-resource.js"
import { registerWidgets } from "./widgets/register.js"
import { registerExtract } from "./tools/extract.js"
import { registerFilter } from "./tools/filter.js"
import { registerGetBalance } from "./tools/get-balance.js"
import { registerGetPricing } from "./tools/get-pricing.js"
import { registerGetUsage } from "./tools/get-usage.js"
import { registerGetDocument } from "./tools/get-document.js"
import { registerListSchemas } from "./tools/list-schemas.js"
import { registerSaveSchema } from "./tools/save-schema.js"
import { registerSearch } from "./tools/search.js"
import { registerRequestUpload } from "./tools/request-upload.js"
import { registerGrowthTools } from "./tools/growth.js"
import { registerContractsTools } from "./tools/contracts.js"
import { registerApTools } from "./tools/ap.js"
import { registerAdminAgentTaskTools, registerAgentTaskTools } from "./tools/agent-tasks.js"
import { registerDecisionTaskTools } from "./tools/decision-tasks.js"
import { registerToMarkdown } from "./tools/to-markdown.js"
import { registerFieldTools } from "./tools/fields.js"
import { registerAgentRegistryTools } from "./tools/agent-tools.js"
import { registerSpecTools } from "./tools/specs.js"
import { registerRunTools } from "./tools/run.js"
import { registerAskTools } from "./tools/ask.js"
import { SERVER_NAME, VERSION } from "./version.js"

/**
 * Wrap a fetch so every outbound Talonic API call carries
 * `User-Agent: talonic-mcp/<v> <clientName>`. The platform's `resolveSurface`
 * uses the UA to classify the request's funnel `surface` (claude_desktop /
 * cursor / chatgpt …). `clientName` is read lazily so the persistent stdio
 * session can fill it in after the initialize handshake. Never throws.
 *
 * @public
 */
export function makeTaggedFetch(
  getClientName: () => string | undefined,
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  return ((input: any, init?: any) => {
    try {
      const headers = new Headers(init?.headers)
      const cn = getClientName()
      headers.set("user-agent", `talonic-mcp/${VERSION}${cn ? ` ${cn}` : ""}`)
      return baseFetch(input, { ...init, headers })
    } catch {
      return baseFetch(input, init)
    }
  }) as typeof fetch
}

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

  /**
   * Register the Talonic-internal growth analytics tools (superadmin-only).
   * Callers set this ONLY after `probeGrowthAccess` passed for the session's
   * credential — the platform re-checks the principal on every call, so this
   * flag controls listing visibility, never access. Defaults to false.
   */
  includeGrowthTools?: boolean

  /**
   * Register Talonic-internal cross-tenant Agent-task variants. Callers set
   * this only after the platform access probe passes. The platform still
   * re-authorizes every call; this flag controls listing visibility only.
   */
  includeAdminAgentTaskTools?: boolean

  /**
   * Register the `talonic_contracts_*` tools. Callers set this only after
   * `probeContractsAccess` passed, so a deployment without the Contracts app
   * never lists tools that would 404. Listing visibility only.
   */
  includeContractsTools?: boolean

  /**
   * Register the `talonic_ap_*` tools. Callers set this only after
   * `probeApAccess` passed, so a deployment without the AP app never lists
   * tools that would 404. Listing visibility only.
   */
  includeApTools?: boolean

  /**
   * Whether the seven decision-task tools are listed as invocable. The hosted
   * entrypoint sets this from `tokenHasDecideScope`: an OAuth token that
   * visibly lacks the `apps:decide` scope gets them listed but marked
   * non-invocable, so the agent explains the missing consent instead of
   * hitting a 403. Listing UX only; the platform decides on every call.
   * Defaults to true.
   */
  decisionTasksInvocable?: boolean

  /**
   * Register `talonic_list_agent_tools` + `talonic_invoke_agent_tool`, the
   * generic executor over the platform agent-tool registry. The hosted
   * entrypoint sets this to false for ChatGPT / OpenAI callers, whose plugin
   * review requires every model-callable operation to be its own tool.
   * Defaults to true.
   */
  includeGenericExecutor?: boolean
}

/**
 * Server-level instructions sent in the MCP initialize result. Kept factual
 * and scoped to the user's request: OpenAI's plugin review holds instructions
 * that override the host's judgment about tool availability, advertise
 * pricing, or push the server for tasks beyond what the user asked for.
 *
 * @internal
 */
export function buildServerInstructions(opts: { includeGenericExecutor: boolean }): string {
  return [
    "Talonic turns unstructured documents (PDFs, scans, images, DOCX, emails) into",
    "schema-validated JSON with per-field confidence scores and source provenance, and",
    "answers questions about the documents in the user's Talonic workspace.",
    "Use talonic_extract when the user asks to extract fields or structured data from a",
    "document. Define the fields with an inline schema or a saved schema_id; when the user",
    "does not know the fields yet, auto_schema:true discovers them. Use talonic_to_markdown",
    "for a document's full text.",
    "If the user refers to a document by name (e.g. 'invoice.pdf'), call talonic_search to",
    "resolve the name to a document_id, then call the tool you need with that id.",
    "talonic_search matches literal keywords: query with one short term or an exact",
    "filename; on an empty result, retry with a shorter keyword.",
    "The Field Registry describes what data exists: talonic_find_data resolves a concept in",
    "the user's words to the fields and documents that carry it, talonic_list_fields and",
    "talonic_get_field describe concepts (maturity core or proven are the most established),",
    "and talonic_field_values reads one concept across all documents with provenance.",
    ...(opts.includeGenericExecutor
      ? [
          "Read-only registry tools without their own tool (e.g. query_data for SQL) are",
          "reachable via talonic_list_agent_tools + talonic_invoke_agent_tool.",
        ]
      : []),
    "To run the user's configured pipeline: talonic_list_specs -> talonic_run_spec ->",
    "poll talonic_get_run until completed -> talonic_get_run_results. For open questions",
    "across documents use talonic_ask (uses credits; if it returns status processing, poll",
    "talonic_get_answer). talonic_get_balance shows the remaining credits.",
    "For Agent-stage work, follow list -> get -> claim -> heartbeat while needed -> submit.",
    "Preserve the execution_epoch from claim and return only fields declared in the task",
    "output_contract; stop on a lease or epoch conflict.",
    "For app decisions, follow talonic_list_decision_tasks -> talonic_claim_decision_task ->",
    "talonic_read_decision_package -> talonic_heartbeat_decision_task while needed ->",
    "talonic_submit_decision_task, or release or fail the task. Decision tools need the",
    "apps:decide consent and a senior_member role or above; if a decision tool is marked",
    "not invocable in this session, or a call returns 403, tell the user which consent or",
    "role is missing instead of retrying.",
    "Tools that change workspace data (saving schemas, contract and AP updates, decisions)",
    "should only be called when the user asked for that change.",
  ].join(" ")
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

  let clientName: string | undefined
  const taggedFetch = makeTaggedFetch(() => clientName)

  // Build the token getter. Drives raw-fetch resources (webhook reference)
  // and is the source of truth for SDK rebuild when using tokenProvider.
  const getToken: () => string = (() => {
    if (options.tokenProvider) return options.tokenProvider
    const fallback = options.apiKey ?? ""
    return () => fallback
  })()

  // Raw-fetch tools (no SDK client) resolve this instead of `getToken`, so
  // their outbound calls carry the same User-Agent surface tag as the
  // SDK-backed tools above.
  const rawToken = withFetch(getToken, taggedFetch)

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
              fetch: taggedFetch,
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
        fetch: taggedFetch,
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
      instructions: buildServerInstructions({
        includeGenericExecutor: options.includeGenericExecutor !== false,
      }),
    },
  )

  // The MCP initialize handshake is the only place the client identifies
  // itself. On stdio (persistent session) this lets us tag outbound calls'
  // surface; on stateless HTTP the platform resolves surface from the OAuth
  // client_name instead, so leaving this unset there is correct.
  const prevOnInitialized = server.server.oninitialized
  server.server.oninitialized = () => {
    prevOnInitialized?.()
    try {
      clientName = server.server.getClientVersion()?.name
    } catch {
      /* never let telemetry capture affect the handshake */
    }
  }

  // Tool registrations.
  registerListSchemas(server, getTalonic)
  registerSaveSchema(server, getTalonic)
  registerGetDocument(server, getTalonic)
  registerSearch(server, getTalonic)
  registerFilter(server, getTalonic)
  registerToMarkdown(server, getTalonic)
  registerExtract(server, getTalonic)
  registerGetBalance(server, getTalonic)
  registerGetPricing(server, getTalonic)
  registerGetUsage(server, getTalonic)
  registerRequestUpload(server, rawToken, baseUrl)
  registerFieldTools(server, rawToken, baseUrl)
  registerAgentRegistryTools(server, rawToken, baseUrl, {
    includeGenericExecutor: options.includeGenericExecutor !== false,
  })
  registerAgentTaskTools(server, rawToken, baseUrl)
  registerSpecTools(server, rawToken, baseUrl)
  registerRunTools(server, rawToken, baseUrl)
  registerAskTools(server, rawToken, baseUrl)
  registerDecisionTaskTools(server, rawToken, baseUrl, {
    invocable: options.decisionTasksInvocable !== false,
  })
  if (options.includeGrowthTools) {
    registerGrowthTools(server, rawToken, baseUrl)
  }
  if (options.includeAdminAgentTaskTools) {
    registerAdminAgentTaskTools(server, rawToken, baseUrl)
  }
  if (options.includeContractsTools) {
    registerContractsTools(server, rawToken, baseUrl)
  }
  if (options.includeApTools) {
    registerApTools(server, rawToken, baseUrl)
  }

  // Resource registrations.
  registerSchemasResource(server, getTalonic)
  registerWebhooksResource(server, rawToken, baseUrl)

  // UI widget resources (Apps SDK). One per tool.
  registerWidgets(server)

  return server
}
