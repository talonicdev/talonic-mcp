import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, runTool } from "./_http.js"
import { validationError, zUuid, type ToolResult } from "./_shared.js"

/**
 * Integrations tools: connect a source through a browser handoff, see what is
 * connected, browse a connected source, import from it, and keep it in sync.
 *
 * All tools hit `/v1/integrations/*` and `/v1/sources/*` with the caller's
 * bearer and act as the PERSON behind it; the platform decides every rule
 * (scopes `sources:read`, `sources:write`, `documents:write`, the person's
 * workspace permission, and what a personal connection shows to whom).
 *
 * Connect: talonic_integrations_connectors → talonic_integrations_connect
 * (returns a link the person opens while signed in to Talonic) → poll
 * talonic_integrations_connect_status until `connected` → use the
 * `connection_id` with the talonic_sources_* tools.
 *
 * No tool connects with credentials (S3, Azure Blob, SQL, Kendox, Granola,
 * a Slack token, an external upload link) and no tool mints a source ingest
 * key: secrets and keys never pass through an agent conversation. Those stay
 * on `POST /v1/sources/connections/<type>` and `/v1/sources/:id/keys`, or the
 * Talonic web app.
 */

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}
const write = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
}
const settle = { ...write, idempotentHint: true }

/** Connectors that connect with credentials only: refused here, before any call. */
export const CREDENTIAL_CONNECTORS: readonly string[] = [
  "s3",
  "azure-blob",
  "sql",
  "kendox",
  "granola",
  "slack-token",
  "external-upload",
]

const SYNC_INTERVALS = ["off", "every_minute", "hourly", "daily", "weekly"] as const

const PERSONAL_NOTE =
  "Personal connections (mailboxes, notes, a person's own drive) show their content only as the connecting person's access allows; other people in the workspace may see the connection without its content."

/** True when the platform serves the integrations routes to this caller (tools are listed only then). */
export async function probeIntegrationsAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/integrations/connectors"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

const CONNECTORS_DESCRIPTION = `What the workspace can connect: per connector its slug, name, kind (source or destination), method (authorize = a browser sign-in this server can start; credentials = keys or passwords, entered by a person in the Talonic web app or sent to the REST API, never through this conversation), personal (one person's own account) and available (false = not offered on this deployment). USE WHEN the user wants to connect Gmail, Google Drive, Outlook, OneDrive, SharePoint, Teams, Notion, HubSpot, Dropbox, Slack or Google Sheets. NOT FOR what is already connected: talonic_sources_connections.`

const CONNECT_DESCRIPTION = `Start connecting an account through a browser sign-in. Returns \`authorize_url\`, \`id\` (the authorization id) and \`expires_at\` (30 minutes). Give the user the link: they must open it in a browser while signed in to Talonic, in this workspace, as the same person this connection acts for, then confirm and finish the provider's sign-in. Nothing is connected until they do. Then call talonic_integrations_connect_status with the id until status is connected, failed, expired or cancelled. Only for connectors whose method is authorize (talonic_integrations_connectors). Optional: \`send\` (gmail, outlook: the mailbox may also send mail), \`intake\` (gmail, notion, slack: what to read first). Connecting the same account again renews the existing connection. ${PERSONAL_NOTE} Errors: 503 connector_not_configured (not offered on this deployment), 403 with a reason (missing consent or permission). NOT FOR S3, Azure Blob, SQL, Kendox, Granola or upload links: they need credentials, which never pass through an agent conversation.`

const CONNECT_STATUS_DESCRIPTION = `Where a browser connect started by talonic_integrations_connect stands: status pending (the user has not finished yet), connected, failed (with error code and message), expired or cancelled. On connected it returns \`connection_id\`, the id the talonic_sources_* tools take; for Google Sheets it returns the signed-in account instead, and a destination is made from it through the REST API. Only the person who started the connect can see it (404 for anyone else). Poll every few seconds while pending; stop after expires_at. NOT FOR starting a connect: talonic_integrations_connect.`

const CONNECTIONS_DESCRIPTION = `Every connected source of the workspace with its type, name, sync state, \`restricted\` (visible only to some people) and \`connected_by\`. Use the id with talonic_sources_browse, talonic_sources_import, talonic_sources_imports, talonic_sources_sync_now and talonic_sources_sync_settings. ${PERSONAL_NOTE} NOT FOR connectors that could be connected: talonic_integrations_connectors.`

