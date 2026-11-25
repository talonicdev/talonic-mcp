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
 * talonic_process_publish. Alongside: talonic_process_try / _evaluate against
 * kept _examples, script steps via _script_draft → _script_test →
 * _script_approve, _details, _export, _resources, _extract_pipeline,
 * _form_preview, _group, _build_lookup_data; operate: _sign_off, _retry_item. Building touches a draft only; publish, rollback,
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

const DETAILS_DESCRIPTION =
  "Rename a process, put it in a folder (`folder: null` takes it out) or replace its tags. The draft and the live version are untouched."

const EXPORT_DESCRIPTION =
  "The process draft as a file another workspace can import (pass its `doc` as `draft` with a name when creating a process there). Chosen sources, destinations and similar workspace settings are left out; secrets travel by name only."

const RESOURCES_DESCRIPTION =
  "What a published version made or uses in the workspace: schemas, deliveries, policies and the like, with the steps they belong to. The live version unless `version` is given; empty before the first publish."

const EXTRACT_PIPELINE_DESCRIPTION =
  "Move the draft's document steps (reading, checking, reviewing documents) and its fields into a new reusable pipeline that other processes can use too; one pipeline step takes their place in the draft. Changes the draft only."

const TRY_DESCRIPTION =
  "Walk the draft with made-up values (by field id, from talonic_process_get) and sign-off choices (by step id): the steps an item would take and where it stops. Runs nothing and sends nothing."

const FORM_PREVIEW_DESCRIPTION =
  "How a form step of the draft looks to the person filling it in: title, intro, button and fields with their kinds and choices."

const EXAMPLES_DESCRIPTION =
  "Examples are items kept from runs that a draft is checked against with talonic_process_evaluate. Without `keep` or `remove` this lists them. `keep: { run_id, item_key, note? }` keeps an item of a run (the way it went and what it ended with; replaces an earlier example of the same item). `remove: example_id` removes one."

const EVALUATE_DESCRIPTION =
  "Check the draft against every kept example: how many still go the same way, and for each that would now go another way, where the ways part. Runs nothing and sends nothing. Use after changing a draft, before talonic_process_publish."

const SCRIPTS_DESCRIPTION =
  "Per script step of the draft, the latest test (by the script's `hash`, passed or not, with results) and approval. A script step goes live only when its current script passed a test and a person approved it."

const SCRIPT_DRAFT_DESCRIPTION =
  "Write a script for a script step from what it should do, in plain words. Saves nothing: returns the script, its `hash` and an explanation; put it on the step with talonic_process_change or the draft, then talonic_process_script_test. The step must already name the fields it writes. Uses credits."

const SCRIPT_TEST_DESCRIPTION =
  "Test a script step's current script on up to 10 recent records of this process, writing nothing: before and after per field, and `ok`. Needs one earlier run of the process (a test run is enough)."

const SCRIPT_APPROVE_DESCRIPTION =
  "Approve the exact script that passed its test, by its `hash` from talonic_process_scripts. An approval is a person's decision that lets the script go live: call only when the user has read the script and says to approve it."

const SIGN_OFF_DESCRIPTION =
  "One sign-off step as the caller sees it: the brief (who signs, instructions, fields, choices), whether the caller may sign, and only then the items waiting with the values to check and the latest decisions. Pass an item's `documentId` in `items` to talonic_process_sign or talonic_process_send_back."

const RETRY_ITEM_DESCRIPTION =
  "Try one failed step again for one item of a run: an email or a call is sent again, an item a signer sent back goes back to its signers. `canRetry` on talonic_process_item says where this applies. Use when the cause is fixed."

const GROUP_DESCRIPTION =
  "Create, change or delete a group of people a sign-off or form step can wait for (the same groups as Team & Roles; list them with talonic_process_setup). Without `group_id` it creates one (`name`, optional `description`, `member_ids`). With `group_id`: `name`/`description` change it, `member_ids` replaces its members, `delete: true` deletes it (steps that named it no longer wait for its members). Members must be active members of the workspace. Who signs is a governance decision: call only when the user asks."

