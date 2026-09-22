import { afterEach, describe, expect, it, vi } from "vitest"
import { handleGetRun, handleGetRunResults, handleRunSpec, mapRunStatus } from "../../src/tools/run"

type Call = { url: string; init: RequestInit }
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}
function stubFetch(routes: Array<[string, unknown]>, status = 200) {
  const calls: Call[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      for (const [needle, body] of routes)
        if (url.includes(needle)) return jsonResponse(body, status)
      return jsonResponse({ error: "not_found" }, 404)
    }),
  )
  return calls
}
const getToken = () => "tlnc_test"
const parsed = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0]?.text ?? "")
const SPEC = "b8ec7fe1-3656-42ab-8027-0238afbc930c"
const DOC1 = "d0c00001-0000-4000-8000-000000000001"
const DOC2 = "d0c00001-0000-4000-8000-000000000002"
const PIPE = "p1pe0001-0000-4000-8000-000000000001"
const RUN = "a0000001-0000-4000-8000-000000000001"

describe("mapRunStatus", () => {
  it.each([
    ["completed", "completed"],
    ["failed", "failed"],
    ["error", "failed"],
    ["cancelled", "failed"],
    ["active", "processing"],
    ["running", "processing"],
    ["finalizing", "processing"],
    ["processing", "processing"],
    [undefined, "processing"],
    [42, "processing"],
  ])("%s -> %s", (raw, expected) => {
    expect(mapRunStatus(raw)).toBe(expected)
  })
})

describe("talonic_run_spec", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("document_ids -> POST /v1/pipelines JSON and a pipeline RunEnvelope", async () => {
    const calls = stubFetch([
      [
        "/v1/pipelines",
        {
          id: PIPE,
          status: "active",
          schema: { id: SPEC, name: "Purchase Order" },
          document_count: 2,
          enqueued_documents: 2,
          appended: false,
          run_id: RUN,
          message: "Pipeline created and queued for processing.",
          links: { self: `/v1/pipelines/${PIPE}`, progress: `/v1/pipelines/${PIPE}/progress` },
        },
      ],
    ])
    const res = await handleRunSpec(getToken, "https://api.example.test", {
      spec_id: SPEC,
      document_ids: [DOC1, DOC2],
      name: "smoke",
      pipeline_mode: "new",
    })
    expect(calls[0].url).toBe("https://api.example.test/v1/pipelines")
    expect(calls[0].init.method).toBe("POST")
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      schema_id: SPEC,
      document_ids: [DOC1, DOC2],
      name: "smoke",
      pipeline_mode: "new",
    })
    const env = parsed(res)
    expect(env).toMatchObject({
      run_kind: "pipeline",
      run_id: RUN,
      pipeline_id: PIPE,
      spec_id: SPEC,
      status: "processing",
      raw_status: "active",
      input_count: 2,
      enqueued_documents: 2,
      appended: false,
    })
    expect(env.links.progress).toBe(`/v1/pipelines/${PIPE}/progress`)
  })

  it("file_urls -> POST /v1/run multipart and a run RunEnvelope", async () => {
    const calls = stubFetch([
      [
        "/v1/run",
        {
          run_id: RUN,
          spec_id: SPEC,
          status: "processing",
          input_count: 1,
          poll_url: `/v1/run/${RUN}`,
          documents: [
            {
              document_id: DOC1,
              filename: "invoice-0421.pdf",
              size_bytes: 1024,
              source: "file_url",
              deduplicated: false,
            },
          ],
        },
      ],
    ])
    const res = await handleRunSpec(getToken, undefined, {
      spec_id: SPEC,
      file_urls: ["https://files.example/invoice-0421.pdf"],
      batch_id: "b-1",
      metadata: { region: "EU", priority: 2 },
    })
    expect(calls[0].url).toBe("https://api.talonic.com/v1/run")
    const form = calls[0].init.body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(form.get("spec_id")).toBe(SPEC)
    expect(form.getAll("file_urls")).toEqual(["https://files.example/invoice-0421.pdf"])
    expect(form.get("batch_id")).toBe("b-1")
    expect(JSON.parse(String(form.get("metadata")))).toEqual({ region: "EU", priority: 2 })
    const env = parsed(res)
    expect(env).toMatchObject({
      run_kind: "run",
      run_id: RUN,
      pipeline_id: null,
      spec_id: SPEC,
      status: "processing",
      input_count: 1,
    })
    expect(env.documents[0].filename).toBe("invoice-0421.pdf")
    expect(env.links.poll).toBe(`/v1/run/${RUN}`)
  })

  it.each([
    [{ spec_id: SPEC }, /exactly one of document_ids or file_urls/],
    [
      { spec_id: SPEC, document_ids: [DOC1], file_urls: ["https://x.example/a.pdf"] },
      /exactly one of document_ids or file_urls/,
    ],
    [{ spec_id: SPEC, document_ids: [] }, /exactly one of document_ids or file_urls/],
    [{ spec_id: SPEC, file_urls: ["http://x.example/a.pdf"] }, /https:\/\//],
    [{ spec_id: SPEC, document_ids: [DOC1], batch_id: "b" }, /batch_id and metadata only apply/],
    [
      { spec_id: SPEC, document_ids: [DOC1], metadata: { a: 1 } },
      /batch_id and metadata only apply/,
    ],
  ])("rejects %j at the MCP layer without calling the API", async (args, message) => {
    const calls = stubFetch([])
    const res = await handleRunSpec(getToken, undefined, args as any)
    expect((res as any).isError).toBe(true)
    expect(res.content[0].text).toMatch(message)
    expect(calls).toHaveLength(0)
  })
})

