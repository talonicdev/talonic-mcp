import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { TalonicAuthError } from "@talonic/node"
import { createServer } from "../../src/server-factory"
import {
  clampChangeLimit,
  DEFAULT_CHANGE_LIMIT,
  entityHistoryOutputSchema,
  getDeltaOutputSchema,
  handleGetDbDelta,
  handleGetDbEntityHistory,
  handleListDbChanges,
  handleListDbSources,
  listChangesOutputSchema,
  listSourcesOutputSchema,
  MAX_CHANGE_LIMIT,
  type DbSnapshotsApi,
} from "../../src/tools/db-snapshots"

/**
 * The handlers take the narrow `DbSnapshotsApi` structural interface rather
 * than a full SDK client, so tests inject a recording fake. This is also
 * what lets the tools compile against the currently published
 * `@talonic/node`, which has no `dbSnapshots` resource yet.
 */
function makeApi(overrides: Partial<DbSnapshotsApi> = {}): DbSnapshotsApi {
  const reject = () => Promise.reject(new Error("not stubbed"))
  return {
    listSources: overrides.listSources ?? (reject as DbSnapshotsApi["listSources"]),
    getSource: overrides.getSource ?? (reject as DbSnapshotsApi["getSource"]),
    getDelta: overrides.getDelta ?? (reject as DbSnapshotsApi["getDelta"]),
    listChanges: overrides.listChanges ?? (reject as DbSnapshotsApi["listChanges"]),
    getEntityHistory: overrides.getEntityHistory ?? (reject as DbSnapshotsApi["getEntityHistory"]),
  }
}

function parsedText(result: { content: Array<{ text: string }> }): any {
  return JSON.parse(result.content[0]?.text ?? "")
}

const completeTotals = {
  added: 264000,
  modified: 12,
  removed: 3,
  tables_touched: 2,
  tables_total: 40,
  tables_skipped: 1,
  drift: true,
}

const partialTotals = {
  added: 0,
  modified: 0,
  removed: 0,
  tables_touched: 0,
  tables_total: 40,
  drift: false,
}

function source(over: Record<string, unknown> = {}) {
  return {
    connection_id: "conn_1",
    name: "Bridgeway prod",
    engine: "postgres",
    snapshot_count: 12,
    capturing: false,
    cadence: { enabled: true, interval_hours: 2, capture_mode: "incremental" },
    latest_snapshot: {
      id: "snap_12",
      status: "complete",
      capture_mode: "incremental",
      captured_at: "2026-08-20T10:00:00.000Z",
      completed_at: "2026-08-20T10:05:00.000Z",
      error: null,
    },
    latest_delta: {
      id: "delta_12",
      status: "complete" as const,
      computed_at: "2026-08-20T10:06:00.000Z",
      totals: completeTotals,
    },
    last_complete_delta_id: "delta_12",
    ...over,
  }
}

function deltaDetail(over: Record<string, unknown> = {}) {
  const delta = {
    id: "delta_12",
    connection_id: "conn_1",
    from_snapshot_id: "snap_11",
    to_snapshot_id: "snap_12",
    computed_at: "2026-08-20T10:06:00.000Z",
    status: "complete" as const,
    totals: completeTotals,
    tables: [
      {
        table_key: "public.orders",
        added: 264000,
        modified: 12,
        removed: 3,
        changes_truncated: true,
        examined: true,
        last_full_scan_at: "2026-08-20T08:00:00.000Z",
        mode: "incremental",
        fallback_reason: null,
        columns_added: ["ref"],
        columns_removed: [],
      },
    ],
    ...(over["delta"] as Record<string, unknown> | undefined),
  }
  return {
    delta,
    from_snapshot: { id: "snap_11", captured_at: "2026-08-20T08:00:00.000Z" },
    to_snapshot: { id: "snap_12", captured_at: "2026-08-20T10:00:00.000Z", status: "complete" },
    column_profile: [
      {
        table_key: "public.orders",
        column: "status",
        before: "packed",
        after: "shipped",
        count: 17,
        aggregate: "distinct_shift",
      },
    ],
  }
}

