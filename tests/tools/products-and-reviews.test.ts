import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createServer } from "../../src/server-factory"
import { probeDataProductsAccess } from "../../src/tools/data-products"
import { probeDataPoliciesAccess } from "../../src/tools/data-policies"
import { probeWorkspaceDataAccess } from "../../src/tools/workspace-data"
import { probeSchemaReviewAccess } from "../../src/tools/schema-review"

/**
 * The four probe-gated sets over data products, data policies, workspace
 * data (catalog + suggestions) and schema review: gating, description rules,
 * and the exact request every tool builds (method, path, query, body).
 */

type Call = { url: string; init: RequestInit }

const API = "https://api.talonic.com"
const P = "0b7c1c2e-5d1f-4b8a-9c3e-2f6a7d8e9f01"
const R = "7a1e2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b"
const X = "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f"

const SETS = {
  includeDataProductTools: [
    "talonic_data_product_update_definition",
    "talonic_data_product_runs",
    "talonic_data_product_add_run",
    "talonic_data_product_remove_run",
    "talonic_data_product_disagreements",
    "talonic_data_product_resolve_field",
    "talonic_data_product_suggest_resolutions",
    "talonic_data_product_resolve_singles",
    "talonic_data_product_issue_ids",
    "talonic_data_product_regenerate_ids",
    "talonic_data_product_generated_ids",
    "talonic_data_product_sequence_counters",
    "talonic_data_product_set_sequence_counter",
    "talonic_data_product_counter_ids",
  ],
  includeDataPolicyTools: [
    "talonic_data_policy_check",
    "talonic_data_policy_preview",
    "talonic_data_policy_publish",
    "talonic_data_policy_run",
  ],
  includeWorkspaceDataTools: [
    "talonic_catalog_list",
    "talonic_catalog_get",
    "talonic_catalog_rows",
    "talonic_suggestion_questions",
    "talonic_suggestion_answer",
    "talonic_suggestion_mappings",
    "talonic_suggestion_decide_mapping",
    "talonic_suggestion_links",
    "talonic_suggestion_decide_link",
  ],
  includeSchemaReviewTools: [
    "talonic_schema_review_queue",
    "talonic_schema_review_approve",
    "talonic_schema_review_reject",
    "talonic_link_key_set",
  ],
} as const

const build = () =>
  createServer({
    apiKey: "tlnc_test",
    includeDataProductTools: true,
    includeDataPolicyTools: true,
    includeWorkspaceDataTools: true,
    includeSchemaReviewTools: true,
  }) as any

/** For listing checks only: never invoke a handler on it (its fetch is the real one). */
const ALL = build()

function stubFetch(respond: (url: string) => Response = () => Response.json({ ok: true })) {
  const calls: Call[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return respond(url)
    }),
  )
  return calls
}

/** Build the server AFTER stubFetch: it captures the global fetch when created. */
async function invoke(name: string, args: Record<string, unknown>) {
  const tool = build()._registeredTools[name]
  expect(tool, name).toBeDefined()
  const parsed = tool.inputSchema ? await tool.inputSchema.parseAsync(args) : args
  return tool.handler(parsed, {})
}

const bodyOf = (c: Call | undefined) =>
  c?.init.body === undefined ? undefined : JSON.parse(String(c.init.body))

