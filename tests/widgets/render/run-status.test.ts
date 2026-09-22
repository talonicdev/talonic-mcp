import { describe, expect, it } from "vitest"
import { getRunStatusWidgetHtml } from "../../../src/widgets/run-status"
import { loadFixture, renderWidget } from "./harness"

describe("run-status widget", () => {
  it("renders status, document progress bar, phases and finalization", () => {
    const r = renderWidget(getRunStatusWidgetHtml(), loadFixture("run-status"))
    expect(r.document.querySelector(".chip.info")?.textContent).toBe("processing")
    expect(r.text).toContain("finalizing")
    expect(r.text).toContain("3 of 4 documents")
    expect(r.text).toContain("1 error")
    expect(r.document.querySelector(".bar span")?.getAttribute("style")).toContain("width:75%")
    expect(r.document.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(r.text).toContain("Totals check")
    expect(r.text).toContain("Finalizing: assembly")
  })

  it("completed and failed tones; run path with documents", () => {
    const done = renderWidget(getRunStatusWidgetHtml(), {
      run_kind: "run",
      run_id: "r",
      status: "completed",
      raw_status: "completed",
      input_count: 1,
      progress: { total_documents: 1, completed_documents: 1, error_documents: 0 },
      documents: [
        {
          document_id: "d0c00001-0000-4000-8000-000000000001",
          filename: "invoice-0421.pdf",
          status: "completed",
        },
      ],
    })
    expect(done.document.querySelector(".chip.good")?.textContent).toBe("completed")
    expect(done.text).toContain("invoice-0421.pdf")
    const failed = renderWidget(getRunStatusWidgetHtml(), {
      run_kind: "run",
      run_id: "r",
      status: "failed",
      raw_status: "failed",
      error_message: "Spec has no composed rail",
    })
    expect(failed.document.querySelector(".chip.bad")?.textContent).toBe("failed")
    expect(failed.text).toContain("Spec has no composed rail")
  })

  it("empty and malformed payloads", () => {
    expect(renderWidget(getRunStatusWidgetHtml(), {}).text).toBe("No run to show.")
    expect(
      renderWidget(getRunStatusWidgetHtml(), {
        run_kind: "pipeline",
        pipeline_id: "p",
        status: 5,
        progress: "x",
        documents: 3,
      }).text.length,
    ).toBeGreaterThan(0)
  })
})
