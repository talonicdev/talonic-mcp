import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { Talonic } from "@talonic/node"
import { handleSaveSchema } from "../../src/tools/save-schema"
import { handleGetDocument } from "../../src/tools/get-document"
import { handleSearch } from "../../src/tools/search"
import { outputSchema as searchOutputSchema } from "../../src/tools/search"
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

  it("passes a canonical field name straight through to the API in fieldId", async () => {
    const { talonic, fetchFn } = makeTalonic({ documents: [], total: 0 })
    await handleFilter(talonic, {
      conditions: [{ field: "vendor.name", operator: "eq", value: "Acme" }],
    })

    // No /v1/fields lookup: the API resolves canonical names server-side.
    expect(fetchFn).toHaveBeenCalledOnce()
    expect(lastCall(fetchFn)[0]).toContain("/v1/documents/filter")
    const body = JSON.parse(lastCall(fetchFn)[1].body as string) as {
      conditions: Array<{ fieldId: string }>
    }
    expect(body.conditions[0]?.fieldId).toBe("vendor.name")
  })

  it("passes fieldId: 'vendor_name' through without modification (M2 requirement)", async () => {
    const { talonic, fetchFn } = makeTalonic({ documents: [], total: 0 })
    await handleFilter(talonic, {
      conditions: [{ field: "vendor_name", operator: "eq", value: "Acme Corp" }],
    })
    const body = JSON.parse(lastCall(fetchFn)[1].body as string) as {
      conditions: Array<{ fieldId: string; operator: string; value: string }>
    }
    expect(body.conditions[0]?.fieldId).toBe("vendor_name")
    expect(body.conditions[0]?.value).toBe("Acme Corp")
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
  it("with document_id calls GET /v1/documents/:id/markdown directly", async () => {
    const { talonic, fetchFn } = makeTalonic({ document_id: "doc_1", markdown: "# Hello" })
    const result = await handleToMarkdown(talonic, { document_id: "doc_1" })
    const url = lastCall(fetchFn)[0]
    expect(url).toContain("/v1/documents/doc_1/markdown")
    expect(fetchFn).toHaveBeenCalledOnce()
    const parsed = parsedText(result) as { markdown: string }
    expect(parsed.markdown).toBe("# Hello")
  })

  it("with file_url ingests via /v1/extract first, then fetches markdown", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          extraction_id: "ingested-1",
          status: "complete",
          document: { id: "doc-from-url", filename: "remote.pdf" },
          data: {},
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ document_id: "doc-from-url", markdown: "# Hi" }))
    const talonic = new Talonic({
      apiKey: "k",
      fetch: fetchFn as unknown as typeof fetch,
      maxRetries: 0,
    })

    const result = await handleToMarkdown(talonic, { file_url: "https://example.com/x.pdf" })

    expect(fetchFn.mock.calls[0]?.[0]).toContain("/v1/extract")
    expect(fetchFn.mock.calls[1]?.[0]).toContain("/v1/documents/doc-from-url/markdown")
    const parsed = parsedText(result) as { markdown: string }
    expect(parsed.markdown).toBe("# Hi")
  })

  it("rejects when no input is provided", async () => {
    const { talonic } = makeTalonic({})
    const result = await handleToMarkdown(talonic, {})
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/document_id/)
  })

  it("rejects when multiple inputs are provided", async () => {
    const { talonic } = makeTalonic({})
    const result = await handleToMarkdown(talonic, {
      document_id: "doc_1",
      file_url: "https://x",
    })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/exactly one/)
  })

  it("with file_data ingests via /v1/extract first, then fetches markdown", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          extraction_id: "ingested-fd",
          status: "complete",
          document: { id: "doc-from-data", filename: "scan.pdf" },
          data: {},
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ document_id: "doc-from-data", markdown: "# Body" }))
    const talonic = new Talonic({
      apiKey: "k",
      fetch: fetchFn as unknown as typeof fetch,
      maxRetries: 0,
    })

    const bytes = Buffer.from("%PDF-1.4 fake")
    const result = await handleToMarkdown(talonic, {
      file_data: bytes.toString("base64"),
      filename: "scan.pdf",
    })

    expect(fetchFn.mock.calls[0]?.[0]).toContain("/v1/extract")
    const ingestInit = fetchFn.mock.calls[0]?.[1] as RequestInit
    const fd = ingestInit.body as FormData
    const file = fd.get("file") as File
    expect(file.name).toBe("scan.pdf")
    expect(file.type).toBe("application/pdf")
    expect(file.size).toBe(bytes.byteLength)

    expect(fetchFn.mock.calls[1]?.[0]).toContain("/v1/documents/doc-from-data/markdown")
    const parsed = parsedText(result) as { markdown: string }
    expect(parsed.markdown).toBe("# Body")
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

  it("returns isError when no schema or schema_id is provided", async () => {
    const result = await handleExtract(client.talonic, { document_id: "doc_1" })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/requires a schema/)
  })

  it("returns isError when no file source provided", async () => {
    const result = await handleExtract(client.talonic, {
      schema: { type: "object", properties: { x: { type: "string" } } },
    })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/file source/)
  })

  it("returns isError when both schema and schema_id are provided", async () => {
    const result = await handleExtract(client.talonic, {
      document_id: "doc_1",
      schema: { type: "object", properties: { x: { type: "string" } } },
      schema_id: "sch_1",
    })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/schema.*OR.*schema_id|not both/)
  })

  it("decodes file_data + filename and uploads as multipart with inferred MIME", async () => {
    const bytes = Buffer.from("%PDF-1.4 fake pdf body for test")
    const file_data = bytes.toString("base64")
    await handleExtract(client.talonic, {
      file_data,
      filename: "invoice.pdf",
      schema: { type: "object", properties: { vendor_name: { type: "string" } } },
    })
    const init = lastCall(client.fetchFn)[1]
    expect(init.method).toBe("POST")
    const fd = init.body as FormData
    const file = fd.get("file") as File
    expect(file).toBeInstanceOf(Blob)
    expect(file.name).toBe("invoice.pdf")
    expect(file.type).toBe("application/pdf")
    // size should match the original buffer length
    expect(file.size).toBe(bytes.byteLength)
  })

  it("file_data without filename still uploads (default filename, octet-stream)", async () => {
    const bytes = Buffer.from("hello")
    await handleExtract(client.talonic, {
      file_data: bytes.toString("base64"),
      schema: { type: "object", properties: { x: { type: "string" } } },
    })
    const fd = lastCall(client.fetchFn)[1].body as FormData
    const file = fd.get("file") as File
    expect(file).toBeInstanceOf(Blob)
    expect(file.size).toBe(bytes.byteLength)
  })

  it("rejects when both file_data and file_path are provided", async () => {
    const result = await handleExtract(client.talonic, {
      file_data: Buffer.from("x").toString("base64"),
      filename: "x.pdf",
      file_path: "/tmp/x.pdf",
      schema: { type: "object", properties: {} },
    })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/multiple_file_sources|exactly one/)
  })
})

