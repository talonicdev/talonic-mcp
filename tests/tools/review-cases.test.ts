import { afterEach, describe, expect, it, vi } from "vitest"
import { reviewTools, probeReviewAccess } from "../../src/tools/review"
import { casesTools, probeCasesAccess } from "../../src/tools/cases"
import { deriveIdempotencyKey } from "../../src/tools/_idempotency"
import { createServer } from "../../src/server-factory"

const DOC = "11111111-1111-4111-8111-111111111111"
const RUN = "22222222-2222-4222-8222-222222222222"
const ID = "33333333-3333-4333-8333-333333333333"
const VAL = "44444444-4444-4444-8444-444444444444"
const API = "https://api.talonic.com"
const token = () => "tlnc_key"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

/** Stub fetch with one response per call (the last one repeats); returns a call reader. */
function stub(...responses: Array<unknown | Response>) {
  const queue = responses.length ? responses : [{ ok: true }]
  let i = 0
  const fetchMock = vi.fn().mockImplementation(async () => {
    const r = queue[Math.min(i++, queue.length - 1)]
    return r instanceof Response ? r.clone() : jsonResponse(r)
  })
  vi.stubGlobal("fetch", fetchMock)
  return (n = 0) => {
    const [url, init] = fetchMock.mock.calls[n] as [string, RequestInit]
    const headers = new Headers(init.headers)
    return {
      url,
      method: init.method,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      idem: headers.get("idempotency-key"),
      auth: headers.get("authorization"),
      count: fetchMock.mock.calls.length,
    }
  }
}

afterEach(() => vi.unstubAllGlobals())

const review = (name: string) => reviewTools(token).find((t) => t.name === name)!
const cases = (name: string) => casesTools(token).find((t) => t.name === name)!

