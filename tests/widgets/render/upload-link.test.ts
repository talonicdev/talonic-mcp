import { describe, expect, it } from "vitest"
import { getUploadLinkWidgetHtml } from "../../../src/widgets/upload-link"
import { loadFixture, renderWidget } from "./harness"

describe("upload-link widget", () => {
  it("renders the upload link, document id and expiry", () => {
    const r = renderWidget(getUploadLinkWidgetHtml(), loadFixture("upload-link"))
    expect(r.text).toContain("Upload a document to Talonic")
    const link = r.document.querySelector("a.btn.primary")
    expect(link?.getAttribute("href")).toBe("https://app.talonic.com/u/upl_9f3a2b7c")
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer")
    expect(link?.textContent).toBe("Open upload link")
    expect(r.document.getElementById("copy-url")).not.toBeNull()
    expect(r.text).toContain("d0c00001-0000-4000-8000-000000000099")
    expect(r.text).toContain("2026-09-22 10:00:00 UTC")
  })

  it("shows dashes and no link for an empty payload", () => {
    const r = renderWidget(getUploadLinkWidgetHtml(), {})
    expect(r.document.querySelector("a.btn")).toBeNull()
    expect(r.document.getElementById("copy-url")).toBeNull()
    expect(r.text).toContain("—")
  })

  it("survives a malformed payload", () => {
    const r = renderWidget(getUploadLinkWidgetHtml(), {
      upload_url: 12345,
      document_id: { nested: true },
      expires_at: 67890,
    })
    expect(r.text.length).toBeGreaterThan(0)
  })
})
