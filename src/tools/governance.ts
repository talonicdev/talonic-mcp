import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, probeAccessState, runTool, type ProbeAnswer } from "./_http.js"
import type { ToolResult } from "./_shared.js"

/**
 * Workspace administration tools: team and access (`talonic_team_*`),
 * records management (`talonic_records_*`) and workspace account tools
 * (`talonic_workspace_*`: billing, support, the scheduled deletion).
 *
 * Every tool calls `/v1` with the caller's bearer and the platform owns every
 * rule: the credential needs the matching scope, and the person behind it
 * (the OAuth user or the key's creator) needs the permission the web app
 * asks for. A credential never exceeds that person; nobody changes their own
 * role or permissions.
 *
 * Deliberately NOT tools (web app or REST only): direct role / permission
 * edits and member removal (agents use the two-step proposal tools), releasing
 * legal holds, approving dispositions, approving or executing erasure,
 * starting a workspace export and scheduling workspace deletion. Those destroy
 * or disclose data at workspace level and can require the person's own
 * step-up code.
 *
 * Each group is registered only when its probe passes for the credential, so
 * people without the permission never list tools that would answer 403. The
 * probe is listing UX, never the security boundary.
 */

type Args = Record<string, unknown>
type Handler = (args: Args) => Promise<ToolResult>
type ToolRow = [
  name: string,
  title: string,
  description: string,
  schema: z.ZodRawShape,
  annotations: Annotations,
  handler: Handler,
]
interface Annotations {
  readOnlyHint: boolean
  destructiveHint: boolean
  idempotentHint: boolean
  openWorldHint: boolean
}

const readOnly: Annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}
const write = (idempotent: boolean, destructive = false): Annotations => ({
  readOnlyHint: false,
  destructiveHint: destructive,
  idempotentHint: idempotent,
  openWorldHint: false,
})

const uuid = (what: string) => z.string().uuid().describe(what)
const desc = (lines: string[]) => lines.join("\n")
const enc = encodeURIComponent

function call(
  getToken: () => string,
  baseUrl: string | undefined,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  opts: { params?: Record<string, string | number | boolean | undefined>; body?: unknown } = {},
) {
  return runTool(() => apiJson(getToken, baseUrl, method, path, opts))
}

const PERMISSIONS = [
  "export",
  "ingest",
  "edit",
  "review_complex",
  "run",
  "team",
  "integrations",
  "billing",
  "data",
  "workspace",
  "process_view",
  "process_build",
  "process_publish",
  "process_run",
  "process_sign",
  "process_govern",
] as const
const ROLES = ["owner", "senior_member", "member", "viewer", "none"] as const

// ── Team ───────────────────────────────────────────────────────────

