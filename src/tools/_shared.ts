import { TalonicError } from "@talonic/node"

/**
 * Successful tool result envelope. The `content` array follows the MCP
 * `CallToolResult` shape. We always emit one text item with the JSON
 * payload; agents parse it back themselves.
 *
 * The `[key: string]: unknown` index signature exists to satisfy the
 * MCP SDK's structural type, which permits arbitrary additional keys.
 *
 * @internal
 */
export interface ToolSuccessResult {
  content: Array<{ type: "text"; text: string }>
  [key: string]: unknown
}

/**
 * Failure tool result envelope. Sets `isError: true` per the MCP spec
 * so clients render this as an error rather than a normal response.
 *
 * @internal
 */
export interface ToolErrorResult {
  content: Array<{ type: "text"; text: string }>
  isError: true
  [key: string]: unknown
}

export type ToolResult = ToolSuccessResult | ToolErrorResult

/**
 * Non-2xx response from a raw-fetch Talonic API call. Keeps the status so
 * {@link toolError} can tell the model what to do next instead of handing
 * it a bare status code.
 *
 * @internal
 */
export class ApiHttpError extends Error {
  readonly status: number
  readonly body: string
  constructor(status: number, body: string) {
    super(`Talonic API error: HTTP ${status}${body ? ` — ${clampText(body, 1500)}` : ""}`)
    this.name = "ApiHttpError"
    this.status = status
    this.body = body
  }
}

/** Build an {@link ApiHttpError} from a failed fetch response. @internal */
export async function apiHttpError(res: Response): Promise<ApiHttpError> {
  const text = await res.text().catch(() => "")
  return new ApiHttpError(res.status, text)
}

function clampText(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}… (${s.length - n} more chars)` : s
}

/**
 * What the model should do about an HTTP status. One line, phrased as the
 * next step, so an agent with no access to Talonic's docs or code can
 * recover (or tell the user what is missing) instead of retrying blindly.
 *
 * @internal
 */
export function hintForStatus(status: number): string | null {
  if (status === 400 || status === 422)
    return "Next step: an argument is malformed or missing. Check the ids and field values against the tool's input schema, then retry once."
  if (status === 401)
    return "Next step: the Talonic connection is not signed in or the session expired. Ask the user to reconnect Talonic (Settings > Connectors), then retry."
  if (status === 402)
    return "Next step: the workspace has run out of credits. Tell the user to top up at app.talonic.com (Billing); talonic_get_balance shows the balance. Do not retry."
  if (status === 403)
    return "Next step: this account lacks the permission, scope or role for this action. Tell the user which action was refused; an admin of the workspace can grant it. Do not retry."
  if (status === 404)
    return "Next step: the id does not exist in this workspace, or the feature is not enabled here. Look the id up again with the matching list or search tool; do not guess ids."
  if (status === 409)
    return "Next step: the resource changed or is held by someone else (conflict). Re-read its current state, then decide whether to retry."
  if (status === 413)
    return "Next step: the payload is too large. Send fewer items or a smaller file."
  if (status === 429) return "Next step: rate limited. Wait a few seconds, then retry once."
  if (status >= 500)
    return "Next step: Talonic had a temporary server error. Retry once; if it fails again, tell the user the service is having problems."
  return null
}

/**
 * Wrap a value as a tool result. Returns both the legacy text envelope
 * (`content[0].text`) for clients that parse strings, and the
 * `structuredContent` field for MCP clients that consume typed JSON
 * directly. The `structuredContent` shape is what each tool's
 * `outputSchema` declares.
 *
 * Note: `structuredContent` must be a JSON object (record), not an
 * array or primitive. Tools that would otherwise return an array wrap
 * it in `{ data: [...] }` (which all our list-style tools already do
 * via the SDK).
 *
 * @internal
 */
export function jsonOk(value: unknown): ToolSuccessResult {
  const result: ToolSuccessResult = {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    result["structuredContent"] = value as Record<string, unknown>
  }
  return result
}

/**
 * Build a tool error result for input-validation failures detected at
 * the MCP layer, before any API call. Use this for fast-fail checks
 * such as required arguments missing or mutually exclusive flags
 * provided together. The agent gets a clear, structured message
 * instead of an unintelligible API error.
 *
 * @internal
 */
export function validationError(message: string): ToolErrorResult {
  return {
    isError: true,
    content: [{ type: "text", text: `Validation error: ${message}` }],
  }
}

/**
 * Convert any thrown error into a tool error result with stable
 * formatting. Talonic API errors include `code`, `status`, and
 * `request_id` so the user (or another tool call) can act on them.
 *
 * @internal
 */
export function toolError(err: unknown): ToolErrorResult {
  if (err instanceof TalonicError) {
    const lines = [
      `Talonic API error: ${err.message}`,
      `code: ${err.code}`,
      `status: ${err.status}`,
    ]
    if (err.requestId) lines.push(`request_id: ${err.requestId}`)
    const hint = hintForStatus(err.status)
    if (hint) lines.push(hint)
    return {
      isError: true,
      content: [{ type: "text", text: lines.join("\n") }],
    }
  }
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: describeError(err),
      },
    ],
  }
}

function describeError(err: unknown): string {
  if (err instanceof ApiHttpError) {
    const hint = hintForStatus(err.status)
    return hint ? `${err.message}\n${hint}` : err.message
  }
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return "Error: the Talonic API did not answer in time. Retry once; long jobs have a status tool to poll instead of waiting."
  }
  if (err instanceof Error && /fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET/i.test(err.message)) {
    return `Error: could not reach the Talonic API (${err.message}). Retry once; if it fails again, tell the user Talonic is unreachable.`
  }
  return `Error: ${err instanceof Error ? err.message : String(err)}`
}
