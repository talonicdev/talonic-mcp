import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiHttpError, validationError, zUuid, type ToolResult } from "./_shared.js"
import { apiJson, buildUrl, resolveFetch, runTool, sleep } from "./_http.js"

/**
 * Thread tools: the person's own conversation with Talonic (the one they have
 * in the web app and in Slack) over `/v1/thread/*`. Every call acts as the
 * person the key or token belongs to: their thread only, their permissions,
 * and nothing is sent, started or shared without their decision. The loop an
 * agent runs: talonic_thread_send (waits briefly for the answer) →
 * talonic_thread_events for anything later → talonic_thread_list_drafts →
 * talonic_thread_decide_draft once the person said yes.
 */

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const
const write = (idempotent: boolean, destructive = false, openWorld = false) =>
  ({
    readOnlyHint: false,
    destructiveHint: destructive,
    idempotentHint: idempotent,
    openWorldHint: openWorld,
  }) as const

/** Longest wait for an answer inside one send. */
const MAX_WAIT_SECONDS = 60
const POLL_MS = 1_500

interface ThreadEvent {
  seq: number
  cycleId: string | null
  actor: string
  kind: string
  body: string
  meta?: Record<string, unknown>
}

const STATE_DESCRIPTION = [
  "Read the person's thread: the last exchange and any card waiting for their decision, plus the cursor to read later events from.",
  "USE WHEN: starting a session, or checking what is waiting before deciding.",
  "NOT FOR: new events after a cursor (talonic_thread_events); prepared drafts with what a decision must name (talonic_thread_list_drafts).",
  "",
  "ARGS: none.",
  "RETURNS: { enabled, events[] { seq, actor, kind, body, meta }, cursor }. enabled false: the thread is not available to this person.",
].join("\n")

/** @internal */
export function handleState(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/thread/state"))
}

const EVENTS_DESCRIPTION = [
  "Read everything written to the person's thread after a cursor, oldest first: their messages, the answers, decision cards and status rows.",
  "USE WHEN: an answer arrived after talonic_thread_send stopped waiting, or to follow the thread over time.",
  "NOT FOR: the first read of a session (talonic_thread_state).",
  "",
  "ARGS: `after` (a cursor from talonic_thread_state or a previous call), `limit` (1-200, default 100).",
  "RETURNS: { events[], cursor, has_more }. Keep the cursor for the next call.",
].join("\n")

export const eventsInputSchema = {
  after: z.number().int().min(0).optional().describe("The cursor to read after."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe("Most events to return (default 100)."),
}

/** @internal */
export function handleEvents(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { after?: number; limit?: number },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", "/v1/thread/events", {
      params: { after: args.after, limit: args.limit },
    }),
  )
}

const SEND_DESCRIPTION = [
  "Send one message to the person's thread, as them, and wait up to `wait_seconds` for the answer. Uses the workspace agent budget.",
  "USE WHEN: the person wants to ask Talonic something or hand it a task in their own conversation.",
  "NOT FOR: deciding a card (talonic_thread_decide_draft / talonic_thread_decide_approval); handing in files (talonic_thread_send_files).",
  "",
  "ARGS: `text`, optional `tz` (IANA, e.g. Europe/Berlin), `reply_to` (a card event id this answers), `idempotency_key` (repeat it on a retry: the message is stored and answered once), `wait_seconds` (0-60, default 20).",
  "RETURNS: { event, replayed, answer[] (the answer's messages and cards so far), cursor, done }. done false: read the rest with talonic_thread_events from cursor.",
].join("\n")

export const sendInputSchema = {
  text: z.string().min(1).max(8000).describe("The message."),
  tz: z.string().max(64).optional().describe("The person's IANA time zone."),
  reply_to: zUuid().optional().describe("The card event this message answers."),
  idempotency_key: z
    .string()
    .regex(/^[A-Za-z0-9_.:-]{1,200}$/)
    .optional()
    .describe("Your retry token; the same key never sends twice."),
  wait_seconds: z
    .number()
    .int()
    .min(0)
    .max(MAX_WAIT_SECONDS)
    .optional()
    .describe("How long to wait for the answer (default 20)."),
}

/**
 * Polls events of one exchange until it goes idle or the wait runs out.
 * @internal
 */