/**
 * Regression: the API's /v1/search response includes "schema-only" field
 * entries with `id: null` (declared in a schema but not yet materialized
 * in the field-registry index). The MCP outputSchema previously declared
 * `fields[].id: z.string()` and rejected null with `-32602` at the MCP
 * layer. Fix is `z.string().nullable()`. Test covers both the materialized
 * (id: string) and the schema-only (id: null) branches.
 */
describe("search outputSchema fields[].id nullability (regression: MCP -32602)", () => {
  it("accepts a mixed result with one materialized field and one schema-only field", () => {
    const Output = z.object(searchOutputSchema)
    const apiResponse = {
      documents: [{ id: "doc-1", name: "invoice.pdf" }],
      fieldMatches: [],
      sources: [],
      schemas: [],
      fields: [
        { id: "uuid-1", canonicalName: "vendor.name", documentCount: 12, filterable: true },
        { id: null, canonicalName: "policy.coverage_type", documentCount: 0, filterable: false },
      ],
    }
    const result = Output.safeParse(apiResponse)
    expect(result.success).toBe(true)
  })

  it("accepts an empty-search response (all arrays empty)", () => {
    const Output = z.object(searchOutputSchema)
    const apiResponse = {
      documents: [],
      fieldMatches: [],
      sources: [],
      schemas: [],
      fields: [],
    }
    expect(Output.safeParse(apiResponse).success).toBe(true)
  })
})
