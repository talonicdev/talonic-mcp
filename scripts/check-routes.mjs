#!/usr/bin/env node
// Route-drift guard: every `/v1/...` route string in src/tools/** must be an
// operation of the public Talonic API spec, with the verb the tool uses.
//
//   node scripts/check-routes.mjs                 live spec, pinned fallback
//   node scripts/check-routes.mjs --pinned        pinned spec only (offline)
//   node scripts/check-routes.mjs --update-pin    rewrite the pinned file from the live spec
//
// The live spec is https://api.talonic.com/v1/docs/openapi.json (override with
// TALONIC_OPENAPI_URL). When it cannot be fetched the pinned copy
// (scripts/openapi-routes.pinned.json: paths, verbs and uuid path params only)
// is used and the run says so. Exit 1 on any route the spec lacks.
//
// Matching is per path segment. A `${...}` segment in a tool matches any spec
// segment. A literal tool segment matches the same literal, or a spec
// `{param}` only when that param is not a uuid: `GET /v1/parties/issues`
// against `GET /v1/parties/{id}` (id: uuid) is a miss, the wildcard collision
// that hid the 0.1.103 parties breakage. Routes allowed to be missing from the
// spec while the platform documents them are listed in
// scripts/route-gaps.json, each with a reason; an entry nothing uses any more,
// or one the spec now has, fails too, so the list only shrinks.
//
// Branches a tool picks from its arguments are exercised at runtime by
// tests/tools/route-branches.test.ts against the same matcher.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
export const LIVE_SPEC_URL =
  process.env.TALONIC_OPENAPI_URL ?? "https://api.talonic.com/v1/docs/openapi.json"
export const PINNED_PATH = join(ROOT, "scripts", "openapi-routes.pinned.json")
export const GAPS_PATH = join(ROOT, "scripts", "route-gaps.json")
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

// ── Spec ────────────────────────────────────────────────────────────────────

/** Reduce an OpenAPI document to { path: { methods[], uuid_params[] } }. */
export function reduceSpec(doc) {
  const paths = {}
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    const methods = []
    const uuid = new Set()
    const scan = (params) => {
      for (const p of params ?? []) {
        if (p?.in === "path" && p?.schema?.format === "uuid") uuid.add(p.name)
      }
    }
    scan(item.parameters)
    for (const m of METHODS) {
      const op = item[m.toLowerCase()]
      if (!op) continue
      methods.push(m)
      scan(op.parameters)
    }
    if (methods.length) paths[path] = { methods, uuid_params: [...uuid].sort() }
  }
  return paths
}

function compileSpec(paths) {
  return Object.entries(paths).map(([path, v]) => ({
    path,
    segments: path.split("/").filter(Boolean),
    methods: new Set(v.methods),
    uuid: new Set(v.uuid_params),
  }))
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function segmentMatches(toolSeg, specSeg, uuidParams) {
  if (toolSeg === "{}") return true
  const param = /^\{(.+)\}$/.exec(specSeg)
  if (!param) return toolSeg === specSeg
  // A literal in a param slot: only where the param is free text (or the literal is a uuid).
  return !uuidParams.has(param[1]) || UUID_RE.test(toolSeg)
}

/**
 * The spec operations a tool route resolves to. A `prefix` route (its tail is
 * built at runtime) matches every spec path that starts with its segments.
 */
export function resolveRoute(spec, route) {
  const segs = route.path.split("/").filter(Boolean)
  const hits = spec.filter((s) => {
    if (route.prefix ? s.segments.length < segs.length : s.segments.length !== segs.length) {
      return false
    }
    return segs.every((seg, i) => segmentMatches(seg, s.segments[i], s.uuid))
  })
  // Prefer an all-literal match: `/v1/x/status` resolves to that path, not to `/v1/x/{id}`.
  const exact = hits.filter((s) => segs.every((seg, i) => seg === "{}" || s.segments[i] === seg))
  return exact.length ? exact : hits
}

/** null when the route is an operation of the spec; else why not. */
export function checkRoute(spec, route) {
  const hits = resolveRoute(spec, route)
  if (!hits.length) return "no such path in the spec"
  if (!route.method) return null
  if (hits.some((h) => h.methods.has(route.method))) return null
  return `path exists, but not for ${route.method} (spec: ${[...new Set(hits.flatMap((h) => [...h.methods]))].join(", ")})`
}

// ── Source extraction ───────────────────────────────────────────────────────

function listTs(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...listTs(p))
    else if (name.endsWith(".ts")) out.push(p)
  }
  return out
}