describe("talonic_list_db_sources handler", () => {
  it("returns sources as a single JSON text item on success", async () => {
    const api = makeApi({ listSources: vi.fn().mockResolvedValue({ data: [source()] }) })
    const result = await handleListDbSources(api)

    expect("isError" in result).toBe(false)
    expect(result.content).toHaveLength(1)
    const parsed = parsedText(result)
    expect(parsed.data).toHaveLength(1)
    expect(parsed.data[0].connection_id).toBe("conn_1")
    expect(parsed.data[0].last_complete_delta_id).toBe("delta_12")
    // Nothing partial, nothing capturing -> no advisory noise.
    expect(parsed.advisory).toBeUndefined()
  })

  it("warns that a partial latest_delta is a floor, not a result", async () => {
    const api = makeApi({
      listSources: vi.fn().mockResolvedValue({
        data: [
          source({
            capturing: true,
            latest_delta: {
              id: "delta_13",
              status: "partial",
              computed_at: "2026-08-20T11:00:00.000Z",
              totals: partialTotals,
            },
            last_complete_delta_id: "delta_12",
          }),
        ],
      }),
    })
    const parsed = parsedText(await handleListDbSources(api))

    expect(parsed.advisory.join(" ")).toContain("STILL RUNNING")
    expect(parsed.advisory.join(" ")).toContain("FLOOR")
    expect(parsed.advisory.join(" ")).toContain("last_complete_delta_id")
    expect(parsed.advisory.join(" ")).toContain("capturing:true")
  })

  it("returns an isError result when the API rejects", async () => {
    const api = makeApi({
      listSources: vi.fn().mockRejectedValue(
        new TalonicAuthError({
          code: "AUTH_REQUIRED",
          message: "Invalid API key",
          status: 401,
          retryable: false,
          requestId: "req_xyz",
        }),
      ),
    })
    const result = await handleListDbSources(api)
    expect((result as { isError?: boolean }).isError).toBe(true)
    const text = result.content[0]?.text ?? ""
    expect(text).toContain("AUTH_REQUIRED")
    expect(text).toContain("status: 401")
  })

  it("outputSchema accepts a source with everything null (nothing captured yet)", () => {
    const Output = z.object(listSourcesOutputSchema)
    const fresh = {
      data: [
        {
          connection_id: "conn_2",
          name: "new",
          engine: "mssql",
          snapshot_count: 0,
          capturing: false,
          cadence: null,
          latest_snapshot: null,
          latest_delta: null,
          last_complete_delta_id: null,
        },
      ],
    }
    expect(Output.safeParse(fresh).success).toBe(true)
  })
})

