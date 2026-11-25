// ---------------------------------------------------------------------------
// Terminology lint: public text names outcomes and contracts, never mechanics.
//
// The denylist is docs-overhaul-plan §0: pipeline internals, learning and
// retrieval internals, knowledge-model internals, models and vendors as
// processing internals, internal code names. Context decides what is allowed:
//   - code blocks and fenced code are never scanned (literal requests/responses);
//   - inline `code` spans are literal field, parameter, enum and path names a
//     customer must send or read, so they are stripped before matching;
//   - link targets are URLs (stripped; link text is still scanned);
//   - param-table `name` cells are literal names (only `description` is scanned);
//   - install and connect pages may name the AI products customers act on.
// Ported from the platform repo's packages/docs/src/content/terminology.ts
// (same rules); tests/content/terminology.test.ts runs it over every rendered
// MCP docs section and every public tool's description and parameter text.
// ---------------------------------------------------------------------------

import type { DocBlock, RawSection } from "../../src/content/types"

/** A denylist category from docs-overhaul-plan §0. */
export type TermCategory = "pipeline" | "learning" | "knowledge" | "vendor" | "codename"

/** One denylisted term. */
export interface TermRule {
  id: string
  category: TermCategory
  pattern: RegExp
  /** What to say instead (outcome language). */
  hint: string
}

