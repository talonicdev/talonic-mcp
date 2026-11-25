import { afterEach, describe, expect, it, vi } from "vitest"
import { customsDeclarationGroup } from "../../src/tools/customs-declaration"
import { runGroupTool } from "../../src/tools/_groups"
import { createServer } from "../../src/server-factory"

const PIPE = "0f3c9a1b-2d4e-4f60-8718-293a4b5c6d7e"
const ctx = { getToken: () => "tlnc_key", baseUrl: undefined }
const tool = (name: string) => customsDeclarationGroup.tools.find((x) => x.name === name)!

function stub(body: unknown = {}, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  )
  vi.stubGlobal("fetch", fetchMock)
  return () => (fetchMock.mock.calls[0] as [string, RequestInit])[0]
}

afterEach(() => vi.unstubAllGlobals())

describe("customs declaration tools", () => {
  it("issues takes an optional pipeline", async () => {
    let url = stub({ data: [] })
    await runGroupTool(tool("talonic_customs_declaration_issues"), ctx, {})
    expect(url()).toBe("https://api.talonic.com/v1/customs-declaration/issues")
    vi.unstubAllGlobals()
    url = stub({ data: [] })
    await runGroupTool(tool("talonic_customs_declaration_issues"), ctx, { pipeline_id: PIPE })
    expect(url()).toBe(`https://api.talonic.com/v1/customs-declaration/issues?pipeline_id=${PIPE}`)
  })

  it("orders forwards the evidence filters", async () => {
    const url = stub({ items: [] })
    await runGroupTool(tool("talonic_customs_declaration_orders"), ctx, {
      status: "review",
      q: "24DE123",
      page: 2,
      limit: 50,
    })
    expect(url()).toBe(
      "https://api.talonic.com/v1/customs-declaration/declarations?status=review&q=24DE123&page=2&limit=50",
    )
  })

  it("every tool is read-only", () => {
    for (const t of customsDeclarationGroup.tools) expect(t.annotations.readOnlyHint).toBe(true)
  })

  it("an API error comes back as a tool error", async () => {
    stub({ message: "pipeline_id must be a UUID" }, 400)
    const res = await runGroupTool(tool("talonic_customs_declaration_orders"), ctx, {})
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("pipeline_id must be a UUID")
  })

  it("is registered only when the group is included", () => {
    const off = createServer({ apiKey: "tlnc_test" }) as any
    expect(off._registeredTools["talonic_customs_declaration_issues"]).toBeUndefined()
    const on = createServer({ apiKey: "tlnc_test", toolGroups: ["customs_declaration"] }) as any
    for (const t of customsDeclarationGroup.tools)
      expect(on._registeredTools[t.name], t.name).toBeDefined()
  })
})
