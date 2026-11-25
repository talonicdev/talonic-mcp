import { afterEach, describe, expect, it, vi } from "vitest"
import {
  CONFIRM_MAX_ROLES,
  PARTIES_POLL_INTERVAL_MS,
  PARTIES_TOOL_NAMES,
  handleAddressChoice,
  handleConfirm,
  handleContract,
  handleDirectoryLink,
  handleGroupCompanies,
  handleIssues,
  handleMembers,
  handleMerge,
  handleNames,
  handleParty,
  handlePartySection,
  handleRead,
  handleSearch,
  handleSetRole,
  handleStatus,
  handleSync,
  probePartiesAccess,
} from "../../src/tools/parties"
import { createServer } from "../../src/server-factory"
import { partiesAccessCached } from "../../src/http-server"

const PRODUCT = "11111111-1111-4111-8111-111111111111"
const ROW = "rec_0042/7"
const ROW_PATH = `rows/${PRODUCT}/${encodeURIComponent(ROW)}`
const NAME = "66666666-6666-4666-8666-666666666666"
const PARTY = "22222222-2222-4222-8222-222222222222"
const OTHER = "33333333-3333-4333-8333-333333333333"
const ROLE = "44444444-4444-4444-8444-444444444444"
const MEMBER = "55555555-5555-4555-8555-555555555555"
const API = "https://api.talonic.com/v1/parties"
const token = () => "tlnc_key"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

/** Stub fetch with one response per call (the last one repeats). */
function stub(...responses: Array<unknown | Response>) {
  const queue = responses.length ? responses : [{}]
  let i = 0
  const fetchMock = vi.fn().mockImplementation(async () => {
    const r = queue[Math.min(i++, queue.length - 1)]
    return r instanceof Response ? r.clone() : jsonResponse(r)
  })
  vi.stubGlobal("fetch", fetchMock)
  return (n = 0) => {
    const [url, init] = fetchMock.mock.calls[n] as [string, RequestInit]
    return {
      url,
      method: init.method,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      auth: new Headers(init.headers).get("authorization"),
      count: fetchMock.mock.calls.length,
    }
  }
}

/** A clock the injected sleep advances. */
function clock() {
  let t = 0
  const sleeps: number[] = []
  return {
    sleeps,
    deps: {
      now: () => t,
      sleep: async (ms: number) => {
        sleeps.push(ms)
        t += ms
      },
    },
  }
}

const parse = (res: { content: Array<{ type: string; text?: string }> }) =>
  JSON.parse(res.content[0]!.text!)

afterEach(() => vi.unstubAllGlobals())

/**
 * The seven request forms 0.1.103 sent, none of which the platform serves:
 * `GET issues` and `GET contracts` fell into `GET :id` and came back as
 * "party not found". No tool may send any of them again.
 */
const OBSOLETE = [
  ["GET", /\/v1\/parties\/issues(\?|$)/],
  ["GET", /\/v1\/parties\/contracts(\?|$)/],
  ["GET", /\/v1\/parties\/contracts\/[^/?]+(\?|$)/],
  ["POST", /\/v1\/parties\/contracts\/[^/]+\/roles$/],
  ["POST", /\/v1\/parties\/roles\/confirm$/],
  ["POST", /\/v1\/parties\/read$/],
  ["GET", /\/v1\/parties\/read\/status$/],
] as const