describe("talonic_get_db_delta handler", () => {
  it("fetches one delta by id and reports a complete status without partial advisory", async () => {
    const getDelta = vi.fn().mockResolvedValue(deltaDetail())
    const parsed = parsedText(
      await handleGetDbDelta(makeApi({ getDelta }), { delta_id: "delta_12" }),
    )

    expect(getDelta).toHaveBeenCalledWith("delta_12")
    expect(parsed.delta.status).toBe("complete")
    expect(parsed.resolved_from).toBe("delta_id")
    expect(parsed.advisory.join(" ")).not.toContain("STILL RUNNING")
    // The tables[] reading rule always ships with a non-empty tables list.
    expect(parsed.advisory.join(" ")).toContain("ABSENT from tables[] was examined")
  })

  it("surfaces the partial-delta caveat and the last_complete_delta_id pointer", async () => {
    const getDelta = vi.fn().mockResolvedValue(
      deltaDetail({
        delta: { id: "delta_13", status: "partial", totals: partialTotals, tables: [] },
      }),
    )
    const getSource = vi.fn().mockResolvedValue({
      ...source({ capturing: true, last_complete_delta_id: "delta_12" }),
      timeline: [],
    })
    const parsed = parsedText(
      await handleGetDbDelta(makeApi({ getDelta, getSource }), { delta_id: "delta_13" }),
    )

    // A partial delta reads all zeros while the source is churning; the
    // payload must say so in words, not just in a status field.
    expect(parsed.delta.totals.added).toBe(0)
    const advisory = parsed.advisory.join(" ")
    expect(advisory).toContain("STILL RUNNING")
    expect(advisory).toContain("FLOOR")
    expect(advisory).toContain("nothing changed")
    expect(parsed.last_complete_delta_id).toBe("delta_12")
    expect(advisory).toContain("delta_12")
    expect(getSource).toHaveBeenCalledWith("conn_1")
  })

  it("says outright when a partial delta has no complete predecessor", async () => {
    const getDelta = vi.fn().mockResolvedValue(
      deltaDetail({
        delta: { id: "delta_1", status: "partial", totals: partialTotals, tables: [] },
      }),
    )
    const getSource = vi.fn().mockResolvedValue({
      ...source({ last_complete_delta_id: null }),
      timeline: [],
    })
    const parsed = parsedText(
      await handleGetDbDelta(makeApi({ getDelta, getSource }), { delta_id: "delta_1" }),
    )
    expect(parsed.last_complete_delta_id).toBeNull()
    expect(parsed.advisory.join(" ")).toContain("NO complete delta yet")
  })

  it("states the absent-vs-deferred rule even when tables[] is empty", async () => {
    // An empty tables[] on a COMPLETE delta is the one case an agent is most
    // likely to read as "nothing changed anywhere" — the rule has to ship.
    const getDelta = vi.fn().mockResolvedValue(deltaDetail({ delta: { tables: [] } }))
    const parsed = parsedText(await handleGetDbDelta(makeApi({ getDelta }), { delta_id: "d" }))
    const advisory = parsed.advisory.join(" ")
    expect(parsed.delta.tables).toEqual([])
    expect(advisory).toContain("ABSENT from tables[] was examined and is clean")
    expect(advisory).not.toContain("examined:false was NOT examined; do not report")
  })

  it("distinguishes examined:false (deferred) from absent (examined and clean)", async () => {
    const getDelta = vi.fn().mockResolvedValue(
      deltaDetail({
        delta: {
          tables: [
            {
              table_key: "public.audit_log",
              added: 0,
              modified: 0,
              removed: 0,
              changes_truncated: false,
              examined: false,
              last_full_scan_at: "2026-08-01T00:00:00.000Z",
              mode: "skipped",
              fallback_reason: "scan policy deferred",
              columns_added: [],
              columns_removed: [],
            },
          ],
        },
      }),
    )
    const parsed = parsedText(await handleGetDbDelta(makeApi({ getDelta }), { delta_id: "d" }))
    const advisory = parsed.advisory.join(" ")

    expect(parsed.delta.tables[0].examined).toBe(false)
    expect(advisory).toContain("ABSENT from tables[] was examined and is clean")
    expect(advisory).toContain("PRESENT with examined:false was NOT examined")
    expect(advisory).toContain("do not report it as unchanged")
  })

  it("resolves the newest delta from a connection_id", async () => {
    const getSource = vi.fn().mockResolvedValue({
      ...source({
        latest_delta: {
          id: "delta_13",
          status: "partial",
          computed_at: "x",
          totals: partialTotals,
        },
        last_complete_delta_id: "delta_12",
      }),
      timeline: [],
    })
    const getDelta = vi.fn().mockResolvedValue(
      deltaDetail({
        delta: { id: "delta_13", status: "partial", totals: partialTotals, tables: [] },
      }),
    )
    const parsed = parsedText(
      await handleGetDbDelta(makeApi({ getSource, getDelta }), { connection_id: "conn_1" }),
    )
    expect(getDelta).toHaveBeenCalledWith("delta_13")
    expect(parsed.resolved_from).toBe("latest_delta")
    expect(parsed.last_complete_delta_id).toBe("delta_12")
  })

  it("prefer_complete resolves last_complete_delta_id instead of the partial newest", async () => {
    const getSource = vi.fn().mockResolvedValue({
      ...source({
        latest_delta: {
          id: "delta_13",
          status: "partial",
          computed_at: "x",
          totals: partialTotals,
        },
        last_complete_delta_id: "delta_12",
      }),
      timeline: [],
    })
    const getDelta = vi.fn().mockResolvedValue(deltaDetail())
    const parsed = parsedText(
      await handleGetDbDelta(makeApi({ getSource, getDelta }), {
        connection_id: "conn_1",
        prefer_complete: true,
      }),
    )
    expect(getDelta).toHaveBeenCalledWith("delta_12")
    expect(parsed.resolved_from).toBe("last_complete_delta_id")
    expect(parsed.delta.status).toBe("complete")
  })

  it("returns delta:null with an explanation when the connection has no delta yet", async () => {
    const getSource = vi.fn().mockResolvedValue({
      ...source({ latest_delta: null, last_complete_delta_id: null, capturing: true }),
      timeline: [],
    })
    const result = await handleGetDbDelta(makeApi({ getSource }), { connection_id: "conn_1" })
    const parsed = parsedText(result)
    expect("isError" in result).toBe(false)
    expect(parsed.delta).toBeNull()
    expect(parsed.advisory.join(" ")).toContain("no computed delta yet")
    expect(parsed.advisory.join(" ")).toContain("capture is in flight")
  })

  it("rejects zero or both of delta_id / connection_id before calling the API", async () => {
    const getDelta = vi.fn()
    const getSource = vi.fn()
    const api = makeApi({ getDelta, getSource })

    const neither = await handleGetDbDelta(api, {})
    const both = await handleGetDbDelta(api, { delta_id: "d", connection_id: "c" })

    for (const r of [neither, both]) {
      expect((r as { isError?: boolean }).isError).toBe(true)
      expect(r.content[0]?.text).toContain("exactly one of")
    }
    expect(getDelta).not.toHaveBeenCalled()
    expect(getSource).not.toHaveBeenCalled()
  })

  it("outputSchema accepts a partial delta and a deferred table", () => {
    const Output = z.object(getDeltaOutputSchema)
    const payload = {
      delta: {
        id: "delta_13",
        connection_id: "conn_1",
        from_snapshot_id: "snap_12",
        to_snapshot_id: "snap_13",
        computed_at: null,
        status: "partial",
        totals: partialTotals,
        tables: [
          {
            table_key: "public.audit_log",
            added: 0,
            modified: 0,
            removed: 0,
            changes_truncated: false,
            examined: false,
            last_full_scan_at: null,
            mode: null,
            fallback_reason: null,
            columns_added: [],
            columns_removed: [],
          },
        ],
      },
      from_snapshot: { id: "snap_12", captured_at: null },
      to_snapshot: { id: "snap_13", captured_at: null, status: "running" },
      column_profile: [],
      last_complete_delta_id: null,
      advisory: ["x"],
    }
    expect(Output.safeParse(payload).success).toBe(true)
  })

  it("outputSchema accepts delta:null (connection with no delta)", () => {
    const Output = z.object(getDeltaOutputSchema)
    expect(Output.safeParse({ delta: null, last_complete_delta_id: null }).success).toBe(true)
  })
})

