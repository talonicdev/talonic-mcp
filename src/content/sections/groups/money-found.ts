import type { RawSection } from "../../types"

// Generated from src/tools/money-found.ts (names, summaries, parameters); keep in step with it.
export const section: RawSection = {
  slug: "money-found-tools",
  parentSlug: "tool-groups",
  title: "Money Found",
  seoTitle: "Money Found MCP Tools — Recoverable Amounts Ledger",
  description:
    "MCP tools for the Talonic Money Found app: read the ledger of recoverable amounts with their evidence, prepare evidence requests and queue row re-reviews.",
  content: [
    {
      type: "paragraph",
      text: "Read the Money Found ledger: every amount the workspace's contracts, invoices and payments show could be recovered, grouped by lever, each row with the clause and the documents it rests on.",
    },
    {
      type: "paragraph",
      text: "The usual loop: **`talonic_money_found_ledger`** finds a row and its evidence, **`talonic_money_found_evidence_requests`** lists what to ask the customer's receivables team to confirm, and **`talonic_money_found_review_row`** queues a re-review when a row's price is in doubt; **`talonic_money_found_reviews`** shows the outcome.",
    },
    {
      type: "callout",
      variant: "info",
      text: "These tools are listed only when the Money Found app is available to the connection. Every call is checked against the role and permissions of the person behind the connection, exactly as in the web app.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-ledger",
      text: "talonic_money_found_ledger",
    },
    {
      type: "paragraph",
      text: "The whole lever ledger: per lever (a kind of recoverable amount, such as a charge the contract allows but the invoices leave off) its rows, each with its key, party and agreement, the amount, its `tier` (e.g. potential) and `state`, the explanation, and the quotes and documents it rests on, plus the ledger totals in the ledger currency.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-evidence-requests",
      text: "talonic_money_found_evidence_requests",
    },
    {
      type: "paragraph",
      text: "What to ask the customer's receivables team for: the open potential rows that need a confirmation, grouped by cost unit and framework number, largest first, each item with its lever id and row key, invoice type, period, amount and the question to ask.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-reviews",
      text: "talonic_money_found_reviews",
    },
    {
      type: "paragraph",
      text: "Re-reviews of contract price rows: per row its status (queued, running, done), the outcome, and the suggested price where a contract price was read again.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-review-row",
      text: "talonic_money_found_review_row",
    },
    {
      type: "paragraph",
      text: "Queue a re-review of one contract price row: its contract price is checked again against the documents; the ledger changes only when the review finds a different price.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "lever_id",
          type: "string",
          required: true,
          description: "The lever id of the row.",
        },
        {
          name: "key",
          type: "string",
          required: true,
          description: "The row key.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-review-all",
      text: "talonic_money_found_review_all",
    },
    {
      type: "paragraph",
      text: "Queue a re-review of every contract price row not reviewed since its check changed.",
    },
    // App-workflow tools (src/tools/app-workflows.ts, group "money_found").
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-catalog",
      text: "talonic_money_found_catalog",
    },
    {
      type: "paragraph",
      text: "The roles a configuration binds, their fields, and the levers with what each needs. USE WHEN: setting Money Found up. NOT FOR: the configuration in force (talonic_money_found_config).",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-config",
      text: "talonic_money_found_config",
    },
    {
      type: "paragraph",
      text: "The configuration in force, or config: null. USE WHEN: before changing it. NOT FOR: a proposal (talonic_money_found_propose_config).",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-propose-config",
      text: "talonic_money_found_propose_config",
    },
    {
      type: "paragraph",
      text: "Propose a configuration from the workspace's Specs and tables. Saves nothing; show it to the user, then confirm with talonic_money_found_save_config. USE WHEN: no configuration yet, or the sources changed. NOT FOR: saving (talonic_money_found_save_config).",
    },
    {
      type: "param-table",
      params: [
        {
          name: "as_of",
          type: "string",
          required: false,
          description: "as of",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-save-config",
      text: "talonic_money_found_save_config",
    },
    {
      type: "paragraph",
      text: "Confirm a configuration (validated in full; a binding to a missing source or field is dropped). The ledger rebuilds on the next read. USE WHEN: the user accepted a proposal or a change. NOT FOR: proposing one (talonic_money_found_propose_config).",
    },
    {
      type: "param-table",
      params: [
        {
          name: "config",
          type: "object",
          required: true,
          description: "config",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-structure-clauses",
      text: "talonic_money_found_structure_clauses",
    },
    {
      type: "paragraph",
      text: "Read rebate steps, rates and dates out of the configured contracts' clause text and save them into the configuration. USE WHEN: after confirming a configuration, so rebate and commitment levers run. NOT FOR: cost bearers (talonic_money_found_cost_clauses).",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-cost-clauses",
      text: "talonic_money_found_cost_clauses",
    },
    {
      type: "paragraph",
      text: "Read who bears each cost from the contracts' own text and save it; an answer counts only when its quote is found. dry_run counts only. USE WHEN: pass-through costs matter. NOT FOR: clause numbers (talonic_money_found_structure_clauses).",
    },
    {
      type: "param-table",
      params: [
        {
          name: "keys",
          type: "string[]",
          required: false,
          description: "keys",
        },
        {
          name: "limit",
          type: "integer",
          required: false,
          description: "limit",
        },
        {
          name: "dry_run",
          type: "boolean",
          required: false,
          description: "dry run",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-delete-config",
      text: "talonic_money_found_delete_config",
    },
    {
      type: "paragraph",
      text: "Remove the configuration; the ledger without one answers again. USE WHEN: the user asks to start over. NOT FOR: changing it (talonic_money_found_save_config).",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-money-found-set-row-state",
      text: "talonic_money_found_set_row_state",
    },
    {
      type: "paragraph",
      text: "Record open, in_progress, resolved or dismissed on one ledger row; the next ledger read shows it. USE WHEN: the user acted on a finding. NOT FOR: re-reviewing a contract price row.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "lever_id",
          type: "string",
          required: true,
          description: "lever id",
        },
        {
          name: "key",
          type: "string",
          required: true,
          description: "key",
        },
        {
          name: "state",
          type: "open | in_progress | resolved | dismissed",
          required: true,
          description: "state",
        },
        {
          name: "note",
          type: "string",
          required: false,
          description: "note",
        },
      ],
    },
  ],
  related: [],
  faq: [],
  mentions: [],
}
