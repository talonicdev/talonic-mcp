import { beforeEach, describe, expect, it, vi } from "vitest"
import { Talonic } from "@talonic/node"
import { handleSaveSchema } from "../../src/tools/save-schema"
import { handleGetDocument } from "../../src/tools/get-document"
import { handleSearch } from "../../src/tools/search"
import { handleFilter } from "../../src/tools/filter"
import { handleToMarkdown } from "../../src/tools/to-markdown"
import { handleExtract } from "../../src/tools/extract"

type MockedFetch = ReturnType<typeof vi.fn>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function makeTalonic(responseBody: unknown): { talonic: Talonic; fetchFn: MockedFetch } {
  const fetchFn = vi.fn().mockResolvedValue(jsonResponse(responseBody))
  const talonic = new Talonic({
    apiKey: "tlnc_test",
    fetch: fetchFn as unknown as typeof fetch,
    maxRetries: 0,
  })
  return { talonic, fetchFn }
}

function lastCall(fetchFn: MockedFetch): [string, RequestInit] {
  const calls = fetchFn.mock.calls
  return calls[calls.length - 1] as [string, RequestInit]
}

function parsedText(result: { content: Array<{ text: string }> }): unknown {
  return JSON.parse(result.content[0]?.text ?? "")
}

describe("talonic_save_schema handler", () => {
  it("posts to /v1/schemas with name, definition, description", async () => {
    const { talonic, fetchFn } = makeTalonic({
      id: "sch_new",
      name: "Invoice",
      created_at: "2026-04-28",
    })

    const result = await handleSaveSchema(talonic, {
      name: "Invoice",
      definition: { vendor_name: "string" },
      description: "Standard invoice schema",
    })

    const [url, init] = lastCall(fetchFn)
    expect(url).toContain("/v1/schemas")
    expect(init.method).toBe("POST")
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body["name"]).toBe("Invoice")
    expect(body["definition"]).toEqual({ vendor_name: "string" })
    expect(body["description"]).toBe("Standard invoice schema")
    const parsed = parsedText(result) as { id: string }
    expect(parsed.id).toBe("sch_new")
  })

  it("omits description when not provided", async () => {
    const { talonic, fetchFn } = makeTalonic({ id: "sch_x", name: "X" })
    await handleSaveSchema(talonic, { name: "X", definition: {} })
    const init = lastCall(fetchFn)[1]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body["description"]).toBeUndefined()
  })
})

describe("talonic_get_document handler", () => {
  it("calls GET /v1/documents/:id", async () => {
    const { talonic, fetchFn } = makeTalonic({
      id: "doc_1",
      filename: "invoice.pdf",
      status: "completed",
      created_at: "2026-04-28",
    })
    await handleGetDocument(talonic, { document_id: "doc_1" })
    const [url, init] = lastCall(fetchFn)
    expect(url).toContain("/v1/documents/doc_1")
    expect(init.method).toBe("GET")
  })
})

describe("talonic_search handler", () => {
  it("calls GET /v1/search with q and optional limit", async () => {
    const { talonic, fetchFn } = makeTalonic({
      documents: [],
      fieldMatches: [],
      sources: [],
      schemas: [],
      fields: [],
    })
    await handleSearch(talonic, { query: "indemnification", limit: 10 })
    const url = lastCall(fetchFn)[0]
    expect(url).toContain("/v1/search")
    expect(url).toContain("q=indemnification")
    expect(url).toContain("limit=10")
  })

  it("omits limit when not provided", async () => {
    const { talonic, fetchFn } = makeTalonic({
      documents: [],
      fieldMatches: [],
      sources: [],
      schemas: [],
      fields: [],
    })
    await handleSearch(talonic, { query: "test" })
    const url = lastCall(fetchFn)[0]
    expect(url).not.toContain("limit=")
  })
})

