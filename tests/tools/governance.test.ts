import { afterEach, describe, expect, it, vi } from "vitest"
import {
  GOVERNANCE_PROBES,
  probeRecordsAdminAccess,
  probeTeamAdminAccess,
  probeWorkspaceAccess,
  recordsToolRows,
  teamToolRows,
  workspaceToolRows,
} from "../../src/tools/governance"
import { createServer } from "../../src/server-factory"

const token = () => "tlnc_key"
const ID = "11111111-2222-4333-8444-555555555555"

function stub(body: unknown = {}, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  )
  vi.stubGlobal("fetch", fetchMock)
  return () => {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    return { url, method: init.method, body: init.body ? JSON.parse(String(init.body)) : undefined }
  }
}

afterEach(() => vi.unstubAllGlobals())

const rows = [...teamToolRows(token), ...recordsToolRows(token), ...workspaceToolRows(token)]
const byName = new Map(rows.map((r) => [r[0], r]))

/** Every tool, the arguments used here, and the exact call it must make. */
const CASES: Array<[string, Record<string, unknown>, string, string]> = [
  ["talonic_team_list_members", {}, "GET", "/v1/team/members"],
  ["talonic_team_list_pending", {}, "GET", "/v1/team/pending"],
  ["talonic_team_approve_member", { user_id: ID }, "POST", `/v1/team/members/${ID}/approve`],
  ["talonic_team_reject_member", { user_id: ID }, "POST", `/v1/team/members/${ID}/reject`],
  ["talonic_team_invite_member", { email: "a@b.co", role: "member" }, "POST", "/v1/team/invite"],
  ["talonic_team_preview_access", { user_id: ID }, "POST", `/v1/team/access/preview/${ID}`],
  ["talonic_team_list_roles", {}, "GET", "/v1/team/roles"],
  ["talonic_team_list_groups", {}, "GET", "/v1/team/groups"],
  [
    "talonic_team_propose_access_change",
    { kind: "change_role", member: "a@b.co", role: "viewer" },
    "POST",
    "/v1/team/access/proposals",
  ],
  [
    "talonic_team_confirm_access_change",
    { proposal_id: ID },
    "POST",
    `/v1/team/access/proposals/${ID}/confirm`,
  ],
  [
    "talonic_team_cancel_access_change",
    { proposal_id: ID },
    "POST",
    `/v1/team/access/proposals/${ID}/cancel`,
  ],
  ["talonic_team_access_activity", {}, "GET", "/v1/team/access/activity"],
  ["talonic_records_list_retention_policies", {}, "GET", "/v1/records/retention-policies"],
  [
    "talonic_records_create_retention_policy",
    { name: "7y", duration_days: 2555 },
    "POST",
    "/v1/records/retention-policies",
  ],
  ["talonic_records_list_dispositions", {}, "GET", "/v1/records/dispositions"],
  ["talonic_records_list_legal_holds", {}, "GET", "/v1/records/legal-holds"],
  [
    "talonic_records_create_legal_hold",
    { name: "Q3", scope_type: "tenant" },
    "POST",
    "/v1/records/legal-holds",
  ],
  [
    "talonic_records_add_hold_documents",
    { hold_id: ID, document_ids: [ID] },
    "POST",
    `/v1/records/legal-holds/${ID}/documents`,
  ],
  [
    "talonic_records_list_audit_events",
    { action: "legal_hold.created" },
    "GET",
    "/v1/records/audit-events?action=legal_hold.created",
  ],
  ["talonic_records_verify_audit_log", {}, "GET", "/v1/records/audit-events/verify"],
  ["talonic_records_list_erasure_requests", {}, "GET", "/v1/records/erasure-requests"],
  [
    "talonic_records_create_erasure_request",
    { subject_label: "Ada", subject_terms: ["Ada"] },
    "POST",
    "/v1/records/erasure-requests",
  ],
  [
    "talonic_records_get_erasure_request",
    { request_id: ID },
    "GET",
    `/v1/records/erasure-requests/${ID}`,
  ],
  ["talonic_records_storage_usage", {}, "GET", "/v1/records/storage-usage"],
  ["talonic_workspace_billing", {}, "GET", "/v1/billing"],
  ["talonic_workspace_buy_credits_link", { pack: "50" }, "GET", "/v1/billing/upgrade-link?pack=50"],
  ["talonic_workspace_billing_portal_link", {}, "POST", "/v1/billing/portal"],
  [
    "talonic_workspace_create_support_ticket",
    { category: "question", message: "hi" },
    "POST",
    "/v1/support/tickets",
  ],
  ["talonic_workspace_deletion_status", {}, "GET", "/v1/workspace/deletion"],
  ["talonic_workspace_cancel_deletion", {}, "DELETE", "/v1/workspace/deletion"],
]