const BROWSE_DESCRIPTION = `List the folders and files inside a connected source, one level and page at a time: pass \`folder_id\` to open a folder, \`page_token\` from the previous answer for the next page, \`q\` to search by name. Shows only what the caller may see in that source. Use the file ids with talonic_sources_import. NOT FOR documents already in Talonic: talonic_search.`

const IMPORT_DESCRIPTION = `Bring chosen files from a connected source into Talonic as documents: \`file_ids\` from talonic_sources_browse, optional \`tags\`. Imported files are read like uploaded documents, which uses credits; follow progress with talonic_sources_imports. Call only when the user asked to import these files. NOT FOR keeping a source in sync: talonic_sources_sync_settings.`

const IMPORTS_DESCRIPTION = `Recent imports from one connected source: their state and what each brought in. NOT FOR the source's sync schedule: talonic_sources_sync_settings.`

const SYNC_NOW_DESCRIPTION = `Check a connected source for new and changed files now instead of waiting for its schedule (answers 202 at once; the sync runs in the background). New files become documents and are read like uploads, which uses credits. Follow with talonic_sources_connections (sync state) or talonic_sources_imports. A personal connection can be synced only by the person who connected it. NOT FOR changing the schedule: talonic_sources_sync_settings.`

const SYNC_SETTINGS_DESCRIPTION = `Read, or change, how a connected source stays in sync. Without \`interval\` and \`scope\` it only reads the current settings. With \`interval\` (off, every_minute, hourly, daily, weekly) and/or \`scope\` (which folders, labels, pages or prefixes are watched: an object with \`type\` = the connection's kind and \`entries\`; read the current settings first and change that shape) it changes them, and only for the connection's author or a workspace owner. A schedule other than off needs at least one scope entry. Call the change only when the user asked for it. NOT FOR syncing once now: talonic_sources_sync_now.`

const AUTHORIZE_INSTRUCTIONS =
  "Ask the user to open authorize_url in a browser while signed in to Talonic, in this workspace, then confirm and finish the provider's sign-in. Then call talonic_integrations_connect_status with this id until status is no longer pending. The link expires at expires_at."

const cid = (a: { connection_id: string }) => encodeURIComponent(a.connection_id)

/**
 * Start a browser connect, refusing credential connectors before any call.
 *
 * @internal
 */
export async function handleIntegrationsConnect(
  getToken: () => string,
  baseUrl: string | undefined,
  a: { connector: string; send?: boolean; intake?: Record<string, unknown> },
): Promise<ToolResult> {
  const connector = a.connector.trim().toLowerCase()
  if (CREDENTIAL_CONNECTORS.includes(connector)) {
    return validationError(
      `${connector} connects with credentials, which never pass through an agent conversation. Ask the user to connect it in the Talonic web app (Sources), or send the credentials to POST /v1/sources/connections/${connector === "slack-token" ? "slack" : connector} from their own system.`,
    )
  }
  const body: Record<string, unknown> = {}
  if (a.send !== undefined) body["send"] = a.send
  if (a.intake !== undefined) body["intake"] = a.intake
  return runTool(async () => {
    const auth = await apiJson<Record<string, unknown>>(
      getToken,
      baseUrl,
      "POST",
      `/v1/integrations/${encodeURIComponent(connector)}/authorize`,
      { body },
    )
    return { ...auth, instructions: AUTHORIZE_INSTRUCTIONS }
  })
}

/**
 * Read the sync settings, or change them when `interval` or `scope` is given.
 *
 * @internal
 */
export async function handleSourcesSyncSettings(
  getToken: () => string,
  baseUrl: string | undefined,
  a: { connection_id: string; interval?: string; scope?: Record<string, unknown> },
): Promise<ToolResult> {
  const path = `/v1/sources/connections/${cid(a)}/sync`
  if (a.interval === undefined && a.scope === undefined) {
    return runTool(() => apiJson(getToken, baseUrl, "GET", path))
  }
  const body: Record<string, unknown> = {}
  if (a.interval !== undefined) body["interval"] = a.interval
  if (a.scope !== undefined) body["scope"] = a.scope
  return runTool(() => apiJson(getToken, baseUrl, "PATCH", path, { body }))
}

/**
 * Register the integrations group: `talonic_integrations_*` and
 * `talonic_sources_*`.
 *
 * @public
 */
