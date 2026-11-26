// Page copy for the generated tool reference (see src/content/tool-pages.ts).

import type { ToolPage } from "../tool-reference-types"

export const ADMIN_AND_THREAD_PAGES: Record<string, ToolPage> = {
  talonic_team_list_members: {
    task: "admin",
    seoTitle: "talonic_team_list_members — List Workspace Members and Roles",
    description:
      "MCP tool that lists every member of your Talonic workspace with user ID, e-mail, name, role and status, plus permissions when you may manage the team.",
    related: [
      { label: "talonic_team_preview_access", slug: "talonic-team-preview-access" },
      { label: "talonic_team_invite_member", slug: "talonic-team-invite-member" },
    ],
  },
  talonic_team_list_pending: {
    task: "admin",
    seoTitle: "talonic_team_list_pending — List People Waiting to Join",
    description:
      "MCP tool that lists the people who asked to join your Talonic workspace and still wait for approval, so an admin can admit or decline each one by user ID.",
    related: [
      { label: "talonic_team_approve_member", slug: "talonic-team-approve-member" },
      { label: "talonic_team_reject_member", slug: "talonic-team-reject-member" },
    ],
  },
  talonic_team_approve_member: {
    task: "admin",
    seoTitle: "talonic_team_approve_member — Admit a Pending Member",
    description:
      "MCP tool that admits one person who asked to join your workspace, on an admin's request. They get the role they asked for, never more than the approver holds.",
    related: [
      { label: "talonic_team_list_pending", slug: "talonic-team-list-pending" },
      { label: "talonic_team_reject_member", slug: "talonic-team-reject-member" },
    ],
  },
  talonic_team_reject_member: {
    task: "admin",
    seoTitle: "talonic_team_reject_member — Decline a Request to Join",
    description:
      "MCP tool that declines one pending request to join your Talonic workspace, by user ID, when an admin asks for it. The person is not added and gets no access.",
    related: [
      { label: "talonic_team_list_pending", slug: "talonic-team-list-pending" },
      { label: "talonic_team_approve_member", slug: "talonic-team-approve-member" },
    ],
  },
  talonic_team_invite_member: {
    task: "admin",
    seoTitle: "talonic_team_invite_member — Invite a Person by E-mail",
    description:
      "MCP tool that invites a person to your Talonic workspace by e-mail with a role, when an admin asks. The role may hold only permissions the inviter holds too.",
    related: [
      { label: "talonic_team_list_members", slug: "talonic-team-list-members" },
      { label: "talonic_team_list_roles", slug: "talonic-team-list-roles" },
    ],
  },
  talonic_team_preview_access: {
    task: "admin",
    seoTitle: "talonic_team_preview_access — See What a Member May Do",
    description:
      "MCP tool that shows what one member holds right now: role, permissions, custom role and groups. It changes nothing, so use it before proposing any change.",
    related: [
      { label: "talonic_team_propose_access_change", slug: "talonic-team-propose-access-change" },
      { label: "talonic_team_list_members", slug: "talonic-team-list-members" },
    ],
  },
  talonic_team_list_roles: {
    task: "admin",
    seoTitle: "talonic_team_list_roles — List Custom Workspace Roles",
    description:
      "MCP tool that lists the custom roles your Talonic workspace defined, each with its base role and permissions, so an agent can name the right role in a change.",
    related: [
      { label: "talonic_team_propose_access_change", slug: "talonic-team-propose-access-change" },
      { label: "talonic_team_invite_member", slug: "talonic-team-invite-member" },
    ],
  },
  talonic_team_list_groups: {
    task: "admin",
    seoTitle: "talonic_team_list_groups — List Workspace Member Groups",
    description:
      "MCP tool that lists the groups of members in your Talonic workspace, so an agent can add a person to or remove them from the right group in an access change.",
    related: [
      { label: "talonic_team_propose_access_change", slug: "talonic-team-propose-access-change" },
      { label: "talonic_team_preview_access", slug: "talonic-team-preview-access" },
    ],
  },
  talonic_team_propose_access_change: {
    task: "admin",
    seoTitle: "talonic_team_propose_access_change — Preview Access Changes",
    description:
      "MCP tool that shows the before and after of a role, permission or group change and stores it as a proposal. No access changes until the person confirms it.",
    related: [
      { label: "talonic_team_confirm_access_change", slug: "talonic-team-confirm-access-change" },
      { label: "talonic_team_cancel_access_change", slug: "talonic-team-cancel-access-change" },
    ],
  },
  talonic_team_confirm_access_change: {
    task: "admin",
    seoTitle: "talonic_team_confirm_access_change — Apply a Proposed Change",
    description:
      "MCP tool that applies a proposed access change once the person who proposed it saw the before and after and asked for it. Every outcome goes to the audit log.",
    related: [
      { label: "talonic_team_propose_access_change", slug: "talonic-team-propose-access-change" },
      { label: "talonic_team_access_activity", slug: "talonic-team-access-activity" },
    ],
  },
  talonic_team_cancel_access_change: {
    task: "admin",
    seoTitle: "talonic_team_cancel_access_change — Drop an Access Proposal",
    description:
      "MCP tool that cancels one of your pending access proposals by ID when the person decides against it. Nothing changes, and the proposal can't be confirmed later.",
    related: [
      { label: "talonic_team_propose_access_change", slug: "talonic-team-propose-access-change" },
      { label: "talonic_team_confirm_access_change", slug: "talonic-team-confirm-access-change" },
    ],
  },
  talonic_team_access_activity: {
    task: "admin",
    seoTitle: "talonic_team_access_activity — Recent Access Changes Log",
    description:
      "MCP tool that returns the latest access changes, confirmations and refusals recorded in your Talonic workspace, so an admin can see who changed whose access.",
    related: [
      { label: "talonic_team_confirm_access_change", slug: "talonic-team-confirm-access-change" },
      { label: "talonic_records_list_audit_events", slug: "talonic-records-list-audit-events" },
    ],
  },
  talonic_records_list_retention_policies: {
    task: "admin",
    seoTitle: "talonic_records_list_retention_policies — Retention Rules",
    description:
      "MCP tool that lists your workspace's retention policies: how long documents are kept, what starts the clock, and what happens when the retention period ends.",
    related: [
      {
        label: "talonic_records_create_retention_policy",
        slug: "talonic-records-create-retention-policy",
      },
      { label: "talonic_records_list_dispositions", slug: "talonic-records-list-dispositions" },
    ],
  },
  talonic_records_create_retention_policy: {
    task: "admin",
    seoTitle: "talonic_records_create_retention_policy — New Retention Rule",
    description:
      "MCP tool that creates a retention policy with a name, duration and trigger. Expiry never destroys anything: an expired document waits for a person's decision.",
    related: [
      {
        label: "talonic_records_list_retention_policies",
        slug: "talonic-records-list-retention-policies",
      },
      { label: "talonic_records_list_dispositions", slug: "talonic-records-list-dispositions" },
    ],
  },
  talonic_records_list_dispositions: {
    task: "admin",
    seoTitle: "talonic_records_list_dispositions — Expired Documents Queue",
    description:
      "MCP tool that lists documents whose retention ended and wait for a person's decision. It previews what would be destroyed; nothing goes until a person approves.",
    related: [
      {
        label: "talonic_records_list_retention_policies",
        slug: "talonic-records-list-retention-policies",
      },
      { label: "talonic_records_list_legal_holds", slug: "talonic-records-list-legal-holds" },
    ],
  },
  talonic_records_list_legal_holds: {
    task: "admin",
    seoTitle: "talonic_records_list_legal_holds — List Legal Holds",
    description:
      "MCP tool that lists your workspace's legal holds and what each one covers. Nothing an active hold covers can be deleted, disposed of or erased while it lasts.",
    related: [
      { label: "talonic_records_create_legal_hold", slug: "talonic-records-create-legal-hold" },
      { label: "talonic_records_add_hold_documents", slug: "talonic-records-add-hold-documents" },
    ],
  },
  talonic_records_create_legal_hold: {
    task: "admin",
    seoTitle: "talonic_records_create_legal_hold — Place a Legal Hold",
    description:
      "MCP tool that places a legal hold on the whole workspace, one source or a set of documents, so nothing it covers can be destroyed. Only a person can release it.",
    related: [
      { label: "talonic_records_list_legal_holds", slug: "talonic-records-list-legal-holds" },
      { label: "talonic_records_add_hold_documents", slug: "talonic-records-add-hold-documents" },
    ],
  },
  talonic_records_add_hold_documents: {
    task: "admin",
    seoTitle: "talonic_records_add_hold_documents — Add Documents to a Hold",
    description:
      "MCP tool that adds more documents to an existing document-set legal hold by ID. From then on those documents cannot be deleted, disposed of or erased either.",
    related: [
      { label: "talonic_records_create_legal_hold", slug: "talonic-records-create-legal-hold" },
      { label: "talonic_records_list_legal_holds", slug: "talonic-records-list-legal-holds" },
    ],
  },
  talonic_records_list_audit_events: {
    task: "admin",
    seoTitle: "talonic_records_list_audit_events — Read the Audit Log",
    description:
      "MCP tool that reads your tamper-evident audit log, filtered by date, action or entity. Actions taken through the API name the person and the key or app used.",
    related: [
      { label: "talonic_records_verify_audit_log", slug: "talonic-records-verify-audit-log" },
      { label: "talonic_team_access_activity", slug: "talonic-team-access-activity" },
    ],
  },
  talonic_records_verify_audit_log: {
    task: "admin",
    seoTitle: "talonic_records_verify_audit_log — Check the Audit Log",
    description:
      "MCP tool that checks that no audit event in your workspace was changed or removed, comparing the log with its daily anchors, and reports whether it is intact.",
    related: [
      { label: "talonic_records_list_audit_events", slug: "talonic-records-list-audit-events" },
    ],
  },
  talonic_records_list_erasure_requests: {
    task: "admin",
    seoTitle: "talonic_records_list_erasure_requests — Erasure Requests",
    description:
      "MCP tool that lists the data-subject erasure requests in your Talonic workspace with their status, so you can follow each request from opening to execution.",
    related: [
      {
        label: "talonic_records_create_erasure_request",
        slug: "talonic-records-create-erasure-request",
      },
      { label: "talonic_records_get_erasure_request", slug: "talonic-records-get-erasure-request" },
    ],
  },
  talonic_records_create_erasure_request: {
    task: "admin",
    seoTitle: "talonic_records_create_erasure_request — Start Erasure",
    description:
      "MCP tool that opens a data-subject erasure request and finds documents and values that mention the given terms. Nothing is erased until a person approves it.",
    related: [
      { label: "talonic_records_get_erasure_request", slug: "talonic-records-get-erasure-request" },
      {
        label: "talonic_records_list_erasure_requests",
        slug: "talonic-records-list-erasure-requests",
      },
    ],
  },
  talonic_records_get_erasure_request: {
    task: "admin",
    seoTitle: "talonic_records_get_erasure_request — Erasure Detail",
    description:
      "MCP tool that returns one data-subject erasure request with where the subject was found and its confirmed scope, so a person can check it before approving.",
    related: [
      {
        label: "talonic_records_list_erasure_requests",
        slug: "talonic-records-list-erasure-requests",
      },
      {
        label: "talonic_records_create_erasure_request",
        slug: "talonic-records-create-erasure-request",
      },
    ],
  },
  talonic_records_storage_usage: {
    task: "admin",
    seoTitle: "talonic_records_storage_usage — Check Storage Used",
    description:
      "MCP tool that reports how many bytes your Talonic workspace stores, its storage quota (null means unlimited) and its document count, so you can plan capacity.",
    related: [{ label: "talonic_workspace_billing", slug: "talonic-workspace-billing" }],
  },
  talonic_workspace_billing: {
    task: "workspace",
    seoTitle: "talonic_workspace_billing — Plan and Credit Balance",
    description:
      "MCP tool that returns your workspace plan, credit balance, auto-reload settings, credit packs and whether you may buy credits directly. Needs billing access.",
    related: [
      { label: "talonic_workspace_buy_credits_link", slug: "talonic-workspace-buy-credits-link" },
      {
        label: "talonic_workspace_billing_portal_link",
        slug: "talonic-workspace-billing-portal-link",
      },
    ],
  },
  talonic_workspace_buy_credits_link: {
    task: "workspace",
    seoTitle: "talonic_workspace_buy_credits_link — Credits Purchase Link",
    description:
      "MCP tool that returns a link a person opens to buy a pack of prepaid credits (10, 50, 250 or 1000). Nothing is paid until they complete the purchase themselves.",
    related: [
      { label: "talonic_workspace_billing", slug: "talonic-workspace-billing" },
      {
        label: "talonic_workspace_billing_portal_link",
        slug: "talonic-workspace-billing-portal-link",
      },
    ],
  },
  talonic_workspace_billing_portal_link: {
    task: "workspace",
    seoTitle: "talonic_workspace_billing_portal_link — Invoices Link",
    description:
      "MCP tool that returns a one-time link a person opens to manage payment methods and download invoices. It works once the workspace has made a first purchase.",
    related: [
      { label: "talonic_workspace_billing", slug: "talonic-workspace-billing" },
      { label: "talonic_workspace_buy_credits_link", slug: "talonic-workspace-buy-credits-link" },
    ],
  },
  talonic_workspace_create_support_ticket: {
    task: "workspace",
    seoTitle: "talonic_workspace_create_support_ticket — Ask Support",
    description:
      "MCP tool that sends a question, bug report or request to Talonic support with your name, e-mail and workspace, and returns a reference to quote in follow-ups.",
    related: [{ label: "talonic_workspace_billing", slug: "talonic-workspace-billing" }],
  },
  talonic_workspace_deletion_status: {
    task: "workspace",
    seoTitle: "talonic_workspace_deletion_status — Check Scheduled Deletion",
    description:
      "MCP tool that tells you whether your Talonic workspace is scheduled for deletion, and when. Scheduling a deletion is done only by a person in the web app.",
    related: [
      { label: "talonic_workspace_cancel_deletion", slug: "talonic-workspace-cancel-deletion" },
    ],
  },
  talonic_workspace_cancel_deletion: {
    task: "workspace",
    seoTitle: "talonic_workspace_cancel_deletion — Stop a Deletion",
    description:
      "MCP tool that cancels a scheduled deletion of your workspace and restores its previous access, when a person asks for it. Needs the data permission to run.",
    related: [
      { label: "talonic_workspace_deletion_status", slug: "talonic-workspace-deletion-status" },
    ],
  },
  talonic_thread_state: {
    task: "thread",
    seoTitle: "talonic_thread_state — Read the Person's Talonic Thread",
    description:
      "MCP tool that reads the person's Talonic thread: the last exchange, any card waiting for their decision, and a cursor for reading later events. Takes no inputs.",
    related: [
      { label: "talonic_thread_events", slug: "talonic-thread-events" },
      { label: "talonic_thread_send", slug: "talonic-thread-send" },
    ],
  },
  talonic_thread_events: {
    task: "thread",
    seoTitle: "talonic_thread_events — Read New Events in the Thread",
    description:
      "MCP tool that returns everything written to the person's thread after a cursor, oldest first: messages, answers, decision cards and status rows, 200 at most.",
    related: [
      { label: "talonic_thread_state", slug: "talonic-thread-state" },
      { label: "talonic_thread_send", slug: "talonic-thread-send" },
    ],
  },
  talonic_thread_send: {
    task: "thread",
    seoTitle: "talonic_thread_send — Send a Message to the Person's Thread",
    description:
      "MCP tool that sends one message to the person's thread, as them, and waits up to 60 seconds for the answer. Retries with the same key are answered only once.",
    related: [
      { label: "talonic_thread_events", slug: "talonic-thread-events" },
      { label: "talonic_thread_send_files", slug: "talonic-thread-send-files" },
    ],
  },
  talonic_thread_send_files: {
    task: "thread",
    seoTitle: "talonic_thread_send_files — Hand Files to the Thread",
    description:
      "MCP tool that hands the person's thread up to five files of 25 MB each with an optional message. Each file stays the person's own document, seen by no one else.",
    related: [
      { label: "talonic_thread_events", slug: "talonic-thread-events" },
      { label: "talonic_thread_send", slug: "talonic-thread-send" },
    ],
  },
  talonic_thread_decide_approval: {
    task: "thread",
    seoTitle: "talonic_thread_decide_approval — Approve a Held Action",
    description:
      "MCP tool that approves or declines an action the thread holds for the person, only on their explicit answer. Each card is decided once; a repeat is refused.",
    related: [
      { label: "talonic_thread_state", slug: "talonic-thread-state" },
      { label: "talonic_thread_decide_draft", slug: "talonic-thread-decide-draft" },
    ],
  },
  talonic_thread_list_drafts: {
    task: "thread",
    seoTitle: "talonic_thread_list_drafts — List Drafts Awaiting Approval",
    description:
      "MCP tool that lists drafts the thread prepared for the person to approve: an e-mail, a process start or a document share, each with what a decision must quote.",
    related: [
      { label: "talonic_thread_decide_draft", slug: "talonic-thread-decide-draft" },
      { label: "talonic_thread_state", slug: "talonic-thread-state" },
    ],
  },
  talonic_thread_decide_draft: {
    task: "thread",
    seoTitle: "talonic_thread_decide_draft — Approve or Decline a Draft",
    description:
      "MCP tool that approves or declines one prepared draft, naming the version the person saw. Approving sends, starts or shares it; only on the person's clear yes.",
    related: [
      { label: "talonic_thread_list_drafts", slug: "talonic-thread-list-drafts" },
      { label: "talonic_thread_decide_approval", slug: "talonic-thread-decide-approval" },
    ],
  },
  talonic_thread_list_sheets: {
    task: "thread",
    seoTitle: "talonic_thread_list_sheets — List the Person's Screens",
    description:
      "MCP tool that lists the person's screens, tasks over a set of records such as contracts to renew or invoices to check, with title and status, open ones first.",
    related: [
      { label: "talonic_thread_get_sheet", slug: "talonic-thread-get-sheet" },
      { label: "talonic_thread_decide_sheet", slug: "talonic-thread-decide-sheet" },
    ],
  },
  talonic_thread_get_sheet: {
    task: "thread",
    seoTitle: "talonic_thread_get_sheet — Read One Screen's Records",
    description:
      "MCP tool that reads one screen: its records as the person can read them now, the choices it offers, and each record's suggestion, reason, decision and version.",
    related: [
      { label: "talonic_thread_list_sheets", slug: "talonic-thread-list-sheets" },
      { label: "talonic_thread_decide_sheet", slug: "talonic-thread-decide-sheet" },
    ],
  },
  talonic_thread_decide_sheet: {
    task: "thread",
    seoTitle: "talonic_thread_decide_sheet — Record a Screen Decision",
    description:
      "MCP tool that records, changes or takes back the person's decision on one record of a screen, naming the version they saw. It records a choice and runs nothing.",
    related: [
      { label: "talonic_thread_get_sheet", slug: "talonic-thread-get-sheet" },
      { label: "talonic_thread_close_sheet", slug: "talonic-thread-close-sheet" },
    ],
  },
  talonic_thread_close_sheet: {
    task: "thread",
    seoTitle: "talonic_thread_close_sheet — Mark a Person's Screen Done",
    description:
      "MCP tool that marks one of the person's screens done once they finish it. Every decision recorded on the screen is kept, and it moves out of the open list.",
    related: [
      { label: "talonic_thread_list_sheets", slug: "talonic-thread-list-sheets" },
      { label: "talonic_thread_decide_sheet", slug: "talonic-thread-decide-sheet" },
    ],
  },
  talonic_thread_figure: {
    task: "thread",
    seoTitle: "talonic_thread_figure — Check Where a Figure Came From",
    description:
      "MCP tool that checks one figure the thread stated: how it was counted, the records behind it, and whether anything changed since, so a person can trust it.",
    related: [
      { label: "talonic_thread_send", slug: "talonic-thread-send" },
      { label: "talonic_thread_events", slug: "talonic-thread-events" },
    ],
  },
  talonic_agent_get_turn: {
    task: "thread",
    seoTitle: "talonic_agent_get_turn — Read One of the Person's Turns",
    description:
      "MCP tool that reads one of the person's agent turns by ID: its status, events and result, including any step that waits for their decision before it goes on.",
    related: [{ label: "talonic_agent_confirm_turn", slug: "talonic-agent-confirm-turn" }],
  },
  talonic_agent_confirm_turn: {
    task: "thread",
    seoTitle: "talonic_agent_confirm_turn — Run or Decline a Paused Step",
    description:
      "MCP tool that runs or declines the step one of the person's agent turns waits for, only on their explicit answer. A repeat, or a turn not waiting, does nothing.",
    related: [
      { label: "talonic_agent_get_turn", slug: "talonic-agent-get-turn" },
      { label: "talonic_thread_decide_draft", slug: "talonic-thread-decide-draft" },
    ],
  },
  talonic_agent_home_page: {
    task: "thread",
    seoTitle: "talonic_agent_home_page — Read the Person's Home Page",
    description:
      "MCP tool that reads the person's own home page in the workspace: its HTML, when it was built, and how many builds back it can be stepped. HTML is null if none.",
    related: [{ label: "talonic_thread_state", slug: "talonic-thread-state" }],
  },
  talonic_my_data: {
    task: "thread",
    seoTitle: "talonic_my_data — See Who Can See the Person's Own Data",
    description:
      "MCP tool that lists the sources a person connected and the items they brought in, with who can see each now: only them, shared colleagues or the whole company.",
    related: [
      { label: "talonic_my_data_share", slug: "talonic-my-data-share" },
      { label: "talonic_my_data_share_items", slug: "talonic-my-data-share-items" },
    ],
  },
  talonic_my_data_share: {
    task: "thread",
    seoTitle: "talonic_my_data_share — Share a Source with Colleagues",
    description:
      "MCP tool that shares a source the person connected with named colleagues, or stops sharing it. Only the person who connected it can, only on their instruction.",
    related: [
      { label: "talonic_my_data", slug: "talonic-my-data" },
      { label: "talonic_my_data_share_items", slug: "talonic-my-data-share-items" },
    ],
  },
  talonic_my_data_share_items: {
    task: "thread",
    seoTitle: "talonic_my_data_share_items — Share Items with a Colleague",
    description:
      "MCP tool that shares chosen items of a connected source, such as an e-mail and its attachments, with one colleague, or stops sharing them, on the person's ask.",
    related: [
      { label: "talonic_my_data", slug: "talonic-my-data" },
      { label: "talonic_my_data_share", slug: "talonic-my-data-share" },
    ],
  },
  talonic_my_data_field_requests: {
    task: "thread",
    seoTitle: "talonic_my_data_field_requests — List Field Requests",
    description:
      "MCP tool that lists field requests to and from the person, where colleagues ask for their values of a field, with each request's state. Needs field sharing on.",
    related: [
      {
        label: "talonic_my_data_decide_field_request",
        slug: "talonic-my-data-decide-field-request",
      },
      { label: "talonic_my_data", slug: "talonic-my-data" },
    ],
  },
  talonic_my_data_decide_field_request: {
    task: "thread",
    seoTitle: "talonic_my_data_decide_field_request — Decide a Request",
    description:
      "MCP tool that approves, denies, clarifies, stops, withdraws or answers a field request as the person, only on their explicit instruction, and returns its state.",
    related: [
      { label: "talonic_my_data_field_requests", slug: "talonic-my-data-field-requests" },
      { label: "talonic_my_data_share", slug: "talonic-my-data-share" },
    ],
  },
}
