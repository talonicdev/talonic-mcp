import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { validationError, zUuid, type ToolResult } from "./_shared.js"
import { apiJson, buildUrl, runTool } from "./_http.js"

/**
 * My Data tools: what the person brought into the workspace, who can see it,
 * and their own sharing decisions, over `/v1/my-data/*`. Always the data of
 * the person the key or token belongs to; nothing here names another person,
 * and a personal connection (Gmail, Granola, Notion) stays its author's until
 * they share it.
 */

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const
const write = (destructive: boolean) =>
  ({
    readOnlyHint: false,
    destructiveHint: destructive,
    idempotentHint: true,
    openWorldHint: false,
  }) as const

const FEED_DESCRIPTION = [
  "Read the person's own data: per source they connected and item they brought in, who can see it now (only_me, shared, company).",
  "USE WHEN: the person asks what of theirs is in the workspace or who can see their mail or notes.",
  "NOT FOR: workspace documents in general (talonic_search).",
  "",
  "ARGS: none.",
  "RETURNS: the feed of sources and items with their visibility.",
].join("\n")

/** @internal */
export function handleFeed(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/my-data"))
}

const SHARE_DESCRIPTION = [
  "Share a source the person connected with named colleagues, or stop sharing it (an empty list stops it for everyone; the person keeps access). Only the person who connected the source can; only on their explicit instruction.",
  "USE WHEN: the person asks to share their mailbox or notes with someone, or to stop.",
  "NOT FOR: single items or tags (talonic_my_data_share_items).",
  "",
  "ARGS: `source_id`, `action` share|stop_sharing, `user_ids`.",
  "RETURNS: the updated sharing state.",
].join("\n")

export const shareInputSchema = {
  source_id: zUuid(),
  action: z.enum(["share", "stop_sharing"]),
  user_ids: z
    .array(zUuid())
    .max(200)
    .describe("Colleagues; empty with stop_sharing stops it for everyone."),
}

/** @internal */
export function handleShare(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { source_id: string; action: "share" | "stop_sharing"; user_ids: string[] },
): Promise<ToolResult> {
  const route = args.action === "share" ? "share" : "stop-sharing"
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "POST",
      `/v1/my-data/sources/${encodeURIComponent(args.source_id)}/${route}`,
      { body: { user_ids: args.user_ids } },
    ),
  )
}

const SHARE_ITEMS_DESCRIPTION = [
  "Share chosen items of a source the person connected (an email with its attachments) with one colleague, or stop sharing them (without recipient_id: with everyone).",
  "USE WHEN: the person wants one colleague to see particular emails or notes.",
  "NOT FOR: a whole source (talonic_my_data_share).",
  "",
  "ARGS: `source_id`, `action` share|stop_sharing, `document_ids`, `recipient_id` (required to share).",
  "RETURNS: what was shared or stopped.",
].join("\n")

export const shareItemsInputSchema = {
  source_id: zUuid(),
  action: z.enum(["share", "stop_sharing"]),
  document_ids: z.array(zUuid()).min(1).max(500),
  recipient_id: zUuid().optional(),
}

/** @internal */
export function handleShareItems(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    source_id: string
    action: "share" | "stop_sharing"
    document_ids: string[]
    recipient_id?: string
  },
): Promise<ToolResult> {
  const route = args.action === "share" ? "items/share" : "items/stop-sharing"
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "POST",
      `/v1/my-data/sources/${encodeURIComponent(args.source_id)}/${route}`,
      {
        body: {
          document_ids: args.document_ids,
          ...(args.recipient_id ? { recipient_id: args.recipient_id } : {}),
        },
      },
    ),
  )
}

const REQUESTS_DESCRIPTION = [
  "List field requests to the person (colleagues asking for their values of a field) and by the person. Only where field sharing is on in the workspace.",
  "USE WHEN: before deciding a request (talonic_my_data_decide_field_request).",
  "NOT FOR: who sees a whole source (talonic_my_data).",
  "",
  "ARGS: none.",
  "RETURNS: { incoming[], outgoing[] } with each request's state.",
].join("\n")

/** @internal */
export function handleFieldRequests(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/my-data/field-requests"))
}

const DECIDE_REQUEST_DESCRIPTION = [
  "Decide a field request as the person: as holder approve, deny (with text as the reason), clarify (text as the question) or stop a grant; as asker withdraw or answer (text). Only on the person's explicit instruction.",
  "USE WHEN: the person decided a request listed by talonic_my_data_field_requests.",
  "NOT FOR: sharing a whole source (talonic_my_data_share).",
  "",
  "ARGS: `request_id`, `action` approve|deny|clarify|stop|withdraw|answer, `text` (required for deny, clarify, answer).",
  "RETURNS: the request after the decision.",
].join("\n")

const ACTIONS = ["approve", "deny", "clarify", "stop", "withdraw", "answer"] as const
export const decideRequestInputSchema = {
  request_id: zUuid(),
  action: z.enum(ACTIONS),
  text: z.string().min(1).max(2000).optional(),
}

/** @internal */
export function handleDecideFieldRequest(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { request_id: string; action: (typeof ACTIONS)[number]; text?: string },
): Promise<ToolResult> {
  const key =
    args.action === "deny"
      ? "reason"
      : args.action === "clarify"
        ? "comment"
        : args.action === "answer"
          ? "text"
          : null
  if (key && !args.text)
    return Promise.resolve(validationError(`text is required to ${args.action}.`))
  const body = key ? { [key]: args.text } : undefined
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "POST",
      `/v1/my-data/field-requests/${encodeURIComponent(args.request_id)}/${args.action}`,
      body ? { body } : {},
    ),
  )
}

/** Whether the credential is a person with `documents:read` (`GET /v1/me/data` → 200). Listing visibility only. */
export async function probeMyDataAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/me/data"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Register the `talonic_my_data_*` tools. */
export function registerMyDataTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const tools: Array<
    [
      string,
      string,
      string,
      Record<string, z.ZodTypeAny>,
      Record<string, boolean>,
      (a: any) => Promise<ToolResult>,
    ]
  > = [
    [
      "talonic_my_data",
      "Read my data and who sees it",
      FEED_DESCRIPTION,
      {},
      readOnly,
      () => handleFeed(getToken, baseUrl),
    ],
    [
      "talonic_my_data_share",
      "Share or stop sharing a source",
      SHARE_DESCRIPTION,
      shareInputSchema,
      write(false),
      (a) => handleShare(getToken, baseUrl, a),
    ],
    [
      "talonic_my_data_share_items",
      "Share or stop sharing items",
      SHARE_ITEMS_DESCRIPTION,
      shareItemsInputSchema,
      write(false),
      (a) => handleShareItems(getToken, baseUrl, a),
    ],
    [
      "talonic_my_data_field_requests",
      "List field requests",
      REQUESTS_DESCRIPTION,
      {},
      readOnly,
      () => handleFieldRequests(getToken, baseUrl),
    ],
    [
      "talonic_my_data_decide_field_request",
      "Decide a field request",
      DECIDE_REQUEST_DESCRIPTION,
      decideRequestInputSchema,
      write(false),
      (a) => handleDecideFieldRequest(getToken, baseUrl, a),
    ],
  ]
  for (const [name, title, description, inputSchema, annotations, handler] of tools) {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations } },
      async (args: unknown) => handler(args),
    )
  }
}