/** Blank out comments, keeping offsets (so line numbers stay right). */
function stripComments(src) {
  let out = ""
  let i = 0
  let quote = null
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (quote) {
      out += c
      if (c === "\\") {
        out += n ?? ""
        i += 2
        continue
      }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c
      out += c
      i++
      continue
    }
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") {
        out += " "
        i++
      }
      continue
    }
    if (c === "/" && n === "*") {
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " "
        i++
      }
      out += "  "
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}

/** Every string or template literal: { start, end, quote, body }. */
function literals(src) {
  const out = []
  let i = 0
  while (i < src.length) {
    const q = src[i]
    if (q !== '"' && q !== "'" && q !== "`") {
      i++
      continue
    }
    let j = i + 1
    let depth = 0
    while (j < src.length) {
      if (src[j] === "\\") {
        j += 2
        continue
      }
      if (q === "`" && src[j] === "$" && src[j + 1] === "{") {
        depth++
        j += 2
        continue
      }
      if (q === "`" && depth > 0 && src[j] === "}") {
        depth--
        j++
        continue
      }
      if (depth === 0 && src[j] === q) break
      if (q !== "`" && src[j] === "\n") break
      j++
    }
    out.push({ start: i, end: j + 1, quote: q, body: src.slice(i + 1, j) })
    i = j + 1
  }
  return out
}

/** Turn a literal's body into a route path, or null when it is not one. */
function toRoute(body, consts) {
  let s = body.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (m, name) =>
    consts.has(name) ? consts.get(name) : m,
  )
  // A base URL in front (`${baseUrl ?? DEFAULT_BASE}/v1/...`) is not part of the route.
  s = s.replace(/^\$\{[^}]*\}(?=\/v1\/)/, "")
  if (!s.startsWith("/v1/") && s !== "/v1") return null
  s = s.split("?")[0]
  const segs = s.split("/").filter(Boolean)
  const out = []
  let prefix = false
  for (const seg of segs) {
    if (!seg.includes("${")) {
      out.push(seg)
      continue
    }
    // `${x}` alone is one runtime segment; anything glued to it (`${id}${rest}`) builds a tail at runtime.
    if (/^\$\{[^}]*\}$/.test(seg)) {
      out.push("{}")
      continue
    }
    if (/^\$\{[^}]*\}/.test(seg)) out.push("{}")
    prefix = true
    break
  }
  if (s.endsWith("/") && !prefix) prefix = true
  return { path: "/" + out.join("/"), prefix }
}

