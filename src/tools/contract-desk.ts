import { z } from "zod"
import { zUuid } from "./_shared.js"
import { READ, describe, write, type ToolGroup } from "./_groups.js"

/**
 * Contract Desk tools over `/v1/contract-desk/*`: one worklist over the
 * contract apps of a workspace (open values, missing documents, site checks,
 * key dates and process steps), with each item's evidence and a decision that
 * is recorded at the item's source app and can be undone. Same services and
 * policy as the web app: the viewer is the key's person, reads need an active
 * member, deciding needs `edit` and the app switched on, the team setup needs
 * an Admin. `POST items/{id}/accept` always answers 403 for a key (a
 * suggestion is accepted by a person in the app), so it has no tool.
 *
 * The loop: talonic_contract_desk_todo → talonic_contract_desk_todo_items →
 * talonic_contract_desk_get_decision (evidence) → talonic_contract_desk_decide
 * (dry_run first) → talonic_contract_desk_undo when it was wrong.
 */

const paging = {
  page: z.number().int().min(1).max(1_000_000).optional().describe("Page number, from 1."),
  limit: z.number().int().min(1).optional().describe("Rows per page (the desk caps it)."),
}

const key = (what: string) =>
  z.string().min(1).max(2000).describe(`${what} as the desk lists it (no control characters).`)

const team = z
  .string()
  .max(2000)
  .optional()
  .describe("One team's work only; all teams when left out.")