beforeEach(() => vi.restoreAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe("gating", () => {
  it.each(Object.entries(SETS))("%s registers its tools only when set", (flag, names) => {
    const off = createServer({ apiKey: "tlnc_test" }) as any
    const on = createServer({ apiKey: "tlnc_test", [flag]: true }) as any
    for (const name of names) {
      expect(off._registeredTools[name]).toBeUndefined()
      expect(on._registeredTools[name]).toBeDefined()
    }
    expect(Object.keys(on._registeredTools).length - Object.keys(off._registeredTools).length).toBe(
      names.length,
    )
  })

  it.each([
    [probeDataProductsAccess, "/v1/data-products?limit=1"],
    [probeDataPoliciesAccess, "/v1/data-policies?limit=1"],
    [probeWorkspaceDataAccess, "/v1/catalog"],
    [probeSchemaReviewAccess, "/v1/schema-graph/review-queue"],
  ] as const)("probe %# is true on 200, false on 403 or network failure", async (probe, path) => {
    const calls = stubFetch(() => Response.json({ data: [] }))
    expect(await probe("tlnc_x", "https://api.example.test")).toBe(true)
    expect(calls[0]?.url).toBe(`https://api.example.test${path}`)
    expect((calls[0]?.init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer tlnc_x",
    )
    stubFetch(() => Response.json({ error: "insufficient_scope" }, { status: 403 }))
    expect(await probe("tlnc_x")).toBe(false)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    )
    expect(await probe("tlnc_x")).toBe(false)
  })
})

describe("descriptions", () => {
  const names = Object.values(SETS).flat()
  const banned =
    /\b(AI|LLM|model|models|Claude|Anthropic|Bedrock|semantic layer|index|indexes|indices|embedding|cluster|ontolog|prompt|tier|phase|Lua)\b/i

  it.each(names)("%s: non-empty, at most 1500 chars, has NOT FOR and USE WHEN", (name) => {
    const d: string = ALL._registeredTools[name].description
    expect(d.length).toBeGreaterThan(0)
    expect(d.length).toBeLessThanOrEqual(1500)
    expect(d).toContain("NOT FOR")
    expect(d).toContain("USE WHEN")
    // Literal field names in backticks (`index`, `available`) are allowed.
    expect(d.replace(/`[^`]*`/g, "")).not.toMatch(banned)
  })

  it.each([
    "talonic_data_product_add_run",
    "talonic_data_product_remove_run",
    "talonic_data_product_issue_ids",
    "talonic_data_product_regenerate_ids",
    "talonic_data_product_set_sequence_counter",
    ...SETS.includeDataPolicyTools,
    "talonic_link_key_set",
  ])("%s says it needs an Admin of the workspace", (name) => {
    expect(ALL._registeredTools[name].description).toContain("an Admin of the workspace")
  })

  it.each([
    "talonic_data_product_remove_run",
    "talonic_data_product_regenerate_ids",
    "talonic_data_product_set_sequence_counter",
    "talonic_schema_review_reject",
  ])("%s is annotated destructive", (name) => {
    expect(ALL._registeredTools[name].annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    })
  })

  it("update_definition is a write but not destructive", () => {
    expect(
      ALL._registeredTools["talonic_data_product_update_definition"].annotations,
    ).toMatchObject({ readOnlyHint: false, destructiveHint: false })
  })
})

const CASES: Array<[string, Record<string, unknown>, string, string, unknown]> = [
  // Data products
  [
    "talonic_data_product_update_definition",
    {
      data_product_id: P,
      definition: { identity: ["invoice_no"] },
      expected_definition_version: 3,
    },
    "PUT",
    `/v1/data-products/${P}/definition`,
    { definition: { identity: ["invoice_no"] }, expected_definition_version: 3 },
  ],
  [
    "talonic_data_product_runs",
    { data_product_id: P },
    "GET",
    `/v1/data-products/${P}/runs`,
    undefined,
  ],
  [
    "talonic_data_product_add_run",
    { data_product_id: P, run_id: R },
    "POST",
    `/v1/data-products/${P}/runs`,
    { run_id: R },
  ],
  [
    "talonic_data_product_remove_run",
    { data_product_id: P, run_id: R },
    "DELETE",
    `/v1/data-products/${P}/runs/${R}`,
    undefined,
  ],
  [
    "talonic_data_product_disagreements",
    { data_product_id: P },
    "GET",
    `/v1/data-products/${P}/pending-resolutions`,
    undefined,
  ],
  [
    "talonic_data_product_resolve_field",
    {
      data_product_id: P,
      document_id: X,
      field_name: "total",
      canonical_value: "120.00",
      selection_method: "run",
      source_values: [
        { run_id: R, run_name: "A", value: "120.00", confidence: 0.9 },
        { run_id: P, value: "12.00" },
      ],
    },
    "POST",
    `/v1/data-products/${P}/resolve-field`,
    {
      document_id: X,
      field_name: "total",
      canonical_value: "120.00",
      selection_method: "run",
      source_values: [
        { run_id: R, run_name: "A", value: "120.00", confidence: 0.9 },
        { run_id: P, value: "12.00" },
      ],
    },
  ],
  [
    "talonic_data_product_suggest_resolutions",
    { data_product_id: P },
    "POST",
    `/v1/data-products/${P}/auto-review`,
    undefined,
  ],
  [
    "talonic_data_product_resolve_singles",
    { data_product_id: P },
    "POST",
    `/v1/data-products/${P}/auto-resolve-singles`,
    undefined,
  ],
  [
    "talonic_data_product_issue_ids",
    {
      data_product_id: P,
      rules: [
        {
          target_field: "row_id",
          condition: "empty",
          source_field: "country",
          format: "{value}{seq:6}",
        },
      ],
    },
    "POST",
    `/v1/data-products/${P}/apply-id-rules`,
    {
      rules: [
        {
          target_field: "row_id",
          condition: "empty",
          source_field: "country",
          format: "{value}{seq:6}",
        },
      ],
    },
  ],
  [
    "talonic_data_product_regenerate_ids",
    { data_product_id: P },
    "POST",
    `/v1/data-products/${P}/regenerate-ids`,
    undefined,
  ],
  [
    "talonic_data_product_generated_ids",
    { data_product_id: P },
    "GET",
    `/v1/data-products/${P}/generated-ids`,
    undefined,
  ],
  [
    "talonic_data_product_sequence_counters",
    { data_product_id: P },
    "GET",
    `/v1/data-products/${P}/sequence-counters`,
    undefined,
  ],
  [
    "talonic_data_product_set_sequence_counter",
    { data_product_id: P, target_field: "row id", prefix: "DE/", value: 41, scope: "cross" },
    "PATCH",
    `/v1/data-products/${P}/sequence-counters/row%20id/DE%2F`,
    { value: 41, scope: "cross" },
  ],
  [
    "talonic_data_product_counter_ids",
    {
      data_product_id: P,
      target_field: "row_id",
      prefix: "DE",
      scope: "product",
      limit: 20,
      offset: 40,
    },
    "GET",
    `/v1/data-products/${P}/sequence-counters/row_id/DE/ids?scope=product&limit=20&offset=40`,
    undefined,
  ],
  // Data policies
  [
    "talonic_data_policy_check",
    { data_policy_id: P },
    "POST",
    `/v1/data-policies/${P}/compile`,
    undefined,
  ],
  [
    "talonic_data_policy_preview",
    { data_policy_id: P, record_set_id: R, sample_record_id: "rec-7" },
    "POST",
    `/v1/data-policies/${P}/test`,
    { record_set_id: R, sample_record_id: "rec-7" },
  ],
  [
    "talonic_data_policy_publish",
    { data_policy_id: P, expected_version: 4 },
    "POST",
    `/v1/data-policies/${P}/publish`,
    { expected_version: 4 },
  ],
  [
    "talonic_data_policy_run",
    { data_policy_id: P, source_run_id: R, user_schema_id: X },
    "POST",
    `/v1/data-policies/${P}/runs`,
    { source_run_id: R, user_schema_id: X },
  ],
  // Workspace data
  ["talonic_catalog_list", {}, "GET", "/v1/catalog", undefined],
  [
    "talonic_catalog_get",
    { name: "open invoices" },
    "GET",
    "/v1/catalog/open%20invoices",
    undefined,
  ],
  [
    "talonic_catalog_rows",
    { name: "invoices", where: { country: ["DE", "AT"] }, limit: 50, offset: 100 },
    "GET",
    `/v1/catalog/invoices/rows?where=${encodeURIComponent(JSON.stringify({ country: ["DE", "AT"] })).replace(/%20/g, "+")}&limit=50&offset=100`,
    undefined,
  ],
  [
    "talonic_suggestion_questions",
    { status: "open" },
    "GET",
    "/v1/suggestions/questions?status=open",
    undefined,
  ],
  [
    "talonic_suggestion_answer",
    { question_id: P, option: 2 },
    "POST",
    `/v1/suggestions/questions/${P}/answer`,
    { option: 2 },
  ],
  [
    "talonic_suggestion_mappings",
    { status: "suggested", source_id: R, limit: 10, offset: 5 },
    "GET",
    `/v1/suggestions/mappings?status=suggested&source_id=${R}&limit=10&offset=5`,
    undefined,
  ],
  [
    "talonic_suggestion_decide_mapping",
    {
      mapping_id: P,
      action: "retarget",
      proposed: { canonical_name: "iban", data_type: "string" },
    },
    "POST",
    `/v1/suggestions/mappings/${P}/decision`,
    { action: "retarget", proposed: { canonical_name: "iban", data_type: "string" } },
  ],
  [
    "talonic_suggestion_links",
    { status: "confirmed" },
    "GET",
    "/v1/suggestions/links?status=confirmed",
    undefined,
  ],
  [
    "talonic_suggestion_decide_link",
    { link_id: P, action: "reject" },
    "POST",
    `/v1/suggestions/links/${P}/decision`,
    { action: "reject" },
  ],
  // Schema review
  ["talonic_schema_review_queue", {}, "GET", "/v1/schema-graph/review-queue", undefined],
  [
    "talonic_schema_review_approve",
    { diff_id: P },
    "POST",
    `/v1/schema-graph/diffs/${P}/approve`,
    undefined,
  ],
  [
    "talonic_schema_review_reject",
    { diff_id: P },
    "POST",
    `/v1/schema-graph/diffs/${P}/reject`,
    undefined,
  ],
  [
    "talonic_link_key_set",
    { field_id: P, link_key: true, link_key_category: "identity" },
    "PATCH",
    `/v1/linking/link-keys/${P}`,
    { link_key: true, link_key_category: "identity" },
  ],
]

describe("request building", () => {
  it("covers every tool of the four sets", () => {
    expect(new Set(CASES.map((c) => c[0]))).toEqual(new Set(Object.values(SETS).flat()))
  })

  it.each(CASES)("%s → %s %s", async (name, args, method, path, body) => {
    const calls = stubFetch()
    const result = await invoke(name, args)
    expect(result.isError).toBeFalsy()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${API}${path}`)
    expect(calls[0]?.init.method).toBe(method)
    expect(new Headers(calls[0]?.init.headers).get("authorization")).toBe("Bearer tlnc_test")
    expect(bodyOf(calls[0])).toEqual(body)
  })

  it("optional fields are left out of the body when absent", async () => {
    const calls = stubFetch()
    await invoke("talonic_data_product_update_definition", { data_product_id: P, definition: {} })
    await invoke("talonic_data_product_issue_ids", { data_product_id: P })
    await invoke("talonic_data_policy_publish", { data_policy_id: P })
    await invoke("talonic_data_policy_preview", { data_policy_id: P, record_set_id: R })
    await invoke("talonic_link_key_set", { field_id: P, link_key: false })
    expect(calls.map(bodyOf)).toEqual([
      { definition: {} },
      {},
      {},
      { record_set_id: R },
      { link_key: false },
    ])
  })

  it("catalog_rows passes a `where` string through unchanged", async () => {
    const calls = stubFetch()
    await invoke("talonic_catalog_rows", { name: "invoices", where: '{"country":"DE"}' })
    expect(new URL(calls[0]!.url).searchParams.get("where")).toBe('{"country":"DE"}')
  })

  it("renders a 409 revision_conflict as a tool error", async () => {
    stubFetch(() =>
      Response.json(
        { error: { code: "revision_conflict", message: "changed since you read it" } },
        { status: 409 },
      ),
    )
    const result = await invoke("talonic_data_policy_publish", {
      data_policy_id: P,
      expected_version: 1,
    })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain("revision_conflict")
  })

  it("rejects an out-of-range option and a non-uuid id before calling the API", async () => {
    const tool = ALL._registeredTools["talonic_suggestion_answer"]
    await expect(tool.inputSchema.parseAsync({ question_id: P, option: 21 })).rejects.toThrow()
    await expect(tool.inputSchema.parseAsync({ question_id: "x", option: 1 })).rejects.toThrow()
  })
})