const BUILD_LOOKUP_DATA_DESCRIPTION =
  "Build the shared data look-up steps read, from the reference data and snapshots the workspace holds. Safe to start again; check progress with talonic_process_setup (`lookupData.state` becomes `ready`). Uses credits."

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
    [
      "talonic_process_details",
      "Rename, file or tag a process",
      DETAILS_DESCRIPTION,
      {
        process_id: zUuid(),
        name: z.string().min(1).max(200).optional(),
        folder: z
          .string()
          .max(120)
          .nullable()
          .optional()
          .describe("null takes it out of its folder"),
        tags: z.array(z.string().min(1).max(40)).max(20).optional().describe("Replaces the tags"),
      },
      write,
      (a) =>
        runTool(() => {
          const body = {
            ...(a.name !== undefined ? { name: a.name } : {}),
            ...(a.folder !== undefined ? { folder: a.folder } : {}),
            ...(a.tags !== undefined ? { tags: a.tags } : {}),
          }
          if (!Object.keys(body).length) throw new Error("Pass name, folder or tags.")
          return apiJson(getToken, baseUrl, "PATCH", `${BASE}/${pid(a)}`, { body })
        }),
    ],
    [
      "talonic_process_export",
      "Export a process",
      EXPORT_DESCRIPTION,
      { process_id: zUuid() },
      readOnly,
      (a) => runTool(() => apiJson(getToken, baseUrl, "GET", `${BASE}/${pid(a)}/export`)),
    ],
    [
      "talonic_process_resources",
      "What a process version made",
      RESOURCES_DESCRIPTION,
      {
        process_id: zUuid(),
        version: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("A published version; default the live one"),
      },
      readOnly,
      (a) =>
        runTool(() =>
          apiJson(getToken, baseUrl, "GET", `${BASE}/${pid(a)}/resources`, {
            params: a.version ? { version: String(a.version) } : undefined,
          }),
        ),
    ],
    [
      "talonic_process_extract_pipeline",
      "Move document steps into a pipeline",
      EXTRACT_PIPELINE_DESCRIPTION,
      {
        process_id: zUuid(),
        name: z.string().min(1).max(200).optional().describe("Name of the new pipeline"),
      },
      write,
      (a) =>
        runTool(() =>
          apiJson(getToken, baseUrl, "POST", `${BASE}/${pid(a)}/extract-pipeline`, {
            body: a.name ? { name: a.name } : {},
          }),
        ),
    ],
    [
      "talonic_process_try",
      "Walk a draft with made-up values",
      TRY_DESCRIPTION,
      {
        process_id: zUuid(),
        values: z.record(z.string(), z.unknown()).optional().describe("Values by field id"),
        choices: z
          .record(z.string(), z.string())
          .optional()
          .describe("Sign-off choices by step id"),
      },
      readOnly,
      (a) =>
        runTool(() =>
          apiJson(getToken, baseUrl, "POST", `${BASE}/${pid(a)}/try`, {
            body: { values: a.values ?? {}, choices: a.choices ?? {} },
          }),
        ),
    ],
    [
      "talonic_process_form_preview",
      "Preview a form step",
      FORM_PREVIEW_DESCRIPTION,
      { process_id: zUuid(), step_id: z.string().min(1).max(80) },
      readOnly,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "GET",
            `${BASE}/${pid(a)}/form-preview/${encodeURIComponent(a.step_id)}`,
          ),
        ),
    ],
    [
      "talonic_process_examples",
      "Examples a draft is checked against",
      EXAMPLES_DESCRIPTION,
      {
        process_id: zUuid(),
        keep: z
          .object({
            run_id: zUuid(),
            item_key: z.string().min(1).max(200),
            note: z.string().max(500).optional(),
          })
          .optional()
          .describe("Keep this item of a run as an example"),
        remove: zUuid().optional().describe("The id of an example to remove"),
      },
      write,
      (a) =>
        runTool(() => {
          if (a.keep && a.remove) throw new Error("Pass keep or remove, not both.")
          if (a.keep)
            return apiJson(getToken, baseUrl, "POST", `${BASE}/${pid(a)}/examples`, {
              body: {
                runId: a.keep.run_id,
                itemKey: a.keep.item_key,
                ...(a.keep.note ? { note: a.keep.note } : {}),
              },
            })
          if (a.remove)
            return apiJson(
              getToken,
              baseUrl,
              "DELETE",
              `${BASE}/${pid(a)}/examples/${encodeURIComponent(a.remove)}`,
            )
          return apiJson(getToken, baseUrl, "GET", `${BASE}/${pid(a)}/examples`)
        }),
    ],
    [
      "talonic_process_evaluate",
      "Check a draft against its examples",
      EVALUATE_DESCRIPTION,
      { process_id: zUuid() },
      readOnly,
      (a) => runTool(() => apiJson(getToken, baseUrl, "POST", `${BASE}/${pid(a)}/evaluate`)),
    ],
    [
      "talonic_process_scripts",
      "Script tests and approvals",
      SCRIPTS_DESCRIPTION,
      { process_id: zUuid() },
      readOnly,
      (a) => runTool(() => apiJson(getToken, baseUrl, "GET", `${BASE}/${pid(a)}/scripts`)),
    ],
    [
      "talonic_process_script_draft",
      "Write a script for a step",
      SCRIPT_DRAFT_DESCRIPTION,
      {
        process_id: zUuid(),
        step_id: z.string().min(1).max(80),
        purpose: z.string().min(1).max(2000).describe("What the script should do, in plain words"),
      },
      write,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `${BASE}/${pid(a)}/steps/${encodeURIComponent(a.step_id)}/script/draft`,
            {
              body: { purpose: a.purpose },
            },
          ),
        ),
    ],
    [
      "talonic_process_script_test",
      "Test a step's script",
      SCRIPT_TEST_DESCRIPTION,
      { process_id: zUuid(), step_id: z.string().min(1).max(80) },
      write,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `${BASE}/${pid(a)}/steps/${encodeURIComponent(a.step_id)}/script/test`,
          ),
        ),
    ],
    [
      "talonic_process_script_approve",
      "Approve a step's script",
      SCRIPT_APPROVE_DESCRIPTION,
      {
        process_id: zUuid(),
        step_id: z.string().min(1).max(80),
        hash: z.string().min(8).max(128).describe("The tested script's hash"),
      },
      destructive,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `${BASE}/${pid(a)}/steps/${encodeURIComponent(a.step_id)}/script/approve`,
            {
              body: { hash: a.hash },
            },
          ),
        ),
    ],
    [
      "talonic_process_sign_off",
      "One sign-off step",
      SIGN_OFF_DESCRIPTION,
      {
        process_id: zUuid(),
        step_id: z.string().min(1).max(64).describe("stepId from talonic_process_waiting_for_me"),
      },
      readOnly,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "GET",
            `${BASE}/${pid(a)}/sign-offs/${encodeURIComponent(a.step_id)}`,
          ),
        ),
    ],
    [
      "talonic_process_retry_item",
      "Retry one step for one item",
      RETRY_ITEM_DESCRIPTION,
      {
        process_id: zUuid(),
        run_id: zUuid(),
        step_id: z.string().min(1).max(80),
        item_key: z.string().min(1).max(200).describe("The item's key from the run"),
      },
      write,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `${BASE}/${pid(a)}/runs/${encodeURIComponent(a.run_id)}/steps/${encodeURIComponent(a.step_id)}/items/${encodeURIComponent(a.item_key)}/retry`,
          ),
        ),
    ],
    [
      "talonic_process_group",
      "Groups steps wait for",
      GROUP_DESCRIPTION,
      {
        group_id: zUuid().optional().describe("Leave out to create a group"),
        name: z.string().min(1).max(80).optional(),
        description: z.string().max(300).optional(),
        member_ids: z
          .array(zUuid())
          .max(500)
          .optional()
          .describe("Person ids; replaces the members"),
        delete: z.boolean().optional().describe("true deletes the group"),
      },
      destructive,
      (a) =>
        runTool(async () => {
          if (!a.group_id) {
            if (!a.name) throw new Error("A new group needs a name.")
            return apiJson(getToken, baseUrl, "POST", `${BASE}/groups`, {
              body: {
                name: a.name,
                ...(a.description !== undefined ? { description: a.description } : {}),
                ...(a.member_ids ? { member_ids: a.member_ids } : {}),
              },
            })
          }
          const g = `${BASE}/groups/${encodeURIComponent(a.group_id)}`
          if (a.delete === true) return apiJson(getToken, baseUrl, "DELETE", g)
          const edit = {
            ...(a.name !== undefined ? { name: a.name } : {}),
            ...(a.description !== undefined ? { description: a.description } : {}),
          }
          if (!Object.keys(edit).length && !a.member_ids)
            throw new Error("Pass name, description, member_ids or delete.")
          let out: unknown
          if (Object.keys(edit).length)
            out = await apiJson(getToken, baseUrl, "PATCH", g, { body: edit })
          if (a.member_ids)
            out = await apiJson(getToken, baseUrl, "PUT", `${g}/members`, {
              body: { member_ids: a.member_ids },
            })
          return out
        }),
    ],
    [
      "talonic_process_build_lookup_data",
      "Build the data look-ups read",
      BUILD_LOOKUP_DATA_DESCRIPTION,
      {},
      write,
      () => runTool(() => apiJson(getToken, baseUrl, "POST", `${BASE}/lookup-data/build`)),
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