describe("the seven obsolete parties request forms are gone", () => {
  // Every argument shape that used to reach one of them, and the new forms around them.
  const cases: Array<[string, () => Promise<unknown>]> = [
    ["issues", () => handleIssues(token, undefined, {})],
    ["issues filtered", () => handleIssues(token, undefined, { query: "x", kind: "company" })],
    ["contracts", () => handlePartySection(token, undefined, "contracts", { party_id: PARTY })],
    ["contract", () => handleContract(token, undefined, { product_id: PRODUCT, row_id: ROW })],
    [
      "set_role add",
      () =>
        handleSetRole(token, undefined, {
          product_id: PRODUCT,
          row_id: ROW,
          party_id: PARTY,
          role: "partner",
        }),
    ],
    [
      "set_role change",
      () => handleSetRole(token, undefined, { role_id: ROLE, state: "rejected" }),
    ],
    ["confirm", () => handleConfirm(token, undefined, { role_ids: [ROLE] })],
    ["read one", () => handleRead(token, undefined, { product_id: PRODUCT, row_id: ROW })],
    [
      "read one, status",
      () => handleRead(token, undefined, { product_id: PRODUCT, row_id: ROW, status: true }),
    ],
    ["read queue", () => handleRead(token, undefined, { status: true })],
    ["sync", () => handleSync(token, undefined, {})],
  ]

  it.each(cases)("%s sends none of them", async (_name, run) => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse({ read: null }))
    vi.stubGlobal("fetch", fetchMock)
    await run()
    expect(fetchMock).toHaveBeenCalled()
    for (const [url, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
      for (const [method, re] of OBSOLETE) {
        expect(init.method === method && re.test(url), `${init.method} ${url}`).toBe(false)
      }
    }
  })

  it("no source string in parties.ts names an obsolete route", async () => {
    const { readFileSync } = await import("node:fs")
    const src = readFileSync(new URL("../../src/tools/parties.ts", import.meta.url), "utf8")
    for (const bad of [
      '"/v1/parties/issues"',
      '"/v1/parties/contracts"',
      "`/v1/parties/contracts/",
      '"/v1/parties/roles/confirm"',
      '"/v1/parties/read"',
      '"/v1/parties/read/status"',
    ]) {
      expect(src, bad).not.toContain(bad)
    }
  })
})

describe("parties reads", () => {
  it("status is a plain read with the bearer, against a custom base too", async () => {
    let call = stub({ rows: 3 })
    await handleStatus(token, undefined)
    expect(call()).toMatchObject({ url: `${API}/status`, method: "GET", auth: "Bearer tlnc_key" })
    call = stub({ rows: 3 })
    await handleStatus(token, "https://api.example.test")
    expect(call().url).toBe("https://api.example.test/v1/parties/status")
  })

  it("issues lists the parties needing attention, every party by default", async () => {
    let call = stub({ total: 0, data: [] })
    await handleIssues(token, undefined, {})
    expect(call()).toMatchObject({ method: "GET", url: `${API}?attention=true&scope=all` })
    call = stub({ total: 0, data: [] })
    await handleIssues(token, undefined, {
      scope: "partners",
      query: "Müller",
      kind: "person",
      product_id: PRODUCT,
      limit: 50,
      offset: 100,
    })
    expect(call().url).toBe(
      `${API}?attention=true&q=M%C3%BCller&kind=person&product_id=${PRODUCT}&limit=50&offset=100`,
    )
  })

  it("contract reads one row, encoding the row id, on a day when given", async () => {
    let call = stub({ row: { row_id: ROW } })
    await handleContract(token, undefined, { product_id: PRODUCT, row_id: ROW })
    expect(call()).toMatchObject({ method: "GET", url: `${API}/${ROW_PATH}` })
    expect(call().url).toContain("rec_0042%2F7")
    call = stub({ row: { row_id: ROW } })
    await handleContract(token, undefined, { product_id: PRODUCT, row_id: ROW, on: "2026-01-31" })
    expect(call().url).toBe(`${API}/${ROW_PATH}?on=2026-01-31`)
  })

  it.each(["contracts", "documents", "history"] as const)(
    "%s pages one party's list",
    async (section) => {
      let call = stub({ total: 0, offset: 0, limit: 50, data: [] })
      await handlePartySection(token, undefined, section, { party_id: PARTY })
      expect(call()).toMatchObject({ method: "GET", url: `${API}/${PARTY}/${section}` })
      call = stub({ total: 0, data: [] })
      await handlePartySection(token, undefined, section, {
        party_id: PARTY,
        product_id: PRODUCT,
        limit: 20,
        offset: 40,
      })
      expect(call().url).toBe(`${API}/${PARTY}/${section}?product_id=${PRODUCT}&limit=20&offset=40`)
    },
  )

  it("search lists the register with q, kind, scope and paging", async () => {
    let call = stub({ total: 0, data: [] })
    await handleSearch(token, undefined, {
      query: "WEG Lindenweg",
      kind: "owners_association",
      limit: 10,
    })
    expect(call()).toMatchObject({
      method: "GET",
      url: `${API}?q=WEG+Lindenweg&kind=owners_association&limit=10`,
    })
    call = stub({ total: 0, data: [] })
    await handleSearch(token, undefined, { scope: "all", offset: 200 })
    expect(call().url).toBe(`${API}?scope=all&offset=200`)
  })
})

