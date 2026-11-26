#!/usr/bin/env node
// Tool counts per group, read from a real MCP `tools/list` against
// createServer() with each group switched on in turn. Writes the table into
// the `<!-- tool-counts:start -->` … `<!-- tool-counts:end -->` block of
// AGENTS.md and STATUS.md, so neither ever carries a hand-typed count again.
//
//   npm run build && node scripts/tool-inventory.mjs           print the block
//   npm run build && node scripts/tool-inventory.mjs --write   rewrite both files
//
// tests/tool-inventory.test.ts runs the same generator against src/ and fails
// when either file's block is stale.

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
export const DOCS = ["AGENTS.md", "STATUS.md"]
const START = "<!-- tool-counts:start -->"
const END = "<!-- tool-counts:end -->"

/** The groups, in table order. `flags` switch the group on; `off` switches a default-on group off. */
export const GROUPS = [
  {
    key: "core",
    label: "Core",
    audience: "public",
    gate: "always listed",
  },
  {
    key: "agent_tasks",
    label: "Agent tasks (`talonic_*_agent_task`)",
    audience: "public",
    gate: "listed by default; `includeAgentTaskTools: false` drops them",
    off: { includeAgentTaskTools: false },
  },
  {
    key: "decision_tasks",
    label: "Decision tasks (`talonic_*_decision_task`)",
    audience: "public",
    gate: "listed by default; OAuth sessions without `apps:decide` see them marked non-invocable",
    off: { includeDecisionTaskTools: false },
  },
  {
    key: "processes",
    label: "Process Plane (`talonic_process_*`)",
    audience: "optional",
    gate: "Process Plane view permission (`GET /v1/processes` probe)",
    flags: { includeProcessesTools: true },
  },
  {
    key: "spec_authoring",
    label: "Spec authoring (`talonic_spec_*`)",
    audience: "optional",
    gate: "Spec authoring (`GET /v1/specs/authoring` probe)",
    flags: { includeSpecAuthoringTools: true },
  },
  {
    key: "integrations",
    label: "Sources and connections (`talonic_integrations_*`, `talonic_sources_*`)",
    audience: "optional",
    gate: "`sources:read` (`GET /v1/integrations/connectors` probe)",
    flags: { includeIntegrationsTools: true },
  },
  {
    key: "workspace_operations",
    label: "Workspace operations (`talonic_pipeline_*`, ingest, organising, collections, filters, document types)",
    audience: "optional",
    gate: "one probe per family (seven `GET /v1/...` probes)",
    flags: { operationsFamilies: ["pipelines", "ingest", "ingest_settings", "document_organising", "collections", "saved_filters", "document_types"] },
  },
  {
    key: "review",
    label: "Field review (`talonic_review_*`)",
    audience: "optional",
    gate: "`GET /v1/field-reviews/summary` probe",
    flags: { includeReviewTools: true },
  },
  {
    key: "cases",
    label: "Cases (`talonic_cases_*`)",
    audience: "optional",
    gate: "`GET /v1/relation-claims/cases` probe",
    flags: { includeCasesTools: true },
  },
  {
    key: "data_products",
    label: "Data products (`talonic_data_product_*`)",
    audience: "optional",
    gate: "`GET /v1/data-products` probe",
    flags: { includeDataProductTools: true },
  },
  {
    key: "data_policies",
    label: "Data policies (`talonic_data_policy_*`)",
    audience: "optional",
    gate: "`GET /v1/data-policies` probe",
    flags: { includeDataPolicyTools: true },
  },
  {
    key: "workspace_data",
    label: "Workspace data (`talonic_catalog_*`, `talonic_suggestion_*`)",
    audience: "optional",
    gate: "`GET /v1/catalog` probe",
    flags: { includeWorkspaceDataTools: true },
  },
  {
    key: "schema_review",
    label: "Schema review (`talonic_schema_review_*`, `talonic_link_key_set`)",
    audience: "optional",
    gate: "`GET /v1/schema-graph/review-queue` probe",
    flags: { includeSchemaReviewTools: true },
  },
  {
    key: "team_admin",
    label: "Team administration (`talonic_team_*`)",
    audience: "optional",
    gate: "may manage the team (`GET /v1/team/pending` probe)",
    flags: { includeTeamAdminTools: true },
  },
  {
    key: "records_admin",
    label: "Records management (`talonic_records_*`)",
    audience: "optional",
    gate: "data permission (`GET /v1/records/erasure-requests` probe)",
    flags: { includeRecordsAdminTools: true },
  },
  {
    key: "workspace_admin",
    label: "Workspace billing and support (`talonic_workspace_*`)",
    audience: "optional",
    gate: "`GET /v1/workspace/deletion` probe",
    flags: { includeWorkspaceTools: true },
  },
  {
    key: "thread",
    label: "Thread (`talonic_thread_*`)",
    audience: "optional",
    gate: "`GET /v1/thread/drafts` probe",
    flags: { includeThreadTools: true },
  },
  {
    key: "agent_turns",
    label: "Agent turns (`talonic_agent_*`)",
    audience: "optional",
    gate: "`GET /v1/agent/home/page` probe",
    flags: { includeAgentTurnTools: true },
  },
  {
    key: "my_data",
    label: "My Data (`talonic_my_data_*`)",
    audience: "optional",
    gate: "`GET /v1/me/data` probe",
    flags: { includeMyDataTools: true },
  },
  {
    key: "app_receivables",
    label: "Receivables (`talonic_ar_*`)",
    audience: "optional",
    gate: "app workflow `receivables` probe answers 200",
    flags: { appWorkflowGroups: ["receivables"] },
  },
  {
    key: "app_spend_audit",
    label: "Spend Audit (`talonic_spend_audit_*`)",
    audience: "optional",
    gate: "app workflow `spend_audit` probe answers 200",
    flags: { appWorkflowGroups: ["spend_audit"] },
  },
  {
    key: "app_objects",
    label: "Business objects (`talonic_object*`)",
    audience: "optional",
    gate: "app workflow `objects` probe answers 200",
    flags: { appWorkflowGroups: ["objects"] },
  },
  {
    key: "app_payables_desk",
    label: "Payables Desk (`talonic_payables_desk_*`)",
    audience: "optional",
    gate: "app workflow `payables_desk` probe answers 200",
    flags: { appWorkflowGroups: ["payables_desk"] },
  },
  {
    key: "app_workbook",
    label: "Workbook capture (`talonic_workbook_*`)",
    audience: "optional",
    gate: "app workflow `workbook` probe answers 200",
    flags: { appWorkflowGroups: ["workbook"] },
  },
  {
    key: "app_record_sets",
    label: "Record sets (`talonic_record_set_*`)",
    audience: "optional",
    gate: "app workflow `record_sets` probe answers 200",
    flags: { appWorkflowGroups: ["record_sets"] },
  },
  {
    key: "app_ap",
    label: "AP bills and orders (app workflow `talonic_ap_*`)",
    audience: "optional",
    gate: "app workflow `ap` probe answers 200",
    flags: { appWorkflowGroups: ["ap"] },
  },
  {
    key: "app_compliance",
    label: "Compliance rules (`talonic_compliance_*` app workflow)",
    audience: "optional",
    gate: "app workflow `compliance` probe answers 200",
    flags: { appWorkflowGroups: ["compliance"] },
  },
  {
    key: "app_money_found",
    label: "Money Found (`talonic_money_found_*`)",
    audience: "optional",
    gate: "app workflow `money_found` probe answers 200",
    flags: { appWorkflowGroups: ["money_found"] },
  },
  {
    key: "app_price_baseline",
    label: "Price Baseline invoices (app workflow `talonic_price_baseline_*`)",
    audience: "optional",
    gate: "app workflow `price_baseline` probe answers 200",
    flags: { appWorkflowGroups: ["price_baseline"] },
  },
  {
    key: "app_contract_check",
    label: "Contract Check (`talonic_contract_check_*`)",
    audience: "optional",
    gate: "app workflow `contract_check` probe answers 200",
    flags: { appWorkflowGroups: ["contract_check"] },
  },
  {
    key: "app_chart_to_data",
    label: "Chart reading (`talonic_chart_*`)",
    audience: "optional",
    gate: "app workflow `chart_to_data` probe answers 200",
    flags: { appWorkflowGroups: ["chart_to_data"] },
  },
  {
    key: "parties",
    label: "Contract parties (`talonic_parties_*`)",
    audience: "optional",
    gate: "Parties app (`GET /v1/parties/status` probe)",
    flags: { includePartiesTools: true },
  },
  {
    key: "contracts",
    label: "Contracts (`talonic_contracts_*`)",
    audience: "optional",
    gate: "Contracts app (`GET /v1/contracts/import/status` probe)",
    flags: { includeContractsTools: true },
  },
  {
    key: "doc_gen",
    label: "Document Generation (`talonic_doc_gen_*`)",
    audience: "optional",
    gate: "Document Generation app (`GET /v1/doc-gen/status` probe)",
    flags: { includeDocGenTools: true },
  },
  {
    key: "price_baseline",
    label: "Price Baseline (`talonic_price_baseline_*`)",
    audience: "optional",
    gate: "Price Baseline app (`GET /v1/price-baseline/indices` probe)",
    flags: { includePriceBaselineTools: true },
  },
  {
    key: "submissions",
    label: "Submissions (`talonic_submissions_*`)",
    audience: "optional",
    gate: "Submissions app (`GET /v1/submissions/specs` probe)",
    flags: { includeSubmissionsTools: true },
  },
  {
    key: "ap",
    label: "Accounts Payable (`talonic_ap_*`)",
    audience: "optional",
    gate: "AP app (`GET /v1/ap/config` probe)",
    flags: { includeApTools: true },
  },
  {
    key: "master_records",
    label: "Master Records (`talonic_master_records_*`)",
    audience: "optional",
    gate: "Master Records app (`GET /v1/master-records/config` probe)",
    flags: { includeMasterRecordsTools: true },
  },
  {
    key: "portfolio",
    label: "Portfolio (`talonic_portfolio_*`)",
    audience: "optional",
    gate: "Portfolio app (`GET /v1/portfolio` probe)",
    flags: { includePortfolioTools: true },
  },
  {
    key: "growth",
    label: "Growth (`talonic_growth_*`)",
    audience: "internal",
    gate: "Talonic-internal: growth access probe",
    flags: { includeGrowthTools: true },
  },
  {
    key: "admin_agent_tasks",
    label: "Admin agent tasks (`talonic_admin_*_agent_task`)",
    audience: "internal",
    gate: "Talonic-internal: superadmin probe",
    flags: { includeAdminAgentTaskTools: true },
  },
]

