import { afterEach, describe, expect, it, vi } from "vitest"
import { probeAccessSharingAccess } from "../../src/tools/access"
import { createServer } from "../../src/server-factory"

const ID = "11111111-1111-4111-8111-111111111111"
const ID2 = "22222222-2222-4222-8222-222222222222"
// Not RFC-4122: version digit 0, variant digit 0.
const SCOPE = "5a1f0c3e-0000-0000-0000-00000000abcd"
const API = "https://api.talonic.com/v1/governance"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function stub(body: unknown = {}, status = 200) {
  const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(body, status))
  vi.stubGlobal("fetch", fetchMock)
  return (n = 0) => {
    const [url, init] = fetchMock.mock.calls[n] as [string, RequestInit]
    return {
      url: String(url),
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: new Headers(init.headers).get("authorization"),
      count: fetchMock.mock.calls.length,
    }
  }
}

const tools = () =>
  (createServer({ apiKey: "tlnc_test", includeAccessTools: true }) as any)._registeredTools

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("probeAccessSharingAccess", () => {
  it("is true only for 2xx with available: true", async () => {
    stub({ available: true })
    expect(await probeAccessSharingAccess("t")).toBe(true)
    stub({ available: false })
    expect(await probeAccessSharingAccess("t")).toBe(false)
    stub({ available: "yes" })
    expect(await probeAccessSharingAccess("t")).toBe(false)
    stub({ error: "nope" }, 404)
    expect(await probeAccessSharingAccess("t")).toBe(false)
  })
})

