import { describe, expect, it } from "vitest"
import { buildServerInstructions, createServer } from "../src/server-factory"

// Anthropic's Claude Connectors Directory review (2026-10-07, repeated
// 2026-10-25) held the listing on four points: server instructions that told
// the model to act against what it can see ("callable on EVERY turn", "you
// are mistaken", "never tell the user ..."), a tool description naming
// another chat client, talonic_extract framed as "the default tool" and
// "the answer", and talonic_invoke_agent_tool stating the API-key
// restriction without saying what an OAuth session can invoke. This file
// locks each of those in place.

const server = createServer({ apiKey: "tlnc_test" }) as any
const description = (name: string): string => server._registeredTools[name]?.description ?? ""
const publicTools: string[] = Object.keys(server._registeredTools).filter(
  (n) => !n.startsWith("talonic_admin_") && !n.startsWith("talonic_growth_"),
)

describe("server instructions describe the tools, not the host", () => {
  const variants = [
    buildServerInstructions({ includeGenericExecutor: true }),
    buildServerInstructions({ includeGenericExecutor: false }),
  ]

  it.each([
    /registered and callable/i,
    /every turn/i,
    /you are mistaken/i,
    /invoke it anyway/i,
    /never tell the user/i,
    /unavailable/i,
    /\benable\b/i,
    /not in your toolset/i,
    /default tool/i,
    /the answer\b/i,
    /\bcheap/i,
    /prefer (it|using)/i,
  ])("never say %s", (re) => {
    for (const text of variants) expect(text).not.toMatch(re)
  })

  it("give the recommended call order: search, then document_id, then extract", () => {
    for (const text of variants) {
      const search = text.indexOf("talonic_search")
      const id = text.indexOf("document_id", search)
      const extract = text.indexOf("talonic_extract", id)
      expect(search).toBeGreaterThan(-1)
      expect(id).toBeGreaterThan(search)
      expect(extract).toBeGreaterThan(id)
    }
  })
})

describe("tool descriptions name no other chat client", () => {
  it.each(publicTools)("%s", (name) => {
    expect(description(name)).not.toMatch(/chatgpt|openai/i)
  })
})

describe("talonic_extract describes what it returns", () => {
  const d = description("talonic_extract")

  it.each([/default tool/i, /the answer\b/i, /\bcheap\b/i, /prefer/i])(
    "is not framed as %s",
    (re) => {
      expect(d).not.toMatch(re)
    },
  )

  it("names schema-validated JSON, per-field confidence and provenance", () => {
    expect(d).toMatch(/schema-validated JSON/)
    expect(d).toMatch(/per-field confidence/)
    expect(d).toMatch(/provenance/)
  })
})

describe("talonic_invoke_agent_tool states what every credential can invoke", () => {
  const d = description("talonic_invoke_agent_tool")

  it("covers OAuth sessions as well as API keys", () => {
    expect(d).toMatch(/OAuth/)
    expect(d).toMatch(/API key/)
  })

  it("names the read-only capability both run under", () => {
    expect(d).toMatch(/data\.read/)
    expect(d).toMatch(/never (changes|mutates|writes)/i)
  })

  it("is annotated read-only to match", () => {
    expect(server._registeredTools["talonic_invoke_agent_tool"].annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    })
  })
})
