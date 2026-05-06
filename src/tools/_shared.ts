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
