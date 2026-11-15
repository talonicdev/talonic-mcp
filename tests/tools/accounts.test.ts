import { afterEach, describe, expect, it, vi } from "vitest"
import { handleCreateAccount, handleListAccounts } from "../../src/tools/accounts"

describe("account tools", () => {
  afterEach(() => vi.unstubAllGlobals())
  const ok = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })

  it("lists accounts via GET /v1/accounts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(ok({ data: [{ id: "a", name: "Hawk", aliases: [] }] }))
    vi.stubGlobal("fetch", fetchMock)
    const res = await handleListAccounts(() => "tok")
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.talonic.com/v1/accounts")
    expect(init.method).toBe("GET")
    expect(JSON.stringify(res)).toContain("Hawk")
  })

  it("creates an account via POST with name and aliases", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(ok({ id: "n", name: "Filu", aliases: ["Filu Group"] }))
    vi.stubGlobal("fetch", fetchMock)
    await handleCreateAccount(() => "tok", undefined, { name: "Filu", aliases: ["Filu Group"] })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({ name: "Filu", aliases: ["Filu Group"] })
  })

  it("surfaces an API error as a tool error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("taken", { status: 409 })))
    const res: any = await handleCreateAccount(() => "tok", undefined, { name: "Filu" })
    expect(res.isError).toBe(true)
  })
})
