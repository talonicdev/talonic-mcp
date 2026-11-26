import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { probeAccessState, type ProbeAnswer, type QueryParams } from "./_http.js"
import { registerRouteTools, type RouteTool } from "./_route-tools.js"
import { PIPELINE_OPERATION_TOOLS } from "./pipeline-operations.js"
import { INGEST_OPERATION_TOOLS, INGEST_SETTINGS_TOOLS } from "./ingest-operations.js"
import { DOCUMENT_ORGANISING_TOOLS } from "./document-organising.js"
import { COLLECTION_TOOLS } from "./collections.js"
import { SAVED_FILTER_TOOLS } from "./saved-filters.js"
import { DOCUMENT_TYPE_TOOLS } from "./document-types.js"

/**
 * Workspace operation tool families: running a Spec run, ingest operations,
 * organising documents, collections, saved filters and document types. Each
 * family is listed only when its probe (a read of the family) answers 2xx for
 * the connection, so a credential without the scope, a workspace on a
 * platform that does not serve the routes yet, or a person without access
 * never sees tools that would only fail. The platform authorizes every call;
 * the probe is listing UX, never the security boundary.
 */

/** A workspace operation family key. */
export type OperationsFamily =
  | "pipelines"
  | "ingest"
  | "ingest_settings"
  | "document_organising"
  | "collections"
  | "saved_filters"
  | "document_types"

/** One family: its probe and its tools. */
export interface OperationsFamilyDefinition {
  key: OperationsFamily
  /** Read the probe asks; a 2xx lists the family. */
  probe: { path: string; params?: QueryParams }
  tools: readonly RouteTool[]
}

export const OPERATIONS_FAMILIES: readonly OperationsFamilyDefinition[] = [
  {
    key: "pipelines",
    probe: { path: "/v1/pipelines", params: { limit: 1 } },
    tools: PIPELINE_OPERATION_TOOLS,
  },
  { key: "ingest", probe: { path: "/v1/extract/queue-status" }, tools: INGEST_OPERATION_TOOLS },
  {
    key: "ingest_settings",
    probe: { path: "/v1/settings/ingest-stages" },
    tools: INGEST_SETTINGS_TOOLS,
  },
  {
    key: "document_organising",
    probe: { path: "/v1/documents/tags" },
    tools: DOCUMENT_ORGANISING_TOOLS,
  },
  { key: "collections", probe: { path: "/v1/collections" }, tools: COLLECTION_TOOLS },
  {
    key: "saved_filters",
    probe: { path: "/v1/search/saved-filters" },
    tools: SAVED_FILTER_TOOLS,
  },
  {
    key: "document_types",
    probe: { path: "/v1/document-types/pending-confirmations/count" },
    tools: DOCUMENT_TYPE_TOOLS,
  },
]

/** Every workspace operation tool, in family order. */
export const OPERATIONS_TOOLS: readonly RouteTool[] = OPERATIONS_FAMILIES.flatMap((f) => f.tools)

/** Ask one family's probe for this credential. @internal */
export function probeOperationsFamily(
  family: OperationsFamilyDefinition,
  token: string,
  baseUrl?: string,
): Promise<ProbeAnswer> {
  return probeAccessState(token, baseUrl, family.probe.path, () => true, family.probe.params ?? {})
}

/**
 * The families this credential can use (stdio: asked once at boot). A probe
 * the platform could not answer counts as not available.
 *
 * @public
 */
export async function probeOperationsFamilies(
  token: string,
  baseUrl?: string,
): Promise<OperationsFamily[]> {
  const answers = await Promise.all(
    OPERATIONS_FAMILIES.map((f) => probeOperationsFamily(f, token, baseUrl)),
  )
  return OPERATIONS_FAMILIES.filter((_, i) => answers[i] === true).map((f) => f.key)
}

/**
 * Register the tools of the given families.
 *
 * @public
 */
export function registerOperationsTools(
  server: McpServer,
  getToken: () => string,
  baseUrl: string | undefined,
  families: readonly OperationsFamily[],
): void {
  for (const f of OPERATIONS_FAMILIES) {
    if (families.includes(f.key)) registerRouteTools(server, f.tools, getToken, baseUrl)
  }
}
