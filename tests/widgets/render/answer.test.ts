import { describe, expect, it } from "vitest"
import { getAnswerPolledWidgetHtml, getAnswerWidgetHtml } from "../../../src/widgets/answer"
import { loadFixture, renderWidget } from "./harness"

describe("answer widgets", () => {
  it("renders the answer, verification, citations, artifacts and usage", () => {
    const r = renderWidget(getAnswerWidgetHtml(), loadFixture("answer"))
    expect(r.text).toContain("Answer")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("supported")
    expect(r.document.querySelector("pre.md")?.textContent).toContain("1,299.00 EUR")
    expect(r.text).toContain("Citations (2)")
    expect(r.text).toContain("Total amount due")
    expect(r.document.querySelectorAll(".cite .chip").length).toBeGreaterThanOrEqual(2) // kind chips
    expect(r.text).toContain("Artifacts (1)")
    expect(r.document.querySelector("a.btn")?.getAttribute("href")).toBe(
      "https://app.talonic.com/artifacts/art-1",
    )
    expect(r.text).toContain("3 credits")
    expect(r.text).toContain("812 tokens")
    expect(r.text).toContain("3 tool calls")
    expect(r.text).toContain("4.1 s")
  })

  it("shows the processing notice with the ask id, and the error state", () => {
    const p = renderWidget(getAnswerPolledWidgetHtml(), {
      ask_id: "a5k00001-0000-4000-8000-000000000001",
      status: "processing",
      conversation_id: "c",
      poll_hint: "x",
    })
    expect(p.text).toContain("Answer (polled)")
    expect(p.text).toContain("Still thinking")
    expect(p.text).toContain("talonic_get_answer")
    expect(p.text).toContain("a5k00001")
    const e = renderWidget(getAnswerWidgetHtml(), { ask_id: "a", status: "error", answer: null })
    expect(e.document.querySelector(".chip.bad")?.textContent).toBe("error")
  })

  it("verification tones and empty/malformed payloads", () => {
    const issues = renderWidget(getAnswerWidgetHtml(), {
      ask_id: "a",
      status: "completed",
      answer: "x",
      verification: {
        verdict: "issues",
        checks_total: 3,
        checks_unsupported: 1,
        correction: "One claim lacked a source.",
      },
    })
    expect(issues.document.querySelector(".chip.warn")?.textContent).toBe("issues")
    expect(issues.text).toContain("One claim lacked a source.")
    expect(renderWidget(getAnswerWidgetHtml(), {}).text).toBe("No answer.")
    expect(
      renderWidget(getAnswerWidgetHtml(), {
        ask_id: 5,
        status: 7,
        answer: { a: 1 },
        citations: "x",
        usage: 3,
      }).text.length,
    ).toBeGreaterThan(0)
  })

  it("never renders a javascript: artifact link as a button", () => {
    const r = renderWidget(getAnswerWidgetHtml(), {
      ask_id: "a",
      status: "completed",
      answer: "x",
      artifacts: [{ type: "table", id: "art-1", label: "Bad link", link: "javascript:alert(1)" }],
    })
    expect(r.text).toContain("Bad link")
    expect(r.document.querySelector("a.btn")).toBeNull()
  })

  it("the two templates differ only in headline", () => {
    const a = getAnswerWidgetHtml().replace('"Answer"', "X").replace("Talonic — Answer", "T")
    const b = getAnswerPolledWidgetHtml()
      .replace('"Answer (polled)"', "X")
      .replace("Talonic — Answer (polled)", "T")
    expect(a).toBe(b)
  })
})
