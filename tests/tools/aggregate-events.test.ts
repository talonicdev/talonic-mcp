import { afterEach, describe, expect, it, vi } from "vitest"
import { runGroupTool, type GroupTool } from "../../src/tools/_groups"
import { aggregateGroup, checkAggregateArgs } from "../../src/tools/aggregate"
import { eventsGroup } from "../../src/tools/events"
import { createServer } from "../../src/server-factory"

const ctx = { getToken: () => "tlnc_key", baseUrl: undefined }
const tool = (group: { tools: GroupTool[] }, name: string) =>
  group.tools.find((t) => t.name === name)!

function stub(body: unknown = {}, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  )
  vi.stubGlobal("fetch", fetchMock)
  return Object.assign(
    () => {
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      return {
        url,
        method: init.method,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
        auth: new Headers(init.headers).get("authorization"),
      }
    },
    { mock: fetchMock },
  )
}

afterEach(() => vi.unstubAllGlobals())

const WINDOW = { from: "2026-11-24T00:00:00Z", to: "2026-11-25T00:00:00+01:00" }
const COUNT = { id: "docs", dataset: "documents", measure: "count" }

describe("talonic_aggregate", () => {
  const agg = tool(aggregateGroup, "talonic_aggregate")

  it("forwards the body unchanged with the bearer, scope only when given", async () => {
    const call = stub({ results: { docs: { value: 3 } } })
    await runGroupTool(agg, ctx, { ...WINDOW, queries: [COUNT] })
    expect(call()).toMatchObject({
      url: "https://api.talonic.com/v1/aggregate",
      method: "POST",
      auth: "Bearer tlnc_key",
      body: { ...WINDOW, queries: [COUNT] },
    })
    expect(call().body).not.toHaveProperty("scope")
  })

  it("sends a document scope (account visibility is the platform's: it filters per viewer)", async () => {
    const call = stub({ results: {} })
    const scope = { document_types: ["Invoice"], roots_only: true }
    await runGroupTool(agg, ctx, { ...WINDOW, scope, queries: [COUNT] })
    expect(call().body.scope).toEqual(scope)
  })

  it.each([
    [
      { from: "2026-11-24T00:00:00", to: WINDOW.to },
      "`from` must be an ISO-8601 timestamp with an offset",
    ],
    [{ from: WINDOW.from, to: "2026-11-25" }, "`to` must be an ISO-8601 timestamp with an offset"],
    [{ from: WINDOW.from, to: WINDOW.from }, "`to` must be after `from`"],
    [{ from: "2026-11-25T00:00:00Z", to: "2026-11-24T00:00:00Z" }, "`to` must be after `from`"],
  ])("refuses a bad window before calling: %j", async (win, message) => {
    const call = stub()
    const res = await runGroupTool(agg, ctx, { ...win, queries: [COUNT] })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain(message)
    expect(call.mock).not.toHaveBeenCalled()
  })

  it.each([
    [[], "at least one query"],
    [[{ ...COUNT, id: "Docs" }], "must start with a lowercase letter"],
    [[{ ...COUNT, id: "1docs" }], "must start with a lowercase letter"],
    [[COUNT, COUNT], "is used twice"],
  ])("refuses bad queries before calling: %j", async (queries, message) => {
    const call = stub()
    const res = await runGroupTool(agg, ctx, { ...WINDOW, queries })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain(message)
    expect(call.mock).not.toHaveBeenCalled()
  })

  it("accepts the offset forms the platform accepts", () => {
    for (const ts of [
      "2026-11-24T00:00Z",
      "2026-11-24T00:00:00.123+0100",
      "2026-11-24t00:00:00-05:00",
    ]) {
      expect(
        checkAggregateArgs({ from: ts, to: "2027-01-01T00:00:00Z", queries: [COUNT] }),
      ).toBeNull()
    }
  })

  it("passes a no-data answer through: count 0, average null", async () => {
    stub({
      window: WINDOW,
      results: {
        docs: { dataset: "documents", kind: "entity", value: 0 },
        cost: { dataset: "document_cost", kind: "entity", value: null },
      },
    })
    const res = await runGroupTool(agg, ctx, {
      ...WINDOW,
      queries: [COUNT, { id: "cost", dataset: "document_cost", measure: "avg", of: "cost_usd" }],
    })
    expect(res.isError).toBeUndefined()
    expect(res.structuredContent).toMatchObject({
      results: { docs: { value: 0 }, cost: { value: null } },
    })
  })

  it("returns the platform's refusal with its allowed names and a next step", async () => {
    stub(
      {
        error: {
          code: "invalid_aggregate",
          message: "unknown dataset",
          allowed_datasets: ["documents"],
        },
      },
      400,
    )
    const res = await runGroupTool(agg, ctx, {
      ...WINDOW,
      queries: [{ ...COUNT, dataset: "nope" }],
    })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("invalid_aggregate")
    expect(res.content[0]!.text).toContain("allowed_datasets")
    expect(res.content[0]!.text).toContain("Next step")
  })

  it("passes the cost visibility refusal through", async () => {
    stub({ error: { code: "cost_not_visible" } }, 403)
    const res = await runGroupTool(agg, ctx, {
      ...WINDOW,
      queries: [{ id: "c", dataset: "document_cost", measure: "sum", of: "cost_usd" }],
    })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("cost_not_visible")
  })

  it("catalog is a plain GET and the group probes the catalog, not the one-in-flight POST", async () => {
    const call = stub({ datasets: [] })
    await runGroupTool(tool(aggregateGroup, "talonic_aggregate_catalog"), ctx, {})
    expect(call()).toMatchObject({
      url: "https://api.talonic.com/v1/aggregate/catalog",
      method: "GET",
    })
    expect(aggregateGroup.probe.path).toBe("/v1/aggregate/catalog")
  })

  it("the description states the unit and the no-data answer, and names no dataset list to drift", () => {
    expect(agg.description).toContain("US dollars")
    expect(agg.description).toContain("is null")
    expect(agg.description).toContain("talonic_aggregate_catalog")
    expect(agg.description).not.toMatch(/llm|model call/i)
  })
})

