import type { RawSection } from "../types"
import { link, tool } from "../routes"

export const sections: RawSection[] = [
  {
    slug: "run-talonic-tasks",
    parentSlug: "advanced",
    title: "Run Talonic tasks from your own agent",
    seoTitle: "Run Talonic Tasks and Decisions from Your Own Agent: Docs",
    description:
      "Let your own agent take checks and decisions your workspace hands out: list the work, claim one, read its input, submit a result Talonic checks or hand it back.",
    content: [
      {
        type: "paragraph",
        text: "A workspace can hand some work to an outside agent instead of a person: a check a Spec asks for on a document, or a decision an app makes on each run. Your agent picks the work up, does it, and hands back a result that Talonic verifies before anything continues. This page is for teams wiring their own agent into those steps.",
      },
      { type: "heading", level: 2, id: "two-kinds", text: "Two kinds of work" },
      {
        type: "list",
        items: [
          `**Agent tasks** come from a Spec step set to wait for an outside agent. Each has the document's input, instructions and the fields to return. Tools: ${tool("talonic_list_agent_tasks")}, ${tool("talonic_get_agent_task")}, ${tool("talonic_claim_agent_task")}, ${tool("talonic_heartbeat_agent_task")}, ${tool("talonic_submit_agent_task")}.`,
          `**Decision tasks** come from an app whose decisions are made outside Talonic. Each has the records to decide on, earlier decisions as precedent, and the shape the decision must take. Tools: ${tool("talonic_list_decision_tasks")}, ${tool("talonic_claim_decision_task")}, ${tool("talonic_read_decision_package")}, ${tool("talonic_heartbeat_decision_task")}, ${tool("talonic_submit_decision_task")}, ${tool("talonic_release_decision_task")}, ${tool("talonic_fail_decision_task")}.`,
        ],
      },
      { type: "heading", level: 2, id: "loop", text: "The loop" },
      {
        type: "list",
        ordered: true,
        items: [
          "**List** available work. (Or subscribe to the webhook your workspace sends when work is offered.)",
          "**Claim** one item. A claim is yours for a limited time (`lease_expires_at`) and carries an `execution_epoch` you send back with every later call. If another agent claimed it first you get HTTP 409; take the next one.",
          "**Read** the input. For decisions, read the records page by page; copy the evidence locators you rely on.",
          "**Keep the claim alive** with a heartbeat if the work takes longer than the lease.",
          "**Submit** the result in exactly the declared shape. Talonic checks it before writing anything; a rejected submission (HTTP 422) says why and changes nothing, so fix it and submit again while the claim lasts.",
          "**Or hand it back.** Release a decision another agent could still make; fail one nobody can decide, which sends it to a person and applies the app's fallback.",
        ],
      },
      { type: "heading", level: 2, id: "access", text: "Access" },
      {
        type: "list",
        items: [
          "Agent tasks: any credential for the workspace; you see only the tasks of that workspace.",
          "Decision tasks: an API key with a `decide` grant for that app, or a connector session with the `apps:decide` scope and a workspace role of senior member or above. A 403 names what is missing (`decide_grant_required`, `insufficient_scope`, `insufficient_tier`); the agent should tell you, not retry.",
          "Every read of a task's input is recorded against the task.",
        ],
      },
      { type: "heading", level: 2, id: "errors", text: "Errors" },
      {
        type: "param-table",
        params: [
          {
            name: "409",
            type: "conflict",
            description:
              "Someone else holds the claim, or your `execution_epoch` is out of date. Stop, discard the work and list again.",
          },
          {
            name: "422",
            type: "rejected",
            description:
              "The result does not match the declared shape or evidence. Nothing changed; fix and resubmit.",
          },
          {
            name: "403",
            type: "forbidden",
            description:
              "The credential lacks the grant, scope or role. Reconnect or ask an admin.",
          },
        ],
      },
      {
        type: "paragraph",
        text: `See ${link("tools-by-task", "Tools by task")} for the rest of the tools.`,
      },
    ],
    related: [
      { label: "talonic_claim_agent_task", slug: "talonic-claim-agent-task" },
      { label: "talonic_claim_decision_task", slug: "talonic-claim-decision-task" },
      { label: "Tools by task", slug: "tools-by-task" },
    ],
    faq: [
      {
        question: "What happens if my agent crashes in the middle of a task?",
        answer:
          "The claim runs out at `lease_expires_at` and the task becomes available again. Any later call with the old `execution_epoch` is refused, so stale work can never overwrite a newer result.",
      },
    ],
    mentions: ["agent tasks", "decision tasks", "human in the loop"],
  },
]
