import { createHash } from "node:crypto"
import { ApiHttpError, jsonOk, toolError, type ToolResult } from "./_shared.js"

/**
 * `Idempotency-Key` support for write tools. The platform stores the first
 * response for a key and replays it for a retry with the same key and the
 * same request, so an agent that repeats a call (a timeout, a reconnect, a
 * second thought) never applies the write twice.
 */

/** Canonical JSON (sorted keys, `undefined` dropped) so equal args hash equally. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(",")}}`
}

/**
 * The key a decision-style write sends when the caller gave none:
 * `mcp-` + the first 40 hex characters of sha256(tool name + canonical args).
 * The same call always yields the same key; any change to the args yields a
 * new one. The `idempotency_key` arg itself is not part of the hash.
 *
 * @internal
 */
export function deriveIdempotencyKey(tool: string, args: Record<string, unknown>): string {
  const { idempotency_key: _ignored, ...rest } = args
  const digest = createHash("sha256")
    .update(`${tool}\n${canonical(rest)}`)
    .digest("hex")
  return `mcp-${digest.slice(0, 40)}`
}

/**
 * The `Idempotency-Key` header for one call: the caller's key, else a derived
 * one when `derive` is set, else none (writes that are meant to be repeatable).
 *
 * @internal
 */
export function idempotencyHeaders(
  tool: string,
  args: Record<string, unknown>,
  derive: boolean,
): Record<string, string> {
  const given =
    typeof args["idempotency_key"] === "string" ? (args["idempotency_key"] as string) : ""
  const key = given.trim() || (derive ? deriveIdempotencyKey(tool, args) : "")
  return key ? { "Idempotency-Key": key } : {}
}

/** One plain sentence for write-tool descriptions. @internal */
export const IDEMPOTENT_SENTENCE =
  "Safe to retry: repeating the same call returns the first result and never applies it twice (pass idempotency_key to choose the key)."

/**
 * Run a write and shape errors, turning the platform's in-progress answer for
 * a repeated key into a plain "still running" message.
 *
 * @internal
 */
export async function runWrite(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return jsonOk(await fn())
  } catch (err) {
    if (
      err instanceof ApiHttpError &&
      err.status === 409 &&
      err.body.includes("idempotency_request_in_progress")
    ) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Still running: the first attempt of this exact call has not finished yet. Retry shortly with the same arguments to get its result; it will not be applied twice.",
          },
        ],
      }
    }
    return toolError(err)
  }
}