export async function waitForAnswer(
  getToken: () => string,
  baseUrl: string | undefined,
  sent: ThreadEvent,
  waitSeconds: number,
): Promise<{ answer: ThreadEvent[]; cursor: number; done: boolean }> {
  const answer: ThreadEvent[] = []
  let cursor = sent.seq
  const until = Date.now() + waitSeconds * 1000
  while (Date.now() < until) {
    await sleep(POLL_MS)
    const page = await apiJson<{ events: ThreadEvent[]; cursor: number }>(
      getToken,
      baseUrl,
      "GET",
      "/v1/thread/events",
      { params: { after: cursor } },
    )
    cursor = page.cursor
    let idle = false
    for (const e of page.events) {
      if (e.cycleId !== sent.cycleId) continue
      if (e.kind === "status") idle = e.body === "idle"
      else if (e.actor !== "user") answer.push(e)
    }
    if (idle) return { answer, cursor, done: true }
  }
  return { answer, cursor, done: false }
}

/** @internal */
export function handleSend(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    text: string
    tz?: string
    reply_to?: string
    idempotency_key?: string
    wait_seconds?: number
  },
): Promise<ToolResult> {
  return runTool(async () => {
    const res = await apiJson<{ event: ThreadEvent | null; replayed: boolean }>(
      getToken,
      baseUrl,
      "POST",
      "/v1/thread/messages",
      {
        body: {
          text: args.text,
          ...(args.tz ? { tz: args.tz } : {}),
          ...(args.reply_to ? { reply_to: args.reply_to } : {}),
        },
        ...(args.idempotency_key ? { headers: { "Idempotency-Key": args.idempotency_key } } : {}),
      },
    )
    const wait = args.wait_seconds ?? 20
    if (!res.event || wait <= 0)
      return { ...res, answer: [], cursor: res.event?.seq ?? null, done: !res.event }
    return { ...res, ...(await waitForAnswer(getToken, baseUrl, res.event, wait)) }
  })
}

const FILES_DESCRIPTION = [
  "Hand the person's thread up to five files with an optional message. Each file is kept as the person's own document, visible to nobody else, and the files are answered together like one message.",
  "USE WHEN: the person gives Talonic a receipt, a contract or a photo to read or file.",
  "NOT FOR: adding documents to the workspace for everyone (talonic_extract).",
  "",
  "ARGS: `files[]` { filename, content_base64 } (at most 25 MB each), optional `text`, `tz`, `idempotency_key`.",
  "RETURNS: { event, replayed }. Read the answer with talonic_thread_events after event.seq.",
].join("\n")

export const sendFilesInputSchema = {
  files: z
    .array(z.object({ filename: z.string().min(1).max(255), content_base64: z.string().min(1) }))
    .min(1)
    .max(5)
    .describe("The files, base64."),
  text: z.string().max(8000).optional().describe("Words sent with the files."),
  tz: z.string().max(64).optional(),
  idempotency_key: z
    .string()
    .regex(/^[A-Za-z0-9_.:-]{1,200}$/)
    .optional(),
}

/** @internal */
export function handleSendFiles(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    files: Array<{ filename: string; content_base64: string }>
    text?: string
    tz?: string
    idempotency_key?: string
  },
): Promise<ToolResult> {
  const form = new FormData()
  for (const f of args.files) {
    const bytes = Buffer.from(f.content_base64, "base64")
    if (!bytes.length)
      return Promise.resolve(
        validationError(`${f.filename}: content_base64 is empty or not base64.`),
      )
    form.append("file", new Blob([bytes]), f.filename)
  }
  if (args.text) form.append("text", args.text)
  if (args.tz) form.append("tz", args.tz)
  return runTool(async () => {
    const res = await resolveFetch(getToken)(buildUrl(baseUrl, "/v1/thread/files"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "application/json",
        ...(args.idempotency_key ? { "Idempotency-Key": args.idempotency_key } : {}),
      },
      body: form,
    })
    if (!res.ok) throw await apiHttpError(res)
    return res.json()
  })
}

const APPROVAL_DESCRIPTION = [
  "Approve or decline an action the thread is holding for the person (an approval card without a draft). Decided once; a second decision is refused. Only on the person's explicit answer.",
  "USE WHEN: the person said yes or no to a held action shown in the thread.",
  "NOT FOR: prepared drafts (emails, process starts, shares): talonic_thread_decide_draft.",
  "",
  "ARGS: `approval_id` (meta.approvalId of the card), `approved`.",
  "RETURNS: { ok }. The outcome arrives as thread events.",
].join("\n")

export const approvalInputSchema = { approval_id: zUuid(), approved: z.boolean() }

/** @internal */
export function handleDecideApproval(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { approval_id: string; approved: boolean },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "POST",
      `/v1/thread/approvals/${encodeURIComponent(args.approval_id)}`,
      { body: { approved: args.approved } },
    ),
  )
}