export function extractRoutes(files = listTs(join(ROOT, "src", "tools"))) {
  const routes = []
  for (const file of files) {
    const raw = readFileSync(file, "utf8")
    const src = stripComments(raw)
    const lits = literals(src)
    // Module constants holding a route base: const BASE = "/v1/processes"
    const consts = new Map()
    for (const m of src.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*(["'`])(\/v1[^"'`$]*)\2/g)) {
      consts.set(m[1], m[3])
    }
    for (const lit of lits) {
      const route = toRoute(lit.body, consts)
      if (!route) continue
      const before = src.slice(Math.max(0, lit.start - 120), lit.start)
      const verb =
        /["'](GET|POST|PUT|PATCH|DELETE)["']\s*,\s*$/.exec(before) ??
        /method\s*:\s*["'](GET|POST|PUT|PATCH|DELETE)["']\s*,\s*path\s*:\s*$/.exec(before)
      routes.push({
        file: relative(ROOT, file),
        line: src.slice(0, lit.start).split("\n").length,
        method: verb ? verb[1] : null,
        ...route,
      })
    }
  }
  return routes
}

// ── Gaps ────────────────────────────────────────────────────────────────────

export function loadGaps() {
  return JSON.parse(readFileSync(GAPS_PATH, "utf8")).gaps ?? []
}

const gapKey = (g) => `${g.method ?? "*"} ${g.path ?? `${g.path_prefix}…`}`

/**
 * Check routes against a reduced spec. Returns { misses, staleGaps }:
 * misses are routes neither the spec nor a gap covers; staleGaps are gap
 * entries no route uses or the spec now covers.
 */
export function checkAll(paths, routes, gaps = loadGaps()) {
  const spec = compileSpec(paths)
  const used = new Set()
  const misses = []
  for (const r of routes) {
    const why = checkRoute(spec, r)
    if (!why) continue
    // An entry for the route's own verb first; then one for any verb; a route whose verb the
    // source does not show (a probe's bare fetch, a computed path) takes any entry for its path.
    const same = gaps.filter((g) =>
      g.path_prefix ? r.path.startsWith(g.path_prefix) : g.path === r.path,
    )
    const gap =
      same.find((g) => g.method && g.method === r.method) ??
      same.find((g) => !g.method) ??
      (r.method ? undefined : same[0])
    if (gap) {
      used.add(gapKey(gap))
      continue
    }
    misses.push({ ...r, why })
  }
  const staleGaps = gaps
    .filter((g) => {
      if (!used.has(gapKey(g))) return true
      if (g.path_prefix) {
        return spec.some((p) => p.path.startsWith(g.path_prefix))
      }
      return !checkRoute(spec, { path: g.path, method: g.method ?? null, prefix: false })
    })
    .map((g) => ({
      ...g,
      why: used.has(gapKey(g))
        ? "the spec has it now: delete the entry"
        : "no tool uses it: delete the entry",
    }))
  return { misses, staleGaps }
}

export function loadPinned() {
  return JSON.parse(readFileSync(PINNED_PATH, "utf8"))
}

async function fetchLive() {
  const res = await fetch(LIVE_SPEC_URL, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return reduceSpec(await res.json())
}

// ── CLI ─────────────────────────────────────────────────────────────────────

async function main(argv) {
  let paths
  let source
  if (argv.includes("--pinned")) {
    paths = loadPinned().paths
    source = `pinned ${relative(ROOT, PINNED_PATH)}`
  } else {
    try {
      paths = await fetchLive()
      source = `live ${LIVE_SPEC_URL}`
      if (argv.includes("--update-pin")) {
        const pinned = { source: LIVE_SPEC_URL, fetched_at: new Date().toISOString(), paths }
        writeFileSync(PINNED_PATH, JSON.stringify(pinned, null, 2) + "\n")
        console.log(`Pinned ${Object.keys(paths).length} paths to ${relative(ROOT, PINNED_PATH)}.`)
      }
    } catch (err) {
      if (argv.includes("--update-pin")) {
        console.error(`Cannot update the pin: ${err.message}`)
        return 1
      }
      const pinned = loadPinned()
      paths = pinned.paths
      source = `pinned ${relative(ROOT, PINNED_PATH)} (fetched ${pinned.fetched_at}); live spec unreachable: ${err.message}`
      console.log(`::warning::Route check fell back to the pinned spec: ${err.message}`)
    }
  }
  const routes = extractRoutes()
  const { misses, staleGaps } = checkAll(paths, routes)
  console.log(
    `Checked ${routes.length} route strings in src/tools against ${Object.keys(paths).length} spec paths (${source}).`,
  )
  for (const m of misses) {
    console.log(
      `::error file=${m.file},line=${m.line}::${m.method ?? "(any verb)"} ${m.path}${m.prefix ? "/…" : ""}: ${m.why}`,
    )
  }
  for (const g of staleGaps) {
    console.log(`::error file=scripts/route-gaps.json::${gapKey(g)}: ${g.why}`)
  }
  if (misses.length || staleGaps.length) {
    console.log(
      `${misses.length} route(s) missing from the spec, ${staleGaps.length} stale gap entr(y/ies). A tool must not ship before its route is in the public API.`,
    )
    return 1
  }
  console.log("Every tool route is in the spec.")
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}
