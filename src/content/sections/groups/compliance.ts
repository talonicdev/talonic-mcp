import type { RawSection } from "../../types"

// Generated from src/tools/compliance.ts (names, summaries, parameters); keep in step with it.
export const section: RawSection = {
  slug: "compliance-tools",
  parentSlug: "tool-groups",
  title: "Compliance",
  seoTitle: "Compliance MCP Tools — Check Documents Against Rules",
  description:
    "MCP tools for the Talonic Compliance app: list failed checks, open a verdict with its reason and quote, re-evaluate documents and manage frameworks and sets.",
  content: [
    {
      type: "paragraph",
      text: "Check workspace documents against the regulations, policies and standards the workspace holds as frameworks. Each rule of a framework that is ON gets a verdict per document (or per document set): pass, fail, unclear or not applicable, with the reason and the quote it rests on.",
    },
    {
      type: "paragraph",
      text: "The usual loop: **`talonic_compliance_issues`** lists what fails, **`talonic_compliance_get_document_evaluation`** shows the evidence for one document, and the allowed correction follows: re-evaluate after the document changed, take a document off the list, switch a framework OFF, or narrow the rules a document set is judged against. A workspace that makes its compliance decisions with its own agent works them through the task tools (claim, heartbeat, release, submit).",
    },
    {
      type: "callout",
      variant: "info",
      text: "These tools are listed only when the Compliance app is available to the connection. Every call is checked against the role and permissions of the person behind the connection, exactly as in the web app.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-issues",
      text: "talonic_compliance_issues",
    },
    {
      type: "paragraph",
      text: "The worklist of failed checks: per document the rules it fails (and, with `unclear`, the rules whose verdict is unclear), with the framework each rule comes from.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "unclear",
          type: "boolean",
          required: false,
          description: "Also list rules whose verdict is unclear.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-get-document-evaluation",
      text: "talonic_compliance_get_document_evaluation",
    },
    {
      type: "paragraph",
      text: "A document's latest evaluation with every result: per rule the verdict (pass, fail, unclear, not_applicable), the reason, the quote from the document it rests on, whether it needs a person's check, and whether the evaluation is outdated.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_id",
          type: "UUID",
          required: true,
          description: "The evaluated document.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-list-evaluations",
      text: "talonic_compliance_list_evaluations",
    },
    {
      type: "paragraph",
      text: "The latest evaluation of every document on the Evaluations list. Without paging arguments the whole list; with any of status / limit / offset one page with total and has_more.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "status",
          type: '"processing" | "waiting" | "completed" | "error"',
          required: false,
          description: "Only evaluations with this status (an interrupted one shows error).",
        },
        {
          name: "limit",
          type: "integer",
          required: false,
          description: "Page size; any of status / limit / offset asks for one page.",
        },
        {
          name: "offset",
          type: "integer",
          required: false,
          description: "Rows to skip, for paging.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-evaluation-status",
      text: "talonic_compliance_evaluation_status",
    },
    {
      type: "paragraph",
      text: "Counts over the latest evaluations: processing, completed, error, outdated and failing.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-export",
      text: "talonic_compliance_export",
    },
    {
      type: "paragraph",
      text: "Download every verdict of the evaluated documents and document sets as a file (one row per rule and document or set: framework, rule, obligation, verdict, reason, quote, evaluated at, outdated), up to 8 MB.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "format",
          type: '"xlsx" | "csv"',
          required: false,
          description: "File format (default xlsx).",
        },
        {
          name: "issues_only",
          type: "boolean",
          required: false,
          description: "Only failed and unclear verdicts of the sets.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-evaluate",
      text: "talonic_compliance_evaluate",
    },
    {
      type: "paragraph",
      text: "Evaluate documents against every framework that is ON. Runs in the background; poll talonic_compliance_evaluation_status or talonic_compliance_get_document_evaluation.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_ids",
          type: "UUID[]",
          required: true,
          description: "Documents to evaluate.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-evaluate-all",
      text: "talonic_compliance_evaluate_all",
    },
    {
      type: "paragraph",
      text: "Evaluate every listed document whose evaluation is missing or outdated, oldest first. Run with dry_run first to see how many.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "dry_run",
          type: "boolean",
          required: false,
          description: "Only report how many would be evaluated.",
        },
        {
          name: "limit",
          type: "integer",
          required: false,
          description: "Evaluate at most this many.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-add-documents",
      text: "talonic_compliance_add_documents",
    },
    {
      type: "paragraph",
      text: "Put workspace documents on the Evaluations list and evaluate them against the frameworks that are ON.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_ids",
          type: "UUID[]",
          required: true,
          description: "Documents to add and evaluate.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-remove-document",
      text: "talonic_compliance_remove_document",
    },
    {
      type: "paragraph",
      text: "Take a document off the Evaluations list together with its evaluations. The document itself stays in the workspace; adding it again re-evaluates it. Cannot be undone: ask the user first.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_id",
          type: "UUID",
          required: true,
          description: "The document to take off the list.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-list-frameworks",
      text: "talonic_compliance_list_frameworks",
    },
    {
      type: "paragraph",
      text: "The frameworks (regulations, policies, contract standards held as workspace documents) with their status, whether each is ON, and their rule counts.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-framework-rules",
      text: "talonic_compliance_framework_rules",
    },
    {
      type: "paragraph",
      text: "The rules of one framework: code, text, obligation, section, what it applies to and its condition.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_id",
          type: "UUID",
          required: true,
          description: "The framework's document id.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-add-frameworks",
      text: "talonic_compliance_add_frameworks",
    },
    {
      type: "paragraph",
      text: "Make existing workspace documents frameworks (a regulation, policy or standard to check other documents against). Their rules are then written from their text; switch a framework ON to check documents against it.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_ids",
          type: "UUID[]",
          required: true,
          description: "Workspace documents to make frameworks.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-set-framework-active",
      text: "talonic_compliance_set_framework_active",
    },
    {
      type: "paragraph",
      text: "Turn a framework ON (its rules are in force for every evaluation) or OFF (they are not). Reversible; evaluations made before become outdated.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_id",
          type: "UUID",
          required: true,
          description: "The framework's document id.",
        },
        {
          name: "active",
          type: "boolean",
          required: true,
          description: "true = ON, false = OFF.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-generate-rules",
      text: "talonic_compliance_generate_rules",
    },
    {
      type: "paragraph",
      text: "Write the rules of a framework again from its text, replacing the current ones. Cannot be undone: ask the user first.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_id",
          type: "UUID",
          required: true,
          description: "The framework's document id.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-remove-framework",
      text: "talonic_compliance_remove_framework",
    },
    {
      type: "paragraph",
      text: "Take a framework out of the app with its rules. The document stays in the workspace and can be made a framework again. Cannot be undone: ask the user first.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_id",
          type: "UUID",
          required: true,
          description: "The framework's document id.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-list-comparisons",
      text: "talonic_compliance_list_comparisons",
    },
    {
      type: "paragraph",
      text: "Comparisons of document batches for discrepancies (values that should agree across the documents but do not), newest first.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-get-comparison",
      text: "talonic_compliance_get_comparison",
    },
    {
      type: "paragraph",
      text: "One comparison with every discrepancy found: the value, which documents disagree and where.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "run_id",
          type: "UUID",
          required: true,
          description: "The comparison id.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-compare-documents",
      text: "talonic_compliance_compare_documents",
    },
    {
      type: "paragraph",
      text: "Compare a batch of documents that belong together (an order, its invoice, its delivery note) for values that disagree. Runs in the background; read it with talonic_compliance_get_comparison.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_ids",
          type: "UUID[]",
          required: true,
          description: "The documents to compare.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-list-sets",
      text: "talonic_compliance_list_sets",
    },
    {
      type: "paragraph",
      text: "Document sets (documents judged as one whole, e.g. a contract with its annexes) with their documents and rule set.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-create-set",
      text: "talonic_compliance_create_set",
    },
    {
      type: "paragraph",
      text: "Create a document set picked by hand, judged against one rule set or, without one, every rule of the frameworks that are ON.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "name",
          type: "string",
          required: true,
          description: "Set name.",
        },
        {
          name: "document_ids",
          type: "UUID[]",
          required: true,
          description: "The set's documents.",
        },
        {
          name: "rule_set_id",
          type: "UUID",
          required: false,
          description: "Rule set to judge it against; omitted or null = every ON rule.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-assembly-groups",
      text: "talonic_compliance_assembly_groups",
    },
    {
      type: "paragraph",
      text: "The assembly groups of the workspace's pipelines (documents grouped by a shared value, such as one order number) that sets can be made from.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-create-sets-from-groups",
      text: "talonic_compliance_create_sets_from_groups",
    },
    {
      type: "paragraph",
      text: "Create one document set per assembly group; the set follows the group as documents join it.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "groups",
          type: "object[]",
          required: true,
          description: "Groups from talonic_compliance_assembly_groups.",
        },
        {
          name: "rule_set_id",
          type: "UUID",
          required: false,
          description: "Rule set to judge them against; omitted or null = every ON rule.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-update-set",
      text: "talonic_compliance_update_set",
    },
    {
      type: "paragraph",
      text: "Rename a set, replace its documents (a group-following set becomes hand-picked) or change its rule set. Fields left out stay.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "set_id",
          type: "UUID",
          required: true,
          description: "The set.",
        },
        {
          name: "name",
          type: "string",
          required: false,
          description: "New set name.",
        },
        {
          name: "document_ids",
          type: "UUID[]",
          required: false,
          description: "The set's documents (replaces them).",
        },
        {
          name: "rule_set_id",
          type: "UUID",
          required: false,
          description: "null = every ON rule; omitted = unchanged.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-remove-set",
      text: "talonic_compliance_remove_set",
    },
    {
      type: "paragraph",
      text: "Remove a document set with its evaluations. The documents stay in the workspace. Cannot be undone: ask the user first.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "set_id",
          type: "UUID",
          required: true,
          description: "The set.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-list-set-evaluations",
      text: "talonic_compliance_list_set_evaluations",
    },
    {
      type: "paragraph",
      text: "The latest evaluation of every document set. Without paging arguments the whole list; with any of status / limit / offset one page with total and has_more.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "status",
          type: '"processing" | "waiting" | "completed" | "error"',
          required: false,
          description: "Only evaluations with this status (an interrupted one shows error).",
        },
        {
          name: "limit",
          type: "integer",
          required: false,
          description: "Page size; any of status / limit / offset asks for one page.",
        },
        {
          name: "offset",
          type: "integer",
          required: false,
          description: "Rows to skip, for paging.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-get-set-evaluation",
      text: "talonic_compliance_get_set_evaluation",
    },
    {
      type: "paragraph",
      text: "A set's latest evaluation with every result: verdict, reason, and the quote with the member document it comes from.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "set_id",
          type: "UUID",
          required: true,
          description: "The set.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-evaluate-sets",
      text: "talonic_compliance_evaluate_sets",
    },
    {
      type: "paragraph",
      text: "Evaluate document sets, each as one whole, against their rule set. Runs in the background.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "set_ids",
          type: "UUID[]",
          required: true,
          description: "Sets to evaluate.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-list-rule-sets",
      text: "talonic_compliance_list_rule_sets",
    },
    {
      type: "paragraph",
      text: "The workspace's rule sets: named selections of rules of the ON frameworks that a document set is judged against.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-create-rule-set",
      text: "talonic_compliance_create_rule_set",
    },
    {
      type: "paragraph",
      text: "Create a named selection of rules (from talonic_compliance_framework_rules) to judge document sets against.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "name",
          type: "string",
          required: true,
          description: "Rule set name.",
        },
        {
          name: "rule_ids",
          type: "UUID[]",
          required: true,
          description: "Rules of ON frameworks.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-update-rule-set",
      text: "talonic_compliance_update_rule_set",
    },
    {
      type: "paragraph",
      text: "Rename a rule set or replace its rules.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "rule_set_id",
          type: "UUID",
          required: true,
          description: "Id from the matching list tool.",
        },
        {
          name: "name",
          type: "string",
          required: false,
          description: "New rule set name.",
        },
        {
          name: "rule_ids",
          type: "UUID[]",
          required: false,
          description: "The rules (replaces them).",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-remove-rule-set",
      text: "talonic_compliance_remove_rule_set",
    },
    {
      type: "paragraph",
      text: "Remove a rule set. Sets that used it go back to every rule of the ON frameworks. Cannot be undone: ask the user first.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "rule_set_id",
          type: "UUID",
          required: true,
          description: "Id from the matching list tool.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-settings",
      text: "talonic_compliance_settings",
    },
    {
      type: "paragraph",
      text: "Who makes the workspace's compliance decisions: `platform` (Talonic decides every verdict) or `external` (the workspace's own agent decides, through the compliance tasks).",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-set-decider",
      text: "talonic_compliance_set_decider",
    },
    {
      type: "paragraph",
      text: "Switch who makes the compliance decisions: `platform` or `external` (the workspace's own agent works the tasks). Reversible. The person behind the connection needs the Workspace settings permission.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "decider",
          type: '"platform" | "external"',
          required: true,
          description: "platform = Talonic decides; external = the workspace's own agent.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-list-tasks",
      text: "talonic_compliance_list_tasks",
    },
    {
      type: "paragraph",
      text: "Decisions waiting for the workspace's own agent (only when the decider is external).",
    },
    {
      type: "param-table",
      params: [
        {
          name: "status",
          type: '"open" | "all"',
          required: false,
          description: "open (default) or all.",
        },
        {
          name: "limit",
          type: "integer",
          required: false,
          description: "Most tasks returned (default 100).",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-get-task",
      text: "talonic_compliance_get_task",
    },
    {
      type: "paragraph",
      text: "One task's state (open, claimed, done) without its work package.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "task_id",
          type: "UUID",
          required: true,
          description: "Id from the matching list tool.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-claim-task",
      text: "talonic_compliance_claim_task",
    },
    {
      type: "paragraph",
      text: "Claim a task for this agent and read its work package: instructions, the input, and the JSON Schema the answer must match. The claim is a lease: renew it with talonic_compliance_heartbeat_task while working, hand it back with talonic_compliance_release_task, or answer with talonic_compliance_submit_task. A lapsed lease returns the task to open.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "task_id",
          type: "UUID",
          required: true,
          description: "Id from the matching list tool.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-heartbeat-task",
      text: "talonic_compliance_heartbeat_task",
    },
    {
      type: "paragraph",
      text: "Renew the lease on a claimed task.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "task_id",
          type: "UUID",
          required: true,
          description: "Id from the matching list tool.",
        },
        {
          name: "execution_epoch",
          type: "integer",
          required: true,
          description: "The execution_epoch talonic_compliance_claim_task returned.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-release-task",
      text: "talonic_compliance_release_task",
    },
    {
      type: "paragraph",
      text: "Hand a claimed task back unanswered; it is open again for any agent.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "task_id",
          type: "UUID",
          required: true,
          description: "Id from the matching list tool.",
        },
        {
          name: "execution_epoch",
          type: "integer",
          required: true,
          description: "The execution_epoch talonic_compliance_claim_task returned.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-submit-task",
      text: "talonic_compliance_submit_task",
    },
    {
      type: "paragraph",
      text: "Submit the answer to a claimed task. It is checked against the package's output_schema and stored exactly like a verdict Talonic makes itself.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "task_id",
          type: "UUID",
          required: true,
          description: "Id from the matching list tool.",
        },
        {
          name: "execution_epoch",
          type: "integer",
          required: true,
          description: "The execution_epoch talonic_compliance_claim_task returned.",
        },
        {
          name: "answer",
          type: "object",
          required: true,
          description: "The answer, matching the package's output_schema.",
        },
      ],
    },
    // App-workflow tools (src/tools/app-workflows.ts, group "compliance").
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-get-framework",
      text: "talonic_compliance_get_framework",
    },
    {
      type: "paragraph",
      text: "One framework with its reading state, ON/OFF and its rules. USE WHEN: before editing its rules. NOT FOR: all frameworks (the frameworks list).",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_id",
          type: "UUID",
          required: true,
          description: "document id",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-reread-framework",
      text: "talonic_compliance_reread_framework",
    },
    {
      type: "paragraph",
      text: "Read the framework's rules again from its document; the rules are replaced when the reading finishes. USE WHEN: the document changed or the rules were read wrongly. NOT FOR: editing one rule (talonic_compliance_update_rule).",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_id",
          type: "UUID",
          required: true,
          description: "document id",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-add-rule",
      text: "talonic_compliance_add_rule",
    },
    {
      type: "paragraph",
      text: "Add a rule written by a person to a framework. USE WHEN: a rule is missing. NOT FOR: changing a rule (talonic_compliance_update_rule).",
    },
    {
      type: "param-table",
      params: [
        {
          name: "document_id",
          type: "UUID",
          required: true,
          description: "document id",
        },
        {
          name: "text",
          type: "string",
          required: true,
          description: "text",
        },
        {
          name: "obligation",
          type: "string",
          required: false,
          description: "How binding the rule is.",
        },
        {
          name: "section",
          type: "string",
          required: false,
          description: "section",
        },
        {
          name: "applies_to",
          type: "string",
          required: false,
          description: "applies to",
        },
        {
          name: "condition",
          type: "string",
          required: false,
          description: "condition",
        },
        {
          name: "threshold",
          type: "string",
          required: false,
          description: "threshold",
        },
        {
          name: "testable",
          type: "boolean",
          required: false,
          description: "testable",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-update-rule",
      text: "talonic_compliance_update_rule",
    },
    {
      type: "paragraph",
      text: "Edit one rule; only the fields sent change. USE WHEN: a rule reads wrongly. NOT FOR: removing it (talonic_compliance_delete_rule).",
    },
    {
      type: "param-table",
      params: [
        {
          name: "rule_id",
          type: "UUID",
          required: true,
          description: "rule id",
        },
        {
          name: "text",
          type: "string",
          required: false,
          description: "text",
        },
        {
          name: "obligation",
          type: "string",
          required: false,
          description: "How binding the rule is.",
        },
        {
          name: "section",
          type: "string",
          required: false,
          description: "section",
        },
        {
          name: "applies_to",
          type: "string",
          required: false,
          description: "applies to",
        },
        {
          name: "condition",
          type: "string",
          required: false,
          description: "condition",
        },
        {
          name: "threshold",
          type: "string",
          required: false,
          description: "threshold",
        },
        {
          name: "testable",
          type: "boolean",
          required: false,
          description: "testable",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-compliance-delete-rule",
      text: "talonic_compliance_delete_rule",
    },
    {
      type: "paragraph",
      text: "Take one rule out of its framework. USE WHEN: the rule does not belong. NOT FOR: switching a whole framework off.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "rule_id",
          type: "UUID",
          required: true,
          description: "rule id",
        },
      ],
    },
  ],
  related: [],
  faq: [],
  mentions: [],
}
