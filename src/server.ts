/**
 * Talonic MCP server, stdio entry point.
 *
 * Built as a separate executable bundle by tsup, with a shebang banner
 * so it can be invoked directly via `npx @talonic/mcp` or wired into
 * `claude_desktop_config.json`, `mcp.json`, or any other MCP-aware
 * client config.
 *
 * @internal
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createServer } from "./server-factory.js"
import { SERVER_NAME, VERSION } from "./version.js"

const HELP_TEXT = `talonic-mcp - Talonic MCP server

USAGE
  talonic-mcp                          Start the server on stdio (default)
  talonic-mcp --help                   Show this help message
  talonic-mcp --version                Show version

ENVIRONMENT
  TALONIC_API_KEY    (required)        Your Talonic API key. Get one at
                                       https://app.talonic.com (free tier:
                                       50 extractions / day, no credit card).

  TALONIC_BASE_URL   (optional)        Override the API base URL.

USAGE FROM AN MCP CLIENT (Claude Desktop example)
  Add to claude_desktop_config.json:
    {
      "mcpServers": {
        "talonic": {
          "command": "npx",
          "args": ["-y", "@talonic/mcp"],
          "env": { "TALONIC_API_KEY": "tlnc_..." }
        }
      }
    }

DOCS
  https://github.com/talonicdev/talonic-mcp
`

/**
 * Boot the server against stdio.
 *
 * Returns the exit code so callers can decide how to terminate. The
 * separate entry/exit decoupling keeps this function testable without
 * actually attaching to stdio.
 *
 * @internal
 */
export async function main(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  out: (line: string) => void = (line) => process.stdout.write(line + "\n"),
  err: (line: string) => void = (line) => process.stderr.write(line + "\n"),
): Promise<number> {
  if (argv.includes("--version") || argv.includes("-v")) {
    out(`${SERVER_NAME} ${VERSION}`)
    return 0
  }

  if (argv.includes("--help") || argv.includes("-h")) {
    out(HELP_TEXT)
    return 0
  }

  const apiKey = env["TALONIC_API_KEY"]
  if (!apiKey) {
    err("Error: TALONIC_API_KEY environment variable is required.")
    err("Get a key at https://app.talonic.com and set it before launching the server.")
    return 1
  }

  const baseUrl = env["TALONIC_BASE_URL"]
  const server = createServer({ apiKey, ...(baseUrl ? { baseUrl } : {}) })

  const transport = new StdioServerTransport()
  await server.connect(transport)

  // McpServer keeps the process alive while the transport is open. We
  // hand control over to the SDK's lifecycle here; if the transport
  // closes, Node exits naturally.
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    if (code !== 0) process.exit(code)
  })
}
