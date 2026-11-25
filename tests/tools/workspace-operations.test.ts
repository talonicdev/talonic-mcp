import { afterEach, describe, expect, it, vi } from "vitest"
import { createServer as createHttpServer } from "node:http"
import type { AddressInfo } from "node:net"
import { createServer } from "../../src/server-factory"
import { createRequestHandler, operationsAccessCached } from "../../src/http-server"
import {
  OPERATIONS_FAMILIES,
  OPERATIONS_TOOLS,
  probeOperationsFamilies,
  type OperationsFamily,
} from "../../src/tools/workspace-operations"
import { parseRoute, routeArgs } from "../../src/tools/_route-tools"
import { batchMetadataCsv } from "../../src/tools/document-organising"

const API = "https://api.talonic.com"
const PIPE = "11111111-1111-4111-8111-111111111111"
const DOC = "22222222-2222-4222-8222-222222222222"
const DOC2 = "33333333-3333-4333-8333-333333333333"
const RUN = "44444444-4444-4444-8444-444444444444"
const HOLD = "55555555-5555-4555-8555-555555555555"
const COLL = "66666666-6666-4666-8666-666666666666"
const ITEM = "77777777-7777-4777-8777-777777777777"
const TYPE = "88888888-8888-4888-8888-888888888888"

const ALL: OperationsFamily[] = OPERATIONS_FAMILIES.map((f) => f.key)

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function stub(body: unknown = { ok: true }, status = 200) {
  const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(body, status))
  vi.stubGlobal("fetch", fetchMock)
  return {
    fetchMock,
    call: (n = 0) => {
      const [url, init] = fetchMock.mock.calls[n] as [string, RequestInit]
      return {
        url: String(url),
        method: init.method,
        body:
          typeof init.body === "string"
            ? JSON.parse(init.body)
            : (init.body as FormData | undefined),
        auth: new Headers(init.headers).get("authorization"),
      }
    },
  }
}

const tools = (families: readonly OperationsFamily[] = ALL) =>
  (createServer({ apiKey: "tlnc_test", operationsFamilies: families }) as any)._registeredTools

const names = (families?: readonly OperationsFamily[]) =>
  Object.keys(tools(families))
    .filter((n) => OPERATIONS_TOOLS.some((t) => t.name === n))
    .sort()

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/**
 * Every tool: the arguments, then the exact method, URL and JSON body the
 * platform receives. One row per tool, so a renamed route or a dropped body
 * key fails here.
 */