describe("parties roles", () => {
  it("product_id + row_id + party_id + role adds a role on the row", async () => {
    const call = stub({ id: ROLE })
    await handleSetRole(token, undefined, {
      product_id: PRODUCT,
      row_id: ROW,
      party_id: PARTY,
      role: "tenant",
      enters_contract: true,
      valid_from: "2026-01-01",
      valid_to: "2026-12-31",
      note: "Mietvertrag §3",
    })
    expect(call()).toMatchObject({
      method: "POST",
      url: `${API}/${ROW_PATH}/roles`,
      body: {
        party_id: PARTY,
        role: "tenant",
        enters_contract: true,
        valid_from: "2026-01-01",
        valid_to: "2026-12-31",
        note: "Mietvertrag §3",
      },
    })
    expect(call().body).not.toHaveProperty("product_id")
    expect(call().body).not.toHaveProperty("row_id")
  })

  it("adding needs both row ids, party_id and role", async () => {
    const call = stub({})
    for (const args of [
      { product_id: PRODUCT, party_id: PARTY, role: "partner" },
      { row_id: ROW, party_id: PARTY, role: "partner" },
      { product_id: PRODUCT, row_id: ROW, role: "partner" },
      { product_id: PRODUCT, row_id: ROW, party_id: PARTY },
    ]) {
      const res = await handleSetRole(token, undefined, args)
      expect(res.isError, JSON.stringify(args)).toBe(true)
    }
    expect(() => call()).toThrow()
  })

  it("role_id patches the row (the edit branch is unchanged): reject, or clear a period with null", async () => {
    let call = stub({ id: ROLE })
    await handleSetRole(token, undefined, { role_id: ROLE, state: "rejected" })
    expect(call()).toMatchObject({
      method: "PATCH",
      url: `${API}/roles/${ROLE}`,
      body: { state: "rejected" },
    })
    call = stub({ id: ROLE })
    await handleSetRole(token, undefined, { role_id: ROLE, valid_to: null, party_id: OTHER })
    expect(call().body).toEqual({ valid_to: null, party_id: OTHER })
  })

  it("role_id with nothing to change, or both an add and a change, fails before any call", async () => {
    const call = stub({})
    let res = await handleSetRole(token, undefined, { role_id: ROLE })
    expect(res.isError).toBe(true)
    res = await handleSetRole(token, undefined, {
      role_id: ROLE,
      product_id: PRODUCT,
      row_id: ROW,
      party_id: PARTY,
      role: "partner",
    })
    expect(res.isError).toBe(true)
    res = await handleSetRole(token, undefined, {})
    expect(res.isError).toBe(true)
    expect(() => call()).toThrow()
  })

  it("a role clash comes back as a tool error", async () => {
    stub(jsonResponse({ message: "The party already holds this role on the contract." }, 409))
    const res = await handleSetRole(token, undefined, { role_id: ROLE, role: "partner" })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("already holds this role")
  })

  it("confirm patches each named role to confirmed and reports each", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: ROLE, state: "confirmed" }))
      .mockResolvedValueOnce(jsonResponse({ message: "Role not found" }, 404))
    vi.stubGlobal("fetch", fetchMock)
    const res = await handleConfirm(token, undefined, {
      role_ids: [ROLE, OTHER, ROLE],
      note: "checked with the user",
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>
    expect(calls.map(([u, i]) => `${i.method} ${u}`)).toEqual([
      `PATCH ${API}/roles/${ROLE}`,
      `PATCH ${API}/roles/${OTHER}`,
    ])
    expect(JSON.parse(String(calls[0]![1].body))).toEqual({
      state: "confirmed",
      note: "checked with the user",
    })
    const out = parse(res)
    expect(out).toMatchObject({ confirmed: 1, failed: 1 })
    expect(out.rows[0]).toMatchObject({ role_id: ROLE, ok: true, role: { state: "confirmed" } })
    expect(out.rows[1]).toMatchObject({ role_id: OTHER, ok: false })
    expect(out.rows[1].error).toContain("Role not found")
  })

  it("confirm caps the list and needs one id", async () => {
    expect(CONFIRM_MAX_ROLES).toBe(200)
    const call = stub({})
    const res = await handleConfirm(token, undefined, { role_ids: [] })
    expect(res.isError).toBe(true)
    expect(() => call()).toThrow()
  })

  it("merge posts into and dry_run; a self-merge fails before any call", async () => {
    let call = stub({ dry_run: true, moves: 3, combined: 1 })
    await handleMerge(token, undefined, { party_id: PARTY, into: OTHER, dry_run: true })
    expect(call()).toMatchObject({
      method: "POST",
      url: `${API}/${PARTY}/merge`,
      body: { into: OTHER, dry_run: true },
    })
    call = stub({ dry_run: false })
    await handleMerge(token, undefined, { party_id: PARTY, into: OTHER })
    expect(call().body).toEqual({ into: OTHER, dry_run: false })
    call = stub({})
    const res = await handleMerge(token, undefined, { party_id: PARTY, into: PARTY })
    expect(res.isError).toBe(true)
    expect(() => call()).toThrow()
  })
})