describe("review tools: method, path and body", () => {
  it.each([
    [
      "talonic_review_list",
      { pipeline_id: RUN, trigger: "gate" },
      "GET",
      `/v1/field-reviews?pipeline_id=${RUN}&trigger=gate`,
      undefined,
    ],
    [
      "talonic_review_claim",
      { pipeline_id: RUN, batch_size: 5 },
      "POST",
      "/v1/field-reviews/checkout",
      { pipeline_id: RUN, batch_size: 5 },
    ],
    [
      "talonic_review_claims",
      { action: "release", items: [{ pipeline_document_id: DOC, field_key: "total" }] },
      "POST",
      "/v1/field-reviews/claims",
      { action: "release", items: [{ pipeline_document_id: DOC, field_key: "total" }] },
    ],
    [
      "talonic_review_assign",
      { pipeline_document_id: DOC, field_key: "net total", assign: true },
      "POST",
      `/v1/field-reviews/${DOC}/net%20total/assign`,
      { assign: true },
    ],
    [
      "talonic_review_inspect",
      { pipeline_document_id: DOC, field_key: "total" },
      "GET",
      `/v1/field-reviews/${DOC}/total/provenance`,
      undefined,
    ],
    [
      "talonic_review_reference_view",
      { pipeline_document_id: DOC },
      "GET",
      `/v1/field-reviews/reference-view/${DOC}`,
      undefined,
    ],
    [
      "talonic_review_resolve",
      {
        pipeline_document_id: DOC,
        field_key: "total",
        action: "correct",
        corrected_value: "12",
        evidence_quote: "Total 12",
        document_id: ID,
      },
      "POST",
      `/v1/field-reviews/${DOC}/total/resolve`,
      { action: "correct", corrected_value: "12", evidence_quote: "Total 12", document_id: ID },
    ],
    [
      "talonic_review_propose_correction",
      { pipeline_document_id: DOC, field_key: "total", proposed_value: "12", reason: "page 2" },
      "POST",
      `/v1/field-reviews/${DOC}/total/reopen`,
      { proposed_value: "12", reason: "page 2", source: "human" },
    ],
    [
      "talonic_review_recommend",
      {
        pipeline_document_id: DOC,
        field_key: "total",
        recommended_action: "approve",
        reason: "matches",
      },
      "POST",
      `/v1/field-reviews/${DOC}/total/recommend`,
      { recommended_action: "approve", reason: "matches" },
    ],
    [
      "talonic_review_decisions",
      { pipeline_id: RUN },
      "GET",
      `/v1/field-reviews/decisions?pipeline_id=${RUN}`,
      undefined,
    ],
    [
      "talonic_review_metrics",
      { pipeline_id: RUN },
      "GET",
      `/v1/field-reviews/metrics?pipeline_id=${RUN}`,
      undefined,
    ],
    [
      "talonic_review_notes",
      { field_key: "total" },
      "GET",
      "/v1/field-review-notes?field_key=total",
      undefined,
    ],
    [
      "talonic_review_add_note",
      { field_key: "total", body: "Use the gross total" },
      "POST",
      "/v1/field-review-notes",
      { field_key: "total", body: "Use the gross total" },
    ],
    [
      "talonic_review_bulk_approve",
      { result_ids: [ID] },
      "POST",
      "/v1/structuring/approvals/bulk-approve",
      { result_ids: [ID] },
    ],
    [
      "talonic_review_compare_sources",
      { decision_id: ID },
      "GET",
      `/v1/structuring/approval-decisions/${ID}/diffs`,
      undefined,
    ],
    [
      "talonic_review_choose_value",
      {
        decision_id: ID,
        field_name: "total",
        canonical_value: "12",
        selection_method: "free_text",
        source_values: [],
      },
      "POST",
      `/v1/structuring/approval-decisions/${ID}/canonical`,
      {
        field_name: "total",
        canonical_value: "12",
        selection_method: "free_text",
        source_values: [],
      },
    ],
    ["talonic_review_list_benchmarks", {}, "GET", "/v1/validation/runs/benchmarks", undefined],
    [
      "talonic_review_list_benchmarks",
      { kind: "checks" },
      "GET",
      "/v1/validation/runs/sessions",
      undefined,
    ],
    [
      "talonic_review_field_accuracy",
      { run_id: RUN, field_name: "total" },
      "GET",
      `/v1/validation/runs/${RUN}/confusion-matrix/total`,
      undefined,
    ],
    [
      "talonic_review_update_expected_value",
      { golden_sample_id: ID, value_id: VAL, expected_value: null },
      "PATCH",
      `/v1/validation/ground-truth/${ID}/values/${VAL}`,
      { expected_value: null },
    ],
    [
      "talonic_review_rematch_golden_sample",
      { golden_sample_id: ID },
      "POST",
      `/v1/validation/ground-truth/${ID}/rematch`,
      undefined,
    ],
    [
      "talonic_review_decide_flags",
      { run_id: RUN, result_id: ID, decision: "accepted" },
      "POST",
      `/v1/validation/runs/${RUN}/judge-accept`,
      { result_id: ID },
    ],
    [
      "talonic_review_decide_flags",
      { run_id: RUN, result_id: ID, decision: "rejected" },
      "POST",
      `/v1/validation/runs/${RUN}/judge-reject`,
      { result_id: ID },
    ],
    [
      "talonic_review_decide_flags",
      { run_id: RUN, decisions: [{ result_id: ID, decision: "accepted" }] },
      "POST",
      `/v1/validation/runs/${RUN}/judge-bulk`,
      { decisions: [{ result_id: ID, decision: "accepted" }] },
    ],
    [
      "talonic_review_flag_progress",
      { run_id: RUN },
      "GET",
      `/v1/validation/runs/${RUN}/judge-progress`,
      undefined,
    ],
  ])("%s %j → %s %s", async (name, args, method, path, body) => {
    const call = stub({ ok: true })
    const res = await review(name).handler(args)
    expect(res.isError).toBeFalsy()
    expect(call().url).toBe(`${API}${path}`)
    expect(call().method).toBe(method)
    expect(call().body).toEqual(body)
    expect(call().auth).toBe("Bearer tlnc_key")
  })
})

