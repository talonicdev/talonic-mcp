import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, runTool, sleep as defaultSleep } from "./_http.js"
import { validationError, type ToolResult } from "./_shared.js"
import { widgetToolMeta } from "../widgets/types.js"

/**
 * Ask tools — natural-language questions over the workspace corpus, answered
 * by the Talonic agent with citations and verification (`POST /v1/ask` is
 * create-then-poll; the SSE stream is not usable over MCP, so we poll).
 *
 * `talonic_ask` starts the ask and waits a bounded time; `talonic_get_answer`
 * is the read-only poll for asks that outlive the wait.
 */

export const ASK_POLL_INTERVAL_MS = 2000
export const ASK_DEFAULT_WAIT_S = 45
export const ASK_MAX_WAIT_S = 55

const POLL_HINT = "still processing — call talonic_get_answer with this ask_id in a few seconds"

const ASK_DESCRIPTION = [
  "Ask a natural-language question over the workspace's documents and get a cited, verified answer (markdown). The Talonic agent plans over the structured field plane, runs read-only SQL over extracted cells, reads document text, and grounds every load-bearing claim in a source span. Consumes credits.",
  "",
  "USE WHEN: the user asks an open question about their documents ('which vendors invoiced us twice in May?'), wants a summary across documents, or the answer needs reasoning over several fields.",
  "NOT FOR: reading a known field's values (talonic_field_values, free) or filtering documents by a known value (talonic_filter, free); locating which field holds a concept (talonic_find_data).",
  "ARGS: `question`; optional `scope` { document_ids[], schema_id, pipeline_id, data_product_id, document_type, source_id, tags[], ingested_after, ingested_before } (ANDed), `conversation_id` (continue a thread), `output_format` { instruction, template }, `wait_seconds` (0–55, default 45).",
  "RETURNS: { ask_id, status ('completed'|'processing'|'error'), conversation_id, answer (markdown), citations[] { quote, document_id, kind, filename, app_url }, verification { verdict, checks_total, checks_unsupported, correction }, usage { tokens, credits_charged }, tool_calls, artifacts[], waited_ms }. If status is still 'processing' after the wait, call talonic_get_answer with the ask_id.",
].join("\n")

const GET_ANSWER_DESCRIPTION = [
  "Poll an ask started by talonic_ask that was still processing when the wait ended.",
  "",
  "USE WHEN: talonic_ask returned status 'processing' with an ask_id — poll every few seconds until 'completed' or 'error'.",
  "NOT FOR: asking a new question (talonic_ask).",
  "ARGS: `ask_id`.",
  "RETURNS: the same answer envelope as talonic_ask (answer, citations[], verification, usage) or { status: 'processing', poll_hint }.",
].join("\n")

const uuid = z.string().uuid()
const scopeSchema = z
  .object({
    document_ids: z.array(uuid).max(500).optional(),
    schema_id: uuid.optional(),
    pipeline_id: uuid.optional(),
    data_product_id: uuid.optional(),
    document_type: z.string().min(1).optional(),
    source_id: uuid.optional(),
    tags: z.array(z.string().min(1)).max(50).optional(),
    ingested_after: z.string().min(1).optional(),
    ingested_before: z.string().min(1).optional(),
  })
  .optional()
  .describe("Restrict the question to a slice of the workspace; present fields are ANDed.")

const askInputSchema = {
  question: z.string().min(1).max(4000).describe("The question, in the user's words."),
  scope: scopeSchema,
  conversation_id: uuid
    .optional()
    .describe("Continue this conversation; the agent sees prior turns."),
  output_format: z
    .object({
      instruction: z.string().max(1000).optional(),
      template: z.string().max(4000).optional(),
    })
    .optional()
    .describe("Shape the answer (form only, never grounding)."),
  wait_seconds: z
    .number()
    .int()
    .min(0)
    .max(ASK_MAX_WAIT_S)
    .optional()
    .describe(
      `Seconds to wait for the answer before returning 'processing' (default ${ASK_DEFAULT_WAIT_S}, max ${ASK_MAX_WAIT_S}).`,
    ),
}

