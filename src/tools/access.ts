import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, probeAccessState, runTool, type ProbeAnswer } from "./_http.js"
import { zUuid, type ToolResult } from "./_shared.js"

/**
 * Access and sharing tools: who holds a source's or person's data, asking for
 * access, deciding on requests, and sharing what the caller holds. All tools
 * hit `/v1/governance/*` with the caller's bearer; the platform checks
 * membership and holding on every call, so these tools never widen access.
 * `scope_id` is not RFC-4122 (arbitrary version digits); `zUuid()` checks only
 * the 8-4-4-4-12 hex shape, which is what is needed.
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
/** Stops or refuses something others rely on: clients ask the person first. */
const destructive = { ...write, destructiveHint: true }

const BASE = "/v1/governance"
const enc = encodeURIComponent

/** @internal Path the access cache and boot probe ask. */
export const ACCESS_SHARING_PATH = `${BASE}/sharing`

/** Probe answer for `GET /v1/governance/sharing`: true only on 2xx with `available === true`. @internal */
export function probeAccessSharingState(token: string, baseUrl?: string): Promise<ProbeAnswer> {
  return probeAccessState(
    token,
    baseUrl,
    ACCESS_SHARING_PATH,
    (b) => (b as { available?: unknown } | null)?.available === true,
  )
}

/** True when sharing is available to the caller (tools are listed only then). */
export async function probeAccessSharingAccess(token: string, baseUrl?: string): Promise<boolean> {
  return (await probeAccessSharingState(token, baseUrl)) === true
}

const DIRECTORY_DESCRIPTION = `WHAT: Every source and person's uploads in the workspace with who holds them and the caller's own standing: held, held_via_team, licensed, open_request_id, scope_id, source_connection_id. Never items or counts.
USE WHEN: finding out what exists and whether the caller can already see it, before talonic_access_request or talonic_access_share.
NOT FOR: reading the data itself.
ARGS: none.
RETURNS: the directory entries with holders and the caller's standing.`

const REQUESTS_DESCRIPTION = `WHAT: Access requests: the caller's own, those waiting on the caller as holder of a scope, and those the caller is asked to second.
USE WHEN: checking what is pending, or finding the request id for talonic_access_decide.
NOT FOR: asking for access (talonic_access_request).
ARGS: none.
RETURNS: { mine, for_my_scopes, to_second }.`

const REQUEST_DESCRIPTION = `WHAT: Ask the holders of a source or a person's uploads (or of one document) for access, with a purpose and a duration.
USE WHEN: the user needs data they cannot see. Take source_connection_id or scope_id from talonic_access_directory.
NOT FOR: sharing what the caller already holds (talonic_access_share). A document that does not exist and one the caller may not see answer alike (404): never guess ids.
ARGS: exactly one of source_connection_id / scope_id; optional document_id; purpose (1-500 chars); duration_days (1-90); optional capabilities.
RETURNS: the created request.`

const DECIDE_DESCRIPTION = `WHAT: Approve or deny a request waiting on the caller, or stop an approved access early.
USE WHEN: only when the user decides. Ids come from talonic_access_requests. Denying needs a reason.
NOT FOR: removing a share (talonic_access_stop_share).
ARGS: id; decision (approve | deny | stop); reason (required for deny).
RETURNS: the request after the decision.`

const SHARES_DESCRIPTION = `WHAT: What the caller has shared and what was shared with them. With document_id: who a document the caller holds is shared with.
USE WHEN: checking sharing before talonic_access_share, or finding ids for talonic_access_stop_share.
NOT FOR: requests (talonic_access_requests). With document_id the platform answers 404 when the caller does not hold the document.
ARGS: optional document_id.
RETURNS: { available, given, received }, or the document's shares.`

const SHARE_DESCRIPTION = `WHAT: Share documents, or a whole source or the caller's own uploads, with a person, a group or everyone.
USE WHEN: only when the user asks. Give document_ids to share documents; otherwise give scope_id or source_connection_id to share the whole scope.
NOT FOR: asking for access (talonic_access_request). Only a holder can share; the workspace's other rules still apply to the recipient.
ARGS: document_ids (1-200) OR scope_id / source_connection_id; to: {type: person|group, id} or {type: everyone}; duration_days (1-365; omit = until stopped); note (documents only, up to 500 chars).
RETURNS: the created share.`

const STOP_SHARE_DESCRIPTION = `WHAT: Stop a share. A recipient may also remove a share made to them.
USE WHEN: the user asks to stop sharing something. Ids come from talonic_access_shares.
NOT FOR: stopping an approved access request (talonic_access_decide with stop).
ARGS: kind (document | scope); id.
RETURNS: the stopped share.`

const to = z
  .union([
    z.object({ type: z.enum(["person", "group"]), id: zUuid() }),
    z.object({ type: z.literal("everyone") }),
  ])
  .describe("Recipient: a person or group id, or everyone")

const DATA_POINTS_DESCRIPTION = `Values of single Spec fields colleagues shared with the caller, per Spec, lined up per row (row_key) with their context: document type, a date at the holder's precision, and who it came from unless hidden. Never the documents.
USE WHEN: answering a question across colleagues' data the caller cannot open ("what did suppliers charge for X"). Answer with counts; cite no document. With mine=true: the caller's own Specs and which fields they share (sharing itself is confirmed in the app).
RETURNS: { available, specs: [{ spec_id, name, fields, holders, total_rows, truncated, rows }] }.`