describe("cases tools: method, path and body", () => {
  it.each([
    [
      "talonic_cases_list",
      { resolved: true, limit: 10 },
      "GET",
      "/v1/relation-claims/cases?resolved=true&limit=10",
      undefined,
    ],
    ["talonic_cases_get", { case_key: ID }, "GET", `/v1/relation-claims/cases/${ID}`, undefined],
    [
      "talonic_cases_update",
      { case_key: ID, resolved: true },
      "PATCH",
      `/v1/relation-claims/cases/${ID}`,
      { resolved: true },
    ],
    [
      "talonic_cases_narrate",
      { case_key: ID, lang: "de" },
      "POST",
      `/v1/relation-claims/cases/${ID}/narrate`,
      { lang: "de" },
    ],
    [
      "talonic_cases_references_to_review",
      { limit: 5 },
      "GET",
      "/v1/relation-claims/review?limit=5",
      undefined,
    ],
    [
      "talonic_cases_resolve_reference",
      { reference_id: ID, document_id: DOC },
      "POST",
      `/v1/relation-claims/${ID}/resolve`,
      { document_id: DOC },
    ],
    [
      "talonic_cases_reject_reference",
      { reference_id: ID },
      "POST",
      `/v1/relation-claims/${ID}/reject`,
      undefined,
    ],
    ["talonic_cases_missing_documents", {}, "GET", "/v1/relation-claims/missing", undefined],
    [
      "talonic_cases_document_neighbors",
      { document_id: DOC },
      "GET",
      `/v1/case-synthesis/documents/${DOC}/neighbors`,
      undefined,
    ],
    ["talonic_cases_list_templates", {}, "GET", "/v1/cases/templates", undefined],
    [
      "talonic_cases_save_template",
      { name: "Order", expected_document_types: [{ doc_type_name: "Invoice", required: true }] },
      "POST",
      "/v1/cases/templates",
      { name: "Order", expected_document_types: [{ doc_type_name: "Invoice", required: true }] },
    ],
    [
      "talonic_cases_save_template",
      { template_id: ID, match_threshold: 0.8 },
      "PATCH",
      `/v1/cases/templates/${ID}`,
      { match_threshold: 0.8 },
    ],
  ])("%s %j → %s %s", async (name, args, method, path, body) => {
    const call = stub({ ok: true })
    const res = await cases(name).handler(args)
    expect(res.isError).toBeFalsy()
    expect(call().url).toBe(`${API}${path}`)
    expect(call().method).toBe(method)
    expect(call().body).toEqual(body)
  })

  it("creating a template without name or document types is refused before any call", async () => {
    const call = stub({ ok: true })
    const res = await cases("talonic_cases_save_template").handler({ name: "Order" })
    expect(res.isError).toBe(true)
    expect(() => call()).toThrow()
  })
})