/** Tool names a real `tools/list` returns for these server options. */
async function listTools(createServer, sdk, opts) {
  const server = createServer({ apiKey: "tlnc_inventory", baseUrl: "https://api.example.test", ...opts })
  const [clientT, serverT] = sdk.InMemoryTransport.createLinkedPair()
  const client = new sdk.Client({ name: "tool-inventory", version: "0" })
  await server.connect(serverT)
  await client.connect(clientT)
  const names = []
  let cursor
  do {
    const page = await client.listTools(cursor ? { cursor } : {})
    names.push(...page.tools.map((t) => t.name))
    cursor = page.nextCursor
  } while (cursor)
  await client.close()
  await server.close()
  return names
}

/** { groups: [{ ...group, tools[] }], public, openai, everything } */
export async function inventory(createServer, sdk) {
  const defaults = await listTools(createServer, sdk, {})
  const groups = []
  for (const g of GROUPS) {
    let tools
    if (g.key === "core") {
      const without = await listTools(createServer, sdk, {
        includeAgentTaskTools: false,
        includeDecisionTaskTools: false,
      })
      tools = without
    } else if (g.off) {
      const without = new Set(await listTools(createServer, sdk, g.off))
      tools = defaults.filter((n) => !without.has(n))
    } else {
      const base = new Set(defaults)
      tools = (await listTools(createServer, sdk, g.flags)).filter((n) => !base.has(n))
    }
    groups.push({ ...g, tools })
  }
  const openai = await listTools(createServer, sdk, { includeGenericExecutor: false })
  return {
    groups,
    public: defaults.length,
    openai: openai.length,
    optional: groups.filter((g) => g.audience === "optional").reduce((n, g) => n + g.tools.length, 0),
    internal: groups.filter((g) => g.audience === "internal").reduce((n, g) => n + g.tools.length, 0),
  }
}