describe("governance tools", () => {
  it("covers every tool in the table", () => {
    expect(CASES.map((c) => c[0]).sort()).toEqual([...byName.keys()].sort())
  })

  it.each(CASES)("%s calls the platform route", async (name, args, method, path) => {
    const call = stub({ ok: true })
    const res = await byName.get(name)![5](args)
    expect(res.isError).toBeFalsy()
    expect(call()).toMatchObject({ method, url: `https://api.talonic.com${path}` })
  })

  it("surfaces a platform refusal as a tool error", async () => {
    stub({ error: "forbidden", reason: "insufficient_role", message: "needs team" }, 403)
    const res = await byName.get("talonic_team_list_pending")![5]({})
    expect(res.isError).toBe(true)
  })

  it("marks the access confirmation destructive and every read read-only", () => {
    expect(byName.get("talonic_team_confirm_access_change")![4].destructiveHint).toBe(true)
    for (const [name, , , , ann] of rows) {
      if (
        /_list_|_get_|_status$|_storage_usage$|_verify_|_activity$|_preview_access$|_billing$/.test(
          name,
        )
      ) {
        expect([name, ann.readOnlyHint]).toEqual([name, true])
      }
    }
  })

  it("offers no tool that destroys data, releases a hold or edits access in one step", () => {
    const forbidden =
      /release|approve_disposition|execute|erase$|export|schedule_deletion|remove_member|change_role|set_permissions/
    expect([...byName.keys()].filter((n) => forbidden.test(n))).toEqual([])
  })

  it("registers each group only when asked (probe passed)", () => {
    const names = (opts: object) =>
      Object.keys((createServer({ apiKey: "tlnc_test", ...opts }) as any)._registeredTools)
    const gov = (n: string) => /^talonic_(team|records|workspace)_/.test(n)
    expect(names({}).filter(gov)).toEqual([])
    expect(names({ includeTeamAdminTools: true }).filter(gov)).toHaveLength(
      teamToolRows(token).length,
    )
    expect(names({ includeRecordsAdminTools: true }).filter(gov)).toHaveLength(
      recordsToolRows(token).length,
    )
    expect(names({ includeWorkspaceTools: true }).filter(gov)).toHaveLength(
      workspaceToolRows(token).length,
    )
  })

  it("probes the route whose permission the group needs", async () => {
    for (const [probe, path] of [
      [probeTeamAdminAccess, GOVERNANCE_PROBES.team],
      [probeRecordsAdminAccess, GOVERNANCE_PROBES.records],
      [probeWorkspaceAccess, GOVERNANCE_PROBES.workspace],
    ] as const) {
      const call = stub([])
      expect(await probe("tlnc_key")).toBe(true)
      expect(call().url).toBe(`https://api.talonic.com${path}`)
      vi.unstubAllGlobals()
      stub({ reason: "insufficient_role" }, 403)
      expect(await probe("tlnc_key")).toBe(false)
      vi.unstubAllGlobals()
    }
  })
})
