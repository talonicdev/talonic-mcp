import { describe, it, expect, vi } from "vitest"
import { makeTaggedFetch } from "../src/server-factory.js"
import { VERSION } from "../src/version.js"

describe("makeTaggedFetch", () => {
  it("appends the known client name to the UA", async () => {
    const base = vi.fn(async () => new Response("{}"))
    const tagged = makeTaggedFetch(() => "Cursor", base as unknown as typeof fetch)
    await tagged("https://api.talonic.com/v1/extract", {})
    const ua = new Headers((base.mock.calls[0][1] as RequestInit).headers).get("user-agent")
    expect(ua).toBe(`talonic-mcp/${VERSION} Cursor`)
  })

  it("sends talonic-mcp/<v> with no suffix when the client is unknown, and never throws", async () => {
    const base = vi.fn(async () => new Response("{}"))
    const tagged = makeTaggedFetch(() => undefined, base as unknown as typeof fetch)
    await expect(tagged("https://api.talonic.com/v1/extract")).resolves.toBeInstanceOf(Response)
    const ua = new Headers((base.mock.calls[0][1] as RequestInit).headers).get("user-agent")
    expect(ua).toBe(`talonic-mcp/${VERSION}`)
  })
})