describe("parties document read and sync", () => {
  it("queues one contract's read and returns at once without a wait", async () => {
    const call = stub({ status: "pending" })
    const res = await handleRead(token, undefined, { product_id: PRODUCT, row_id: ROW })
    expect(call()).toMatchObject({ method: "POST", url: `${API}/${ROW_PATH}/read` })
    expect(call().body).toBeUndefined()
    expect(call().count).toBe(1)
    expect(parse(res)).toEqual({ status: "pending" })
  })

  it("waits by polling the row until the read is done", async () => {
    const c = clock()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "pending" }))
      .mockResolvedValueOnce(jsonResponse({ read: { status: "pending" } }))
      .mockResolvedValueOnce(jsonResponse({ read: { status: "running" } }))
      .mockResolvedValueOnce(jsonResponse({ read: { status: "done", read_at: "2026-11-25" } }))
    vi.stubGlobal("fetch", fetchMock)
    const res = await handleRead(
      token,
      undefined,
      { product_id: PRODUCT, row_id: ROW, wait_seconds: 60 },
      c.deps,
    )
    const urls = (fetchMock.mock.calls as Array<[string, RequestInit]>).map(
      ([u, i]) => `${i.method} ${u}`,
    )
    expect(urls).toEqual([
      `POST ${API}/${ROW_PATH}/read`,
      `GET ${API}/${ROW_PATH}`,
      `GET ${API}/${ROW_PATH}`,
      `GET ${API}/${ROW_PATH}`,
    ])
    expect(c.sleeps).toEqual([PARTIES_POLL_INTERVAL_MS, PARTIES_POLL_INTERVAL_MS])
    const out = parse(res)
    expect(out).toMatchObject({
      status: "pending",
      read: { status: "done" },
      still_running: false,
      waited_ms: 10_000,
    })
    expect(out.next).toContain("talonic_parties_contract")
  })

  it("a failed read is terminal: the wait stops and says so", async () => {
    const c = clock()
    stub({ status: "pending" }, { read: { status: "failed", error: "no text" } })
    const out = parse(
      await handleRead(
        token,
        undefined,
        { product_id: PRODUCT, row_id: ROW, wait_seconds: 60 },
        c.deps,
      ),
    )
    expect(out).toMatchObject({ read: { status: "failed" }, still_running: false })
    expect(out.next).toContain("failed")
    expect(c.sleeps).toEqual([])
  })

  it("stops at the wait limit and says it is still running", async () => {
    const c = clock()
    stub({ status: "pending" }, { read: { status: "running" } })
    const out = parse(
      await handleRead(
        token,
        undefined,
        { product_id: PRODUCT, row_id: ROW, wait_seconds: 12 },
        c.deps,
      ),
    )
    expect(out.still_running).toBe(true)
    expect(out.waited_ms).toBe(12_000)
    expect(out.next).toContain("status: true")
  })

  it("status: true on a contract only reads its state; with no contract, the queue", async () => {
    let call = stub({ read: { status: "done" } })
    let out = parse(
      await handleRead(token, undefined, { product_id: PRODUCT, row_id: ROW, status: true }),
    )
    expect(call()).toMatchObject({ method: "GET", url: `${API}/${ROW_PATH}` })
    expect(call().count).toBe(1)
    expect(out).toEqual({ status: "done" })
    call = stub({ reads: { pending: 1, running: 0, done: 4, failed: 0 }, rows: 5, rows_read: 4 })
    out = parse(await handleRead(token, undefined, { status: true }))
    expect(call()).toMatchObject({ method: "GET", url: `${API}/status` })
    expect(out).toEqual({
      reads: { pending: 1, running: 0, done: 4, failed: 0 },
      rows: 5,
      rows_read: 4,
    })
  })

  it("the queue wait polls the status until nothing is pending or running", async () => {
    const c = clock()
    stub({ reads: { pending: 2, running: 1 } }, { reads: { pending: 0, running: 0, done: 3 } })
    const out = parse(
      await handleRead(token, undefined, { status: true, wait_seconds: 30 }, c.deps),
    )
    expect(out).toMatchObject({ reads: { done: 3 }, still_running: false })
    expect(c.sleeps).toEqual([PARTIES_POLL_INTERVAL_MS])
  })

  it("a poll failure ends the wait with the last state, not an error", async () => {
    const c = clock()
    stub(
      { status: "pending" },
      { read: { status: "running" } },
      jsonResponse({ message: "boom" }, 500),
    )
    const res = await handleRead(
      token,
      undefined,
      { product_id: PRODUCT, row_id: ROW, wait_seconds: 60 },
      c.deps,
    )
    expect(res.isError).toBeFalsy()
    const out = parse(res)
    expect(out.still_running).toBe(true)
    expect(out.poll_error).toContain("500")
  })

  it("the bulk read is gone: no contract and no status fails before any call, pointing at sync", async () => {
    const call = stub({})
    let res = await handleRead(token, undefined, {})
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("talonic_parties_sync")
    res = await handleRead(token, undefined, { product_id: PRODUCT })
    expect(res.isError).toBe(true)
    expect(() => call()).toThrow()
  })

  it("a contract without documents comes back as a tool error", async () => {
    stub(jsonResponse({ message: "This contract has no documents to read." }, 422))
    const res = await handleRead(token, undefined, { product_id: PRODUCT, row_id: ROW })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("no documents to read")
  })

  it("sync asks for a full pass, or fills the named rows", async () => {
    let call = stub({ started: true })
    let res = await handleSync(token, undefined, {})
    expect(call()).toMatchObject({ method: "POST", url: `${API}/sync`, body: {} })
    expect(parse(res)).toEqual({ started: true })
    call = stub({ started: true })
    res = await handleSync(token, undefined, { row_ids: [ROW], wait_seconds: 30 })
    expect(call()).toMatchObject({ body: { row_ids: [ROW] } })
    expect(call().count).toBe(1)
  })

  it("sync waits on the status until syncing is false", async () => {
    const c = clock()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ started: true }))
      .mockResolvedValueOnce(jsonResponse({ syncing: true }))
      .mockResolvedValueOnce(
        jsonResponse({ syncing: false, synced_at: "2026-11-25T08:00:00Z", rows: 9 }),
      )
    vi.stubGlobal("fetch", fetchMock)
    const out = parse(await handleSync(token, undefined, { wait_seconds: 60 }, c.deps))
    expect((fetchMock.mock.calls as Array<[string, RequestInit]>).map(([u]) => u)).toEqual([
      `${API}/sync`,
      `${API}/status`,
      `${API}/status`,
    ])
    expect(out).toMatchObject({
      started: true,
      syncing: false,
      synced_at: "2026-11-25T08:00:00Z",
      rows: 9,
      still_running: false,
    })
  })
})

