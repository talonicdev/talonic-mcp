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
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { SERVER_NAME, VERSION } from "../src/version"

const distServerPath = resolve(fileURLToPath(import.meta.url), "..", "..", "dist", "server.js")
const distExists = existsSync(distServerPath)

describe("MCP server bin via symlink (regression: import.meta.url guard)", () => {
  let workDir: string
  let symlinkPath: string

  beforeAll(() => {
    if (!distExists) return
    workDir = mkdtempSync(join(tmpdir(), "talonic-mcp-symlink-"))
    symlinkPath = join(workDir, "talonic-mcp")
    symlinkSync(distServerPath, symlinkPath)
  })

  afterAll(() => {
    if (workDir) rmSync(workDir, { recursive: true, force: true })
  })

  it.skipIf(!distExists)(
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

  it.skipIf(!distExists)(
    "prints help when the symlinked server is invoked with --help",
    () => {
      const result = spawnSync(process.execPath, [symlinkPath, "--help"], {
        encoding: "utf8",
      })
      expect(result.status).toBe(0)
      expect(result.stdout).toContain("USAGE")
      expect(result.stdout).toContain("TALONIC_API_KEY")
    },
  )
})