/** The `talonic_team_*` tool rows. @internal */
export function teamToolRows(getToken: () => string, baseUrl?: string): ToolRow[] {
  return [
    [
      "talonic_team_list_members",
      "List workspace members",
      desc([
        "Every member of the workspace with role and status (and permissions, when you may manage the team).",
        "USE WHEN: answering who is in the workspace or finding a member's id before a change.",
        "RETURNS: members[] { user_id, email, name, role, status, permissions? }.",
      ]),
      {},
      readOnly,
      () => call(getToken, baseUrl, "GET", "/v1/team/members"),
    ],
    [
      "talonic_team_list_pending",
      "List people waiting to join",
      desc([
        "People who asked to join the workspace and wait for approval.",
        "NEXT: talonic_team_approve_member or talonic_team_reject_member.",
      ]),
      {},
      readOnly,
      () => call(getToken, baseUrl, "GET", "/v1/team/pending"),
    ],
    [
      "talonic_team_approve_member",
      "Approve a person waiting to join",
      desc([
        "Admits one person who asked to join. They get the role they asked for, never more than you hold.",
        "ARGS: `user_id` from talonic_team_list_pending.",
      ]),
      { user_id: uuid("The waiting person's user id.") },
      write(true),
      (a) => call(getToken, baseUrl, "POST", `/v1/team/members/${enc(String(a.user_id))}/approve`),
    ],
    [
      "talonic_team_reject_member",
      "Decline a request to join",
      desc([
        "Declines one request to join the workspace.",
        "ARGS: `user_id` from talonic_team_list_pending.",
      ]),
      { user_id: uuid("The waiting person's user id.") },
      write(true),
      (a) => call(getToken, baseUrl, "POST", `/v1/team/members/${enc(String(a.user_id))}/reject`),
    ],
    [
      "talonic_team_invite_member",
      "Invite a member",
      desc([
        "Invites a person by e-mail with a role. A role may hold only permissions you hold yourself.",
        "ARGS: `email`, `role` owner|senior_member|member|viewer.",
      ]),
      {
        email: z.string().email().describe("The person's e-mail."),
        role: z.enum(ROLES).describe("Their role in the workspace."),
      },
      write(false),
      (a) =>
        call(getToken, baseUrl, "POST", "/v1/team/invite", {
          body: { email: a.email, role: a.role },
        }),
    ],
    [
      "talonic_team_preview_access",
      "Show a member's current access",
      desc([
        "What one member holds right now: role, permissions, custom role and groups. Changes nothing.",
        "USE WHEN: before proposing an access change, or to answer what someone may do.",
      ]),
      { user_id: uuid("The member's user id.") },
      readOnly,
      (a) => call(getToken, baseUrl, "POST", `/v1/team/access/preview/${enc(String(a.user_id))}`),
    ],
    [
      "talonic_team_list_roles",
      "List custom roles",
      "The roles this workspace defined itself, each with its base role and permissions.",
      {},
      readOnly,
      () => call(getToken, baseUrl, "GET", "/v1/team/roles"),
    ],
    [
      "talonic_team_list_groups",
      "List member groups",
      "The workspace's groups of members.",
      {},
      readOnly,
      () => call(getToken, baseUrl, "GET", "/v1/team/groups"),
    ],
    [
      "talonic_team_propose_access_change",
      "Propose an access change",
      desc([
        "Shows exactly what a change would change (before and after) and stores it as a proposal. Changes no access; the proposal expires if not confirmed.",
        "USE WHEN: a person asks to change someone's role, permissions or group membership. Show them the before and after, then confirm only on their go-ahead.",
        "ARGS: `kind` set_permissions|reset_permissions|change_role|group_add|group_remove, `member` (e-mail or id), and `grant` / `revoke` (permissions), `role` or `group` as the kind needs.",
        "RETURNS: a proposal { id, summary, before, after } or a refusal with its reason (for example a change to your own access).",
        "NEXT: talonic_team_confirm_access_change or talonic_team_cancel_access_change.",
      ]),
      {
        kind: z.enum([
          "set_permissions",
          "reset_permissions",
          "change_role",
          "group_add",
          "group_remove",
        ]),
        member: z.string().min(1).describe("The member's e-mail or user id."),
        grant: z
          .array(z.enum(PERMISSIONS))
          .optional()
          .describe("Permissions to add (set_permissions)."),
        revoke: z
          .array(z.enum(PERMISSIONS))
          .optional()
          .describe("Permissions to take away (set_permissions)."),
        role: z.enum(ROLES).optional().describe("The new role (change_role)."),
        group: z.string().optional().describe("Group name or id (group_add, group_remove)."),
      },
      write(false),
      (a) => call(getToken, baseUrl, "POST", "/v1/team/access/proposals", { body: a }),
    ],
    [
      "talonic_team_confirm_access_change",
      "Confirm an access change",
      desc([
        "Makes a proposed access change after checking it again against the current state and your permissions. Only the person who proposed it can confirm it; every outcome is recorded in the audit log.",
        "Call only after the person saw the proposal's before and after and agreed.",
        "ARGS: `proposal_id` from talonic_team_propose_access_change.",
      ]),
      { proposal_id: uuid("The proposal id.") },
      write(false, true),
      (a) =>
        call(
          getToken,
          baseUrl,
          "POST",
          `/v1/team/access/proposals/${enc(String(a.proposal_id))}/confirm`,
        ),
    ],
    [
      "talonic_team_cancel_access_change",
      "Cancel an access proposal",
      "Cancels one of your access proposals; nothing changes.",
      { proposal_id: uuid("The proposal id.") },
      write(true),
      (a) =>
        call(
          getToken,
          baseUrl,
          "POST",
          `/v1/team/access/proposals/${enc(String(a.proposal_id))}/cancel`,
        ),
    ],
    [
      "talonic_team_access_activity",
      "Recent access changes",
      "The latest access changes, confirmations and refusals recorded in this workspace.",
      {},
      readOnly,
      () => call(getToken, baseUrl, "GET", "/v1/team/access/activity"),
    ],
  ]
}

