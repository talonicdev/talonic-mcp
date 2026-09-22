import { jsonOk, toolError, type ToolResult } from "./_shared.js"

/** Default Talonic API origin for raw-fetch tools (mirrors the SDK default). */
export const DEFAULT_BASE = "https://api.talonic.com"

/**
 * A bearer-token getter that may carry the `fetch` implementation raw-fetch
 * tools must use. `createServer` attaches its User-Agent-tagging fetch so the
 * platform can attribute these calls to a client surface, exactly like the
 * SDK-backed tools. Plain getters (tests, library callers) fall back to the
 * global fetch.
 */
export type TokenSource = (() => string) & { fetch?: typeof fetch }

/** Wrap a token getter with the fetch implementation raw-fetch tools should use. */
export function withFetch(getToken: () => string, fetchImpl: typeof fetch): TokenSource {
  const source = (() => getToken()) as TokenSource
  source.fetch = fetchImpl
  return source
}

/** The fetch a raw-fetch tool must call for this token getter. */
export function resolveFetch(getToken: () => string): typeof fetch {
  return (getToken as TokenSource).fetch ?? fetch
}

/** Query-string values a raw-fetch tool may forward; `undefined`/empty are dropped. */
export type QueryParams = Record<string, string | number | boolean | undefined>

/** HTTP methods raw-fetch tools may use. */
export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE"

/** Multipart fields; arrays repeat the key (`file_urls`), `undefined` is skipped. */
export type FormFields = Record<string, string | string[] | undefined>

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
  method: HttpMethod,
  path: string,
  opts: { params?: QueryParams; body?: unknown } = {},
): Promise<T> {
  const url = buildUrl(baseUrl, path, opts.params)
  const res = await resolveFetch(getToken)(url, {
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
 * Raw multipart/form-data POST against the Talonic API (used by `/v1/run`,
 * which accepts files and `file_urls` only as form fields). Do NOT set
 * Content-Type: undici derives the boundary from the FormData body.
 *
 * @internal
 */
export async function apiForm<T = unknown>(
  getToken: () => string,
  baseUrl: string | undefined,
  path: string,
  fields: FormFields,
): Promise<T> {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (Array.isArray(value)) for (const item of value) form.append(key, item)
    else form.append(key, value)
  }
  const res = await resolveFetch(getToken)(buildUrl(baseUrl, path), {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/json" },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Talonic API error: HTTP ${res.status}${text ? ` — ${text}` : ""}`)
  }
  return (await res.json()) as T
}

/** Promise-based delay; injectable in tests. @internal */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