describe("talonic_list_db_changes handler", () => {
  const page = (over: Record<string, unknown> = {}) => ({
    data: [
      {
        id: "chg_1",
        table_key: "public.orders",
        pk: "42",
        change_type: "modified" as const,
        before: { status: "packed" },
        after: { status: "shipped" },
      },
    ],
    total: 264000,
    limit: 50,
    offset: 0,
    ...over,
  })

  it("pages one table and reports the true total", async () => {
    const listChanges = vi.fn().mockResolvedValue(page())
    const parsed = parsedText(
      await handleListDbChanges(makeApi({ listChanges }), {
        delta_id: "delta_12",
        table: "public.orders",
      }),
    )
    expect(listChanges).toHaveBeenCalledWith("delta_12", {
      table: "public.orders",
      limit: DEFAULT_CHANGE_LIMIT,
      offset: 0,
    })
    expect(parsed.data).toHaveLength(1)
    expect(parsed.total).toBe(264000)
    expect(parsed.advisory.join(" ")).toContain("of 264000")
    expect(parsed.advisory.join(" ")).toContain("offset=1")
  })

  it("clamps an oversized limit to the 500-row maximum and says so", async () => {
    const listChanges = vi.fn().mockResolvedValue(page({ limit: MAX_CHANGE_LIMIT }))
    const parsed = parsedText(
      await handleListDbChanges(makeApi({ listChanges }), {
        delta_id: "delta_12",
        table: "public.orders",
        limit: 100000,
      }),
    )
    expect(listChanges.mock.calls[0]?.[1]).toEqual({
      table: "public.orders",
      limit: MAX_CHANGE_LIMIT,
      offset: 0,
    })
    expect(parsed.advisory.join(" ")).toContain("clamped to 500")
  })

  it("clampChangeLimit maps every out-of-range request into 1..500", () => {
    expect(clampChangeLimit(undefined)).toBe(DEFAULT_CHANGE_LIMIT)
    expect(clampChangeLimit(1)).toBe(1)
    expect(clampChangeLimit(50)).toBe(50)
    expect(clampChangeLimit(500)).toBe(500)
    expect(clampChangeLimit(501)).toBe(500)
    expect(clampChangeLimit(264000)).toBe(500)
    expect(clampChangeLimit(0)).toBe(1)
    expect(clampChangeLimit(-10)).toBe(1)
    expect(clampChangeLimit(12.7)).toBe(12)
    expect(clampChangeLimit(Number.POSITIVE_INFINITY)).toBe(DEFAULT_CHANGE_LIMIT)
    expect(clampChangeLimit(Number.NaN)).toBe(DEFAULT_CHANGE_LIMIT)
  })

  it("forwards a valid offset and omits the paging advisory on the last page", async () => {
    const listChanges = vi.fn().mockResolvedValue(page({ total: 1, offset: 0 }))
    const parsed = parsedText(
      await handleListDbChanges(makeApi({ listChanges }), {
        delta_id: "d",
        table: "t",
        offset: 0,
      }),
    )
    expect(parsed.advisory).toBeUndefined()
  })

  it("fails fast without a table", async () => {
    const listChanges = vi.fn()
    const result = await handleListDbChanges(makeApi({ listChanges }), {
      delta_id: "d",
      table: "",
    })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0]?.text).toContain("`table` is required")
    expect(listChanges).not.toHaveBeenCalled()
  })

  it("outputSchema accepts numeric pks and null row images", () => {
    const Output = z.object(listChangesOutputSchema)
    const payload = {
      data: [
        {
          id: "chg_1",
          table_key: "t",
          pk: 42,
          change_type: "added",
          before: null,
          after: { a: 1 },
        },
        {
          id: "chg_2",
          table_key: "t",
          pk: "~7",
          change_type: "removed",
          before: { a: 1 },
          after: null,
        },
      ],
      total: 2,
      limit: 50,
      offset: 0,
    }
    expect(Output.safeParse(payload).success).toBe(true)
  })
})