// ── Records ────────────────────────────────────────────────────────

/** The `talonic_records_*` tool rows. @internal */
export function recordsToolRows(getToken: () => string, baseUrl?: string): ToolRow[] {
  return [
    [
      "talonic_records_list_retention_policies",
      "List retention policies",
      "The workspace's retention policies: how long documents are kept and what happens when that time ends.",
      {},
      readOnly,
      () => call(getToken, baseUrl, "GET", "/v1/records/retention-policies"),
    ],
    [
      "talonic_records_create_retention_policy",
      "Create a retention policy",
      desc([
        "Creates a retention policy. Expiry never destroys anything: a document whose retention ends waits for a person's disposition decision.",
        "ARGS: `name`, `duration_days`, `event_trigger` ingest_date|document_date, `disposition_action` review_then_destroy|retain_indefinitely, optional `description`, `grace_period_days`.",
      ]),
      {
        name: z.string().min(1),
        description: z.string().optional(),
        duration_days: z.number().int().min(1).optional(),
        event_trigger: z.enum(["ingest_date", "document_date"]).optional(),
        grace_period_days: z.number().int().min(0).optional(),
        disposition_action: z.enum(["review_then_destroy", "retain_indefinitely"]).optional(),
      },
      write(false),
      (a) => call(getToken, baseUrl, "POST", "/v1/records/retention-policies", { body: a }),
    ],
    [
      "talonic_records_list_dispositions",
      "Documents waiting for a disposition decision",
      desc([
        "Documents whose retention ended and that wait for a person's decision. This is the preview of what retention would destroy; nothing is destroyed until a person approves it in the web app.",
      ]),
      { state: z.string().optional().describe("Default pending_disposition.") },
      readOnly,
      (a) =>
        call(getToken, baseUrl, "GET", "/v1/records/dispositions", {
          params: { state: a.state as string | undefined },
        }),
    ],
    [
      "talonic_records_list_legal_holds",
      "List legal holds",
      "Legal holds and what they cover. Nothing an active hold covers can be deleted, disposed of or erased.",
      { status: z.enum(["active", "released"]).optional() },
      readOnly,
      (a) =>
        call(getToken, baseUrl, "GET", "/v1/records/legal-holds", {
          params: { status: a.status as string | undefined },
        }),
    ],
    [
      "talonic_records_create_legal_hold",
      "Place a legal hold",
      desc([
        "Places a legal hold on the whole workspace, one source, or a set of documents. From then on nothing it covers can be destroyed. Releasing a hold is done by a person in the web app.",
        "ARGS: `name`, `scope_type` tenant|source_connection|document_set, `scope_source_connection_id` (source_connection), `document_ids` (document_set), optional `case_reference`, `custodian`, `reason`.",
      ]),
      {
        name: z.string().min(1),
        scope_type: z.enum(["tenant", "source_connection", "document_set"]),
        scope_source_connection_id: z.string().uuid().optional(),
        document_ids: z.array(z.string().uuid()).optional(),
        case_reference: z.string().optional(),
        custodian: z.string().optional(),
        reason: z.string().optional(),
      },
      write(false),
      (a) => call(getToken, baseUrl, "POST", "/v1/records/legal-holds", { body: a }),
    ],
    [
      "talonic_records_add_hold_documents",
      "Add documents to a legal hold",
      "Adds documents to a document-set legal hold.",
      { hold_id: uuid("The hold id."), document_ids: z.array(z.string().uuid()).min(1) },
      write(true),
      (a) =>
        call(
          getToken,
          baseUrl,
          "POST",
          `/v1/records/legal-holds/${enc(String(a.hold_id))}/documents`,
          { body: { document_ids: a.document_ids } },
        ),
    ],
    [
      "talonic_records_list_audit_events",
      "Read the audit log",
      desc([
        "Reads the tamper-evident audit log. An action taken through the API names the person as actor and the API key or app under context.via.",
        "ARGS: optional `from`, `to` (ISO dates), `action`, `entity_type`, `entity_id`, `page`, `limit`.",
      ]),
      {
        from: z.string().optional(),
        to: z.string().optional(),
        action: z.string().optional(),
        entity_type: z.string().optional(),
        entity_id: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
      readOnly,
      (a) =>
        call(getToken, baseUrl, "GET", "/v1/records/audit-events", {
          params: a as Record<string, string | number | undefined>,
        }),
    ],
    [
      "talonic_records_verify_audit_log",
      "Verify the audit log",
      "Checks that no audit event was changed or removed and compares the log with its daily anchors.",
      {},
      readOnly,
      () => call(getToken, baseUrl, "GET", "/v1/records/audit-events/verify"),
    ],
    [
      "talonic_records_list_erasure_requests",
      "List erasure requests",
      "Data-subject erasure requests with their status.",
      {},
      readOnly,
      () => call(getToken, baseUrl, "GET", "/v1/records/erasure-requests"),
    ],
    [
      "talonic_records_create_erasure_request",
      "Open an erasure request",
      desc([
        "Opens an erasure request for a data subject and finds the documents and values that mention the given terms. Nothing is erased: a person confirms the scope, approves and executes it in the web app.",
        "ARGS: `subject_label` (who), `subject_terms` (names, e-mails, ids to search for).",
      ]),
      { subject_label: z.string().min(1), subject_terms: z.array(z.string().min(1)).min(1) },
      write(false),
      (a) => call(getToken, baseUrl, "POST", "/v1/records/erasure-requests", { body: a }),
    ],
    [
      "talonic_records_get_erasure_request",
      "One erasure request",
      "One erasure request with where the subject was found and its confirmed scope.",
      { request_id: uuid("The erasure request id.") },
      readOnly,
      (a) =>
        call(getToken, baseUrl, "GET", `/v1/records/erasure-requests/${enc(String(a.request_id))}`),
    ],
    [
      "talonic_records_storage_usage",
      "Storage usage",
      "Bytes stored, the storage quota (null = unlimited) and the document count.",
      {},
      readOnly,
      () => call(getToken, baseUrl, "GET", "/v1/records/storage-usage"),
    ],
  ]
}

// ── Workspace: billing, support, deletion status ───────────────────

/** The `talonic_workspace_*` tool rows. @internal */
export function workspaceToolRows(getToken: () => string, baseUrl?: string): ToolRow[] {
  return [
    [
      "talonic_workspace_billing",
      "Billing snapshot",
      "Plan, credit balance, auto-reload settings, whether the workspace may buy credits directly, and the credit packs. Needs the billing permission.",
      {},
      readOnly,
      () => call(getToken, baseUrl, "GET", "/v1/billing"),
    ],
    [
      "talonic_workspace_buy_credits_link",
      "Link to buy credits",
      desc([
        "A URL a person opens to buy prepaid credits. Nothing is paid until they complete the purchase. A workspace billed through a cloud marketplace gets the marketplace page instead.",
        "ARGS: optional `pack` 10|50|250|1000 (default 50).",
      ]),
      { pack: z.enum(["10", "50", "250", "1000"]).optional() },
      write(false),
      (a) =>
        call(getToken, baseUrl, "GET", "/v1/billing/upgrade-link", {
          params: { pack: a.pack as string | undefined },
        }),
    ],
    [
      "talonic_workspace_billing_portal_link",
      "Link to the payment portal",
      "A one-time URL a person opens to manage payment methods and download invoices. Needs a first purchase.",
      {},
      write(false),
      () => call(getToken, baseUrl, "POST", "/v1/billing/portal"),
    ],
    [
      "talonic_workspace_create_support_ticket",
      "Contact Talonic support",
      desc([
        "Sends a request to Talonic support with your name, e-mail and workspace, and returns its reference to quote in follow-ups.",
        "ARGS: `category` question|bug|account|billing|feature_request|other, `message` (up to 5000 characters).",
      ]),
      {
        category: z.enum(["question", "bug", "account", "billing", "feature_request", "other"]),
        message: z.string().min(1).max(5000),
      },
      write(false),
      (a) =>
        call(getToken, baseUrl, "POST", "/v1/support/tickets", {
          body: { category: a.category, message: a.message },
        }),
    ],
    [
      "talonic_workspace_deletion_status",
      "Scheduled workspace deletion",
      "Whether this workspace is scheduled for deletion, and when. Scheduling a deletion is done by a person in the web app.",
      {},
      readOnly,
      () => call(getToken, baseUrl, "GET", "/v1/workspace/deletion"),
    ],
    [
      "talonic_workspace_cancel_deletion",
      "Cancel the scheduled workspace deletion",
      "Cancels a deletion this workspace scheduled and restores its previous access. Needs the data permission.",
      {},
      write(true),
      () => call(getToken, baseUrl, "DELETE", "/v1/workspace/deletion"),
    ],
  ]
}

function register(server: McpServer, rows: ToolRow[]): void {
  for (const [name, title, description, inputSchema, annotations, handler] of rows) {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations } },
      async (args: unknown) => handler((args ?? {}) as Args),
    )
  }
}

