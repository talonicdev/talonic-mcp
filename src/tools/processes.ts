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
 * Operate: talonic_process_list → talonic_process_run (one item by field names)
 * → talonic_process_status / talonic_process_runs / talonic_process_item;
 * talonic_process_waiting_for_me → talonic_process_sign or talonic_process_send_back.
 *
 * Build: talonic_process_create (a draft from words or an n8n workflow) →
 * talonic_process_change → talonic_process_check → talonic_process_test_run →
 * talonic_process_publish. Building touches a draft only; publish, rollback,
 * delete and replacing an address change what runs for real and are marked
 * destructive. No tool carries a secret's value.
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

/** Changes what runs for real, or cannot be undone: clients ask the person before calling. */
const destructive = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
}

const BASE = "/v1/processes"
const pid = (a: { process_id: string }) => encodeURIComponent(a.process_id)

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

const GET_DESCRIPTION =
  "One process with its draft: fields, steps (id, kind, name, settings) and the arrows between them. Use it to see step ids before talonic_process_change with step_id, or to read what a process does."

const CREATE_DESCRIPTION =
  "Set up a new process as a DRAFT. Pass `description` in the user's own words (what comes in, what is read or checked, who decides, what goes out), or `workflow_json` with an exported n8n workflow to take it over. Nothing runs and nothing is sent until talonic_process_publish. The answer names what a person still has to choose (`stillOpen`, `questions`): tell the user those. Uses a model call for `description`."

const CHANGE_DESCRIPTION =
  "Change a process draft from an instruction in plain words: add, remove or reorder steps, change who decides, what is sent, any setting. With `step_id` only that step's settings change. Touches the draft only; the live version stays until talonic_process_publish. If the answer is `needs_confirmation`, NOTHING was saved: the change means fewer people or checks look at items. Tell the user exactly those points and ask; call again with `confirmed: true` only after they said yes, never on a first call."

const CHECK_DESCRIPTION =
  "What a draft still needs before it can go live (`stillNeeded`, per step), every problem the check finds, and what publishing would change against the live version. Call before talonic_process_publish and tell the user what is open."

const TEST_RUN_DESCRIPTION =
  "Run the DRAFT on real documents in a test copy: nothing is delivered, emailed or called. Steps not set up yet end the test (`endsAt`). Returns `processId` of the test copy and `runId`; follow with talonic_process_status on that processId."

const PUBLISH_DESCRIPTION =
  "Make the draft the LIVE version. From then on the process runs for real: it starts on what its start says (arriving documents, mail, another system), sends its mail and calls its systems. Refused while talonic_process_check finds an error. Call only when the user said to publish; show them talonic_process_check first."

const VERSIONS_DESCRIPTION =
  "The published versions of a process, newest first, with who published and why."

const ROLLBACK_DESCRIPTION =
  "Make an earlier published version live again. Changes what runs for real: call only when the user asks for it."

const DELETE_DESCRIPTION =
  "Delete a process. Not possible while a run is open. Cannot be undone: call only when the user asked to delete this process by name."

const ITEM_DESCRIPTION =
  "One item's way through a run, step by step (status, time, note such as why it stopped or where a mail went), and its values now. Item keys come from talonic_process_status."

const RETRY_DESCRIPTION =
  "Try every failed step of a run again. Steps that send or call will send or call again: use when the cause of the failure is fixed."

const SEND_BACK_DESCRIPTION =
  "Send items back from a sign-off step with a reason, for the caller: the opposite of talonic_process_sign. Allowed only where the caller is assigned. Moves real work: call only when the user decides."

const SETUP_DESCRIPTION =
  "What processes of this workspace can use: who a step can wait for (roles, groups), the connected mailboxes and whether each may send, the names of stored secrets (never values), and the shared data a look-up step can read. Connecting a mailbox and storing a secret happen in the Talonic web app, not here."

const MAILBOX_OWNERSHIP_DESCRIPTION =
  "Say whether a connected mailbox is one person's own (`individual`: only that person may put it on a process) or the company's (`company`: everyone who builds processes may). A governance decision: call only when the user asks."

