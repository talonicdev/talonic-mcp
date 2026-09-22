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

/**
 * Every 0.1.x patch from 45 up to the package version must be documented.
 *
 * A version strictly below the package version must have its own
 * `## [x.y.z] - date` heading — no exception. The package version itself may
 * instead be covered by a non-empty `## [Unreleased]` section (at least one
 * `- ` bullet line before the first versioned heading): CI's publish
 * workflow auto-bumps `package.json` on release, before anyone promotes
 * `[Unreleased]` to a dated heading, so the very next commit on `main` must
 * not go red for that gap alone. Returns the list of versions still missing
 * coverage (empty when everything is covered).
 */
function checkCoverage(md: string, pkgVersion: string): string[] {
  const versionHeading = /^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/gm
  const matches = [...md.matchAll(versionHeading)]
  const have = new Set(matches.map((m) => m[1]))

  const firstHeadingIndex = matches.length > 0 ? (matches[0].index ?? md.length) : md.length
  const unreleasedIndex = md.indexOf("## [Unreleased]")
  const unreleasedSection = unreleasedIndex >= 0 ? md.slice(unreleasedIndex, firstHeadingIndex) : ""
  const unreleasedHasBullets = /^- /m.test(unreleasedSection)

  const [maj, min, patch] = pkgVersion.split(".").map(Number)
  const missing: string[] = []
  for (let p = 45; p <= patch; p++) {
    const v = `${maj}.${min}.${p}`
    if (have.has(v)) continue
    if (p === patch && unreleasedHasBullets) continue
    missing.push(v)
  }
  return missing
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

  it("has a heading for every patch release from 0.1.45 up to the package version (or the package version under a non-empty [Unreleased])", () => {
    const missing = checkCoverage(md, pkgVersion)
    expect(missing, `missing heading(s): ${missing.map((v) => `## [${v}]`).join(", ")}`).toEqual([])
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

  describe("checkCoverage (Important 5 — the auto-bump tolerance)", () => {
    it("passes with the package version living under a non-empty [Unreleased] instead of its own heading", () => {
      const mutated = [
        "## [Unreleased]",
        "",
        "### Added",
        "",
        "- New thing not yet promoted to a heading.",
        "",
        "## [0.1.45] - 2026-05-27",
        "",
        "### Added",
        "",
        "- Something.",
        "",
      ].join("\n")
      expect(checkCoverage(mutated, "0.1.46")).toEqual([])
    })

    it("fails, naming the version, when [Unreleased] is empty and the package version has no heading", () => {
      const mutated = [
        "## [Unreleased]",
        "",
        "## [0.1.45] - 2026-05-27",
        "",
        "### Added",
        "",
        "- Something.",
        "",
      ].join("\n")
      expect(checkCoverage(mutated, "0.1.46")).toEqual(["0.1.46"])
    })
  })
})