export interface AskArgs {
  question: string
  scope?: Record<string, unknown>
  conversation_id?: string
  output_format?: { instruction?: string; template?: string }
  wait_seconds?: number
}

export interface AskDeps {
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

interface AskCreateResponse {
  ask_id: string
  status?: string
  poll_url?: string
  conversation_id?: string
}

interface AskPollResponse extends Record<string, unknown> {
  ask_id?: string
  status?: string
}

function withHint(body: AskPollResponse): Record<string, unknown> {
  return body.status === "processing" ? { ...body, poll_hint: POLL_HINT } : body
}

/** @internal Exported for unit testing. */
export async function handleAsk(
  getToken: () => string,
  baseUrl: string | undefined,
  args: AskArgs,
  deps: AskDeps = {},
): Promise<ToolResult> {
  if (typeof args.question !== "string" || args.question.trim().length === 0) {
    return validationError("question must be a non-empty string.")
  }
  const sleep = deps.sleep ?? defaultSleep
  const now = deps.now ?? Date.now
  const requestedWaitS = Number.isFinite(args.wait_seconds)
    ? (args.wait_seconds as number)
    : ASK_DEFAULT_WAIT_S
  const waitS = Math.max(0, Math.min(ASK_MAX_WAIT_S, Math.floor(requestedWaitS)))
  return runTool(async () => {
    const created = await apiJson<AskCreateResponse>(getToken, baseUrl, "POST", "/v1/ask", {
      body: {
        question: args.question,
        ...(args.scope ? { scope: args.scope } : {}),
        ...(args.conversation_id ? { conversation_id: args.conversation_id } : {}),
        ...(args.output_format ? { output_format: args.output_format } : {}),
      },
      signal: AbortSignal.timeout(15000),
    })
    const pollPath = `/v1/ask/${encodeURIComponent(created.ask_id)}`
    const start = now()
    const deadline = start + waitS * 1000
    for (;;) {
      const pollTimeoutMs = Math.max(1000, Math.min(15000, deadline - now()))
      const body = await apiJson<AskPollResponse>(getToken, baseUrl, "GET", pollPath, {
        signal: AbortSignal.timeout(pollTimeoutMs),
      })
      const t = now()
      if (body.status !== "processing" || t >= deadline) {
        return { ...withHint(body), ask_id: body.ask_id ?? created.ask_id, waited_ms: t - start }
      }
      await sleep(Math.min(ASK_POLL_INTERVAL_MS, deadline - t))
    }
  })
}

/** @internal Exported for unit testing. */
export async function handleGetAnswer(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { ask_id: string },
): Promise<ToolResult> {
  return runTool(async () => {
    const body = await apiJson<AskPollResponse>(
      getToken,
      baseUrl,
      "GET",
      `/v1/ask/${encodeURIComponent(args.ask_id)}`,
    )
    return { ...withHint(body), ask_id: body.ask_id ?? args.ask_id }
  })
}

/** Register the two ask tools. @internal */
export function registerAskTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_ask",
    {
      title: "Ask a question over the workspace",
      description: ASK_DESCRIPTION,
      inputSchema: askInputSchema,
      annotations: {
        title: "Ask a question over the workspace",
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: widgetToolMeta("ask"),
    },
    async (args) => handleAsk(getToken, baseUrl, args as AskArgs),
  )
  server.registerTool(
    "talonic_get_answer",
    {
      title: "Poll an ask for its answer",
      description: GET_ANSWER_DESCRIPTION,
      inputSchema: { ask_id: uuid.describe("From talonic_ask.") },
      annotations: {
        title: "Poll an ask for its answer",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetToolMeta("getAnswer"),
    },
    async (args) => handleGetAnswer(getToken, baseUrl, args as { ask_id: string }),
  )
}
