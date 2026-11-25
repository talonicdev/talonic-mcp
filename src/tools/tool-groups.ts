import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { probeGroup, registerGroup, type ToolGroup } from "./_groups.js"
import { adminGroup } from "./admin.js"
import { aggregateGroup } from "./aggregate.js"
import { complianceGroup } from "./compliance.js"
import { contractDeskGroup } from "./contract-desk.js"
import { customsDeclarationGroup } from "./customs-declaration.js"
import { dataManagementGroup } from "./data-management.js"
import { eventsGroup } from "./events.js"
import { moneyFoundGroup } from "./money-found.js"
import { transportFoldersGroup } from "./transport-folders.js"

/**
 * Every probe-gated tool group (see `_groups.ts`). Each is listed only when
 * its probe passes for the session's credential; the platform authorizes
 * every call regardless.
 *
 * @internal
 */
export const TOOL_GROUPS: readonly ToolGroup[] = [
  dataManagementGroup,
  eventsGroup,
  aggregateGroup,
  adminGroup,
  contractDeskGroup,
  transportFoldersGroup,
  complianceGroup,
  moneyFoundGroup,
  customsDeclarationGroup,
]

/** Every group key. @internal */
export const TOOL_GROUP_KEYS: readonly string[] = TOOL_GROUPS.map((g) => g.key)

/**
 * The keys of the groups whose probe passes for this credential, asked once
 * (stdio boot). A probe that could not be answered counts as unavailable.
 * Never throws.
 *
 * @public
 */
export async function probeToolGroups(token: string, baseUrl?: string): Promise<string[]> {
  const answers = await Promise.all(
    TOOL_GROUPS.map((g) => probeGroup(g, token, baseUrl).catch(() => false as const)),
  )
  return TOOL_GROUPS.filter((_, i) => answers[i] === true).map((g) => g.key)
}

/** Register the named groups (unknown keys are ignored). @internal */
export function registerToolGroups(
  server: McpServer,
  keys: readonly string[],
  getToken: () => string,
  baseUrl: string | undefined,
): void {
  const wanted = new Set(keys)
  for (const group of TOOL_GROUPS) {
    if (wanted.has(group.key)) registerGroup(server, group, getToken, baseUrl)
  }
}
