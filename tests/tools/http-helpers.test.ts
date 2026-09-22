import { afterEach, describe, expect, it, vi } from "vitest"
import { apiForm, apiJson, sleep } from "../../src/tools/_http"

const getToken = () => "tlnc_test"

describe("apiForm", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("posts multipart/form-data with repeated array fields and the bearer, skipping undefined", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        return new Response(JSON.stringify({ run_id: "r1", status: "processing" }), {
          status: 202,
          headers: { "content-type": "application/json" },
        })
      }),
    )
    const out = await apiForm<{ run_id: string }>(getToken, "https://api.example.test", "/v1/run", {
      spec_id: "s1",
      file_urls: ["https://a.example/x.pdf", "https://a.example/y.pdf"],
      name: undefined,
      pipeline_mode: "new",
    })
    expect(out.run_id).toBe("r1")
    expect(calls[0].url).toBe("https://api.example.test/v1/run")
    expect(calls[0].init.method).toBe("POST")
    const headers = new Headers(calls[0].init.headers)
    expect(headers.get("authorization")).toBe("Bearer tlnc_test")
    expect(headers.get("accept")).toBe("application/json")
    // undici sets the multipart boundary itself — we must NOT set Content-Type.
    expect(headers.get("content-type")).toBeNull()
    const body = calls[0].init.body as FormData
    expect(body).toBeInstanceOf(FormData)
    expect(body.get("spec_id")).toBe("s1")
    expect(body.getAll("file_urls")).toEqual(["https://a.example/x.pdf", "https://a.example/y.pdf"])
    expect(body.has("name")).toBe(false)
    expect(body.get("pipeline_mode")).toBe("new")
  })

  it("throws the API error envelope on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"error":"bad_request"}', { status: 400 })),
    )
    await expect(apiForm(getToken, undefined, "/v1/run", { spec_id: "s1" })).rejects.toThrow(
      /HTTP 400.*bad_request/,
    )
  })
})

describe("apiJson method union", () => {
  afterEach(() => vi.unstubAllGlobals())
  it("accepts PATCH and DELETE", async () => {
    const fetchFn = vi.fn(
      async () => new Response("{}", { headers: { "content-type": "application/json" } }),
    )
    vi.stubGlobal("fetch", fetchFn)
    await apiJson(getToken, undefined, "PATCH", "/v1/x", { body: { a: 1 } })
    await apiJson(getToken, undefined, "DELETE", "/v1/x")
    expect((fetchFn.mock.calls[0][1] as RequestInit).method).toBe("PATCH")
    expect((fetchFn.mock.calls[1][1] as RequestInit).method).toBe("DELETE")
  })
})

describe("sleep", () => {
  afterEach(() => vi.useRealTimers())

  it("resolves after the given delay", async () => {
    vi.useFakeTimers()
    const p = sleep(500)
    vi.advanceTimersByTime(500)
    await expect(p).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})
