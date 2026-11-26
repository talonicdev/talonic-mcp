import { apiHttpError, jsonOk, toolError, type ToolResult } from "./_shared.js"

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
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

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
  opts: { params?: QueryParams; body?: unknown; signal?: AbortSignal } = {},
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
    ...(opts.signal ? { signal: opts.signal } : {}),
  })
  if (!res.ok) {
    throw await apiHttpError(res)
  }
  // A 202/204 answer may carry no body: that is `null`, never a parse error.
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

/**
 * Raw multipart/form-data POST against the Talonic API (used by `/v1/run`,
 * which accepts files and `file_urls` only as form fields). Do NOT set
 * Content-Type: undici derives the boundary from the FormData body.
 *
 * @internal
 */
/**
 * Probe answer: the feature is available (true), refused (false), or the
 * platform could not be asked ("unknown": timeout, network, 5xx, 429).
 *
 * @internal
 */
export type ProbeAnswer = boolean | "unknown"

/**
 * GET `path` with the caller's token and classify the answer. A refusal
 * (401/403/404 and other 4xx) is a definite false; only a reachable 2xx is
 * true. `accept` lets a caller require more than a 2xx (e.g. a non-empty list).
 *
 * @internal
 */
export async function probeAccessState(
  token: string,
  baseUrl: string | undefined,
  path: string,
  accept: (body: unknown) => boolean = () => true,
  params: QueryParams = {},
): Promise<ProbeAnswer> {
  try {
    const res = await fetch(buildUrl(baseUrl, path, params), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    if (res.status >= 500 || res.status === 429) return "unknown"
    if (!res.ok) return false
    const body = await res.json().catch(() => null)
    return accept(body)
  } catch {
    return "unknown"
  }
}

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
    throw await apiHttpError(res)
  }
  return (await res.json()) as T
}

/** A binary download: the bytes with the filename and media type the API named. */
export interface BinaryFile {
  bytes: Buffer
  filename: string | null
  mimeType: string
}

/**
 * Raw binary GET against the Talonic API (file downloads). Refuses a body
 * over `maxBytes`, by its Content-Length before reading when the API sends
 * one, otherwise after reading. Errors are thrown like {@link apiJson}'s.
 *
 * @internal
 */
export async function apiBinary(
  getToken: () => string,
  baseUrl: string | undefined,
  path: string,
  opts: { params?: QueryParams; maxBytes: number },
): Promise<BinaryFile> {
  const res = await resolveFetch(getToken)(buildUrl(baseUrl, path, opts.params), {
    method: "GET",
    headers: { Authorization: `Bearer ${getToken()}`, Accept: "*/*" },
  })
  if (!res.ok) {
    throw await apiHttpError(res)
  }
  const tooLarge = (n: number) =>
    new Error(`File is ${n} bytes, over the ${opts.maxBytes}-byte limit for a tool result.`)
  const declared = Number(res.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > opts.maxBytes) {
    await res.body?.cancel().catch(() => {})
    throw tooLarge(declared)
  }
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length > opts.maxBytes) throw tooLarge(bytes.length)
  return {
    bytes,
    filename: filenameFromDisposition(res.headers.get("content-disposition")),
    mimeType: (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0]!.trim(),
  }
}

/** The filename of a Content-Disposition header (RFC 5987 `filename*` first), or null. */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*\s*=\s*(?:UTF-8'[^']*')?([^;]+)/i.exec(header)
  const plain = /filename\s*=\s*"([^"]*)"|filename\s*=\s*([^;]+)/i.exec(header)
  const raw = star?.[1] ?? plain?.[1] ?? plain?.[2]
  if (!raw) return null
  try {
    return decodeURIComponent(raw.trim())
  } catch {
    return raw.trim()
  }
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
