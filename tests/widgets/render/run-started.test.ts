import { describe, expect, it } from "vitest"
import { getRunStartedWidgetHtml } from "../../../src/widgets/run-started"
import { loadFixture, renderWidget } from "./harness"

describe("run-started widget", () => {
  it("confirms a pipeline run with ids, count and the poll hint", () => {
    const r = renderWidget(getRunStartedWidgetHtml(), loadFixture("run-started"))
    expect(r.text).toContain("Run started")
    expect(r.document.querySelector(".chip.info")?.textContent).toBe("pipeline")
    expect(r.document.querySelector(".big")?.textContent).toContain("2")
    expect(r.text).toContain("Purchase Order")
    expect(r.text).toContain("p1pe0001")
    expect(r.text).toContain("a0000001")
    expect(r.text).toContain("Poll with talonic_get_run")
    expect(r.text).toContain("pipeline_id")
  })

  it("says Documents appended for append mode and lists file_urls documents", () => {
    const r = renderWidget(getRunStartedWidgetHtml(), {
      run_kind: "run",
      run_id: "a0000001-0000-4000-8000-000000000001",
      pipeline_id: null,
      spec_id: "s",
      status: "processing",
      input_count: 1,
      appended: true,
      documents: [
        {
          document_id: "d0c00001-0000-4000-8000-000000000001",
          filename: "invoice-0421.pdf",
          size_bytes: 20480,
          source: "file_url",
          deduplicated: true,
        },
      ],
    })
    expect(r.text).toContain("Documents appended")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(1)
    expect(r.text).toContain("invoice-0421.pdf")
    expect(r.text).toContain("20 KB")
    expect(r.text).toContain("deduplicated")
    expect(r.text).toContain("run_id")
  })

  it("empty and malformed payloads", () => {
    expect(renderWidget(getRunStartedWidgetHtml(), {}).text).toBe("No run was started.")
    expect(
      renderWidget(getRunStartedWidgetHtml(), {
        run_kind: 3,
        input_count: "x",
        documents: "y",
        pipeline_id: 9,
      }).text.length,
    ).toBeGreaterThan(0)
  })
})
