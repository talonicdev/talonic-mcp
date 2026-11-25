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
  {
    slug: "talonic-process-details",
    parentSlug: "tools",
    title: "talonic_process_details",
    seoTitle: "talonic_process_details — Rename, File or Tag a Process",
    description:
      "MCP tool that renames a Talonic process, puts it in a folder or takes it out, or replaces its tags. The draft and the live version stay exactly as they are.",
    content: [
      {
        type: "paragraph",
        text: "Rename a process, put it in a folder (`folder: null` takes it out) or replace its tags. The draft and the live version are untouched. Needs the Process Plane build permission. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
          { name: "name", type: "string", required: false, description: "The new name." },
          {
            name: "folder",
            type: "string | null",
            required: false,
            description: "The folder; null takes the process out of its folder.",
          },
          {
            name: "tags",
            type: "string[]",
            required: false,
            description: "Replaces the tags (up to 20).",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_details({ "process_id": "1111…", "folder": "Finance", "tags": ["ap"] })\n{ "id": "1111…", "name": "Vendor bank details change", "folder": "Finance", "tags": ["ap"] }',
      },
    ],
    related: [
      { label: "talonic_process_list", slug: "talonic-process-list" },
      { label: "talonic_process_get", slug: "talonic-process-get" },
    ],
    faq: [
      {
        question: "Does renaming publish anything?",
        answer: "No. Name, folder and tags are not part of a version.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-export",
    parentSlug: "tools",
    title: "talonic_process_export",
    seoTitle: "talonic_process_export — Export a Process Draft as a File",
    description:
      "MCP tool that exports a Talonic process draft as a file another workspace can import. Chosen sources and destinations stay out; secrets travel by name only.",
    content: [
      {
        type: "paragraph",
        text: "The process draft as a file. Pass its `doc` as `draft`, with a name, when creating a process in another workspace. Chosen sources, destinations and similar workspace settings are left out, and secrets travel by name only. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
        code: '// talonic_process_export({ "process_id": "1111…" })\n{ "format": "talonic-process", "version": 1, "name": "Vendor bank details change", "exportedAt": "2026-11-25T09:00:00Z", "doc": { "fields": [], "steps": [] } }',
      },
    ],
    related: [
      { label: "talonic_process_create", slug: "talonic-process-create" },
      { label: "talonic_process_get", slug: "talonic-process-get" },
    ],
    faq: [
      {
        question: "Does the file carry secret values?",
        answer:
          "No. A step names a secret; the importing workspace stores its own value under that name.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-resources",
    parentSlug: "tools",
    title: "talonic_process_resources",
    seoTitle: "talonic_process_resources — What a Process Version Made",
    description:
      "MCP tool that lists what a published Talonic process version made or uses, such as schemas, deliveries and policies, with the steps each of them belongs to.",
    content: [
      {
        type: "paragraph",
        text: "What a published version made or uses: schemas, deliveries, policies and the like, with the steps they belong to. `madeByProcess` is false for something it uses but did not create. The live version unless `version` is given; empty before the first publish. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
            required: false,
            description: "A published version number; default the live version.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_resources({ "process_id": "1111…" })\n{ "data": [{ "kind": "schema", "id": "4444…", "version": 3, "stepIds": ["s_1"], "madeByProcess": true }] }',
      },
    ],
    related: [
      { label: "talonic_process_versions", slug: "talonic-process-versions" },
      { label: "talonic_process_publish", slug: "talonic-process-publish" },
    ],
    faq: [
      {
        question: "Is anything removed when I delete the process?",
        answer: "No. What it made stays in the workspace.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-extract-pipeline",
    parentSlug: "tools",
    title: "talonic_process_extract_pipeline",
    seoTitle: "talonic_process_extract_pipeline — Steps into a Pipeline",
    description:
      "MCP tool that moves a Talonic process draft's document steps and fields into a new reusable pipeline that other processes can use; one step takes their place.",
    content: [
      {
        type: "paragraph",
        text: "Moves the draft's document steps (reading, checking, reviewing documents) and its fields into a new reusable pipeline that other processes can use too. One pipeline step takes their place in the draft. Changes the draft only; publish to make it live. Needs the Process Plane build permission. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
            name: "name",
            type: "string",
            required: false,
            description: "Name of the new pipeline.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_extract_pipeline({ "process_id": "1111…", "name": "Invoice reading" })\n{ "process": { "id": "1111…" }, "pipeline": { "id": "5555…", "name": "Invoice reading" } }',
      },
    ],
    related: [
      { label: "talonic_process_get", slug: "talonic-process-get" },
      { label: "talonic_process_check", slug: "talonic-process-check" },
    ],
    faq: [
      {
        question: "What if the draft has no document steps?",
        answer: "The call is refused and nothing changes.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-try",
    parentSlug: "tools",
    title: "talonic_process_try",
    seoTitle: "talonic_process_try — Walk a Draft with Made-up Values",
    description:
      "MCP tool that walks a Talonic process draft with made-up values and sign-off choices: the steps an item would take and where it stops. Runs and sends nothing.",
    content: [
      {
        type: "paragraph",
        text: "Walks the draft with made-up values (by field id) and sign-off choices (by step id): the steps an item would take and where it stops. Runs nothing and sends nothing. Needs the Process Plane build permission. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
            name: "values",
            type: "object",
            required: false,
            description: "Values by field id, from talonic_process_get.",
          },
          {
            name: "choices",
            type: "object",
            required: false,
            description: "Sign-off choices by step id.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_try({ "process_id": "1111…", "values": { "f_amount": 12000 } })\n{ "path": ["s_source", "s_check", "s_approval"], "stop": "waits for a sign-off" }',
      },
    ],
    related: [
      { label: "talonic_process_evaluate", slug: "talonic-process-evaluate" },
      { label: "talonic_process_test_run", slug: "talonic-process-test-run" },
    ],
    faq: [
      {
        question: "Does it use real documents?",
        answer: "No. Use talonic_process_test_run for that.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-form-preview",
    parentSlug: "tools",
    title: "talonic_process_form_preview",
    seoTitle: "talonic_process_form_preview — Preview a Process Form Step",
    description:
      "MCP tool that shows how a form step of a Talonic process draft looks to the person filling it in: title, intro, button, and fields with their kinds and choices.",
    content: [
      {
        type: "paragraph",
        text: "How a form step of the draft looks to the person filling it in: title, intro, button and fields with their kinds and choices. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
            name: "step_id",
            type: "string",
            required: true,
            description: "The step's id, from talonic_process_get.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_form_preview({ "process_id": "1111…", "step_id": "s_form" })\n{ "title": "New supplier", "intro": null, "submitLabel": "Send", "needsCode": false, "fields": [{ "key": "f_1", "label": "IBAN", "help": null, "required": true, "kind": "string", "choices": [] }] }',
      },
    ],
    related: [
      { label: "talonic_process_get", slug: "talonic-process-get" },
      { label: "talonic_process_waiting_for_me", slug: "talonic-process-waiting-for-me" },
    ],
    faq: [
      { question: "Can I fill the form in from here?", answer: "No. The preview only shows it." },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-examples",
    parentSlug: "tools",
    title: "talonic_process_examples",
    seoTitle: "talonic_process_examples — Examples a Draft Is Checked On",
    description:
      "MCP tool that lists, keeps and removes the examples a Talonic process draft is checked against: items kept from earlier runs with the way they went and ended.",
    content: [
      {
        type: "paragraph",
        text: "Examples are items kept from runs. Without `keep` or `remove` this lists them. `keep` keeps an item of a run with the way it went and what it ended with (replacing an earlier example of the same item); `remove` removes one. Keeping and removing need the Process Plane build permission. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
            name: "keep",
            type: "object",
            required: false,
            description: "{ run_id, item_key, note? }: keep this item of a run.",
          },
          {
            name: "remove",
            type: "UUID",
            required: false,
            description: "The id of an example to remove.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_examples({ "process_id": "1111…", "keep": { "run_id": "2222…", "item_key": "doc-1" } })\n{ "kept": true }',
      },
    ],
    related: [
      { label: "talonic_process_evaluate", slug: "talonic-process-evaluate" },
      { label: "talonic_process_item", slug: "talonic-process-item" },
    ],
    faq: [
      {
        question: "How many examples can a process keep?",
        answer: "Up to 200 are listed and checked.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-evaluate",
    parentSlug: "tools",
    title: "talonic_process_evaluate",
    seoTitle: "talonic_process_evaluate — Check a Draft Against Examples",
    description:
      "MCP tool that checks a Talonic process draft against its kept examples: how many still go the same way, and where each other one would part. Sends nothing.",
    content: [
      {
        type: "paragraph",
        text: "Checks the draft against every kept example: how many still go the same way, and for each that would now go another way, where the ways part. Runs nothing and sends nothing. Use after changing a draft and before publishing. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
        code: '// talonic_process_evaluate({ "process_id": "1111…" })\n{ "total": 12, "same": 11, "changed": [{ "exampleId": "6666…", "label": "INV-204", "was": ["s_1", "s_2"], "now": ["s_1", "s_3"], "partsAt": "s_1", "stop": "end" }] }',
      },
    ],
    related: [
      { label: "talonic_process_examples", slug: "talonic-process-examples" },
      { label: "talonic_process_try", slug: "talonic-process-try" },
    ],
    faq: [
      {
        question: "Does it cost credits?",
        answer: "No. It walks the draft without running any step.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-scripts",
    parentSlug: "tools",
    title: "talonic_process_scripts",
    seoTitle: "talonic_process_scripts — Script Step Tests and Approvals",
    description:
      "MCP tool that shows, for each script step of a Talonic process draft, the latest test and the approval. A script goes live only once tested and approved.",
    content: [
      {
        type: "paragraph",
        text: "Per script step of the draft: the latest test (by the script's `hash`, passed or not, with results) and approval. A script step goes live only when its current script passed a test and a person approved it. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
        code: '// talonic_process_scripts({ "process_id": "1111…" })\n{ "s_script": { "tested": { "hash": "9f2c…", "ok": true, "at": "2026-11-25T09:00:00Z", "results": [] }, "approved": { "hash": "9f2c…", "by": "7777…", "at": "2026-11-25T09:05:00Z" } } }',
      },
    ],
    related: [
      { label: "talonic_process_script_test", slug: "talonic-process-script-test" },
      { label: "talonic_process_script_approve", slug: "talonic-process-script-approve" },
    ],
    faq: [
      {
        question: "Why is my approval gone?",
        answer: "The script changed after it was approved. Test and approve the new text.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-script-draft",
    parentSlug: "tools",
    title: "talonic_process_script_draft",
    seoTitle: "talonic_process_script_draft — Write a Script for a Step",
    description:
      "MCP tool that writes a script for a Talonic process script step from what it should do, in plain words. Saves nothing: returns the script and an explanation.",
    content: [
      {
        type: "paragraph",
        text: "Writes a script for a script step from what it should do, in plain words. Saves nothing: it returns the script, its `hash` and an explanation. Put the script on the step, then test it. The step must already name the fields it writes. Uses credits. Needs the Process Plane build permission. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
            name: "step_id",
            type: "string",
            required: true,
            description: "The step's id, from talonic_process_get.",
          },
          {
            name: "purpose",
            type: "string",
            required: true,
            description: "What the script should do, in plain words.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_script_draft({ "process_id": "1111…", "step_id": "s_script", "purpose": "Upper-case the vendor name" })\n{ "lua": "record.set(\\"vendor\\", string.upper(record.get(\\"vendor\\") or \\"\\"))", "hash": "9f2c…", "explanation": "…" }',
      },
    ],
    related: [
      { label: "talonic_process_script_test", slug: "talonic-process-script-test" },
      { label: "talonic_process_change", slug: "talonic-process-change" },
    ],
    faq: [
      {
        question: "Is the script saved on the step?",
        answer: "No. It is returned for you to put on the step.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-script-test",
    parentSlug: "tools",
    title: "talonic_process_script_test",
    seoTitle: "talonic_process_script_test — Test a Process Step's Script",
    description:
      "MCP tool that tests a Talonic process script step on up to 10 recent records without writing anything, and shows each field's value before and after the script.",
    content: [
      {
        type: "paragraph",
        text: "Tests a script step's current script on up to 10 recent records of this process, writing nothing: before and after per field, and `ok`. Needs one earlier run of the process (a test run is enough). Needs the Process Plane build permission. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
            name: "step_id",
            type: "string",
            required: true,
            description: "The step's id, from talonic_process_get.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_script_test({ "process_id": "1111…", "step_id": "s_script" })\n{ "hash": "9f2c…", "ok": true, "results": [{ "before": { "vendor": "acme" }, "after": { "vendor": "ACME" } }] }',
      },
    ],
    related: [
      { label: "talonic_process_script_approve", slug: "talonic-process-script-approve" },
      { label: "talonic_process_test_run", slug: "talonic-process-test-run" },
    ],
    faq: [
      {
        question: "Why does it say there is nothing to test on?",
        answer: "The process has not run yet. Run it once in a test copy first.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-script-approve",
    parentSlug: "tools",
    title: "talonic_process_script_approve",
    seoTitle: "talonic_process_script_approve — Approve a Step's Script",
    description:
      "MCP tool that approves the exact Talonic process script that passed its test, by its hash. Approval is a person's decision; call it only when the user says so.",
    content: [
      {
        type: "paragraph",
        text: "Approves the exact script that passed its test, by its `hash`. An approval is a person's decision that lets the script go live: call only when the user has read the script and says to approve it. Needs the Process Plane publish permission. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
            name: "step_id",
            type: "string",
            required: true,
            description: "The step's id, from talonic_process_get.",
          },
          {
            name: "hash",
            type: "string",
            required: true,
            description: "The tested script's hash, from talonic_process_scripts.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_script_approve({ "process_id": "1111…", "step_id": "s_script", "hash": "9f2c…" })\n{ "approved": true, "hash": "9f2c…" }',
      },
    ],
    related: [
      { label: "talonic_process_scripts", slug: "talonic-process-scripts" },
      { label: "talonic_process_publish", slug: "talonic-process-publish" },
    ],
    faq: [
      {
        question: "Can I approve a script that failed its test?",
        answer: "No. Only a script whose current text passed its test can be approved.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-sign-off",
    parentSlug: "tools",
    title: "talonic_process_sign_off",
    seoTitle: "talonic_process_sign_off — One Sign-off Step as Signed",
    description:
      "MCP tool that shows one Talonic process sign-off step as the caller sees it: who signs, instructions, fields and choices, and the items waiting for the caller.",
    content: [
      {
        type: "paragraph",
        text: "One sign-off step as the caller sees it: the brief (who signs, instructions, fields, choices), whether the caller may sign, and only then the items waiting with the values to check and the latest decisions. Pass an item's `documentId` in `items` to sign or send back. Needs the Process Plane sign permission. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
            name: "step_id",
            type: "string",
            required: true,
            description: "The sign-off step, from talonic_process_waiting_for_me.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_sign_off({ "process_id": "1111…", "step_id": "s_approval" })\n{ "canSign": true, "step": { "id": "s_approval", "signers": ["Finance"], "options": ["Pay", "Hold"] }, "items": [{ "runId": "2222…", "documentId": "doc-1", "values": [{ "name": "Amount", "value": "12000" }], "alreadySigned": false }], "history": [] }',
      },
    ],
    related: [
      { label: "talonic_process_sign", slug: "talonic-process-sign" },
      { label: "talonic_process_send_back", slug: "talonic-process-send-back" },
    ],
    faq: [
      {
        question: "Why are there no items?",
        answer: "The caller is not one of the step's signers, so only the brief is shown.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-retry-item",
    parentSlug: "tools",
    title: "talonic_process_retry_item",
    seoTitle: "talonic_process_retry_item — Retry One Step for One Item",
    description:
      "MCP tool that tries one failed step of a Talonic process run again for one item: an email or call is sent again, or a sent-back item returns to its signers.",
    content: [
      {
        type: "paragraph",
        text: "Tries one failed step again for one item of a run: an email or a call is sent again, and an item a signer sent back goes back to its signers. `canRetry` on talonic_process_item says where this applies. Use when the cause is fixed. Needs the Process Plane run permission. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
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
          { name: "run_id", type: "UUID", required: true, description: "The run." },
          {
            name: "step_id",
            type: "string",
            required: true,
            description: "The step's id, from talonic_process_get.",
          },
          {
            name: "item_key",
            type: "string",
            required: true,
            description: "The item's key, from the run.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_retry_item({ "process_id": "1111…", "run_id": "2222…", "step_id": "s_mail", "item_key": "doc-1" })\n{ "retried": true }',
      },
    ],
    related: [
      { label: "talonic_process_item", slug: "talonic-process-item" },
      { label: "talonic_process_retry", slug: "talonic-process-retry" },
    ],
    faq: [
      {
        question: "What does retried: false mean?",
        answer: "The step had not failed for that item, so nothing was done.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-group",
    parentSlug: "tools",
    title: "talonic_process_group",
    seoTitle: "talonic_process_group — Groups of People Steps Wait For",
    description:
      "MCP tool that creates, changes or deletes a group of people a Talonic process sign-off or form step waits for, and sets who belongs to the group as members.",
    content: [
      {
        type: "paragraph",
        text: "Creates, changes or deletes a group of people a sign-off or form step can wait for (the same groups as Team & Roles). Without `group_id` it creates one. With `group_id`, `name` and `description` change it, `member_ids` replaces its members, and `delete: true` deletes it. Members must be active members of the workspace. Who signs is a governance decision: call only when the user asks. Needs the Process Plane govern permission. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "group_id",
            type: "UUID",
            required: false,
            description: "Leave out to create a group.",
          },
          {
            name: "name",
            type: "string",
            required: false,
            description: "The group's name (needed to create one).",
          },
          {
            name: "description",
            type: "string",
            required: false,
            description: "What the group is for.",
          },
          {
            name: "member_ids",
            type: "UUID[]",
            required: false,
            description: "Person ids; replaces the members.",
          },
          {
            name: "delete",
            type: "boolean",
            required: false,
            description: "true deletes the group.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_group({ "name": "Finance approvers", "member_ids": ["7777…"] })\n{ "id": "8888…", "name": "Finance approvers", "description": null, "members": [{ "id": "7777…", "name": "Dana", "email": "dana@example.com" }] }',
      },
    ],
    related: [
      { label: "talonic_process_setup", slug: "talonic-process-setup" },
      { label: "talonic_process_sign_off", slug: "talonic-process-sign-off" },
    ],
    faq: [
      {
        question: "Where do I see the groups?",
        answer: "talonic_process_setup lists them with the workspace's roles.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  {
    slug: "talonic-process-build-lookup-data",
    parentSlug: "tools",
    title: "talonic_process_build_lookup_data",
    seoTitle: "talonic_process_build_lookup_data — Build Look-up Data",
    description:
      "MCP tool that builds the shared data Talonic process look-up steps read, from the workspace's reference data and snapshots. Safe to start again; uses credits.",
    content: [
      {
        type: "paragraph",
        text: "Builds the shared data look-up steps read, from the reference data and snapshots the workspace holds. Safe to start again. Check progress with talonic_process_setup: `lookupData.state` becomes `ready`. Uses credits. Needs the Process Plane build permission. Listed only when the person behind the key holds the Process Plane view permission in the workspace; the platform checks the permission for the action on every call.",
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_process_build_lookup_data({})\n{ "queued": true }',
      },
    ],
    related: [{ label: "talonic_process_setup", slug: "talonic-process-setup" }],
    faq: [
      {
        question: "How long does it take?",
        answer:
          "It depends on how much reference data the workspace holds; poll talonic_process_setup.",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
]
