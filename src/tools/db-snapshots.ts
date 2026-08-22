import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, validationError, type ToolResult } from "./_shared.js"

/**
 * Narrow structural view of the SDK's `talonic.dbSnapshots` resource.
 *
 * Declared locally (rather than imported from `@talonic/node`) so this file
 * type-checks against the currently published SDK, which does not yet expose
 * the resource. The shape mirrors `DbSnapshots` in the SDK exactly; when the
 * dependency range is bumped this interface can be replaced with
 * `Talonic["dbSnapshots"]`.
 *
 * @internal
 */
export interface DbSnapshotsApi {
  listSources(): Promise<{ data: DbSnapshotSourceLike[] }>
  getSource(connectionId: string): Promise<DbSnapshotSourceDetailLike>
  getDelta(deltaId: string): Promise<DbDeltaDetailLike>
  listChanges(
    deltaId: string,
    params: { table: string; limit?: number; offset?: number },
  ): Promise<DbDeltaChangeListLike>
  getEntityHistory(
    connectionId: string,
    params: { table: string; pk: string },
  ): Promise<DbEntityHistoryLike>
}

/**
 * These `*Like` interfaces intentionally declare only the fields the
 * handlers read. Every other field of the API payload flows through
 * untouched (the handlers spread the response), and no index signature is
 * used, so the real SDK types stay assignable to them once the dependency
 * range is bumped.
 *
 * @internal
 */
export interface DbSnapshotSourceLike {
  connection_id: string
  capturing: boolean
  latest_delta: { id: string; status: "partial" | "complete" } | null
  last_complete_delta_id: string | null
}

/** @internal */
export interface DbSnapshotSourceDetailLike extends DbSnapshotSourceLike {
  timeline: unknown[]
}

/** @internal */
export interface DbDeltaDetailLike {
  delta: {
    id: string
    connection_id: string
    status: "partial" | "complete"
    tables: unknown[]
  }
}

/** @internal */
export interface DbDeltaChangeListLike {
  data: unknown[]
  total: number
  limit: number
  offset: number
}

/** @internal */
export interface DbEntityHistoryLike {
  events: unknown[]
}

/**
 * Resolve the db-snapshot resource off an SDK client, or null when the
 * installed `@talonic/node` predates it.
 *
 * @internal
 */
export function dbSnapshotsOf(talonic: Talonic): DbSnapshotsApi | null {
  const api = (talonic as unknown as { dbSnapshots?: DbSnapshotsApi }).dbSnapshots
  return api && typeof api.listSources === "function" ? api : null
}

function sdkUnavailable(): ToolResult {
  return toolError(
    new Error(
      "The installed @talonic/node SDK does not expose the dbSnapshots resource. " +
        "Upgrade @talonic/node to a version that includes it.",
    ),
  )
}

/**
 * Page size defaults for row-level changes. A production delta can hold
 * hundreds of thousands of changed rows (264,000 added rows has been
 * observed), so the agent is never allowed to ask for an unbounded page:
 * anything above {@link MAX_CHANGE_LIMIT} is clamped down rather than
 * forwarded.
 *
 * @internal
 */
export const DEFAULT_CHANGE_LIMIT = 50
/** @internal */
export const MAX_CHANGE_LIMIT = 500

/**
 * Clamp a requested change-page size into `1..500`. Exported for unit
 * testing.
 *
 * @internal
 */
export function clampChangeLimit(limit?: number): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_CHANGE_LIMIT
  const floored = Math.floor(limit)
  if (floored < 1) return 1
  return Math.min(floored, MAX_CHANGE_LIMIT)
}

/**
 * The one sentence that must survive into every payload where a partial
 * delta can appear. A partial delta is not a small delta: the capture
 * writing it is still running, so its counts are a floor.
 *
 * @internal
 */
export const PARTIAL_ADVISORY =
  "status is 'partial': the capture writing this delta is STILL RUNNING, so every count " +
  "here is a FLOOR, not a result. A partial delta routinely reads added:0 modified:0 " +
  "removed:0 tables_touched:0 while the source is in fact changing hundreds of thousands " +
  "of rows. Do NOT report or summarise this as 'nothing changed'. For a trustworthy " +
  "answer, re-read using last_complete_delta_id."