export const contractDeskGroup: ToolGroup = {
  key: "contract_desk",
  label: "Contract Desk",
  docsSlug: "contract-desk-tools",
  probe: { path: "/v1/contract-desk/status" },
  tools: [
    {
      name: "talonic_contract_desk_status",
      title: "Contract Desk status",
      description: describe({
        what: "Whether the Contract Desk is ready: when it was last refreshed, whether a refresh is running, and how many sites, contracts and open items it holds.",
        use: "first call of a session, or after talonic_contract_desk_refresh to see it finish.",
        not: "the work itself (talonic_contract_desk_todo).",
        returns: "the desk's state: last refresh time and outcome, a running refresh, counts.",
      }),
      route: "GET /v1/contract-desk/status",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_contract_desk_refresh",
      title: "Refresh the Contract Desk",
      description: describe({
        what: "Start a refresh of the Contract Desk from its source apps now. Answers at once; talonic_contract_desk_status shows it running and its outcome. Needs the `run` permission and the app switched on.",
        use: "the source apps changed (new contracts, decisions made elsewhere) and the desk should show it before the next scheduled refresh.",
        not: "reading anything (every read tool shows the last refresh).",
        returns: "the refresh that was started (or the one already running).",
      }),
      route: "POST /v1/contract-desk/rebuild",
      inputSchema: {},
      annotations: write(true),
    },
    {
      name: "talonic_contract_desk_sites",
      title: "Contract Desk sites",
      description: describe({
        what: "One page of sites with their contracts and open work, and the counts of the three filters.",
        use: "finding a site by number or name, or listing the sites with work due now or without documents.",
        not: "one site's contracts and items (talonic_contract_desk_get_site).",
        args: "`q` (words that must each occur in the site's number, name, contracts or partners), `filter` all|now|nodoc, `page`, `limit`.",
        returns: "{ data[] sites, total, page, limit, counts { all, now, nodoc } }.",
      }),
      route: "GET /v1/contract-desk/sites",
      inputSchema: {
        q: z.string().max(500).optional().describe("Search words."),
        filter: z
          .enum(["all", "now", "nodoc"])
          .optional()
          .describe("all, now (work due now) or nodoc (no documents)."),
        ...paging,
      },
      annotations: READ,
      query: ["q", "filter", "page", "limit"],
    },
    {
      name: "talonic_contract_desk_get_site",
      title: "One Contract Desk site",
      description: describe({
        what: "One site with its contracts and its site-level items.",
        use: "the user names a site, or after talonic_contract_desk_sites.",
        not: "one contract's values (talonic_contract_desk_get_contract).",
        args: "`key` the site key from talonic_contract_desk_sites.",
        returns:
          "the site, its contracts and its open items. 404 when the desk holds no such site.",
      }),
      route: "GET /v1/contract-desk/sites/{key}",
      inputSchema: { key: key("The site key") },
      annotations: READ,
    },
    {
      name: "talonic_contract_desk_contracts",
      title: "Contract Desk contracts",
      description: describe({
        what: "One page of contracts, searchable, for one partner or one site.",
        use: "finding a contract by number, name, partner, site or type.",
        not: "one contract's items and values (talonic_contract_desk_get_contract).",
        args: "`q` (words that must each occur in the contract's key, number, name, partner, site or type), `partner` (a partner_key, exact), `site` (a site key, exact), `page`, `limit`.",
        returns:
          "{ data[] contracts (crm_key, number, partner, site, type, open items), total, page, limit }.",
      }),
      route: "GET /v1/contract-desk/contracts",
      inputSchema: {
        q: z.string().max(500).optional().describe("Search words."),
        partner: z.string().max(2000).optional().describe("A partner_key, matched exactly."),
        site: z.string().max(2000).optional().describe("A site key, matched exactly."),
        ...paging,
      },
      annotations: READ,
      query: ["q", "partner", "site", "page", "limit"],
    },
    {
      name: "talonic_contract_desk_get_contract",
      title: "One Contract Desk contract",
      description: describe({
        what: "One contract with its items and values: where the documents and the CRM agree or differ, and what is open.",
        use: "the evidence for a contract, or before deciding several items on one contract.",
        not: "the decision screen of one item (talonic_contract_desk_get_decision).",
        args: "`id` the contract's crm_key.",
        returns:
          "the contract with its values, items and documents. 404 when the desk holds no such contract.",
      }),
      route: "GET /v1/contract-desk/contracts/{id}",
      inputSchema: { id: key("The contract's crm_key") },
      annotations: READ,
    },
    {
      name: "talonic_contract_desk_dashboard",
      title: "Contract Desk dashboard",
      description: describe({
        what: "The Dashboard: work to do now and this month, open work by team, due dates by week, the busiest sites, the first batch, and the history.",
        use: "the headline ('how much is open, what is due this week, which team is behind').",
        not: "the items themselves (talonic_contract_desk_todo).",
        args: "`team` (optional).",
        returns: "the dashboard figures for the team, or all teams.",
      }),
      route: "GET /v1/contract-desk/dashboard",
      inputSchema: { team },
      annotations: READ,
      query: ["team"],
    },
    {
      name: "talonic_contract_desk_quality",
      title: "Contract Desk data quality",
      description: describe({
        what: "The Data quality page: the required values and how many are still open, the attributes with the most open values, the documents, and how well documents link to contracts.",
        use: "a data quality question across the contract portfolio.",
        not: "one contract's values (talonic_contract_desk_get_contract).",
        returns: "the quality figures.",
      }),
      route: "GET /v1/contract-desk/quality",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_contract_desk_todo",
      title: "Contract Desk to do list",
      description: describe({
        what: "The To do list: per section (now, this month, later, no date) its item count and first batches of similar items, plus the decisions made today.",
        use: "starting work: pick a batch, then list its items with talonic_contract_desk_todo_items.",
        not: "one batch's items (talonic_contract_desk_todo_items).",
        args: "`team` (optional).",
        returns:
          "{ sections[] { section, count, batches[] { key, team, kind, count, … }, more }, decided_today, … }.",
      }),
      route: "GET /v1/contract-desk/todo",
      inputSchema: { team },
      annotations: READ,
      query: ["team"],
    },
    {
      name: "talonic_contract_desk_todo_items",
      title: "Items of a Contract Desk batch",
      description: describe({
        what: "One page of the open items of a batch from the To do list.",
        use: "after talonic_contract_desk_todo, to get the item ids to open and decide.",
        not: "the evidence of one item (talonic_contract_desk_get_decision).",
        args: "`batch` (the batch key from talonic_contract_desk_todo, unchanged), `page`, `limit`.",
        returns:
          "{ batch | null, data[] items { id, kind, contract, site, due_date, … }, total, page, limit }. batch is null when the key names no items any more.",
      }),
      route: "GET /v1/contract-desk/todo/items",
      inputSchema: {
        batch: z
          .string()
          .min(1)
          .max(2000)
          .describe("The batch key from talonic_contract_desk_todo."),
        ...paging,
      },
      annotations: READ,
      query: ["batch", "page", "limit"],
    },
    {
      name: "talonic_contract_desk_get_decision",
      title: "Evidence for one Contract Desk item",
      description: describe({
        what: "Everything the decision screen shows for one open item: the item, its contract and site, the question (for a value: what each document and the CRM say and the values to pick; for a key date: its day and the outcomes offered; for a process step: mark it handled), whether this connection may decide (`can_decide`), and the contract's letter if there is one.",
        use: "before talonic_contract_desk_decide, to show the user the evidence and the allowed actions.",
        not: "decided items (talonic_contract_desk_decisions).",
        args: "`id` the item id.",
        returns:
          "{ item, contract, site_name, can_decide, question { kind value|deadline|step, … } | null, letter }. question.mode `suggest` means the decision becomes a suggestion a colleague accepts. 404 unknown item; 409 gone when a decision already closed it.",
      }),
      route: "GET /v1/contract-desk/items/{id}/decision",
      inputSchema: { id: zUuid().describe("The item id.") },
      annotations: READ,
    },
    {
      name: "talonic_contract_desk_decide",
      title: "Decide a Contract Desk item",
      description: describe({
        what: "Decide one open item. The decision is recorded at the item's source app (set a value, report a value as missing to the CRM, mark a key date or step handled, record a notice outcome on the contract) and in the desk's log, under this connection. Run with dry_run first. Can be undone with talonic_contract_desk_undo while it is the item's latest decision.",
        use: "the user chose what an item should be after seeing talonic_contract_desk_get_decision.",
        not: "accepting a colleague's suggestion (done by a person in the app); changing teams (talonic_contract_desk_save_settings).",
        args: "`id` the item id; `action` set|crm_add|handled|notice_sent|renewal_declined|terminated (only those the item's question offers); `value` (for set only; may span lines); `note` (why, recorded at the source); `dry_run`.",
        returns:
          "{ status decided|suggested, dry_run, decision_id (null on a dry run), undoable, crm_report update|missing|null, revision }.",
        errors:
          "400 an action the item does not offer, set without a value, a value on another action; 403 without the edit permission; 409 the item changed.",
      }),
      route: "POST /v1/contract-desk/items/{id}/decide",
      inputSchema: {
        id: zUuid().describe("The item id."),
        action: z
          .enum(["set", "crm_add", "handled", "notice_sent", "renewal_declined", "terminated"])
          .describe(
            "What to do; talonic_contract_desk_get_decision lists the ones this item offers.",
          ),
        value: z.string().optional().describe("The value to record; only with action set."),
        note: z.string().optional().describe("Why, in a few words."),
        dry_run: z.boolean().optional().describe("Preview only; nothing is recorded."),
      },
      annotations: write(false),
      body: ["action", "value", "note", "dry_run"],
    },
    {
      name: "talonic_contract_desk_decisions",
      title: "Contract Desk decisions",
      description: describe({
        what: "The Decided list: decisions newest first, with who, what, the item and contract, and whether each can still be undone; plus today's count.",
        use: "reviewing what was decided, finding a decision to undo, or one contract's history.",
        not: "open items (talonic_contract_desk_todo).",
        args: "`mine` (only this connection's person), `crm_key` (one contract), `page`, `limit`.",
        returns:
          "{ data[] { id, at, by_name, mine, kind, action, value, note, status, item, contract, undoable, undone_at }, total, page, limit, today }.",
      }),
      route: "GET /v1/contract-desk/decisions",
      inputSchema: {
        mine: z.boolean().optional().describe("Only the decisions of this connection's person."),
        crm_key: z.string().max(2000).optional().describe("One contract's decisions."),
        ...paging,
      },
      annotations: READ,
      query: ["mine", "crm_key", "page", "limit"],
    },
    {
      name: "talonic_contract_desk_undo",
      title: "Undo a Contract Desk decision",
      description: describe({
        what: "Undo a decision at its source app and put the item back on the list. Only the latest decision of an item that is not open again can be undone.",
        use: "a decision was wrong; the id comes from talonic_contract_desk_decide (decision_id) or talonic_contract_desk_decisions.",
        not: "deciding again (talonic_contract_desk_decide after the undo).",
        args: "`id` the decision id.",
        returns: "the decision with undone_at set. 409 not_undoable otherwise.",
      }),
      route: "POST /v1/contract-desk/decisions/{id}/undo",
      inputSchema: { id: zUuid().describe("The decision id.") },
      annotations: write(false),
    },
    {
      name: "talonic_contract_desk_settings",
      title: "Contract Desk team setup",
      description: describe({
        what: "Which team gets which items: the team per item kind and per attribute, the defaults, the teams and kinds one can choose, and the attributes.",
        use: "before changing the setup, or to explain why an item went to a team.",
        not: "changing it (talonic_contract_desk_save_settings).",
        returns: "{ teams { kinds, fields }, defaults, choices { teams, kinds }, attributes[] }.",
      }),
      route: "GET /v1/contract-desk/settings",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_contract_desk_save_settings",
      title: "Change the Contract Desk team setup",
      description: describe({
        what: "Replace the whole team setup (the team per item kind and per attribute) and refresh the desk. Needs an Admin of the workspace.",
        use: "the user wants items routed to other teams. Read talonic_contract_desk_settings, change it, send it whole.",
        not: "partial edits: kinds and fields left out lose their team.",
        args: "`teams` { kinds { <kind>: <team> } for value, documents_missing, site_check, text_check, deadline; fields { <field_key>: <team> } }.",
        returns: "the saved setup. 400 for an unknown kind or team.",
      }),
      route: "PUT /v1/contract-desk/settings",
      inputSchema: {
        teams: z
          .object({
            kinds: z.record(z.string(), z.string()).describe("<kind>: <team>."),
            fields: z.record(z.string(), z.string()).describe("<field_key>: <team>."),
          })
          .describe("The whole team setup."),
      },
      annotations: write(true),
      body: ["teams"],
    },
  ],
}
