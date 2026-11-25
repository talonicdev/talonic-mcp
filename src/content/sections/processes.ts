import type { RawSection } from "../types"

// The Process Plane tools (`talonic_process_*`, src/tools/processes.ts).
// Rendered at talonic.com/docs/mcp/<slug>; docs/sections.json keeps a mirror
// (`mcp-<slug>`) that tests/content/tool-sections.test.ts holds in step.
// The tools are listed only when the caller holds the Process Plane view
// permission; every page says so.

export const sections: RawSection[] = [
  {
    slug: "talonic-process-list",
    parentSlug: "tools",
    title: "talonic_process_list",
    seoTitle: "talonic_process_list — List a Workspace's Processes",
    description:
      "MCP tool that lists a Talonic workspace's processes with their live version, folder, tags and number of steps. Start here: the other process tools take its id.",
    content: [
      {
        type: "paragraph",
        text: "List the workspace's processes: name, live version (null when only a draft exists), folder, tags, number of steps and last edit. Start here; the `id` is what the other process tools take. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the run and sign permissions on every call.",
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_list({})\n{ "data": [{ "id": "11111111-1111-4111-8111-111111111111", "name": "Vendor bank details change", "liveVersion": 3, "folder": "Finance", "tags": ["ap"], "steps": 7 }] }',
      },
    ],
    related: [
      {
        label: "talonic_process_run",
        slug: "talonic-process-run",
      },
      {
        label: "talonic_process_runs",
        slug: "talonic-process-runs",
      },
    ],
    faq: [
      {
        question: "Does it show drafts?",
        answer:
          "Yes. A process with `liveVersion: null` has never been published and cannot be started.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-run",
    parentSlug: "tools",
    title: "talonic_process_run",
    seoTitle: "talonic_process_run — Start a Process for One Item",
    description:
      "MCP tool that starts a published Talonic process for one item, with values given by field name, and returns the process's reply or where the run stands now.",
    content: [
      {
        type: "paragraph",
        text: "Start a published process for one item. Values go by field name. Works for processes whose items are posted (started by hand, by another system or by a form). When the process has a reply step that answers in time, the reply comes back. Starting a process can send mail, call other systems and ask people to sign, so call it only when the user asks. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the run and sign permissions on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "From talonic_process_list.",
          },
          {
            name: "values",
            type: "object",
            required: true,
            description:
              "Values by field name; an unknown name is refused with the list of the process's fields.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_run({ "process_id": "11111111-1111-4111-8111-111111111111", "values": { "Vendor": "Acme", "Amount": 1200 } })\n{ "runId": "22222222-2222-4222-8222-222222222222", "process": "Vendor bank details change", "reply": { "status": 200, "body": "Received" } }',
      },
    ],
    related: [
      {
        label: "talonic_process_status",
        slug: "talonic-process-status",
      },
      {
        label: "talonic_process_list",
        slug: "talonic-process-list",
      },
    ],
    faq: [
      {
        question: "Is it a write?",
        answer:
          "Yes. It needs the Process Plane run permission and the write scope, and it is annotated as not read-only.",
      },
    ],
    mentions: ["start", "run", "process", "workflow"],
  },
  {
    slug: "talonic-process-status",
    parentSlug: "tools",
    title: "talonic_process_status",
    seoTitle: "talonic_process_status — Where a Process Run Stands",
    description:
      "MCP tool that shows where a Talonic process run stands: per step how many items are waiting, done or failed, and each item's state. Default: the latest run.",
    content: [
      {
        type: "paragraph",
        text: "Where a run stands: per step how many items wait, are done or failed, and each item's state. Without `run_id`, the latest run. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the run and sign permissions on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process.",
          },
          {
            name: "run_id",
            type: "UUID",
            required: false,
            description: "A run; default the latest.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_status({ "process_id": "11111111-1111-4111-8111-111111111111" })\n{ "status": { "...": "per step counts" }, "items": { "runId": "22222222-2222-4222-8222-222222222222", "items": [{ "name": "Acme", "state": "waiting" }] } }',
      },
    ],
    related: [
      {
        label: "talonic_process_runs",
        slug: "talonic-process-runs",
      },
      {
        label: "talonic_process_sign",
        slug: "talonic-process-sign",
      },
    ],
    faq: [],
    mentions: ["status", "run", "process"],
  },
  {
    slug: "talonic-process-runs",
    parentSlug: "tools",
    title: "talonic_process_runs",
    seoTitle: "talonic_process_runs — Process Runs Across Processes",
    description:
      "MCP tool that lists Talonic process runs across all processes, newest first, with items done, waiting and failed; filter by process or runs waiting for you.",
    content: [
      {
        type: "paragraph",
        text: "Runs across all processes, newest first, 50 a page: state (running, completed, failed, or stuck = open with a failed item) and item counts. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the run and sign permissions on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "state",
            type: "string",
            required: false,
            description: "running, completed, failed or stuck.",
          },
          {
            name: "process_id",
            type: "UUID",
            required: false,
            description: "Only this process.",
          },
          {
            name: "waiting_for_me",
            type: "boolean",
            required: false,
            description: "Only runs with a sign-off or form waiting for the caller.",
          },
          {
            name: "page",
            type: "integer",
            required: false,
            description: "0-based page.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_runs({ "state": "stuck" })\n{ "runs": [{ "runId": "22222222-2222-4222-8222-222222222222", "process": "Vendor bank details change", "status": "running", "items": 3, "failed": 1 }], "page": 0, "more": false }',
      },
    ],
    related: [
      {
        label: "talonic_process_status",
        slug: "talonic-process-status",
      },
    ],
    faq: [],
    mentions: ["runs", "executions", "stuck"],
  },
  {
    slug: "talonic-process-waiting-for-me",
    parentSlug: "tools",
    title: "talonic_process_waiting_for_me",
    seoTitle: "talonic_process_waiting_for_me — Sign-offs for You",
    description:
      "MCP tool that lists the Talonic sign-offs and forms waiting for the caller, per process and step, with how many items wait on each before the run moves on.",
    content: [
      {
        type: "paragraph",
        text: "Sign-offs and forms waiting for the person behind the key: per process and step, how many items wait. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the run and sign permissions on every call.",
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_waiting_for_me({})\n{ "data": [{ "processId": "11111111-1111-4111-8111-111111111111", "process": "Vendor bank details change", "stepId": "ok", "step": "Finance signs", "waiting": 2 }] }',
      },
    ],
    related: [
      {
        label: "talonic_process_sign",
        slug: "talonic-process-sign",
      },
      {
        label: "talonic_process_status",
        slug: "talonic-process-status",
      },
    ],
    faq: [],
    mentions: ["approval", "sign-off", "inbox"],
  },
  {
    slug: "talonic-process-sign",
    parentSlug: "tools",
    title: "talonic_process_sign",
    seoTitle: "talonic_process_sign — Sign a Step of a Process Run",
    description:
      "MCP tool that signs a sign-off step of a Talonic process run for the caller: approve every waiting item or only some, with a decision where the step offers one.",
    content: [
      {
        type: "paragraph",
        text: "Sign a sign-off step for the caller: all waiting items, or only `items`. A step with choices needs `decision`. Allowed only where the caller is assigned to the step, as on the screen. Signing moves real work on, so call it only when the user decides. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the run and sign permissions on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process.",
          },
          {
            name: "run_id",
            type: "UUID",
            required: true,
            description: "The run.",
          },
          {
            name: "step_id",
            type: "string",
            required: true,
            description: "The step id from talonic_process_waiting_for_me.",
          },
          {
            name: "items",
            type: "string[]",
            required: false,
            description: "Item keys; default every waiting item.",
          },
          {
            name: "decision",
            type: "string",
            required: false,
            description: "One of the step's choices.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_sign({ "process_id": "11111111-1111-4111-8111-111111111111", "run_id": "22222222-2222-4222-8222-222222222222", "step_id": "ok" })\n{ "released": 2, "alreadySigned": 0 }',
      },
    ],
    related: [
      {
        label: "talonic_process_waiting_for_me",
        slug: "talonic-process-waiting-for-me",
      },
    ],
    faq: [
      {
        question: "Can it sign for someone else?",
        answer:
          "No. It signs as the person behind the key, and only steps that person is assigned to.",
      },
    ],
    mentions: ["approve", "sign", "sign-off"],
  },
  {
    slug: "talonic-process-get",
    parentSlug: "tools",
    title: "talonic_process_get",
    seoTitle: "talonic_process_get — Read One Process and Its Draft",
    description:
      "MCP tool that reads one Talonic process with its draft: its fields, its steps with their ids and settings, and the arrows between them, before changing it.",
    content: [
      {
        type: "paragraph",
        text: "One process with its draft: fields, steps (id, kind, name, settings) and the arrows between them. Use it to see step ids before changing one step, or to read what a process does. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process, from talonic_process_list.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_get({ "process_id": "1111…" })\n{ "id": "1111…", "name": "Invoice approval", "activeVersion": 2, "draft": { "fields": [], "steps": [{ "id": "s_1", "kind": "approval", "name": "Manager approval" }], "flow": [] } }',
      },
    ],
    related: [
      {
        label: "talonic_process_change",
        slug: "talonic-process-change",
      },
      {
        label: "talonic_process_check",
        slug: "talonic-process-check",
      },
    ],
    faq: [
      {
        question: "Does it return the live version or the draft?",
        answer:
          "The draft. `activeVersion` says which published version is live; talonic_process_check shows how the draft differs from it.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-create",
    parentSlug: "tools",
    title: "talonic_process_create",
    seoTitle: "talonic_process_create — Set Up a New Process Draft",
    description:
      "MCP tool that sets up a new Talonic process as a draft, from a description in plain words or an exported n8n workflow. Nothing runs until it is published.",
    content: [
      {
        type: "paragraph",
        text: "Set up a new process as a draft. Pass `description` in the user's own words (what comes in, what is read or checked, who decides, what goes out), or `workflow_json` with an exported n8n workflow to take it over. Nothing runs and nothing is sent until the process is published. The answer names what a person still has to choose (`stillOpen`, `questions`). Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "description",
            type: "string",
            required: false,
            description: "What the process should do, 10 to 2,000 characters.",
          },
          {
            name: "workflow_json",
            type: "string",
            required: false,
            description: "An exported n8n workflow as JSON text, instead of description.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_create({ "description": "Invoices arrive by mail. Read vendor and amount. Over 10,000 a manager approves." })\n{ "id": "1111…", "name": "Invoice approval", "steps": 5, "explanation": "Reads each invoice and sends large ones to a manager.", "questions": ["Who is the manager?"], "stillOpen": ["Who signs here? Choose a person, a role or a group."], "notes": [] }',
      },
    ],
    related: [
      {
        label: "talonic_process_change",
        slug: "talonic-process-change",
      },
      {
        label: "talonic_process_check",
        slug: "talonic-process-check",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
    ],
    faq: [
      {
        question: "Does creating a process start anything?",
        answer:
          "No. It is a draft until talonic_process_publish; no document is read, no mail sent and no system called before that.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-change",
    parentSlug: "tools",
    title: "talonic_process_change",
    seoTitle: "talonic_process_change — Change a Talonic Process Draft",
    description:
      "MCP tool that changes a Talonic process draft from an instruction in plain words, and saves nothing until the user agreed when the change reduces governance.",
    content: [
      {
        type: "paragraph",
        text: "Change a process draft from an instruction in plain words: add, remove or reorder steps, change who decides, what is sent, any setting. With `step_id` only that step's settings change. The live version stays as it is until the process is published. When the change would have fewer people or checks look at items (a sign-off removed, a signer dropped, fewer items reaching a person, an agent step acting on its own), nothing is saved and the answer is `needs_confirmation` with the points; call again with `confirmed: true` only after the user has read them and agreed. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process, from talonic_process_list.",
          },
          {
            name: "change",
            type: "string",
            required: true,
            description: "What should change.",
          },
          {
            name: "step_id",
            type: "string",
            required: false,
            description: "Only this step's settings; ids come from talonic_process_get.",
          },
          {
            name: "confirmed",
            type: "boolean",
            required: false,
            description:
              "true only after needs_confirmation was shown to the user and they agreed.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_change({ "process_id": "1111…", "change": "Remove the manager approval." })\n{ "status": "needs_confirmation", "reductions": ["\\"Manager approval\\" is removed: nobody signs or reviews there any more."] }',
      },
    ],
    related: [
      {
        label: "talonic_process_get",
        slug: "talonic-process-get",
      },
      {
        label: "talonic_process_check",
        slug: "talonic-process-check",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
    ],
    faq: [
      {
        question: "What does needs_confirmation mean?",
        answer:
          "Nothing was saved. The change takes control away from people; show the user the listed points and send the same change with `confirmed: true` only if they agree.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-check",
    parentSlug: "tools",
    title: "talonic_process_check",
    seoTitle: "talonic_process_check — Check a Draft Before Going Live",
    description:
      "MCP tool that says what a Talonic process draft still needs per step before it can go live, every problem it finds, and what publishing it would change.",
    content: [
      {
        type: "paragraph",
        text: "What a draft still needs before it can go live (`stillNeeded`, per step), every problem the check finds, and what publishing would change against the live version. Call it before publishing and tell the user what is open. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process, from talonic_process_list.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_check({ "process_id": "1111…" })\n{ "check": { "canPublish": false, "stillNeeded": [{ "stepId": "s_1", "key": "assignees", "message": "Who signs here? Choose a person, a role or a group." }], "problems": [] }, "changes": { "changes": [{ "type": "step_added", "text": "Manager approval added" }] } }',
      },
    ],
    related: [
      {
        label: "talonic_process_change",
        slug: "talonic-process-change",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
      {
        label: "talonic_process_test_run",
        slug: "talonic-process-test-run",
      },
    ],
    faq: [
      {
        question: "Can a draft with open points be published?",
        answer: "No. talonic_process_publish is refused while `canPublish` is false.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-test-run",
    parentSlug: "tools",
    title: "talonic_process_test_run",
    seoTitle: "talonic_process_test_run — Test a Process Draft Safely",
    description:
      "MCP tool that runs a Talonic process draft on real documents in a test copy that sends nothing out, so you can see each step's result before going live.",
    content: [
      {
        type: "paragraph",
        text: "Run the draft on real documents in a test copy: nothing is delivered, emailed or called. Steps that are not set up yet end the test (`endsAt`). Returns the test copy's `processId` and the `runId`; follow it with talonic_process_status on that processId. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process, from talonic_process_list.",
          },
          {
            name: "document_ids",
            type: "UUID[]",
            required: true,
            description: "Documents to run the draft on, 1 to 100.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_test_run({ "process_id": "1111…", "document_ids": ["3333…"] })\n{ "processId": "4444…", "endsAt": [{ "stepId": "s_1", "name": "Manager approval" }], "runId": "2222…" }',
      },
    ],
    related: [
      {
        label: "talonic_process_status",
        slug: "talonic-process-status",
      },
      {
        label: "talonic_process_check",
        slug: "talonic-process-check",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
    ],
    faq: [
      {
        question: "Does a test run send mail?",
        answer: "No. A test copy delivers nothing, sends no mail and calls no system.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-publish",
    parentSlug: "tools",
    title: "talonic_process_publish",
    seoTitle: "talonic_process_publish — Make a Process Draft Live",
    description:
      "MCP tool that makes a Talonic process draft the live version, so it starts, sends mail and calls systems for real. Refused while the check still finds an error.",
    content: [
      {
        type: "paragraph",
        text: "Make the draft the live version. From then on the process runs for real: it starts on what its start says (arriving documents, mail, another system), sends its mail and calls its systems. Refused while the check finds an error. Call it only when the user said to publish, after showing them talonic_process_check. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process, from talonic_process_list.",
          },
          {
            name: "reason",
            type: "string",
            required: false,
            description: "Why this change, for the record.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_publish({ "process_id": "1111…", "reason": "Second approver added" })\n{ "version": 3, "changed": true }',
      },
    ],
    related: [
      {
        label: "talonic_process_check",
        slug: "talonic-process-check",
      },
      {
        label: "talonic_process_versions",
        slug: "talonic-process-versions",
      },
      {
        label: "talonic_process_rollback",
        slug: "talonic-process-rollback",
      },
    ],
    faq: [
      {
        question: "Can a publish be undone?",
        answer:
          "talonic_process_rollback makes an earlier version live again. What the new version already did (mail sent, systems called) stays done.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-versions",
    parentSlug: "tools",
    title: "talonic_process_versions",
    seoTitle: "talonic_process_versions — Published Process Versions",
    description:
      "MCP tool that lists the published versions of a Talonic process, newest first, with who published each one and why, to choose a version to roll back to.",
    content: [
      {
        type: "paragraph",
        text: "The published versions of a process, newest first, with who published and why. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process, from talonic_process_list.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_versions({ "process_id": "1111…" })\n[{ "n": 3, "publishedAt": "2026-11-24T06:22:00Z", "reason": "Second approver added" }]',
      },
    ],
    related: [
      {
        label: "talonic_process_rollback",
        slug: "talonic-process-rollback",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
    ],
    faq: [
      {
        question: "Is the draft a version?",
        answer: "No. Only published states are versions.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-rollback",
    parentSlug: "tools",
    title: "talonic_process_rollback",
    seoTitle: "talonic_process_rollback — Roll a Process Back Live",
    description:
      "MCP tool that makes an earlier published version of a Talonic process live again. It changes what runs for real, so call it only when the user asks for it.",
    content: [
      {
        type: "paragraph",
        text: "Make an earlier published version live again. It changes what runs for real, so call it only when the user asks for it. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process, from talonic_process_list.",
          },
          {
            name: "version",
            type: "integer",
            required: true,
            description: "The version number to make live again.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_rollback({ "process_id": "1111…", "version": 2 })\n{ "version": 2 }',
      },
    ],
    related: [
      {
        label: "talonic_process_versions",
        slug: "talonic-process-versions",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
    ],
    faq: [
      {
        question: "Does a rollback change the draft?",
        answer: "No. The draft stays as it is; only the live version changes.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-delete",
    parentSlug: "tools",
    title: "talonic_process_delete",
    seoTitle: "talonic_process_delete — Delete a Process for Good",
    description:
      "MCP tool that deletes a Talonic process. Not possible while a run is open, and it cannot be undone: call it only when the user named the process to delete.",
    content: [
      {
        type: "paragraph",
        text: "Delete a process. Not possible while a run is open, and it cannot be undone: call it only when the user asked to delete this process by name. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process, from talonic_process_list.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_delete({ "process_id": "1111…" })\n{ "deleted": true }',
      },
    ],
    related: [
      {
        label: "talonic_process_list",
        slug: "talonic-process-list",
      },
      {
        label: "talonic_process_runs",
        slug: "talonic-process-runs",
      },
    ],
    faq: [
      {
        question: "What happens to its past runs?",
        answer: "A process with an open run cannot be deleted. Finished runs go with the process.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-item",
    parentSlug: "tools",
    title: "talonic_process_item",
    seoTitle: "talonic_process_item — One Item's Way Through a Run",
    description:
      "MCP tool that shows one item's way through a Talonic process run, step by step, with status, time and notes such as why it stopped, and its values now.",
    content: [
      {
        type: "paragraph",
        text: "One item's way through a run, step by step (status, time, and a note such as why it stopped or where a mail went), and its values now. Item keys come from talonic_process_status. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process, from talonic_process_list.",
          },
          {
            name: "run_id",
            type: "UUID",
            required: true,
            description: "The run.",
          },
          {
            name: "item_key",
            type: "string",
            required: true,
            description: "The item's key (documentId) from the run.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_item({ "process_id": "1111…", "run_id": "2222…", "item_key": "3333…" })\n{ "steps": [{ "name": "Log it", "status": "stopped", "note": "The other system answered 500.", "canRetry": true }], "values": [{ "name": "amount", "value": 900 }] }',
      },
    ],
    related: [
      {
        label: "talonic_process_status",
        slug: "talonic-process-status",
      },
      {
        label: "talonic_process_retry",
        slug: "talonic-process-retry",
      },
    ],
    faq: [
      {
        question: "Where do I see why an item failed?",
        answer: "In the `note` of the step that stopped.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-retry",
    parentSlug: "tools",
    title: "talonic_process_retry",
    seoTitle: "talonic_process_retry — Retry the Failed Steps of a Run",
    description:
      "MCP tool that tries every failed step of a Talonic process run again. Steps that send or call will send or call again: use it once the cause is fixed.",
    content: [
      {
        type: "paragraph",
        text: "Try every failed step of a run again. Steps that send or call will send or call again, so use it when the cause of the failure is fixed. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "run_id",
            type: "UUID",
            required: true,
            description: "The run, from talonic_process_runs.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_retry({ "run_id": "2222…" })\n{ "retried": 1 }',
      },
    ],
    related: [
      {
        label: "talonic_process_runs",
        slug: "talonic-process-runs",
      },
      {
        label: "talonic_process_item",
        slug: "talonic-process-item",
      },
    ],
    faq: [
      {
        question: "Does a retry repeat steps that succeeded?",
        answer: "No. Only failed steps run again.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-send-back",
    parentSlug: "tools",
    title: "talonic_process_send_back",
    seoTitle: "talonic_process_send_back — Send Items Back in a Run",
    description:
      "MCP tool that sends items back from a sign-off step of a Talonic process run with a reason, for the caller: the opposite of signing, where they are assigned.",
    content: [
      {
        type: "paragraph",
        text: "Send items back from a sign-off step with a reason: the opposite of signing. Allowed only where the caller is assigned to the step. It moves real work, so call it only when the user decides. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process, from talonic_process_list.",
          },
          {
            name: "run_id",
            type: "UUID",
            required: true,
            description: "The run.",
          },
          {
            name: "step_id",
            type: "string",
            required: true,
            description: "The sign-off step.",
          },
          {
            name: "items",
            type: "string[]",
            required: true,
            description: "Item keys.",
          },
          {
            name: "reason",
            type: "string",
            required: true,
            description: "Why they go back.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_send_back({ "process_id": "1111…", "run_id": "2222…", "step_id": "s_1", "items": ["3333…"], "reason": "Amount does not match the order" })\n{ "sentBack": 1 }',
      },
    ],
    related: [
      {
        label: "talonic_process_sign",
        slug: "talonic-process-sign",
      },
      {
        label: "talonic_process_waiting_for_me",
        slug: "talonic-process-waiting-for-me",
      },
    ],
    faq: [
      {
        question: "Where do sent-back items go?",
        answer:
          "To where the process says: the step before, or the step its settings name for stopped items.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-setup",
    parentSlug: "tools",
    title: "talonic_process_setup",
    seoTitle: "talonic_process_setup — People, Mailboxes and Look-ups",
    description:
      "MCP tool that lists what Talonic processes can use: who a step can wait for, the connected mailboxes, the names of stored secrets and data look-ups can read.",
    content: [
      {
        type: "paragraph",
        text: "What processes of this workspace can use: who a step can wait for (roles, groups), the connected mailboxes and whether each may send, the names of stored secrets (never values), and the shared data a look-up step can read. Connecting a mailbox and storing a secret happen in the Talonic web app, not through a tool. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_setup({})\n{ "people": { "roles": [{ "id": "owner", "name": "Admin" }], "groups": [] }, "mailboxes": { "data": [{ "id": "5555…", "name": "Gmail (ap@example.com)", "canSend": true, "ownership": "company", "usable": true }] }, "secrets": { "data": ["erp_token"] }, "lookupData": { "state": "ready", "indexes": [{ "name": "contracts.contracts", "rows": 3, "ready": true }] } }',
      },
    ],
    related: [
      {
        label: "talonic_process_mailbox_ownership",
        slug: "talonic-process-mailbox-ownership",
      },
      {
        label: "talonic_process_change",
        slug: "talonic-process-change",
      },
    ],
    faq: [
      {
        question: "Can a secret's value be read?",
        answer: "No. Only names are returned, by this tool and by the API.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-mailbox-ownership",
    parentSlug: "tools",
    title: "talonic_process_mailbox_ownership",
    seoTitle: "talonic_process_mailbox_ownership — Mailbox Owners",
    description:
      "MCP tool that marks a connected mailbox as one person's own or the company's, which decides who may put it on a Talonic process. A governance decision.",
    content: [
      {
        type: "paragraph",
        text: "Say whether a connected mailbox is one person's own (`individual`: only that person may put it on a process) or the company's (`company`: everyone who builds processes may). A governance decision: call it only when the user asks. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "mailbox_id",
            type: "UUID",
            required: true,
            description: "The mailbox, from talonic_process_setup.",
          },
          {
            name: "ownership",
            type: "individual | company",
            required: true,
            description: "Whose it is.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_mailbox_ownership({ "mailbox_id": "5555…", "ownership": "company" })\n{ "id": "5555…", "ownership": "company" }',
      },
    ],
    related: [
      {
        label: "talonic_process_setup",
        slug: "talonic-process-setup",
      },
    ],
    faq: [
      {
        question: "Who may change this?",
        answer: "People with the Process Plane govern permission.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-address",
    parentSlug: "tools",
    title: "talonic_process_address",
    seoTitle: "talonic_process_address — A Process's Inbound Address",
    description:
      "MCP tool that shows whether a Talonic process has an address other systems send items to, and makes one when asked; the address is shown once, when made.",
    content: [
      {
        type: "paragraph",
        text: "The address other systems send items to (a webhook). Without `make` it only says whether one exists; the address itself is shown once, when it is made. With `make: true` it makes one and returns the `path` to post to. An existing address is replaced only with `replace: true`: the old one stops working at once and whatever sends to it stops getting through, so ask the user first. `test: true` is the address of the test copy, whose runs send nothing out. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "process_id",
            type: "UUID",
            required: true,
            description: "The process, from talonic_process_list.",
          },
          {
            name: "make",
            type: "boolean",
            required: false,
            description: "true: make the address. Default: only say whether one exists.",
          },
          {
            name: "test",
            type: "boolean",
            required: false,
            description: "The address of the test copy.",
          },
          {
            name: "replace",
            type: "boolean",
            required: false,
            description: "true only after the user agreed to switch the existing address off.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_address({ "process_id": "1111…", "make": true })\n{ "token": "…", "path": "/process-hooks/…" }',
      },
    ],
    related: [
      {
        label: "talonic_process_run",
        slug: "talonic-process-run",
      },
      {
        label: "talonic_process_setup",
        slug: "talonic-process-setup",
      },
    ],
    faq: [
      {
        question: "Can I read an address again later?",
        answer: "No. It is shown once. Making a new one switches the old one off.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
]