/**
 * Companion advisory for the per-table list. Absence and non-examination
 * are different facts and must never be conflated.
 *
 * @internal
 */
export const TABLES_ADVISORY =
  "tables[] semantics: a table ABSENT from tables[] was examined and is clean. A table " +
  "PRESENT with examined:false was NOT examined — the scan policy deferred it, and " +
  "last_full_scan_at says when it was last really looked at. Never report a deferred " +
  "table as unchanged."

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const

const DESCRIPTIONS = {
  listSources: [
    "List the connected customer databases Talonic snapshots: capture cadence, the last capture, whether a capture is running right now, and which delta is safe to trust.",
    "",
    "USE WHEN: 'what databases are connected', 'when did we last capture', or to get a connection_id / delta id before reading a diff.",
    "NOT FOR: the contents of a diff (use talonic_get_db_delta) or individual changed rows (use talonic_list_db_changes).",
    "ARGS: none.",
    "RETURNS: data[] of { connection_id, name, engine, snapshot_count, capturing, cadence, latest_snapshot, latest_delta, last_complete_delta_id }.",
    "TRUST: latest_delta.status 'partial' means the capture writing it is STILL RUNNING; its counts are a floor, not a result, and often read all zeros while thousands of rows are changing. Never report that as 'nothing changed' — read last_complete_delta_id instead.",
  ].join("\n"),
  getDelta: [
    "Read one database delta — the row-level diff between two captures: aggregate totals, per-table counts, and column before/after profile.",
    "",
    "USE WHEN: 'what changed in the database', or after talonic_list_db_sources to inspect a specific delta.",
    "NOT FOR: the changed rows themselves (use talonic_list_db_changes) or one record's timeline (use talonic_get_db_entity_history).",
    "ARGS: exactly one of delta_id or connection_id. With connection_id the newest delta is resolved for you; add prefer_complete:true to resolve the newest COMPLETE delta instead.",
    "RETURNS: delta { id, status, totals, tables[] }, from_snapshot, to_snapshot, column_profile[], last_complete_delta_id, and advisory[] when a caveat applies.",
    "TRUST 1: status 'partial' means the capture writing this delta is STILL RUNNING — the counts are a FLOOR, not a result, and routinely read all zeros while hundreds of thousands of rows are in fact changing. Never summarise a partial delta as 'nothing changed'; re-read with last_complete_delta_id.",
    "TRUST 2: a table ABSENT from tables[] was examined and is clean; a table PRESENT with examined:false was NOT examined (scan policy deferred it — see last_full_scan_at). Never conflate the two.",
  ].join("\n"),
  listChanges: [
    "Page the individual changed rows of ONE table inside ONE database delta, with each row's before/after image.",
    "",
    "USE WHEN: the delta says a table changed and you need the actual rows, or you are chasing a specific record.",
    "NOT FOR: an overview of what changed (use talonic_get_db_delta first to pick a table) or one key over time (use talonic_get_db_entity_history).",
    "ARGS: delta_id, table (required — from the delta's tables[].table_key), limit (default 50, hard max 500, clamped), offset for paging.",
    "RETURNS: data[] of { id, table_key, pk, change_type, before, after } plus total, limit, offset.",
    "SIZE: a real table can hold 264,000 changed rows in one delta, so `total` is usually far larger than a page. Page deliberately and cite total; never assume data[] is the whole change set.",
    "TRUST: if the parent delta's status is 'partial' the capture is still running, so rows are still being written — the page is a floor, not the final set.",
  ].join("\n"),
  entityHistory: [
    "Trace ONE database row (one primary key) across every capture of a connection: each change event with its before/after image.",
    "",
    "USE WHEN: 'when did this record change', 'who/what changed order 42', or auditing one entity over time.",
    "NOT FOR: everything that changed in a capture (use talonic_get_db_delta) or all rows of a table (use talonic_list_db_changes).",
    "ARGS: connection_id, table, pk (the primary-key value as a string).",
    "RETURNS: table_key, pk, identity_columns[], current (latest row image, null when the row no longer exists), events[] of { delta_id, snapshot_id, captured_at, change_type, before, after }.",
    "TRUST: events come from computed deltas only. A capture still running, or a table the scan policy deferred (examined:false in the delta), contributes no events — an empty events[] is NOT proof the row never changed.",
  ].join("\n"),
} as const