const ADDRESS_DESCRIPTION =
  "The address other systems send items to (a webhook). Without `make` it only says whether one exists; the address itself is shown once, when made. With `make: true` it makes one and returns `path` to post to. An existing address is replaced only with `replace: true`: the old one stops working AT ONCE and whatever sends to it stops getting through, so ask the user first. `test: true` is the address of the test copy."

/**
 * Register the `talonic_process_*` tools.
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
      typeof readOnly | typeof write | typeof destructive,
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
    [
      "talonic_process_get",
      "One process",
      GET_DESCRIPTION,
      { process_id: zUuid().describe("The process id from talonic_process_list") },
      readOnly,
      (a) => runTool(() => apiJson(getToken, baseUrl, "GET", `${BASE}/${pid(a)}`)),
    ],
    [
      "talonic_process_create",
      "New process draft",
      CREATE_DESCRIPTION,
      {
        description: z
          .string()
          .min(10)
          .max(2000)
          .optional()
          .describe("What the process should do, complete and in the user's words"),
        workflow_json: z
          .string()
          .min(2)
          .max(400_000)
          .optional()
          .describe("An exported n8n workflow as JSON text, instead of description"),
      },
      write,
      (a) =>
        runTool(() => {
          if (a.workflow_json) {
            let workflow: unknown
            try {
              workflow = JSON.parse(a.workflow_json)
            } catch {
              throw new Error("workflow_json is not valid JSON.")
            }
            return apiJson(getToken, baseUrl, "POST", BASE, { body: { workflow } })
          }
          if (!a.description) throw new Error("Pass description or workflow_json.")
          return apiJson(getToken, baseUrl, "POST", BASE, { body: { description: a.description } })
        }),
    ],
    [
      "talonic_process_change",
      "Change a process draft",
      CHANGE_DESCRIPTION,
      {
        process_id: zUuid(),
        change: z.string().min(1).max(2000).describe("What should change, in plain words"),
        step_id: z
          .string()
          .min(1)
          .max(80)
          .optional()
          .describe("Only this step's settings (id from talonic_process_get)"),
        confirmed: z
          .boolean()
          .optional()
          .describe(
            "Leave out. true only after needs_confirmation was shown to the user and they agreed",
          ),
      },
      write,
      (a) =>
        runTool(() =>
          apiJson(getToken, baseUrl, "POST", `${BASE}/${pid(a)}/change`, {
            body: {
              change: a.change,
              ...(a.step_id ? { stepId: a.step_id } : {}),
              ...(a.confirmed === true ? { confirmed: true } : {}),
            },
          }),
        ),
    ],
    [
      "talonic_process_check",
      "Check a process draft",
      CHECK_DESCRIPTION,
      { process_id: zUuid() },
      readOnly,
      async (a) =>
        runTool(async () => {
          const [check, changes] = await Promise.all([
            apiJson(getToken, baseUrl, "GET", `${BASE}/${pid(a)}/check`),
            apiJson(getToken, baseUrl, "GET", `${BASE}/${pid(a)}/changes`),
          ])
          return { check, changes }
        }),
    ],
    [
      "talonic_process_test_run",
      "Test a process draft",
      TEST_RUN_DESCRIPTION,
      {
        process_id: zUuid(),
        document_ids: z.array(zUuid()).min(1).max(100).describe("Documents to run the draft on"),
      },
      write,
      (a) =>
        runTool(() =>
          apiJson(getToken, baseUrl, "POST", `${BASE}/${pid(a)}/test-run`, {
            body: { documentIds: a.document_ids },
          }),
        ),
    ],
    [
      "talonic_process_publish",
      "Publish a process",
      PUBLISH_DESCRIPTION,
      {
        process_id: zUuid(),
        reason: z.string().max(2000).optional().describe("Why this change, for the record"),
      },
      destructive,
      (a) =>
        runTool(() =>
          apiJson(getToken, baseUrl, "POST", `${BASE}/${pid(a)}/publish`, {
            body: a.reason ? { reason: a.reason } : {},
          }),
        ),
    ],
    [
      "talonic_process_versions",
      "Process versions",
      VERSIONS_DESCRIPTION,
      { process_id: zUuid() },
      readOnly,
      (a) => runTool(() => apiJson(getToken, baseUrl, "GET", `${BASE}/${pid(a)}/versions`)),
    ],
    [
      "talonic_process_rollback",
      "Roll a process back",
      ROLLBACK_DESCRIPTION,
      {
        process_id: zUuid(),
        version: z.number().int().min(1).describe("The version number to make live again"),
      },
      destructive,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `${BASE}/${pid(a)}/versions/${encodeURIComponent(String(a.version))}/rollback`,
          ),
        ),
    ],
    [
      "talonic_process_delete",
      "Delete a process",
      DELETE_DESCRIPTION,
      { process_id: zUuid() },
      destructive,
      (a) => runTool(() => apiJson(getToken, baseUrl, "DELETE", `${BASE}/${pid(a)}`)),
    ],
    [
      "talonic_process_item",
      "One item of a run",
      ITEM_DESCRIPTION,
      {
        process_id: zUuid(),
        run_id: zUuid(),
        item_key: z.string().min(1).max(200).describe("The item's key (documentId) from the run"),
      },
      readOnly,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "GET",
            `${BASE}/${pid(a)}/runs/${encodeURIComponent(a.run_id)}/items/${encodeURIComponent(a.item_key)}`,
          ),
        ),
    ],
    [
      "talonic_process_retry",
      "Retry a run's failed steps",
      RETRY_DESCRIPTION,
      { run_id: zUuid() },
      write,
      (a) =>
        runTool(() =>
          apiJson(getToken, baseUrl, "POST", `${BASE}/runs/${encodeURIComponent(a.run_id)}/retry`),
        ),
    ],
    [
      "talonic_process_send_back",
      "Send items back from a sign-off",
      SEND_BACK_DESCRIPTION,
      {
        process_id: zUuid(),
        run_id: zUuid(),
        step_id: z.string().min(1).max(64),
        items: z.array(z.string().min(1).max(200)).min(1).max(200).describe("Item keys"),
        reason: z.string().min(1).max(2000).describe("Why they go back, in the user's words"),
      },
      write,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `${BASE}/${pid(a)}/runs/${encodeURIComponent(a.run_id)}/holds/${encodeURIComponent(a.step_id)}/send-back`,
            { body: { items: a.items, reason: a.reason } },
          ),
        ),
    ],
    [
      "talonic_process_setup",
      "What processes can use",
      SETUP_DESCRIPTION,
      {},
      readOnly,
      async () =>
        runTool(async () => {
          const [people, mailboxes, secrets, lookupData] = await Promise.all([
            apiJson(getToken, baseUrl, "GET", `${BASE}/people`),
            apiJson(getToken, baseUrl, "GET", `${BASE}/mailboxes`),
            apiJson(getToken, baseUrl, "GET", `${BASE}/secrets`),
            apiJson(getToken, baseUrl, "GET", `${BASE}/lookup-data`),
          ])
          return { people, mailboxes, secrets, lookupData }
        }),
    ],
    [
      "talonic_process_mailbox_ownership",
      "Say whose a mailbox is",
      MAILBOX_OWNERSHIP_DESCRIPTION,
      {
        mailbox_id: zUuid().describe("The mailbox id from talonic_process_setup"),
        ownership: z.enum(["individual", "company"]),
      },
      write,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "PUT",
            `${BASE}/mailboxes/${encodeURIComponent(a.mailbox_id)}/ownership`,
            { body: { ownership: a.ownership } },
          ),
        ),
    ],
    [
      "talonic_process_address",
      "A process's address for other systems",
      ADDRESS_DESCRIPTION,
      {
        process_id: zUuid(),
        make: z
          .boolean()
          .optional()
          .describe("true: make the address. Default: only say whether one exists"),
        test: z.boolean().optional().describe("The address of the test copy"),
        replace: z
          .boolean()
          .optional()
          .describe("true only after the user agreed to switch the existing address off"),
      },
      destructive,
      (a) =>
        runTool(() =>
          a.make === true
            ? apiJson(getToken, baseUrl, "PUT", `${BASE}/${pid(a)}/address`, {
                body: {
                  ...(a.test === true ? { test: true } : {}),
                  ...(a.replace === true ? { replace: true } : {}),
                },
              })
            : apiJson(getToken, baseUrl, "GET", `${BASE}/${pid(a)}/address`),
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
