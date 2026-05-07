/**
 * Regression test for the silent-no-output bug in the MCP server bin.
 *
 * When the server is invoked via the npm-managed bin symlink (the way
 * MCP clients spawn it via `npx -y @talonic/mcp`), `process.argv[1]` is
 * the symlink path while `import.meta.url` is the resolved file URL.
 * Naive string comparison fails, the auto-run guard short-circuits, and
 * `main()` never runs, so `--version` produces no output.
 *
 * This test exercises that exact invocation shape against the real
 * bundled output, so a future regression of the guard is caught before
 * publish.
 */
import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync, statSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { SERVER_NAME, VERSION } from "../src/version"

const distServerPath = resolve(fileURLToPath(import.meta.url), "..", "..", "dist", "server.js")
const pkgJsonPath = resolve(fileURLToPath(import.meta.url), "..", "..", "package.json")

/**
 * `src/version.ts` reads `pkg.version` from `package.json` and the
 * bundler inlines that value into `dist/server.js` at build time.
 * After a version bump in `package.json` but before a rebuild,
 * `dist/server.js` carries the old version while the test imports the
 * new one through `src/version.ts`, producing a confusing assertion
 * mismatch that masquerades as a real regression. Detect that drift up
 * front and skip with a console warning instead.
 *
 * CI is unaffected: the publish workflow runs `npm run build` before
 * `npm test`, so `dist/` is always fresh by the time these tests run.
 */
function isDistFresh(): boolean {
  if (!existsSync(distServerPath)) return false
  if (!existsSync(pkgJsonPath)) return false
  return statSync(distServerPath).mtimeMs >= statSync(pkgJsonPath).mtimeMs
}

const distAvailable = isDistFresh()

if (existsSync(distServerPath) && !distAvailable) {
  // eslint-disable-next-line no-console
  console.warn(
    "[symlink test] dist/server.js is older than package.json; symlink tests skipped. Run `npm run build` to enable.",
  )
}

describe("MCP server bin via symlink (regression: import.meta.url guard)", () => {
  let workDir: string
  let symlinkPath: string

  beforeAll(() => {
    if (!distAvailable) return
    workDir = mkdtempSync(join(tmpdir(), "talonic-mcp-symlink-"))
    symlinkPath = join(workDir, "talonic-mcp")
    symlinkSync(distServerPath, symlinkPath)
  })

  afterAll(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true })
  })

  it.skipIf(!distAvailable)(
    "prints SERVER_NAME and VERSION when the bundled server is invoked through a symlink",
    () => {
      const result = spawnSync(process.execPath, [symlinkPath, "--version"], {
        encoding: "utf8",
      })
      expect(result.status).toBe(0)
      expect(result.stdout).toContain(SERVER_NAME)
      expect(result.stdout).toContain(VERSION)
    },
  )

  it.skipIf(!distAvailable)("prints help when the symlinked server is invoked with --help", () => {
    const result = spawnSync(process.execPath, [symlinkPath, "--help"], {
      encoding: "utf8",
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("USAGE")
    expect(result.stdout).toContain("TALONIC_API_KEY")
  })
})
