/**
 * Origin allowlist for the Talonic MCP server.
 *
 * Required by Anthropic's Connectors Directory compliance checklist
 * (Origin-header validation against an allowlist to mitigate DNS-rebinding
 * attacks per the MCP spec).
 *
 * Three Claude.ai variants for the official connector, ChatGPT/OpenAI review
 * and developer-mode surfaces, plus four MCP-directory surfaces in case they
 * ever add browser-based test consoles. Native and server-to-server clients
 * (Claude Desktop, Cursor, Cline, Continue, Cowork, mcp-inspector, curl)
 * typically send no `Origin` header and are not affected.
 */

export const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  "https://claude.ai",
  "https://www.claude.ai",
  "https://app.claude.ai",
  "https://chatgpt.com",
  "https://www.chatgpt.com",
  "https://chat.openai.com",
  "https://platform.openai.com",
  "https://cursor.directory",
  "https://glama.ai",
  "https://mcp.so",
  "https://smithery.ai",
])

/**
 * ChatGPT Apps SDK widget sandbox. Widgets render in an iframe hosted on a
 * per-app subdomain of this domain (`<app>.web-sandbox.oaiusercontent.com`),
 * and template/resource fetches from that context carry it as `Origin`.
 * The subdomain varies per app, so this is a suffix rule rather than a Set
 * entry. The leading dot prevents `evilweb-sandbox.…` spoofs; the `https://`
 * requirement is enforced at the call site.
 */
const SANDBOX_ORIGIN_SUFFIX = ".web-sandbox.oaiusercontent.com"

/**
 * Returns true when the incoming `Origin` header is acceptable.
 *
 * - Missing or empty Origin: accepted (non-browser clients).
 * - Origin in the allowlist: accepted.
 * - Any https origin on the ChatGPT widget sandbox domain: accepted.
 * - Any other Origin: rejected.
 */
export function isOriginAllowed(originHeader: string | undefined): boolean {
  if (!originHeader) return true
  if (ALLOWED_ORIGINS.has(originHeader)) return true
  return originHeader.startsWith("https://") && originHeader.endsWith(SANDBOX_ORIGIN_SUFFIX)
}