describe("talonic_get_db_entity_history handler", () => {
  it("returns one key's timeline across captures", async () => {
    const getEntityHistory = vi.fn().mockResolvedValue({
      table_key: "public.orders",
      pk: "42",
      identity_columns: ["id"],
      current: { id: 42, status: "shipped" },
      events: [
        {
          delta_id: "delta_12",
          snapshot_id: "snap_12",
          captured_at: "2026-08-20T10:00:00.000Z",
          change_type: "modified",
          before: { status: "packed" },
          after: { status: "shipped" },
        },
      ],
    })
    const parsed = parsedText(
      await handleGetDbEntityHistory(makeApi({ getEntityHistory }), {
        connection_id: "conn_1",
        table: "public.orders",
        pk: "42",
      }),
    )
    expect(getEntityHistory).toHaveBeenCalledWith("conn_1", { table: "public.orders", pk: "42" })
    expect(parsed.events).toHaveLength(1)
    expect(parsed.advisory).toBeUndefined()
  })

  it("warns that an empty timeline is not proof the row never changed", async () => {
    const getEntityHistory = vi.fn().mockResolvedValue({
      table_key: "public.audit_log",
      pk: "7",
      identity_columns: ["id"],
      current: null,
      events: [],
    })
    const parsed = parsedText(
      await handleGetDbEntityHistory(makeApi({ getEntityHistory }), {
        connection_id: "conn_1",
        table: "public.audit_log",
        pk: "7",
      }),
    )
    const advisory = parsed.advisory.join(" ")
    expect(advisory).toContain("NOT proof the row never changed")
    expect(advisory).toContain("examined:false")
  })

  it("returns an isError result when the API rejects", async () => {
    const getEntityHistory = vi.fn().mockRejectedValue(new Error("boom"))
    const result = await handleGetDbEntityHistory(makeApi({ getEntityHistory }), {
      connection_id: "c",
      table: "t",
      pk: "1",
    })
    expect((result as { isError?: boolean }).isError).toBe(true)
    expect(result.content[0]?.text).toContain("boom")
  })

  it("outputSchema accepts a deleted row (current null) and numeric pk", () => {
    const Output = z.object(entityHistoryOutputSchema)
    const payload = {
      table_key: "t",
      pk: 42,
      identity_columns: ["id"],
      current: null,
      events: [
        {
          delta_id: "d",
          snapshot_id: "s",
          captured_at: null,
          change_type: "removed",
          before: { a: 1 },
          after: null,
        },
      ],
    }
    expect(Output.safeParse(payload).success).toBe(true)
  })
})