/* ------------------------------------------------------------------ *
 * Shared zod pieces
 * ------------------------------------------------------------------ */

/** Timestamps are tolerated as null/absent: a queued or failed capture has none. */
const timestamp = z.string().nullable().optional()

const deltaStatus = z
  .enum(["partial", "complete"])
  .describe(
    "'complete' = final, counts are trustworthy. 'partial' = the capture writing this delta is STILL RUNNING and the counts are a floor only; never read them as 'nothing changed'.",
  )

const deltaTotals = z
  .object({
    added: z.number().describe("Rows added. A floor only when status is 'partial'."),
    modified: z.number().describe("Rows modified. A floor only when status is 'partial'."),
    removed: z.number().describe("Rows removed. A floor only when status is 'partial'."),
    tables_touched: z.number().describe("Tables with at least one detected change."),
    tables_total: z.number().describe("Tables in the source."),
    tables_skipped: z
      .number()
      .nullable()
      .optional()
      .describe("Tables the scan policy skipped, when reported."),
    drift: z.boolean().describe("Whether schema drift (added/removed columns) was detected."),
  })
  .describe(
    "Aggregate counts. Trustworthy only when the delta's status is 'complete'; for a 'partial' delta these are a floor, not a result.",
  )

const deltaSummary = z
  .object({
    id: z.string().describe("Delta id."),
    status: deltaStatus,
    computed_at: timestamp.describe("When the delta was computed."),
    totals: deltaTotals.nullable().optional(),
  })
  .nullable()
  .optional()
  .describe("Most recent delta, which may still be 'partial'. Null when no delta exists yet.")

const snapshotSummary = z
  .object({
    id: z.string().describe("Snapshot id."),
    status: z.string().describe("Capture status (e.g. running, complete, failed)."),
    capture_mode: z.string().nullable().optional().describe("Capture strategy used."),
    captured_at: timestamp.describe("When the capture started."),
    completed_at: timestamp.describe("When the capture finished; null while still running."),
    error: z.string().nullable().optional().describe("Failure message, null when none."),
  })
  .nullable()
  .optional()
  .describe("Most recent capture run, or null when nothing has been captured.")

const sourceShape = {
  connection_id: z
    .string()
    .describe("Connection id — the handle for every other db-snapshot call."),
  name: z.string().describe("Display name of the connection."),
  engine: z.string().describe("Database engine (e.g. postgres, mssql)."),
  snapshot_count: z.number().describe("Snapshots captured so far."),
  capturing: z.boolean().describe("True when a capture is in flight RIGHT NOW."),
  cadence: z
    .object({
      enabled: z.boolean().describe("Whether scheduled capture is armed."),
      interval_hours: z.number().describe("Hours between scheduled captures."),
      capture_mode: z.string().describe("Capture strategy the schedule runs."),
    })
    .nullable()
    .optional()
    .describe("Scheduled-capture configuration, or null when none is configured."),
  latest_snapshot: snapshotSummary,
  latest_delta: deltaSummary,
  last_complete_delta_id: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Newest delta whose status is 'complete'. Read THIS delta when the answer has to be trustworthy.",
    ),
}

const deltaTable = z.object({
  table_key: z.string().describe("Fully-qualified table key (e.g. public.orders)."),
  added: z.number().describe("Rows added in this table."),
  modified: z.number().describe("Rows modified in this table."),
  removed: z.number().describe("Rows removed in this table."),
  changes_truncated: z
    .boolean()
    .describe("True when the row-level change list was capped and is incomplete."),
  examined: z
    .boolean()
    .describe(
      "False means the scan policy DEFERRED this table — it was NOT examined. A table absent from tables[] entirely WAS examined and is clean. Never conflate the two.",
    ),
  last_full_scan_at: z
    .string()
    .nullable()
    .optional()
    .describe("When this table was last fully scanned; null if never."),
  mode: z
    .string()
    .nullable()
    .optional()
    .describe("Scan mode used: full, incremental, changefeed, or skipped."),
  fallback_reason: z
    .string()
    .nullable()
    .optional()
    .describe("Why a faster scan path was abandoned; null when none was."),
  columns_added: z.array(z.string()).describe("Columns present only in the newer snapshot."),
  columns_removed: z.array(z.string()).describe("Columns present only in the older snapshot."),
})