/** The denylist. Patterns are matched against prose with literals removed. */
export const TERM_RULES: TermRule[] = [
  // Pipeline internals
  {
    id: "phase-n",
    category: "pipeline",
    pattern: /\bphases?\s*[1-4]\b/gi,
    hint: "Describe what happens to the document, not which phase does it.",
  },
  {
    id: "pipeline-phase",
    category: "pipeline",
    pattern: /\bpipeline phases?\b/gi,
    hint: "Describe the outcome of the run.",
  },
  {
    id: "bypass-strategy",
    category: "pipeline",
    pattern: /\bbypass strateg(?:y|ies)\b/gi,
    hint: "Drop it; say what the user configures.",
  },
  // Learning / retrieval internals
  {
    id: "n-shot",
    category: "learning",
    pattern: /\bn-?shot\b/gi,
    hint: '"Corrections improve future runs."',
  },
  {
    id: "embedding",
    category: "learning",
    pattern: /\bembeddings?\b/gi,
    hint: 'Say "similar" or "matching" values.',
  },
  {
    id: "vector",
    category: "learning",
    pattern: /\bvectors?\b/gi,
    hint: 'Say "similar" or "matching".',
  },
  {
    id: "cosine",
    category: "learning",
    pattern: /\bcosine\b/gi,
    hint: 'Say "similarity score" or drop it.',
  },
  {
    id: "cluster",
    category: "learning",
    pattern: /\b(?:semantic(?:ally)?\s+)?cluster(?:s|ed|ing)?\b/gi,
    hint: 'Say "group of similar fields/values".',
  },
  // Knowledge model internals
  {
    id: "ontology",
    category: "knowledge",
    pattern: /\bontolog(?:y|ies|ical)\b/gi,
    hint: 'Say "document types".',
  },
  {
    id: "schema-graph",
    category: "knowledge",
    pattern: /\bschema[- ]graph\b/gi,
    hint: 'Say "how your Specs relate".',
  },
  {
    id: "field-registry",
    category: "knowledge",
    pattern: /\bfield[- ]registry\b/gi,
    hint: 'Say "the fields Talonic knows in your workspace".',
  },
  {
    id: "tier-system",
    category: "knowledge",
    pattern: /\b(?:tier system|(?:registry|field|maturity) tiers?)\b/gi,
    hint: 'Say "field maturity" or describe the outcome.',
  },
  {
    id: "semantic-layer",
    category: "knowledge",
    pattern: /\bsemantic layer\b/gi,
    hint: "Drop it; describe what the user can read.",
  },
  {
    id: "index",
    category: "knowledge",
    pattern: /\b(?:semantic|vector|embedding|search|field|shared)\s+ind(?:ex|exes|ices)\b/gi,
    hint: 'Say "search" or drop it.',
  },
  {
    id: "graph",
    category: "knowledge",
    pattern: /\b(?:entity|knowledge) graph\b/gi,
    hint: 'Say "linked records" or "cases".',
  },
  {
    id: "heuristic",
    category: "knowledge",
    pattern: /\bheuristics?\b/gi,
    hint: "Say what decides the outcome in user terms.",
  },
  // Models and vendors (as processing internals)
  {
    id: "claude",
    category: "vendor",
    pattern: /\bClaude\b(?!\s+(?:Code|Desktop|for\b))(?!\.ai)/g,
    hint: 'Do not name the model; say "Talonic reads…".',
  },
  {
    id: "model-family",
    category: "vendor",
    pattern: /\b(?:Haiku|Sonnet|Opus)\b/g,
    hint: "Do not name models.",
  },
  {
    id: "vendor",
    category: "vendor",
    pattern: /\b(?:Anthropic|OpenAI|Mistral|Bedrock|Gemini)\b/g,
    hint: "Vendors are named only in the Trust page subprocessor list.",
  },
  {
    id: "gpt",
    category: "vendor",
    pattern: /\bGPT(?:-?\d[\w.]*)?\b/g,
    hint: "Do not name models (ChatGPT as a product is fine).",
  },
  {
    id: "llm",
    category: "vendor",
    pattern: /\bLLMs?\b|\b[Ll]arge [Ll]anguage [Mm]odels?\b/g,
    hint: 'Say "Talonic reads/answers…".',
  },
  {
    id: "model",
    category: "vendor",
    pattern: /\b(?:vision|language|AI|LLM|reasoning) models?\b/gi,
    hint: "Describe the outcome, not the model.",
  },
  {
    id: "prompt",
    category: "vendor",
    pattern: /\bprompt(?:s|ing)?\b/gi,
    hint: 'Say "instructions".',
  },
  // Internal code names
  { id: "spec2", category: "codename", pattern: /\bspec2\b/gi, hint: 'Say "Spec".' },
  { id: "void", category: "codename", pattern: /\bvoid\b/gi, hint: "Internal design-system name." },
  { id: "ink", category: "codename", pattern: /\bink\b/gi, hint: "Internal code name." },
  { id: "one-engine", category: "codename", pattern: /\bone[- ]engine\b/gi, hint: 'Say "run".' },
  {
    id: "sheet-capture",
    category: "codename",
    pattern: /\bsheet[- ]capture\b/gi,
    hint: "Internal code name.",
  },
  {
    id: "wzb",
    category: "codename",
    pattern: /\bwzb\b/gi,
    hint: "Use the app's customer-facing name.",
  },
  { id: "dataspace", category: "codename", pattern: /\bdataspaces?\b/gi, hint: 'Say "run".' },
  {
    id: "lane-audit",
    category: "codename",
    pattern: /\blane audit\b/gi,
    hint: "Internal code name.",
  },
]

/**
 * Pages where customers install or connect an AI client, so vendor and
 * product names are the instructions themselves (docs-overhaul-plan §0).
 */
export const INSTALL_PAGE_SLUGS = new Set<string>([
  "install-overview",
  "claude-desktop",
  "cursor",
  "cline",
  "continue",
  "cowork",
  "chatgpt",
  "env-variables",
  "get-api-key",
])

/** One denylist hit. */
export interface TermHit {
  /** Where: `<domain>/<slug>`, `openapi`, or `llms.txt`. */
  source: string
  /** Field within the source, e.g. `content[3].text` or `paths./v1/x.get.description`. */
  location: string
  rule: string
  category: TermCategory
  match: string
  excerpt: string
}

/**
 * Prose with literals removed: fenced code, inline code, link targets, bare
 * URLs and API paths, dotted event names, snake_case identifiers, filenames.
 */