describe("talonic_list_events", () => {
  const events = tool(eventsGroup, "talonic_list_events")

  it("resumes from a saved cursor with filters as query params", async () => {
    const call = stub({ data: [], next_cursor: null })
    await runGroupTool(events, ctx, {
      after: "1042",
      event_type: ["extraction.completed", "run.failed"],
      limit: 200,
    })
    expect(call().url).toBe(
      "https://api.talonic.com/v1/events?after=1042&event_type=extraction.completed%2Crun.failed&limit=200",
    )
    expect(call().method).toBe("GET")
  })

  it("pages across a boundary: the next call uses the previous next_cursor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "11" }, { id: "12" }], next_cursor: "12" })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: "13" }], next_cursor: null })),
      )
    vi.stubGlobal("fetch", fetchMock)
    const first = await runGroupTool(events, ctx, { after: "10", limit: 2 })
    const cursor = (first.structuredContent as { next_cursor: string }).next_cursor
    const second = await runGroupTool(events, ctx, { after: cursor, limit: 2 })
    expect(String(fetchMock.mock.calls[1]![0])).toContain("after=12")
    expect((second.structuredContent as { next_cursor: unknown }).next_cursor).toBeNull()
  })

  it("since and offset for the newest-first listing", async () => {
    const call = stub({ data: [] })
    await runGroupTool(events, ctx, { since: "2026-11-20T00:00:00Z", offset: 50 })
    expect(call().url).toBe(
      "https://api.talonic.com/v1/events?since=2026-11-20T00%3A00%3A00Z&offset=50",
    )
  })
})

describe("registration", () => {
  it("lists the aggregate and events tools only for their groups", () => {
    const names = (s: any) => Object.keys(s._registeredTools)
    const off = createServer({ apiKey: "tlnc_test" }) as any
    const on = createServer({ apiKey: "tlnc_test", toolGroups: ["aggregate", "events"] }) as any
    for (const n of ["talonic_aggregate", "talonic_aggregate_catalog", "talonic_list_events"]) {
      expect(names(off)).not.toContain(n)
      expect(names(on)).toContain(n)
    }
    expect(on._registeredTools["talonic_aggregate"].annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    })
  })
})
