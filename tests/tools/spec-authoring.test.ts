import { afterEach, describe, expect, it, vi } from "vitest"
import { probeSpecAuthoringAccess } from "../../src/tools/spec-authoring"
import { createServer } from "../../src/server-factory"
import { createRequestHandler, specAuthoringAccessCached } from "../../src/http-server"

const SPEC = "11111111-1111-4111-8111-111111111111"
const DOC = "22222222-2222-4222-8222-222222222222"
const SCHEMA = "33333333-3333-4333-8333-333333333333"
const API = "https://api.talonic.com/v1/specs"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function stub(...bodies: unknown[]) {
  let i = 0
  const fetchMock = vi
    .fn()
    .mockImplementation(async () => jsonResponse(bodies[Math.min(i++, bodies.length - 1)] ?? {}))
  vi.stubGlobal("fetch", fetchMock)
  return {
    call: (n = 0) => {
      const [url, init] = fetchMock.mock.calls[n] as [string, RequestInit]
      return {
        url: String(url),
        method: init.method,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
        auth: new Headers(init.headers).get("authorization"),
      }
    },
    count: () => fetchMock.mock.calls.length,
  }
}

const tools = () =>
  (createServer({ apiKey: "tlnc_test", includeSpecAuthoringTools: true }) as any)._registeredTools
