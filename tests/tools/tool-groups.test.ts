import { afterEach, describe, expect, it, vi } from "vitest"
import { buildRequest, routeParams } from "../../src/tools/_groups"
import { TOOL_GROUPS, TOOL_GROUP_KEYS, probeToolGroups } from "../../src/tools/tool-groups"
import { createServer } from "../../src/server-factory"
import { getMcpSection, MCP_NAV_SECTIONS } from "../../src/content/index"

afterEach(() => vi.unstubAllGlobals())

/** DELETE routes that withdraw an assignment or a confirmation; the same tool family redoes them. */
const REVERSIBLE_DELETES = new Set([
  "talonic_transport_folders_unassign",
  "talonic_transport_folders_unconfirm_load",
])

const ALL_TOOLS = TOOL_GROUPS.flatMap((g) => g.tools.map((t) => [g.key, t] as const))

/**
 * _common rule 6: public text names no AI models, processing vendors or
 * internal mechanics. Literal field names in backticks are allowed, so code
 * spans are stripped before matching.
 */
const FORBIDDEN =
  /\b(llms?|gpt|openai|anthropic|gemini|mistral|azure|textract|ai models?|language models?|embeddings?|vectors?|n-shot|few-shot|clusters?|ontolog\w*|semantic layer|prompts?|tiers?|indexe?s?|reindex\w*|pipeline phases?|wzb)\b/i
const prose = (s: string) => s.replace(/`[^`]*`/g, "")
/** The RETURNS / ERRORS lines are literal response shapes (field names), allowed by rule 6. */
const descriptionProse = (s: string) =>
  prose(
    s
      .split("\n")
      .filter((l) => !l.startsWith("RETURNS:") && !l.startsWith("ERRORS:"))
      .join("\n"),
  )

describe("probe-gated tool groups: structure", () => {
  it("has unique keys, and every group has tools", () => {
    expect(new Set(TOOL_GROUP_KEYS).size).toBe(TOOL_GROUP_KEYS.length)
    for (const g of TOOL_GROUPS) expect(g.tools.length, g.key).toBeGreaterThan(0)
  })

  it("registers every group at once without a name collision with the base tools", () => {
    const server = createServer({ apiKey: "tlnc_test", toolGroups: TOOL_GROUP_KEYS }) as any
    const names = Object.keys(server._registeredTools)
    for (const [, t] of ALL_TOOLS) expect(names).toContain(t.name)
    expect(new Set(ALL_TOOLS.map(([, t]) => t.name)).size).toBe(ALL_TOOLS.length)
  })

  it("lists none of them without the groups", () => {
    const names = Object.keys((createServer({ apiKey: "tlnc_test" }) as any)._registeredTools)
    for (const [, t] of ALL_TOOLS) expect(names).not.toContain(t.name)
  })

  it.each(ALL_TOOLS.map(([k, t]) => [`${k}/${t.name}`, t] as const))(
    "%s: route args exist in the schema and annotations match the verb",
    (_label, t) => {
      expect(t.name).toMatch(/^talonic_[a-z0-9_]+$/)
      expect(t.route).toMatch(/^(GET|POST|PUT|PATCH|DELETE) \/v1\/[^\s?]+$/)
      const keys = Object.keys(t.inputSchema)
      for (const p of routeParams(t.route)) expect(keys, `${t.route} needs \`${p}\``).toContain(p)
      const query = Array.isArray(t.query) ? t.query : Object.keys(t.query ?? {})
      for (const q of query) expect(keys).toContain(q)
      if (t.body && t.body !== "rest") {
        for (const b of Array.isArray(t.body) ? t.body : Object.keys(t.body))
          expect(keys).toContain(b)
      }
      const verb = t.route.split(" ")[0]
      if (verb === "GET") expect(t.annotations.readOnlyHint).toBe(true)
      if (verb === "DELETE") {
        expect(t.annotations.readOnlyHint).toBe(false)
        // A DELETE that only withdraws a step (and can be redone) is not destructive.
        if (!REVERSIBLE_DELETES.has(t.name)) expect(t.annotations.destructiveHint).toBe(true)
      }
      if (t.annotations.readOnlyHint) expect(t.annotations.destructiveHint).toBe(false)
    },
  )

  it.each(ALL_TOOLS.map(([k, t]) => [`${k}/${t.name}`, t] as const))(
    "%s: description is in the house format and follows rule 6",
    (_label, t) => {
      expect(t.description).toContain("USE WHEN:")
      expect(t.description).toContain("RETURNS:")
      expect(t.description.length).toBeLessThan(2500)
      expect(descriptionProse(t.description)).not.toMatch(FORBIDDEN)
      expect(prose(t.title)).not.toMatch(FORBIDDEN)
    },
  )
})

