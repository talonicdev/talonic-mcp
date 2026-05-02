// @ts-ignore — JSON import resolved by bundler (tsup/esbuild)
import pkg from "../package.json" with { type: "json" }

/**
 * The current MCP server version. Sent in the server `info` block during
 * the MCP handshake. Derived from package.json at build time.
 *
 * @public
 */
export const VERSION: string = pkg.version

/**
 * The MCP server name. Identifies the server to MCP clients (Claude
 * Desktop, Cursor, Cline, etc.) when they list connected servers.
 *
 * @public
 */
export const SERVER_NAME = "talonic"