const rowImage = z
  .record(z.string(), z.unknown())
  .nullable()
  .optional()
  .describe("Row image, or null (additions have no before, removals have no after).")

const primaryKey = z
  .union([z.string(), z.number()])
  .describe("Primary key of the row, as returned by the API.")

const changeType = z.enum(["added", "modified", "removed"]).describe("What happened to the row.")

/* ------------------------------------------------------------------ *
 * talonic_list_db_sources
 * ------------------------------------------------------------------ */

export const listSourcesOutputSchema = {
  data: z.array(z.object(sourceShape)).describe("Connected databases visible to this API key."),
  advisory: z
    .array(z.string())
    .optional()
    .describe("Caveats that must be carried into any answer derived from this payload."),
}

/**
 * Pure handler for `talonic_list_db_sources`. Exported for unit testing.
 *
 * @internal
 */
export async function handleListDbSources(api: DbSnapshotsApi): Promise<ToolResult> {
  try {
    const result = await api.listSources()
    const sources = Array.isArray(result?.data) ? result.data : []
    const advisory: string[] = []
    if (sources.some((s) => s?.latest_delta?.status === "partial")) {
      advisory.push(PARTIAL_ADVISORY)
    }
    if (sources.some((s) => s?.capturing === true)) {
      advisory.push(
        "At least one source has capturing:true — a capture is in flight right now, so its newest delta will keep growing.",
      )
    }
    return jsonOk({ ...result, data: sources, ...(advisory.length ? { advisory } : {}) })
  } catch (err) {
    return toolError(err)
  }
}

/* ------------------------------------------------------------------ *
 * talonic_get_db_delta
 * ------------------------------------------------------------------ */

const getDeltaInputSchema = {
  delta_id: z
    .string()
    .min(1)
    .optional()
    .describe("Delta id to read. Provide this OR connection_id, not both."),
  connection_id: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Connection id whose newest delta should be read. Provide this OR delta_id, not both.",
    ),
  prefer_complete: z
    .boolean()
    .optional()
    .describe(
      "With connection_id: resolve the newest COMPLETE delta (last_complete_delta_id) instead of the newest delta, which may still be partial. Default false.",
    ),
}

export const getDeltaOutputSchema = {
  delta: z
    .object({
      id: z.string().describe("Delta id."),
      connection_id: z.string().describe("Connection the delta belongs to."),
      from_snapshot_id: z.string().nullable().optional().describe("Baseline snapshot id."),
      to_snapshot_id: z.string().nullable().optional().describe("Newer snapshot id."),
      computed_at: timestamp.describe("When the delta was computed."),
      status: deltaStatus,
      totals: deltaTotals,
      tables: z
        .array(deltaTable)
        .describe(
          "Per-table counts. ABSENT table == examined and clean. PRESENT with examined:false == NOT examined (deferred by scan policy).",
        ),
    })
    .nullable()
    .describe("The delta, or null when the requested connection has no delta yet."),
  from_snapshot: z
    .object({ id: z.string(), captured_at: timestamp })
    .nullable()
    .optional()
    .describe("Baseline snapshot pointer."),
  to_snapshot: z
    .object({ id: z.string(), captured_at: timestamp, status: z.string().nullable().optional() })
    .nullable()
    .optional()
    .describe("Newer snapshot pointer, including its capture status."),
  column_profile: z
    .array(
      z.object({
        table_key: z.string(),
        column: z.string(),
        before: z.unknown().optional(),
        after: z.unknown().optional(),
        count: z.number().nullable().optional(),
        aggregate: z.unknown().optional(),
      }),
    )
    .optional()
    .describe("Column-level before/after shifts observed across the delta."),
  last_complete_delta_id: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Newest delta for this connection whose status is 'complete'. Read it when the answer must be trustworthy.",
    ),
  resolved_from: z
    .string()
    .optional()
    .describe("How the delta was chosen: 'delta_id', 'latest_delta', or 'last_complete_delta_id'."),
  advisory: z
    .array(z.string())
    .optional()
    .describe("Caveats that must be carried into any answer derived from this payload."),
}

