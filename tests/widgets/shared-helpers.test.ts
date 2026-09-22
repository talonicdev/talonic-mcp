import { describe, expect, it } from "vitest"
import { buildWidgetHtml, widgetMeta } from "../../src/widgets/shared"
import { renderWidget } from "./render/harness"

// A probe widget that exercises every shared helper against the payload.
const PROBE = buildWidgetHtml({
  title: "probe",
  renderBody: `
    root.innerHTML = ''
      + '<div id="chips">' + chip("core", "good") + chip("", "bad") + chip(null, "warn") + '</div>'
      + '<div id="clamp">' + esc(clamp(payload.long, 6)) + '</div>'
      + '<div id="short">' + esc(shortId(payload.id)) + '</div>'
      + '<div id="idchip">' + idChip(payload.id) + '</div>'
      + '<div id="rel">' + esc(relTime(payload.future)) + '|' + esc(relTime(payload.past)) + '|' + esc(relTime(null)) + '|' + esc(relTime("garbage")) + '</div>'
      + '<div id="table">' + dataTable(payload.rows) + '</div>'
      + '<div id="tiles">' + kvTiles(payload.obj) + '</div>'
      + '<div id="tree">' + jsonTree(payload.tree) + '</div>'
      + '<div id="flags">' + isFlat(payload.obj) + '|' + isFlat(payload.tree) + '|' + isRowArray(payload.rows) + '|' + isRowArray([1,2]) + '</div>'
      + '<div id="wide">' + dataTable(payload.wide) + '</div>'
      + '<div id="deep">' + jsonTree(payload.deep) + '</div>'
      + '<div id="huge">' + jsonTree(payload.huge) + '</div>';
  `,
})

describe("shared widget helpers", () => {
  const now = Date.now()
  const r = renderWidget(PROBE, {
    long: "abcdefghijklmnop",
    id: "0123456789abcdef-0000",
    future: new Date(now + 5 * 60_000).toISOString(),
    past: new Date(now - 3 * 3600_000).toISOString(),
    rows: Array.from({ length: 60 }, (_, i) => ({ a: i, b: `row ${i}`, nested: { x: i } })),
    obj: { alpha: 1, beta: "two", gamma: null, delta: { deep: true } },
    tree: { level1: { level2: { level3: [1, 2, { level5: "leaf" }] } }, scalar: 42 },
    // 15 columns: exercises dataTable's >12-column cap.
    wide: [Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`c${i}`, i]))],
    // 8 levels of object nesting: exercises jsonTree's depth>=6 fallback.
    deep: { lvl1: { lvl2: { lvl3: { lvl4: { lvl5: { lvl6: { lvl7: { lvl8: "leaf" } } } } } } } },
    // 450 nested-object children: each recursive jsonTree call consumes the
    // shared 400-node budget, so the tail gets cut off with the "…" marker.
    huge: Object.fromEntries(Array.from({ length: 450 }, (_, i) => [`k${i}`, { leaf: i }])),
  })
  const q = (sel: string) => r.document.querySelector(sel)!

  it("chip renders text with a tone and skips empty values", () => {
    expect(q("#chips").querySelectorAll(".chip")).toHaveLength(1)
    expect(q("#chips .chip").className).toBe("chip good")
    expect(q("#chips .chip").textContent).toBe("core")
  })

  it("clamp truncates with an ellipsis", () => {
    expect(q("#clamp").textContent).toBe("abcde…")
  })

  it("shortId/idChip show the first 8 chars and keep the full id in title", () => {
    expect(q("#short").textContent).toBe("01234567")
    expect(q("#idchip .mono").getAttribute("title")).toBe("0123456789abcdef-0000")
  })

  it("relTime handles future, past, missing and unparsable input", () => {
    expect(q("#rel").textContent).toBe("in 5m|3h ago|—|garbage")
  })

  it("dataTable caps rows at 50, columns at 12, and flattens nested cells", () => {
    expect(q("#table tbody").querySelectorAll("tr")).toHaveLength(50)
    expect(q("#table thead").textContent).toBe("abnested")
    expect(q("#table").textContent).toContain("+10 more rows")
    expect(q("#table tbody tr td:nth-child(3)").textContent).toBe('{"x":0}')
  })

  it("kvTiles renders one tile per key with — for null", () => {
    const tiles = q("#tiles").querySelectorAll(".kv")
    expect(tiles).toHaveLength(4)
    expect(tiles[2].textContent).toBe("gamma—")
    expect(tiles[3].textContent).toContain('{"deep":true}')
  })

  it("jsonTree renders nested details with the deepest leaf reachable", () => {
    expect(q("#tree").querySelectorAll("details.tree").length).toBeGreaterThanOrEqual(3)
    expect(q("#tree").textContent).toContain("leaf")
    expect(q("#tree").textContent).toContain("42")
  })

  it("isFlat / isRowArray classify shapes", () => {
    expect(q("#flags").textContent).toBe("false|false|true|false")
  })

  it("dataTable caps columns at 12 with a '+N more columns' footer", () => {
    expect(q("#wide thead").querySelectorAll("th")).toHaveLength(12)
    expect(q("#wide").textContent).toContain("+3 more columns")
  })

  it("jsonTree truncates at depth 6 with a clamped-JSON fallback and no deeper nesting", () => {
    const trees = q("#deep").querySelectorAll("details.tree")
    expect(trees).toHaveLength(6)
    const innermost = trees[trees.length - 1]!
    const fallback = innermost.lastElementChild!
    expect(fallback.className).toBe("muted")
    expect(fallback.textContent).toBe('{"lvl7":{"lvl8":"leaf"}}')
    // A 7-deep chain of the same compound selector only matches elements with
    // >=6 ".tree" ancestors, i.e. a 7th nesting level. None exists.
    expect(
      q("#deep").querySelectorAll(
        "details.tree details.tree details.tree details.tree details.tree details.tree details.tree",
      ),
    ).toHaveLength(0)
  })

  it("jsonTree stops at the 400-node budget and marks the cutoff", () => {
    const markers = Array.from(q("#huge").querySelectorAll(".muted")).filter(
      (el) => el.textContent === "…",
    )
    expect(markers.length).toBeGreaterThan(0)
    expect(q("#huge").querySelectorAll(".node").length).toBeLessThan(450)
  })
})

describe("widgetMeta", () => {
  it("adds the model-facing description and prefers a bordered card", () => {
    const meta = widgetMeta("Shows a thing.") as any
    expect(meta["openai/widgetDescription"]).toBe("Shows a thing.")
    expect(meta["openai/widgetPrefersBorder"]).toBe(true)
    expect(meta["openai/widgetDomain"]).toBe("https://talonic.com")
    expect(meta.ui.csp.connectDomains).toEqual([])
  })

  it("omits the description key when none is given", () => {
    expect("openai/widgetDescription" in widgetMeta()).toBe(false)
  })
})