const call = (name: string, args: unknown) => tools()[name].handler(args, {} as any)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("talonic_spec_* authoring tools", () => {
  it("are listed only when Spec authoring is available to the credential", () => {
    const off = Object.keys((createServer({ apiKey: "tlnc_test" }) as any)._registeredTools)
    expect(off.filter((n) => /^talonic_spec_/.test(n))).toEqual([])
    expect(
      Object.keys(tools())
        .filter((n) => /^talonic_spec_/.test(n))
        .sort(),
    ).toEqual([
      "talonic_spec_check",
      "talonic_spec_create",
      "talonic_spec_edit",
      "talonic_spec_publish",
      "talonic_spec_rollback",
      "talonic_spec_test",
    ])
  })

  it("marks check read-only and publish / rollback destructive", () => {
    const t = tools()
    expect(t.talonic_spec_check.annotations.readOnlyHint).toBe(true)
    for (const n of ["create", "edit", "test"])
      expect(t[`talonic_spec_${n}`].annotations.readOnlyHint, n).toBe(false)
    for (const n of ["publish", "rollback"])
      expect(t[`talonic_spec_${n}`].annotations.destructiveHint, n).toBe(true)
  })

  it("descriptions name no internal mechanics", () => {
    const banned =
      /\b(phase|materiali[sz]|embedding|cluster|ontolog|prompt|LLM|Claude|Sonnet|Haiku|Mistral|n-shot|semantic layer|tier)\b/i
    for (const [name, t] of Object.entries(tools()) as Array<[string, any]>) {
      if (!name.startsWith("talonic_spec_")) continue
      expect(banned.test(t.description), `${name}: ${t.description.match(banned)?.[0]}`).toBe(false)
    }
  })

  it("probes GET /v1/specs/authoring and fails closed", async () => {
    const s = stub({ available: true })
    expect(await probeSpecAuthoringAccess("tlnc_x")).toBe(true)
    expect(s.call().url).toBe(`${API}/authoring`)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })))
    expect(await probeSpecAuthoringAccess("tlnc_x")).toBe(false)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")))
    expect(await probeSpecAuthoringAccess("tlnc_x")).toBe(false)
  })

  it("the hosted cache probes the same route", async () => {
    const probe = vi.fn().mockResolvedValue(true)
    expect(await specAuthoringAccessCached("tok-spec-1", probe)).toBe(true)
    expect(probe).toHaveBeenCalledWith("tok-spec-1")
    expect(typeof createRequestHandler).toBe("function")
  })

  it("create with a doc posts it to /v1/specs", async () => {
    const s = stub({ spec_id: SPEC })
    const doc = { format: 1, name: "Invoices", fields: [], stages: [], gates: [], policies: [] }
    await call("talonic_spec_create", { name: "Invoices", doc })
    expect(s.call()).toMatchObject({
      url: API,
      method: "POST",
      body: { name: "Invoices", doc },
      auth: "Bearer tlnc_test",
    })
  })

  it("create from a schema imports, then applies the name", async () => {
    const s = stub({ spec_id: SPEC }, {})
    await call("talonic_spec_create", { name: "Invoices", schema_id: SCHEMA })
    expect(s.call(0)).toMatchObject({
      url: `${API}/import`,
      method: "POST",
      body: { schema_id: SCHEMA },
    })
    expect(s.call(1)).toMatchObject({
      url: `${API}/${SPEC}`,
      method: "PATCH",
      body: { name: "Invoices" },
    })
  })

  it("create refuses two sources without calling the API", async () => {
    const s = stub({})
    const res = await call("talonic_spec_create", { name: "x", doc: {}, schema_id: SCHEMA })
    expect(res.isError).toBe(true)
    expect(s.count()).toBe(0)
  })

  it("edit with only spec_id reads the draft", async () => {
    const s = stub({ revision: 2 })
    await call("talonic_spec_edit", { spec_id: SPEC })
    expect(s.call()).toMatchObject({ url: `${API}/${SPEC}/draft`, method: "GET" })
  })

  it("edit with a doc replaces the draft under its revision", async () => {
    const s = stub({ revision: 3 })
    await call("talonic_spec_edit", { spec_id: SPEC, doc: { format: 1 }, revision: 2 })
    expect(s.call()).toMatchObject({
      url: `${API}/${SPEC}/draft`,
      method: "PUT",
      body: { doc: { format: 1 }, revision: 2 },
    })
  })

  it("edit with a doc but no revision is refused before any call", async () => {
    const s = stub({})
    expect((await call("talonic_spec_edit", { spec_id: SPEC, doc: {} })).isError).toBe(true)
    expect(s.count()).toBe(0)
  })

  it("check posts the optional doc", async () => {
    const s = stub({ valid: true, errors: [], warnings: [] })
    await call("talonic_spec_check", { spec_id: SPEC })
    expect(s.call()).toMatchObject({ url: `${API}/${SPEC}/check`, method: "POST", body: {} })
  })

  it("test pins when asked, then starts the preview run", async () => {
    const s = stub({}, { pipeline_id: "p" })
    await call("talonic_spec_test", { spec_id: SPEC, document_ids: [DOC], pin: true })
    expect(s.call(0)).toMatchObject({
      url: `${API}/${SPEC}/samples`,
      method: "POST",
      body: { document_id: DOC },
    })
    expect(s.call(1)).toMatchObject({
      url: `${API}/${SPEC}/test`,
      method: "POST",
      body: { document_ids: [DOC] },
    })
  })

  it("publish sends the revision and acknowledgement only when given", async () => {
    const s = stub({ version: 3 })
    await call("talonic_spec_publish", { spec_id: SPEC, expected_draft_revision: 4 })
    expect(s.call()).toMatchObject({
      url: `${API}/${SPEC}/publish`,
      method: "POST",
      body: { expected_draft_revision: 4 },
    })
  })

  it("rollback preview diffs head against the target and changes nothing", async () => {
    const s = stub({ data: [{ version: 5 }, { version: 4 }] }, { from: 5, to: 2, diff: {} })
    await call("talonic_spec_rollback", { spec_id: SPEC, version: 2, preview: true })
    expect(s.call(1)).toMatchObject({ url: `${API}/${SPEC}/versions/5/diff/2`, method: "GET" })
    expect(s.count()).toBe(2)
  })

  it("rollback posts to the version's rollback route", async () => {
    const s = stub({ version: 6 })
    await call("talonic_spec_rollback", { spec_id: SPEC, version: 2 })
    expect(s.call()).toMatchObject({ url: `${API}/${SPEC}/versions/2/rollback`, method: "POST" })
  })
})