/** Register the `talonic_team_*` tools. @public */
export function registerTeamAdminTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  register(server, teamToolRows(getToken, baseUrl))
}

/** Register the `talonic_records_*` tools. @public */
export function registerRecordsAdminTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  register(server, recordsToolRows(getToken, baseUrl))
}

/** Register the `talonic_workspace_*` tools. @public */
export function registerWorkspaceTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  register(server, workspaceToolRows(getToken, baseUrl))
}

/** Probe paths: each needs the permission its group's tools need. @internal */
export const GOVERNANCE_PROBES = {
  team: "/v1/team/pending",
  records: "/v1/records/erasure-requests",
  workspace: "/v1/workspace/deletion",
} as const

/** True when the credential may manage the team. @public */
export async function probeTeamAdminAccess(token: string, baseUrl?: string): Promise<boolean> {
  return (await probeAccessState(token, baseUrl, GOVERNANCE_PROBES.team)) === true
}

/** True when the credential may manage records. @public */
export async function probeRecordsAdminAccess(token: string, baseUrl?: string): Promise<boolean> {
  return (await probeAccessState(token, baseUrl, GOVERNANCE_PROBES.records)) === true
}

/** True when the credential reaches the workspace tools (any active member). @public */
export async function probeWorkspaceAccess(token: string, baseUrl?: string): Promise<boolean> {
  return (await probeAccessState(token, baseUrl, GOVERNANCE_PROBES.workspace)) === true
}

export type { ProbeAnswer }
