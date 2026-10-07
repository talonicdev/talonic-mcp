import { describe, expect, it } from "vitest"
import { buildServerInstructions, createServer } from "../src/server-factory"
import { isOpenAiClient } from "../src/http-server"

// OpenAI's plugin review (developers.openai.com/plugins/plugin-guidelines)
// held the 2026-10-07 scan on: the server instructions, the generic
// list/invoke executor, and two under-annotated irreversible writes.

describe("isOpenAiClient", () => {
  it.each([
    ["openai-mcp/1.0.0", true],
    ["ChatGPT-User/1.0", true],
    ["Mozilla/5.0 (compatible; OpenAI-Plugins-Scanner)", true],
    ["claude-ai/1.0", false],
    ["", false],
    [undefined, false],
  ])("%s -> %s", (ua, expected) => {
    expect(isOpenAiClient(ua)).toBe(expected)
  })
})

describe("generic executor visibility", () => {
  const names = (opts: Parameters<typeof createServer>[0]) =>
    Object.keys((createServer(opts) as any)._registeredTools)

  it("is listed by default", () => {
    const tools = names({ apiKey: "tlnc_test" })
    expect(tools).toContain("talonic_list_agent_tools")
    expect(tools).toContain("talonic_invoke_agent_tool")
  })

  it("is omitted with includeGenericExecutor:false, find_data stays", () => {
    const tools = names({ apiKey: "tlnc_test", includeGenericExecutor: false })
    expect(tools).not.toContain("talonic_list_agent_tools")
    expect(tools).not.toContain("talonic_invoke_agent_tool")
    expect(tools).toContain("talonic_find_data")
  })
})

describe("server instructions", () => {
  const withExec = buildServerInstructions({ includeGenericExecutor: true })
  const withoutExec = buildServerInstructions({ includeGenericExecutor: false })

  it.each([
    /you are mistaken/i,
    /invoke it anyway/i,
    /never tell the user/i,
    /free tier/i,
    /cheap/i,
    /\bANY document\b/,
    /more reliable than/i,
    /prefer (it|using)/i,
  ])("contain no steering or pricing language: %s", (re) => {
    expect(withExec).not.toMatch(re)
  })

  it("only mention the executor when it is registered", () => {
    expect(withExec).toContain("talonic_invoke_agent_tool")
    expect(withoutExec).not.toContain("talonic_invoke_agent_tool")
    expect(withoutExec).not.toContain("talonic_list_agent_tools")
  })
})

describe("irreversible writes are annotated destructive", () => {
  const tools = (createServer({ apiKey: "tlnc_test", includeContractsTools: true }) as any)
    ._registeredTools

  it.each(["talonic_fail_decision_task", "talonic_contracts_set_term"])("%s", (name) => {
    expect(tools[name]?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
    })
  })
})
