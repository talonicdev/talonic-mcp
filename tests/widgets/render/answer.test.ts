import { describe, expect, it } from "vitest"
import { getAnswerPolledWidgetHtml, getAnswerWidgetHtml } from "../../../src/widgets/answer"
import { loadFixture, renderWidget } from "./harness"

describe("answer widgets (Ink)", () => {
  it("renders the answer as prose, a verdict, sources, files and a quiet meta line", () => {
    const r = renderWidget(getAnswerWidgetHtml(), loadFixture("answer"))
    expect(r.document.querySelector(".title")?.textContent).toBe("Answer")
    expect(r.document.querySelector(".chip.good")?.textContent).toBe("Verified")
    expect(r.document.querySelector(".prose")?.textContent).toContain("1,299.00 EUR")
    expect(r.document.querySelector("pre.md")).toBeNull()
    expect(r.text).toContain("Sources")
    expect(r.document.querySelectorAll(".cites li").length).toBe(2)
    expect(r.text).toContain("Total amount due")
    expect(r.document.querySelector("a.btn")?.getAttribute("href")).toBe(
      "https://app.talonic.com/artifacts/art-1",
    )
    expect(r.text).toContain("3 credits")
    expect(r.text).toContain("3 queries")
    expect(r.text).toContain("4.1 s")
    // internal ids and token counts stay out of the visible card
    expect(r.text).not.toMatch(/tokens|conversation|ask [0-9a-f]{8}/)
  })

  it("renders markdown: bold, lists, code, https links, tables", () => {
    const answer = [
      "You have **37 invoices** across `143` files.",
      "",
      "- One invoice uploaded *28* times",
      "- Test files",
      "",
      "| Supplier | Invoices |",
      "| --- | --- |",
      "| TechSource | 12 |",
      "",
      "[Open](https://app.talonic.com/x)",
    ].join("\n")
    const r = renderWidget(getAnswerWidgetHtml(), { ask_id: "a", status: "completed", answer })
    const prose = r.document.querySelector(".prose")!
    expect(prose.querySelector("strong")?.textContent).toBe("37 invoices")
    expect(prose.querySelector("code")?.textContent).toBe("143")
    expect(prose.querySelectorAll("ul li").length).toBe(2)
    expect(prose.querySelector("em")?.textContent).toBe("28")
    expect(prose.querySelector("table td")?.textContent).toBe("TechSource")
    expect(prose.querySelector("a")?.getAttribute("href")).toBe("https://app.talonic.com/x")
    expect(prose.textContent).not.toContain("**")
  })

  it("never turns answer text into markup or script", () => {
    const answer = '<img src=x onerror="alert(1)"> **<b>x</b>** [y](javascript:alert(1))'
    const r = renderWidget(getAnswerWidgetHtml(), { ask_id: "a", status: "completed", answer })
    const prose = r.document.querySelector(".prose")!
    expect(prose.querySelector("img")).toBeNull()
    expect(prose.querySelector("b")).toBeNull()
    expect(prose.querySelector("a")).toBeNull()
    expect(prose.textContent).toContain("<img")
  })

  it("shows a processing notice and the error state", () => {
    const p = renderWidget(getAnswerPolledWidgetHtml(), {
      ask_id: "a5k00001-0000-4000-8000-000000000001",
      status: "processing",
      conversation_id: "c",
    })
    expect(p.text).toContain("Still working on it")
    const e = renderWidget(getAnswerWidgetHtml(), { ask_id: "a", status: "error" })
    expect(e.document.querySelector(".chip.bad")?.textContent).toBe("Error")
  })

  it("both templates share one design", () => {
    expect(getAnswerWidgetHtml()).toBe(getAnswerPolledWidgetHtml())
  })

  it("verdict tones and empty payloads", () => {
    const tone = (v: string) =>
      renderWidget(getAnswerWidgetHtml(), {
        ask_id: "a",
        status: "completed",
        answer: "x",
        verification: { verdict: v },
      }).document.querySelector(".header .chip")?.className
    expect(tone("issues")).toContain("warn")
    expect(tone("unverifiable")).toContain("bad")
    expect(renderWidget(getAnswerWidgetHtml(), {}).text).toBe("No answer.")
  })
})