describe("parties names, directory link, address choice", () => {
  it("names adds an alias or a former name with its end day", async () => {
    let call = stub({ id: NAME })
    await handleNames(token, undefined, { party_id: PARTY, name: "Muster AG", kind: "alias" })
    expect(call()).toMatchObject({
      method: "POST",
      url: `${API}/${PARTY}/names`,
      body: { name: "Muster AG", kind: "alias" },
    })
    call = stub({ id: NAME })
    await handleNames(token, undefined, {
      party_id: PARTY,
      name: "Muster GmbH",
      kind: "former",
      valid_to: "2024-06-30",
      note: "Umfirmierung",
    })
    expect(call().body).toEqual({
      name: "Muster GmbH",
      kind: "former",
      valid_to: "2024-06-30",
      note: "Umfirmierung",
    })
  })

  it("names decides with PATCH or removes with DELETE by name_id", async () => {
    let call = stub({ id: NAME, state: "rejected" })
    await handleNames(token, undefined, { name_id: NAME, state: "rejected" })
    expect(call()).toMatchObject({
      method: "PATCH",
      url: `${API}/names/${NAME}`,
      body: { state: "rejected" },
    })
    call = stub({ deleted: true })
    await handleNames(token, undefined, { name_id: NAME, remove: true })
    expect(call()).toMatchObject({ method: "DELETE", url: `${API}/names/${NAME}` })
  })

  it("names refuses mixed or incomplete arguments before any call", async () => {
    const call = stub({})
    for (const args of [
      {},
      { party_id: PARTY, name: "X" },
      { name_id: NAME },
      { name_id: NAME, state: "confirmed" as const, remove: true },
      { name_id: NAME, party_id: PARTY, state: "confirmed" as const },
      { party_id: PARTY, name: "X", kind: "alias" as const, valid_to: "2024-01-01" },
    ]) {
      const res = await handleNames(token, undefined, args)
      expect(res.isError, JSON.stringify(args)).toBe(true)
    }
    expect(() => call()).toThrow()
  })

  it("directory_link links to an entry, or unlinks with null", async () => {
    let call = stub({ state: "linked" })
    await handleDirectoryLink(token, undefined, {
      party_id: PARTY,
      external_id: "ACC-0042",
      kind: "company",
    })
    expect(call()).toMatchObject({
      method: "POST",
      url: `${API}/${PARTY}/directory-link`,
      body: { external_id: "ACC-0042", kind: "company" },
    })
    call = stub({ state: "none" })
    await handleDirectoryLink(token, undefined, { party_id: PARTY, external_id: null })
    expect(call().body).toEqual({ external_id: null })
  })

  it("address_choice posts the choice", async () => {
    const call = stub({ address_choice: "crm" })
    await handleAddressChoice(token, undefined, { party_id: PARTY, choice: "crm" })
    expect(call()).toMatchObject({
      method: "POST",
      url: `${API}/${PARTY}/address-choice`,
      body: { choice: "crm" },
    })
  })
})