const CASES: Array<[string, Record<string, unknown>, string, string, unknown?]> = [
  // Pipelines
  [
    "talonic_pipeline_add_documents",
    { pipeline_id: PIPE, document_ids: [DOC, DOC2] },
    "POST",
    `/v1/pipelines/${PIPE}/documents`,
    { document_ids: [DOC, DOC2] },
  ],
  [
    "talonic_pipeline_documents",
    {
      pipeline_id: PIPE,
      page: 2,
      limit: 50,
      status: ["error", "completed"],
      tags: ["a", "b"],
      flagged: true,
      sort_by: "field:total",
      sort_dir: "desc",
      run_id: "none",
      ids: [DOC],
    },
    "GET",
    `/v1/pipelines/${PIPE}/documents?page=2&limit=50&status=error%2Ccompleted&tags=a%2Cb&flagged=true&sort_by=field%3Atotal&sort_dir=desc&run_id=none&ids=${DOC}`,
  ],
  [
    "talonic_pipeline_runs",
    { pipeline_id: PIPE, q: "abc" },
    "GET",
    `/v1/pipelines/${PIPE}/runs?q=abc`,
  ],
  ["talonic_pipeline_start", { pipeline_id: PIPE }, "POST", `/v1/pipelines/${PIPE}/start`, {}],
  [
    "talonic_pipeline_retry_errored",
    { pipeline_id: PIPE },
    "POST",
    `/v1/pipelines/${PIPE}/retry-errored`,
    {},
  ],
  [
    "talonic_pipeline_retriage",
    { pipeline_id: PIPE, review_config: { mode: "all" } },
    "POST",
    `/v1/pipelines/${PIPE}/retriage`,
    { review_config: { mode: "all" } },
  ],
  [
    "talonic_pipeline_field_states",
    { pipeline_id: PIPE, run_document_id: DOC },
    "GET",
    `/v1/pipelines/${PIPE}/documents/${DOC}/field-states`,
  ],
  [
    "talonic_pipeline_cell_history",
    { pipeline_id: PIPE, document_ids: [DOC, DOC2] },
    "GET",
    `/v1/pipelines/${PIPE}/cell-history?document_ids=${DOC}%2C${DOC2}`,
  ],
  [
    "talonic_pipeline_assembly_groups",
    { pipeline_id: PIPE },
    "GET",
    `/v1/pipelines/${PIPE}/assembly/groups`,
  ],
  [
    "talonic_pipeline_needs_anchor",
    { pipeline_id: PIPE },
    "GET",
    `/v1/pipelines/${PIPE}/assembly/needs-anchor`,
  ],
  [
    "talonic_pipeline_resolve_anchor",
    { pipeline_id: PIPE, group_key: "PO-1", anchor_document_id: DOC },
    "POST",
    `/v1/pipelines/${PIPE}/assembly/resolve-anchor`,
    { group_key: "PO-1", anchor_document_id: DOC },
  ],
  [
    "talonic_pipeline_rerun_assembly",
    { pipeline_id: PIPE },
    "POST",
    `/v1/pipelines/${PIPE}/assembly/rerun`,
    {},
  ],
  ["talonic_pipeline_rule_holds", { pipeline_id: PIPE }, "GET", `/v1/pipelines/${PIPE}/rule-holds`],
  [
    "talonic_pipeline_override_hold",
    { pipeline_id: PIPE, run_id: RUN, hold_id: HOLD, reason: "Checked by finance" },
    "POST",
    `/v1/pipelines/${PIPE}/runs/${RUN}/business-rule-holds/${HOLD}/override`,
    { reason: "Checked by finance" },
  ],
  [
    "talonic_pipeline_reconciliation_cases",
    { pipeline_id: PIPE },
    "GET",
    `/v1/pipelines/${PIPE}/reconciliation-cases`,
  ],
  [
    "talonic_pipeline_export_reconciliation_cases",
    { pipeline_id: PIPE },
    "GET",
    `/v1/pipelines/${PIPE}/reconciliation-cases/export`,
  ],
  // Ingest
  ["talonic_ingest_queue_status", {}, "GET", "/v1/extract/queue-status"],
  ["talonic_ingest_duplicates", {}, "GET", "/v1/extract/dedup/stats"],
  ["talonic_ingest_skipped_duplicates", {}, "GET", "/v1/extract/dedup/audit-log"],
  [
    "talonic_ingest_process_duplicate",
    { existing_document_id: DOC, filename: "copy.pdf", tags: ["x"] },
    "POST",
    "/v1/extract/dedup/process-anyway",
    { existing_document_id: DOC, filename: "copy.pdf", tags: ["x"] },
  ],
  ["talonic_ingest_settings", {}, "GET", "/v1/settings/ingest-stages"],
  [
    "talonic_ingest_update_settings",
    { delivery: false, triage: true },
    "PATCH",
    "/v1/settings/ingest-stages",
    { triage: true, delivery: false },
  ],
  // Document organising
  ["talonic_documents_tags", {}, "GET", "/v1/documents/tags"],
  ["talonic_documents_system_tags", {}, "GET", "/v1/documents/system-tags"],
  ["talonic_documents_facets", {}, "GET", "/v1/documents/facets"],
  [
    "talonic_documents_batch_tag",
    { document_ids: [DOC], tags: ["q3"], mode: "set" },
    "PATCH",
    "/v1/documents/batch-tag",
    { document_ids: [DOC], tags: ["q3"], mode: "set" },
  ],
  [
    "talonic_documents_set_tags",
    { document_id: DOC, tags: [] },
    "PATCH",
    `/v1/documents/${DOC}/tags`,
    { tags: [] },
  ],
  ["talonic_documents_display_name_rule", {}, "GET", "/v1/documents/display-name-rule"],
  [
    "talonic_documents_set_display_name_rule",
    { mode: "lua", script: "record:set('display_name', record.filename)" },
    "PATCH",
    "/v1/documents/display-name-rule",
    { mode: "lua", script: "record:set('display_name', record.filename)" },
  ],
  [
    "talonic_documents_preview_display_name_rule",
    { lua_script: "x", sample_size: 10 },
    "POST",
    "/v1/documents/display-name-rule/preview",
    { lua_script: "x", sample_size: 10 },
  ],
  [
    "talonic_documents_generate_display_name_script",
    { instruction: "drop the leading number" },
    "POST",
    "/v1/documents/display-name-rule/generate-script",
    { instruction: "drop the leading number" },
  ],
  [
    "talonic_documents_display_name_coverage",
    {},
    "GET",
    "/v1/documents/display-name-rule/coverage",
  ],
  [
    "talonic_documents_backfill_display_names",
    {},
    "POST",
    "/v1/documents/display-name-rule/backfill",
    {},
  ],
  // Collections
  ["talonic_collections_list", {}, "GET", "/v1/collections"],
  [
    "talonic_collections_create",
    { name: "Acme", kind: "account", aliases: ["Acme GmbH"] },
    "POST",
    "/v1/collections",
    { name: "Acme", kind: "account", aliases: ["Acme GmbH"] },
  ],
  [
    "talonic_collections_preview",
    { collection_id: COLL },
    "GET",
    `/v1/collections/${COLL}/preview`,
  ],
  [
    "talonic_collections_update",
    { collection_id: COLL, description: "All Acme files" },
    "PATCH",
    `/v1/collections/${COLL}`,
    { description: "All Acme files" },
  ],
  ["talonic_collections_delete", { collection_id: COLL }, "DELETE", `/v1/collections/${COLL}`],
  ["talonic_collections_rules", { collection_id: COLL }, "GET", `/v1/collections/${COLL}/rules`],
  [
    "talonic_collections_add_rule",
    { collection_id: COLL, rule_type: "document_type", rule_value: TYPE },
    "POST",
    `/v1/collections/${COLL}/rules`,
    { rule_type: "document_type", rule_value: TYPE },
  ],
  [
    "talonic_collections_remove_rule",
    { collection_id: COLL, rule_id: ITEM },
    "DELETE",
    `/v1/collections/${COLL}/rules/${ITEM}`,
  ],
  [
    "talonic_collections_documents",
    { collection_id: COLL },
    "GET",
    `/v1/collections/${COLL}/documents`,
  ],
  [
    "talonic_collections_add_documents",
    { collection_id: COLL, document_ids: [DOC] },
    "POST",
    `/v1/collections/${COLL}/documents`,
    { document_ids: [DOC] },
  ],
  [
    "talonic_collections_remove_document",
    { collection_id: COLL, document_id: DOC },
    "DELETE",
    `/v1/collections/${COLL}/documents/${DOC}`,
  ],
  [
    "talonic_collections_assignments",
    { collection_id: COLL },
    "GET",
    `/v1/collections/${COLL}/assignments`,
  ],
  [
    "talonic_collections_assign",
    { collection_id: COLL, principal_type: "group", principal_id: ITEM, mode: "enforced" },
    "POST",
    `/v1/collections/${COLL}/assignments`,
    { principal_type: "group", principal_id: ITEM, mode: "enforced" },
  ],
  [
    "talonic_collections_unassign",
    { collection_id: COLL, assignment_id: ITEM },
    "DELETE",
    `/v1/collections/${COLL}/assignments/${ITEM}`,
  ],
  // Saved filters
  [
    "talonic_saved_filters_list",
    { source_id: ITEM },
    "GET",
    `/v1/search/saved-filters?source_id=${ITEM}`,
  ],
  [
    "talonic_saved_filters_create",
    { name: "Open invoices", conditions: [{ field: "status", operator: "eq", value: "open" }] },
    "POST",
    "/v1/search/saved-filters",
    { name: "Open invoices", conditions: [{ field: "status", operator: "eq", value: "open" }] },
  ],
  [
    "talonic_saved_filters_delete",
    { filter_id: ITEM },
    "DELETE",
    `/v1/search/saved-filters/${ITEM}`,
  ],
  // Document types
  ["talonic_document_types_list", {}, "GET", "/v1/document-types"],
  [
    "talonic_document_types_create",
    { name: "Bill of lading" },
    "POST",
    "/v1/document-types",
    { name: "Bill of lading" },
  ],
  [
    "talonic_document_types_update",
    { type_id: TYPE, name: "Freight invoice" },
    "PATCH",
    `/v1/document-types/${TYPE}`,
    { name: "Freight invoice" },
  ],
  ["talonic_document_types_pending", {}, "GET", "/v1/document-types/pending-confirmations"],
  [
    "talonic_document_types_resolve_pending",
    { proposal_id: ITEM, action: "merge", merge_into_type_id: TYPE },
    "POST",
    `/v1/document-types/pending-confirmations/${ITEM}/resolve`,
    { action: "merge", merge_into_type_id: TYPE },
  ],
  [
    "talonic_document_types_resolve_pending_batch",
    { items: [{ id: ITEM, action: "create" }] },
    "POST",
    "/v1/document-types/pending-confirmations/resolve-batch",
    { items: [{ id: ITEM, action: "create" }] },
  ],
  [
    "talonic_document_types_merge_pending",
    { pending_ids: [ITEM, TYPE], chosen_name: "Invoice" },
    "POST",
    "/v1/document-types/pending-confirmations/merge-pending",
    { pending_ids: [ITEM, TYPE], chosen_name: "Invoice" },
  ],
  [
    "talonic_document_types_auto_resolve",
    {},
    "POST",
    "/v1/document-types/pending-confirmations/auto-resolve",
    {},
  ],
  [
    "talonic_document_types_dismiss_pending",
    { proposal_id: ITEM },
    "DELETE",
    `/v1/document-types/pending-confirmations/${ITEM}`,
  ],
]

