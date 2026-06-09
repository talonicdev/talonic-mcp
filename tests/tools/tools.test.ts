import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { Talonic } from "@talonic/node"
import { handleSaveSchema } from "../../src/tools/save-schema"
import {
  handleGetDocument,
  outputSchema as getDocumentOutputSchema,
} from "../../src/tools/get-document"
import { handleSearch } from "../../src/tools/search"
import { outputSchema as searchOutputSchema } from "../../src/tools/search"
import { handleFilter, outputSchema as filterOutputSchema } from "../../src/tools/filter"
import { handleToMarkdown } from "../../src/tools/to-markdown"
import { handleExtract } from "../../src/tools/extract"
import { handleGetBalance } from "../../src/tools/get-balance"
import { handleRequestUpload } from "../../src/tools/request-upload"

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

  it("outputSchema accepts a pre-processing document with null scalars (regression: -32602 mid-poll)", () => {
    // A freshly-uploaded browser-handoff doc returns null for size_bytes,
    // pages, filename, and extraction_count until OCR/ingest computes them.
    // The output schema MUST accept null or the MCP layer rejects the response
    // and the agent cannot poll talonic_get_document after talonic_request_upload.
    const Output = z.object(getDocumentOutputSchema)
    const preProcessing = {
      id: "doc_fresh",
      filename: null,
      pages: null,
      size_bytes: null,
      status: "pending_upload",
      extraction_count: null,
      source: null,
      triage: null,
    }
    expect(Output.safeParse(preProcessing).success).toBe(true)
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
describe("talonic_get_balance handler", () => {
  it("calls GET /v1/credits/balance and returns the enriched balance", async () => {
    const { talonic, fetchFn } = makeTalonic({
      balance_credits: 1888,
      balance_eur: 9.44,
      burn_rate_30d_credits: 360,
      projected_runway_days: 157,
      tier: "pro",
      tier_resets_at: "2026-06-01T00:00:00.000Z",
    })
    const result = await handleGetBalance(talonic)
    const [url, init] = lastCall(fetchFn)
    expect(url).toContain("/v1/credits/balance")
    expect(init.method).toBe("GET")
    const parsed = parsedText(result) as { balance_credits: number; tier: string }
    expect(parsed.balance_credits).toBe(1888)
    expect(parsed.tier).toBe("pro")
  })

  it("returns isError when the API rejects the call", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          statusCode: 401,
          code: "AUTH_REQUIRED",
          error: "Unauthorized",
          message: "Invalid API key",
        },
        401,
      ),
    )
    const talonic = new Talonic({
      apiKey: "tlnc_bad",
      fetch: fetchFn as unknown as typeof fetch,
      maxRetries: 0,
    })
    const result = await handleGetBalance(talonic)
    expect((result as { isError?: boolean }).isError).toBe(true)
  })
})

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

describe("search outputSchema documentCount nullability (regression: QA 2026-05-08)", () => {
  it("accepts fields[].documentCount = null for registry fields with no extractions yet", () => {
    const Output = z.object(searchOutputSchema)
    const apiResponse = {
      documents: [],
      fieldMatches: [],
      sources: [],
      schemas: [],
      fields: [
        {
          id: "uuid-1",
          canonicalName: "condition.invoice_requires_pod",
          documentCount: null,
          filterable: true,
        },
      ],
    }
    expect(Output.safeParse(apiResponse).success).toBe(true)
  })

  it("accepts fieldMatches[].documentCount = null for registry fields with no extractions yet", () => {
    const Output = z.object(searchOutputSchema)
    const apiResponse = {
      documents: [],
      fieldMatches: [
        {
          resolvedFieldId: "uuid-1",
          displayName: "Invoice requires POD",
          matchedValue: "yes",
          documentCount: null,
          filterable: true,
        },
      ],
      sources: [],
      schemas: [],
      fields: [],
    }
    expect(Output.safeParse(apiResponse).success).toBe(true)
  })
})

