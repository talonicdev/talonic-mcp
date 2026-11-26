import { afterEach, describe, expect, it, vi } from "vitest"
import { CREDENTIAL_CONNECTORS, probeIntegrationsAccess } from "../../src/tools/integrations"
import { createServer } from "../../src/server-factory"
import { integrationsAccessCached, SCOPES_SUPPORTED } from "../../src/http-server"

const CONN = "11111111-1111-4111-8111-111111111111"
const AUTH = "22222222-2222-4222-8222-222222222222"
const API = "https://api.talonic.com/v1"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
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
      method: init.method,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: new Headers(init.headers).get("authorization"),
      count: fetchMock.mock.calls.length,
    }
  }
}

const TOOLS = [
  "talonic_integrations_connect",
  "talonic_integrations_connect_status",
  "talonic_integrations_connectors",
  "talonic_sources_browse",
  "talonic_sources_connections",
  "talonic_sources_import",
  "talonic_sources_imports",
  "talonic_sources_sync_now",
  "talonic_sources_sync_settings",
]

// the server takes `fetch` when it is made: make it after the stub, or the call would go out for real
const tools = () =>
  (createServer({ apiKey: "tlnc_test", includeIntegrationsTools: true }) as any)._registeredTools

const ours = (names: string[]) =>
  names.filter((n) => n.startsWith("talonic_integrations_") || n.startsWith("talonic_sources_"))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("integrations tools", () => {
  it("are listed only when the platform serves the integrations routes", () => {
    const off = Object.keys((createServer({ apiKey: "tlnc_test" }) as any)._registeredTools)
    expect(ours(off)).toEqual([])
    expect(ours(Object.keys(tools())).sort()).toEqual(TOOLS)
  })

  it("marks reads read-only and connect, import, sync as writes", () => {
    const t = tools()
    for (const n of [
      "talonic_integrations_connectors",
      "talonic_integrations_connect_status",
      "talonic_sources_connections",
      "talonic_sources_browse",
      "talonic_sources_imports",
    ])
      expect(t[n].annotations.readOnlyHint, n).toBe(true)
    for (const n of [
      "talonic_integrations_connect",
      "talonic_sources_import",
      "talonic_sources_sync_now",
      "talonic_sources_sync_settings",
    ]) {
      expect(t[n].annotations.readOnlyHint, n).toBe(false)
      expect(t[n].annotations.destructiveHint, n).toBe(false)
    }
  })

  it("starts a browser connect and hands back the link, id, expiry and what to do next", async () => {
    const call = stub({
      id: AUTH,
      object: "integration_authorization",
      connector: "gmail",
      status: "pending",
      authorize_url: "https://app.talonic.com/connect/x",
      expires_at: "2026-11-25T12:30:00Z",
    })
    const res = await tools().talonic_integrations_connect.handler({
      connector: "gmail",
      send: true,
      intake: { labels: ["INBOX"] },
    })
    expect(call()).toMatchObject({
      url: `${API}/integrations/gmail/authorize`,
      method: "POST",
      body: { send: true, intake: { labels: ["INBOX"] } },
      auth: "Bearer tlnc_test",
    })
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toMatchObject({
      id: AUTH,
      authorize_url: "https://app.talonic.com/connect/x",
      expires_at: "2026-11-25T12:30:00Z",
    })
    expect(res.structuredContent.instructions).toContain("talonic_integrations_connect_status")
  })

  it("sends an empty body when no option is given", async () => {
    const call = stub({ id: AUTH })
    await tools().talonic_integrations_connect.handler({ connector: "Google-Drive " })
    expect(call()).toMatchObject({
      url: `${API}/integrations/google-drive/authorize`,
      body: {},
    })
  })

  it.each(CREDENTIAL_CONNECTORS)(
    "refuses %s before any call: credentials never pass through the conversation",
    async (connector) => {
      const fetchMock = vi.fn()
      vi.stubGlobal("fetch", fetchMock)
      const res = await tools().talonic_integrations_connect.handler({ connector })
      expect(res.isError).toBe(true)
      expect(res.content[0].text).toContain("never pass through an agent conversation")
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it("renders the platform's refusal as a tool error", async () => {
    stub({ error: "connector_not_configured", message: "Not offered here" }, 503)
    const res = await tools().talonic_integrations_connect.handler({ connector: "dropbox" })
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain("503")
  })

  it("no tool takes a secret or mints a key", () => {
    const t = tools()
    for (const name of TOOLS) {
      const props = Object.keys(t[name].inputSchema?.shape ?? t[name].inputSchema ?? {})
      for (const p of props)
        expect(p, `${name}.${p}`).not.toMatch(
          /secret|password|api_key|access_key|connection_string|sas/,
        )
    }
    expect(Object.keys(t).filter((n) => /key|credential/.test(n))).toEqual([])
  })

  it("descriptions say personal content follows the connecting person's access", () => {
    const t = tools()
    for (const n of ["talonic_integrations_connect", "talonic_sources_connections"])
      expect(t[n].description, n).toContain("connecting person's access")
  })

  it("reads, lists, browses, imports and syncs on the right routes", async () => {
    const cases: Array<[string, Record<string, unknown>, string, string, unknown]> = [
      ["talonic_integrations_connectors", {}, "GET", `${API}/integrations/connectors`, undefined],
      [
        "talonic_integrations_connect_status",
        { authorization_id: AUTH },
        "GET",
        `${API}/integrations/authorizations/${AUTH}`,
        undefined,
      ],
      ["talonic_sources_connections", {}, "GET", `${API}/sources/connections`, undefined],
      [
        "talonic_sources_browse",
        { connection_id: CONN },
        "GET",
        `${API}/sources/${CONN}/browse`,
        undefined,
      ],
      [
        "talonic_sources_browse",
        { connection_id: CONN, folder_id: "f 1", page_token: "p2", q: "invoice" },
        "GET",
        `${API}/sources/${CONN}/browse?folder_id=f+1&page_token=p2&q=invoice`,
        undefined,
      ],
      [
        "talonic_sources_import",
        { connection_id: CONN, file_ids: ["a", "b"], tags: ["q4"] },
        "POST",
        `${API}/sources/${CONN}/import`,
        { file_ids: ["a", "b"], tags: ["q4"] },
      ],
      [
        "talonic_sources_import",
        { connection_id: CONN, file_ids: ["a"] },
        "POST",
        `${API}/sources/${CONN}/import`,
        { file_ids: ["a"] },
      ],
      [
        "talonic_sources_imports",
        { connection_id: CONN },
        "GET",
        `${API}/sources/${CONN}/imports`,
        undefined,
      ],
      [
        "talonic_sources_sync_settings",
        { connection_id: CONN },
        "GET",
        `${API}/sources/connections/${CONN}/sync`,
        undefined,
      ],
      [
        "talonic_sources_sync_settings",
        { connection_id: CONN, interval: "daily" },
        "PATCH",
        `${API}/sources/connections/${CONN}/sync`,
        { interval: "daily" },
      ],
      [
        "talonic_sources_sync_settings",
        {
          connection_id: CONN,
          scope: { type: "google_drive", entries: [{ kind: "folder", folderId: "x", name: "X" }] },
        },
        "PATCH",
        `${API}/sources/connections/${CONN}/sync`,
        {
          scope: { type: "google_drive", entries: [{ kind: "folder", folderId: "x", name: "X" }] },
        },
      ],
    ]
    for (const [name, args, method, url, body] of cases) {
      const call = stub({ data: [] })
      await tools()[name].handler(args)
      expect(call(), name).toMatchObject({ url, method, auth: "Bearer tlnc_test" })
      expect(call().body, name).toEqual(body)
    }
  })

  it("sync now accepts a 202 with no body", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(null, { status: 202 }))
    vi.stubGlobal("fetch", fetchMock)
    const res = await tools().talonic_sources_sync_now.handler({ connection_id: CONN })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect([String(url), init.method]).toEqual([
      `${API}/sources/connections/${CONN}/sync-now`,
      "POST",
    ])
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toEqual({ accepted: true, connection_id: CONN })
  })

  it("the probe is true on 200 and false on 404, 403 or a network error", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ data: [] }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await probeIntegrationsAccess("t")).toBe(true)
    expect(String(fetchMock.mock.calls[0]![0])).toBe(`${API}/integrations/connectors`)
    fetchMock.mockImplementation(async () => jsonResponse({}, 404))
    expect(await probeIntegrationsAccess("t")).toBe(false)
    fetchMock.mockImplementation(async () => jsonResponse({}, 403))
    expect(await probeIntegrationsAccess("t")).toBe(false)
    fetchMock.mockRejectedValue(new Error("down"))
    expect(await probeIntegrationsAccess("t")).toBe(false)
  })

  it("the hosted cache hides the tools on a refusal and keeps them on an unknown answer", async () => {
    let now = 0
    const clock = () => now
    expect(await integrationsAccessCached("tok-int", async () => true, clock)).toBe(true)
    now += 10 * 60_000
    expect(await integrationsAccessCached("tok-int", async () => "unknown", clock)).toBe(true)
    expect(await integrationsAccessCached("tok-int", async () => false, clock)).toBe(false)
  })

  it("the hosted connector requests the scopes these tools need", () => {
    for (const s of ["sources:read", "sources:write", "documents:write"])
      expect(SCOPES_SUPPORTED).toContain(s)
  })
})
