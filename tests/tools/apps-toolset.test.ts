import { afterEach, describe, expect, it, vi } from "vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { createServer } from "../../src/server-factory"
import { APPS_TOOLSET_TOOLS, probeAppsToolsetAccess } from "../../src/tools/apps-toolset"

const APP = "11111111-1111-4111-8111-111111111111"
const RUN = "22222222-2222-4222-8222-222222222222"
const REVIEW = "33333333-3333-4333-8333-333333333333"

interface Call {
  method: string
  path: string
  query: Record<string, string>
  body: any
  auth: string | null
}

/** Route-table fetch stub: `"METHOD /path"` → response body (or [status, body]). */
function stubApi(routes: Record<string, unknown | [number, unknown]>) {
  const calls: Call[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(String(input))
      const method = init.method ?? "GET"
      calls.push({
        method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        body: init.body ? JSON.parse(String(init.body)) : undefined,
        auth: new Headers(init.headers).get("authorization"),
      })
      const hit = routes[`${method} ${url.pathname}`]
      if (hit === undefined) return new Response('{"message":"no route"}', { status: 404 })
      const [status, body] = Array.isArray(hit) ? hit : [200, hit]
      return new Response(JSON.stringify(body), {
        status: status as number,
        headers: { "content-type": "application/json" },
      })
    }),
  )
  return calls
}

async function connect() {
  const server = createServer({ apiKey: "tlnc_test", includeAppsToolset: true })
  const client = new Client({ name: "t", version: "1" })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(a), client.connect(b)])
  const call = async (name: string, args: Record<string, unknown>) => {
    const res = (await client.callTool({ name, arguments: args })) as any
    return { isError: res.isError === true, data: res.structuredContent ?? res.content?.[0]?.text }
  }
  return { client, call }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("Apps toolset gating", () => {
  it("is not listed unless the probe passed", () => {
    const off = Object.keys((createServer({ apiKey: "tlnc_test" }) as any)._registeredTools)
    for (const name of APPS_TOOLSET_TOOLS) expect(off).not.toContain(name)
    const on = Object.keys(
      (createServer({ apiKey: "tlnc_test", includeAppsToolset: true }) as any)._registeredTools,
    )
    for (const name of APPS_TOOLSET_TOOLS) expect(on).toContain(name)
    expect(APPS_TOOLSET_TOOLS).toHaveLength(25)
  })

  it("probe: 200 on /v1/apps lists, a refusal does not, a 5xx is unknown", async () => {
    stubApi({ "GET /v1/apps": { apps: [] } })
    expect(await probeAppsToolsetAccess("t")).toBe(true)
    stubApi({ "GET /v1/apps": [403, {}] })
    expect(await probeAppsToolsetAccess("t")).toBe(false)
    stubApi({ "GET /v1/apps": [503, {}] })
    expect(await probeAppsToolsetAccess("t")).toBe("unknown")
  })

  it("marks reads read-only and changes as writes", () => {
    const t = (createServer({ apiKey: "tlnc_test", includeAppsToolset: true }) as any)
      ._registeredTools
    for (const n of [
      "talonic_get_app",
      "talonic_get_app_logic",
      "talonic_list_app_runs",
      "talonic_get_run_verdicts",
      "talonic_list_app_reviews",
      "talonic_check_app_acceptance",
    ])
      expect(t[n].annotations.readOnlyHint, n).toBe(true)
    for (const n of [
      "talonic_create_app",
      "talonic_save_app_draft",
      "talonic_publish_app",
      "talonic_run_app",
      "talonic_resolve_app_review",
      "talonic_disable_app",
    ])
      expect(t[n].annotations.readOnlyHint, n).toBe(false)
  })

  it("descriptions name no internal mechanics", () => {
    const t = (createServer({ apiKey: "tlnc_test", includeAppsToolset: true }) as any)
      ._registeredTools
    for (const n of APPS_TOOLSET_TOOLS) {
      const d = t[n].description as string
      expect(d, n).not.toMatch(/\b(LLM|GPT|Claude|Anthropic|OpenAI|model|prompt|embedding)s?\b/i)
    }
  })
})

