import { afterEach, describe, expect, it, vi } from "vitest"
import { ASK_POLL_INTERVAL_MS, handleAsk, handleGetAnswer } from "../../src/tools/ask"

type Call = { url: string; init: RequestInit }
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}
const getToken = () => "tlnc_test"
const parsed = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0]?.text ?? "")
const ASK = "a5k00001-0000-4000-8000-000000000001"
const CONV = "c0000001-0000-4000-8000-000000000001"
const DONE = {
  ask_id: ASK,
  status: "completed",
  conversation_id: CONV,
  answer: "The total is **1,299.00 EUR** [1].",
  citations: [
    {
      quote: "Total amount due: 1,299.00 EUR",
      document_id: "d0c00001-0000-4000-8000-000000000001",
      kind: "field",
      filename: "invoice-0421.pdf",
    },
  ],
  verification: { verdict: "supported", checks_total: 1, checks_unsupported: 0 },
  usage: { tokens: 812, credits_charged: 3 },
  tool_calls: 2,
}

/** Sequenced fetch: POST /v1/ask once, then GET /v1/ask/{id} answers in order. */
function stubSequence(gets: unknown[]) {
  const calls: Call[] = []
  let g = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      if (init.method === "POST")
        return jsonResponse(
          { ask_id: ASK, status: "processing", poll_url: `/v1/ask/${ASK}`, conversation_id: CONV },
          202,
        )
      return jsonResponse(gets[Math.min(g++, gets.length - 1)])
    }),
  )
  return calls
}
const PROCESSING = { ask_id: ASK, status: "processing", conversation_id: CONV }