describe("parties party", () => {
  it("party_id alone reads the party", async () => {
    const call = stub({ party: { id: PARTY } })
    await handleParty(token, undefined, { party_id: PARTY })
    expect(call()).toMatchObject({ method: "GET", url: `${API}/${PARTY}` })
    expect(call().body).toBeUndefined()
  })

  it("party_id with overview / product_id reads the short view of one product", async () => {
    const call = stub({ party: { id: PARTY } })
    await handleParty(token, undefined, { party_id: PARTY, overview: true, product_id: PRODUCT })
    expect(call()).toMatchObject({
      method: "GET",
      url: `${API}/${PARTY}?view=overview&product_id=${PRODUCT}`,
    })
  })

  it("party_id with fields patches only the given fields (null clears)", async () => {
    const call = stub({ id: PARTY })
    await handleParty(token, undefined, {
      party_id: PARTY,
      kind: "person",
      salutation: "frau",
      street: "Lindenweg 4",
      phone: null,
    })
    expect(call()).toMatchObject({
      method: "PATCH",
      url: `${API}/${PARTY}`,
      body: { kind: "person", salutation: "frau", street: "Lindenweg 4", phone: null },
    })
    expect(call().body).not.toHaveProperty("display_name")
  })

  it("without party_id creates with display_name and the fields", async () => {
    const call = stub({ id: PARTY })
    await handleParty(token, undefined, {
      display_name: "Musterfirma AG",
      postcode: "10115",
      external_refs: { debitor: "10042" },
    })
    expect(call()).toMatchObject({
      method: "POST",
      url: API,
      body: {
        display_name: "Musterfirma AG",
        postcode: "10115",
        external_refs: { debitor: "10042" },
      },
    })
  })

  it("without party_id and display_name fails before any call", async () => {
    const call = stub({})
    const res = await handleParty(token, undefined, { town: "Berlin" })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("Validation error")
    expect(() => call()).toThrow()
  })

  it("an edit of a merged party comes back as a tool error", async () => {
    stub(jsonResponse({ message: "This party was merged into another one; edit that one." }, 422))
    const res = await handleParty(token, undefined, { party_id: PARTY, town: "Berlin" })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("HTTP 422")
    expect(res.content[0]!.text).toContain("merged into another one")
  })
})