/**
 * Arguments for {@link handleGetDbDelta}.
 *
 * @internal
 */
export interface GetDbDeltaArgs {
  delta_id?: string
  connection_id?: string
  prefer_complete?: boolean
}

/**
 * Pure handler for `talonic_get_db_delta`. Exported for unit testing.
 *
 * Accepts a delta id, or a connection id whose newest (or newest complete)
 * delta is resolved first. Always reports `status` and, for a partial delta,
 * attaches {@link PARTIAL_ADVISORY} plus `last_complete_delta_id` so the
 * caller has somewhere trustworthy to go.
 *
 * @internal
 */
export async function handleGetDbDelta(
  api: DbSnapshotsApi,
  args: GetDbDeltaArgs,
): Promise<ToolResult> {
  const hasDelta = typeof args.delta_id === "string" && args.delta_id.length > 0
  const hasConnection = typeof args.connection_id === "string" && args.connection_id.length > 0
  if (hasDelta === hasConnection) {
    return validationError("provide exactly one of `delta_id` or `connection_id`.")
  }

  try {
    let deltaId: string
    let resolvedFrom: string
    let lastCompleteDeltaId: string | null | undefined

    if (hasDelta) {
      deltaId = args.delta_id as string
      resolvedFrom = "delta_id"
    } else {
      const source = await api.getSource(args.connection_id as string)
      lastCompleteDeltaId = source?.last_complete_delta_id ?? null
      const latestId = source?.latest_delta?.id ?? null
      const chosen = args.prefer_complete
        ? (lastCompleteDeltaId ?? latestId)
        : (latestId ?? lastCompleteDeltaId)
      if (!chosen) {
        return jsonOk({
          delta: null,
          last_complete_delta_id: lastCompleteDeltaId,
          advisory: [
            `Connection ${args.connection_id} has no computed delta yet` +
              (source?.capturing === true
                ? " and a capture is in flight right now, so one is still being produced."
                : ". Nothing can be said about what changed."),
          ],
        })
      }
      deltaId = chosen
      resolvedFrom =
        args.prefer_complete && lastCompleteDeltaId === chosen
          ? "last_complete_delta_id"
          : chosen === latestId
            ? "latest_delta"
            : "last_complete_delta_id"
    }

    const result = await api.getDelta(deltaId)
    const delta = result?.delta
    const advisory: string[] = []

    if (delta?.status === "partial") {
      advisory.push(PARTIAL_ADVISORY)
      // The delta endpoint does not carry the pointer, so fetch it once —
      // only in the partial case, where the caller actually needs it.
      if (lastCompleteDeltaId === undefined && delta.connection_id) {
        try {
          const source = await api.getSource(delta.connection_id)
          lastCompleteDeltaId = source?.last_complete_delta_id ?? null
        } catch {
          // Non-fatal: the delta itself is the answer, the pointer is a hint.
          lastCompleteDeltaId = undefined
        }
      }
      if (lastCompleteDeltaId) {
        advisory.push(
          `For a trustworthy answer read delta ${lastCompleteDeltaId} (last_complete_delta_id).`,
        )
      } else if (lastCompleteDeltaId === null) {
        advisory.push(
          "This connection has NO complete delta yet, so no trustworthy change count exists — say so rather than quoting these floors.",
        )
      }
    }

    const tables = Array.isArray(delta?.tables) ? (delta.tables as unknown[]) : []
    // Always stated, including for an empty tables[]: "no table listed" is
    // exactly the reading that needs the absent-vs-deferred rule attached.
    advisory.push(TABLES_ADVISORY)
    if (tables.some((t) => (t as { examined?: boolean })?.examined === false)) {
      advisory.push(
        "At least one table in tables[] has examined:false — it was NOT examined; do not report it as unchanged.",
      )
    }

    return jsonOk({
      ...result,
      resolved_from: resolvedFrom,
      ...(lastCompleteDeltaId !== undefined ? { last_complete_delta_id: lastCompleteDeltaId } : {}),
      ...(advisory.length ? { advisory } : {}),
    })
  } catch (err) {
    return toolError(err)
  }
}

