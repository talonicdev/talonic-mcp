import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * Guard: every raw-fetch tool/resource must route its outbound HTTP calls
 * through `resolveFetch(getToken)(...)` (see `src/tools/_http.ts`), never a
 * bare `fetch(...)`. `resolveFetch` returns the User-Agent-tagged fetch the
 * platform uses to attribute a call's funnel `surface` (claude_desktop /
 * cursor / chatgpt / ...); a tool wired with plain `fetch(` silently drops
 * that attribution.
 *
 * Two boot-time probes are exempt: they run before any session/token exists
 * (they decide whether to *register* the growth / admin-agent-task tools at
 * all), so there is nothing to tag yet and they intentionally call the
 * global `fetch` directly.
 */

const ROOT = fileURLToPath(new URL("../../", import.meta.url))
const TOOLS_DIR = path.join(ROOT, "src/tools")
const RESOURCES_DIR = path.join(ROOT, "src/resources")

/** file basename -> allowlisted top-level function name allowed a bare fetch(). */
const ALLOWLISTED_PROBES: Record<string, string> = {
  "growth.ts": "probeGrowthAccess",
  "agent-tasks.ts": "probeAgentTaskAdminAccess",
}

/** Matches a top-level (column-0) function declaration and captures its name. */
const TOP_LEVEL_FN = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/

function listTsFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(dir, f))
    .sort()
}

/** Lines that contain a bare `fetch(` call, outside any allowlisted function body. */
function bareFetchLines(file: string): string[] {
  const base = path.basename(file)
  const allowedFn = ALLOWLISTED_PROBES[base]
  const lines = readFileSync(file, "utf8").split("\n")

  const violations: string[] = []
  let currentFn: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ""
    const decl = TOP_LEVEL_FN.exec(line)
    if (decl) currentFn = decl[1] ?? null

    if (allowedFn && currentFn === allowedFn) continue
    // `_http.ts` defines `resolveFetch` itself, which legitimately mentions
    // `fetch` (as a type and as its own fallback) but never calls it bare.
    if (base === "_http.ts" && /resolveFetch\(/.test(line)) continue

    if (/\bfetch\(/.test(line)) violations.push(`${base}:${i + 1}: ${line.trim()}`)
  }
  return violations
}

describe("no bare fetch() outside the allowlisted boot probes", () => {
  const files = [...listTsFiles(TOOLS_DIR), ...listTsFiles(RESOURCES_DIR)]

  it("scans a non-trivial set of tool/resource files", () => {
    expect(files.length).toBeGreaterThanOrEqual(15)
  })

  it("both allowlisted probe functions actually exist (guards a stale allowlist)", () => {
    for (const [base, fnName] of Object.entries(ALLOWLISTED_PROBES)) {
      const file = files.find((f) => path.basename(f) === base)
      expect(file, `expected ${base} in scanned files`).toBeDefined()
      const text = readFileSync(file as string, "utf8")
      expect(
        text.includes(`function ${fnName}(`),
        `expected to find function ${fnName} in ${base}`,
      ).toBe(true)
    }
  })

  for (const file of files) {
    it(`${path.basename(file)}: raw-fetch calls go through resolveFetch()`, () => {
      expect(bareFetchLines(file)).toEqual([])
    })
  }
})