describe("parties contacts and group companies", () => {
  it("members adds a contact with its function", async () => {
    const call = stub({ id: MEMBER })
    await handleMembers(token, undefined, {
      party_id: PARTY,
      person_id: OTHER,
      function: "Geschäftsführer",
    })
    expect(call()).toMatchObject({
      method: "POST",
      url: `${API}/${PARTY}/members`,
      body: { person_id: OTHER, function: "Geschäftsführer" },
    })
  })

  it("members removes a link with member_id alone", async () => {
    let call = stub({ ok: true })
    await handleMembers(token, undefined, { member_id: MEMBER })
    expect(call()).toMatchObject({ method: "DELETE", url: `${API}/members/${MEMBER}` })
    call = stub({})
    let res = await handleMembers(token, undefined, { member_id: MEMBER, party_id: PARTY })
    expect(res.isError).toBe(true)
    res = await handleMembers(token, undefined, { party_id: PARTY })
    expect(res.isError).toBe(true)
    expect(() => call()).toThrow()
  })

  it("members surfaces a refused contact as a tool error", async () => {
    stub(jsonResponse({ message: "A contact is a person." }, 422))
    const res = await handleMembers(token, undefined, { party_id: PARTY, person_id: OTHER })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("A contact is a person")
  })

  it("group_companies reads, or replaces with PUT", async () => {
    let call = stub({ data: [] })
    await handleGroupCompanies(token, undefined, {})
    expect(call()).toMatchObject({ method: "GET", url: `${API}/group-companies` })
    call = stub({ data: [] })
    const companies = [
      { name: "Musterfirma AG", relation: "parent" },
      { name: "Musterfirma Netz GmbH", parent: "Musterfirma AG", relation: "subsidiary" },
    ]
    await handleGroupCompanies(token, undefined, { companies })
    expect(call()).toMatchObject({
      method: "PUT",
      url: `${API}/group-companies`,
      body: { companies },
    })
  })
})