describe("probe-gated tool groups: docs", () => {
  const nav = MCP_NAV_SECTIONS.find((s) => s.id === "tool-groups")

  it.each(TOOL_GROUPS.map((g) => [g.key, g] as const))(
    "%s has a rendered docs section with a heading per tool, in the nav",
    (_key, g) => {
      const section = getMcpSection(g.docsSlug)
      expect(section, `no section ${g.docsSlug}`).not.toBeNull()
      expect(nav?.children?.map((c) => c.id)).toContain(g.docsSlug)
      const headings = section!.content.filter((b) => b.type === "heading").map((b) => b.text)
      for (const t of g.tools) expect(headings, `${g.docsSlug} lacks ${t.name}`).toContain(t.name)
      for (const b of section!.content) {
        const text = JSON.stringify(b)
        expect(prose(text), `${g.docsSlug}: ${text.slice(0, 120)}`).not.toMatch(FORBIDDEN)
      }
    },
  )
})

describe("buildRequest", () => {
  it("fills camelCase placeholders from snake_case args and encodes them", () => {
    const r = buildRequest(
      { route: "POST /v1/transport-folders/{folderId}/loads/{loadKey}/confirm", body: "rest" },
      { folder_id: "f/1", load_key: "L 2", note: "ok" },
    )
    expect(r).toEqual({
      method: "POST",
      path: "/v1/transport-folders/f%2F1/loads/L%202/confirm",
      params: {},
      body: { note: "ok" },
    })
  })

  it("renames query and body args and joins list query values", () => {
    const r = buildRequest(
      { route: "GET /v1/x", query: { search: "q", types: "type" } },
      { search: "acme", types: ["a", "b"], ignored: 1 },
    )
    expect(r.params).toEqual({ q: "acme", type: "a,b" })
    expect(r.body).toBeUndefined()
    const w = buildRequest(
      { route: "PATCH /v1/x/{id}", body: { new_name: "name" } },
      { id: "1", new_name: "n" },
    )
    expect(w.body).toEqual({ name: "n" })
  })

  it("sends an empty JSON body on a write without body args, and refuses a missing path arg", () => {
    expect(buildRequest({ route: "POST /v1/jobs/{id}/cancel" }, { id: "j" }).body).toEqual({})
    expect(() => buildRequest({ route: "DELETE /v1/webhooks/{id}" }, {})).toThrow(
      "`id` is required",
    )
  })
})

describe("probeToolGroups", () => {
  it("returns the keys whose probe answered 2xx; refusals and outages are left out", async () => {
    const [first, second, ...rest] = TOOL_GROUPS
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes(first!.probe.path)) return new Response("{}", { status: 200 })
      if (url.includes(second!.probe.path)) return new Response("{}", { status: 503 })
      return new Response("{}", { status: 403 })
    })
    vi.stubGlobal("fetch", fetchMock)
    expect(await probeToolGroups("tlnc_k")).toEqual([first!.key])
    expect(fetchMock).toHaveBeenCalledTimes(2 + rest.length)
  })

  it("never throws on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    await expect(probeToolGroups("tlnc_k")).resolves.toEqual([])
  })
})

describe("toolGroupsAccessCached (hosted)", () => {
  it("asks each group's probe once per token within the cache window", async () => {
    const { toolGroupsAccessCached } = await import("../../src/http-server")
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/v1/aggregate/catalog")
        ? new Response("{}", { status: 200 })
        : new Response("{}", { status: 404 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    expect(await toolGroupsAccessCached("tok-groups")).toEqual(["aggregate"])
    const calls = fetchMock.mock.calls.length
    expect(calls).toBe(TOOL_GROUPS.length)
    expect(await toolGroupsAccessCached("tok-groups")).toEqual(["aggregate"])
    expect(fetchMock.mock.calls.length).toBe(calls)
  })
})
