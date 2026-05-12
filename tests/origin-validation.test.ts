import { describe, it, expect } from "vitest"
import { isOriginAllowed } from "../src/origin.js"

describe("isOriginAllowed (Origin allowlist for DNS-rebinding mitigation)", () => {
  it("accepts missing Origin (native and server-to-server clients)", () => {
    expect(isOriginAllowed(undefined)).toBe(true)
    expect(isOriginAllowed("")).toBe(true)
  })

  it("accepts each Claude.ai variant", () => {
    expect(isOriginAllowed("https://claude.ai")).toBe(true)
    expect(isOriginAllowed("https://www.claude.ai")).toBe(true)
    expect(isOriginAllowed("https://app.claude.ai")).toBe(true)
  })

  it("accepts each allowlisted MCP-directory surface", () => {
    expect(isOriginAllowed("https://cursor.directory")).toBe(true)
    expect(isOriginAllowed("https://glama.ai")).toBe(true)
    expect(isOriginAllowed("https://mcp.so")).toBe(true)
    expect(isOriginAllowed("https://smithery.ai")).toBe(true)
  })

  it("rejects an unknown Origin", () => {
    expect(isOriginAllowed("https://evil.example.com")).toBe(false)
  })

  it("rejects a near-miss (extra subdomain, different TLD, http instead of https)", () => {
    expect(isOriginAllowed("https://api.claude.ai")).toBe(false)
    expect(isOriginAllowed("https://claude.com")).toBe(false)
    expect(isOriginAllowed("http://claude.ai")).toBe(false)
  })

  it("is case-sensitive on the Origin string (browsers always send lower-case scheme/host)", () => {
    expect(isOriginAllowed("https://Claude.ai")).toBe(false)
    expect(isOriginAllowed("HTTPS://claude.ai")).toBe(false)
  })

  it("rejects an Origin with a path or trailing slash (Origin should be scheme+host only)", () => {
    expect(isOriginAllowed("https://claude.ai/")).toBe(false)
    expect(isOriginAllowed("https://claude.ai/some/path")).toBe(false)
  })
})
