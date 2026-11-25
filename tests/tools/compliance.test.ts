import { afterEach, describe, expect, it, vi } from "vitest"
import { complianceGroup, handleComplianceExport } from "../../src/tools/compliance"
import { runGroupTool } from "../../src/tools/_groups"
import { createServer } from "../../src/server-factory"

const DOC = "0f3c9a1b-2d4e-4f60-8718-293a4b5c6d7e"
const TASK = "1f3c9a1b-2d4e-4f60-8718-293a4b5c6d7e"
const ctx = { getToken: () => "tlnc_key", baseUrl: undefined }
const tool = (name: string) => {
  const t = complianceGroup.tools.find((x) => x.name === name)
  if (!t) throw new Error(`no tool ${name}`)
  return t
}

function stub(body: unknown = {}, status = 200, headers: Record<string, string> = {}) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", ...headers },
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

describe("compliance tools", () => {
  it("issues lists failed checks, unclear by flag", async () => {
    const call = stub({ data: [] })
    await runGroupTool(tool("talonic_compliance_issues"), ctx, { unclear: true })
    expect(call()).toMatchObject({
      url: "https://api.talonic.com/v1/compliance/issues?unclear=true",
      method: "GET",
      auth: "Bearer tlnc_key",
    })
  })

  it("get_document_evaluation reads one document's evidence", async () => {
    const call = stub({ evaluation: null })
    await runGroupTool(tool("talonic_compliance_get_document_evaluation"), ctx, {
      document_id: DOC,
    })
    expect(call().url).toBe(`https://api.talonic.com/v1/compliance/evaluations/documents/${DOC}`)
  })

  it("evaluate re-runs documents with a document_ids body", async () => {
    const call = stub({ data: [] })
    await runGroupTool(tool("talonic_compliance_evaluate"), ctx, { document_ids: [DOC] })
    expect(call()).toMatchObject({
      method: "POST",
      url: "https://api.talonic.com/v1/compliance/evaluations",
      body: { document_ids: [DOC] },
    })
  })

  it("set_framework_active posts only the flag; the id goes in the path", async () => {
    const call = stub({})
    await runGroupTool(tool("talonic_compliance_set_framework_active"), ctx, {
      document_id: DOC,
      active: false,
    })
    expect(call()).toMatchObject({
      method: "POST",
      url: `https://api.talonic.com/v1/compliance/frameworks/${DOC}/active`,
      body: { active: false },
    })
  })

  it("list_evaluations forwards paging as query params", async () => {
    const call = stub({ data: [], total: 0, has_more: false })
    await runGroupTool(tool("talonic_compliance_list_evaluations"), ctx, {
      status: "error",
      limit: 10,
      offset: 20,
    })
    expect(call().url).toBe(
      "https://api.talonic.com/v1/compliance/evaluations?status=error&limit=10&offset=20",
    )
  })

  it("task lease calls carry the execution epoch", async () => {
    let call = stub({ task: {} })
    await runGroupTool(tool("talonic_compliance_claim_task"), ctx, { task_id: TASK })
    expect(call()).toMatchObject({
      method: "POST",
      url: `https://api.talonic.com/v1/compliance/tasks/${TASK}/claim`,
    })
    vi.unstubAllGlobals()
    call = stub({ task: {}, result: {} })
    await runGroupTool(tool("talonic_compliance_submit_task"), ctx, {
      task_id: TASK,
      execution_epoch: 3,
      answer: { verdict: "pass" },
    })
    expect(call()).toMatchObject({
      url: `https://api.talonic.com/v1/compliance/tasks/${TASK}/submit`,
      body: { execution_epoch: 3, answer: { verdict: "pass" } },
    })
  })

  it("deletes are destructive, reads are read-only", () => {
    for (const t of complianceGroup.tools) {
      if (t.route.startsWith("DELETE ")) expect(t.annotations.destructiveHint, t.name).toBe(true)
      if (t.route.startsWith("GET ")) expect(t.annotations.readOnlyHint, t.name).toBe(true)
    }
  })

  it("export returns the file as an embedded resource", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Type,Name\n", {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="compliance.csv"',
        },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const res = (await runGroupTool(tool("talonic_compliance_export"), ctx, {
      format: "csv",
      issues_only: true,
    })) as any
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://api.talonic.com/v1/compliance/export?format=csv&issues=true",
    )
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toMatchObject({
      filename: "compliance.csv",
      mime_type: "text/csv",
    })
    expect(Buffer.from(res.content[1].resource.blob, "base64").toString()).toBe("Type,Name\n")
  })

  it("export refuses a file over the cap", async () => {
    stub("x".repeat(100), 200, { "content-type": "text/csv" })
    const res = await handleComplianceExport(ctx, {}, 10)
    expect(res.isError).toBe(true)
  })

  it("an API error comes back as a tool error", async () => {
    stub({ message: "Task is not claimed by you" }, 409)
    const res = await runGroupTool(tool("talonic_compliance_heartbeat_task"), ctx, {
      task_id: TASK,
      execution_epoch: 1,
    })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("not claimed by you")
  })

  it("is registered only when the group is included", () => {
    const off = createServer({ apiKey: "tlnc_test" }) as any
    expect(off._registeredTools["talonic_compliance_issues"]).toBeUndefined()
    const on = createServer({ apiKey: "tlnc_test", toolGroups: ["compliance"] }) as any
    for (const t of complianceGroup.tools) expect(on._registeredTools[t.name], t.name).toBeDefined()
  })
})
