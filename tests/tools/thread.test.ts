import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleCloseSheet,
  handleDecideApproval,
  handleDecideDraft,
  handleDecideSheet,
  handleEvents,
  handleListDrafts,
  handleSend,
  handleSendFiles,
  handleState,
  probeThreadAccess,
} from "../../src/tools/thread"
import {
  handleConfirmTurn,
  handleGetTurn,
  handleHomePage,
  probeAgentTurnsAccess,
} from "../../src/tools/agent-turns"
import {
  handleDecideFieldRequest,
  handleFeed,
  handleShare,
  handleShareItems,
  probeMyDataAccess,
} from "../../src/tools/my-data"
import { createServer } from "../../src/server-factory"

const KEY = "0f3c9a1b2d4e5f60718293a4b5c6d7e8f9012345"
const token = () => "tlnc_key"
const A = "44444444-4444-4444-8444-444444444444"
const D = "55555555-5555-4555-8555-555555555555"
const HASH = "a".repeat(64)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function stub(...bodies: unknown[]) {
  const fetchMock = vi.fn()
  for (const b of bodies) fetchMock.mockResolvedValueOnce(jsonResponse(b))
  fetchMock.mockResolvedValue(jsonResponse(bodies[bodies.length - 1] ?? {}))
  vi.stubGlobal("fetch", fetchMock)
  return (i = 0) => {
    const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit]
    const body = init.body
    return {
      url,
      method: init.method,
      body: typeof body === "string" ? JSON.parse(body) : body,
      headers: new Headers(init.headers),
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("thread tool handlers", () => {
  it("state and events read the person's thread", async () => {
    const call = stub({ enabled: true, events: [], cursor: 3 })
    await handleState(token, undefined)
    expect(call()).toMatchObject({ url: "https://api.talonic.com/v1/thread/state", method: "GET" })
    const call2 = stub({ events: [], cursor: 3, has_more: false })
    await handleEvents(token, undefined, { after: 3, limit: 50 })
    expect(call2().url).toBe("https://api.talonic.com/v1/thread/events?after=3&limit=50")
  })

  it("send posts the message with the Idempotency-Key and returns at once with wait 0", async () => {
    const call = stub({
      event: { seq: 9, cycleId: "c1", actor: "user", kind: "message", body: "hi" },
      replayed: false,
    })
    const res = await handleSend(token, undefined, {
      text: "hi",
      idempotency_key: "retry-1",
      wait_seconds: 0,
    })
    const c = call()
    expect(c).toMatchObject({
      url: "https://api.talonic.com/v1/thread/messages",
      method: "POST",
      body: { text: "hi" },
    })
    expect(c.headers.get("idempotency-key")).toBe("retry-1")
    expect(c.headers.get("authorization")).toBe("Bearer tlnc_key")
    expect(JSON.parse(res.content[0]!.text as string)).toMatchObject({
      replayed: false,
      answer: [],
      cursor: 9,
    })
  })

  it("send waits for the exchange to go idle and returns its answer", async () => {
    vi.useFakeTimers()
    stub(
      {
        event: { seq: 9, cycleId: "c1", actor: "user", kind: "message", body: "hi" },
        replayed: false,
      },
      {
        events: [
          {
            seq: 10,
            cycleId: "c1",
            actor: "agent",
            kind: "message",
            body: "Three contracts end before March.",
          },
          { seq: 11, cycleId: "other", actor: "agent", kind: "message", body: "unrelated" },
          { seq: 12, cycleId: "c1", actor: "system", kind: "status", body: "idle" },
        ],
        cursor: 12,
      },
    )
    const pending = handleSend(token, undefined, { text: "hi", wait_seconds: 10 })
    await vi.advanceTimersByTimeAsync(2_000)
    const out = JSON.parse((await pending).content[0]!.text as string)
    expect(out.done).toBe(true)
    expect(out.cursor).toBe(12)
    expect(out.answer.map((e: { body: string }) => e.body)).toEqual([
      "Three contracts end before March.",
    ])
  })

  it("a replayed send does not wait", async () => {
    const fetchCalls = stub({ event: null, replayed: true })
    const out = JSON.parse(
      (await handleSend(token, undefined, { text: "hi", idempotency_key: "k" })).content[0]!
        .text as string,
    )
    expect(out).toMatchObject({ event: null, replayed: true, done: true })
    expect(fetchCalls().url).toContain("/v1/thread/messages")
  })

  it("send_files posts multipart with every file", async () => {
    const call = stub({ event: { seq: 1 }, replayed: false })
    await handleSendFiles(token, undefined, {
      files: [{ filename: "a.pdf", content_base64: Buffer.from("%PDF").toString("base64") }],
      text: "my receipt",
    })
    const c = call()
    expect(c.url).toBe("https://api.talonic.com/v1/thread/files")
    const form = c.body as FormData
    expect(form.getAll("file")).toHaveLength(1)
    expect(form.get("text")).toBe("my receipt")
  })

  it("decisions name exactly the card the person saw", async () => {
    const call = stub({ outcome: "done", line: "Sent.", replayed: false })
    await handleDecideDraft(token, undefined, {
      approval_id: A,
      draft_id: D,
      draft_version: 2,
      payload_hash: HASH,
      approved: true,
    })
    expect(call()).toMatchObject({
      url: `https://api.talonic.com/v1/thread/drafts/${A}/decision`,
      method: "POST",
      body: { approved: true, draft_id: D, draft_version: 2, payload_hash: HASH },
    })
    const call2 = stub({ ok: true })
    await handleDecideApproval(token, undefined, { approval_id: A, approved: false })
    expect(call2()).toMatchObject({
      url: `https://api.talonic.com/v1/thread/approvals/${A}`,
      body: { approved: false },
    })
    const call3 = stub({ drafts: [] })
    await handleListDrafts(token, undefined)
    expect(call3().url).toBe("https://api.talonic.com/v1/thread/drafts")
  })

  it("sheet decisions carry the version and may take a decision back", async () => {
    const call = stub({ version: 3 })
    await handleDecideSheet(token, undefined, {
      sheet_id: A,
      row_key: "r1",
      decision: null,
      expected_version: 2,
    })
    expect(call()).toMatchObject({
      url: `https://api.talonic.com/v1/thread/sheets/${A}/decisions`,
      body: { row_key: "r1", decision: null, expected_version: 2 },
    })
    const call2 = stub({ ok: true })
    await handleCloseSheet(token, undefined, { sheet_id: A })
    expect(call2()).toMatchObject({
      url: `https://api.talonic.com/v1/thread/sheets/${A}/close`,
      method: "POST",
    })
  })
})

describe("agent turn and my data handlers", () => {
  it("reads and confirms the person's own turn, reads their home page", async () => {
    const call = stub({ ok: true, id: A, status: "running" })
    await handleConfirmTurn(token, undefined, { turn_id: A, confirmed: true })
    expect(call()).toMatchObject({
      url: `https://api.talonic.com/v1/agent/turns/${A}/confirm`,
      method: "POST",
      body: { confirmed: true },
    })
    const call2 = stub({ id: A })
    await handleGetTurn(token, undefined, { turn_id: A })
    expect(call2().url).toBe(`https://api.talonic.com/v1/agent/turns/${A}`)
    const call3 = stub({ html: null })
    await handleHomePage(token, undefined)
    expect(call3().url).toBe("https://api.talonic.com/v1/agent/home/page")
  })

  it("my data reads the feed and routes share decisions", async () => {
    const call = stub({})
    await handleFeed(token, undefined)
    expect(call().url).toBe("https://api.talonic.com/v1/my-data")
    const call2 = stub({})
    await handleShare(token, undefined, { source_id: A, action: "stop_sharing", user_ids: [] })
    expect(call2()).toMatchObject({
      url: `https://api.talonic.com/v1/my-data/sources/${A}/stop-sharing`,
      body: { user_ids: [] },
    })
    const call3 = stub({})
    await handleShareItems(token, undefined, {
      source_id: A,
      action: "share",
      document_ids: [D],
      recipient_id: A,
    })
    expect(call3()).toMatchObject({
      url: `https://api.talonic.com/v1/my-data/sources/${A}/items/share`,
      body: { document_ids: [D], recipient_id: A },
    })
  })

  it("field request decisions send the field each action needs, and refuse a missing reason", async () => {
    const call = stub({})
    await handleDecideFieldRequest(token, undefined, {
      request_id: A,
      action: "deny",
      text: "Not for this purpose",
    })
    expect(call()).toMatchObject({
      url: `https://api.talonic.com/v1/my-data/field-requests/${A}/deny`,
      body: { reason: "Not for this purpose" },
    })
    const call2 = stub({})
    await handleDecideFieldRequest(token, undefined, { request_id: A, action: "withdraw" })
    expect(call2()).toMatchObject({
      url: `https://api.talonic.com/v1/my-data/field-requests/${A}/withdraw`,
      body: undefined,
    })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const res = await handleDecideFieldRequest(token, undefined, {
      request_id: A,
      action: "clarify",
    })
    expect(res.isError).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("probe gating", () => {
  it("each probe is a 200 on its own route", async () => {
    for (const [probe, path] of [
      [probeThreadAccess, "/v1/thread/drafts"],
      [probeAgentTurnsAccess, "/v1/agent/home/page"],
      [probeMyDataAccess, "/v1/me/data"],
    ] as const) {
      const ok = vi.fn().mockResolvedValue(jsonResponse({}))
      vi.stubGlobal("fetch", ok)
      expect(await probe("tlnc_key")).toBe(true)
      expect(ok.mock.calls[0]![0]).toBe(`https://api.talonic.com${path}`)
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 404)))
      expect(await probe("tlnc_key")).toBe(false)
    }
  })

  it("lists the tools only when included", async () => {
    const names = async (opts: Record<string, boolean>) => {
      const server = createServer({ apiKey: KEY, ...opts }) as any
      return Object.keys(server._registeredTools ?? {})
    }
    const none = await names({})
    expect(
      none.some(
        (n) =>
          n.startsWith("talonic_thread_") ||
          n.startsWith("talonic_my_data") ||
          n === "talonic_agent_confirm_turn",
      ),
    ).toBe(false)
    const all = await names({
      includeThreadTools: true,
      includeAgentTurnTools: true,
      includeMyDataTools: true,
    })
    for (const n of [
      "talonic_thread_send",
      "talonic_thread_decide_draft",
      "talonic_thread_decide_sheet",
      "talonic_agent_confirm_turn",
      "talonic_agent_home_page",
      "talonic_my_data",
      "talonic_my_data_decide_field_request",
    ]) {
      expect(all).toContain(n)
    }
  })
})
