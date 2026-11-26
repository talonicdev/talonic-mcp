import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, probeAccessState, runTool } from "./_http.js"
import { zUuid, type ToolResult } from "./_shared.js"

/**
 * Schema review tools: the schema changes awaiting a decision (approve or
 * reject, recorded with who and when) and the link keys that connect
 * documents sharing a value.
 *
 * All tools hit `/v1/schema-graph/*` and `/v1/linking/*` with the caller's
 * bearer; the platform owns every rule (scopes, workspace role) per call.
 *
 * Loop: talonic_schema_review_queue → talonic_schema_review_approve /
 * talonic_schema_review_reject.
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
  idempotentHint: true,
  openWorldHint: false,
}

/** True when the caller's credential can read the schema review queue (tools are listed only then). */
export async function probeSchemaReviewAccess(token: string, baseUrl?: string): Promise<boolean> {
  return (await probeAccessState(token, baseUrl, "/v1/schema-graph/review-queue")) === true
}

const D = {
  queue:
    "List the schema changes waiting for a decision (those that add, remove or retype fields in a way that can affect existing output), newest first. USE WHEN the user asks what schema changes need review. Needs `specs:read`. NOT FOR: deciding one (talonic_schema_review_approve / talonic_schema_review_reject).",
  approve:
    "Approve a schema change from the review queue: it becomes the live version. The decision records who decided and when. Confirm with the user first. USE WHEN the user accepts a change. Needs `specs:write`. NOT FOR: discarding a change (talonic_schema_review_reject).",
  reject:
    "Reject a schema change from the review queue and discard the proposed changes. The decision records who decided and when. Confirm with the user first. USE WHEN the user turns a change down. Needs `specs:write`. NOT FOR: accepting a change (talonic_schema_review_approve).",
  linkKey:
    "Make a field a link key of the workspace (documents that share its value are linked), or stop using it as one. USE WHEN the user wants documents connected by a shared value such as a customer number. `link_key_category` says what the value identifies: a party (identity), a business event (transaction) or a document reference. Turning one on with a category starts linking existing documents in the background (`backfill_triggered: true`); follow it on GET /v1/linking/backfill/progress. Needs `records:write` and an Admin of the workspace (else 403 `insufficient_role`). NOT FOR: reviewing schema changes (talonic_schema_review_queue).",
}

/**
 * Register the four schema review tools (`talonic_schema_review_*`, `talonic_link_key_set`).
 *
 * @public
 */
export function registerSchemaReviewTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const diffId = () => zUuid().describe("The schema change id (from talonic_schema_review_queue)")
  const tools: Array<
    [
      string,
      string,
      string,
      Record<string, z.ZodTypeAny>,
      typeof readOnly | typeof write,
      (a: any) => Promise<ToolResult>,
    ]
  > = [
    [
      "talonic_schema_review_queue",
      "Schema changes awaiting review",
      D.queue,
      {},
      readOnly,
      () => runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/schema-graph/review-queue")),
    ],
    [
      "talonic_schema_review_approve",
      "Approve a schema change",
      D.approve,
      { diff_id: diffId() },
      write,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `/v1/schema-graph/diffs/${encodeURIComponent(a.diff_id)}/approve`,
          ),
        ),
    ],
    [
      "talonic_schema_review_reject",
      "Reject a schema change",
      D.reject,
      { diff_id: diffId() },
      { ...write, destructiveHint: true },
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `/v1/schema-graph/diffs/${encodeURIComponent(a.diff_id)}/reject`,
          ),
        ),
    ],
    [
      "talonic_link_key_set",
      "Set or remove a link key",
      D.linkKey,
      {
        field_id: zUuid().describe("The field id (from talonic_list_fields)"),
        link_key: z.boolean().describe("true to use the field as a link key, false to stop"),
        link_key_category: z
          .enum(["identity", "transaction", "reference"])
          .optional()
          .describe("What the value identifies"),
      },
      write,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "PATCH",
            `/v1/linking/link-keys/${encodeURIComponent(a.field_id)}`,
            {
              body: {
                link_key: a.link_key,
                ...(a.link_key_category !== undefined
                  ? { link_key_category: a.link_key_category }
                  : {}),
              },
            },
          ),
        ),
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
