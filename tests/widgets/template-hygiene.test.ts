import { describe, expect, it } from "vitest"
import { JSDOM } from "jsdom"
import { getWidgetTemplateHtml } from "../../src/widgets/register"
import { WIDGET_URIS } from "../../src/widgets/types"

// Every template is a static, self-contained document: no secrets, no
// external scripts/styles/fonts (CSP is empty), no leaked TS template syntax.
describe("widget template hygiene", () => {
  it.each(Object.values(WIDGET_URIS))("%s", (uri) => {
    const html = getWidgetTemplateHtml(uri)
    expect(html, `no template for ${uri}`).toBeDefined()
    expect(html).not.toMatch(/tlnc_[a-z0-9]/i)
    expect(html).not.toContain("Authorization")
    expect(html).not.toContain("${")
    expect(html).not.toMatch(/<script[^>]+src=/i)
    expect(html).not.toMatch(/<link[^>]+href=/i)
    expect(html).not.toMatch(/url\(\s*['"]?https?:/i)
    expect(html).not.toMatch(/@import/i)
    // Parses as a document with exactly one inline script and a #root.
    const dom = new JSDOM(html!)
    expect(dom.window.document.querySelectorAll("script")).toHaveLength(1)
    expect(dom.window.document.getElementById("root")).not.toBeNull()
    // The inline script is syntactically valid JavaScript.
    const src = dom.window.document.querySelector("script")!.textContent ?? ""
    expect(() => new Function(src)).not.toThrow()
  })
})
