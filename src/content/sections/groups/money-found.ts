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
  ],
  related: [],
  faq: [],
  mentions: [],
}
