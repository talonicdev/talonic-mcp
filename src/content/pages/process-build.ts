// Page copy for the generated tool reference (see src/content/tool-pages.ts).

import type { ToolPage } from "../tool-reference-types"

export const PROCESS_BUILD_PAGES: Record<string, ToolPage> = {
  talonic_process_details: {
    task: "build",
    seoTitle: "talonic_process_details — Rename, File or Tag a Process",
    description:
      "MCP tool that renames a Talonic process, puts it in a folder or takes it out, or replaces its tags. The draft and the live version stay exactly as they are.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_details({ "process_id": "1111…", "folder": "Finance", "tags": ["ap"] })\n{ "id": "1111…", "name": "Vendor bank details change", "folder": "Finance", "tags": ["ap"] }',
      },
    ],
    faq: [
      {
        question: "Does renaming publish anything?",
        answer: "No. Name, folder and tags are not part of a version.",
      },
    ],
    related: [
      {
        label: "talonic_process_list",
        slug: "talonic-process-list",
      },
      {
        label: "talonic_process_get",
        slug: "talonic-process-get",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_export: {
    task: "build",
    seoTitle: "talonic_process_export — Export a Process Draft as a File",
    description:
      "MCP tool that exports a Talonic process draft as a file another workspace can import. Chosen sources and destinations stay out; secrets travel by name only.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_export({ "process_id": "1111…" })\n{ "format": "talonic-process", "version": 1, "name": "Vendor bank details change", "exportedAt": "2026-11-25T09:00:00Z", "doc": { "fields": [], "steps": [] } }',
      },
    ],
    faq: [
      {
        question: "Does the file carry secret values?",
        answer:
          "No. A step names a secret; the importing workspace stores its own value under that name.",
      },
    ],
    related: [
      {
        label: "talonic_process_create",
        slug: "talonic-process-create",
      },
      {
        label: "talonic_process_get",
        slug: "talonic-process-get",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_resources: {
    task: "build",
    seoTitle: "talonic_process_resources — What a Process Version Made",
    description:
      "MCP tool that lists what a published Talonic process version made or uses, such as schemas, deliveries and policies, with the steps each of them belongs to.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_resources({ "process_id": "1111…" })\n{ "data": [{ "kind": "schema", "id": "4444…", "version": 3, "stepIds": ["s_1"], "madeByProcess": true }] }',
      },
    ],
    faq: [
      {
        question: "Is anything removed when I delete the process?",
        answer: "No. What it made stays in the workspace.",
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
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_extract_pipeline: {
    task: "build",
    seoTitle: "talonic_process_extract_pipeline — Steps into a Pipeline",
    description:
      "MCP tool that moves a Talonic process draft's document steps and fields into a new reusable pipeline that other processes can use; one step takes their place.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_extract_pipeline({ "process_id": "1111…", "name": "Invoice reading" })\n{ "process": { "id": "1111…" }, "pipeline": { "id": "5555…", "name": "Invoice reading" } }',
      },
    ],
    faq: [
      {
        question: "What if the draft has no document steps?",
        answer: "The call is refused and nothing changes.",
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
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_try: {
    task: "build",
    seoTitle: "talonic_process_try — Walk a Draft with Made-up Values",
    description:
      "MCP tool that walks a Talonic process draft with made-up values and sign-off choices: the steps an item would take and where it stops. Runs and sends nothing.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_try({ "process_id": "1111…", "values": { "f_amount": 12000 } })\n{ "path": ["s_source", "s_check", "s_approval"], "stop": "waits for a sign-off" }',
      },
    ],
    faq: [
      {
        question: "Does it use real documents?",
        answer: "No. Use talonic_process_test_run for that.",
      },
    ],
    related: [
      {
        label: "talonic_process_evaluate",
        slug: "talonic-process-evaluate",
      },
      {
        label: "talonic_process_test_run",
        slug: "talonic-process-test-run",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_form_preview: {
    task: "build",
    seoTitle: "talonic_process_form_preview — Preview a Process Form Step",
    description:
      "MCP tool that shows how a form step of a Talonic process draft looks to the person filling it in: title, intro, button, and fields with their kinds and choices.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_form_preview({ "process_id": "1111…", "step_id": "s_form" })\n{ "title": "New supplier", "intro": null, "submitLabel": "Send", "needsCode": false, "fields": [{ "key": "f_1", "label": "IBAN", "help": null, "required": true, "kind": "string", "choices": [] }] }',
      },
    ],
    faq: [
      {
        question: "Can I fill the form in from here?",
        answer: "No. The preview only shows it.",
      },
    ],
    related: [
      {
        label: "talonic_process_get",
        slug: "talonic-process-get",
      },
      {
        label: "talonic_process_waiting_for_me",
        slug: "talonic-process-waiting-for-me",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_examples: {
    task: "build",
    seoTitle: "talonic_process_examples — Examples a Draft Is Checked On",
    description:
      "MCP tool that lists, keeps and removes the examples a Talonic process draft is checked against: items kept from earlier runs with the way they went and ended.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_examples({ "process_id": "1111…", "keep": { "run_id": "2222…", "item_key": "doc-1" } })\n{ "kept": true }',
      },
    ],
    faq: [
      {
        question: "How many examples can a process keep?",
        answer: "Up to 200 are listed and checked.",
      },
    ],
    related: [
      {
        label: "talonic_process_evaluate",
        slug: "talonic-process-evaluate",
      },
      {
        label: "talonic_process_item",
        slug: "talonic-process-item",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_evaluate: {
    task: "build",
    seoTitle: "talonic_process_evaluate — Check a Draft Against Examples",
    description:
      "MCP tool that checks a Talonic process draft against its kept examples: how many still go the same way, and where each other one would part. Sends nothing.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_evaluate({ "process_id": "1111…" })\n{ "total": 12, "same": 11, "changed": [{ "exampleId": "6666…", "label": "INV-204", "was": ["s_1", "s_2"], "now": ["s_1", "s_3"], "partsAt": "s_1", "stop": "end" }] }',
      },
    ],
    faq: [
      {
        question: "Does it cost credits?",
        answer: "No. It walks the draft without running any step.",
      },
    ],
    related: [
      {
        label: "talonic_process_examples",
        slug: "talonic-process-examples",
      },
      {
        label: "talonic_process_try",
        slug: "talonic-process-try",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_scripts: {
    task: "build",
    seoTitle: "talonic_process_scripts — Script Step Tests and Approvals",
    description:
      "MCP tool that shows, for each script step of a Talonic process draft, the latest test and the approval. A script goes live only once tested and approved.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_scripts({ "process_id": "1111…" })\n{ "s_script": { "tested": { "hash": "9f2c…", "ok": true, "at": "2026-11-25T09:00:00Z", "results": [] }, "approved": { "hash": "9f2c…", "by": "7777…", "at": "2026-11-25T09:05:00Z" } } }',
      },
    ],
    faq: [
      {
        question: "Why is my approval gone?",
        answer: "The script changed after it was approved. Test and approve the new text.",
      },
    ],
    related: [
      {
        label: "talonic_process_script_test",
        slug: "talonic-process-script-test",
      },
      {
        label: "talonic_process_script_approve",
        slug: "talonic-process-script-approve",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_script_draft: {
    task: "build",
    seoTitle: "talonic_process_script_draft — Write a Script for a Step",
    description:
      "MCP tool that writes a script for a Talonic process script step from what it should do, in plain words. Saves nothing: returns the script and an explanation.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_script_draft({ "process_id": "1111…", "step_id": "s_script", "purpose": "Upper-case the vendor name" })\n{ "lua": "record.set(\\"vendor\\", string.upper(record.get(\\"vendor\\") or \\"\\"))", "hash": "9f2c…", "explanation": "…" }',
      },
    ],
    faq: [
      {
        question: "Is the script saved on the step?",
        answer: "No. It is returned for you to put on the step.",
      },
    ],
    related: [
      {
        label: "talonic_process_script_test",
        slug: "talonic-process-script-test",
      },
      {
        label: "talonic_process_change",
        slug: "talonic-process-change",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_script_test: {
    task: "build",
    seoTitle: "talonic_process_script_test — Test a Process Step's Script",
    description:
      "MCP tool that tests a Talonic process script step on up to 10 recent records without writing anything, and shows each field's value before and after the script.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_script_test({ "process_id": "1111…", "step_id": "s_script" })\n{ "hash": "9f2c…", "ok": true, "results": [{ "before": { "vendor": "acme" }, "after": { "vendor": "ACME" } }] }',
      },
    ],
    faq: [
      {
        question: "Why does it say there is nothing to test on?",
        answer: "The process has not run yet. Run it once in a test copy first.",
      },
    ],
    related: [
      {
        label: "talonic_process_script_approve",
        slug: "talonic-process-script-approve",
      },
      {
        label: "talonic_process_test_run",
        slug: "talonic-process-test-run",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_script_approve: {
    task: "build",
    seoTitle: "talonic_process_script_approve — Approve a Step's Script",
    description:
      "MCP tool that approves the exact Talonic process script that passed its test, by its hash. Approval is a person's decision; call it only when the user says so.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_script_approve({ "process_id": "1111…", "step_id": "s_script", "hash": "9f2c…" })\n{ "approved": true, "hash": "9f2c…" }',
      },
    ],
    faq: [
      {
        question: "Can I approve a script that failed its test?",
        answer: "No. Only a script whose current text passed its test can be approved.",
      },
    ],
    related: [
      {
        label: "talonic_process_scripts",
        slug: "talonic-process-scripts",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_sign_off: {
    task: "automate",
    seoTitle: "talonic_process_sign_off — One Sign-off Step as Signed",
    description:
      "MCP tool that shows one Talonic process sign-off step as the caller sees it: who signs, instructions, fields and choices, and the items waiting for the caller.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_sign_off({ "process_id": "1111…", "step_id": "s_approval" })\n{ "canSign": true, "step": { "id": "s_approval", "signers": ["Finance"], "options": ["Pay", "Hold"] }, "items": [{ "runId": "2222…", "documentId": "doc-1", "values": [{ "name": "Amount", "value": "12000" }], "alreadySigned": false }], "history": [] }',
      },
    ],
    faq: [
      {
        question: "Why are there no items?",
        answer: "The caller is not one of the step's signers, so only the brief is shown.",
      },
    ],
    related: [
      {
        label: "talonic_process_sign",
        slug: "talonic-process-sign",
      },
      {
        label: "talonic_process_send_back",
        slug: "talonic-process-send-back",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_retry_item: {
    task: "automate",
    seoTitle: "talonic_process_retry_item — Retry One Step for One Item",
    description:
      "MCP tool that tries one failed step of a Talonic process run again for one item: an email or call is sent again, or a sent-back item returns to its signers.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_retry_item({ "process_id": "1111…", "run_id": "2222…", "step_id": "s_mail", "item_key": "doc-1" })\n{ "retried": true }',
      },
    ],
    faq: [
      {
        question: "What does retried: false mean?",
        answer: "The step had not failed for that item, so nothing was done.",
      },
    ],
    related: [
      {
        label: "talonic_process_item",
        slug: "talonic-process-item",
      },
      {
        label: "talonic_process_retry",
        slug: "talonic-process-retry",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_group: {
    task: "build",
    seoTitle: "talonic_process_group — Groups of People Steps Wait For",
    description:
      "MCP tool that creates, changes or deletes a group of people a Talonic process sign-off or form step waits for, and sets who belongs to the group as members.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_group({ "name": "Finance approvers", "member_ids": ["7777…"] })\n{ "id": "8888…", "name": "Finance approvers", "description": null, "members": [{ "id": "7777…", "name": "Dana", "email": "dana@example.com" }] }',
      },
    ],
    faq: [
      {
        question: "Where do I see the groups?",
        answer: "talonic_process_setup lists them with the workspace's roles.",
      },
    ],
    related: [
      {
        label: "talonic_process_setup",
        slug: "talonic-process-setup",
      },
      {
        label: "talonic_process_sign_off",
        slug: "talonic-process-sign-off",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_build_lookup_data: {
    task: "build",
    seoTitle: "talonic_process_build_lookup_data — Build Look-up Data",
    description:
      "MCP tool that builds the shared data Talonic process look-up steps read, from the workspace's reference data and snapshots. Safe to start again; uses credits.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_build_lookup_data({})\n{ "queued": true }',
      },
    ],
    faq: [
      {
        question: "How long does it take?",
        answer:
          "It depends on how much reference data the workspace holds; poll talonic_process_setup.",
      },
    ],
    related: [
      {
        label: "talonic_process_setup",
        slug: "talonic-process-setup",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
}
