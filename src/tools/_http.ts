import { jsonOk, toolError, type ToolResult } from "./_shared.js"

/** Default Talonic API origin for raw-fetch tools (mirrors the SDK default). */
export const DEFAULT_BASE = "https://api.talonic.com"

/** Query-string values a raw-fetch tool may forward; `undefined`/empty are dropped. */
export type QueryParams = Record<string, string | number | boolean | undefined>

/**
 * Build a `/v1/...` URL with the defined query params only.
 *
 * @internal
 */
export function buildUrl(
  baseUrl: string | undefined,
  path: string,
  params: QueryParams = {},
): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue
    qs.set(k, String(v))
  }
  return `${baseUrl ?? DEFAULT_BASE}${path}${qs.size ? `?${qs}` : ""}`
}

/**
 * Raw JSON call against the Talonic API with the caller's bearer, for routes
 * the `@talonic/node` SDK does not wrap yet. Returns the parsed body on 2xx;
 * throws an `Error` carrying the status and the response text otherwise, so
 * the caller's `toolError()` renders the API's own error envelope.
 *
 * @internal
 */
export async function apiJson<T = unknown>(
  getToken: () => string,
  baseUrl: string | undefined,
  method: "GET" | "POST",
  path: string,
  opts: { params?: QueryParams; body?: unknown } = {},
): Promise<T> {
  const url = buildUrl(baseUrl, path, opts.params)
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/json",
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Talonic API error: HTTP ${res.status}${text ? ` — ${text}` : ""}`)
  }
  return (await res.json()) as T
}

/**
 * Run a raw-fetch tool body and shape any throw as a tool error result.
 *
 * @internal
 */
export async function runTool(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return jsonOk(await fn())
  } catch (err) {
    return toolError(err)
  }
}
