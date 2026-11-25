#!/usr/bin/env node
// Promote CHANGELOG.md's [Unreleased] entries to `## [<version>] - <date>` and
// leave an empty [Unreleased] above it. The publish workflow runs this right
// after it bumps package.json, so main always has a heading for the package
// version (tests/changelog.test.ts requires one).
//
//   node scripts/promote-changelog.mjs 0.1.104 [2026-11-26]

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const NOTE_RE = /^> .*$/m

/** The changelog text with [Unreleased] promoted; throws if the version already has a heading. */
export function promote(md, version, date) {
  if (new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\]`, "m").test(md)) {
    throw new Error(`CHANGELOG.md already has a heading for ${version}`)
  }
  const start = md.indexOf("## [Unreleased]")
  if (start < 0) throw new Error("CHANGELOG.md has no ## [Unreleased] section")
  const afterHeading = start + "## [Unreleased]".length
  const nextHeading = md.slice(afterHeading).search(/^## \[\d+\.\d+\.\d+\]/m)
  const end = nextHeading < 0 ? md.length : afterHeading + nextHeading
  let body = md.slice(afterHeading, end)
  const note = NOTE_RE.exec(body)?.[0] ?? null
  if (note) body = body.replace(note, "")
  body = body.trim()
  const entries = /^- /m.test(body) ? body : "### Changed\n\n- No user-facing changes."
  return (
    md.slice(0, start) +
    "## [Unreleased]\n\n" +
    (note ? `${note}\n\n` : "") +
    `## [${version}] - ${date}\n\n${entries}\n\n` +
    md.slice(end)
  )
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [version, date = new Date().toISOString().slice(0, 10)] = process.argv.slice(2)
  if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
    console.error("usage: promote-changelog.mjs <x.y.z> [YYYY-MM-DD]")
    process.exit(2)
  }
  const file = join(dirname(fileURLToPath(import.meta.url)), "..", "CHANGELOG.md")
  writeFileSync(file, promote(readFileSync(file, "utf8"), version, date))
  console.log(`CHANGELOG.md: [Unreleased] promoted to [${version}] - ${date}.`)
}
