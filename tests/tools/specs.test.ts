import { afterEach, describe, expect, it, vi } from "vitest"
import { handleGetSpec, handleListSpecs } from "../../src/tools/specs"

type Call = { url: string; init: RequestInit }
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}
function stubFetch(routes: Array<[string, unknown]>, status = 200) {
  const calls: Call[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      for (const [needle, body] of routes)
        if (url.includes(needle)) return jsonResponse(body, status)
      return jsonResponse({ error: "not_found" }, 404)
    }),
  )
  return calls
}
const getToken = () => "tlnc_test"
const parsed = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0]?.text ?? "")
const SPEC = {
  id: "b8ec7fe1-3656-42ab-8027-0238afbc930c",
  name: "Purchase Order",
  description: null,
  schema_id: "514f3610-0801-4ac3-af3b-3553fb582808",
  version: 1,
  materialized_version: 1,
  materialized_at: "2026-07-22T23:26:32.909Z",
  field_count: 12,
  node_count: 4,
  created_at: "2026-07-22T23:20:00.000Z",
  updated_at: "2026-07-22T23:26:32.909Z",
  links: { self: "/v1/specs/b8ec7fe1-3656-42ab-8027-0238afbc930c" },
}

describe("talonic_list_specs", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("GETs /v1/specs with only the defined params and returns data + pagination", async () => {
    const calls = stubFetch([
      [
        "/v1/specs",
        { data: [SPEC], pagination: { total: 1, limit: 20, has_more: false, next_cursor: null } },
      ],
    ])
    const res = await handleListSpecs(getToken, "https://api.example.test", {
      search: "purchase",
      limit: 5,
    })
    expect(calls[0].url).toBe("https://api.example.test/v1/specs?search=purchase&limit=5")
    expect(calls[0].init.method).toBe("GET")
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe("Bearer tlnc_test")
    const body = parsed(res)
    expect(body.data[0].name).toBe("Purchase Order")
    expect(body.pagination.has_more).toBe(false)
  })

  it("returns the API error envelope as a tool error", async () => {
    stubFetch([["/v1/specs", { error: "unauthorized" }]], 401)
    const res = await handleListSpecs(getToken, undefined, {})
    expect((res as any).isError).toBe(true)
    expect(res.content[0].text).toMatch(/HTTP 401/)
  })
})

describe("talonic_get_spec", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("GETs /v1/specs/{id} and passes the structure through", async () => {
    const calls = stubFetch([
      [
        `/v1/specs/${SPEC.id}`,
        {
          ...SPEC,
          schema: { id: SPEC.schema_id, name: "PO" },
          nodes: [{ node_id: "n1", position: 0, type: "source" }],
          phases: [],
          fields: [],
        },
      ],
    ])
    const res = await handleGetSpec(getToken, undefined, { spec_id: SPEC.id })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`https://api.talonic.com/v1/specs/${SPEC.id}`)
    const body = parsed(res)
    expect(body.nodes[0].type).toBe("source")
    expect(body.versions).toBeUndefined()
  })

  it("adds versions[] when include_versions is set", async () => {
    const calls = stubFetch([
      [
        `/v1/specs/${SPEC.id}/versions`,
        {
          data: [
            {
              version: 1,
              content_hash: "abc",
              created_at: "2026-07-22T23:26:32.909Z",
              is_materialized: true,
            },
          ],
        },
      ],
      [`/v1/specs/${SPEC.id}`, { ...SPEC, nodes: [], phases: [], fields: [] }],
    ])
    const res = await handleGetSpec(getToken, undefined, {
      spec_id: SPEC.id,
      include_versions: true,
    })
    expect(calls.map((c) => c.url)).toEqual([
      `https://api.talonic.com/v1/specs/${SPEC.id}`,
      `https://api.talonic.com/v1/specs/${SPEC.id}/versions`,
    ])
    expect(parsed(res).versions[0].is_materialized).toBe(true)
  })
})