describe("talonic_ask", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("POSTs the question with scope, then polls until completed, sleeping between polls", async () => {
    const calls = stubSequence([PROCESSING, PROCESSING, DONE])
    const sleeps: number[] = []
    let t = 0
    const res = await handleAsk(
      getToken,
      "https://api.example.test",
      {
        question: "What is the total on invoice-0421?",
        scope: { document_ids: ["d0c00001-0000-4000-8000-000000000001"] },
        wait_seconds: 30,
      },
      {
        sleep: async (ms) => {
          sleeps.push(ms)
          t += ms
        },
        now: () => t,
      },
    )
    expect(calls[0].url).toBe("https://api.example.test/v1/ask")
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      question: "What is the total on invoice-0421?",
      scope: { document_ids: ["d0c00001-0000-4000-8000-000000000001"] },
    })
    expect(calls.slice(1).map((c) => c.url)).toEqual(
      Array(3).fill(`https://api.example.test/v1/ask/${ASK}`),
    )
    expect(sleeps).toEqual([ASK_POLL_INTERVAL_MS, ASK_POLL_INTERVAL_MS])
    const body = parsed(res)
    expect(body.status).toBe("completed")
    expect(body.answer).toContain("1,299.00")
    expect(body.citations[0].filename).toBe("invoice-0421.pdf")
    expect(body.waited_ms).toBe(2 * ASK_POLL_INTERVAL_MS)
    expect(body.poll_hint).toBeUndefined()
  })

  it("gives up at the deadline and returns the processing envelope with a poll hint", async () => {
    const calls = stubSequence([PROCESSING])
    let t = 0
    const res = await handleAsk(
      getToken,
      undefined,
      { question: "q", wait_seconds: 5 },
      {
        sleep: async (ms) => {
          t += ms
        },
        now: () => t,
      },
    )
    const body = parsed(res)
    expect(body.status).toBe("processing")
    expect(body.ask_id).toBe(ASK)
    expect(body.poll_hint).toMatch(/talonic_get_answer/)
    expect(body.waited_ms).toBe(5000)
    // polls at t=0, 2000, 4000, then a final one exactly at the 5000 deadline
    expect(calls.filter((c) => c.init.method !== "POST")).toHaveLength(4)
  })

  it("wait_seconds: 0 -> exactly one GET", async () => {
    const calls = stubSequence([PROCESSING])
    const res = await handleAsk(
      getToken,
      undefined,
      { question: "q", wait_seconds: 0 },
      { sleep: async () => {}, now: () => 0 },
    )
    expect(calls.filter((c) => c.init.method !== "POST")).toHaveLength(1)
    expect(parsed(res).status).toBe("processing")
  })

  it("clamps wait_seconds above the max, bounding waited_ms and the GET count, with a signal on every call", async () => {
    const calls = stubSequence([PROCESSING])
    let t = 0
    const res = await handleAsk(
      getToken,
      undefined,
      { question: "q", wait_seconds: 999 },
      {
        sleep: async (ms) => {
          t += ms
        },
        now: () => t,
      },
    )
    const body = parsed(res)
    expect(body.status).toBe("processing")
    expect(body.waited_ms).toBeLessThanOrEqual(55000)
    const gets = calls.filter((c) => c.init.method !== "POST")
    expect(gets.length).toBeLessThanOrEqual(29)
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal)
    for (const c of gets) expect(c.init.signal).toBeInstanceOf(AbortSignal)
  })

  it("wait_seconds: NaN falls back to the default wait instead of NaN deadline math", async () => {
    const calls = stubSequence([PROCESSING])
    let t = 0
    const res = await handleAsk(
      getToken,
      undefined,
      { question: "q", wait_seconds: NaN },
      {
        sleep: async (ms) => {
          t += ms
        },
        now: () => t,
      },
    )
    const body = parsed(res)
    expect(body.status).toBe("processing")
    expect(body.waited_ms).toBeGreaterThan(0)
    expect(body.waited_ms).toBeLessThanOrEqual(45000)
    expect(calls.filter((c) => c.init.method !== "POST").length).toBeGreaterThan(0)
  }, 2000)

  it("clamps wait_seconds above the maximum and returns an error envelope on API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "bad_request", message: "question required" }, 400)),
    )
    const res = await handleAsk(getToken, undefined, { question: "q", wait_seconds: 999 })
    expect((res as any).isError).toBe(true)
    expect(res.content[0].text).toMatch(/HTTP 400/)
  })

  it("rejects an empty question at the MCP layer", async () => {
    const calls = stubSequence([])
    const res = await handleAsk(getToken, undefined, { question: "   " })
    expect((res as any).isError).toBe(true)
    expect(calls).toHaveLength(0)
  })

  /** Sequenced fetch whose GET (but never POST) throws on the nth GET call. */
  function stubGetFailsOnNth(rejectOnNthGet: number) {
    const calls: Call[] = []
    let g = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        if (init.method === "POST")
          return jsonResponse(
            {
              ask_id: ASK,
              status: "processing",
              poll_url: `/v1/ask/${ASK}`,
              conversation_id: CONV,
            },
            202,
          )
        g++
        if (g === rejectOnNthGet)
          throw Object.assign(new Error("aborted"), { name: "TimeoutError" })
        return jsonResponse(PROCESSING)
      }),
    )
    return calls
  }

  it("returns the processing envelope, not an error, when the final poll GET aborts", async () => {
    // wait_seconds: 4 with a 2s poll interval means the 3rd GET lands exactly
    // at the deadline — the one whose ~1s-old budget used to abort.
    const calls = stubGetFailsOnNth(3)
    let t = 0
    const res = await handleAsk(
      getToken,
      undefined,
      { question: "q", wait_seconds: 4 },
      {
        sleep: async (ms) => {
          t += ms
        },
        now: () => t,
      },
    )
    expect((res as any).isError).toBeUndefined()
    const body = parsed(res)
    expect(body.ask_id).toBe(ASK)
    expect(body.status).toBe("processing")
    expect(body.poll_hint).toMatch(/talonic_get_answer/)
    expect(body.waited_ms).toBe(4000)
    expect(calls.filter((c) => c.init.method !== "POST")).toHaveLength(3)
  })

  it("survives a GET that aborts on the very first poll — ask_id still comes back", async () => {
    const calls = stubGetFailsOnNth(1)
    let t = 0
    const res = await handleAsk(
      getToken,
      undefined,
      { question: "q", wait_seconds: 30 },
      {
        sleep: async (ms) => {
          t += ms
        },
        now: () => t,
      },
    )
    expect((res as any).isError).toBeUndefined()
    const body = parsed(res)
    expect(body.ask_id).toBe(ASK)
    expect(body.status).toBe("processing")
    expect(body.waited_ms).toBe(0)
    expect(calls.filter((c) => c.init.method !== "POST")).toHaveLength(1)
  })

  it("still returns a tool error when the initial POST itself rejects (no ask_id exists yet)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        if (init.method === "POST") throw new Error("network down")
        throw new Error("should never GET without an ask_id")
      }),
    )
    const res = await handleAsk(getToken, undefined, { question: "q" })
    expect((res as any).isError).toBe(true)
    expect(res.content[0].text).toMatch(/network down/)
  })

  it("raises the per-poll AbortSignal timeout floor to 5000 ms (was 1000), even with little wait left", async () => {
    stubSequence([PROCESSING])
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout")
    let t = 0
    await handleAsk(
      getToken,
      undefined,
      { question: "q", wait_seconds: 1 },
      {
        sleep: async (ms) => {
          t += ms
        },
        now: () => t,
      },
    )
    // calls[0] is the POST's fixed 15000 ms budget; the rest are the GET polls.
    const pollTimeouts = timeoutSpy.mock.calls.slice(1).map((c) => c[0])
    expect(pollTimeouts.length).toBeGreaterThan(0)
    for (const ms of pollTimeouts) expect(ms).toBeGreaterThanOrEqual(5000)
    timeoutSpy.mockRestore()
  })
})

describe("talonic_get_answer", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("GETs /v1/ask/{id}; adds poll_hint while processing, none when completed", async () => {
    const calls: Call[] = []
    let n = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init })
        return jsonResponse(n++ === 0 ? PROCESSING : DONE)
      }),
    )
    const first = parsed(await handleGetAnswer(getToken, undefined, { ask_id: ASK }))
    expect(calls[0].url).toBe(`https://api.talonic.com/v1/ask/${ASK}`)
    expect(first.poll_hint).toMatch(/talonic_get_answer/)
    const second = parsed(await handleGetAnswer(getToken, undefined, { ask_id: ASK }))
    expect(second.status).toBe("completed")
    expect(second.poll_hint).toBeUndefined()
  })

  it("backfills ask_id from the request args when the body omits it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ status: "processing", conversation_id: CONV })),
    )
    const body = parsed(await handleGetAnswer(getToken, undefined, { ask_id: ASK }))
    expect(body.ask_id).toBe(ASK)
    expect(body.status).toBe("processing")
    expect(body.conversation_id).toBe(CONV)
  })
})
