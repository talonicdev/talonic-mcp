import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { handleFieldValues, handleGetField, handleListFields } from "../../src/tools/fields"
import { buildUrl } from "../../src/tools/_http"

type Call = { url: string; init: RequestInit }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

/** Route fetch by URL substring; records every call. */
function stubFetch(routes: Array<[string, unknown | ((url: string) => unknown)]>, status = 200) {
  const calls: Call[] = []
  const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    for (const [needle, body] of routes) {
      if (url.includes(needle))
        return jsonResponse(typeof body === "function" ? body(url) : body, status)
    }
    return jsonResponse({ error: "not_found" }, 404)
  })
  vi.stubGlobal("fetch", fetchFn)
  return { calls, fetchFn }
}

const getToken = () => "tlnc_test"
const parsed = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0]?.text ?? "")

describe("field registry tools", () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it("buildUrl drops undefined/empty params and keeps booleans", () => {
    expect(
      buildUrl(undefined, "/v1/fields", {
        search: "",
        maturity: "core",
        include_superseded: false,
        limit: 5,
      }),
    ).toBe("https://api.talonic.com/v1/fields?maturity=core&include_superseded=false&limit=5")
    expect(buildUrl("https://staging.api.talonic.com", "/v1/fields")).toBe(
      "https://staging.api.talonic.com/v1/fields",
    )
  })

  describe("talonic_list_fields", () => {
    it("forwards the maturity / superseded / paging params with the bearer", async () => {
      const { calls } = stubFetch([
        ["/v1/fields", { data: [{ id: "f1", maturity: "core" }], pagination: { total: 1 } }],
      ])
      const res = await handleListFields(getToken, undefined, {
        search: "invoice",
        maturity: "core",
        include_superseded: false,
        limit: 10,
      })
      expect("isError" in res).toBe(false)
      expect(parsed(res).data[0].maturity).toBe("core")
      expect(calls[0].url).toBe(
        "https://api.talonic.com/v1/fields?search=invoice&maturity=core&include_superseded=false&limit=10",
      )
      expect(new Headers(calls[0].init.headers).get("authorization")).toBe("Bearer tlnc_test")
    })

    it("shapes an API failure as a tool error carrying the status and body", async () => {
      stubFetch([["/v1/fields", { error: "invalid_maturity" }]], 400)
      const res = await handleListFields(getToken, undefined, { maturity: "core" })
      expect(res.isError).toBe(true)
      expect(res.content[0]?.text).toContain("HTTP 400")
      expect(res.content[0]?.text).toContain("invalid_maturity")
    })
  })

  describe("talonic_get_field", () => {
    it("requires exactly one of field_id / name", async () => {
      expect((await handleGetField(getToken, undefined, {})).isError).toBe(true)
      expect(
        (
          await handleGetField(getToken, undefined, {
            field_id: "5f2b3c1e-1c6a-4d3a-9d3a-3f2b1c6a4d3a",
            name: "x",
          })
        ).isError,
      ).toBe(true)
    })

    it("reads the card by id, following redirects, and appends history on request", async () => {
      const { calls } = stubFetch([
        ["/history", { data: [{ kind: "tier_changed" }], total: 1 }],
        [
          "/card",
          {
            id: "f-live",
            canonical_name: "invoice_number",
            maturity: "proven",
            values: { examples: ["INV-1"] },
          },
        ],
      ])
      const res = await handleGetField(getToken, "https://staging.api.talonic.com", {
        field_id: "5f2b3c1e-1c6a-4d3a-9d3a-3f2b1c6a4d3a",
        include_history: true,
      })
      const body = parsed(res)
      expect(body.canonical_name).toBe("invoice_number")
      expect(body.history.total).toBe(1)
      expect(body.resolution).toBeUndefined()
      expect(calls.map((c) => c.url)).toEqual([
        "https://staging.api.talonic.com/v1/fields/5f2b3c1e-1c6a-4d3a-9d3a-3f2b1c6a4d3a/card?follow_redirects=true",
        "https://staging.api.talonic.com/v1/fields/5f2b3c1e-1c6a-4d3a-9d3a-3f2b1c6a4d3a/history?limit=50",
      ])
    })

    it("resolves a NAME first and reports how it matched", async () => {
      const { calls } = stubFetch([
        [
          "/v1/fields/resolve",
          {
            name: "Invoice No",
            matched_by: "synonym",
            redirected_from: ["f-old"],
            field: { id: "f-live" },
          },
        ],
        ["/card", { id: "f-live", canonical_name: "invoice_number" }],
      ])
      const res = await handleGetField(getToken, undefined, { name: "Invoice No" })
      const body = parsed(res)
      expect(body.id).toBe("f-live")
      expect(body.resolution).toEqual({ matched_by: "synonym", redirected_from: ["f-old"] })
      expect(calls[0].url).toBe(
        "https://api.talonic.com/v1/fields/resolve?name=Invoice+No&follow_redirects=true",
      )
    })

    it("surfaces unknown_field from resolve as a tool error", async () => {
      stubFetch(
        [["/v1/fields/resolve", { error: "unknown_field", message: 'No field named "nope"' }]],
        404,
      )
      const res = await handleGetField(getToken, undefined, { name: "nope" })
      expect(res.isError).toBe(true)
      expect(res.content[0]?.text).toContain("unknown_field")
    })
  })

  describe("talonic_field_values", () => {
    it("forwards document_id / value / paging and returns the page", async () => {
      const { calls } = stubFetch([
        [
          "/values",
          {
            field_id: "f1",
            data: [{ occurrence_id: "o1", value: "INV-1", provenance: { via_redirect: false } }],
            pagination: { total: 1, has_more: false },
          },
        ],
      ])
      const res = await handleFieldValues(getToken, undefined, {
        field_id: "5f2b3c1e-1c6a-4d3a-9d3a-3f2b1c6a4d3a",
        value: "INV",
        limit: 5,
      })
      expect(parsed(res).data[0].value).toBe("INV-1")
      expect(calls[0].url).toBe(
        "https://api.talonic.com/v1/fields/5f2b3c1e-1c6a-4d3a-9d3a-3f2b1c6a4d3a/values?value=INV&limit=5",
      )
    })

    it("resolves by name and carries the resolution alongside the page", async () => {
      stubFetch([
        [
          "/v1/fields/resolve",
          { matched_by: "canonical_name", redirected_from: [], field: { id: "f1" } },
        ],
        ["/values", { field_id: "f1", data: [], pagination: { total: 0 } }],
      ])
      const body = parsed(await handleFieldValues(getToken, undefined, { name: "invoice_number" }))
      expect(body.resolution).toEqual({ matched_by: "canonical_name", redirected_from: [] })
    })

    it("rejects a call with neither id nor name before touching the network", async () => {
      const { fetchFn } = stubFetch([])
      const res = await handleFieldValues(getToken, undefined, {})
      expect(res.isError).toBe(true)
      expect(fetchFn).not.toHaveBeenCalled()
    })
  })
})