const DRAFTS_DESCRIPTION = [
  "List the drafts the thread prepared and is waiting for the person to approve: an email, a start of one of their processes, or sharing one of their documents. Each names what a decision must quote back.",
  "USE WHEN: before talonic_thread_decide_draft, to show the person exactly what would happen.",
  "NOT FOR: held actions without a draft (talonic_thread_state shows them).",
  "",
  "ARGS: none.",
  "RETURNS: { drafts[] { approval_id, draft_id, draft_version, payload_hash, kind message|process|share, shown } }.",
].join("\n")

/** @internal */
export function handleListDrafts(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/thread/drafts"))
}

const DECIDE_DRAFT_DESCRIPTION = [
  "Approve or decline one prepared draft, naming the version the person saw. Approving sends the email, starts the process or shares the document; only on the person's explicit answer to exactly what `shown` said. A repeat returns the first answer (replayed true); nothing happens twice.",
  "USE WHEN: the person approved or declined a draft listed by talonic_thread_list_drafts.",
  "NOT FOR: guessing consent; if unsure, ask the person first.",
  "",
  "ARGS: `approval_id`, `draft_id`, `draft_version`, `payload_hash` (all from the listed draft), `approved`.",
  "RETURNS: { outcome done|failed|uncertain|declined|stale|expired|running, line, replayed, current? }. stale: the draft changed; show `current` and ask again.",
].join("\n")

export const decideDraftInputSchema = {
  approval_id: zUuid(),
  draft_id: zUuid(),
  draft_version: z.number().int().min(1),
  payload_hash: z.string().regex(/^[0-9a-f]{64}$/),
  approved: z.boolean(),
}

/** @internal */
export function handleDecideDraft(
  getToken: () => string,
  baseUrl: string | undefined,
  args: {
    approval_id: string
    draft_id: string
    draft_version: number
    payload_hash: string
    approved: boolean
  },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "POST",
      `/v1/thread/drafts/${encodeURIComponent(args.approval_id)}/decision`,
      {
        body: {
          approved: args.approved,
          draft_id: args.draft_id,
          draft_version: args.draft_version,
          payload_hash: args.payload_hash,
        },
      },
    ),
  )
}

const SHEETS_DESCRIPTION = [
  "List the person's screens: tasks over a set of records (contracts to renew, invoices to check) the thread opened for them. Open ones first.",
  "USE WHEN: finding a screen to read or decide on.",
  "NOT FOR: one screen's records (talonic_thread_get_sheet).",
  "",
  "ARGS: none.",
  "RETURNS: { sheets[] { id, title, status open|done, createdAt, updatedAt } }.",
].join("\n")

/** @internal */
export function handleListSheets(
  getToken: () => string,
  baseUrl: string | undefined,
): Promise<ToolResult> {
  return runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/thread/sheets"))
}

const SHEET_DESCRIPTION = [
  "Read one screen: its records as the person can read them now, the choices it offers, and what was written about each record (suggestion, reason, decision, version).",
  "USE WHEN: before deciding records, or to report a screen's state.",
  "NOT FOR: the list (talonic_thread_list_sheets).",
  "",
  "ARGS: `sheet_id`.",
  "RETURNS: the screen with rows[] and hidden (records the person cannot read, counted only).",
].join("\n")

export const sheetInputSchema = { sheet_id: zUuid() }

/** @internal */
export function handleGetSheet(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { sheet_id: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", `/v1/thread/sheets/${encodeURIComponent(args.sheet_id)}`),
  )
}

const DECIDE_SHEET_DESCRIPTION = [
  "Record, change or take back (decision null) the person's decision on one record of a screen, naming the record version they saw. Records a choice only; it carries nothing out.",
  "USE WHEN: the person chose for a record shown by talonic_thread_get_sheet.",
  "NOT FOR: closing the screen (talonic_thread_close_sheet).",
  "",
  "ARGS: `sheet_id`, `row_key`, `decision` (one of the screen's choices, or null), `expected_version`.",
  "RETURNS: { version }. A 409 means the record changed since: read it again.",
].join("\n")

export const decideSheetInputSchema = {
  sheet_id: zUuid(),
  row_key: z.string().min(1).max(500),
  decision: z
    .string()
    .regex(/^[a-z0-9_]{1,30}$/)
    .nullable(),
  expected_version: z.number().int().min(0),
}

/** @internal */
export function handleDecideSheet(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { sheet_id: string; row_key: string; decision: string | null; expected_version: number },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "POST",
      `/v1/thread/sheets/${encodeURIComponent(args.sheet_id)}/decisions`,
      {
        body: {
          row_key: args.row_key,
          decision: args.decision,
          expected_version: args.expected_version,
        },
      },
    ),
  )
}

const CLOSE_SHEET_DESCRIPTION = [
  "Mark one of the person's screens done. Its decisions are kept.",
  "USE WHEN: the person finished a screen.",
  "NOT FOR: deciding records (talonic_thread_decide_sheet).",
  "",
  "ARGS: `sheet_id`.",
  "RETURNS: { ok }.",
].join("\n")

