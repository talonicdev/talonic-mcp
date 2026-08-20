import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleCreateApp,
  handleGetAppRun,
  handleGetRunRecord,
  handleListApps,
  handlePublishApp,
  handleRaiseAppReview,
  handleResolveAppReview,
  handleRunApp,
  handleSetAppEnabled,
} from "../../src/tools/apps"

const APP_ID = "33333333-3333-4333-8333-333333333333"
const RUN_ID = "44444444-4444-4444-8444-444444444444"
const REVIEW_ID = "55555555-5555-4555-8555-555555555555"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function call(fetchMock: ReturnType<typeof vi.fn>, index = 0): [string, RequestInit] {
  return fetchMock.mock.calls[index] as [string, RequestInit]
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("apps management handlers", () => {
  it("lists apps with the enabled filter and bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }))
    vi.stubGlobal("fetch", fetchMock)
    await handleListApps(() => "tok", undefined, { enabled: true, limit: 10 })
    const [rawUrl, init] = call(fetchMock)
    const url = new URL(rawUrl)
    expect(url.pathname).toBe("/v1/apps")
    expect(Object.fromEntries(url.searchParams)).toEqual({ enabled: "true", limit: "10" })
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok")
  })

  it("creates an app with slug, display name, and mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: APP_ID }))
    vi.stubGlobal("fetch", fetchMock)
    await handleCreateApp(() => "tok", "https://api.example.com", {
      slug: "load-auto-billing",
      display_name: "Load auto-billing",
      mode: "rules",
    })
    const [rawUrl, init] = call(fetchMock)
    expect(rawUrl).toBe("https://api.example.com/v1/apps")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({
      slug: "load-auto-billing",
      display_name: "Load auto-billing",
      mode: "rules",
    })
  })

  it("publishes a specific draft version via the spec'd path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ version: 4 }))
    vi.stubGlobal("fetch", fetchMock)
    await handlePublishApp(() => "tok", undefined, { app_id: APP_ID, version: 4 })
    const [rawUrl, init] = call(fetchMock)
    expect(new URL(rawUrl).pathname).toBe(`/v1/apps/${APP_ID}/versions/4/publish`)
    expect(init.method).toBe("POST")
  })

  it("enable and disable hit their lifecycle endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ enabled: true }))
    vi.stubGlobal("fetch", fetchMock)
    await handleSetAppEnabled(() => "tok", undefined, { app_id: APP_ID }, true)
    await handleSetAppEnabled(() => "tok", undefined, { app_id: APP_ID }, false)
    expect(new URL(call(fetchMock, 0)[0]).pathname).toBe(`/v1/apps/${APP_ID}/enable`)
    expect(new URL(call(fetchMock, 1)[0]).pathname).toBe(`/v1/apps/${APP_ID}/disable`)
  })

  it("runs an app with dry_run query, Idempotency-Key header, and input body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: RUN_ID }))
    vi.stubGlobal("fetch", fetchMock)
    await handleRunApp(() => "tok", undefined, {
      app_id: APP_ID,
      input: { load_id: "L-1" },
      dry_run: true,
      idempotency_key: "abc-123",
    })
    const [rawUrl, init] = call(fetchMock)
    const url = new URL(rawUrl)
    expect(url.pathname).toBe(`/v1/apps/${APP_ID}/runs`)
    expect(url.searchParams.get("dry_run")).toBe("true")
    expect(new Headers(init.headers).get("idempotency-key")).toBe("abc-123")
    expect(JSON.parse(init.body as string)).toEqual({ input: { load_id: "L-1" } })
  })

  it("get run with include_events merges the projection and the journal", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: RUN_ID, status: "completed" }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ event_type: "triggered" }] }))
    vi.stubGlobal("fetch", fetchMock)
    const result = await handleGetAppRun(() => "tok", undefined, {
      run_id: RUN_ID,
      include_events: true,
    })
    expect(new URL(call(fetchMock, 0)[0]).pathname).toBe(`/v1/runs/${RUN_ID}`)
    expect(new URL(call(fetchMock, 1)[0]).pathname).toBe(`/v1/runs/${RUN_ID}/events`)
    const merged = JSON.parse(result.content[0]!.text)
    expect(merged.run.status).toBe("completed")
    expect(merged.events.data).toHaveLength(1)
  })

  it("fetches the sealed record", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ record: {} }))
    vi.stubGlobal("fetch", fetchMock)
    await handleGetRunRecord(() => "tok", undefined, { run_id: RUN_ID })
    expect(new URL(call(fetchMock)[0]).pathname).toBe(`/v1/runs/${RUN_ID}/record`)
  })

  it("raises and resolves reviews with the two-part payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: REVIEW_ID }))
    vi.stubGlobal("fetch", fetchMock)
    await handleRaiseAppReview(() => "tok", undefined, {
      app_id: APP_ID,
      kind: "data_request",
      question: "Which tolerance applies?",
      input_contract: { type: "object" },
    })
    await handleResolveAppReview(() => "tok", undefined, {
      review_id: REVIEW_ID,
      values: { decision: "approve" },
      feedback: { proposal_verdict: "incorrect", correction: "Tolerance is 5%.", generalize: true },
    })
    expect(new URL(call(fetchMock, 0)[0]).pathname).toBe(`/v1/apps/${APP_ID}/reviews`)
    const [resolveUrl, resolveInit] = call(fetchMock, 1)
    expect(new URL(resolveUrl).pathname).toBe(`/v1/reviews/${REVIEW_ID}/resolve`)
    expect(JSON.parse(resolveInit.body as string)).toEqual({
      values: { decision: "approve" },
      feedback: { proposal_verdict: "incorrect", correction: "Tolerance is 5%.", generalize: true },
    })
  })

  it("surfaces non-OK responses as tool errors with the HTTP status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "not yet" }, 501))
    vi.stubGlobal("fetch", fetchMock)
    const result = await handleListApps(() => "tok", undefined, {})
    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toContain("HTTP 501")
  })
})