describe("workspace operation tools: listing", () => {
  it("are not listed without a passing probe", () => {
    expect(names([])).toEqual([])
    const plain = Object.keys((createServer({ apiKey: "tlnc_test" }) as any)._registeredTools)
    for (const t of OPERATIONS_TOOLS) expect(plain).not.toContain(t.name)
  })

  it.each(OPERATIONS_FAMILIES.map((f) => [f.key, f] as const))(
    "family %s lists exactly its own tools",
    (key, family) => {
      expect(names([key])).toEqual(family.tools.map((t) => t.name).sort())
    },
  )

  it("lists every tool with every family on, without name collisions", () => {
    const all = OPERATIONS_TOOLS.map((t) => t.name)
    expect(new Set(all).size).toBe(all.length)
    expect(names()).toEqual([...all].sort())
    expect(all.length).toBe(60)
  })

  it("has one mapping case per tool (the multipart import has its own)", () => {
    expect(CASES.map((c) => c[0]).sort()).toEqual(
      OPERATIONS_TOOLS.map((t) => t.name)
        .filter((n) => n !== "talonic_documents_import_batch_ids")
        .sort(),
    )
  })
})

describe("workspace operation tools: contracts", () => {
  it.each(OPERATIONS_TOOLS.map((t) => [t.name, t] as const))("%s", (_name, t) => {
    expect(t.name).toMatch(
      /^talonic_(pipeline|ingest|documents|collections|saved_filters|document_types)_[a-z_]+$/,
    )
    const { method, path } = parseRoute(t.route)
    expect(path.startsWith("/v1/")).toBe(true)
    for (const arg of routeArgs(t.route)) expect(Object.keys(t.input)).toContain(arg)
    for (const k of [...(t.query ?? []), ...(t.body ?? [])])
      expect(Object.keys(t.input)).toContain(k)
    if (method === "GET") expect(t.annotations.readOnlyHint).toBe(true)
    if (method === "DELETE") expect(t.annotations.destructiveHint).toBe(true)
    if (t.annotations.readOnlyHint) expect(t.annotations.destructiveHint).toBe(false)
    expect(t.annotations.openWorldHint).toBe(false)
    if (!t.annotations.readOnlyHint) expect(t.description).toContain("insufficient_scope")
  })

  it("marks the overwriting operations destructive", () => {
    const t = tools()
    for (const n of [
      "talonic_pipeline_retriage",
      "talonic_pipeline_rerun_assembly",
      "talonic_documents_batch_tag",
      "talonic_documents_set_tags",
      "talonic_documents_set_display_name_rule",
      "talonic_documents_backfill_display_names",
      "talonic_collections_delete",
      "talonic_collections_remove_rule",
      "talonic_collections_remove_document",
      "talonic_collections_unassign",
      "talonic_saved_filters_delete",
      "talonic_document_types_dismiss_pending",
    ])
      expect(t[n].annotations.destructiveHint, n).toBe(true)
    for (const n of ["talonic_pipeline_start", "talonic_pipeline_add_documents"])
      expect(t[n].annotations.destructiveHint, n).toBe(false)
  })

  it("public wording names no internal mechanics", () => {
    const banned =
      /\b(LLM|model call|embedding|cluster|ontolog|semantic|prompt|n-shot|tier|phase|Lua|OCR|vendor|Claude|Anthropic|index(es)?)\b/i
    for (const t of OPERATIONS_TOOLS) {
      const text = [
        t.title,
        t.description,
        ...Object.values(t.input).map((s) => s.description ?? ""),
      ].join(" ")
      // `lua` is a literal mode value and `lua_script` a field name; nothing else may say Lua.
      const scrubbed = text.replace(/`lua`|lua_script/g, "")
      expect(scrubbed, t.name).not.toMatch(banned)
    }
  })
})