/** @internal */
export function handleCloseSheet(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { sheet_id: string },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(
      getToken,
      baseUrl,
      "POST",
      `/v1/thread/sheets/${encodeURIComponent(args.sheet_id)}/close`,
    ),
  )
}

const FIGURE_DESCRIPTION = [
  "Check one figure the thread stated: how it was counted, the records behind it, and whether anything changed since.",
  "USE WHEN: the person asks where a number came from.",
  "NOT FOR: asking a new question (talonic_thread_send).",
  "",
  "ARGS: `figure_id` (from the answer's meta), optional `offset` for the next page of records.",
  "RETURNS: the definition, rows and a changed flag.",
].join("\n")

export const figureInputSchema = { figure_id: zUuid(), offset: z.number().int().min(0).optional() }

/** @internal */
export function handleFigure(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { figure_id: string; offset?: number },
): Promise<ToolResult> {
  return runTool(() =>
    apiJson(getToken, baseUrl, "GET", `/v1/thread/figures/${encodeURIComponent(args.figure_id)}`, {
      params: { offset: args.offset },
    }),
  )
}

/**
 * Whether the credential reaches a thread: `GET /v1/thread/drafts` answers 200
 * only for a person with `thread:read` whose thread is available. Listing
 * visibility only; the platform decides every call.
 */
export async function probeThreadAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/thread/drafts"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Register the `talonic_thread_*` tools. */
export function registerThreadTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const tools: Array<
    [
      string,
      string,
      string,
      Record<string, z.ZodTypeAny>,
      Record<string, boolean>,
      (a: any) => Promise<ToolResult>,
    ]
  > = [
    [
      "talonic_thread_state",
      "Read the thread",
      STATE_DESCRIPTION,
      {},
      readOnly,
      () => handleState(getToken, baseUrl),
    ],
    [
      "talonic_thread_events",
      "Read thread events",
      EVENTS_DESCRIPTION,
      eventsInputSchema,
      readOnly,
      (a) => handleEvents(getToken, baseUrl, a),
    ],
    [
      "talonic_thread_send",
      "Send a thread message",
      SEND_DESCRIPTION,
      sendInputSchema,
      write(false),
      (a) => handleSend(getToken, baseUrl, a),
    ],
    [
      "talonic_thread_send_files",
      "Hand files to the thread",
      FILES_DESCRIPTION,
      sendFilesInputSchema,
      write(false),
      (a) => handleSendFiles(getToken, baseUrl, a),
    ],
    [
      "talonic_thread_decide_approval",
      "Decide a held action",
      APPROVAL_DESCRIPTION,
      approvalInputSchema,
      write(false, false, true),
      (a) => handleDecideApproval(getToken, baseUrl, a),
    ],
    [
      "talonic_thread_list_drafts",
      "List prepared drafts",
      DRAFTS_DESCRIPTION,
      {},
      readOnly,
      () => handleListDrafts(getToken, baseUrl),
    ],
    [
      "talonic_thread_decide_draft",
      "Approve or decline a draft",
      DECIDE_DRAFT_DESCRIPTION,
      decideDraftInputSchema,
      write(true, false, true),
      (a) => handleDecideDraft(getToken, baseUrl, a),
    ],
    [
      "talonic_thread_list_sheets",
      "List screens",
      SHEETS_DESCRIPTION,
      {},
      readOnly,
      () => handleListSheets(getToken, baseUrl),
    ],
    [
      "talonic_thread_get_sheet",
      "Read a screen",
      SHEET_DESCRIPTION,
      sheetInputSchema,
      readOnly,
      (a) => handleGetSheet(getToken, baseUrl, a),
    ],
    [
      "talonic_thread_decide_sheet",
      "Decide a record on a screen",
      DECIDE_SHEET_DESCRIPTION,
      decideSheetInputSchema,
      write(true),
      (a) => handleDecideSheet(getToken, baseUrl, a),
    ],
    [
      "talonic_thread_close_sheet",
      "Close a screen",
      CLOSE_SHEET_DESCRIPTION,
      sheetInputSchema,
      write(true),
      (a) => handleCloseSheet(getToken, baseUrl, a),
    ],
    [
      "talonic_thread_figure",
      "Check a stated figure",
      FIGURE_DESCRIPTION,
      figureInputSchema,
      readOnly,
      (a) => handleFigure(getToken, baseUrl, a),
    ],
  ]
  for (const [name, title, description, inputSchema, annotations, handler] of tools) {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations } },
      async (args: unknown) => handler(args),
    )
  }
}