describe("parties tool registration", () => {
  const names = (opts: Record<string, unknown>) =>
    Object.keys((createServer({ apiKey: "tlnc_test", ...opts }) as any)._registeredTools).filter(
      (n) => n.startsWith("talonic_parties_"),
    )

  it("lists the eighteen tools only when the probe passed", () => {
    expect(names({})).toEqual([])
    expect(names({ includePartiesTools: true })).toEqual([...PARTIES_TOOL_NAMES])
    expect(PARTIES_TOOL_NAMES).toHaveLength(18)
  })

  it("annotates reads read-only and overwrites / merges / replacements destructive", () => {
    const tools = (createServer({ apiKey: "tlnc_test", includePartiesTools: true }) as any)
      ._registeredTools
    for (const n of [
      "status",
      "issues",
      "contracts",
      "contract",
      "documents",
      "history",
      "search",
    ]) {
      expect(tools[`talonic_parties_${n}`].annotations, n).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      })
    }
    for (const n of [
      "party",
      "set_role",
      "merge",
      "members",
      "group_companies",
      "names",
      "directory_link",
    ]) {
      expect(tools[`talonic_parties_${n}`].annotations.destructiveHint, n).toBe(true)
    }
    expect(tools.talonic_parties_party.annotations.idempotentHint).toBe(false)
    for (const n of ["confirm", "read", "sync", "address_choice"]) {
      expect(tools[`talonic_parties_${n}`].annotations, n).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      })
    }
    expect(tools.talonic_parties_merge.annotations.title).toBe("Merge duplicate parties")
  })

  it("descriptions follow the WHAT / USE WHEN / NOT FOR / ARGS / RETURNS format", () => {
    const tools = (createServer({ apiKey: "tlnc_test", includePartiesTools: true }) as any)
      ._registeredTools
    for (const n of names({ includePartiesTools: true })) {
      const d: string = tools[n].description
      for (const label of ["USE WHEN:", "NOT FOR:", "ARGS:", "RETURNS:"]) {
        expect(d, `${n} ${label}`).toContain(label)
      }
    }
    expect(tools.talonic_parties_set_role.description).toContain("Verwalter")
    expect(tools.talonic_parties_set_role.description).toContain("only do them when the user asked")
    expect(tools.talonic_parties_contract.description).toContain("computed by the platform")
  })

  it("the probe is true on 200 and false on 404 or a network error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ contracts: 0 }))
    vi.stubGlobal("fetch", fetchMock)
    expect(await probePartiesAccess("t")).toBe(true)
    expect(String(fetchMock.mock.calls[0]![0])).toBe(`${API}/status`)
    expect(new Headers(fetchMock.mock.calls[0]![1].headers).get("authorization")).toBe("Bearer t")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 404)))
    expect(await probePartiesAccess("t")).toBe(false)
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")))
    expect(await probePartiesAccess("t")).toBe(false)
  })

  it("caches the probe per token", async () => {
    const probe = vi.fn().mockResolvedValue(true)
    const now = () => 1_000
    expect(await partiesAccessCached("tok-pt", probe, now)).toBe(true)
    expect(await partiesAccessCached("tok-pt", probe, now)).toBe(true)
    expect(probe).toHaveBeenCalledTimes(1)
    expect(await partiesAccessCached("tok-pt-2", probe, now)).toBe(true)
    expect(probe).toHaveBeenCalledTimes(2)
  })
})
