// Generate isolated, mobile-width widget HTML for App Directory screenshots.
//
// Renders each widget with realistic sample data, with NO ChatGPT UI — just the
// bare card at 353px width (the App Directory mobile-card spec). Open each
// output file in Chrome and capture the <body> node at 2x DPR (see the README
// printed at the end).
//
// Run: node scripts/gen-screenshots.mjs
import esbuild from "esbuild"
import { writeFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

// Bundle the widget HTML builders (TS) into a CJS string we can evaluate.
const built = await esbuild.build({
  stdin: {
    contents: `
      export { getExtractionResultWidgetHtml } from "./src/widgets/extraction-result.ts"
      export { getSearchResultsWidgetHtml }   from "./src/widgets/search-results.ts"
      export { getFilterResultsWidgetHtml }   from "./src/widgets/filter-results.ts"
      export { getDocumentMetaWidgetHtml }    from "./src/widgets/document-meta.ts"
      export { getMarkdownViewWidgetHtml }    from "./src/widgets/markdown-view.ts"
      export { getSchemaListWidgetHtml }      from "./src/widgets/schema-list.ts"
      export { getSchemaSavedWidgetHtml }     from "./src/widgets/schema-saved.ts"
      export { getBalanceWidgetHtml }         from "./src/widgets/balance.ts"
      export { getUploadLinkWidgetHtml }      from "./src/widgets/upload-link.ts"
    `,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
})
const mod = { exports: {} }
new Function("module", "exports", "require", built.outputFiles[0].text)(mod, mod.exports, require)
const W = mod.exports

// Realistic sample payloads (the widget reads window.openai.toolOutput).
const SAMPLES = {
  extract: {
    file: "extract.html",
    html: W.getExtractionResultWidgetHtml(),
    data: {
      document: { filename: "sample-invoice.pdf", pages: 1, type_detected: "Commercial Invoice", language_detected: "en" },
      data: { vendor_name: "Acme Corporation", invoice_number: "INV-2026-0472", total_amount: 21428.75, invoice_date: "2026-03-15" },
      confidence: { overall: 0.92, fields: { vendor_name: 0.97, invoice_number: 0.95, total_amount: 0.99, invoice_date: 0.91 } },
    },
  },
  balance: {
    file: "balance.html",
    html: W.getBalanceWidgetHtml(),
    data: { balance_credits: 1000, balance_eur: 1.0, burn_rate_30d_credits: 230, projected_runway_days: 25, tier: "Pro", tier_resets_at: "2026-07-01T00:00:00Z" },
  },
  schemaList: {
    file: "schema-list.html",
    html: W.getSchemaListWidgetHtml(),
    data: {
      data: [
        { name: "Invoice Review", short_id: "SCH-7898199F", field_count: 4, description: "Vendor, total, invoice and due dates" },
        { name: "Bank Statement to CSV", short_id: "SCH-64B8AE0A", field_count: 11, description: "Account metadata and transactions" },
        { name: "Certificate of Insurance", short_id: "SCH-3A4D79D2", field_count: 20, description: "Policy, coverage, and entity details" },
      ],
      pagination: { total: 3 },
    },
  },
  filter: {
    file: "filter.html",
    html: W.getFilterResultsWidgetHtml(),
    data: {
      // Keep to 2 field columns so the 3-column table fits 353px without
      // clipping (the widget renders up to 4, but mobile width can't hold them).
      data: [
        { filename: "INV412166.pdf", fields: { invoice_total: 2450.0, invoice_currency: "USD" } },
        { filename: "Invoice-Scan.pdf", fields: { invoice_total: 1890.5, invoice_currency: "EUR" } },
        { filename: "March-2024.pdf", fields: { invoice_total: 3120.0, invoice_currency: "USD" } },
        { filename: "Acme-Q2.pdf", fields: { invoice_total: 1575.0, invoice_currency: "GBP" } },
      ],
      total: 4,
    },
  },
}

const outDir = "docs/chatgpt-apps-sdk/screenshots"
mkdirSync(outDir, { recursive: true })

for (const key of Object.keys(SAMPLES)) {
  const { file, html, data } = SAMPLES[key]
  // Inject the sample toolOutput + a FORCED light theme at 353px mobile width,
  // BEFORE the widget script runs (it reads window.openai.toolOutput on load).
  // Forcing the light palette (overriding the widget's prefers-color-scheme dark
  // block with !important) guarantees dark-text-on-white contrast regardless of
  // the capturing machine's OS theme — otherwise dark-mode near-white text
  // renders invisibly on a light page.
  const inject =
    `<script>window.openai={toolOutput:${JSON.stringify(data)}};</script>` +
    `<style>
      :root{
        color-scheme: light;
        --bg:#ffffff!important; --fg:#1f2328!important; --muted:#59636e!important;
        --border:#d1d9e0!important; --accent:#4f46e5!important; --good:#1a7f37!important;
        --warn:#9a6700!important; --bad:#cf222e!important; --chip:#f6f8fa!important;
      }
      html,body{ width:353px!important; margin:0!important; background:#ffffff!important; color:#1f2328!important; }
      /* Screenshot-only vertical tightening so taller cards stay under the
         directory's 860px PNG height cap. Content unchanged; spacing only. */
      .root{ padding:14px!important; }
      .header{ margin-bottom:8px!important; }
      th,td{ padding-top:7px!important; padding-bottom:7px!important; }
      .kv{ padding:8px 10px!important; }
      .grid{ gap:7px!important; margin-top:8px!important; }
      .actions{ margin-top:8px!important; }
    </style>` +
    // Expose the rendered content height in the title so the headless capture
    // script can size the viewport to the card exactly (no trailing whitespace).
    `<script>addEventListener("load",function(){requestAnimationFrame(function(){` +
    `document.title="HH"+document.body.scrollHeight+"HH";});});</script>`
  const out = html.replace("</head>", inject + "\n</head>")
  writeFileSync(`${outDir}/${file}`, out)
  console.log("wrote", `${outDir}/${file}`)
}

console.log(`
Done. ${Object.keys(SAMPLES).length} files in ${outDir}/.

Capture each (no ChatGPT UI, exact size, 2x):
  1. Open the .html file in Chrome.
  2. Open DevTools (Cmd+Opt+I) -> toggle Device Toolbar (Cmd+Shift+M).
  3. Set width 353, device pixel ratio 2 (or 3).
  4. Cmd+Shift+P -> "Capture node screenshot" -> pick the <body> element.
     => PNG ~706px wide (2x) or ~1059px (3x), card only, no chrome.
`)
