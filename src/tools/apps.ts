import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, probeAccessState, runTool, type ProbeAnswer } from "./_http.js"
import type { ToolResult } from "./_shared.js"
import { widgetToolMeta } from "../widgets/types.js"

/**
 * `talonic_list_apps`: the workspace's Talonic Apps. It is the only way a
 * model learns an app's id, which the decision-task tools require; before
 * it existed those tools were listed to every user but unusable.
 */

/** One app as returned by `GET /v1/apps` (only the fields this tool keeps). */
interface AppManifest {
  id?: string
  slug?: string
  display_name?: string
  description?: string
  mode?: string
  enabled?: boolean
  standard?: boolean
}

const LIST_APPS_DESCRIPTION = [
  "List the Talonic Apps in the user's workspace: id, slug, name, one-line description, mode and whether each is enabled.",
  "",
  "USE WHEN: the user asks which apps or automations the workspace has, or another tool needs an app_id (talonic_list_decision_tasks needs the id of an app whose mode is 'external').",
  "NOT FOR: documents (talonic_search) or pipelines/Specs (talonic_list_specs).",
  "ARGS: enabled_only (default true).",
  "RETURNS: { apps: [{ id, slug, display_name, description, mode, enabled, standard }] }. mode 'external' means the app hands its decisions to an outside agent through the decision-task tools; other modes decide inside Talonic.",
].join("\n")

/** @internal Exported for tests. */
export async function handleListApps(
  getToken: () => string,
  baseUrl: string | undefined,
  args: { enabled_only?: boolean },
): Promise<ToolResult> {
  return runTool(async () => {
    const res = await apiJson<{ apps?: AppManifest[] }>(getToken, baseUrl, "GET", "/v1/apps", {
      params: { enabled: args.enabled_only === false ? undefined : "true" },
    })
    const apps = (res?.apps ?? []).map((a) => ({
      id: a.id ?? null,
      slug: a.slug ?? null,
      display_name: a.display_name ?? null,
      description: a.description ?? null,
      mode: a.mode ?? null,
      enabled: a.enabled ?? null,
      standard: a.standard ?? null,
    }))
    return { apps, count: apps.length }
  })
}

/**
 * Register `talonic_list_apps`.
 *
 * @public
 */
export function registerAppsTools(server: McpServer, getToken: () => string, baseUrl?: string) {
  server.registerTool(
    "talonic_list_apps",
    {
      title: "List Apps",
      description: LIST_APPS_DESCRIPTION,
      inputSchema: {
        enabled_only: z
          .boolean()
          .optional()
          .describe("Only enabled apps (default true). Pass false to include disabled ones."),
      },
      annotations: {
        title: "List Apps",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: widgetToolMeta("listApps"),
    },
    async (args: { enabled_only?: boolean }) => handleListApps(getToken, baseUrl, args),
  )
}

/**
 * True when the workspace has at least one External-mode app, i.e. when the
 * decision-task tools have anything to work on.
 *
 * @internal
 */
export function probeExternalAppsInUse(token: string, baseUrl?: string): Promise<ProbeAnswer> {
  return probeAccessState(token, baseUrl, "/v1/apps", (body) => {
    const apps = (body as { apps?: AppManifest[] } | null)?.apps
    return Array.isArray(apps) && apps.some((a) => a?.mode === "external")
  })
}

/**
 * True when the workspace's pipelines have produced at least one Agent-stage
 * task, i.e. when the Agent-task worker tools have anything to work on.
 *
 * @internal
 */
export function probeAgentTasksInUse(token: string, baseUrl?: string): Promise<ProbeAnswer> {
  return probeAccessState(
    token,
    baseUrl,
    "/v1/agent-tasks",
    (body) => {
      const data = (body as { data?: unknown[] } | null)?.data
      return Array.isArray(data) && data.length > 0
    },
    { limit: 1 },
  )
}