export function stripLiterals(text: string): string {
  return (
    text
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`[^`\n]*`/g, " ")
      .replace(/\]\([^)]*\)/g, "] ")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/(?:^|\s)\/v1\/\S*/g, " ")
      // Identifiers written bare: event names (`run.dataspace.completed`), snake_case fields.
      .replace(/\b[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*){2,}\b/g, " ")
      .replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g, " ")
      .replace(/\b[\w-]+\.(?:txt|json|ya?ml|md|csv|pdf)\b/gi, " ")
  )
}

/** Hits of the denylist in one piece of prose. */
export function scanText(
  text: string | undefined,
  source: string,
  location: string,
  opts: { allowVendor?: boolean } = {},
): TermHit[] {
  if (!text) return []
  const prose = stripLiterals(text)
  const hits: TermHit[] = []
  for (const rule of TERM_RULES) {
    if (opts.allowVendor && rule.category === "vendor") continue
    rule.pattern.lastIndex = 0
    for (const m of prose.matchAll(rule.pattern)) {
      const at = m.index ?? 0
      hits.push({
        source,
        location,
        rule: rule.id,
        category: rule.category,
        match: m[0],
        excerpt: prose
          .slice(Math.max(0, at - 50), at + m[0].length + 50)
          .replace(/\s+/g, " ")
          .trim(),
      })
    }
  }
  return hits
}

function scanBlocks(
  blocks: DocBlock[],
  source: string,
  path: string,
  opts: { allowVendor?: boolean },
): TermHit[] {
  const hits: TermHit[] = []
  blocks.forEach((b, i) => {
    const at = `${path}[${i}]`
    switch (b.type) {
      case "paragraph":
      case "callout":
        hits.push(...scanText(b.text, source, `${at}.text`, opts))
        break
      case "heading":
        hits.push(...scanText(b.text, source, `${at}.text`, opts))
        break
      case "list":
        b.items.forEach((item, j) =>
          hits.push(...scanText(item, source, `${at}.items[${j}]`, opts)),
        )
        break
      case "param-table":
        hits.push(...scanText(b.title, source, `${at}.title`, opts))
        b.params.forEach((p, j) =>
          hits.push(...scanText(p.description, source, `${at}.params[${j}].description`, opts)),
        )
        break
      case "endpoint":
        hits.push(...scanText(b.summary, source, `${at}.summary`, opts))
        hits.push(...scanText(b.description, source, `${at}.description`, opts))
        hits.push(...scanBlocks(b.blocks || [], source, `${at}.blocks`, opts))
        break
      case "code":
        break // literal requests and responses
    }
  })
  return hits
}

/** Hits in one docs section (title, meta, body, FAQ, related labels, mentions). */
export function scanSection(domain: string, s: RawSection): TermHit[] {
  const source = `${domain}/${s.slug}`
  const opts = { allowVendor: INSTALL_PAGE_SLUGS.has(s.slug) }
  return [
    ...scanText(s.title, source, "title", opts),
    ...scanText(s.seoTitle, source, "seoTitle", opts),
    ...scanText(s.description, source, "description", opts),
    ...scanBlocks(s.content, source, "content", opts),
    ...(s.faq || []).flatMap((f, i) => [
      ...scanText(f.question, source, `faq[${i}].question`, opts),
      ...scanText(f.answer, source, `faq[${i}].answer`, opts),
    ]),
    ...(s.related || []).flatMap((r, i) => scanText(r.label, source, `related[${i}].label`, opts)),
    ...(s.mentions || []).flatMap((m, i) => scanText(m, source, `mentions[${i}]`, opts)),
  ]
}

/** Hits in llms.txt-style plain text (markdown links and code are literals). */
export function scanPlainText(name: string, text: string): TermHit[] {
  return text.split("\n").flatMap((line, i) => scanText(line, name, `line ${i + 1}`))
}

/** Hit counts grouped by a key. */
export function countBy(hits: TermHit[], key: (h: TermHit) => string): [string, number][] {
  const m = new Map<string, number>()
  for (const h of hits) m.set(key(h), (m.get(key(h)) || 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}
