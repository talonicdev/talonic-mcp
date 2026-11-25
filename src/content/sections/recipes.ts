// Recipes: end-to-end jobs an agent does with the Talonic tools. Each one
// says what you get, what you need, the prompt to give your agent, the calls
// it makes, and what it costs.

import type { DocBlock, RawSection } from "../types"
import { link, tool } from "../routes"

const call = (title: string, code: string): DocBlock => ({
  type: "code",
  language: "json",
  title,
  code,
})

export const sections: RawSection[] = [
  {
    slug: "recipe-set-up-workspace",
    parentSlug: "recipes",
    title: "Recipe: set up a workspace end to end",
    seoTitle: "Recipe: Set Up a Talonic Workspace from Your AI Agent",
    description:
      "From an empty workspace to answers: add companies, upload files, choose the fields you want, extract or run a Spec, ask a first question and check credits.",
    content: [
      {
        type: "paragraph",
        text: "Go from an empty workspace to structured data and cited answers without opening the web app. For anyone starting with Talonic through an agent.",
      },
      { type: "heading", level: 2, id: "before", text: "Before you start" },
      {
        type: "paragraph",
        text: `Connect your agent (${link("install-overview", "Connect")}). Have a few sample documents ready, for example ten invoices from two suppliers.`,
      },
      { type: "heading", level: 2, id: "prompt", text: "Tell your agent" },
      {
        type: "callout",
        variant: "info",
        text: '"Set up Talonic for our invoices. We buy from Acme GmbH and Nordwind AG; keep their documents apart. I\'ll upload ten invoices. Pull vendor, invoice number, date, total and currency from each, show me a table, then tell me our total spend per supplier."',
      },
      { type: "heading", level: 2, id: "steps", text: "What the agent does" },
      {
        type: "list",
        ordered: true,
        items: [
          `**Companies.** ${tool("talonic_list_accounts")}, then ${tool("talonic_create_account")} for each supplier that is missing.`,
          `**Files.** ${tool("talonic_request_upload")} per file with \`account\` and \`add_to_workspace: true\`; you open each link and drop the file; it checks ${tool("talonic_get_document")} until \`completed\`.`,
          `**Fields.** ${tool("talonic_save_schema")} with the five fields, so every invoice comes back the same way. (Not sure which fields exist? It can call ${tool("talonic_extract")} with \`auto_schema: true\` on one invoice and show you what it found.)`,
          `**Extract.** ${tool("talonic_extract")} per document with the saved \`schema_id\`. If your team already has an invoice Spec, ${tool("talonic_run_spec")} runs it over all ten at once and ${tool("talonic_get_run_results")} returns one row each.`,
          `**First question.** ${tool("talonic_ask")}: "Total spend per supplier", answered with citations to each invoice.`,
          `**Check credits.** ${tool("talonic_get_balance")} and ${tool("talonic_get_usage")}.`,
        ],
      },
      call(
        "Save the fields",
        `{
  "name": "Invoice basics",
  "definition": {
    "vendor_name": "string",
    "invoice_number": "string",
    "invoice_date": "string",
    "total": "number",
    "currency": "string"
  }
}`,
      ),
      { type: "heading", level: 2, id: "next-step", text: "Make it run by itself" },
      {
        type: "paragraph",
        text: `If your role can build processes, ask: "From now on, read every invoice that arrives at invoices@ourcompany.com the same way." The agent drafts it with ${tool("talonic_process_create")}; see ${link("recipe-process-inbox", "Process an inbox")}.`,
      },
      { type: "heading", level: 2, id: "cost", text: "Limits and cost" },
      {
        type: "list",
        items: [
          "Accounts, schemas, links and look-ups are free. Each document read and each question uses credits.",
          "A Spec run takes up to 500 workspace documents, or 20 public URLs, per call.",
          `Something failing? ${link("common-issues", "Troubleshooting")}.`,
        ],
      },
    ],
    related: [
      { label: "Files and uploads", slug: "files-and-uploads" },
      { label: "Tools by task", slug: "tools-by-task" },
      { label: "Recipe: audit invoices", slug: "recipe-audit-invoices" },
    ],
    faq: [],
    mentions: ["workspace setup", "invoice extraction", "AI agent"],
  },
  {
    slug: "recipe-process-inbox",
    parentSlug: "recipes",
    title: "Recipe: process an inbox",
    seoTitle: "Recipe: Process an Email Inbox with Talonic and an Agent",
    description:
      "Have every document that arrives in a mailbox read, checked and signed off: describe the process, test it on real files, publish it and work its sign-offs.",
    content: [
      {
        type: "paragraph",
        text: "Turn a shared mailbox into a process: every document that arrives is read, checked, sent to the right person to sign when needed, and passed on. For operations and finance teams whose agent can build processes.",
      },
      { type: "heading", level: 2, id: "before", text: "Before you start" },
      {
        type: "list",
        items: [
          "Your role can see and build processes (the process tools are listed in your session).",
          "The mailbox is connected in the Talonic web app. Connecting a mailbox and storing passwords happen in the web app, never through the agent.",
        ],
      },
      { type: "heading", level: 2, id: "prompt", text: "Tell your agent" },
      {
        type: "callout",
        variant: "info",
        text: '"Set up a process for ap@ourcompany.com: read each invoice, check the total against the purchase order, have Finance sign anything over 10,000 EUR, and send approved invoices to accounting@ourcompany.com. Test it on last week\'s invoices before it goes live."',
      },
      { type: "heading", level: 2, id: "steps", text: "What the agent does" },
      {
        type: "list",
        ordered: true,
        items: [
          `**See what's available.** ${tool("talonic_process_setup")} lists connected mailboxes, who steps can wait for, and the data a look-up step can read.`,
          `**Draft.** ${tool("talonic_process_create")} with your description. Nothing runs yet. The answer lists what a person still has to choose (\`stillOpen\`, \`questions\`); the agent asks you.`,
          `**Adjust.** ${tool("talonic_process_change")} for each answer ("Finance means the Finance group"). If a change means fewer checks, the agent must ask you before it confirms.`,
          `**Check.** ${tool("talonic_process_check")} shows what the draft still needs and what publishing would change.`,
          `**Test.** ${tool("talonic_process_test_run")} on a few real invoices (\`document_ids\`) in a test copy: nothing is sent. ${tool("talonic_process_status")} on the test copy shows each item's path.`,
          `**Publish.** Only when you say so: ${tool("talonic_process_publish")} with a \`reason\`. From now on new mail starts runs.`,
        ],
      },
      call(
        "Test on real documents",
        `{
  "process_id": "<from talonic_process_create>",
  "document_ids": ["<invoice 1>", "<invoice 2>", "<invoice 3>"]
}`,
      ),
      { type: "heading", level: 2, id: "daily", text: "Every day after" },
      {
        type: "list",
        items: [
          `"What's waiting for me?" → ${tool("talonic_process_waiting_for_me")}, then ${tool("talonic_process_status")} to see the items.`,
          `"Approve the Acme ones, send the other back: PO number missing." → ${tool("talonic_process_sign")} with \`items\`, ${tool("talonic_process_send_back")} with a \`reason\`.`,
          `"Anything stuck?" → ${tool("talonic_process_runs")} with state \`stuck\`, ${tool("talonic_process_item")} for why, and ${tool("talonic_process_retry")} once the cause is fixed.`,
        ],
      },
      { type: "heading", level: 2, id: "cost", text: "Limits and cost" },
      {
        type: "list",
        items: [
          "Drafting, checking and reading status are free; each document a run reads uses credits, including test runs.",
          "Signing and sending back are allowed only where you are assigned to the step, exactly as in the web app.",
          `${tool("talonic_process_rollback")} makes an earlier version live again if a change misbehaves.`,
        ],
      },
    ],
    related: [
      { label: "Tools by task: build a process", slug: "tools-by-task" },
      { label: "talonic_process_create", slug: "talonic-process-create" },
      { label: "talonic_process_publish", slug: "talonic-process-publish" },
    ],
    faq: [
      {
        question: "Can the agent publish a process on its own?",
        answer:
          "It can call publish, but it is told to do so only after you say so and after showing you the check. Publishing is checked against your role every time.",
      },
    ],
    mentions: ["email inbox", "invoice approval", "process automation"],
  },
  {
    slug: "recipe-audit-invoices",
    parentSlug: "recipes",
    title: "Recipe: audit invoices",
    seoTitle: "Recipe: Audit Invoices for Duplicates and Outliers — Talonic",
    description:
      "Ask your agent to audit invoices: find duplicates, totals above a limit and missing fields across the workspace, with every finding linked to its source page.",
    content: [
      {
        type: "paragraph",
        text: "Find duplicate invoices, unusually large totals and missing details across everything in your workspace, with each finding linked to the document and page it came from. For finance and audit teams.",
      },
      { type: "heading", level: 2, id: "before", text: "Before you start" },
      {
        type: "paragraph",
        text: `Invoices are in the workspace and have been read (by a Spec, a process, or ${tool("talonic_extract")}). ${link("recipe-set-up-workspace", "Set up a workspace")} if not.`,
      },
      { type: "heading", level: 2, id: "prompt", text: "Tell your agent" },
      {
        type: "callout",
        variant: "info",
        text: '"Audit our 2026 invoices: any vendor that billed the same amount twice, any invoice over 25,000 EUR, and any without an invoice number. Give me a table with a link to each document."',
      },
      { type: "heading", level: 2, id: "steps", text: "What the agent does" },
      {
        type: "list",
        ordered: true,
        items: [
          `**Duplicates.** ${tool("talonic_ask")}: "Which vendors invoiced the same amount more than once in 2026?" The answer cites each pair of invoices.`,
          `**Large totals.** ${tool("talonic_find_data")} for "invoice total" to get the field name, then ${tool("talonic_filter")} with \`gt 25000\`. Numeric comparisons need a number field; the agent checks first.`,
          `**Missing numbers.** ${tool("talonic_filter")} with \`is_empty\` on the invoice-number field.`,
          `**Evidence.** For any finding you question, ${tool("talonic_field_values")} or ${tool("talonic_extract")} with \`include_provenance\` shows the page and passage the value came from.`,
        ],
      },
      call(
        "Invoices over 25,000",
        `{
  "conditions": [
    { "field": "invoice.total", "operator": "gt", "value": 25000 },
    { "field": "invoice.date", "operator": "between", "value": "2026-01-01", "value_to": "2026-12-31" }
  ]
}`,
      ),
      { type: "heading", level: 2, id: "read", text: "Reading the results" },
      {
        type: "list",
        items: [
          "Every answer comes with citations; open them before acting on a finding.",
          "Values with a confidence below 0.7 are worth a second look.",
          "If a filter returns `warnings[]` (for example a field name it could not match), the agent tells you instead of guessing.",
        ],
      },
      { type: "heading", level: 2, id: "cost", text: "Limits and cost" },
      {
        type: "list",
        items: [
          "Filters, field values and look-ups are free; each question uses credits.",
          "Results include only documents you are allowed to see.",
        ],
      },
    ],
    related: [
      { label: "talonic_ask", slug: "talonic-ask" },
      { label: "talonic_filter", slug: "talonic-filter" },
      { label: "Recipe: set up a workspace", slug: "recipe-set-up-workspace" },
    ],
    faq: [],
    mentions: ["invoice audit", "duplicate invoices", "accounts payable"],
  },
  {
    slug: "recipe-contract-question",
    parentSlug: "recipes",
    title: "Recipe: answer a contract question",
    seoTitle: "Recipe: Answer a Contract Question with Citations — Talonic",
    description:
      "Ask what a contract says (notice periods, renewal dates, liability caps) and get an answer that quotes the clause, with a link to the page it comes from.",
    content: [
      {
        type: "paragraph",
        text: "Ask what a contract says and get an answer that quotes the clause and links to the page, in one call. For legal, procurement and anyone who needs a term out of a contract quickly.",
      },
      { type: "heading", level: 2, id: "prompt", text: "Tell your agent" },
      {
        type: "callout",
        variant: "info",
        text: '"What is the notice period for ending our agreement with Acme, and by when do we have to give notice to stop it renewing?"',
      },
      { type: "heading", level: 2, id: "steps", text: "What the agent does" },
      {
        type: "list",
        ordered: true,
        items: [
          `**Find the contract** (optional). ${tool("talonic_search")} with a short keyword ("Acme") to get the \`document_id\`, so the question looks only at that contract.`,
          `**Ask.** ${tool("talonic_ask")} with the question and \`scope.document_ids\`. Talonic answers with citations quoting the clause.`,
          `**If it takes longer.** When the answer says \`processing\`, ${tool("talonic_get_answer")} with the \`ask_id\` until it is \`completed\`.`,
          `**Follow up.** "And the liability cap?" goes to ${tool("talonic_ask")} again with the same \`conversation_id\`.`,
          `**Read the clause in full** (optional). ${tool("talonic_to_markdown")} returns the contract's text.`,
        ],
      },
      call(
        "Ask about one contract",
        `{
  "question": "What is the notice period to terminate, and the last date to give notice before auto-renewal?",
  "scope": { "document_ids": ["<document_id from talonic_search>"] }
}`,
      ),
      {
        type: "paragraph",
        text: "The answer's `citations[]` give the quote, the document and a link to open it in the web app. `verification` says whether every claim was backed by a source; if not, `correction` says what changed.",
      },
      { type: "heading", level: 2, id: "cost", text: "Limits and cost" },
      {
        type: "list",
        items: [
          "Each question uses credits; `usage.credits_charged` on the answer says how many. Search and reading text from a stored document are free.",
          "An answer waits up to 55 seconds (`wait_seconds`) before handing back an `ask_id` to collect later.",
        ],
      },
    ],
    related: [
      { label: "talonic_ask", slug: "talonic-ask" },
      { label: "talonic_search", slug: "talonic-search" },
      { label: "Tools by task", slug: "tools-by-task" },
    ],
    faq: [
      {
        question: "Can I ask about all contracts at once?",
        answer:
          'Yes. Leave out the scope, or scope by `document_type` or tags, and ask "Which of our supplier contracts renew automatically in the next 90 days?".',
      },
    ],
    mentions: ["contract question", "notice period", "contract review"],
  },
]
