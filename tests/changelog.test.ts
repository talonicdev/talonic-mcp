import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const md = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8")
const pkgVersion = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version: string
  }
).version

const HEADING = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/gm
const headings = [...md.matchAll(HEADING)].map((m) => ({ version: m[1], date: m[2] }))
const cmp = (a: string, b: string) => {
  const pa = a.split(".").map(Number),
    pb = b.split(".").map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

describe("CHANGELOG.md", () => {
  it("has an [Unreleased] section first, then versioned headings in strictly descending order", () => {
    expect(md.indexOf("## [Unreleased]")).toBeGreaterThan(0)
    expect(md.indexOf("## [Unreleased]")).toBeLessThan(md.indexOf(`## [${headings[0].version}]`))
    for (let i = 1; i < headings.length; i++) {
      expect(
        cmp(headings[i - 1].version, headings[i].version),
        `${headings[i - 1].version} > ${headings[i].version}`,
      ).toBeGreaterThan(0)
    }
  })

  it("dates parse and never go backwards in time as versions increase", () => {
    for (let i = 1; i < headings.length; i++) {
      expect(Number.isNaN(Date.parse(headings[i].date))).toBe(false)
      expect(
        headings[i - 1].date >= headings[i].date,
        `${headings[i - 1].version} dated before ${headings[i].version}`,
      ).toBe(true)
    }
  })

  it("has a heading for every patch release from 0.1.45 up to the package version", () => {
    const have = new Set(headings.map((h) => h.version))
    const [maj, min, patch] = pkgVersion.split(".").map(Number)
    // Every 0.1.x in [45, package version] has shipped a real npm release (verified against
    // `npm view @talonic/mcp versions --json` and every `git tag -l 'v0.1.*'` in range) — this
    // set exists only for a genuinely tag-less or unpublished patch, should one ever occur again.
    const skipped = new Set<string>([])
    for (let p = 45; p <= patch; p++) {
      const v = `${maj}.${min}.${p}`
      if (skipped.has(v)) continue
      expect(have.has(v), `missing ## [${v}]`).toBe(true)
    }
  })

  it("[Unreleased] is non-empty when the package version already has a heading", () => {
    const unreleased = md.slice(
      md.indexOf("## [Unreleased]"),
      md.indexOf(`## [${headings[0].version}]`),
    )
    if (headings.some((h) => h.version === pkgVersion)) {
      expect(unreleased.replace(/## \[Unreleased\]|###\s*\w+|\s/g, "").length).toBeGreaterThan(40)
    }
  })
})
