import { afterEach, describe, expect, it, vi } from "vitest"
import { runGroupTool, type GroupTool } from "../../src/tools/_groups"
import { dataManagementGroup } from "../../src/tools/data-management"
import { createServer } from "../../src/server-factory"

const DOC = "8a1f6c2e-3b4d-4e5f-9a6b-7c8d9e0f1a2b"
const JOB = "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9"
const ctx = { getToken: () => "tlnc_key", baseUrl: undefined }

function tool(name: string): GroupTool {
  const t = dataManagementGroup.tools.find((x) => x.name === name)
  if (!t) throw new Error(`no tool ${name}`)
  return t
}

function stub(body: unknown = {}, status = 200, contentType = "application/json") {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": contentType },
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
      calls: fetchMock.mock.calls.length,
    }
  }
}

const call = (name: string, args: Record<string, unknown>) => runGroupTool(tool(name), ctx, args)

afterEach(() => vi.unstubAllGlobals())

describe("documents", () => {
  it("list forwards filters and paging as the query string", async () => {
    const c = stub({ data: [], pagination: {} })
    await call("talonic_list_documents", {
      status: "error",
      search: "invoice",
      top_level: true,
      limit: 5,
      cursor: "abc",
      order: "asc",
    })
    expect(c()).toMatchObject({
      method: "GET",
      url: "https://api.talonic.com/v1/documents?status=error&search=invoice&top_level=true&limit=5&cursor=abc&order=asc",
      auth: "Bearer tlnc_key",
    })
  })

  it("re-extract posts to the document; not idempotent", async () => {
    const c = stub({ id: DOC, status: "processing" })
    await call("talonic_reextract_document", { document_id: DOC })
    expect(c()).toMatchObject({
      method: "POST",
      url: `https://api.talonic.com/v1/documents/${DOC}/re-extract`,
    })
    expect(tool("talonic_reextract_document").annotations.idempotentHint).toBe(false)
  })

  it("delete calls DELETE and is annotated destructive", async () => {
    const c = stub({ deleted: true, id: DOC })
    await call("talonic_delete_document", { document_id: DOC })
    expect(c()).toMatchObject({
      method: "DELETE",
      url: `https://api.talonic.com/v1/documents/${DOC}`,
    })
    expect(tool("talonic_delete_document").annotations.destructiveHint).toBe(true)
    expect(tool("talonic_delete_document").description).toMatch(/Cannot be undone/)
  })
})

describe("extractions", () => {
  it("list, get and data address the extraction", async () => {
    let c = stub({ data: [] })
    await call("talonic_list_extractions", { document_id: DOC, status: "failed" })
    expect(c().url).toBe(`https://api.talonic.com/v1/extractions?document_id=${DOC}&status=failed`)
    vi.unstubAllGlobals()
    c = stub({ id: DOC })
    await call("talonic_get_extraction", { extraction_id: DOC })
    expect(c().url).toBe(`https://api.talonic.com/v1/extractions/${DOC}`)
    vi.unstubAllGlobals()
    c = stub({ total: 10 })
    const res = await call("talonic_get_extraction_data", { extraction_id: DOC })
    expect(c().url).toBe(`https://api.talonic.com/v1/extractions/${DOC}/data`)
    expect(res.structuredContent).toEqual({ total: 10 })
  })

  it("data as CSV returns the text", async () => {
    stub("total\n10", 200, "text/csv")
    const res = await call("talonic_get_extraction_data", { extraction_id: DOC, format: "csv" })
    expect(res.structuredContent).toEqual({ format: "csv", csv: "total\n10" })
  })

  it("correct sends the field map itself as the PATCH body", async () => {
    const c = stub({ cells_written: ["total"] })
    await call("talonic_correct_extraction", { extraction_id: DOC, values: { total: 12.5 } })
    expect(c()).toMatchObject({
      method: "PATCH",
      url: `https://api.talonic.com/v1/extractions/${DOC}/data`,
      body: { total: 12.5 },
    })
  })

  it("correct refuses an empty map before any call", async () => {
    const c = stub()
    const res = await call("talonic_correct_extraction", { extraction_id: DOC, values: {} })
    expect(res.isError).toBe(true)
    expect(() => c()).toThrow()
  })
})