describe("db-snapshot tool registration", () => {
  const NAMES = [
    "talonic_list_db_sources",
    "talonic_get_db_delta",
    "talonic_list_db_changes",
    "talonic_get_db_entity_history",
  ]

  it("registers all four tools as read-only", () => {
    const server = createServer({ apiKey: "tlnc_test" }) as any
    for (const name of NAMES) {
      const tool = server._registeredTools[name]
      expect(tool, name).toBeDefined()
      expect(tool.annotations.readOnlyHint).toBe(true)
      expect(tool.annotations.destructiveHint).toBe(false)
      expect(tool.annotations.openWorldHint).toBe(false)
    }
  })

  it("carries the partial and examined semantics into the agent-facing descriptions", () => {
    const server = createServer({ apiKey: "tlnc_test" }) as any
    const delta = server._registeredTools["talonic_get_db_delta"].description as string
    expect(delta).toContain("STILL RUNNING")
    expect(delta).toContain("FLOOR")
    expect(delta).toContain("last_complete_delta_id")
    expect(delta).toContain("examined:false")

    const sources = server._registeredTools["talonic_list_db_sources"].description as string
    expect(sources).toContain("last_complete_delta_id")
    expect(sources).toContain("STILL RUNNING")

    const changes = server._registeredTools["talonic_list_db_changes"].description as string
    expect(changes).toContain("500")
  })

  it("does not declare widget _meta (no widget shipped for these tools)", () => {
    const server = createServer({ apiKey: "tlnc_test" }) as any
    for (const name of NAMES) {
      const meta = server._registeredTools[name]._meta
      expect(meta?.ui).toBeUndefined()
    }
  })
})