describe("filter outputSchema warnings passthrough (schema-typing footgun)", () => {
  // The Talonic API surfaces a `warnings[]` array on the filter response
  // when a numeric operator is applied to a string-typed field (the
  // lexicographic-comparison trap documented in the tool description and
  // STATUS.md). The MCP outputSchema must declare the field so Zod's
  // default strip-mode does not silently remove it from
  // `structuredContent` before the agent can read it.
  it("preserves a warnings array on the response", () => {
    const Output = z.object(filterOutputSchema)
    const apiResponse = {
      data: [],
      total: 0,
      warnings: [
        {
          code: "numeric_operator_on_string_field",
          message:
            "Operator `gt` was applied to field `invoice_total` typed as string. Numeric comparisons against string-typed fields use lexicographic ordering and may return zero matches.",
          field: "invoice_total",
          field_id: "fld_inv_total",
          suggestion: "Change the field's data_type to `number` in the schema definition.",
        },
      ],
    }
    const result = Output.safeParse(apiResponse)
    expect(result.success).toBe(true)
    if (result.success) {
      const parsed = result.data as { warnings?: Array<Record<string, unknown>> }
      expect(parsed.warnings).toBeDefined()
      expect(parsed.warnings).toHaveLength(1)
      expect(parsed.warnings?.[0]?.["code"]).toBe("numeric_operator_on_string_field")
      expect(parsed.warnings?.[0]?.["field"]).toBe("invoice_total")
    }
  })

  it("accepts unknown keys inside a warning entry (forward-compatibility)", () => {
    const Output = z.object(filterOutputSchema)
    const apiResponse = {
      data: [],
      total: 0,
      warnings: [
        {
          code: "future_warning_code",
          message: "Some future warning shape the API may add.",
          details: { future_key: "future_value" },
        },
      ],
    }
    const result = Output.safeParse(apiResponse)
    expect(result.success).toBe(true)
    if (result.success) {
      const parsed = result.data as { warnings?: Array<Record<string, unknown>> }
      expect(parsed.warnings?.[0]?.["details"]).toEqual({ future_key: "future_value" })
    }
  })

  it("accepts a response with no warnings (field is optional)", () => {
    const Output = z.object(filterOutputSchema)
    const apiResponse = { data: [], total: 0 }
    const result = Output.safeParse(apiResponse)
    expect(result.success).toBe(true)
  })
})

describe("search outputSchema dataType passthrough (schema-typing footgun, preventive)", () => {
  // The Talonic API began returning `dataType` on every entry of
  // `fieldMatches[]` and `fields[]` in commit c16f2656 + 0689c1b2
  // (2026-05-19), mirroring what `autocompleteFields` already does.
  // The MCP outputSchema must declare the field so Zod's default strip
  // mode does not drop it from `structuredContent`, otherwise agents
  // cannot gate `gt`/`gte`/`lt`/`lte`/`between` on
  // `field.dataType === "number"` before constructing a numeric filter.
  it("preserves dataType on fieldMatches entries", () => {
    const Output = z.object(searchOutputSchema)
    const apiResponse = {
      documents: [],
      fieldMatches: [
        {
          resolvedFieldId: "84cdf9cc-1d56-48f6-aead-6928b2b596de",
          displayName: "Invoice Total",
          matchedValue: "1500",
          documentCount: 12,
          filterable: true,
          dataType: "number",
        },
      ],
      sources: [],
      schemas: [],
      fields: [],
    }
    const result = Output.safeParse(apiResponse)
    expect(result.success).toBe(true)
    if (result.success) {
      const parsed = result.data as {
        fieldMatches: Array<{ dataType?: string | null }>
      }
      expect(parsed.fieldMatches[0]?.dataType).toBe("number")
    }
  })

  it("preserves dataType on fields entries", () => {
    const Output = z.object(searchOutputSchema)
    const apiResponse = {
      documents: [],
      fieldMatches: [],
      sources: [],
      schemas: [],
      fields: [
        {
          id: "1413a322-6663-44d2-a482-be9d081bbed0",
          canonicalName: "invoice_total",
          displayName: "invoice_total",
          documentCount: 12,
          filterable: true,
          dataType: "number",
        },
      ],
    }
    const result = Output.safeParse(apiResponse)
    expect(result.success).toBe(true)
    if (result.success) {
      const parsed = result.data as { fields: Array<{ dataType?: string | null }> }
      expect(parsed.fields[0]?.dataType).toBe("number")
    }
  })

  it("accepts null dataType on non-materialized entries (informational sources)", () => {
    const Output = z.object(searchOutputSchema)
    const apiResponse = {
      documents: [],
      fieldMatches: [
        {
          resolvedFieldId: null,
          displayName: "Field Key",
          matchedValue: "foo",
          documentCount: 1,
          filterable: false,
          dataType: null,
        },
      ],
      sources: [],
      schemas: [],
      fields: [],
    }
    expect(Output.safeParse(apiResponse).success).toBe(true)
  })

  it("accepts a response that omits dataType (forward-compatibility for older deploys)", () => {
    const Output = z.object(searchOutputSchema)
    const apiResponse = {
      documents: [],
      fieldMatches: [
        {
          resolvedFieldId: "x",
          displayName: "n",
          matchedValue: "v",
          documentCount: 0,
          filterable: true,
        },
      ],
      sources: [],
      schemas: [],
      fields: [],
    }
    expect(Output.safeParse(apiResponse).success).toBe(true)
  })
})

