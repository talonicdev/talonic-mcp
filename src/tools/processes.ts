import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, runTool } from "./_http.js"
import { zUuid, type ToolResult } from "./_shared.js"

/**
 * Process Plane tools: the workspace's processes (what happens to documents
 * and items, and who signs), their runs, what waits for the caller, and
 * signing. All tools hit `/v1/processes/*` with the caller's bearer; the
 * platform decides every rule: the person behind the key needs the Process
 * Plane permission of each route (view, run, sign), and may sign only steps
 * they are assigned to.
 *
 * Loop: talonic_process_list → talonic_process_run (one item by field names)
 * → talonic_process_status / talonic_process_runs; talonic_process_waiting_for_me
 * → talonic_process_sign.
 */

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}
const write = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
}

/** True when the caller may see the workspace's processes (tools are listed only then). */
export async function probeProcessesAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, "/v1/processes"), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

const LIST_DESCRIPTION =
  "List the workspace's processes: name, live version (null = draft only), folder, tags and number of steps. Start here; use the id with the other talonic_process_* tools."
const RUN_DESCRIPTION =
  'Start a published process for one item with values by field name, e.g. {"Vendor": "Acme", "Amount": 1200}. Only for processes whose items are posted (started by hand, by another system or by a form). Returns the run id, and the process\'s reply when it has a reply step. Starting a process can send mail, call other systems and ask people to sign: call only when the user asks for it.'
const STATUS_DESCRIPTION =
  "Where a process run stands: per step, how many items are waiting, done or failed, and each item's state. Without run_id, the latest run."
const RUNS_DESCRIPTION =
  "Runs across all processes, newest first: state (running, completed, failed, stuck = open with a failed item), items done, waiting and failed. Filter by process or by runs waiting for the caller."
const WAITING_DESCRIPTION =
  "Sign-offs and forms waiting for the caller (the person behind the key): per process and step, how many items wait. Use talonic_process_status to see the items, then talonic_process_sign."
const SIGN_DESCRIPTION =
  "Sign a sign-off step of a run for the caller: approve all waiting items, or only `items`. A step that offers choices needs `decision` (one of its choices). Allowed only where the caller is assigned to the step. Signing moves real work on: call only when the user decides."

/**
 * Register the six `talonic_process_*` tools.
 *
 * @public
 */
export function registerProcessesTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const tools: Array<
    [
      string,
      string,
      string,
      Record<string, z.ZodTypeAny>,
      typeof readOnly | typeof write,
      (a: any) => Promise<ToolResult>,
    ]
  > = [
    [
      "talonic_process_list",
      "Processes",
      LIST_DESCRIPTION,
      {},
      readOnly,
      () => runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/processes")),
    ],
    [
      "talonic_process_run",
      "Start a process for one item",
      RUN_DESCRIPTION,
      {
        process_id: zUuid().describe("The process id from talonic_process_list"),
        values: z.record(z.string(), z.unknown()).describe("Values by field name"),
      },
      write,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `/v1/processes/${encodeURIComponent(a.process_id)}/items`,
            { body: { values: a.values ?? {} } },
          ),
        ),
    ],
    [
      "talonic_process_status",
      "Process run status",
      STATUS_DESCRIPTION,
      {
        process_id: zUuid().describe("The process id"),
        run_id: zUuid().optional().describe("A run id; default the latest run"),
      },
      readOnly,
      async (a) =>
        runTool(async () => {
          const q = a.run_id ? `?run=${encodeURIComponent(a.run_id)}` : ""
          const id = encodeURIComponent(a.process_id)
          const [status, items] = await Promise.all([
            apiJson(getToken, baseUrl, "GET", `/v1/processes/${id}/status${q}`),
            apiJson(getToken, baseUrl, "GET", `/v1/processes/${id}/items${q}`),
          ])
          return { status, items }
        }),
    ],
    [
      "talonic_process_runs",
      "Process runs",
      RUNS_DESCRIPTION,
      {
        state: z.enum(["running", "completed", "failed", "stuck"]).optional(),
        process_id: zUuid().optional(),
        waiting_for_me: z.boolean().optional(),
        page: z.number().int().min(0).optional(),
      },
      readOnly,
      (a) => {
        const q = new URLSearchParams()
        if (a.state) q.set("state", a.state)
        if (a.process_id) q.set("process", a.process_id)
        if (a.waiting_for_me) q.set("waitingForMe", "1")
        if (a.page) q.set("page", String(a.page))
        const qs = q.toString()
        return runTool(() =>
          apiJson(getToken, baseUrl, "GET", `/v1/processes/runs${qs ? `?${qs}` : ""}`),
        )
      },
    ],
    [
      "talonic_process_waiting_for_me",
      "Waiting for me",
      WAITING_DESCRIPTION,
      {},
      readOnly,
      () => runTool(() => apiJson(getToken, baseUrl, "GET", "/v1/processes/waiting")),
    ],
    [
      "talonic_process_sign",
      "Sign a process step",
      SIGN_DESCRIPTION,
      {
        process_id: zUuid(),
        run_id: zUuid(),
        step_id: z
          .string()
          .min(1)
          .max(64)
          .describe("The sign-off step's id (stepId from talonic_process_waiting_for_me)"),
        items: z
          .array(z.string().min(1).max(200))
          .max(200)
          .optional()
          .describe("Item keys; default every waiting item"),
        decision: z
          .string()
          .min(1)
          .max(60)
          .optional()
          .describe("One of the step's choices, when it offers any"),
      },
      write,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `/v1/processes/${encodeURIComponent(a.process_id)}/runs/${encodeURIComponent(a.run_id)}/holds/${encodeURIComponent(a.step_id)}/release`,
            {
              body: {
                ...(a.items ? { items: a.items } : {}),
                ...(a.decision ? { decision: a.decision } : {}),
              },
            },
          ),
        ),
    ],
  ]
  for (const [name, title, description, inputSchema, annotations, handler] of tools) {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations } },
      async (args: unknown) => handler(args) as Promise<any>,
    )
  }
}
