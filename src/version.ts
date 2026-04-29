/**
 * The current MCP server version. Sent in the server `info` block during
 * the MCP handshake. Kept in sync with package.json by the release process.
 *
 * @public
 */
export const VERSION = "0.1.4"

/**
 * The MCP server name. Identifies the server to MCP clients (Claude
 * Desktop, Cursor, Cline, etc.) when they list connected servers.
 *
 * @public
 */
export const SERVER_NAME = "talonic"
