import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handleApplyEdit,
  handleCheckAcceptance,
  handleGetAppFields,
  handleGetAppLogic,
  handleGetRunVerdicts,
  handleInterpretRules,
  handleInterviewReview,
  handleProposeEdit,
  handleSaveAcceptance,
} from "../../src/tools/apps-builder"

const APP_ID = "33333333-3333-4333-8333-333333333333"
const RUN_ID = "44444444-4444-4444-8444-444444444444"
const REVIEW_ID = "55555555-5555-4555-8555-555555555555"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function call(fetchMock: ReturnType<typeof vi.fn>, index = 0): [string, RequestInit] {
  return fetchMock.mock.calls[index] as [string, RequestInit]
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("apps builder handlers", () => {
  it("reads logic and fields with the bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ draft: null, active: null }))
    vi.stubGlobal("fetch", fetchMock)
    await handleGetAppLogic(() => "tok", undefined, { app_id: APP_ID })
    await handleGetAppFields(() => "tok", undefined, { app_id: APP_ID })
    const [logicUrl, init] = call(fetchMock, 0)
    const [fieldsUrl] = call(fetchMock, 1)
    expect(new URL(logicUrl).pathname).toBe(`/v1/apps/${APP_ID}/logic`)
    expect(new URL(fieldsUrl).pathname).toBe(`/v1/apps/${APP_ID}/logic/fields`)
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok")
  })

  it("interprets rules with card ids and guidance, omitting empties", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ cards: [], warnings: [] }))
    vi.stubGlobal("fetch", fetchMock)
    await handleInterpretRules(() => "tok", undefined, {
      app_id: APP_ID,
      card_ids: ["c1"],
      guidance: "the city lives in shipper_city_state",
    })
    await handleInterpretRules(() => "tok", undefined, { app_id: APP_ID })
    const [, init1] = call(fetchMock, 0)
    const [, init2] = call(fetchMock, 1)
    expect(JSON.parse(init1.body as string)).toEqual({
      card_ids: ["c1"],
      guidance: "the city lives in shipper_city_state",
    })
    expect(JSON.parse(init2.body as string)).toEqual({})
  })

  it("proposes and applies edits against the edit-proposals routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ops: [] }))
    vi.stubGlobal("fetch", fetchMock)
    await handleProposeEdit(() => "tok", undefined, {
      app_id: APP_ID,
      instruction: "pause the signature rule",
    })
    await handleApplyEdit(() => "tok", undefined, {
      app_id: APP_ID,
      ops: [{ op: "pause_rule", card_id: "c1" }],
    })
    const [proposeUrl, proposeInit] = call(fetchMock, 0)
    const [applyUrl] = call(fetchMock, 1)
    expect(new URL(proposeUrl).pathname).toBe(`/v1/apps/${APP_ID}/edit-proposals`)
    expect(proposeInit.method).toBe("POST")
    expect(new URL(applyUrl).pathname).toBe(`/v1/apps/${APP_ID}/edit-proposals/apply`)
  })

  it("interview posts the message with the client-held transcript", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ reply: "ok", ready: false }))
    vi.stubGlobal("fetch", fetchMock)
    await handleInterviewReview(() => "tok", undefined, {
      review_id: REVIEW_ID,
      message: "approve it",
      transcript: [{ role: "assistant", text: "What should happen?" }],
    })
    const [url, init] = call(fetchMock)
    expect(new URL(url).pathname).toBe(`/v1/reviews/${REVIEW_ID}/interview`)
    expect(JSON.parse(init.body as string).transcript).toHaveLength(1)
  })

  it("saves the acceptance set with PUT and checks with the optional run id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ acceptance: {} }))
    vi.stubGlobal("fetch", fetchMock)
    await handleSaveAcceptance(() => "tok", undefined, {
      app_id: APP_ID,
      cases: [{ subject_key: "L1", expected_outcome: "passed", expected_auto: true }],
      tolerance: 0.1,
    })
    await handleCheckAcceptance(() => "tok", undefined, { app_id: APP_ID, run_id: RUN_ID })
    await handleCheckAcceptance(() => "tok", undefined, { app_id: APP_ID })
    const [saveUrl, saveInit] = call(fetchMock, 0)
    const [checkUrl] = call(fetchMock, 1)
    const [checkNoRun] = call(fetchMock, 2)
    expect(saveInit.method).toBe("PUT")
    expect(new URL(saveUrl).pathname).toBe(`/v1/apps/${APP_ID}/acceptance`)
    expect(JSON.parse(saveInit.body as string).tolerance).toBe(0.1)
    expect(new URL(checkUrl).searchParams.get("run_id")).toBe(RUN_ID)
    expect(new URL(checkNoRun).searchParams.get("run_id")).toBeNull()
  })

  it("verdicts pass the matrix filters through", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ verdicts: [] }))
    vi.stubGlobal("fetch", fetchMock)
    await handleGetRunVerdicts(() => "tok", undefined, {
      run_id: RUN_ID,
      rolled: "failed",
      auto: false,
      limit: 100,
    })
    const [url] = call(fetchMock)
    const parsed = new URL(url)
    expect(parsed.pathname).toBe(`/v1/runs/${RUN_ID}/verdicts`)
    expect(parsed.searchParams.get("rolled")).toBe("failed")
    expect(parsed.searchParams.get("auto")).toBe("false")
  })

  it("surfaces API failures as tool errors, never throws", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "no acceptance set" }, 409))
    vi.stubGlobal("fetch", fetchMock)
    const result = await handleCheckAcceptance(() => "tok", undefined, { app_id: APP_ID })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("409")
  })
})
