import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
// @ts-expect-error plain ESM script without types
import { promote } from "../scripts/promote-changelog.mjs"

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
 * Every 0.1.x patch from 45 up to and including the package version must have
 * its own `## [x.y.z] - date` heading. There is no grace for the package
 * version: the publish workflow promotes `[Unreleased]` to the new version's
 * heading in the same commit that bumps package.json
 * (`scripts/promote-changelog.mjs`). Returns the versions still missing.
 */
function checkCoverage(md: string, pkgVersion: string): string[] {
  const versionHeading = /^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/gm
  const have = new Set([...md.matchAll(versionHeading)].map((m) => m[1]))
  const [maj, min, patch] = pkgVersion.split(".").map(Number)
  const missing: string[] = []
  for (let p = 45; p <= patch; p++) {
    const v = `${maj}.${min}.${p}`
    if (!have.has(v)) missing.push(v)
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

  it("has a heading for every patch release from 0.1.45 up to and including the package version", () => {
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

  describe("checkCoverage", () => {
    it("fails, naming the package version, when only [Unreleased] covers it", () => {
      const mutated = [
        "## [Unreleased]",
        "",
        "### Added",
        "",
        "- New thing not yet promoted to a heading.",
        "",
        "## [0.1.45] - 2026-05-27",
        "",
        "- Something.",
        "",
      ].join("\n")
      expect(checkCoverage(mutated, "0.1.46")).toEqual(["0.1.46"])
      expect(checkCoverage(mutated, "0.1.45")).toEqual([])
    })
  })

  describe("promote-changelog (what the publish workflow runs on a bump)", () => {
    const base = [
      "# Changelog",
      "",
      "## [Unreleased]",
      "",
      "> note",
      "",
      "### Added",
      "",
      "- A thing.",
      "",
      "## [0.1.45] - 2026-05-27",
      "",
      "- Something.",
      "",
    ].join("\n")

    it("moves the entries under the new heading and leaves [Unreleased] with its note", () => {
      const out = promote(base, "0.1.46", "2026-05-28")
      expect(out).toContain(
        "## [Unreleased]\n\n> note\n\n## [0.1.46] - 2026-05-28\n\n### Added\n\n- A thing.",
      )
      expect(checkCoverage(out, "0.1.46")).toEqual([])
      expect(out.indexOf("## [0.1.46]")).toBeLessThan(out.indexOf("## [0.1.45]"))
    })

    it("an empty [Unreleased] still gets a heading, and a version is never promoted twice", () => {
      const empty = base.replace("### Added\n\n- A thing.\n\n", "")
      expect(promote(empty, "0.1.46", "2026-05-28")).toContain(
        "## [0.1.46] - 2026-05-28\n\n### Changed\n\n- No user-facing changes.",
      )
      expect(() => promote(base, "0.1.45", "2026-05-28")).toThrow(/already has a heading/)
    })

    it("the real changelog promotes cleanly to the next patch", () => {
      const [maj, min, patch] = pkgVersion.split(".").map(Number)
      const next = `${maj}.${min}.${patch + 1}`
      expect(checkCoverage(promote(md, next, "2099-01-01"), next)).toEqual([])
    })
  })
})