describe("talonic_get_run", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("run_id -> GET /v1/run/{id}, normalised", async () => {
    stubFetch([
      [
        `/v1/run/${RUN}`,
        {
          run_id: RUN,
          spec_id: SPEC,
          status: "completed",
          pipeline_id: PIPE,
          input_count: 1,
          progress: { total_documents: 1, completed_documents: 1, error_documents: 0 },
          documents: [{ document_id: DOC1, filename: "invoice-0421.pdf", status: "completed" }],
          created_at: "2026-09-22T10:00:00Z",
          updated_at: "2026-09-22T10:01:00Z",
        },
      ],
    ])
    const env = parsed(await handleGetRun(getToken, undefined, { run_id: RUN }))
    expect(env).toMatchObject({
      run_kind: "run",
      run_id: RUN,
      pipeline_id: PIPE,
      spec_id: SPEC,
      status: "completed",
      raw_status: "completed",
      input_count: 1,
    })
    expect(env.progress.completed_documents).toBe(1)
    expect(env.documents[0].status).toBe("completed")
  })

  it("pipeline_id -> GET /v1/pipelines/{id} + /progress, normalised to snake_case", async () => {
    const calls = stubFetch([
      [
        `/v1/pipelines/${PIPE}/progress`,
        {
          pipelineId: PIPE,
          status: "finalizing",
          totalDocuments: 2,
          completedDocuments: 1,
          errorDocuments: 0,
          finalizationPending: ["assembly"],
          phases: [
            {
              phaseId: "ph1",
              name: "Extract",
              type: "extraction",
              completed: 1,
              running: 1,
              errors: 0,
            },
          ],
        },
      ],
      [
        `/v1/pipelines/${PIPE}`,
        {
          id: PIPE,
          name: "smoke",
          status: "active",
          schema: { id: SPEC },
          phase_count: 1,
          created_at: "2026-09-22T10:00:00Z",
          links: {},
        },
      ],
    ])
    const env = parsed(await handleGetRun(getToken, undefined, { pipeline_id: PIPE }))
    expect(calls.map((c) => c.url)).toEqual([
      `https://api.talonic.com/v1/pipelines/${PIPE}`,
      `https://api.talonic.com/v1/pipelines/${PIPE}/progress`,
    ])
    expect(env).toMatchObject({
      run_kind: "pipeline",
      run_id: null,
      pipeline_id: PIPE,
      spec_id: SPEC,
      status: "processing",
      raw_status: "finalizing",
      name: "smoke",
    })
    expect(env.progress).toEqual({
      total_documents: 2,
      completed_documents: 1,
      error_documents: 0,
      finalization_pending: ["assembly"],
      phases: [
        {
          phase_id: "ph1",
          name: "Extract",
          type: "extraction",
          completed: 1,
          running: 1,
          errors: 0,
        },
      ],
    })
  })

  it.each([[{}], [{ run_id: RUN, pipeline_id: PIPE }]])(
    "rejects %j — exactly one id",
    async (args) => {
      const calls = stubFetch([])
      const res = await handleGetRun(getToken, undefined, args as any)
      expect((res as any).isError).toBe(true)
      expect(res.content[0].text).toMatch(/exactly one of run_id or pipeline_id/)
      expect(calls).toHaveLength(0)
    },
  )
})

describe("talonic_get_run_results", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("run_id -> GET /v1/run/{id}/results with include joined", async () => {
    const calls = stubFetch([
      [
        `/v1/run/${RUN}/results`,
        {
          run_id: RUN,
          pipeline_id: PIPE,
          spec_id: SPEC,
          status: "completed",
          view: "documents",
          generated_at: "2026-09-22T10:02:00Z",
          columns: [
            { field_key: "total_amount", display_name: "Total Amount", data_type: "number" },
          ],
          data: [
            {
              document_id: DOC1,
              filename: "invoice-0421.pdf",
              run_id: RUN,
              pipeline_id: PIPE,
              record_id: "rec1",
              status: "complete",
              completed_at: null,
              fields: { total_amount: 1299 },
            },
          ],
          pagination: { total: 1, limit: 50, has_more: false, next_cursor: null },
          pending_review_count: 0,
          links: { self: "x", run: "y" },
        },
      ],
    ])
    const body = parsed(
      await handleGetRunResults(getToken, undefined, {
        run_id: RUN,
        include: ["cells", "provenance"],
        limit: 50,
      }),
    )
    expect(calls[0].url).toBe(
      `https://api.talonic.com/v1/run/${RUN}/results?include=cells%2Cprovenance&limit=50`,
    )
    expect(body.run_kind).toBe("run")
    expect(body.columns[0].field_key).toBe("total_amount")
    expect(body.data[0].fields.total_amount).toBe(1299)
  })

  it("pipeline_id -> GET /v1/pipelines/{id}/results?view=documents", async () => {
    const calls = stubFetch([
      [
        `/v1/pipelines/${PIPE}/results`,
        {
          pipeline_id: PIPE,
          spec_id: SPEC,
          status: "completed",
          view: "documents",
          generated_at: "x",
          columns: [],
          data: [],
          pagination: { total: 0, limit: 50, has_more: false, next_cursor: null },
          pending_review_count: 0,
          links: {},
        },
      ],
    ])
    const body = parsed(
      await handleGetRunResults(getToken, undefined, { pipeline_id: PIPE, document_id: DOC1 }),
    )
    expect(calls[0].url).toBe(
      `https://api.talonic.com/v1/pipelines/${PIPE}/results?view=documents&document_id=${DOC1}`,
    )
    expect(body.run_kind).toBe("pipeline")
  })

  it("rejects both ids missing", async () => {
    const res = await handleGetRunResults(getToken, undefined, {} as any)
    expect((res as any).isError).toBe(true)
  })
})