describe("talonic_access_* tools", () => {
  it("are listed only when the probe passed", () => {
    const off = Object.keys((createServer({ apiKey: "tlnc_test" }) as any)._registeredTools)
    expect(off.filter((n) => n.startsWith("talonic_access_"))).toEqual([])
    expect(
      Object.keys(tools())
        .filter((n) => n.startsWith("talonic_access_"))
        .sort(),
    ).toEqual([
      "talonic_access_data_points",
      "talonic_access_decide",
      "talonic_access_directory",
      "talonic_access_request",
      "talonic_access_requests",
      "talonic_access_share",
      "talonic_access_shares",
      "talonic_access_stop_share",
    ])
  })

  it("marks reads read-only and only stop/deny-capable tools destructive", () => {
    const t = tools()
    for (const n of ["data_points", "directory", "requests", "shares"])
      expect(t[`talonic_access_${n}`].annotations.readOnlyHint, n).toBe(true)
    for (const n of ["request", "decide", "share", "stop_share"])
      expect(t[`talonic_access_${n}`].annotations.readOnlyHint, n).toBe(false)
    expect(t.talonic_access_decide.annotations.destructiveHint).toBe(true)
    expect(t.talonic_access_stop_share.annotations.destructiveHint).toBe(true)
    expect(t.talonic_access_request.annotations.destructiveHint).toBe(false)
    expect(t.talonic_access_share.annotations.destructiveHint).toBe(false)
  })

  it("reads the directory and the requests", async () => {
    const call = stub({})
    await tools().talonic_access_directory.handler({})
    await tools().talonic_access_requests.handler({})
    expect(call(0)).toMatchObject({
      url: `${API}/directory`,
      method: "GET",
      auth: "Bearer tlnc_test",
    })
    expect(call(1)).toMatchObject({ url: `${API}/access-requests`, method: "GET" })
  })

  it("asks for access with exactly one of source or scope", async () => {
    const call = stub({ id: ID })
    const body = { scope_id: SCOPE, purpose: "audit", duration_days: 7 }
    await tools().talonic_access_request.handler(body)
    expect(call()).toMatchObject({ url: `${API}/access-requests`, method: "POST", body })
    const both = await tools().talonic_access_request.handler({
      ...body,
      source_connection_id: ID,
    })
    const none = await tools().talonic_access_request.handler({ purpose: "x", duration_days: 1 })
    expect(both.isError).toBe(true)
    expect(none.isError).toBe(true)
    expect(call().count).toBe(1)
  })

  it("validates request inputs, scope ids that are not RFC-4122 included", () => {
    const schema = (tools().talonic_access_request as any).inputSchema
    const ok = { scope_id: SCOPE, purpose: "p", duration_days: 90 }
    expect(schema.safeParse(ok).success).toBe(true)
    expect(schema.safeParse({ ...ok, duration_days: 91 }).success).toBe(false)
    expect(schema.safeParse({ ...ok, purpose: "" }).success).toBe(false)
    expect(schema.safeParse({ ...ok, purpose: "x".repeat(501) }).success).toBe(false)
  })

  it("approves, stops and denies (reason required)", async () => {
    const call = stub({})
    const h = tools().talonic_access_decide.handler
    await h({ id: ID, decision: "approve" })
    await h({ id: ID, decision: "stop" })
    await h({ id: ID, decision: "deny", reason: "not needed" })
    const noReason = await h({ id: ID, decision: "deny" })
    expect(call(0)).toMatchObject({ url: `${API}/access-requests/${ID}/approve`, method: "POST" })
    expect(call(1)).toMatchObject({ url: `${API}/access-requests/${ID}/stop`, method: "POST" })
    expect(call(2)).toMatchObject({
      url: `${API}/access-requests/${ID}/deny`,
      method: "POST",
      body: { reason: "not needed" },
    })
    expect(noReason.isError).toBe(true)
    expect(call().count).toBe(3)
  })

  it("lists shares, or one document's shares", async () => {
    const call = stub({ available: true, given: [], received: [] })
    await tools().talonic_access_shares.handler({})
    await tools().talonic_access_shares.handler({ document_id: ID })
    expect(call(0)).toMatchObject({ url: `${API}/sharing`, method: "GET" })
    expect(call(1)).toMatchObject({ url: `${API}/documents/${ID}/shares`, method: "GET" })
  })

  it("shares documents, or a whole scope when no document_ids", async () => {
    const call = stub({})
    const h = tools().talonic_access_share.handler
    await h({
      document_ids: [ID, ID2],
      to: { type: "person", id: ID2 },
      duration_days: 30,
      note: "fyi",
    })
    await h({ scope_id: SCOPE, to: { type: "everyone" } })
    await h({ source_connection_id: ID, to: { type: "group", id: ID2 }, duration_days: 5 })
    expect(call(0)).toMatchObject({
      url: `${API}/shares/documents`,
      method: "POST",
      body: {
        document_ids: [ID, ID2],
        to: { type: "person", id: ID2 },
        duration_days: 30,
        note: "fyi",
      },
    })
    expect(call(1)).toMatchObject({
      url: `${API}/shares/scopes`,
      method: "POST",
      body: { scope_id: SCOPE, to: { type: "everyone" } },
    })
    expect(call(2)).toMatchObject({
      url: `${API}/shares/scopes`,
      body: { source_connection_id: ID, to: { type: "group", id: ID2 }, duration_days: 5 },
    })
  })

  it("stops a share by kind", async () => {
    const call = stub({})
    await tools().talonic_access_stop_share.handler({ kind: "document", id: ID })
    await tools().talonic_access_stop_share.handler({ kind: "scope", id: SCOPE })
    expect(call(0)).toMatchObject({ url: `${API}/shares/document/${ID}/stop`, method: "POST" })
    expect(call(1)).toMatchObject({ url: `${API}/shares/scope/${SCOPE}/stop`, method: "POST" })
  })

  it("data points: shared with the caller by default, the caller's own with mine", async () => {
    const call = stub({})
    await tools().talonic_access_data_points.handler({})
    await tools().talonic_access_data_points.handler({ spec_id: ID })
    await tools().talonic_access_data_points.handler({ mine: true })
    expect(call(0)).toMatchObject({ url: `${API}/data-points/shared`, method: "GET" })
    expect(call(1)).toMatchObject({ url: `${API}/data-points/shared?spec_id=${ID}`, method: "GET" })
    expect(call(2)).toMatchObject({ url: `${API}/data-points`, method: "GET" })
  })
})