export function registerIntegrationsTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const connectionId = zUuid().describe("The connection id from talonic_sources_connections")
  const tools: Array<
    [
      string,
      string,
      string,
      Record<string, z.ZodTypeAny>,
      typeof readOnly | typeof write | typeof settle,
      (a: any) => Promise<ToolResult>,
    ]
  > = [
    [
      "talonic_integrations_connectors",
      "Connectors",
      CONNECTORS_DESCRIPTION,
      {},
      readOnly,
      () => runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/integrations/connectors")),
    ],
    [
      "talonic_integrations_connect",
      "Connect an account",
      CONNECT_DESCRIPTION,
      {
        connector: z
          .string()
          .min(1)
          .describe("Connector slug with method authorize, e.g. gmail, google-drive, sharepoint"),
        send: z
          .boolean()
          .optional()
          .describe("gmail, outlook only: the mailbox may also send mail"),
        intake: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("gmail, notion, slack only: what to read first"),
      },
      write,
      (a) => handleIntegrationsConnect(getToken, baseUrl, a),
    ],
    [
      "talonic_integrations_connect_status",
      "Connect status",
      CONNECT_STATUS_DESCRIPTION,
      {
        authorization_id: z
          .string()
          .min(1)
          .describe("The id talonic_integrations_connect returned"),
      },
      readOnly,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "GET",
            `/v1/integrations/authorizations/${encodeURIComponent(a.authorization_id)}`,
          ),
        ),
    ],
    [
      "talonic_sources_connections",
      "Connected sources",
      CONNECTIONS_DESCRIPTION,
      {},
      readOnly,
      () => runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/sources/connections")),
    ],
    [
      "talonic_sources_browse",
      "Browse a source",
      BROWSE_DESCRIPTION,
      {
        connection_id: connectionId,
        folder_id: z.string().optional().describe("Folder to open; omit for the top level"),
        page_token: z.string().optional().describe("next page token from the previous answer"),
        q: z.string().optional().describe("Search by file or folder name"),
      },
      readOnly,
      (a) =>
        runTool(() =>
          apiJson(getToken, baseUrl, "GET", `/v1/sources/${cid(a)}/browse`, {
            params: { folder_id: a.folder_id, page_token: a.page_token, q: a.q },
          }),
        ),
    ],
    [
      "talonic_sources_import",
      "Import from a source",
      IMPORT_DESCRIPTION,
      {
        connection_id: connectionId,
        file_ids: z
          .array(z.string().min(1))
          .min(1)
          .describe("File ids from talonic_sources_browse"),
        tags: z.array(z.string().min(1)).optional().describe("Tags for the imported documents"),
      },
      write,
      (a) =>
        runTool(() =>
          apiJson(getToken, baseUrl, "POST", `/v1/sources/${cid(a)}/import`, {
            body: { file_ids: a.file_ids, ...(a.tags ? { tags: a.tags } : {}) },
          }),
        ),
    ],
    [
      "talonic_sources_imports",
      "Imports from a source",
      IMPORTS_DESCRIPTION,
      { connection_id: connectionId },
      readOnly,
      (a) => runTool(() => apiJson(getToken, baseUrl, "GET", `/v1/sources/${cid(a)}/imports`)),
    ],
    [
      "talonic_sources_sync_now",
      "Sync a source now",
      SYNC_NOW_DESCRIPTION,
      { connection_id: connectionId },
      settle,
      (a) =>
        runTool(async () => {
          const res = await apiJson(
            getToken,
            baseUrl,
            "POST",
            `/v1/sources/connections/${cid(a)}/sync-now`,
          )
          return res ?? { accepted: true, connection_id: a.connection_id }
        }),
    ],
    [
      "talonic_sources_sync_settings",
      "Source sync settings",
      SYNC_SETTINGS_DESCRIPTION,
      {
        connection_id: connectionId,
        interval: z.enum(SYNC_INTERVALS).optional().describe("New schedule; omit to keep it"),
        scope: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("What is watched: { type, entries }; omit to keep it"),
      },
      settle,
      (a) => handleSourcesSyncSettings(getToken, baseUrl, a),
    ],
  ]
  for (const [name, title, description, inputSchema, annotations, handler] of tools) {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations } },
      async (args: unknown) => handler(args) as Promise<any>,
    )
  }
}
