import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  handleFindData,
  handleInvokeAgentTool,
  handleListAgentTools,
  ASK_HINT,
  UNKNOWN_KEY_HINT,
} from "../../src/tools/agent-tools"

type Call = { url: string; init: RequestInit }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function stubFetch(body: unknown, status = 200) {
  const calls: Call[] = []
  const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return jsonResponse(body, status)
  })
  vi.stubGlobal("fetch", fetchFn)
  return { calls, fetchFn }
}

const getToken = () => "tlnc_test"
const parsed = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0]?.text ?? "")
const sentBody = (c: Call) => JSON.parse(String(c.init.body))

describe("agent registry wrappers", () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  describe("talonic_find_data", () => {
    it("POSTs to the find_data invoke route and unwraps the JSON content string", async () => {
      const { calls } = stubFetch({
        tool: "find_data",
        ok: true,
        content: JSON.stringify({
          fields: [{ canonical_name: "total_amount", tier: 2 }],
          documents: [],
        }),
        citations: [{ document_id: "d1" }],
        artifacts: [],
      })
      const res = await handleFindData(getToken, undefined, {
        query: "payment volume",
        top_k: 5,
        document_ids: ["5f2b3c1e-1c6a-4d3a-9d3a-3f2b1c6a4d3a"],
      })
      const body = parsed(res)
      expect(body.tool).toBe("find_data")
      expect(body.result.fields[0].canonical_name).toBe("total_amount")
      expect(body.citations).toEqual([{ document_id: "d1" }])
      expect(body.artifacts).toBeUndefined()
      expect(calls[0].url).toBe("https://api.talonic.com/v1/agent/tools/find_data/invoke")
      expect(calls[0].init.method).toBe("POST")
      expect(sentBody(calls[0])).toEqual({
        args: {
          query: "payment volume",
          top_k: 5,
          document_scope: ["5f2b3c1e-1c6a-4d3a-9d3a-3f2b1c6a4d3a"],
        },
      })
      expect(new Headers(calls[0].init.headers).get("content-type")).toBe("application/json")
    })

    it("keeps non-JSON content as text", async () => {
      stubFetch({ tool: "find_data", ok: true, content: "plain text" })
      expect(parsed(await handleFindData(getToken, undefined, { query: "x" })).result).toBe(
        "plain text",
      )
    })

    it("turns a 422 tool failure into a tool error with the platform message", async () => {
      stubFetch({ error: "validation_error", message: "find_data failed: no data" }, 422)
      const res = await handleFindData(getToken, undefined, { query: "x" })
      expect(res.isError).toBe(true)
      expect(res.content[0]?.text).toContain("HTTP 422")
      expect(res.content[0]?.text).toContain("no data")
    })
  })

  describe("talonic_list_agent_tools", () => {
    const listing = {
      tools: [
        {
          name: "find_data",
          description: "has its own talonic_find_data tool",
          impact: "read",
          capability: "data.read",
          can_invoke: true,
          input_schema: { type: "object" },
        },
        {
          name: "query_data",
          description: "d1",
          impact: "read",
          capability: "data.read",
          can_invoke: true,
          input_schema: { type: "object" },
        },
        {
          name: "run_spec_pipeline",
          description: "d2",
          impact: "write",
          capability: "spec.run",
          can_invoke: false,
          input_schema: { type: "object" },
        },
      ],
      totalCount: 3,
      invocable_count: 2,
    }

    it("hides non-invocable tools by default and keeps schemas", async () => {
      const { calls } = stubFetch(listing)
      const body = parsed(
        await handleListAgentTools(getToken, "https://staging.api.talonic.com", {}),
      )
      // find_data is hidden: it has its own dedicated tool.
      expect(body.tools.map((t: any) => t.name)).toEqual(["query_data"])
      expect(body.tools[0].input_schema).toEqual({ type: "object" })
      expect(body).toMatchObject({ invocable_count: 1, totalCount: 2 })
      expect(calls[0].url).toBe("https://staging.api.talonic.com/v1/agent/tools")
    })

    it("can list everything without schemas", async () => {
      stubFetch(listing)
      const body = parsed(
        await handleListAgentTools(getToken, undefined, {
          only_invocable: false,
          include_schemas: false,
        }),
      )
      expect(body.tools).toHaveLength(2)
      expect(body.tools[1]).not.toHaveProperty("input_schema")
      expect(body.tools[1].can_invoke).toBe(false)
    })
  })

  describe("talonic_invoke_agent_tool", () => {
    it("POSTs args and an optional document scope to the named tool", async () => {
      const { calls } = stubFetch({
        tool: "query_data",
        ok: true,
        content: JSON.stringify({ rows: [{ n: 3 }] }),
      })
      const body = parsed(
        await handleInvokeAgentTool(getToken, undefined, {
          name: "query_data",
          args: { sql: "SELECT count(*) AS n FROM cells" },
          document_ids: ["5f2b3c1e-1c6a-4d3a-9d3a-3f2b1c6a4d3a"],
        }),
      )
      expect(body.result.rows[0].n).toBe(3)
      expect(calls[0].url).toBe("https://api.talonic.com/v1/agent/tools/query_data/invoke")
      expect(sentBody(calls[0])).toEqual({
        args: { sql: "SELECT count(*) AS n FROM cells" },
        scope: { document_ids: ["5f2b3c1e-1c6a-4d3a-9d3a-3f2b1c6a4d3a"] },
      })
    })

    it("URL-encodes the tool name and sends empty args by default", async () => {
      const { calls } = stubFetch({ tool: "x", ok: true, content: "{}" })
      await handleInvokeAgentTool(getToken, undefined, { name: "weird/name" })
      expect(calls[0].url).toBe("https://api.talonic.com/v1/agent/tools/weird%2Fname/invoke")
      expect(sentBody(calls[0])).toEqual({ args: {} })
    })

    it("surfaces a capability denial as a tool error", async () => {
      stubFetch(
        { error: "forbidden", message: "tool 'run_spec_pipeline' requires capability spec.run" },
        403,
      )
      const res = await handleInvokeAgentTool(getToken, undefined, { name: "run_spec_pipeline" })
      expect(res.isError).toBe(true)
      expect(res.content[0]?.text).toContain("spec.run")
    })
  })
})

