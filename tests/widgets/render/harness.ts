import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"

export interface Rendered {
  window: any
  document: Document
  /** Whitespace-normalised textContent of #root. */
  text: string
  /** innerHTML of #root. */
  html: string
}

/**
 * Load a widget template into jsdom, hand it `payload` the way the Apps SDK
 * does (`window.openai.toolOutput`), run its inline scripts, and return the
 * rendered root. Scripts run via `window.eval` so the template's own
 * `<script>` is executed exactly once, in window scope.
 */
export function renderWidget(templateHtml: string, payload: unknown): Rendered {
  const dom = new JSDOM(templateHtml, { runScripts: "outside-only", pretendToBeVisual: true })
  const win = dom.window as any
  win.openai = { toolOutput: payload }
  for (const script of Array.from(win.document.querySelectorAll("script"))) {
    win.eval((script as HTMLScriptElement).textContent ?? "")
  }
  const root = win.document.getElementById("root")
  return {
    window: win,
    document: win.document,
    text: (root?.textContent ?? "").replace(/\s+/g, " ").trim(),
    html: root?.innerHTML ?? "",
  }
}

/** Read `tests/widgets/fixtures/<name>.json`. */
export function loadFixture<T = any>(name: string): T {
  const url = new URL(`../fixtures/${name}.json`, import.meta.url)
  return JSON.parse(readFileSync(url, "utf8")) as T
}
