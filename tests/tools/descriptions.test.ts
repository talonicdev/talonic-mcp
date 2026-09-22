import { describe, expect, it } from "vitest"
import { createServer } from "../../src/server-factory"

// The agent-facing tool descriptions must stay tight and decision-oriented:
// a one-line WHAT, a NOT-FOR redirect to the nearest sibling tool, and (for the
// document tools) the by-name -> talonic_search chaining cue. This guards
// against regressing back to the old ~2.5k-char prose blocks that made models
// hesitate and mis-select.
const ALL_TOOLS = [
  "talonic_extract",
  "talonic_to_markdown",
  "talonic_get_document",
  "talonic_search",
  "talonic_filter",
  "talonic_list_schemas",
  "talonic_save_schema",
  "talonic_get_balance",
  "talonic_get_pricing",
  "talonic_get_usage",
  "talonic_request_upload",
  "talonic_list_fields",
  "talonic_get_field",
  "talonic_field_values",
  "talonic_find_data",
  "talonic_list_agent_tools",
  "talonic_invoke_agent_tool",
  "talonic_list_agent_tasks",
  "talonic_get_agent_task",
  "talonic_claim_agent_task",
  "talonic_heartbeat_agent_task",
  "talonic_submit_agent_task",
  "talonic_list_specs",
  "talonic_get_spec",
  "talonic_run_spec",
  "talonic_get_run",
  "talonic_get_run_results",
  "talonic_ask",
  "talonic_get_answer",
  "talonic_list_decision_tasks",
  "talonic_claim_decision_task",
  "talonic_read_decision_package",
  "talonic_heartbeat_decision_task",
  "talonic_submit_decision_task",
  "talonic_release_decision_task",
  "talonic_fail_decision_task",
]

// Tools that act on a specific document must tell the model to resolve a
// filename via search first.
const DOC_TOOLS = ["talonic_extract", "talonic_to_markdown", "talonic_get_document"]

function descriptions(): Record<string, string> {
  const server = createServer({ apiKey: "tlnc_test" }) as any
  const out: Record<string, string> = {}
  for (const name of ALL_TOOLS) out[name] = server._registeredTools[name]?.description ?? ""
  return out
}

describe("tool descriptions are tight and decision-oriented", () => {
  const d = descriptions()

  it.each(ALL_TOOLS)("%s has a non-empty description under the length budget", (name) => {
    expect(d[name].length).toBeGreaterThan(0)
    // Tightened template is ~500-1400 chars; 1500 catches a regression to the
    // old verbose blocks (~2500+).
    expect(d[name].length).toBeLessThanOrEqual(1500)
  })

  it.each(ALL_TOOLS)("%s redirects to a sibling tool (NOT FOR)", (name) => {
    expect(d[name]).toContain("NOT FOR")
  })

  it.each(DOC_TOOLS)("%s tells the model to resolve a filename via talonic_search", (name) => {
    expect(d[name]).toContain("talonic_search")
  })

  it("search teaches the literal-keyword query contract (review test #7)", () => {
    // The search API matches literal tokens; sentence/plural queries return
    // empty and the model concludes the workspace is empty. The description
    // must carry the query contract.
    expect(d["talonic_search"]).toContain("LITERAL")
    expect(d["talonic_search"]).toContain("SINGULAR")
  })

  it("filter tells the model to attempt text filters without prior discovery (review test #8)", () => {
    expect(d["talonic_filter"]).toContain("TEXT FILTERS")
    expect(d["talonic_filter"]).toContain("warnings[]")
  })

  it("get_run_results carries the run_kind polling rule (review F-B)", () => {
    expect(d["talonic_get_run_results"]).toContain("run_kind")
  })
})

describe("Anthropic review criteria — custom-query tools name their API and their read-only guarantee", () => {
  const d = descriptions()
  it("invoke_agent_tool states the platform's read-only restriction for API keys and links the API docs", () => {
    expect(d["talonic_invoke_agent_tool"]).toMatch(/read-only/i)
    expect(d["talonic_invoke_agent_tool"]).toContain("data.read")
    expect(d["talonic_invoke_agent_tool"]).toContain("https://talonic.com/docs/api")
    expect(d["talonic_invoke_agent_tool"]).toContain("/v1/agent/tools/{name}/invoke")
  })
  it("list_agent_tools links the API docs", () => {
    expect(d["talonic_list_agent_tools"]).toContain("https://talonic.com/docs/api")
  })
  it.each(["talonic_invoke_agent_tool", "talonic_list_agent_tools"])(
    "%s stays under the length budget",
    (name) => {
      expect(d[name].length).toBeLessThanOrEqual(1500)
    },
  )
})
