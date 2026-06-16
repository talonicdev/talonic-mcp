// Capture each widget harness HTML to a card-only retina PNG using headless
// Chrome — no browser chrome, no whitespace. Two passes per file: measure the
// rendered height (from the title hook the harness sets), then screenshot the
// viewport at exactly that height at 2x.
//
// Run: node scripts/gen-screenshots.mjs && node scripts/capture-screenshots.mjs
import { execFileSync } from "node:child_process"
import { readdirSync, mkdirSync } from "node:fs"

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const DIR = "docs/chatgpt-apps-sdk/screenshots"
const OUT = `${DIR}/png`
const SCALE = 2 // retina; bump to 3 for 3x
const WIDTH = 353 // App Directory "Card" width

mkdirSync(OUT, { recursive: true })

const common = [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--default-background-color=ffffffff",
  "--virtual-time-budget=2500",
]

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".html"))) {
  const url = `file://${process.cwd()}/${DIR}/${file}`

  // Pass 1: measure content height via the title hook ("HH<height>HH").
  // Tall viewport at the card width so body.scrollHeight reflects true content.
  const dom = execFileSync(CHROME, [...common, `--window-size=${WIDTH},6000`, "--dump-dom", url], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  })
  const m = dom.match(/HH(\d+)HH/)
  const height = m ? Math.max(200, parseInt(m[1], 10)) : 800
  const out = `${OUT}/${file.replace(".html", ".png")}`

  // Pass 2: screenshot the viewport sized exactly to the card.
  execFileSync(
    CHROME,
    [
      ...common,
      `--force-device-scale-factor=${SCALE}`,
      `--window-size=${WIDTH},${height}`,
      `--screenshot=${out}`,
      url,
    ],
    { stdio: ["ignore", "ignore", "ignore"] },
  )
  console.log(`captured ${out}  (${WIDTH}x${height} @${SCALE}x = ${WIDTH * SCALE}x${height * SCALE})`)
}
