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
