/**
 * @talonic/mcp
 *
 * Official Talonic MCP server. Lets AI agents extract structured,
 * schema-validated data from any document via the Model Context
 * Protocol (MCP).
 *
 * The default entry point is the executable at `dist/server.js`,
 * invoked via `npx @talonic/mcp` or wired into Claude Desktop, Cursor,
 * Cline, or any other MCP-aware client. This module re-exports the
 * server factory so the same code can be embedded in custom transports
 * (e.g. a hosted HTTP endpoint).
 *
 * @packageDocumentation
 */

export { createServer } from "./server-factory.js"
export type { CreateServerOptions } from "./server-factory.js"
export { SERVER_NAME, VERSION } from "./version.js"
