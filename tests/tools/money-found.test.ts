import { afterEach, describe, expect, it, vi } from "vitest"
import { moneyFoundGroup } from "../../src/tools/money-found"
import { runGroupTool } from "../../src/tools/_groups"
import { createServer } from "../../src/server-factory"

const ctx = { getToken: () => "tlnc_key", baseUrl: "https://api.example.test" }
const tool = (name: string) => moneyFoundGroup.tools.find((x) => x.name === name)!

function stub(body: unknown = {}, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  )
  vi.stubGlobal("fetch", fetchMock)
  return () => {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    return { url, method: init.method }
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("money found tools", () => {
  it("ledger and evidence requests are plain reads", async () => {
    let call = stub({ levers: [] })
    await runGroupTool(tool("talonic_money_found_ledger"), ctx, {})
    expect(call()).toEqual({ url: "https://api.example.test/v1/money-found/levers", method: "GET" })
    vi.unstubAllGlobals()
    call = stub({ groups: [] })
    await runGroupTool(tool("talonic_money_found_evidence_requests"), ctx, {})
    expect(call().url).toBe("https://api.example.test/v1/money-found/evidence-requests")
  })

  it("review_row queues one row, its key encoded into the path", async () => {
    const call = stub({ review: {} })
    await runGroupTool(tool("talonic_money_found_review_row"), ctx, {
      lever_id: "contract_price_mismatch",
      key: "INV-1/2026|gas",
    })
    expect(call()).toEqual({
      method: "POST",
      url: "https://api.example.test/v1/money-found/rows/contract_price_mismatch/INV-1%2F2026%7Cgas/review",
    })
  })

  it("review_all posts to reviews/run", async () => {
    const call = stub({ queued: 3 })
    await runGroupTool(tool("talonic_money_found_review_all"), ctx, {})
    expect(call()).toEqual({
      method: "POST",
      url: "https://api.example.test/v1/money-found/reviews/run",
    })
  })

  it("an API error comes back as a tool error", async () => {
    stub({ message: "Lever not found" }, 404)
    const res = await runGroupTool(tool("talonic_money_found_review_row"), ctx, {
      lever_id: "x",
      key: "y",
    })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("Lever not found")
  })

  it("is registered only when the group is included", () => {
    const off = createServer({ apiKey: "tlnc_test" }) as any
    expect(off._registeredTools["talonic_money_found_ledger"]).toBeUndefined()
    const on = createServer({ apiKey: "tlnc_test", toolGroups: ["money_found"] }) as any
    for (const t of moneyFoundGroup.tools) expect(on._registeredTools[t.name], t.name).toBeDefined()
  })
})