/* ------------------------------------------------------------------ *
 * talonic_list_db_changes
 * ------------------------------------------------------------------ */

const listChangesInputSchema = {
  delta_id: z.string().min(1).describe("Delta whose changes to page."),
  table: z
    .string()
    .min(1)
    .describe("Required. Table to page, exactly as it appears in the delta's tables[].table_key."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_CHANGE_LIMIT)
    .optional()
    .describe(
      `Page size (default ${DEFAULT_CHANGE_LIMIT}, hard maximum ${MAX_CHANGE_LIMIT}). Larger values are clamped; a single table can hold hundreds of thousands of changed rows.`,
    ),
  offset: z.number().int().min(0).optional().describe("Offset into the change list (default 0)."),
}

export const listChangesOutputSchema = {
  data: z
    .array(
      z.object({
        id: z.string().describe("Change-record id."),
        table_key: z.string().describe("Table the row lives in."),
        pk: primaryKey,
        change_type: changeType,
        before: rowImage,
        after: rowImage,
      }),
    )
    .describe("Changed rows on this page."),
  total: z
    .number()
    .describe("Total changes available for this table — usually far larger than data.length."),
  limit: z.number().describe("Page size applied after clamping."),
  offset: z.number().describe("Offset applied."),
  advisory: z
    .array(z.string())
    .optional()
    .describe("Caveats that must be carried into any answer derived from this payload."),
}

/**
 * Arguments for {@link handleListDbChanges}.
 *
 * @internal
 */
export interface ListDbChangesArgs {
  delta_id: string
  table: string
  limit?: number
  offset?: number
}

/**
 * Pure handler for `talonic_list_db_changes`. Exported for unit testing.
 *
 * `limit` is clamped to `1..500` before the API call, so an agent can never
 * request an unbounded page of a 264,000-row change set.
 *
 * @internal
 */
export async function handleListDbChanges(
  api: DbSnapshotsApi,
  args: ListDbChangesArgs,
): Promise<ToolResult> {
  if (!args?.table || args.table.length === 0) {
    return validationError("`table` is required; pick one from the delta's tables[].table_key.")
  }
  try {
    const limit = clampChangeLimit(args.limit)
    const offset = args.offset !== undefined && args.offset > 0 ? Math.floor(args.offset) : 0
    const result = await api.listChanges(args.delta_id, { table: args.table, limit, offset })
    const returned = Array.isArray(result?.data) ? result.data.length : 0
    const total = typeof result?.total === "number" ? result.total : returned
    const advisory: string[] = []
    if (args.limit !== undefined && clampChangeLimit(args.limit) !== Math.floor(args.limit)) {
      advisory.push(
        `Requested limit ${args.limit} was clamped to ${limit} (maximum ${MAX_CHANGE_LIMIT} rows per page).`,
      )
    }
    if (offset + returned < total) {
      advisory.push(
        `Showing rows ${offset + 1}-${offset + returned} of ${total}. Page with offset=${
          offset + returned
        } for more; do not treat data[] as the whole change set.`,
      )
    }
    return jsonOk({ ...result, ...(advisory.length ? { advisory } : {}) })
  } catch (err) {
    return toolError(err)
  }
}

/* ------------------------------------------------------------------ *
 * talonic_get_db_entity_history
 * ------------------------------------------------------------------ */

const entityHistoryInputSchema = {
  connection_id: z.string().min(1).describe("Connection the row belongs to."),
  table: z.string().min(1).describe("Table the row lives in (table_key)."),
  pk: z.string().min(1).describe("Primary-key value of the row, as a string."),
}

