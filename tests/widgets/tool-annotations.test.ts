import { describe, expect, it } from "vitest"
import { createServer } from "../../src/server-factory"

// Apps SDK submission rules require accurate tool-hint annotations.
// readOnlyHint must be true for pure fetch/lookup tools. destructiveHint is
// only meaningful for write tools (readOnlyHint=false); read-only tools omit
// it, which the MCP spec treats as non-destructive by definition.
const READ_ONLY_TOOLS = [
  "talonic_search",
  "talonic_filter",
  "talonic_get_document",
  "talonic_list_schemas",
  "talonic_get_balance",
]

// Write-capable tools: readOnlyHint=false. None destroy data, so
// destructiveHint=false.
//   - talonic_extract / talonic_save_schema: obvious writes.
//   - talonic_to_markdown: NOT read-only. When given a file (file_url /
//     file_data / file_path) rather than an existing document_id, it ingests
//     the document via extract first (see to-markdown.ts handler), which
//     uploads a workspace document and consumes credits. Only the
//     document_id path is side-effect-free, so the conservative annotation
//     is readOnlyHint=false.
const WRITE_TOOLS = ["talonic_save_schema", "talonic_extract", "talonic_to_markdown"]

describe("tool annotations conform to Apps SDK guidelines", () => {
  it.each(READ_ONLY_TOOLS)("%s is annotated readOnlyHint=true", (name) => {
    const server = createServer({ apiKey: "tlnc_test" })
    const tool = (server as any)._registeredTools[name]
    expect(tool, `${name} not registered`).toBeDefined()
    expect(tool.annotations?.readOnlyHint).toBe(true)
  })

  it.each(WRITE_TOOLS)("%s is annotated readOnlyHint=false, destructiveHint=false", (name) => {
    const server = createServer({ apiKey: "tlnc_test" })
    const tool = (server as any)._registeredTools[name]
    expect(tool, `${name} not registered`).toBeDefined()
    expect(tool.annotations?.readOnlyHint).toBe(false)
    expect(tool.annotations?.destructiveHint).toBe(false)
  })
})