describe("Idempotency-Key on writes", () => {
  const resolveArgs = { pipeline_document_id: DOC, field_key: "total", action: "approve" }

  it("a decision write derives a stable key: two identical calls send the same key", async () => {
    const call = stub({ ok: true })
    await review("talonic_review_resolve").handler(resolveArgs)
    await review("talonic_review_resolve").handler({ ...resolveArgs })
    expect(call(0).idem).toMatch(/^mcp-[0-9a-f]{40}$/)
    expect(call(1).idem).toBe(call(0).idem)
    expect(call(0).idem).toBe(deriveIdempotencyKey("talonic_review_resolve", resolveArgs))
  })

  it("different args, or a different tool, derive a different key; key order does not matter", () => {
    const a = deriveIdempotencyKey("talonic_review_resolve", resolveArgs)
    expect(
      deriveIdempotencyKey("talonic_review_resolve", { ...resolveArgs, action: "override" }),
    ).not.toBe(a)
    expect(deriveIdempotencyKey("talonic_review_recommend", resolveArgs)).not.toBe(a)
    expect(
      deriveIdempotencyKey("talonic_review_resolve", {
        action: "approve",
        field_key: "total",
        pipeline_document_id: DOC,
      }),
    ).toBe(a)
  })

  it("an explicit idempotency_key is sent as given and never forwarded in the body", async () => {
    const call = stub({ ok: true })
    await review("talonic_review_resolve").handler({
      ...resolveArgs,
      idempotency_key: "fix-total-1",
    })
    expect(call().idem).toBe("fix-total-1")
    expect(call().body).toEqual({ action: "approve" })
  })

  it.each([
    ["talonic_review_add_note", reviewTools, { field_key: "total", body: "x" }],
    ["talonic_review_bulk_approve", reviewTools, { result_ids: [ID] }],
    [
      "talonic_review_decide_flags",
      reviewTools,
      { run_id: RUN, result_id: ID, decision: "accepted" },
    ],
    ["talonic_cases_update", casesTools, { case_key: ID, resolved: true }],
    ["talonic_cases_resolve_reference", casesTools, { reference_id: ID, document_id: DOC }],
    ["talonic_cases_reject_reference", casesTools, { reference_id: ID }],
  ])("%s derives a key", async (name, set, args) => {
    const call = stub({ ok: true })
    await set(token)
      .find((t) => t.name === name)!
      .handler(args)
    expect(call().idem).toBe(deriveIdempotencyKey(name, args))
  })

  it.each([
    ["talonic_review_claim", reviewTools, { pipeline_id: RUN }],
    [
      "talonic_review_claims",
      reviewTools,
      { action: "touch", items: [{ pipeline_document_id: DOC, field_key: "t" }] },
    ],
    [
      "talonic_review_assign",
      reviewTools,
      { pipeline_document_id: DOC, field_key: "t", assign: true },
    ],
    ["talonic_review_rematch_golden_sample", reviewTools, { golden_sample_id: ID }],
    ["talonic_cases_narrate", casesTools, { case_key: ID }],
  ])(
    "%s sends no key unless one is given (repeating it on purpose works)",
    async (name, set, args) => {
      const call = stub({ ok: true })
      await set(token)
        .find((t) => t.name === name)!
        .handler(args)
      expect(call().idem).toBeNull()
    },
  )

  it("a retry while the first attempt still runs says so plainly", async () => {
    stub(
      jsonResponse(
        { error: "idempotency_request_in_progress", reason: "idempotency_request_in_progress" },
        409,
      ),
    )
    const res = await review("talonic_review_resolve").handler(resolveArgs)
    expect(res.isError).toBe(true)
    expect((res as any).content[0].text).toMatch(/^Still running/)
  })

  it("a reused key on a different request keeps the platform's error", async () => {
    stub(jsonResponse({ error: "idempotency_key_reused" }, 422))
    const res = await review("talonic_review_resolve").handler({
      ...resolveArgs,
      idempotency_key: "k",
    })
    expect((res as any).content[0].text).toContain("idempotency_key_reused")
  })
})

describe("probe gating", () => {
  it("probes the review queue summary and cases with limit=1", async () => {
    const call = stub({ total: 0 })
    expect(await probeReviewAccess("t")).toBe(true)
    expect(call(0).url).toBe(`${API}/v1/field-reviews/summary`)
    expect(await probeCasesAccess("t")).toBe(true)
    expect(call(1).url).toBe(`${API}/v1/relation-claims/cases?limit=1`)
  })

  it("a refused or unreachable probe lists nothing", async () => {
    stub(jsonResponse({}, 403))
    expect(await probeReviewAccess("t")).toBe(false)
    expect(await probeCasesAccess("t")).toBe(false)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch failed")))
    expect(await probeReviewAccess("t")).toBe(false)
  })

  it("the server lists each group only when its flag is set", () => {
    const names = (opts: Record<string, unknown>) =>
      Object.keys((createServer({ apiKey: "tlnc_test", ...opts }) as any)._registeredTools)
    expect(
      names({}).some((n) => n.startsWith("talonic_review_") || n.startsWith("talonic_cases_")),
    ).toBe(false)
    expect(
      names({ includeReviewTools: true }).filter((n) => n.startsWith("talonic_review_")),
    ).toHaveLength(22)
    expect(
      names({ includeCasesTools: true }).filter((n) => n.startsWith("talonic_cases_")),
    ).toHaveLength(11)
  })
})

describe("descriptions", () => {
  const all = [...reviewTools(token), ...casesTools(token)]
  const DENY =
    /\b(model|llm|claude|sonnet|haiku|opus|mistral|embedding|cluster|prompt|n-shot|nshot|tier|ontology|entity graph|pipeline phase)\b/i

  it.each(all.map((t) => [t.name, t]))("%s names its scope and no internal mechanics", (_n, t) => {
    expect(t.description).toMatch(/(reviews|cases):(read|write)/)
    expect(t.description).not.toMatch(DENY)
    if (!t.annotations.readOnlyHint) expect(t.description).toMatch(/:write scope/)
  })
})