describe("Apps toolset: each tool hits the verified platform route", () => {
  it.each([
    ["talonic_get_app", { app_id: APP }, "GET", `/v1/apps/${APP}`, undefined],
    [
      "talonic_create_app",
      { slug: "freight-check", display_name: "Freight check", mode: "autonomous" },
      "POST",
      "/v1/apps",
      { slug: "freight-check", display_name: "Freight check", mode: "autonomous" },
    ],
    [
      "talonic_save_app_draft",
      { app_id: APP, content: { mode: "rules" } },
      "PATCH",
      `/v1/apps/${APP}`,
      { content: { mode: "rules" } },
    ],
    ["talonic_list_app_versions", { app_id: APP }, "GET", `/v1/apps/${APP}/versions`, undefined],
    [
      "talonic_publish_app",
      { app_id: APP, version: 3 },
      "POST",
      `/v1/apps/${APP}/versions/3/publish`,
      undefined,
    ],
    ["talonic_enable_app", { app_id: APP }, "POST", `/v1/apps/${APP}/enable`, undefined],
    ["talonic_disable_app", { app_id: APP }, "POST", `/v1/apps/${APP}/disable`, undefined],
    ["talonic_get_app_logic", { app_id: APP }, "GET", `/v1/apps/${APP}/logic`, undefined],
    ["talonic_get_app_fields", { app_id: APP }, "GET", `/v1/apps/${APP}/logic/fields`, undefined],
    [
      "talonic_interpret_app_rules",
      { app_id: APP, card_ids: ["c1"], guidance: "city is in shipper_city", locale: "de" },
      "POST",
      `/v1/apps/${APP}/logic/compile`,
      { card_ids: ["c1"], guidance: "city is in shipper_city", locale: "de" },
    ],
    [
      "talonic_propose_app_edit",
      { app_id: APP, instruction: "pause the weight rule" },
      "POST",
      `/v1/apps/${APP}/edit-proposals`,
      { instruction: "pause the weight rule" },
    ],
    [
      "talonic_apply_app_edit",
      { app_id: APP, ops: [{ op: "pause", card_id: "c1" }] },
      "POST",
      `/v1/apps/${APP}/edit-proposals/apply`,
      { ops: [{ op: "pause", card_id: "c1" }] },
    ],
    ["talonic_get_app_acceptance", { app_id: APP }, "GET", `/v1/apps/${APP}/acceptance`, undefined],
    [
      "talonic_save_app_acceptance",
      { app_id: APP, cases: [{ expected_decision: "approve" }], tolerance: 0.1 },
      "PUT",
      `/v1/apps/${APP}/acceptance`,
      { cases: [{ expected_decision: "approve" }], tolerance: 0.1 },
    ],
    [
      "talonic_run_app",
      { app_id: APP, input: { a: 1 }, dry_run: true, idempotency_key: "k1" },
      "POST",
      `/v1/apps/${APP}/runs`,
      { input: { a: 1 }, dry_run: true, idempotency_key: "k1" },
    ],
    ["talonic_get_run_record", { run_id: RUN }, "GET", `/v1/runs/${RUN}/record`, undefined],
    [
      "talonic_raise_app_review",
      {
        app_id: APP,
        kind: "judgment",
        question: "Is this a duplicate?",
        input_contract: { type: "object" },
        team_id: REVIEW,
      },
      "POST",
      `/v1/apps/${APP}/reviews`,
      {
        kind: "judgment",
        question: "Is this a duplicate?",
        input_contract: { type: "object" },
        team_id: REVIEW,
      },
    ],
    [
      "talonic_resolve_app_review",
      { review_id: REVIEW, values: { duplicate: true }, feedback: { proposal_verdict: "partial" } },
      "POST",
      `/v1/reviews/${REVIEW}/resolve`,
      { values: { duplicate: true }, feedback: { proposal_verdict: "partial" } },
    ],
    [
      "talonic_interview_app_review",
      { review_id: REVIEW, message: "yes", transcript: [{ role: "assistant", text: "dup?" }] },
      "POST",
      `/v1/reviews/${REVIEW}/interview`,
      { message: "yes", transcript: [{ role: "assistant", text: "dup?" }] },
    ],
  ])("%s → %s %s", async (name, args, method, path, body) => {
    const calls = stubApi({ [`${method} ${path}`]: { ok: true } })
    const { call, client } = await connect()
    const res = await call(name, args)
    expect(res.isError, JSON.stringify(res.data)).toBe(false)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.method).toBe(method)
    expect(calls[0]!.path).toBe(path)
    expect(calls[0]!.body).toEqual(body)
    expect(calls[0]!.auth).toBe("Bearer tlnc_test")
    await client.close()
  })

  it("lists runs and reviews with offset paging; reviews always go to the paged inbox", async () => {
    const calls = stubApi({
      [`GET /v1/apps/${APP}/runs`]: { runs: [], total: 0 },
      "GET /v1/reviews": { reviews: [], total: 0 },
    })
    const { call, client } = await connect()
    await call("talonic_list_app_runs", { app_id: APP, limit: 10, offset: 20 })
    await call("talonic_list_app_reviews", { app_id: APP, status: "open", limit: 5, offset: 5 })
    expect(calls[0]!.query).toEqual({ limit: "10", offset: "20" })
    expect(calls[1]!.path).toBe("/v1/reviews")
    expect(calls[1]!.query).toEqual({ app_id: APP, status: "open", limit: "5", offset: "5" })
    await client.close()
  })

  it("passes verdict filters and serializes precedent match keys", async () => {
    const calls = stubApi({
      [`GET /v1/runs/${RUN}/verdicts`]: { summary: {}, verdicts: [], next: null },
      [`GET /v1/apps/${APP}/precedents`]: { precedents: [] },
    })
    const { call, client } = await connect()
    await call("talonic_get_run_verdicts", {
      run_id: RUN,
      rolled: "failed",
      auto: false,
      rule: "r1",
      status: "failed",
      cursor: "abc",
    })
    await call("talonic_list_app_precedents", { app_id: APP, similar_to: { carrier: "DHL" } })
    expect(calls[0]!.query).toEqual({
      rolled: "failed",
      auto: "false",
      rule: "r1",
      status: "failed",
      cursor: "abc",
    })
    expect(calls[1]!.query).toEqual({ similar_to: '{"carrier":"DHL"}' })
    await client.close()
  })

  it("get_app_run adds the journal only when asked", async () => {
    const calls = stubApi({
      [`GET /v1/runs/${RUN}`]: { id: RUN, status: "completed" },
      [`GET /v1/runs/${RUN}/events`]: { events: [{ type: "run.started" }] },
    })
    const { call, client } = await connect()
    const plain = await call("talonic_get_app_run", { run_id: RUN })
    expect(plain.data).toEqual({ id: RUN, status: "completed" })
    const withEvents = await call("talonic_get_app_run", { run_id: RUN, include_events: true })
    expect(withEvents.data).toEqual({
      run: { id: RUN, status: "completed" },
      events: [{ type: "run.started" }],
    })
    expect(calls.map((c) => c.path)).toEqual([
      `/v1/runs/${RUN}`,
      `/v1/runs/${RUN}`,
      `/v1/runs/${RUN}/events`,
    ])
    await client.close()
  })

  it("rejects an app_… public id and an old verdict enum at the MCP layer", async () => {
    const calls = stubApi({})
    const { call, client } = await connect()
    expect((await call("talonic_get_app", { app_id: "app_abc" })).isError).toBe(true)
    expect(
      (
        await call("talonic_resolve_app_review", {
          review_id: REVIEW,
          values: {},
          feedback: { proposal_verdict: "partially_correct" },
        })
      ).isError,
    ).toBe(true)
    expect(calls).toHaveLength(0)
    await client.close()
  })

  it("surfaces the platform's refusal with a next step (approval reviews are human-only)", async () => {
    stubApi({
      [`POST /v1/reviews/${REVIEW}/resolve`]: [
        403,
        { message: "approval reviews need a human resolver", code: "INSUFFICIENT_PERMISSIONS" },
      ],
    })
    const { call, client } = await connect()
    const res = await call("talonic_resolve_app_review", { review_id: REVIEW, values: { ok: 1 } })
    expect(res.isError).toBe(true)
    expect(String(res.data)).toMatch(/HTTP 403/)
    expect(String(res.data)).toMatch(/human resolver/)
    expect(String(res.data)).toMatch(/Next step/)
    await client.close()
  })
})