describe("workspace operation tools: route, verb and body", () => {
  it.each(CASES)("%s", async (name, args, method, path, body) => {
    const { call } = stub()
    const res = await tools()[name].handler(args)
    expect(res.isError, JSON.stringify(res)).toBeFalsy()
    const c = call()
    expect(c.method).toBe(method)
    expect(c.url).toBe(`${API}${path}`)
    expect(c.auth).toBe("Bearer tlnc_test")
    if (body === undefined) expect(c.body).toBeUndefined()
    else expect(c.body).toEqual(body)
  })

  it("process_duplicate sends idempotency_key as the Idempotency-Key header, never in the body", async () => {
    const { fetchMock, call } = stub()
    const t = tools()
    await t.talonic_ingest_process_duplicate.handler({
      existing_document_id: DOC,
      idempotency_key: "retry-1",
    })
    await t.talonic_ingest_process_duplicate.handler({ existing_document_id: DOC })
    const h = (n: number) =>
      new Headers((fetchMock.mock.calls[n] as [string, RequestInit])[1].headers)
    expect(h(0).get("idempotency-key")).toBe("retry-1")
    expect(call(0).body).toEqual({ existing_document_id: DOC })
    expect(h(0).get("authorization")).toBe("Bearer tlnc_test")
    expect(h(1).get("idempotency-key")).toBeNull()
  })

  it("collections_list and document_types_pending pick their route from an argument", async () => {
    const { call } = stub()
    const t = tools()
    await t.talonic_collections_list.handler({ view: "mine" })
    await t.talonic_collections_list.handler({ view: "counts" })
    await t.talonic_document_types_pending.handler({ count_only: true })
    expect([call(0).url, call(1).url, call(2).url]).toEqual([
      `${API}/v1/collections/mine`,
      `${API}/v1/collections/counts`,
      `${API}/v1/document-types/pending-confirmations/count`,
    ])
  })

  it("renders a 403 refusal with its next step", async () => {
    stub({ error: { code: "forbidden", reason: "insufficient_role" } }, 403)
    const res = await tools().talonic_collections_create.handler({ name: "X" })
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toContain("HTTP 403")
    expect(res.content[0].text).toContain("insufficient_role")
    expect(res.content[0].text).toContain("Next step")
  })
})

