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
  "talonic_request_upload",
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
    // Tightened template is ~500-1100 chars; 1300 catches a regression to the
    // old verbose blocks (~2500+).
    expect(d[name].length).toBeLessThanOrEqual(1300)
  })

  it.each(ALL_TOOLS)("%s redirects to a sibling tool (NOT FOR)", (name) => {
    expect(d[name]).toContain("NOT FOR")
  })

  it.each(DOC_TOOLS)("%s tells the model to resolve a filename via talonic_search", (name) => {
    expect(d[name]).toContain("talonic_search")
  })
})