describe("talonic_filter handler", () => {
  it("posts to /v1/documents/filter with field_id passed straight through", async () => {
    const { talonic, fetchFn } = makeTalonic({ documents: [], total: 0 })
    await handleFilter(talonic, {
      conditions: [{ field_id: "fld_v", operator: "eq", value: "Acme" }],
    })
    const [url, init] = lastCall(fetchFn)
    expect(url).toContain("/v1/documents/filter")
    const body = JSON.parse(init.body as string) as {
      conditions: Array<{ fieldId: string; operator: string; value: string }>
    }
    expect(body.conditions[0]?.fieldId).toBe("fld_v")
    expect(body.conditions[0]?.operator).toBe("eq")
    expect(body.conditions[0]?.value).toBe("Acme")
  })

  it("passes a field name straight through as fieldId (no autocomplete dance)", async () => {
    const { talonic, fetchFn } = makeTalonic({ documents: [], total: 0 })
    await handleFilter(talonic, {
      conditions: [{ field: "vendor_name", operator: "eq", value: "Acme" }],
    })
    expect(fetchFn).toHaveBeenCalledOnce()
    expect(fetchFn.mock.calls[0]?.[0]).toContain("/v1/documents/filter")
    const body = JSON.parse((fetchFn.mock.calls[0]?.[1] as { body: string }).body) as {
      conditions: Array<{ fieldId: string }>
    }
    expect(body.conditions[0]?.fieldId).toBe("vendor_name")
  })

  it("forwards search, sort, page, limit, source as source_id", async () => {
    const { talonic, fetchFn } = makeTalonic({ documents: [], total: 0 })
    await handleFilter(talonic, {
      conditions: [{ field_id: "fld_v", operator: "eq", value: "Acme" }],
      search: "invoice",
      sort: { field_id: "fld_d", direction: "desc" },
      page: 2,
      limit: 50,
      source_connection_id: "src_1",
    })
    const body = JSON.parse((lastCall(fetchFn)[1].body as string) ?? "") as Record<string, unknown>
    expect(body["search"]).toBe("invoice")
    expect(body["sort"]).toEqual({ fieldId: "fld_d", direction: "desc" })
    expect(body["page"]).toBe(2)
    expect(body["limit"]).toBe(50)
    expect(body["source_id"]).toBe("src_1")
  })
})

describe("talonic_to_markdown handler", () => {
  it("calls GET /v1/documents/:id/markdown", async () => {
    const { talonic, fetchFn } = makeTalonic({ document_id: "doc_1", markdown: "# Hello" })
    const result = await handleToMarkdown(talonic, { document_id: "doc_1" })
    const url = lastCall(fetchFn)[0]
    expect(url).toContain("/v1/documents/doc_1/markdown")
    const parsed = parsedText(result) as { markdown: string }
    expect(parsed.markdown).toBe("# Hello")
  })
})

describe("talonic_extract handler", () => {
  let client: ReturnType<typeof makeTalonic>

  beforeEach(() => {
    client = makeTalonic({
      extraction_id: "ext_1",
      status: "complete",
      document: { id: "doc_1", filename: "test.pdf" },
      data: { vendor_name: "Acme" },
    })
  })

  it("posts multipart to /v1/extract with document_id and inline schema", async () => {
    const result = await handleExtract(client.talonic, {
      document_id: "doc_1",
      schema: { vendor_name: "string" },
    })
    const [url, init] = lastCall(client.fetchFn)
    expect(url).toContain("/v1/extract")
    expect(init.method).toBe("POST")
    expect(init.body).toBeInstanceOf(FormData)
    const fd = init.body as FormData
    expect(fd.get("document_id")).toBe("doc_1")
    expect(fd.get("schema")).toBe(JSON.stringify({ vendor_name: "string" }))
    const parsed = parsedText(result) as { extraction_id: string }
    expect(parsed.extraction_id).toBe("ext_1")
  })

  it("forwards schema_id, instructions, and include_markdown", async () => {
    await handleExtract(client.talonic, {
      document_id: "doc_1",
      schema_id: "sch_1",
      instructions: "Focus on totals",
      include_markdown: true,
    })
    const fd = lastCall(client.fetchFn)[1].body as FormData
    expect(fd.get("schema_id")).toBe("sch_1")
    expect(fd.get("instructions")).toBe("Focus on totals")
    expect(fd.get("include_markdown")).toBe("true")
  })

  it("returns isError when no file source provided", async () => {
    const result = await handleExtract(client.talonic, {})
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/file source/)
  })
})