describe("workspace operation tools: refused before calling", () => {
  it.each([
    ["talonic_ingest_update_settings", {}],
    ["talonic_collections_update", { collection_id: COLL }],
    ["talonic_document_types_update", { type_id: TYPE }],
    ["talonic_documents_set_display_name_rule", { mode: "lua" }],
    ["talonic_document_types_resolve_pending", { proposal_id: ITEM, action: "merge" }],
    ["talonic_document_types_resolve_pending_batch", { items: [{ id: ITEM, action: "merge" }] }],
    ["talonic_documents_import_batch_ids", {}],
    [
      "talonic_documents_import_batch_ids",
      { csv: "a,b", rows: [{ document_id: "a", batch_id: "b" }] },
    ],
    ["talonic_pipeline_start", {}],
  ] as Array<[string, Record<string, unknown>]>)("%s %j", async (name, args) => {
    const { fetchMock } = stub()
    const res = await tools()[name].handler(args)
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toMatch(/^Validation error:/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("talonic_documents_import_batch_ids", () => {
  it("sends rows as a CSV file under the multipart `file` field", async () => {
    const { call } = stub({ updated: 1, not_found: [] })
    const res = await tools().talonic_documents_import_batch_ids.handler({
      rows: [
        { document_id: "invoice-001.pdf", batch_id: "B-7" },
        { document_id: 'odd, "name"', batch_id: "B-8" },
      ],
    })
    expect(res.isError).toBeFalsy()
    const c = call()
    expect(c.method).toBe("POST")
    expect(c.url).toBe(`${API}/v1/documents/batch-metadata/import`)
    const form = c.body as FormData
    const file = form.get("file") as File
    expect(file.name).toBe("batch-metadata.csv")
    expect(file.type).toBe("text/csv")
    expect(await file.text()).toBe('document_id,batch_id\ninvoice-001.pdf,B-7\n"odd, ""name""",B-8')
  })

  it("passes CSV text through unchanged", () => {
    expect(batchMetadataCsv({ csv: "document_id,batch_id\nx,y" })).toBe("document_id,batch_id\nx,y")
  })
})

describe("probes", () => {
  it("each family asks one read of its own, and lists only the 2xx families", async () => {
    const ok = new Set(["/v1/collections", "/v1/pipelines"])
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const u = new URL(url)
      if (u.pathname === "/v1/documents/tags") return jsonResponse({}, 503)
      return jsonResponse({}, ok.has(u.pathname) ? 200 : 403)
    })
    vi.stubGlobal("fetch", fetchMock)
    expect(await probeOperationsFamilies("tok")).toEqual(["pipelines", "collections"])
    const urls = fetchMock.mock.calls.map((c) => String(c[0])).sort()
    expect(urls).toEqual(
      [
        `${API}/v1/collections`,
        `${API}/v1/document-types/pending-confirmations/count`,
        `${API}/v1/documents/tags`,
        `${API}/v1/extract/queue-status`,
        `${API}/v1/pipelines?limit=1`,
        `${API}/v1/search/saved-filters`,
        `${API}/v1/settings/ingest-stages`,
      ].sort(),
    )
    for (const c of fetchMock.mock.calls)
      expect(new Headers((c[1] as RequestInit).headers).get("authorization")).toBe("Bearer tok")
  })

  it("the hosted cache asks once per token and family within its lifetime", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string) =>
        jsonResponse({}, new URL(url).pathname === "/v1/search/saved-filters" ? 200 : 404),
      )
    vi.stubGlobal("fetch", fetchMock)
    expect(await operationsAccessCached("cache-tok-1")).toEqual(["saved_filters"])
    expect(await operationsAccessCached("cache-tok-1")).toEqual(["saved_filters"])
    expect(fetchMock).toHaveBeenCalledTimes(OPERATIONS_FAMILIES.length)
  })

  it("the hosted tools/list shows only the families the probe passed", async () => {
    const server = createHttpServer(
      createRequestHandler({
        growthAccess: async () => false,
        adminAgentTaskAccess: async () => false,
        contractsAccess: async () => false,
        apAccess: async () => false,
        docGenAccess: async () => false,
        partiesAccess: async () => false,
        masterRecordsAccess: async () => false,
        submissionsAccess: async () => false,
        priceBaselineAccess: async () => false,
        portfolioAccess: async () => false,
        processesAccess: async () => false,
        agentTasksAccess: async () => false,
        decisionTasksAccess: async () => false,
        operationsAccess: async () => ["document_types"],
        tokenAccepted: async () => true,
      }),
    )
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
    const { port } = server.address() as AddressInfo
    try {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: "POST",
        headers: {
          Authorization: "Bearer tlnc_test",
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
      })
      const text = await res.text()
      expect(text).toContain("talonic_document_types_auto_resolve")
      expect(text).not.toContain("talonic_collections_list")
      expect(text).not.toContain("talonic_pipeline_start")
    } finally {
      server.closeAllConnections()
      await new Promise<void>((r) => server.close(() => r()))
    }
  })
})
