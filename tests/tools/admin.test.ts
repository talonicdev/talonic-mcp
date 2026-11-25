import { afterEach, describe, expect, it, vi } from "vitest"
import { adminGroup } from "../../src/tools/admin"
import { runGroupTool, type GroupTool } from "../../src/tools/_groups"
import { createServer } from "../../src/server-factory"

const KEY_ID = "11111111-2222-4333-8444-555555555555"
const HOOK_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const ctx = { getToken: () => "tlnc_key", baseUrl: undefined }

function tool(name: string): GroupTool {
  const t = adminGroup.tools.find((x) => x.name === name)
  if (!t) throw new Error(`no tool ${name}`)
  return t
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function stub(body: unknown = {}, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body, status))
  vi.stubGlobal("fetch", fetchMock)
  return () => {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    return {
      url,
      method: init.method,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: new Headers(init.headers).get("authorization"),
    }
  }
}

afterEach(() => vi.unstubAllGlobals())

const API = "https://api.talonic.com"

describe("admin: API key lifecycle", () => {
  it("create posts name, scopes and expiry", async () => {
    const call = stub({ id: KEY_ID, key: "tlnc_secret" })
    const res = await runGroupTool(tool("talonic_create_api_key"), ctx, {
      name: "dashboard",
      scopes: ["read"],
      expires_at: "2027-01-01T00:00:00Z",
    })
    expect(res.isError).toBeUndefined()
    expect(call()).toEqual({
      url: `${API}/v1/account/keys`,
      method: "POST",
      body: { name: "dashboard", scopes: ["read"], expires_at: "2027-01-01T00:00:00Z" },
      auth: "Bearer tlnc_key",
    })
  })

  it("list reads the keys", async () => {
    const call = stub({ data: [] })
    await runGroupTool(tool("talonic_list_api_keys"), ctx, {})
    expect(call()).toMatchObject({ url: `${API}/v1/account/keys`, method: "GET" })
  })

  it("revoke deletes the key by id", async () => {
    const call = stub({ id: KEY_ID, revoked: true })
    await runGroupTool(tool("talonic_revoke_api_key"), ctx, { key_id: KEY_ID })
    expect(call()).toMatchObject({ url: `${API}/v1/account/keys/${KEY_ID}`, method: "DELETE" })
  })

  it("the create description says the secret is shown once and must not be repeated", () => {
    const d = tool("talonic_create_api_key").description
    expect(d).toMatch(/ONCE/)
    expect(d).toMatch(/never repeat/)
    expect(d).toMatch(/scopes the calling credential already holds/)
  })
})

describe("admin: webhooks", () => {
  it("create, get, update, delete hit the right routes with the right bodies", async () => {
    let call = stub({ id: HOOK_ID })
    await runGroupTool(tool("talonic_create_webhook"), ctx, {
      url: "https://example.test/hook",
      events: ["extraction.complete"],
      secret: "s3cret",
    })
    expect(call()).toMatchObject({
      url: `${API}/v1/webhooks`,
      method: "POST",
      body: { url: "https://example.test/hook", events: ["extraction.complete"], secret: "s3cret" },
    })
    vi.unstubAllGlobals()

    call = stub({ id: HOOK_ID })
    await runGroupTool(tool("talonic_get_webhook"), ctx, { id: HOOK_ID })
    expect(call()).toMatchObject({ url: `${API}/v1/webhooks/${HOOK_ID}`, method: "GET" })
    vi.unstubAllGlobals()

    call = stub({ id: HOOK_ID })
    await runGroupTool(tool("talonic_update_webhook"), ctx, { id: HOOK_ID, is_active: false })
    expect(call()).toEqual({
      url: `${API}/v1/webhooks/${HOOK_ID}`,
      method: "PATCH",
      body: { is_active: false },
      auth: "Bearer tlnc_key",
    })
    vi.unstubAllGlobals()

    call = stub({ deleted: true, id: HOOK_ID })
    await runGroupTool(tool("talonic_delete_webhook"), ctx, { id: HOOK_ID })
    expect(call()).toMatchObject({ url: `${API}/v1/webhooks/${HOOK_ID}`, method: "DELETE" })
  })

  it("lists webhooks and event types", async () => {
    let call = stub({ data: [] })
    await runGroupTool(tool("talonic_list_webhooks"), ctx, {})
    expect(call().url).toBe(`${API}/v1/webhooks`)
    vi.unstubAllGlobals()
    call = stub({ data: [] })
    await runGroupTool(tool("talonic_list_webhook_event_types"), ctx, {})
    expect(call().url).toBe(`${API}/v1/webhooks/events`)
  })
})

describe("admin: billing handoff and account", () => {
  it("upgrade link is a GET with the pack as a query param", async () => {
    const call = stub({ url: "https://checkout.example", requires_human: true })
    await runGroupTool(tool("talonic_get_billing_upgrade_link"), ctx, { pack: "250" })
    expect(call()).toMatchObject({
      url: `${API}/v1/billing/upgrade-link?pack=250`,
      method: "GET",
      body: undefined,
    })
  })

  it("upgrade link without a pack sends no query string", async () => {
    const call = stub({ url: "https://checkout.example" })
    await runGroupTool(tool("talonic_get_billing_upgrade_link"), ctx, {})
    expect(call().url).toBe(`${API}/v1/billing/upgrade-link`)
  })

  it("account snapshot reads /v1/account", async () => {
    const call = stub({ tier: "free" })
    await runGroupTool(tool("talonic_get_account"), ctx, {})
    expect(call()).toMatchObject({ url: `${API}/v1/account`, method: "GET" })
  })
})

describe("admin: policy outcome", () => {
  it("a platform 403 comes back as a tool error with the permission hint", async () => {
    stub(
      { error: "scope_not_grantable", message: "A key can only issue scopes it holds itself" },
      403,
    )
    const res = await runGroupTool(tool("talonic_create_api_key"), ctx, {
      name: "x",
      scopes: ["billing"],
    })
    expect(res.isError).toBe(true)
    const text = res.content[0]!.text
    expect(text).toContain("scope_not_grantable")
    expect(text).toContain("lacks the permission, scope or role")
  })

  it("a 404 on revoke (not your key) is a tool error, not a success", async () => {
    stub({ error: "key_not_found" }, 404)
    const res = await runGroupTool(tool("talonic_revoke_api_key"), ctx, { key_id: KEY_ID })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("key_not_found")
  })
})

describe("admin: annotations and registration", () => {
  it("revoke and delete are destructive; reads are read-only", () => {
    expect(tool("talonic_revoke_api_key").annotations.destructiveHint).toBe(true)
    expect(tool("talonic_delete_webhook").annotations.destructiveHint).toBe(true)
    for (const t of adminGroup.tools) {
      if (t.route.startsWith("GET ")) expect(t.annotations.readOnlyHint, t.name).toBe(true)
      else expect(t.annotations.readOnlyHint, t.name).toBe(false)
    }
  })

  it("no tool names a replay route (none exists on the platform)", () => {
    expect(adminGroup.tools.some((t) => /replay|redeliver/i.test(t.route))).toBe(false)
  })

  it("registers only when the admin group is included", () => {
    const names = adminGroup.tools.map((t) => t.name)
    const off = createServer({ apiKey: "tlnc_test" }) as any
    for (const n of names) expect(off._registeredTools[n], n).toBeUndefined()
    const on = createServer({ apiKey: "tlnc_test", toolGroups: ["admin"] }) as any
    for (const n of names) expect(on._registeredTools[n], n).toBeDefined()
    expect(on._registeredTools["talonic_revoke_api_key"].annotations.destructiveHint).toBe(true)
  })
})
