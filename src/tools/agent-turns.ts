import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { zUuid, type ToolResult } from "./_shared.js"
import { apiJson, buildUrl, runTool } from "./_http.js"

/**
 * Agent turn tools: the person's own agent turns and home page over
 * `/v1/agent/turns/*` and `/v1/agent/home/page`. A turn the agent paused in
 * the web app waits for its person's decision; these tools read it and decide
 * it as that person, with their permissions as they are now.
 */

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

const GET_TURN_DESCRIPTION = [
  "Read one of the person's agent turns: status (awaiting_confirmation while a step waits for their decision), events and result.",
  "USE WHEN: before talonic_agent_confirm_turn, to show the person the step that waits.",
  "NOT FOR: answers of talonic_ask (talonic_get_answer).",
  "",
  "ARGS: `turn_id`.",
  "RETURNS: { id, status, events[], result, userMessage }. Another person's turn is not found.",
].join("\n")

export const turnInputSchema = { turn_id: zUuid() }

/** @internal */
export function handleGetTurn(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { turn_id: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", `/v1/agent/turns/${encodeURIComponent(args.turn_id)}`),
  )
}

const CONFIRM_DESCRIPTION = [
  "Run (confirmed true) or decline (false) the step one of the person's turns is waiting for. Only on the person's explicit answer. A repeat, or a turn not waiting, changes nothing.",
  "USE WHEN: the person approved or declined the paused step shown by talonic_agent_get_turn.",
  "NOT FOR: drafts in the thread (talonic_thread_decide_draft); turns started by talonic_ask, which cannot be continued.",
  "",
  "ARGS: `turn_id`, `confirmed`.",
  "RETURNS: { ok, id, status }.",
].join("\n")

export const confirmInputSchema = { turn_id: zUuid(), confirmed: z.boolean() }

/** @internal */
export function handleConfirmTurn(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { turn_id: string; confirmed: boolean },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "POST",
      `/v1/agent/turns/${encodeURIComponent(args.turn_id)}/confirm`,
      { body: { confirmed: args.confirmed } },
    ),
  )
}

const HOME_DESCRIPTION = [
  "Read the person's own home page in the workspace: its HTML, when it was built, and how many builds back it can be stepped.",
  "USE WHEN: the person asks what their home page shows.",
  "NOT FOR: workspace data (talonic_search, talonic_ask).",
  "",
  "ARGS: none.",
  "RETURNS: { html (null when none), builtAt, undo }.",
].join("\n")

/** @internal */
export function handleHomePage(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/agent/home/page"))
}

/** Whether the credential is a person with `agent:read` (`GET /v1/agent/home/page` → 200). Listing visibility only. */
export async function probeAgentTurnsAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/agent/home/page"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Register the `talonic_agent_*` turn tools. */
export function registerAgentTurnTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_agent_get_turn",
    {
      title: "Read an agent turn",
      description: GET_TURN_DESCRIPTION,
      inputSchema: turnInputSchema,
      annotations: { title: "Read an agent turn", ...readOnly },
    },
    async (a: { turn_id: string }) => handleGetTurn(getToken, baseUrl, a),
  )
  server.registerTool(
    "talonic_agent_confirm_turn",
    {
      title: "Confirm a paused agent step",
      description: CONFIRM_DESCRIPTION,
      inputSchema: confirmInputSchema,
      annotations: {
        title: "Confirm a paused agent step",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (a: { turn_id: string; confirmed: boolean }) => handleConfirmTurn(getToken, baseUrl, a),
  )
  server.registerTool(
    "talonic_agent_home_page",
    {
      title: "Read the home page",
      description: HOME_DESCRIPTION,
      inputSchema: {},
      annotations: { title: "Read the home page", ...readOnly },
    },
    async () => handleHomePage(getToken, baseUrl),
  )
}
