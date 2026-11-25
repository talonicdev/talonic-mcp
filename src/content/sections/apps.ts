import type { RawSection } from "../types"

// The Apps tools (src/tools/apps-toolset.ts) and the rule-finding round
// tools (src/tools/mining-driver.ts). Rendered at talonic.com/docs/mcp/<slug>;
// docs/sections.json keeps a mirror (`mcp-<slug>`). Listed only when the
// credential can read the workspace's apps; every page says so.

export const sections: RawSection[] = [
  {
    slug: "talonic-create-app",
    parentSlug: "tools",
    title: "talonic_create_app",
    seoTitle: "talonic_create_app — Create app | Talonic MCP Tool",
    description:
      "Create a new app. It starts disabled with no versions; the slug can no longer change once a version is published. Part of the Talonic MCP tools for building…",
    content: [
      {
        type: "paragraph",
        text: "Create a new app. It starts disabled with no versions; the slug can no longer change once a version is published. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: the user asks to set up a new app. ARGS: slug (lowercase letters, digits, hyphens, 3-64 chars), display_name, mode, optional one-sentence description.",
          "Modes: rules (decides from written rules), assisted (rules with people confirming), external (an outside agent decides through the decision-task tools), autonomous (finds candidate rules in the app's data).",
          "RETURNS: the manifest; use its `id` (UUID) with every other app tool.",
          "FLOW: talonic_create_app -> talonic_save_app_draft -> talonic_interpret_app_rules -> talonic_publish_app -> talonic_run_app (dry_run first) -> talonic_get_app_run / talonic_get_run_verdicts -> talonic_save_app_acceptance + talonic_check_app_acceptance -> talonic_enable_app.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "slug",
            type: "string",
            required: true,
            description: "Lowercase letters, digits and hyphens, 3-64 chars.",
          },
          {
            name: "display_name",
            type: "string",
            required: true,
            description: "",
          },
          {
            name: "mode",
            type: '"rules" | "assisted" | "external" | "autonomous"',
            required: true,
            description: "",
          },
          {
            name: "description",
            type: "string",
            required: false,
            description: "One sentence about the app.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_get_app",
        slug: "talonic-get-app",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-get-app",
    parentSlug: "tools",
    title: "talonic_get_app",
    seoTitle: "talonic_get_app — Get app | Talonic MCP Server Tool",
    description:
      "Read one app's manifest: mode, active version, enabled state, contract (what it reads and acts on), output contract, thresholds, triggers, fallback. Part of…",
    content: [
      {
        type: "paragraph",
        text: "Read one app's manifest: mode, active version, enabled state, contract (what it reads and acts on), output contract, thresholds, triggers, fallback. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: inspecting an app before changing or running it. NOT FOR: the editable draft (talonic_get_app_logic) or listing apps (talonic_list_apps).",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_create_app",
        slug: "talonic-create-app",
      },
      {
        label: "talonic_get_app_logic",
        slug: "talonic-get-app-logic",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-get-app-logic",
    parentSlug: "tools",
    title: "talonic_get_app_logic",
    seoTitle: "talonic_get_app_logic — Get app logic | Talonic MCP",
    description:
      "Read an app's logic: the editable draft and the active published version, including each rule with its interpretation state and plain-language readback. Part…",
    content: [
      {
        type: "paragraph",
        text: "Read an app's logic: the editable draft and the active published version, including each rule with its interpretation state and plain-language readback. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: before editing, or to get the draft's full content for talonic_save_app_draft.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_get_app",
        slug: "talonic-get-app",
      },
      {
        label: "talonic_get_app_fields",
        slug: "talonic-get-app-fields",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-get-app-fields",
    parentSlug: "tools",
    title: "talonic_get_app_fields",
    seoTitle: "talonic_get_app_fields — Get app fields | Talonic MCP",
    description:
      "List the fields the app's rules can use, per bound data source. This is everything the app can see. Part of the Talonic MCP tools for building, running and…",
    content: [
      {
        type: "paragraph",
        text: "List the fields the app's rules can use, per bound data source. This is everything the app can see. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: ["USE WHEN: before writing or fixing rules, so they name fields that exist."],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_get_app_logic",
        slug: "talonic-get-app-logic",
      },
      {
        label: "talonic_save_app_draft",
        slug: "talonic-save-app-draft",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-save-app-draft",
    parentSlug: "tools",
    title: "talonic_save_app_draft",
    seoTitle: "talonic_save_app_draft — Save app draft | Talonic MCP",
    description:
      "Create or replace the app's single draft version: logic (rule sentences, or the external connection), input bindings, output contract (JSON Schema 2020-12)…",
    content: [
      {
        type: "paragraph",
        text: "Create or replace the app's single draft version: logic (rule sentences, or the external connection), input bindings, output contract (JSON Schema 2020-12), thresholds, triggers, fallback. Drafts are the only versions that can change. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: authoring configuration in full. For a plain-language change to an existing draft prefer talonic_propose_app_edit + talonic_apply_app_edit.",
          "ARGS: app_id, content (the full version content object; read the current one with talonic_get_app_logic). RETURNS: { version, status, content_hash }; pass version to talonic_publish_app.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
          {
            name: "content",
            type: "object",
            required: true,
            description: "Full version content object.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_get_app_fields",
        slug: "talonic-get-app-fields",
      },
      {
        label: "talonic_interpret_app_rules",
        slug: "talonic-interpret-app-rules",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-interpret-app-rules",
    parentSlug: "tools",
    title: "talonic_interpret_app_rules",
    seoTitle: "talonic_interpret_app_rules — Interpret app rules | Talonic",
    description:
      "Turn the draft's pending rule sentences into checkable rules against the app's fields, and save the draft. A Talonic MCP tool for building and running apps.",
    content: [
      {
        type: "paragraph",
        text: "Turn the draft's pending rule sentences into checkable rules against the app's fields, and save the draft. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "ARGS: app_id; optional card_ids (default: all pending), guidance (plain language, e.g. 'the city is in shipper_city_state') for rules that stayed pending, locale for the readbacks.",
          "RETURNS: the rules plus warnings saying why any rule stayed pending.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
          {
            name: "card_ids",
            type: "array",
            required: false,
            description: "Rule card ids; omit for all pending.",
          },
          {
            name: "guidance",
            type: "string",
            required: false,
            description: "Plain-language hint for stuck rules.",
          },
          {
            name: "locale",
            type: "string",
            required: false,
            description: "Language of reasons and readbacks, e.g. de.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_save_app_draft",
        slug: "talonic-save-app-draft",
      },
      {
        label: "talonic_propose_app_edit",
        slug: "talonic-propose-app-edit",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-propose-app-edit",
    parentSlug: "tools",
    title: "talonic_propose_app_edit",
    seoTitle: "talonic_propose_app_edit — Propose app edit | Talonic MCP",
    description:
      "Turn a plain-language change request into typed edit operations on the app's rules (add, rewrite, delete, pause, resume, fallback, mode). Nothing is saved…",
    content: [
      {
        type: "paragraph",
        text: "Turn a plain-language change request into typed edit operations on the app's rules (add, rewrite, delete, pause, resume, fallback, mode). Nothing is saved. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: the user describes a change in words. Show the summary to the user, then apply the accepted ops with talonic_apply_app_edit.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
          {
            name: "instruction",
            type: "string",
            required: true,
            description: "The change, in plain language.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_interpret_app_rules",
        slug: "talonic-interpret-app-rules",
      },
      {
        label: "talonic_apply_app_edit",
        slug: "talonic-apply-app-edit",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-apply-app-edit",
    parentSlug: "tools",
    title: "talonic_apply_app_edit",
    seoTitle: "talonic_apply_app_edit — Apply app edit | Talonic MCP",
    description:
      "Apply accepted edit operations from talonic_propose_app_edit to the draft. They are re-checked against the current draft; changed rules are interpreted again…",
    content: [
      {
        type: "paragraph",
        text: "Apply accepted edit operations from talonic_propose_app_edit to the draft. They are re-checked against the current draft; changed rules are interpreted again and warnings returned. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: ["ARGS: app_id, ops (from the proposal, unchanged)."],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
          {
            name: "ops",
            type: "array",
            required: true,
            description: "Accepted ops from the proposal.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_propose_app_edit",
        slug: "talonic-propose-app-edit",
      },
      {
        label: "talonic_list_app_versions",
        slug: "talonic-list-app-versions",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-list-app-versions",
    parentSlug: "tools",
    title: "talonic_list_app_versions",
    seoTitle: "talonic_list_app_versions — List app versions | Talonic MCP",
    description:
      "List an app's versions, newest first: version number, status (draft, published, superseded), content hash, published_at. Part of the Talonic MCP tools for…",
    content: [
      {
        type: "paragraph",
        text: "List an app's versions, newest first: version number, status (draft, published, superseded), content hash, published_at. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: you need the draft's version number for talonic_publish_app, or to see what is live.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_apply_app_edit",
        slug: "talonic-apply-app-edit",
      },
      {
        label: "talonic_publish_app",
        slug: "talonic-publish-app",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-publish-app",
    parentSlug: "tools",
    title: "talonic_publish_app",
    seoTitle: "talonic_publish_app — Publish app | Talonic MCP Tool",
    description:
      "Publish the app's draft: freezes it, makes it the active version (the previous one is superseded) and locks the slug on first publish. Talonic MCP tool.",
    content: [
      {
        type: "paragraph",
        text: "Publish the app's draft: freezes it, makes it the active version (the previous one is superseded) and locks the slug on first publish. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: the draft is tested (talonic_run_app with dry_run, talonic_check_app_acceptance) and the user wants it live. Publishing does not enable the app; call talonic_enable_app for triggers to fire.",
          "ARGS: app_id and the draft's version number (from talonic_save_app_draft or talonic_list_app_versions). A number that is not the current draft is HTTP 409.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
          {
            name: "version",
            type: "integer",
            required: true,
            description: "The draft's version number.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_list_app_versions",
        slug: "talonic-list-app-versions",
      },
      {
        label: "talonic_enable_app",
        slug: "talonic-enable-app",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-enable-app",
    parentSlug: "tools",
    title: "talonic_enable_app",
    seoTitle: "talonic_enable_app — Enable app | Talonic MCP Tool",
    description:
      "Enable an app so its triggers fire and it can be run. Needs a published version. Enabling an app that acts on outside systems needs a workspace owner (HTTP…",
    content: [
      {
        type: "paragraph",
        text: "Enable an app so its triggers fire and it can be run. Needs a published version. Enabling an app that acts on outside systems needs a workspace owner (HTTP 403 otherwise). Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: ["USE WHEN: the user asks to switch the app on. ARGS: app_id."],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_publish_app",
        slug: "talonic-publish-app",
      },
      {
        label: "talonic_disable_app",
        slug: "talonic-disable-app",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-disable-app",
    parentSlug: "tools",
    title: "talonic_disable_app",
    seoTitle: "talonic_disable_app — Disable app | Talonic MCP Tool",
    description:
      "Disable an app at once (the kill switch): triggers stop and open work is no longer offered. Past runs and records are kept. A Talonic MCP tool for apps.",
    content: [
      {
        type: "paragraph",
        text: "Disable an app at once (the kill switch): triggers stop and open work is no longer offered. Past runs and records are kept. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: ["USE WHEN: the user asks to stop or pause an app. ARGS: app_id."],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_enable_app",
        slug: "talonic-enable-app",
      },
      {
        label: "talonic_get_app_acceptance",
        slug: "talonic-get-app-acceptance",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-get-app-acceptance",
    parentSlug: "tools",
    title: "talonic_get_app_acceptance",
    seoTitle: "talonic_get_app_acceptance — Get app acceptance | Talonic MC",
    description:
      "Read the app's acceptance set: the labeled expected results a correct run must reproduce, and the accepted mismatch share. null when none is saved. Part of…",
    content: [
      {
        type: "paragraph",
        text: "Read the app's acceptance set: the labeled expected results a correct run must reproduce, and the accepted mismatch share. null when none is saved. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_disable_app",
        slug: "talonic-disable-app",
      },
      {
        label: "talonic_save_app_acceptance",
        slug: "talonic-save-app-acceptance",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-save-app-acceptance",
    parentSlug: "tools",
    title: "talonic_save_app_acceptance",
    seoTitle: "talonic_save_app_acceptance — Save app acceptance | Talonic",
    description:
      "Replace the app's acceptance set: the expected results a correct run must reproduce, plus tolerance (accepted mismatch share, 0 to 1). This is the app's…",
    content: [
      {
        type: "paragraph",
        text: "Replace the app's acceptance set: the expected results a correct run must reproduce, plus tolerance (accepted mismatch share, 0 to 1). This is the app's definition of done. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "ARGS: app_id, cases (per subject: subject_key + expected_outcome and/or expected_auto; for single-decision apps: expected_decision), optional tolerance (default 0).",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
          {
            name: "cases",
            type: "array",
            required: true,
            description: "",
          },
          {
            name: "tolerance",
            type: "number",
            required: false,
            description: "Accepted mismatch share (default 0).",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_get_app_acceptance",
        slug: "talonic-get-app-acceptance",
      },
      {
        label: "talonic_check_app_acceptance",
        slug: "talonic-check-app-acceptance",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-check-app-acceptance",
    parentSlug: "tools",
    title: "talonic_check_app_acceptance",
    seoTitle: "talonic_check_app_acceptance — Check app acceptance",
    description:
      "Score a run against the app's acceptance set by comparing recorded results: the same run always gets the same score. Returns score, pass/fail and each…",
    content: [
      {
        type: "paragraph",
        text: "Score a run against the app's acceptance set by comparing recorded results: the same run always gets the same score. Returns score, pass/fail and each mismatch. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: after talonic_run_app, to decide whether the app is ready to publish or still correct. ARGS: app_id, optional run_id (default: the latest completed run).",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
          {
            name: "run_id",
            type: "string",
            required: false,
            description: "Run to score; default the latest completed run.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_save_app_acceptance",
        slug: "talonic-save-app-acceptance",
      },
      {
        label: "talonic_run_app",
        slug: "talonic-run-app",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-run-app",
    parentSlug: "tools",
    title: "talonic_run_app",
    seoTitle: "talonic_run_app — Run app | Talonic MCP Server Tool",
    description:
      "Start one run of an app's active version and return it. A rules app usually finishes in the call with its decision; an external app stops at awaiting_decision…",
    content: [
      {
        type: "paragraph",
        text: "Start one run of an app's active version and return it. A rules app usually finishes in the call with its decision; an external app stops at awaiting_decision until its decision task is submitted. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: testing or executing an app. Set dry_run:true first: a full trace with no side effects (no actions, no webhooks to outside systems).",
          "ARGS: app_id, optional input object, dry_run, idempotency_key (reusing a key returns the existing run instead of starting another). Consumes credits.",
          "NEXT: talonic_get_app_run for status and decision; talonic_get_run_verdicts for per-subject results.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
          {
            name: "input",
            type: "object",
            required: false,
            description: "Run input, checked against the app's input schema.",
          },
          {
            name: "dry_run",
            type: "boolean",
            required: false,
            description: "Full trace, no side effects.",
          },
          {
            name: "idempotency_key",
            type: "string",
            required: false,
            description: "",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_check_app_acceptance",
        slug: "talonic-check-app-acceptance",
      },
      {
        label: "talonic_list_app_runs",
        slug: "talonic-list-app-runs",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-list-app-runs",
    parentSlug: "tools",
    title: "talonic_list_app_runs",
    seoTitle: "talonic_list_app_runs — List app runs | Talonic MCP",
    description:
      "List an app's runs, newest first, with status, decision and who decided; `total` counts every run. Part of the Talonic MCP tools for building, running and…",
    content: [
      {
        type: "paragraph",
        text: "List an app's runs, newest first, with status, decision and who decided; `total` counts every run. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: ["ARGS: app_id, optional limit (max 200) and offset."],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "Page size (default 50, max 200).",
          },
          {
            name: "offset",
            type: "integer",
            required: false,
            description: "Rows to skip before the page.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_run_app",
        slug: "talonic-run-app",
      },
      {
        label: "talonic_get_app_run",
        slug: "talonic-get-app-run",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-get-app-run",
    parentSlug: "tools",
    title: "talonic_get_app_run",
    seoTitle: "talonic_get_app_run — Get app run | Talonic MCP Tool",
    description:
      "Read one run: status, decision, decided_by, thresholds applied, reviews raised, timing. Part of the Talonic MCP tools for building, running and reviewing…",
    content: [
      {
        type: "paragraph",
        text: "Read one run: status, decision, decided_by, thresholds applied, reviews raised, timing. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: checking a run you started or found. include_events:true adds the run's journal (every event in order).",
          "NOT FOR: Spec/pipeline runs (talonic_get_run). ARGS: run_id, optional include_events.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "run_id",
            type: "string",
            required: true,
            description: "App run UUID (run_id from talonic_run_app or talonic_list_app_runs).",
          },
          {
            name: "include_events",
            type: "boolean",
            required: false,
            description: "",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_list_app_runs",
        slug: "talonic-list-app-runs",
      },
      {
        label: "talonic_get_run_record",
        slug: "talonic-get-run-record",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-get-run-record",
    parentSlug: "tools",
    title: "talonic_get_run_record",
    seoTitle: "talonic_get_run_record — Get run record | Talonic MCP",
    description:
      "Export a finished run's sealed decision record: the immutable, audit-ready result with its decision, who decided (rules, a person or an outside agent) and the…",
    content: [
      {
        type: "paragraph",
        text: "Export a finished run's sealed decision record: the immutable, audit-ready result with its decision, who decided (rules, a person or an outside agent) and the evidence. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: the user needs the final, auditable outcome. A run that has not finished has no record yet (HTTP 404). ARGS: run_id.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "run_id",
            type: "string",
            required: true,
            description: "App run UUID (run_id from talonic_run_app or talonic_list_app_runs).",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_get_app_run",
        slug: "talonic-get-app-run",
      },
      {
        label: "talonic_get_run_verdicts",
        slug: "talonic-get-run-verdicts",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-get-run-verdicts",
    parentSlug: "tools",
    title: "talonic_get_run_verdicts",
    seoTitle: "talonic_get_run_verdicts — Get run verdicts | Talonic MCP",
    description:
      "Read a batch run's per-subject results: a summary plus one row per subject with its overall outcome, the auto flag, and each rule's outcome with reasons and…",
    content: [
      {
        type: "paragraph",
        text: "Read a batch run's per-subject results: a summary plus one row per subject with its overall outcome, the auto flag, and each rule's outcome with reasons and evidence. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: inspecting what a run decided per record. Single-decision runs have none (HTTP 404; use talonic_get_app_run).",
          "ARGS: run_id; optional rolled (overall outcome), auto, rule + status (always together), limit (max 200), cursor (from `next`).",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "run_id",
            type: "string",
            required: true,
            description: "App run UUID (run_id from talonic_run_app or talonic_list_app_runs).",
          },
          {
            name: "rolled",
            type: '"passed" | "failed" | "indeterminate" | "not_applicable"',
            required: false,
            description: "Filter by overall outcome.",
          },
          {
            name: "auto",
            type: "boolean",
            required: false,
            description: "Filter by the auto flag.",
          },
          {
            name: "rule",
            type: "string",
            required: false,
            description: "Rule id; needs status.",
          },
          {
            name: "status",
            type: '"passed" | "failed" | "indeterminate" | "not_applicable"',
            required: false,
            description: "That rule's outcome; needs rule.",
          },
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "Page size (default 50, max 200).",
          },
          {
            name: "cursor",
            type: "string",
            required: false,
            description: "`next` from the previous page.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_get_run_record",
        slug: "talonic-get-run-record",
      },
      {
        label: "talonic_list_app_reviews",
        slug: "talonic-list-app-reviews",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-list-app-reviews",
    parentSlug: "tools",
    title: "talonic_list_app_reviews",
    seoTitle: "talonic_list_app_reviews — List app reviews | Talonic MCP",
    description:
      "List Human Reviews: questions apps raised for a person (approvals, missing data, judgment calls, exceptions), newest first, with `total`. Talonic MCP tool.",
    content: [
      {
        type: "paragraph",
        text: "List Human Reviews: questions apps raised for a person (approvals, missing data, judgment calls, exceptions), newest first, with `total`. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: finding open reviews to answer, or checking the result of one already resolved (status 'resolved' shows its values). Omit app_id for the whole workspace.",
          "ARGS: optional app_id, status, kind, assignee_user_id, limit (max 200), offset.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: false,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
          {
            name: "status",
            type: '"open" | "assigned" | "resolved" | "expired" | "cancelled"',
            required: false,
            description: "",
          },
          {
            name: "kind",
            type: '"resolution" | "approval" | "data_request" | "judgment"',
            required: false,
            description: "",
          },
          {
            name: "assignee_user_id",
            type: "string",
            required: false,
            description: "Only reviews assigned to this user.",
          },
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "Page size (default 50, max 200).",
          },
          {
            name: "offset",
            type: "integer",
            required: false,
            description: "Rows to skip before the page.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_get_run_verdicts",
        slug: "talonic-get-run-verdicts",
      },
      {
        label: "talonic_raise_app_review",
        slug: "talonic-raise-app-review",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-raise-app-review",
    parentSlug: "tools",
    title: "talonic_raise_app_review",
    seoTitle: "talonic_raise_app_review — Raise app review | Talonic MCP",
    description:
      "Ask a person a question on an app instead of guessing: a Human Review with a JSON Schema for the answer. A Talonic MCP tool for building and running apps.",
    content: [
      {
        type: "paragraph",
        text: "Ask a person a question on an app instead of guessing: a Human Review with a JSON Schema for the answer. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: a decision needs a person's input. ARGS: app_id, kind (resolution | approval | data_request | judgment), question, input_contract (JSON Schema the answer must satisfy), optional run_id, context, team_id.",
          "NEXT: the answer arrives through talonic_resolve_app_review (or the web app); read it with talonic_list_app_reviews status 'resolved'.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
          {
            name: "run_id",
            type: "string",
            required: false,
            description: "App run UUID (run_id from talonic_run_app or talonic_list_app_runs).",
          },
          {
            name: "kind",
            type: '"resolution" | "approval" | "data_request" | "judgment"',
            required: true,
            description: "",
          },
          {
            name: "question",
            type: "string",
            required: true,
            description: "",
          },
          {
            name: "context",
            type: "object",
            required: false,
            description: "",
          },
          {
            name: "input_contract",
            type: "object",
            required: true,
            description: "JSON Schema the answer must satisfy.",
          },
          {
            name: "team_id",
            type: "string",
            required: false,
            description: "Review team to assign.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_list_app_reviews",
        slug: "talonic-list-app-reviews",
      },
      {
        label: "talonic_resolve_app_review",
        slug: "talonic-resolve-app-review",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-resolve-app-review",
    parentSlug: "tools",
    title: "talonic_resolve_app_review",
    seoTitle: "talonic_resolve_app_review — Resolve app review | Talonic MC",
    description:
      "Answer a Human Review: values (validated against the review's input_contract) plus optional feedback that teaches the app (proposal_verdict correct |…",
    content: [
      {
        type: "paragraph",
        text: "Answer a Human Review: values (validated against the review's input_contract) plus optional feedback that teaches the app (proposal_verdict correct | incorrect | partial, correction, generalize). Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: the user gives the answer. 'approval' reviews accept only a person's answer; an API key or agent is refused (HTTP 403). Needs operate access on the app.",
          "RETURNS: the resolved review with its values. ARGS: review_id, values, optional feedback.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "review_id",
            type: "string",
            required: true,
            description: "Human Review UUID (id from talonic_list_app_reviews).",
          },
          {
            name: "values",
            type: "object",
            required: true,
            description: "Answer values matching the review's input_contract.",
          },
          {
            name: "feedback",
            type: "object",
            required: false,
            description: "Optional feedback that teaches the app.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_raise_app_review",
        slug: "talonic-raise-app-review",
      },
      {
        label: "talonic_interview_app_review",
        slug: "talonic-interview-app-review",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-interview-app-review",
    parentSlug: "tools",
    title: "talonic_interview_app_review",
    seoTitle: "talonic_interview_app_review — Interview app review",
    description:
      "Hold one turn of a guided conversation on an open Human Review: send the reviewer's message and the earlier turns (the server keeps no state); get back a…",
    content: [
      {
        type: "paragraph",
        text: "Hold one turn of a guided conversation on an open Human Review: send the reviewer's message and the earlier turns (the server keeps no state); get back a follow-up question or a readback with proposed answer values. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "ready:true only when the proposed values satisfy the review's input contract. Nothing is submitted: finish with talonic_resolve_app_review.",
          "ARGS: review_id, message, optional transcript [{ role: user | assistant, text }].",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "review_id",
            type: "string",
            required: true,
            description: "Human Review UUID (id from talonic_list_app_reviews).",
          },
          {
            name: "message",
            type: "string",
            required: true,
            description: "The reviewer's message for this turn.",
          },
          {
            name: "transcript",
            type: "array",
            required: false,
            description: "Earlier turns, oldest first.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_resolve_app_review",
        slug: "talonic-resolve-app-review",
      },
      {
        label: "talonic_list_app_precedents",
        slug: "talonic-list-app-precedents",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-list-app-precedents",
    parentSlug: "tools",
    title: "talonic_list_app_precedents",
    seoTitle: "talonic_list_app_precedents — List app precedents | Talonic",
    description:
      "List an app's precedents: past resolved reviews it reuses for similar future runs. Part of the Talonic MCP tools for apps, listed when your key can read apps.",
    content: [
      {
        type: "paragraph",
        text: "List an app's precedents: past resolved reviews it reuses for similar future runs. Listed only when the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "ARGS: app_id, optional similar_to (match keys object) to narrow to similar cases. An app with none returns an empty list.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "App id: the UUID `id` from talonic_list_apps or talonic_create_app (not the app_… public id).",
          },
          {
            name: "similar_to",
            type: "object",
            required: false,
            description: "Match keys of the case.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_interview_app_review",
        slug: "talonic-interview-app-review",
      },
      {
        label: "talonic_mining_list_rounds",
        slug: "talonic-mining-list-rounds",
      },
    ],
    mentions: ["app", "Human Review", "app run"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read the workspace's apps. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-mining-list-rounds",
    parentSlug: "tools",
    title: "talonic_mining_list_rounds",
    seoTitle: "talonic_mining_list_rounds — Mining list rounds | Talonic MC",
    description:
      "List an autonomous app's rule-finding rounds, newest first: phase, status, what each found, and for a round waiting for an outside driver its task state…",
    content: [
      {
        type: "paragraph",
        text: "List an autonomous app's rule-finding rounds, newest first: phase, status, what each found, and for a round waiting for an outside driver its task state (claimed by whom, lease, deadline). `total` counts every round. Listed only when the workspace has an autonomous app. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: finding a round to drive or checking progress. ARGS: app_id, optional limit (max 200), offset.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "Id (UUID) of an autonomous app, from talonic_list_apps where mode is 'autonomous'.",
          },
          {
            name: "limit",
            type: "integer",
            required: false,
            description: "",
          },
          {
            name: "offset",
            type: "integer",
            required: false,
            description: "",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_list_app_precedents",
        slug: "talonic-list-app-precedents",
      },
      {
        label: "talonic_mining_get_round",
        slug: "talonic-mining-get-round",
      },
    ],
    mentions: ["rule finding", "mining round"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read a workspace app that finds rules in its data. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-mining-get-round",
    parentSlug: "tools",
    title: "talonic_mining_get_round",
    seoTitle: "talonic_mining_get_round — Mining get round | Talonic MCP",
    description:
      "Read one rule-finding round: phase, status, budget, findings, candidate rules, summary, and the driver block for an externally driven round. Talonic MCP tool.",
    content: [
      {
        type: "paragraph",
        text: "Read one rule-finding round: phase, status, budget, findings, candidate rules, summary, and the driver block for an externally driven round. Listed only when the workspace has an autonomous app. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: ["ARGS: app_id, run_id."],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "Id (UUID) of an autonomous app, from talonic_list_apps where mode is 'autonomous'.",
          },
          {
            name: "run_id",
            type: "string",
            required: true,
            description:
              "The round's run id (run_id from talonic_mining_list_rounds, or the decision task's run_id).",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_mining_list_rounds",
        slug: "talonic-mining-list-rounds",
      },
      {
        label: "talonic_mining_start_round",
        slug: "talonic-mining-start-round",
      },
      {
        label: "talonic_claim_decision_task",
        slug: "talonic-claim-decision-task",
      },
    ],
    mentions: ["rule finding", "mining round"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read a workspace app that finds rules in its data. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-mining-start-round",
    parentSlug: "tools",
    title: "talonic_mining_start_round",
    seoTitle: "talonic_mining_start_round — Mining start round | Talonic MC",
    description:
      "Start a rule-finding round on an autonomous app. Without phase the app's plan picks the next one; reconcile reviews rules whose candidates lapsed (needs…",
    content: [
      {
        type: "paragraph",
        text: "Start a rule-finding round on an autonomous app. Without phase the app's plan picks the next one; reconcile reviews rules whose candidates lapsed (needs configure access). dry_run re-grades without searching. Listed only when the workspace has an autonomous app. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: the user asks to look for new rules now. Only one externally driven round per app can be open (HTTP 409 with the open task otherwise).",
          "RETURNS: { run_id, status, phase, … }. A round with an outside driver then waits for a claim: see talonic_list_decision_tasks.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "Id (UUID) of an autonomous app, from talonic_list_apps where mode is 'autonomous'.",
          },
          {
            name: "phase",
            type: '"discovery" | "hypothesis" | "reconcile"',
            required: false,
            description: "",
          },
          {
            name: "dry_run",
            type: "boolean",
            required: false,
            description: "",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_mining_get_round",
        slug: "talonic-mining-get-round",
      },
      {
        label: "talonic_mining_list_round_tools",
        slug: "talonic-mining-list-round-tools",
      },
      {
        label: "talonic_claim_decision_task",
        slug: "talonic-claim-decision-task",
      },
    ],
    mentions: ["rule finding", "mining round"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read a workspace app that finds rules in its data. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-mining-list-round-tools",
    parentSlug: "tools",
    title: "talonic_mining_list_round_tools",
    seoTitle: "talonic_mining_list_round_tools — Mining list round tools",
    description:
      "List the tools you may call on a round you hold the claim on, with their inputs, the round's remaining budget and the retry rule for a busy round. Part of the…",
    content: [
      {
        type: "paragraph",
        text: "List the tools you may call on a round you hold the claim on, with their inputs, the round's remaining budget and the retry rule for a busy round. Listed only when the workspace has an autonomous app. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "USE WHEN: right after claiming the round's decision task, or to check remaining budget.",
          "FLOW for a round waiting for an outside driver: talonic_list_decision_tasks (the app's tasks) -> talonic_claim_decision_task (keep execution_epoch) -> talonic_read_decision_package (the round's brief and tools) -> talonic_mining_list_round_tools -> talonic_mining_call_round_tool, repeatedly, with talonic_heartbeat_decision_task before the lease ends -> talonic_submit_decision_task with outcome { summary, protocol_feedback }, evidence [] and a one-line rationale.",
          "AUTH: a tlnc_ key needs a per-app 'decide' grant (plus 'read' for the round reads); an OAuth connector session needs the apps:decide scope and a live workspace role of senior_member or above. A 403 names what is missing: tell the user, do not retry.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "Id (UUID) of an autonomous app, from talonic_list_apps where mode is 'autonomous'.",
          },
          {
            name: "run_id",
            type: "string",
            required: true,
            description:
              "The round's run id (run_id from talonic_mining_list_rounds, or the decision task's run_id).",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_mining_start_round",
        slug: "talonic-mining-start-round",
      },
      {
        label: "talonic_mining_call_round_tool",
        slug: "talonic-mining-call-round-tool",
      },
      {
        label: "talonic_claim_decision_task",
        slug: "talonic-claim-decision-task",
      },
    ],
    mentions: ["rule finding", "mining round"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read a workspace app that finds rules in its data. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-mining-call-round-tool",
    parentSlug: "tools",
    title: "talonic_mining_call_round_tool",
    seoTitle: "talonic_mining_call_round_tool — Mining call round tool",
    description:
      "Call one round tool by name with its input, as the current claimant. The call runs under the app's grants and the round's budgets; a tool's own error comes…",
    content: [
      {
        type: "paragraph",
        text: "Call one round tool by name with its input, as the current claimant. The call runs under the app's grants and the round's budgets; a tool's own error comes back as is_error:true with a reason, not as a failure of this call. Listed only when the workspace has an autonomous app. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Busy rounds are retried for you. A call that runs long is polled for up to wait_seconds (default 25, max 120); if it is still running you get its call_id: poll talonic_mining_get_round_tool_call.",
          "Do not call tools on one round in parallel. close_round is not a tool here: close the round with talonic_submit_decision_task.",
          "ARGS: app_id, run_id, execution_epoch, name, input (object, default {}), optional wait_seconds. A stale or foreign claim or an expired lease is HTTP 409: claim again.",
          "AUTH: a tlnc_ key needs a per-app 'decide' grant (plus 'read' for the round reads); an OAuth connector session needs the apps:decide scope and a live workspace role of senior_member or above. A 403 names what is missing: tell the user, do not retry.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "Id (UUID) of an autonomous app, from talonic_list_apps where mode is 'autonomous'.",
          },
          {
            name: "run_id",
            type: "string",
            required: true,
            description:
              "The round's run id (run_id from talonic_mining_list_rounds, or the decision task's run_id).",
          },
          {
            name: "execution_epoch",
            type: "integer",
            required: true,
            description:
              "execution_epoch from talonic_claim_decision_task. A stale epoch is HTTP 409.",
          },
          {
            name: "name",
            type: "string",
            required: true,
            description: "A tool name from talonic_mining_list_round_tools.",
          },
          {
            name: "input",
            type: "object",
            required: false,
            description: "The tool's input object.",
          },
          {
            name: "wait_seconds",
            type: "integer",
            required: false,
            description: "Seconds to keep polling a long call (default 25).",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_mining_list_round_tools",
        slug: "talonic-mining-list-round-tools",
      },
      {
        label: "talonic_mining_get_round_tool_call",
        slug: "talonic-mining-get-round-tool-call",
      },
      {
        label: "talonic_claim_decision_task",
        slug: "talonic-claim-decision-task",
      },
    ],
    mentions: ["rule finding", "mining round"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read a workspace app that finds rules in its data. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
  {
    slug: "talonic-mining-get-round-tool-call",
    parentSlug: "tools",
    title: "talonic_mining_get_round_tool_call",
    seoTitle: "talonic_mining_get_round_tool_call — Mining get round tool…",
    description:
      "Read a round tool call that was still running: status running | done, and its content and is_error once done. Only the round's current claimant can read it…",
    content: [
      {
        type: "paragraph",
        text: "Read a round tool call that was still running: status running | done, and its content and is_error once done. Only the round's current claimant can read it. Listed only when the workspace has an autonomous app. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "ARGS: app_id, run_id, call_id, execution_epoch.",
          "AUTH: a tlnc_ key needs a per-app 'decide' grant (plus 'read' for the round reads); an OAuth connector session needs the apps:decide scope and a live workspace role of senior_member or above. A 403 names what is missing: tell the user, do not retry.",
        ],
      },
      {
        type: "param-table",
        title: "Parameters",
        params: [
          {
            name: "app_id",
            type: "string",
            required: true,
            description:
              "Id (UUID) of an autonomous app, from talonic_list_apps where mode is 'autonomous'.",
          },
          {
            name: "run_id",
            type: "string",
            required: true,
            description:
              "The round's run id (run_id from talonic_mining_list_rounds, or the decision task's run_id).",
          },
          {
            name: "call_id",
            type: "string",
            required: true,
            description: "call_id from talonic_mining_call_round_tool.",
          },
          {
            name: "execution_epoch",
            type: "integer",
            required: true,
            description:
              "execution_epoch from talonic_claim_decision_task. A stale epoch is HTTP 409.",
          },
        ],
      },
    ],
    related: [
      {
        label: "talonic_mining_call_round_tool",
        slug: "talonic-mining-call-round-tool",
      },
      {
        label: "talonic_claim_decision_task",
        slug: "talonic-claim-decision-task",
      },
    ],
    mentions: ["rule finding", "mining round"],
    faq: [
      {
        question: "When is this tool listed?",
        answer:
          "When the credential can read a workspace app that finds rules in its data. The platform checks the caller's role, per-app access and key scopes on every call.",
      },
    ],
  },
]
