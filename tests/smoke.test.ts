import { describe, expect, it, vi } from "vitest"
import { Talonic } from "@talonic/node"
import { SERVER_NAME, VERSION, createServer } from "../src/index"
import { main } from "../src/server"

describe("@talonic/mcp scaffold", () => {
  it("exports a stable VERSION and SERVER_NAME", () => {
    expect(VERSION).toBe("0.1.2")
    expect(SERVER_NAME).toBe("talonic")
  })

  it("createServer returns an MCP server instance", () => {
    const server = createServer({ apiKey: "tlnc_test" })
    expect(server).toBeDefined()
    expect(typeof server.connect).toBe("function")
  })

  it("createServer accepts a pre-built Talonic client", () => {
    const fetchFn = vi.fn()
    const talonic = new Talonic({
      apiKey: "tlnc_test",
      fetch: fetchFn as unknown as typeof fetch,
    })
    const server = createServer({ apiKey: "ignored", talonic })
    expect(server).toBeDefined()
  })

  it("createServer accepts a custom baseUrl", () => {
    const server = createServer({
      apiKey: "tlnc_test",
      baseUrl: "https://staging.api.talonic.com",
    })
    expect(server).toBeDefined()
  })
})

describe("server entry: main()", () => {
  it("--version prints name and version and exits 0", async () => {
    const out = vi.fn()
    const code = await main(["--version"], {}, out)
    expect(code).toBe(0)
    expect(out).toHaveBeenCalledOnce()
    expect(out.mock.calls[0]?.[0]).toContain(SERVER_NAME)
    expect(out.mock.calls[0]?.[0]).toContain(VERSION)
  })

  it("--help prints usage and exits 0", async () => {
    const out = vi.fn()
    const code = await main(["--help"], {}, out)
    expect(code).toBe(0)
    expect(out.mock.calls[0]?.[0]).toContain("USAGE")
    expect(out.mock.calls[0]?.[0]).toContain("TALONIC_API_KEY")
  })

  it("missing TALONIC_API_KEY exits 1 with a clear error", async () => {
    const err = vi.fn()
    const code = await main([], {}, () => {}, err)
    expect(code).toBe(1)
    expect(err.mock.calls[0]?.[0]).toMatch(/TALONIC_API_KEY/)
  })
})