describe("acceptance: an agent builds, validates, runs, inspects and gets a review answered", () => {
  it("create draft → interpret → publish → dry run → inspect → acceptance → raise + resolve review → read the result", async () => {
    const calls = stubApi({
      "POST /v1/apps": { id: APP, app_id: "app_x", slug: "freight-check", enabled: false },
      [`PATCH /v1/apps/${APP}`]: { version: 1, status: "draft", content_hash: "h1" },
      [`POST /v1/apps/${APP}/logic/compile`]: {
        cards: [{ id: "c1", state: "ready" }],
        warnings: [],
      },
      [`POST /v1/apps/${APP}/versions/1/publish`]: { version: 1, status: "published" },
      [`POST /v1/apps/${APP}/runs`]: { run_id: RUN, status: "completed", decision: { ok: false } },
      [`GET /v1/runs/${RUN}`]: { id: RUN, status: "completed", decision: { ok: false } },
      [`PUT /v1/apps/${APP}/acceptance`]: { acceptance: { cases: 1 } },
      [`GET /v1/apps/${APP}/acceptance/check`]: { score: 1, pass: true, mismatches: [] },
      [`POST /v1/apps/${APP}/reviews`]: { id: REVIEW, status: "open", kind: "judgment" },
      [`POST /v1/reviews/${REVIEW}/resolve`]: {
        id: REVIEW,
        status: "resolved",
        values: { ok: true },
      },
      "GET /v1/reviews": {
        reviews: [{ id: REVIEW, status: "resolved", values: { ok: true } }],
        total: 1,
      },
    })
    const { call, client } = await connect()
    const ok = async (name: string, args: Record<string, unknown>) => {
      const r = await call(name, args)
      expect(r.isError, `${name}: ${JSON.stringify(r.data)}`).toBe(false)
      return r.data as any
    }

    const app = await ok("talonic_create_app", {
      slug: "freight-check",
      display_name: "Freight check",
      mode: "rules",
    })
    const draft = await ok("talonic_save_app_draft", {
      app_id: app.id,
      content: { logic: { kind: "rules", cards: [{ sentence: "Weight under 30 kg" }] } },
    })
    const compiled = await ok("talonic_interpret_app_rules", { app_id: app.id })
    expect(compiled.warnings).toEqual([])
    await ok("talonic_publish_app", { app_id: app.id, version: draft.version })
    const run = await ok("talonic_run_app", { app_id: app.id, input: {}, dry_run: true })
    const got = await ok("talonic_get_app_run", { run_id: run.run_id })
    expect(got.decision).toEqual({ ok: false })
    await ok("talonic_save_app_acceptance", {
      app_id: app.id,
      cases: [{ expected_decision: "reject" }],
    })
    const check = await ok("talonic_check_app_acceptance", { app_id: app.id, run_id: run.run_id })
    expect(check.pass).toBe(true)
    const review = await ok("talonic_raise_app_review", {
      app_id: app.id,
      run_id: run.run_id,
      kind: "judgment",
      question: "Accept this shipment?",
      input_contract: { type: "object", properties: { ok: { type: "boolean" } } },
    })
    const resolved = await ok("talonic_resolve_app_review", {
      review_id: review.id,
      values: { ok: true },
    })
    expect(resolved.status).toBe("resolved")
    const inbox = await ok("talonic_list_app_reviews", { app_id: app.id, status: "resolved" })
    expect(inbox.reviews[0].values).toEqual({ ok: true })

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /v1/apps",
      `PATCH /v1/apps/${APP}`,
      `POST /v1/apps/${APP}/logic/compile`,
      `POST /v1/apps/${APP}/versions/1/publish`,
      `POST /v1/apps/${APP}/runs`,
      `GET /v1/runs/${RUN}`,
      `PUT /v1/apps/${APP}/acceptance`,
      `GET /v1/apps/${APP}/acceptance/check`,
      `POST /v1/apps/${APP}/reviews`,
      `POST /v1/reviews/${REVIEW}/resolve`,
      "GET /v1/reviews",
    ])
    expect(calls.every((c) => c.auth === "Bearer tlnc_test")).toBe(true)
    await client.close()
  })
})