describe("talonic_request_upload handler", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts to /v1/documents/upload-session with the bearer token, filename, and returns the API fields", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          document_id: "doc_123",
          upload_url: "https://app.talonic.com/u/token-abc",
          expires_at: "2026-05-28T13:00:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )

    const result = await handleRequestUpload(() => "tlnc_test_key", undefined, {
      filename: "invoice.pdf",
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.talonic.com/v1/documents/upload-session")
    expect(init.method).toBe("POST")
    const headers = init.headers as Record<string, string>
    expect(headers["Authorization"]).toBe("Bearer tlnc_test_key")
    expect(headers["Content-Type"]).toBe("application/json")
    expect(headers["Accept"]).toBe("application/json")
    expect(JSON.parse(init.body as string)).toEqual({ filename: "invoice.pdf" })

    const parsed = parsedText(result) as {
      document_id: string
      upload_url: string
      expires_at: string
    }
    expect(parsed.document_id).toBe("doc_123")
    expect(parsed.upload_url).toBe("https://app.talonic.com/u/token-abc")
    expect(parsed.expires_at).toBe("2026-05-28T13:00:00.000Z")
  })

  it("honours a custom baseUrl (e.g., for staging)", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ document_id: "d", upload_url: "u", expires_at: "e" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )

    await handleRequestUpload(() => "tlnc_x", "https://staging-api.talonic.com", {
      filename: "x.pdf",
    })

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe("https://staging-api.talonic.com/v1/documents/upload-session")
  })

  it("calls getToken() per invocation (so a rotated OAuth token is picked up)", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ document_id: "d", upload_url: "u", expires_at: "e" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )

    const tokens = ["token-1", "token-2"]
    const getToken = vi.fn(() => tokens.shift() ?? "")

    await handleRequestUpload(getToken, undefined, { filename: "a.pdf" })
    await handleRequestUpload(getToken, undefined, { filename: "b.pdf" })

    expect(getToken).toHaveBeenCalledTimes(2)
    const headers1 = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >
    const headers2 = (fetchMock.mock.calls[1] as [string, RequestInit])[1].headers as Record<
      string,
      string
    >
    expect(headers1["Authorization"]).toBe("Bearer token-1")
    expect(headers2["Authorization"]).toBe("Bearer token-2")
  })

  it("returns a tool error on non-2xx response, including status code and body", async () => {
    fetchMock.mockResolvedValue(new Response("Unauthorized", { status: 401 }))

    const result = await handleRequestUpload(() => "bad-key", undefined, {
      filename: "x.pdf",
    })

    expect((result as { isError?: true }).isError).toBe(true)
    expect(result.content[0]?.text).toContain("HTTP 401")
    expect(result.content[0]?.text).toContain("Unauthorized")
  })

  it("returns a tool error when fetch itself throws (network failure)", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"))

    const result = await handleRequestUpload(() => "k", undefined, {
      filename: "x.pdf",
    })

    expect((result as { isError?: true }).isError).toBe(true)
    expect(result.content[0]?.text).toContain("ECONNREFUSED")
  })
})