describe("talonic_invoke_agent_tool steers questions to talonic_ask", () => {
  afterEach(() => vi.unstubAllGlobals())
  const respond = (status: number, body: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body), { status })),
    )

  it("appends the ask hint to query_data results", async () => {
    respond(200, { tool: "query_data", ok: true, content: '{"rows":[{"n":1}],"rowCount":1}' })
    const res = await handleInvokeAgentTool(() => "t", undefined, {
      name: "query_data",
      args: { sql: "SELECT 1" },
    })
    expect(JSON.parse(res.content[0]!.text).result.rowCount).toBe(1)
    expect(res.content[1]!.text).toBe(`Next step: ${ASK_HINT}`)
    expect((res as any).structuredContent.next_step).toBe(ASK_HINT)
  })

  it("adds the field-name hint to an unknown-key refusal", async () => {
    respond(422, {
      message: "Unknown field_key 'vendor.name' — it does not exist in this workspace's data.",
    })
    const res = await handleInvokeAgentTool(() => "t", undefined, {
      name: "query_data",
      args: { sql: "x" },
    })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain(UNKNOWN_KEY_HINT)
  })

  it("leaves other registry tools alone", async () => {
    respond(200, { tool: "get_document_markdown", ok: true, content: "# doc" })
    const res = await handleInvokeAgentTool(() => "t", undefined, {
      name: "get_document_markdown",
      args: {},
    })
    expect(res.content).toHaveLength(1)
  })
})
