import { defineConfig } from "tsup"

export default defineConfig([
  // Library entry: lets other code import @talonic/mcp programmatically
  // (e.g. to embed the server in a custom transport).
  // Content entry: structured doc data consumed by the website.
  {
    entry: { index: "src/index.ts", content: "src/content/index.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "node18",
    outDir: "dist",
    splitting: false,
    treeshake: true,
    minify: false,
    external: ["@modelcontextprotocol/sdk", "@talonic/node"],
  },
  // Server entry: executable invoked via `npx @talonic/mcp` or
  // `node dist/server.js`. Bundled with a shebang banner.
  {
    entry: { server: "src/server.ts" },
    format: ["esm"],
    sourcemap: true,
    target: "node18",
    outDir: "dist",
    splitting: false,
    treeshake: true,
    minify: false,
    banner: { js: "#!/usr/bin/env node" },
    external: ["@modelcontextprotocol/sdk", "@talonic/node"],
  },
  // HTTP server entry: hosted MCP endpoint for Railway / container deploys.
  // Invoked via `node dist/http-server.js`.
  {
    entry: { "http-server": "src/http-server.ts" },
    format: ["esm"],
    sourcemap: true,
    target: "node18",
    outDir: "dist",
    splitting: false,
    treeshake: true,
    minify: false,
    external: ["@modelcontextprotocol/sdk", "@talonic/node"],
  },
])