export const entityHistoryOutputSchema = {
  table_key: z.string().describe("Table the row lives in."),
  pk: primaryKey,
  identity_columns: z
    .array(z.string())
    .optional()
    .describe("Columns that make up the row's identity."),
  current: rowImage.describe("Latest known row image, or null when the row no longer exists."),
  events: z
    .array(
      z.object({
        delta_id: z.string().describe("Delta that recorded this event."),
        snapshot_id: z.string().describe("Snapshot the event was observed in."),
        captured_at: timestamp.describe("When that snapshot was captured."),
        change_type: changeType,
        before: rowImage,
        after: rowImage,
      }),
    )
    .describe("Recorded changes to the row, oldest first."),
  advisory: z
    .array(z.string())
    .optional()
    .describe("Caveats that must be carried into any answer derived from this payload."),
}

/**
 * Arguments for {@link handleGetDbEntityHistory}.
 *
 * @internal
 */
export interface GetDbEntityHistoryArgs {
  connection_id: string
  table: string
  pk: string
}

/**
 * Pure handler for `talonic_get_db_entity_history`. Exported for unit
 * testing.
 *
 * @internal
 */
export async function handleGetDbEntityHistory(
  api: DbSnapshotsApi,
  args: GetDbEntityHistoryArgs,
): Promise<ToolResult> {
  try {
    const result = await api.getEntityHistory(args.connection_id, {
      table: args.table,
      pk: args.pk,
    })
    const events = Array.isArray(result?.events) ? result.events : []
    const advisory: string[] = []
    if (events.length === 0) {
      advisory.push(
        "events[] is empty. That is NOT proof the row never changed: a capture still running, " +
          "or a table the scan policy deferred (examined:false in the delta), contributes no events.",
      )
    }
    return jsonOk({ ...result, events, ...(advisory.length ? { advisory } : {}) })
  } catch (err) {
    return toolError(err)
  }
}

/* ------------------------------------------------------------------ *
 * Registration
 * ------------------------------------------------------------------ */

/**
 * Register the four database-snapshot read tools.
 *
 * @internal
 */
export function registerDbSnapshotTools(server: McpServer, getTalonic: () => Talonic): void {
  server.registerTool(
    "talonic_list_db_sources",
    {
      title: "List DB Snapshot Sources",
      description: DESCRIPTIONS.listSources,
      inputSchema: {},
      outputSchema: listSourcesOutputSchema,
      annotations: { title: "List DB Snapshot Sources", ...READ_ONLY },
    },
    async () => {
      const api = dbSnapshotsOf(getTalonic())
      return api ? handleListDbSources(api) : sdkUnavailable()
    },
  )

  server.registerTool(
    "talonic_get_db_delta",
    {
      title: "Get DB Delta",
      description: DESCRIPTIONS.getDelta,
      inputSchema: getDeltaInputSchema,
      outputSchema: getDeltaOutputSchema,
      annotations: { title: "Get DB Delta", ...READ_ONLY },
    },
    async (args: GetDbDeltaArgs) => {
      const api = dbSnapshotsOf(getTalonic())
      return api ? handleGetDbDelta(api, args) : sdkUnavailable()
    },
  )

  server.registerTool(
    "talonic_list_db_changes",
    {
      title: "List DB Changes",
      description: DESCRIPTIONS.listChanges,
      inputSchema: listChangesInputSchema,
      outputSchema: listChangesOutputSchema,
      annotations: { title: "List DB Changes", ...READ_ONLY },
    },
    async (args: ListDbChangesArgs) => {
      const api = dbSnapshotsOf(getTalonic())
      return api ? handleListDbChanges(api, args) : sdkUnavailable()
    },
  )

  server.registerTool(
    "talonic_get_db_entity_history",
    {
      title: "Get DB Entity History",
      description: DESCRIPTIONS.entityHistory,
      inputSchema: entityHistoryInputSchema,
      outputSchema: entityHistoryOutputSchema,
      annotations: { title: "Get DB Entity History", ...READ_ONLY },
    },
    async (args: GetDbEntityHistoryArgs) => {
      const api = dbSnapshotsOf(getTalonic())
      return api ? handleGetDbEntityHistory(api, args) : sdkUnavailable()
    },
  )
}
