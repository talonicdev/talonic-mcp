/**
 * Origin allowlist for the Talonic MCP server.
 *
 * Required by Anthropic's Connectors Directory compliance checklist
 * (Origin-header validation against an allowlist to mitigate DNS-rebinding
 * attacks per the MCP spec).
 *
 * Three Claude.ai variants for the official connector, plus four MCP-directory
 * surfaces in case they ever add browser-based test consoles. Native and
 * server-to-server clients (Claude Desktop, Cursor, Cline, Continue, Cowork,
 * mcp-inspector, curl) typically send no `Origin` header and are not affected.
 */

export const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  "https://claude.ai",
  "https://www.claude.ai",
  "https://app.claude.ai",
  "https://cursor.directory",
  "https://glama.ai",
  "https://mcp.so",
  "https://smithery.ai",
])

/**
 * Returns true when the incoming `Origin` header is acceptable.
 *
 * - Missing or empty Origin: accepted (non-browser clients).
 * - Origin in the allowlist: accepted.
 * - Any other Origin: rejected.
 */
export function isOriginAllowed(originHeader: string | undefined): boolean {
  if (!originHeader) return true
  return ALLOWED_ORIGINS.has(originHeader)
}
