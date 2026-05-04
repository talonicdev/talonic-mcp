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
 * Wrap a value as a single-text-item tool result. Stable JSON shape so
 * downstream parsing is reliable across tools.
 *
 * @internal
 */
export function jsonOk(value: unknown): ToolSuccessResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  }
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
        text: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      },
    ],
  }
}
