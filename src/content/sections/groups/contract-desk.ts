import type { DocBlock, Param, RawSection } from "../../types"

const tool = (name: string, text: string, params: Param[] = []): DocBlock[] => [
  { type: "heading", level: 3, id: name.replace(/_/g, "-"), text: name },
  { type: "paragraph", text },
  ...(params.length ? [{ type: "param-table" as const, params }] : []),
]

const paging: Param[] = [
  { name: "page", type: "integer", description: "Page number, from 1." },
  { name: "limit", type: "integer", description: "Rows per page; the desk caps it." },
]
const team: Param = {
  name: "team",
  type: "string",
  description: "One team's work only; all teams when left out.",
}

export const section: RawSection = {
  slug: "contract-desk-tools",
  parentSlug: "tool-groups",
  title: "Contract Desk",
  seoTitle: "Contract Desk MCP Tools — Work, Evidence and Decisions",
  description:
    "Use the Contract Desk from an AI agent: list open contract work by team, open an item's evidence, record a decision at its source app and undo it if needed.",
  content: [
    {
      type: "paragraph",
      text: "The Contract Desk gathers the open work of your contract apps in one list: values where the documents and the CRM disagree or are missing, missing documents, site checks, key dates and process steps. With these tools an agent works that list the way a person does: pick a batch from the To do list, open an item's evidence, record a decision, and undo it if it was wrong. A decision is recorded at the item's source app and in the desk's log, under your connection.",
    },
    {
      type: "callout",
      variant: "info",
      text: "These tools are listed only when the Contract Desk is available to your connection. Every call is checked against your role in the workspace, exactly as in the app: reading needs an active membership, deciding needs the edit permission and the app switched on, changing the team setup needs an Admin.",
    },
    {
      type: "list",
      ordered: true,
      items: [
        "`talonic_contract_desk_todo` — sections and batches of open work.",
        "`talonic_contract_desk_todo_items` — the items of one batch.",
        "`talonic_contract_desk_get_decision` — one item's evidence and the actions it offers.",
        "`talonic_contract_desk_decide` — record the decision (preview with `dry_run` first).",
        "`talonic_contract_desk_undo` — take a decision back while it is the item's latest.",
      ],
    },
    {
      type: "callout",
      variant: "info",
      text: "Accepting a colleague's suggestion is done by a person in the app; there is no tool for it.",
    },
    ...tool(
      "talonic_contract_desk_status",
      "Whether the desk is ready: when it was last refreshed, whether a refresh is running, and how many sites, contracts and open items it holds.",
    ),
    ...tool(
      "talonic_contract_desk_refresh",
      "Start a refresh of the desk from its source apps. Answers at once; the status tool shows it running. Needs the run permission.",
    ),
    ...tool("talonic_contract_desk_sites", "One page of sites with their open work.", [
      {
        name: "q",
        type: "string",
        description:
          "Words that must each occur in the site's number, name, contracts or partners.",
      },
      {
        name: "filter",
        type: "string",
        description: "`all`, `now` (work due now) or `nodoc` (no documents).",
      },
      ...paging,
    ]),
    ...tool("talonic_contract_desk_get_site", "One site with its contracts and site-level items.", [
      { name: "key", type: "string", required: true, description: "The site key." },
    ]),
    ...tool(
      "talonic_contract_desk_contracts",
      "One page of contracts, searchable, for one partner or one site.",
      [
        { name: "q", type: "string", description: "Search words." },
        { name: "partner", type: "string", description: "A `partner_key`, matched exactly." },
        { name: "site", type: "string", description: "A site key, matched exactly." },
        ...paging,
      ],
    ),
    ...tool(
      "talonic_contract_desk_get_contract",
      "One contract with its items and values: where the documents and the CRM agree or differ, and what is open.",
      [{ name: "id", type: "string", required: true, description: "The contract's `crm_key`." }],
    ),
    ...tool(
      "talonic_contract_desk_dashboard",
      "Work due now and this month, open work by team, due dates by week, the busiest sites and the history.",
      [team],
    ),
    ...tool(
      "talonic_contract_desk_quality",
      "Required values and how many are still open, the attributes with most open values, and how well documents link to contracts.",
    ),
    ...tool(
      "talonic_contract_desk_todo",
      "The To do list: per section (now, this month, later, no date) its count and first batches of similar items, plus today's decisions.",
      [team],
    ),
    ...tool("talonic_contract_desk_todo_items", "One page of the open items of a batch.", [
      {
        name: "batch",
        type: "string",
        required: true,
        description: "The batch key from `talonic_contract_desk_todo`, unchanged.",
      },
      ...paging,
    ]),
    ...tool(
      "talonic_contract_desk_get_decision",
      "Everything the decision screen shows for one item: for a value, what each document and the CRM say and the values to pick; for a key date, its day and the outcomes offered; for a process step, mark it handled. `can_decide` says whether your connection may decide it; `mode: suggest` means your decision becomes a suggestion a colleague accepts.",
      [{ name: "id", type: "UUID", required: true, description: "The item id." }],
    ),
    ...tool(
      "talonic_contract_desk_decide",
      "Decide one item at its source app. Run with `dry_run` first. Returns the `decision_id` to undo it with.",
      [
        { name: "id", type: "UUID", required: true, description: "The item id." },
        {
          name: "action",
          type: "string",
          required: true,
          description:
            "`set`, `crm_add`, `handled`, `notice_sent`, `renewal_declined` or `terminated`; only those the item offers.",
        },
        { name: "value", type: "string", description: "The value to record; with `set` only." },
        {
          name: "note",
          type: "string",
          description: "Why, in a few words; recorded at the source.",
        },
        { name: "dry_run", type: "boolean", description: "Preview only; nothing is recorded." },
      ],
    ),
    ...tool(
      "talonic_contract_desk_decisions",
      "The decisions newest first, with who decided what and whether each can still be undone.",
      [
        { name: "mine", type: "boolean", description: "Only your own decisions." },
        { name: "crm_key", type: "string", description: "One contract's decisions." },
        ...paging,
      ],
    ),
    ...tool(
      "talonic_contract_desk_undo",
      "Undo a decision at its source and put the item back on the list. Only an item's latest decision can be undone.",
      [{ name: "id", type: "UUID", required: true, description: "The decision id." }],
    ),
    ...tool(
      "talonic_contract_desk_settings",
      "Which team gets which items: the team per item kind and per attribute, and the choices.",
    ),
    ...tool(
      "talonic_contract_desk_save_settings",
      "Replace the whole team setup and refresh the desk. Read the current setup first and send it back complete. Needs an Admin.",
      [
        {
          name: "teams",
          type: "object",
          required: true,
          description: "`{ kinds: { <kind>: <team> }, fields: { <field_key>: <team> } }`.",
        },
      ],
    ),
  ],
  related: [],
  faq: [],
  mentions: [],
}
