import { readFileSync } from "node:fs"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { describe, expect, it } from "vitest"
import { createServer } from "../src/server-factory"
import { VERSION } from "../src/version"
// @ts-expect-error plain ESM script without types
import { DOCS, currentBlock, inventory, renderBlock } from "../scripts/tool-inventory.mjs"

// AGENTS.md and STATUS.md carry tool counts generated from a real tools/list.
// Regenerate with: npm run build && node scripts/tool-inventory.mjs --write
describe("tool counts in AGENTS.md and STATUS.md are generated, not typed", async () => {
  const inv = await inventory(createServer, { Client, InMemoryTransport })
  const block = renderBlock(inv, VERSION)

  it("every registered tool falls in exactly one group", () => {
    const all = (inv.groups as Array<{ tools: string[] }>).flatMap((g) => g.tools)
    expect(new Set(all).size).toBe(all.length)
    expect(inv.public + inv.optional + inv.internal).toBe(all.length)
  })

  it.each(DOCS as string[])("%s has the current block", (file) => {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8")
    expect(
      currentBlock(text),
      `${file} is stale: run node scripts/tool-inventory.mjs --write`,
    ).toBe(block)
  })
})
