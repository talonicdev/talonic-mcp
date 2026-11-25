import { afterEach, describe, expect, it, vi } from "vitest"
import { runGroupTool } from "../../src/tools/_groups"
import { contractDeskGroup } from "../../src/tools/contract-desk"
import { createServer } from "../../src/server-factory"

const ITEM = "1b2c3d4e-5f60-4718-9293-a4b5c6d7e8f9"
const ctx = { getToken: () => "tlnc_key", baseUrl: undefined }
const tool = (name: string) => {
  const t = contractDeskGroup.tools.find((x) => x.name === name)
  if (!t) throw new Error(`no tool ${name}`)
  return t
}

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
    return {
      url,
      method: init.method,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: new Headers(init.headers).get("authorization"),
    }
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("contract desk tools", () => {
  it("covers the 16 key-usable operations (accept is refused for keys)", () => {
    expect(contractDeskGroup.tools).toHaveLength(16)
    expect(contractDeskGroup.tools.some((t) => t.route.includes("/accept"))).toBe(false)
    expect(contractDeskGroup.probe.path).toBe("/v1/contract-desk/status")
  })

  it("todo items forward the batch key and paging", async () => {
    const call = stub({ batch: null, data: [] })
    await runGroupTool(tool("talonic_contract_desk_todo_items"), ctx, {
      batch: "now~ops~value~YWJj",
      page: 2,
      limit: 25,
    })
    expect(call()).toMatchObject({
      method: "GET",
      url: "https://api.talonic.com/v1/contract-desk/todo/items?batch=now%7Eops%7Evalue%7EYWJj&page=2&limit=25",
      auth: "Bearer tlnc_key",
    })
  })

  it("decisions send mine as a string flag", async () => {
    const call = stub({ data: [] })
    await runGroupTool(tool("talonic_contract_desk_decisions"), ctx, { mine: true, crm_key: "K1" })
    expect(call().url).toBe(
      "https://api.talonic.com/v1/contract-desk/decisions?mine=true&crm_key=K1",
    )
  })

  it("evidence reads the item's decision package", async () => {
    const call = stub({ can_decide: true })
    await runGroupTool(tool("talonic_contract_desk_get_decision"), ctx, { id: ITEM })
    expect(call()).toMatchObject({
      method: "GET",
      url: `https://api.talonic.com/v1/contract-desk/items/${ITEM}/decision`,
    })
  })

  it("site and contract keys are encoded into the path", async () => {
    const call = stub({})
    await runGroupTool(tool("talonic_contract_desk_get_contract"), ctx, { id: "CRM/12 a" })
    expect(call().url).toBe("https://api.talonic.com/v1/contract-desk/contracts/CRM%2F12%20a")
  })

  it("decide posts action, value, note and dry_run; the id stays in the path", async () => {
    const call = stub({ status: "decided", dry_run: true })
    await runGroupTool(tool("talonic_contract_desk_decide"), ctx, {
      id: ITEM,
      action: "set",
      value: "12 months",
      note: "per contract p.3",
      dry_run: true,
    })
    expect(call()).toMatchObject({
      method: "POST",
      url: `https://api.talonic.com/v1/contract-desk/items/${ITEM}/decide`,
      body: { action: "set", value: "12 months", note: "per contract p.3", dry_run: true },
    })
  })

  it("undo posts to the decision", async () => {
    const call = stub({ undone_at: "2026-11-25T10:00:00Z" })
    await runGroupTool(tool("talonic_contract_desk_undo"), ctx, { id: ITEM })
    expect(call()).toMatchObject({
      method: "POST",
      url: `https://api.talonic.com/v1/contract-desk/decisions/${ITEM}/undo`,
      body: {},
    })
  })

  it("save_settings puts the teams; refresh posts to rebuild", async () => {
    let call = stub({})
    const teams = { kinds: { value: "Ops" }, fields: {} }
    await runGroupTool(tool("talonic_contract_desk_save_settings"), ctx, { teams })
    expect(call()).toMatchObject({ method: "PUT", body: { teams } })
    vi.unstubAllGlobals()
    call = stub({})
    await runGroupTool(tool("talonic_contract_desk_refresh"), ctx, {})
    expect(call()).toMatchObject({
      method: "POST",
      url: "https://api.talonic.com/v1/contract-desk/rebuild",
    })
  })

  it("an API error comes back as a tool error", async () => {
    stub({ code: "not_undoable", message: "Not the latest decision" }, 409)
    const res = await runGroupTool(tool("talonic_contract_desk_undo"), ctx, { id: ITEM })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("not_undoable")
  })

  it("is listed only with the contract_desk group", () => {
    const on = createServer({ apiKey: "tlnc_test", toolGroups: ["contract_desk"] }) as any
    const off = createServer({ apiKey: "tlnc_test" }) as any
    for (const t of contractDeskGroup.tools) {
      expect(on._registeredTools[t.name], t.name).toBeDefined()
      expect(off._registeredTools[t.name]).toBeUndefined()
    }
    expect(on._registeredTools["talonic_contract_desk_decide"].annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
    })
  })
})