export function renderBlock(inv, version) {
  const lines = [
    START,
    `_Generated by \`node scripts/tool-inventory.mjs --write\` from a real \`tools/list\` of @talonic/mcp; do not edit by hand (tests/tool-inventory.test.ts fails when it is stale)._`,
    "",
    `- **Public: ${inv.public} tools** listed to every session (${inv.openai} for OpenAI / ChatGPT clients, which do not get \`talonic_list_agent_tools\` and \`talonic_invoke_agent_tool\`).`,
    `- **Optional: ${inv.optional} tools** in app-gated groups, listed only when the credential passes the group's probe; not in the public count.`,
    `- **Internal: ${inv.internal} tools**, Talonic staff only; never in the public count or the public docs.`,
    "",
    "| Group | Audience | Tools | Listed when |",
    "| --- | --- | ---: | --- |",
    ...inv.groups.map((g) => `| ${g.label} | ${g.audience} | ${g.tools.length} | ${g.gate} |`),
    END,
  ]
  return lines.join("\n")
}

/** Replace the marked block in `text` (it must have one). */
export function replaceBlock(text, block, file) {
  const a = text.indexOf(START)
  const b = text.indexOf(END)
  if (a < 0 || b < a) throw new Error(`${file} has no ${START} … ${END} block`)
  return text.slice(0, a) + block + text.slice(b + END.length)
}

export function currentBlock(text) {
  const a = text.indexOf(START)
  const b = text.indexOf(END)
  return a < 0 || b < a ? null : text.slice(a, b + END.length)
}

async function main(argv) {
  const { createServer, VERSION } = await import(join(ROOT, "dist", "index.js"))
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")
  const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js")
  const block = renderBlock(await inventory(createServer, { Client, InMemoryTransport }), VERSION)
  if (!argv.includes("--write")) {
    console.log(block)
    return 0
  }
  for (const f of DOCS) {
    const p = join(ROOT, f)
    writeFileSync(p, replaceBlock(readFileSync(p, "utf8"), block, f))
    console.log(`Updated ${f}.`)
  }
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((c) => process.exit(c))
}