describe("jobs", () => {
  it("list, get and results", async () => {
    let c = stub({ data: [] })
    await call("talonic_list_jobs", { status: "processing", limit: 10 })
    expect(c().url).toBe("https://api.talonic.com/v1/jobs?status=processing&limit=10")
    vi.unstubAllGlobals()
    c = stub({ id: JOB })
    await call("talonic_get_job", { job_id: JOB })
    expect(c().url).toBe(`https://api.talonic.com/v1/jobs/${JOB}`)
    vi.unstubAllGlobals()
    c = stub({ data: [] })
    await call("talonic_get_job_results", { job_id: JOB })
    expect(c().url).toBe(`https://api.talonic.com/v1/jobs/${JOB}/results`)
  })

  it("create sends the schema and documents; all_documents is never sent", async () => {
    let c = stub({ id: JOB, status: "pending" })
    await call("talonic_create_job", { schema_id: JOB, document_ids: [DOC], name: "Q3" })
    expect(c()).toMatchObject({
      method: "POST",
      url: "https://api.talonic.com/v1/jobs",
      body: { schema_id: JOB, document_ids: [DOC], name: "Q3" },
    })
    vi.unstubAllGlobals()
    c = stub({ id: JOB })
    await call("talonic_create_job", { schema_id: JOB, all_documents: true })
    expect(c().body).toEqual({ schema_id: JOB })
  })

  it("create refuses a call that names no documents, or both forms", async () => {
    const c = stub()
    expect((await call("talonic_create_job", { schema_id: JOB })).isError).toBe(true)
    expect(
      (
        await call("talonic_create_job", {
          schema_id: JOB,
          document_ids: [DOC],
          all_documents: true,
        })
      ).isError,
    ).toBe(true)
    expect(() => c()).toThrow()
  })

  it("cancel posts to the job, is idempotent, and a second cancel's 409 is a tool error", async () => {
    let c = stub({ id: JOB, status: "failed" })
    await call("talonic_cancel_job", { job_id: JOB })
    expect(c()).toMatchObject({
      method: "POST",
      url: `https://api.talonic.com/v1/jobs/${JOB}/cancel`,
    })
    expect(tool("talonic_cancel_job").annotations).toMatchObject({
      idempotentHint: true,
      destructiveHint: false,
    })
    vi.unstubAllGlobals()
    stub({ error: "conflict", message: "Job is already failed. Cannot cancel." }, 409)
    const res = await call("talonic_cancel_job", { job_id: JOB })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("Cannot cancel")
    expect(res.content[0]!.text).toContain("conflict")
  })
})

describe("schemas", () => {
  it("update PUTs only the fields given", async () => {
    const c = stub({ id: "s" })
    await call("talonic_update_schema", {
      schema_id: "SCH-1A2B3C4D",
      name: "Invoice v2",
      fields: [{ field_name: "total", data_type: "number" }],
    })
    expect(c()).toMatchObject({
      method: "PUT",
      url: "https://api.talonic.com/v1/schemas/SCH-1A2B3C4D",
      body: { name: "Invoice v2", fields: [{ field_name: "total", data_type: "number" }] },
    })
  })

  it("update refuses nothing-to-change and definition+fields together", async () => {
    const c = stub()
    expect((await call("talonic_update_schema", { schema_id: "s" })).isError).toBe(true)
    expect(
      (
        await call("talonic_update_schema", {
          schema_id: "s",
          definition: { properties: {} },
          fields: [{ field_name: "a" }],
        })
      ).isError,
    ).toBe(true)
    expect(() => c()).toThrow()
  })

  it("update and delete are annotated destructive", async () => {
    const c = stub({ deleted: true })
    await call("talonic_delete_schema", { schema_id: "SCH-1A2B3C4D" })
    expect(c()).toMatchObject({
      method: "DELETE",
      url: "https://api.talonic.com/v1/schemas/SCH-1A2B3C4D",
    })
    for (const n of ["talonic_update_schema", "talonic_delete_schema"]) {
      expect(tool(n).annotations.destructiveHint).toBe(true)
    }
  })
})

describe("data management group", () => {
  it("an API error comes back as a tool error with the next step", async () => {
    stub({ message: "Document not found." }, 404)
    const res = await call("talonic_delete_document", { document_id: DOC })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("Document not found.")
    expect(res.content[0]!.text).toContain("Next step")
  })

  it("only DELETE / replace tools are destructive; reads are read-only", () => {
    for (const t of dataManagementGroup.tools) {
      const method = t.route.split(" ")[0]
      if (method === "GET") expect(t.annotations.readOnlyHint, t.name).toBe(true)
      if (method === "DELETE") expect(t.annotations.destructiveHint, t.name).toBe(true)
    }
  })

  it("registers only when the group is included", () => {
    const names = dataManagementGroup.tools.map((t) => t.name)
    const on = createServer({ apiKey: "tlnc_test", toolGroups: ["data_management"] }) as any
    const off = createServer({ apiKey: "tlnc_test" }) as any
    for (const n of names) {
      expect(on._registeredTools[n], n).toBeDefined()
      expect(off._registeredTools[n], n).toBeUndefined()
    }
    expect(on._registeredTools["talonic_delete_document"].annotations).toMatchObject({
      destructiveHint: true,
      readOnlyHint: false,
    })
  })

  it("probes a one-item document list", () => {
    expect(dataManagementGroup.probe).toEqual({ path: "/v1/documents", params: { limit: 1 } })
  })
})
