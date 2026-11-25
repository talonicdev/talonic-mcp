import { z } from "zod"
import { READ, describe, write, type ToolGroup } from "./_groups.js"

/**
 * Money Found tools over the platform's public `/v1/money-found/*`: the lever
 * ledger (every recoverable amount the workspace's contracts, invoices and
 * payments show, each with the clause and the value it rests on), the
 * evidence requests for the customer's receivables team, and re-reviews of
 * contract price rows.
 *
 * The loop: talonic_money_found_ledger (find a row) → its evidence is in the
 * row (quotes and source documents) and talonic_money_found_evidence_requests
 * (what to ask for) → the allowed correction: queue a re-review of a row
 * (talonic_money_found_review_row) and read it with
 * talonic_money_found_reviews. The paged `rows` / `summary` reads are
 * source-only (no public operation yet) and have no tool.
 */

export const moneyFoundGroup: ToolGroup = {
  key: "money_found",
  label: "Money Found",
  docsSlug: "money-found-tools",
  probe: { path: "/v1/money-found/reviews" },
  tools: [
    {
      name: "talonic_money_found_ledger",
      title: "Money Found ledger",
      description: describe({
        what: "The whole lever ledger: per lever (a kind of recoverable amount, such as a charge the contract allows but the invoices leave off) its rows, each with its key, party and agreement, the amount, its `tier` (e.g. potential) and `state`, the explanation, and the quotes and documents it rests on, plus the ledger totals in the ledger currency.",
        use: "'how much money is there to recover', or finding one row (lever id and row key) and the evidence behind it.",
        not: "what to ask the customer for (talonic_money_found_evidence_requests).",
        returns:
          "{ currency, as_of, levers[] { id, name, rows[] { key, party, agreement, tier, state, detail, … } }, potential_total, resolved_total, estimated_total, held_for_review_total, not_finding_total, … }. Large; ask the user which lever or party matters before reading every row aloud.",
      }),
      route: "GET /v1/money-found/levers",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_money_found_evidence_requests",
      title: "Money Found evidence requests",
      description: describe({
        what: "What to ask the customer's receivables team for: the open potential rows that need a confirmation, grouped by cost unit and framework number, largest first, each item with its lever id and row key, invoice type, period, amount and the question to ask.",
        use: "preparing the request for confirmations that turn potential rows into owed ones.",
        not: "the ledger itself (talonic_money_found_ledger).",
        returns:
          "{ currency, groups[] { cost_unit, framework_number, customer, contracts[], total, items[] { lever_id, row_key, invoice_type, period, ask, amount, contract } } }.",
      }),
      route: "GET /v1/money-found/evidence-requests",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_money_found_reviews",
      title: "Money Found re-reviews",
      description: describe({
        what: "Re-reviews of contract price rows: per row its status (queued, running, done), the outcome, and the suggested price where a contract price was read again.",
        use: "after talonic_money_found_review_row or talonic_money_found_review_all, to read the outcome.",
        returns: "The re-reviews with their counts and suggested prices.",
      }),
      route: "GET /v1/money-found/reviews",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_money_found_review_row",
      title: "Re-review one Money Found row",
      description: describe({
        what: "Queue a re-review of one contract price row: its contract price is checked again against the documents; the ledger changes only when the review finds a different price.",
        use: "the user doubts a row's amount or its price, or a contract was replaced.",
        args: "`lever_id`, `key` (the row key from talonic_money_found_ledger).",
        returns: "{ review } the queued review.",
        errors: "404 when the lever or row does not exist; 403 when the app is switched off.",
      }),
      route: "POST /v1/money-found/rows/{leverId}/{key}/review",
      inputSchema: {
        lever_id: z.string().min(1).max(200).describe("The lever id of the row."),
        key: z.string().min(1).max(1000).describe("The row key."),
      },
      annotations: write(true),
    },
    {
      name: "talonic_money_found_review_all",
      title: "Re-review every pending Money Found row",
      description: describe({
        what: "Queue a re-review of every contract price row not reviewed since its check changed.",
        use: "bringing the whole ledger up to date after many documents arrived.",
        returns: "How many reviews were queued.",
      }),
      route: "POST /v1/money-found/reviews/run",
      inputSchema: {},
      annotations: write(true),
    },
  ],
}
