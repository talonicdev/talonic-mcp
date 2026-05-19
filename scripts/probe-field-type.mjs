// Probe for schema-typing footgun option 2 (STATUS.md).
//
// Question: does the Talonic API now return a `type` (or `data_type`)
// field on `talonic_search` fieldMatches[] / fields[] and on the schema
// definitions returned by `talonic_list_schemas`? If yes, the MCP-side
// outputSchema can be extended in one commit and agents can check
// `field.type === 'number'` before constructing a `gt`/`lt` condition.
//
// Read-only. Calls `talonic.search('invoice')` and `talonic.schemas.list()`.
// No mutations, no API key persistence — pass the key on the command line:
//
//   TALONIC_API_KEY=tlnc_xxx node scripts/probe-field-type.mjs
//
// Delete this file after running — it lives under scripts/ but is not
// part of any published artifact (`files` in package.json is `dist/`).

import { Talonic } from "@talonic/node"

const apiKey = process.env["TALONIC_API_KEY"]
if (!apiKey) {
  console.error("Set TALONIC_API_KEY (a tlnc_... key) before running.")
  process.exit(1)
}

const talonic = new Talonic({ apiKey })

function keysOf(o) {
  if (o === null || o === undefined) return "<null|undefined>"
  if (typeof o !== "object") return `<${typeof o}>`
  return Object.keys(o).sort()
}

function typePresence(entry, candidates = ["type", "data_type", "fieldType", "dataType"]) {
  if (!entry || typeof entry !== "object") return { found: false }
  for (const k of candidates) {
    if (k in entry) return { found: true, key: k, value: entry[k] }
  }
  return { found: false }
}

async function probeSearch() {
  console.log("──────────────────────────────────────────")
  console.log("1) talonic.search('invoice')")
  console.log("──────────────────────────────────────────")
  try {
    const result = await talonic.search("invoice", { limit: 5 })
    console.log("top-level keys:", keysOf(result))

    // The SDK wraps in WithRateLimit; the actual data may be at the
    // top level or under `.data`. Peek both.
    const r =
      result && typeof result === "object" && "fieldMatches" in result ? result : result?.data ?? result
    console.log("data keys:", keysOf(r))

    const fm = r?.fieldMatches?.[0]
    if (fm) {
      console.log("\nfieldMatches[0] keys:", keysOf(fm))
      console.log("type presence:", typePresence(fm))
      console.log("sample fieldMatches[0]:", JSON.stringify(fm, null, 2).slice(0, 500))
    } else {
      console.log("\nfieldMatches: empty or missing")
    }

    const f = r?.fields?.[0]
    if (f) {
      console.log("\nfields[0] keys:", keysOf(f))
      console.log("type presence:", typePresence(f))
      console.log("sample fields[0]:", JSON.stringify(f, null, 2).slice(0, 500))
    } else {
      console.log("\nfields: empty or missing")
    }
  } catch (err) {
    console.error("search failed:", err?.message || err)
  }
}

async function probeSchemas() {
  console.log("\n──────────────────────────────────────────")
  console.log("2) talonic.schemas.list()")
  console.log("──────────────────────────────────────────")
  try {
    const result = await talonic.schemas.list()
    console.log("top-level keys:", keysOf(result))

    const list = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : null
    if (!list || list.length === 0) {
      console.log("no schemas in workspace; cannot probe definitions")
      return
    }

    const s = list[0]
    console.log("\nschemas[0] keys:", keysOf(s))

    const def = s?.definition
    if (def && typeof def === "object") {
      const firstFieldKey = Object.keys(def)[0]
      if (firstFieldKey) {
        const firstField = def[firstFieldKey]
        console.log(`\nschemas[0].definition['${firstFieldKey}'] keys:`, keysOf(firstField))
        console.log("type presence:", typePresence(firstField))
        console.log(
          `sample schemas[0].definition['${firstFieldKey}']:`,
          JSON.stringify(firstField, null, 2).slice(0, 500),
        )
      }
    } else {
      console.log("no `definition` block on schema[0]")
    }
  } catch (err) {
    console.error("schemas.list failed:", err?.message || err)
  }
}

await probeSearch()
await probeSchemas()
