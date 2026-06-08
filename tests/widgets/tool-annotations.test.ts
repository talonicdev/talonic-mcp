import { describe, expect, it } from "vitest"
import { createServer } from "../../src/server-factory"

// Apps SDK submission rules require accurate tool-hint annotations.
// readOnlyHint must be true for pure fetch/lookup tools. Every tool declares
// destructiveHint and openWorldHint explicitly so review clients never need to
// infer side effects from omitted fields.
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
//   - talonic_request_upload: pre-allocates a document upload session, so it
//     is write-capable even before the user drops the file in the browser.
const WRITE_TOOLS = [
  "talonic_save_schema",
  "talonic_extract",
  "talonic_to_markdown",
  "talonic_request_upload",
]

const ALL_TOOLS = [...READ_ONLY_TOOLS, ...WRITE_TOOLS]
const OPEN_WORLD_TOOLS = ["talonic_extract", "talonic_to_markdown"]
const WORKSPACE_ONLY_TOOLS = ALL_TOOLS.filter((name) => !OPEN_WORLD_TOOLS.includes(name))

describe("tool annotations conform to Apps SDK guidelines", () => {
  it.each(READ_ONLY_TOOLS)("%s is annotated readOnlyHint=true", (name) => {
    const server = createServer({ apiKey: "tlnc_test" })
    const tool = (server as any)._registeredTools[name]
    expect(tool, `${name} not registered`).toBeDefined()
    expect(tool.annotations?.readOnlyHint).toBe(true)
  })

  it.each(ALL_TOOLS)("%s is explicitly non-destructive", (name) => {
    const server = createServer({ apiKey: "tlnc_test" })
    const tool = (server as any)._registeredTools[name]
    expect(tool, `${name} not registered`).toBeDefined()
    expect(tool.annotations?.destructiveHint).toBe(false)
  })

  it.each(OPEN_WORLD_TOOLS)("%s is open-world because it can fetch public URLs", (name) => {
    const server = createServer({ apiKey: "tlnc_test" })
    const tool = (server as any)._registeredTools[name]
    expect(tool, `${name} not registered`).toBeDefined()
    expect(tool.annotations?.openWorldHint).toBe(true)
  })

  it.each(WORKSPACE_ONLY_TOOLS)("%s is not open-world", (name) => {
    const server = createServer({ apiKey: "tlnc_test" })
    const tool = (server as any)._registeredTools[name]
    expect(tool, `${name} not registered`).toBeDefined()
    expect(tool.annotations?.openWorldHint).toBe(false)
  })

  it.each(WRITE_TOOLS)("%s is annotated readOnlyHint=false, destructiveHint=false", (name) => {
    const server = createServer({ apiKey: "tlnc_test" })
    const tool = (server as any)._registeredTools[name]
    expect(tool, `${name} not registered`).toBeDefined()
    expect(tool.annotations?.readOnlyHint).toBe(false)
    expect(tool.annotations?.destructiveHint).toBe(false)
  })
})
