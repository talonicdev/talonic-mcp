import { describe, expect, it } from "vitest"
import { ApiHttpError, hintForStatus, toolError } from "../../src/tools/_shared"

describe("tool error next-step hints", () => {
  it("tells the model what to do for each status a model can hit", () => {
    expect(hintForStatus(401)).toMatch(/reconnect/i)
    expect(hintForStatus(402)).toMatch(/credits/i)
    expect(hintForStatus(403)).toMatch(/permission/i)
    expect(hintForStatus(404)).toMatch(/list or search tool/i)
    expect(hintForStatus(503)).toMatch(/Retry once/)
    expect(hintForStatus(302)).toBeNull()
  })

  it("never labels an expected API refusal as unexpected", () => {
    const res = toolError(new ApiHttpError(402, '{"error":"insufficient_credits"}'))
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).not.toMatch(/Unexpected/)
    expect(res.content[0]!.text).toContain("HTTP 402")
    expect(res.content[0]!.text).toMatch(/top up/)
  })

  it("explains a timeout", () => {
    const err = new Error("The operation was aborted due to timeout")
    err.name = "TimeoutError"
    expect(toolError(err).content[0]!.text).toMatch(/did not answer in time/)
  })
})
