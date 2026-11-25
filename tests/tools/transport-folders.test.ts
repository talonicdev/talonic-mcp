import { afterEach, describe, expect, it, vi } from "vitest"
import { runGroupTool } from "../../src/tools/_groups"
import { transportFoldersGroup } from "../../src/tools/transport-folders"
import { createServer } from "../../src/server-factory"

const FOLDER = "0f3c9a1b-2d4e-4f60-8182-93a4b5c6d7e8"
const DOC = "1b2c3d4e-5f60-4718-9293-a4b5c6d7e8f9"
const ctx = { getToken: () => "tlnc_key", baseUrl: "https://api.example.test" }
const tool = (name: string) => {
  const t = transportFoldersGroup.tools.find((x) => x.name === name)
  if (!t) throw new Error(`no tool ${name}`)
  return t
}

function stub(body: unknown = {}, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  )
  vi.stubGlobal("fetch", fetchMock)
  return () => {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    return { url, method: init.method, body: init.body ? JSON.parse(String(init.body)) : undefined }
  }
}

afterEach(() => vi.unstubAllGlobals())

describe("transport folders tools", () => {
  it("covers all 13 public operations", () => {
    expect(transportFoldersGroup.tools).toHaveLength(13)
    expect(new Set(transportFoldersGroup.tools.map((t) => t.route)).size).toBe(13)
  })

  it("worklist and folder detail are plain reads", async () => {
    let call = stub({ loads: [], documents: [] })
    await runGroupTool(tool("talonic_transport_folders_worklist"), ctx, {})
    expect(call()).toMatchObject({
      method: "GET",
      url: "https://api.example.test/v1/transport-folders/worklist",
    })
    vi.unstubAllGlobals()
    call = stub({ id: FOLDER })
    await runGroupTool(tool("talonic_transport_folders_get"), ctx, { folder_id: FOLDER })
    expect(call().url).toBe(`https://api.example.test/v1/transport-folders/${FOLDER}`)
  })

  it("assign sends load_key, including null for no load", async () => {
    const call = stub({})
    await runGroupTool(tool("talonic_transport_folders_assign"), ctx, {
      folder_id: FOLDER,
      document_id: DOC,
      load_key: null,
    })
    expect(call()).toMatchObject({
      method: "POST",
      url: `https://api.example.test/v1/transport-folders/${FOLDER}/documents/${DOC}/assign`,
      body: { load_key: null },
    })
  })

  it("unassign and unconfirm are DELETEs; the load key is encoded", async () => {
    let call = stub({})
    await runGroupTool(tool("talonic_transport_folders_unassign"), ctx, {
      folder_id: FOLDER,
      document_id: DOC,
    })
    expect(call().method).toBe("DELETE")
    vi.unstubAllGlobals()
    call = stub({})
    await runGroupTool(tool("talonic_transport_folders_unconfirm_load"), ctx, {
      folder_id: FOLDER,
      load_key: "4711/2",
    })
    expect(call()).toMatchObject({
      method: "DELETE",
      url: `https://api.example.test/v1/transport-folders/${FOLDER}/loads/4711%2F2/confirm`,
    })
  })

  it("handover returns the PDF as an embedded resource and the index as text", async () => {
    stub({ filename: "T1_L1.pdf", index: [{ doc: 1 }], pdf_base64: "JVBERi0=" })
    const res = (await runGroupTool(tool("talonic_transport_folders_handover"), ctx, {
      folder_id: FOLDER,
      load_key: "L1",
    })) as any
    expect(res.isError).toBeUndefined()
    expect(JSON.parse(res.content[0].text)).toMatchObject({
      filename: "T1_L1.pdf",
      index: [{ doc: 1 }],
    })
    expect(res.content[1]).toMatchObject({
      type: "resource",
      resource: { mimeType: "application/pdf", blob: "JVBERi0=" },
    })
  })

  it("save_settings sends only the keys given", async () => {
    const call = stub({})
    await runGroupTool(tool("talonic_transport_folders_save_settings"), ctx, {
      folder_key_pattern: "^(\\d+)_",
    })
    expect(call()).toMatchObject({ method: "PUT", body: { folder_key_pattern: "^(\\d+)_" } })
  })

  it("an API error comes back as a tool error", async () => {
    stub({ message: "load_key is not a load of this transport folder" }, 400)
    const res = await runGroupTool(tool("talonic_transport_folders_assign"), ctx, {
      folder_id: FOLDER,
      document_id: DOC,
      load_key: "X",
    })
    expect(res.isError).toBe(true)
    expect(res.content[0]!.text).toContain("not a load")
  })

  it("is listed only with the transport_folders group", () => {
    const on = createServer({ apiKey: "tlnc_test", toolGroups: ["transport_folders"] }) as any
    const off = createServer({ apiKey: "tlnc_test" }) as any
    for (const t of transportFoldersGroup.tools) {
      expect(on._registeredTools[t.name], t.name).toBeDefined()
      expect(off._registeredTools[t.name]).toBeUndefined()
    }
  })
})
