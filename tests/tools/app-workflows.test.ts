import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createServer } from "../../src/server-factory"
import {
  APP_WORKFLOW_GROUPS,
  buildRequest,
  handleRouteTool,
  probeAppWorkflowGroup,
  probeAppWorkflowGroups,
} from "../../src/tools/app-workflows"

const ALL_IDS = APP_WORKFLOW_GROUPS.map((g) => g.id)
const ALL_TOOLS = APP_WORKFLOW_GROUPS.flatMap((g) => g.tools)
const tool = (name: string) => ALL_TOOLS.find((t) => t.name === name)!

// Public text names no models, vendors or internal mechanics (docs plan §0).
const DENYLIST =
  /\b(llm|claude|haiku|sonnet|opus|mistral|openai|anthropic|prompt|embedding|vector|cluster|ontolog|semantic layer|pipeline phase|n-shot|nshot|sheet capture|spec2|dataspace)\b/i

function stubFetch(respond: (url: string, init: RequestInit) => Response) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return respond(url, init)
    }),
  )
  return calls
}

describe("app workflow tools", () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it("register only the groups whose probe passed", () => {
    const off = createServer({ apiKey: "tlnc_test" }) as any
    const some = createServer({ apiKey: "tlnc_test", appWorkflowGroups: ["receivables"] }) as any
    for (const t of ALL_TOOLS) expect(off._registeredTools[t.name]).toBeUndefined()
    for (const g of APP_WORKFLOW_GROUPS) {
      for (const t of g.tools) {
        if (g.id === "receivables") expect(some._registeredTools[t.name]).toBeDefined()
        else expect(some._registeredTools[t.name]).toBeUndefined()
      }
    }
  })

  it("never collide with another tool name, with every app group switched on", () => {
    const names = ALL_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    expect(() =>
      createServer({
        apiKey: "tlnc_test",
        appWorkflowGroups: ALL_IDS,
        includeApTools: true,
        includePriceBaselineTools: true,
        includeContractsTools: true,
        includeDocGenTools: true,
        includePartiesTools: true,
        includeMasterRecordsTools: true,
        includeSubmissionsTools: true,
      }),
    ).not.toThrow()
  })

  it.each(ALL_TOOLS.map((t) => [t.name, t] as const))(
    "%s has a tight public description with a NOT FOR redirect",
    (_name, t) => {
      expect(t.description).toContain("USE WHEN")
      expect(t.description).toContain("NOT FOR")
      expect(t.description.length).toBeLessThanOrEqual(1500)
      expect(t.description).not.toMatch(DENYLIST)
      expect(t.title).not.toMatch(DENYLIST)
    },
  )

  it("keeps preview apart from the step that records, saves or publishes", () => {
    for (const name of [
      "talonic_ar_cash_application_preview",
      "talonic_ar_bill_ready_preview",
      "talonic_price_baseline_match_invoice",
      "talonic_chart_read_charts_preview",
      "talonic_spend_audit_get_share",
    ]) {
      expect(tool(name).annotations.readOnlyHint).toBe(true)
      expect(tool(name).method).toBe("GET")
    }
    for (const name of [
      "talonic_ar_cash_application_apply",
      "talonic_ar_bill_ready_apply",
      "talonic_money_found_save_config",
      "talonic_price_baseline_assign_invoice",
      "talonic_chart_read_charts",
      "talonic_spend_audit_share",
    ]) {
      expect(tool(name).annotations.readOnlyHint).toBe(false)
    }
    // A proposal stores nothing on the platform, but it starts paid work: not read-only.
    expect(tool("talonic_money_found_propose_config").annotations.readOnlyHint).toBe(false)
    // Publishing reaches outside the workspace.
    expect(tool("talonic_spend_audit_share").annotations.openWorldHint).toBe(true)
    expect(tool("talonic_spend_audit_share").description).toMatch(/PUBLISHES/)
  })

  it("every read tool is GET and every GET tool is read-only", () => {
    for (const t of ALL_TOOLS) expect(t.method === "GET").toBe(t.annotations.readOnlyHint)
  })

  it("builds the request: encoded path params, joined list queries, body aliases", () => {
    const facts = buildRequest(tool("talonic_workbook_correct_mapping"), {
      structure_id: "11111111-1111-4111-8111-111111111111",
      label_key: "header|Gross › Premium",
      metric: "gwp",
    })
    expect(facts.path).toBe(
      "/v1/sheet-capture/specs/11111111-1111-4111-8111-111111111111/mappings/header%7CGross%20%E2%80%BA%20Premium",
    )
    expect(facts.body).toEqual({ metric: "gwp" })

    const project = buildRequest(tool("talonic_workbook_project"), {
      document_id: "22222222-2222-4222-8222-222222222222",
      structure_id: "11111111-1111-4111-8111-111111111111",
    })
    expect(project.body).toEqual({ spec_id: "11111111-1111-4111-8111-111111111111" })

    const preview = buildRequest(tool("talonic_chart_read_charts_preview"), {
      document_ids: ["a", "b"],
    })
    expect(preview.params).toEqual({ document_ids: "a,b" })
    expect(preview.body).toBeUndefined()

    const cash = buildRequest(tool("talonic_ar_cash_application_preview"), {
      page: 2,
      invalid_only: true,
    })
    expect(cash.params).toEqual({ page: 2, invalid: true })
  })

  it("sends the call with the caller's bearer and returns the platform's answer", async () => {
    const calls = stubFetch(() => Response.json({ recorded: 3 }))
    const out = await handleRouteTool(
      () => "tlnc_k",
      "https://api.example.test",
      tool("talonic_ar_cash_application_apply"),
      {},
    )
    expect(calls[0]!.url).toBe("https://api.example.test/v1/ar/cash-application/apply")
    expect(calls[0]!.init.method).toBe("POST")
    expect((calls[0]!.init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer tlnc_k",
    )
    expect(JSON.stringify(out)).toContain("recorded")

    stubFetch(() => Response.json({ event: {} }))
    await handleRouteTool(() => "tlnc_k", undefined, tool("talonic_money_found_set_row_state"), {
      lever_id: "rebate_unclaimed",
      key: "c-1/2026",
      state: "resolved",
    })
  })

  it("surfaces a platform refusal as a tool error", async () => {
    stubFetch(() =>
      Response.json({ error: "forbidden", reason: "insufficient_scope" }, { status: 403 }),
    )
    const out = (await handleRouteTool(
      () => "tlnc_k",
      undefined,
      tool("talonic_spend_audit_share"),
      {},
    )) as any
    expect(out.isError).toBe(true)
  })

  it("probe: 200 lists the group, 404 does not, a 5xx or network failure is unknown", async () => {
    const group = APP_WORKFLOW_GROUPS.find((g) => g.id === "objects")!
    const calls = stubFetch(() => Response.json({ data: [] }))
    expect(await probeAppWorkflowGroup(group, "tlnc_x", "https://api.example.test")).toBe(true)
    expect(calls[0]!.url).toBe("https://api.example.test/v1/objects/recent?limit=1")
    stubFetch(() => new Response("", { status: 404 }))
    expect(await probeAppWorkflowGroup(group, "tlnc_x")).toBe(false)
    stubFetch(() => new Response("", { status: 503 }))
    expect(await probeAppWorkflowGroup(group, "tlnc_x")).toBe("unknown")
  })

  it("stdio lists exactly the groups whose probe answered 200", async () => {
    stubFetch((url) =>
      url.includes("/v1/ar/") || url.includes("/v1/spend-audit")
        ? Response.json({})
        : new Response("", { status: 404 }),
    )
    expect(await probeAppWorkflowGroups("tlnc_x")).toEqual(["receivables", "spend_audit"])
  })
})

describe("hosted app workflow visibility", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("keeps one 5-minute probe cache per group and lists only the groups that passed", async () => {
    const { appWorkflowAccessCached, appWorkflowGroupsCached } =
      await import("../../src/http-server")
    expect([...appWorkflowAccessCached.keys()]).toEqual(ALL_IDS)
    const calls = stubFetch((url) =>
      url.includes("/v1/payables-desk/policy")
        ? Response.json({})
        : new Response("", { status: 404 }),
    )
    expect(await appWorkflowGroupsCached("tlnc_hosted_1")).toEqual(["payables_desk"])
    const n = calls.length
    expect(await appWorkflowGroupsCached("tlnc_hosted_1")).toEqual(["payables_desk"])
    expect(calls.length).toBe(n)
  })
})