/**
 * Register the `talonic_access_*` tools.
 *
 * @public
 */
export function registerAccessTools(
  server: McpServer,
  token: string | (() => string),
  baseUrl?: string,
): void {
  const getToken = typeof token === "function" ? token : () => token
  const call = (method: "GET" | "POST", path: string, body?: unknown) =>
    runTool(() => apiJson(getToken, baseUrl, method, path, body === undefined ? {} : { body }))

  const tools: Array<
    [
      string,
      string,
      string,
      Record<string, z.ZodTypeAny>,
      typeof readOnly | typeof write | typeof destructive,
      (a: any) => Promise<ToolResult>,
    ]
  > = [
    [
      "talonic_access_directory",
      "Access directory",
      DIRECTORY_DESCRIPTION,
      {},
      readOnly,
      () => call("GET", `${BASE}/directory`),
    ],
    [
      "talonic_access_requests",
      "Access requests",
      REQUESTS_DESCRIPTION,
      {},
      readOnly,
      () => call("GET", `${BASE}/access-requests`),
    ],
    [
      "talonic_access_request",
      "Request access",
      REQUEST_DESCRIPTION,
      {
        source_connection_id: zUuid()
          .optional()
          .describe("A source, from talonic_access_directory"),
        scope_id: zUuid()
          .optional()
          .describe("A person's uploads or a scope, from talonic_access_directory"),
        document_id: zUuid().optional().describe("One document in that source or scope"),
        purpose: z.string().min(1).max(500).describe("Why the data is needed"),
        duration_days: z.number().int().min(1).max(90).describe("How long access is needed"),
        capabilities: z
          .array(z.string())
          .optional()
          .describe("What the access is for, if the workspace asks"),
      },
      write,
      (a) => {
        if (!a.source_connection_id === !a.scope_id)
          return runTool(async () => {
            throw new Error("Give exactly one of source_connection_id or scope_id")
          })
        return call("POST", `${BASE}/access-requests`, a)
      },
    ],
    [
      "talonic_access_decide",
      "Decide on an access request",
      DECIDE_DESCRIPTION,
      {
        id: zUuid().describe("The request id from talonic_access_requests"),
        decision: z.enum(["approve", "deny", "stop"]),
        reason: z.string().min(1).optional().describe("Required when denying"),
      },
      destructive,
      (a) => {
        const path = `${BASE}/access-requests/${enc(a.id)}/${a.decision}`
        if (a.decision !== "deny") return call("POST", path)
        if (!a.reason)
          return runTool(async () => {
            throw new Error("A reason is required to deny")
          })
        return call("POST", path, { reason: a.reason })
      },
    ],
    [
      "talonic_access_data_points",
      "Data points",
      DATA_POINTS_DESCRIPTION,
      {
        mine: z.boolean().optional().describe("true: the Specs run over the caller's own documents and what each field shares"),
        spec_id: zUuid().optional().describe("Shared with the caller: only this Spec"),
      },
      readOnly,
      (a) =>
        call(
          "GET",
          a.mine ? `${BASE}/data-points` : `${BASE}/data-points/shared${a.spec_id ? `?spec_id=${enc(a.spec_id)}` : ""}`,
        ),
    ],
    [
      "talonic_access_shares",
      "Shares",
      SHARES_DESCRIPTION,
      { document_id: zUuid().optional().describe("Show who this document is shared with") },
      readOnly,
      (a) =>
        call(
          "GET",
          a.document_id ? `${BASE}/documents/${enc(a.document_id)}/shares` : `${BASE}/sharing`,
        ),
    ],
    [
      "talonic_access_share",
      "Share documents or a source",
      SHARE_DESCRIPTION,
      {
        document_ids: z.array(zUuid()).min(1).max(200).optional().describe("Documents to share"),
        scope_id: zUuid().optional().describe("Share a whole scope the caller holds"),
        source_connection_id: zUuid().optional().describe("Share a whole source the caller holds"),
        to,
        duration_days: z.number().int().min(1).max(365).optional().describe("Omit = until stopped"),
        note: z.string().max(500).optional().describe("Documents only"),
      },
      write,
      (a) => {
        if (a.document_ids)
          return call("POST", `${BASE}/shares/documents`, {
            document_ids: a.document_ids,
            to: a.to,
            ...(a.duration_days ? { duration_days: a.duration_days } : {}),
            ...(a.note ? { note: a.note } : {}),
          })
        return call("POST", `${BASE}/shares/scopes`, {
          ...(a.scope_id ? { scope_id: a.scope_id } : {}),
          ...(a.source_connection_id ? { source_connection_id: a.source_connection_id } : {}),
          to: a.to,
          ...(a.duration_days ? { duration_days: a.duration_days } : {}),
        })
      },
    ],
    [
      "talonic_access_stop_share",
      "Stop a share",
      STOP_SHARE_DESCRIPTION,
      {
        kind: z.enum(["document", "scope"]),
        id: zUuid().describe("The share id from talonic_access_shares"),
      },
      destructive,
      (a) => call("POST", `${BASE}/shares/${a.kind}/${enc(a.id)}/stop`),
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
