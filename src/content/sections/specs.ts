import type { RawSection } from "../types"

// The Spec authoring tools (`talonic_spec_*`, src/tools/spec-authoring.ts).
// Rendered at talonic.com/docs/mcp/<slug>; docs/sections.json keeps a mirror
// (`mcp-<slug>`) that tests/content/tool-sections.test.ts holds in step.
// The tools are listed only when the platform serves Spec authoring to the
// credential (`GET /v1/specs/authoring`); every page says so.

export const sections: RawSection[] = [
  {
    slug: "talonic-spec-create",
    parentSlug: "tools",
    title: "talonic_spec_create",
    seoTitle: "talonic_spec_create — Create a Spec for Your Documents",
    description:
      "MCP tool that creates a Talonic Spec, the saved definition of what to capture, from a complete document, a Spec JSON export, an existing schema or as empty.",
    content: [
      {
        type: "paragraph",
        text: "Create a Spec: the fields to capture and the steps that produce them. Pass a complete `doc`, a Spec JSON export (`spec_json`), an existing schema (`schema_id`), or nothing for an empty draft. A new Spec is a draft; runs use it only after talonic_spec_publish. Listed only when the platform serves Spec authoring to the credential (`GET /v1/specs/authoring`); the platform checks the `specs:read` / `specs:write` scopes and the person's Spec editor permissions on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "name",
            type: "string",
            required: true,
            description: "Up to 300 characters.",
          },
          {
            name: "description",
            type: "string",
            required: false,
            description: "Optional.",
          },
          {
            name: "doc",
            type: "object",
            required: false,
            description: "A complete Spec document.",
          },
          {
            name: "spec_json",
            type: "object",
            required: false,
            description: "A Spec JSON export from the Spec editor.",
          },
          {
            name: "schema_id",
            type: "string",
            required: false,
            description: "An existing schema to turn into a Spec.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_spec_create({ "name": "Invoices", "doc": { "format": 1, "name": "Invoices", "fields": [{ "field_id": "f-total", "name": "total_amount", "data_type": "number" }], "stages": [{ "id": "s-source", "type": "source" }, { "id": "s-extract", "type": "extraction", "config": {} }, { "id": "s-deliver", "type": "deliver" }], "gates": [], "policies": [] } })\n{ "spec_id": "1111…", "revision": 1, "published_version": null, "has_unpublished_changes": true }',
      },
    ],
    related: [
      {
        label: "talonic_spec_check",
        slug: "talonic-spec-check",
      },
      {
        label: "talonic_spec_edit",
        slug: "talonic-spec-edit",
      },
      {
        label: "talonic_spec_test",
        slug: "talonic-spec-test",
      },
    ],
    faq: [
      {
        question: "Is a new Spec live?",
        answer: "No. It is a draft until talonic_spec_publish.",
      },
    ],
    mentions: ["Spec", "pipeline", "Spec authoring"],
  },
  {
    slug: "talonic-spec-edit",
    parentSlug: "tools",
    title: "talonic_spec_edit",
    seoTitle: "talonic_spec_edit — Read, Replace or Rename a Spec Draft",
    description:
      "MCP tool that reads a Talonic Spec draft, replaces it under its revision so no edit is lost, or renames the Spec. Runs keep using the published version.",
    content: [
      {
        type: "paragraph",
        text: "Read the draft (only `spec_id`), replace it (`doc` with the `revision` you read; a conflict means someone saved in between), or rename the Spec (`name`, `description`). Keep each field's `field_id` when you change a field. Saving never changes what runs. Listed only when the platform serves Spec authoring to the credential (`GET /v1/specs/authoring`); the platform checks the `specs:read` / `specs:write` scopes and the person's Spec editor permissions on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "spec_id",
            type: "string",
            required: true,
            description: "The Spec.",
          },
          {
            name: "doc",
            type: "object",
            required: false,
            description: "The complete new draft.",
          },
          {
            name: "revision",
            type: "integer",
            required: false,
            description: "The revision you read; required with doc.",
          },
          {
            name: "allow_field_reset",
            type: "boolean",
            required: false,
            description: "Confirm replacing most fields.",
          },
          {
            name: "name",
            type: "string",
            required: false,
            description: "New name.",
          },
          {
            name: "description",
            type: "string",
            required: false,
            description: "New description.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_spec_edit({ "spec_id": "1111…", "doc": { … }, "revision": 1 })\n{ "spec_id": "1111…", "revision": 2, "updated_at": "2026-11-25T10:00:00.000Z", "field_adoptions": {} }',
      },
    ],
    related: [
      {
        label: "talonic_spec_check",
        slug: "talonic-spec-check",
      },
      {
        label: "talonic_spec_create",
        slug: "talonic-spec-create",
      },
      {
        label: "talonic_spec_publish",
        slug: "talonic-spec-publish",
      },
    ],
    faq: [
      {
        question: "What if someone else saved first?",
        answer:
          "The call fails with a conflict and nothing changes. Read the draft again and re-apply the change.",
      },
    ],
    mentions: ["Spec", "pipeline", "Spec authoring"],
  },
  {
    slug: "talonic-spec-check",
    parentSlug: "tools",
    title: "talonic_spec_check",
    seoTitle: "talonic_spec_check — Check a Spec Draft Before You Publish",
    description:
      "MCP tool that checks a Talonic Spec draft, or a document before it is saved, and returns its errors and warnings so you can fix them first. It saves nothing.",
    content: [
      {
        type: "paragraph",
        text: "Check the draft, or `doc` before you save it. `valid` is false when there is an error; a draft with errors cannot be published. Free. Listed only when the platform serves Spec authoring to the credential (`GET /v1/specs/authoring`); the platform checks the `specs:read` / `specs:write` scopes and the person's Spec editor permissions on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "spec_id",
            type: "string",
            required: true,
            description: "The Spec.",
          },
          {
            name: "doc",
            type: "object",
            required: false,
            description: "A document to check instead of the draft.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_spec_check({ "spec_id": "1111…" })\n{ "valid": false, "errors": [{ "code": "SPEC2_DUPLICATE_FIELD_NAME", "message": "Two fields are named total_amount.", "path": "fields[3].name" }], "warnings": [] }',
      },
    ],
    related: [
      {
        label: "talonic_spec_edit",
        slug: "talonic-spec-edit",
      },
      {
        label: "talonic_spec_test",
        slug: "talonic-spec-test",
      },
    ],
    faq: [
      {
        question: "Does check cost credits?",
        answer: "No.",
      },
    ],
    mentions: ["Spec", "pipeline", "Spec authoring"],
  },
  {
    slug: "talonic-spec-test",
    parentSlug: "tools",
    title: "talonic_spec_test",
    seoTitle: "talonic_spec_test — Test a Spec Draft on Sample Documents",
    description:
      "MCP tool that tests a Talonic Spec draft on sample documents as a preview run that is never delivered, so you can read the resulting rows with evidence first.",
    content: [
      {
        type: "paragraph",
        text: "Run the draft on `document_ids`, or on the pinned samples, as a preview run that is never delivered to destinations. A draft with unpublished changes is published first, as in the Spec editor. Uses credits. Poll talonic_get_run and read rows with talonic_get_run_results. Listed only when the platform serves Spec authoring to the credential (`GET /v1/specs/authoring`); the platform checks the `specs:read` / `specs:write` scopes and the person's Spec editor permissions on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "spec_id",
            type: "string",
            required: true,
            description: "The Spec.",
          },
          {
            name: "document_ids",
            type: "string[]",
            required: false,
            description: "Up to 20 documents; default the pinned samples.",
          },
          {
            name: "pin",
            type: "boolean",
            required: false,
            description: "Also pin document_ids as samples.",
          },
          {
            name: "acknowledge_issues",
            type: "boolean",
            required: false,
            description: "Proceed over listed issues, after the user agreed.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_spec_test({ "spec_id": "1111…", "document_ids": ["2222…"] })\n{ "pipeline_id": "3333…", "version": 1, "status": "processing", "links": { "results": "/v1/pipelines/3333…/results" } }',
      },
    ],
    related: [
      {
        label: "talonic_spec_check",
        slug: "talonic-spec-check",
      },
      {
        label: "talonic_spec_publish",
        slug: "talonic-spec-publish",
      },
    ],
    faq: [
      {
        question: "Are test results delivered?",
        answer: "No. Tests are preview runs.",
      },
    ],
    mentions: ["Spec", "pipeline", "Spec authoring"],
  },
  {
    slug: "talonic-spec-publish",
    parentSlug: "tools",
    title: "talonic_spec_publish",
    seoTitle: "talonic_spec_publish — Publish a Spec as the Next Version",
    description:
      "MCP tool that publishes a Talonic Spec draft as the next version, the one that new runs use. It is refused while the draft still has errors; check it first.",
    content: [
      {
        type: "paragraph",
        text: "Publish the draft as the next version: new runs use it. Nothing is published when the draft has errors or unacknowledged issues. Send `expected_draft_revision` to publish exactly what you checked. Changes what runs; call only when the user asks. Listed only when the platform serves Spec authoring to the credential (`GET /v1/specs/authoring`); the platform checks the `specs:read` / `specs:write` scopes and the person's Spec editor permissions on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "spec_id",
            type: "string",
            required: true,
            description: "The Spec.",
          },
          {
            name: "expected_draft_revision",
            type: "integer",
            required: false,
            description: "The revision you checked.",
          },
          {
            name: "acknowledge_issues",
            type: "boolean",
            required: false,
            description: "Proceed over listed issues, after the user agreed.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_spec_publish({ "spec_id": "1111…", "expected_draft_revision": 2 })\n{ "version": 1, "schema_id": "4444…", "active": true, "activation_pending": false, "issues": [] }',
      },
    ],
    related: [
      {
        label: "talonic_spec_test",
        slug: "talonic-spec-test",
      },
      {
        label: "talonic_spec_rollback",
        slug: "talonic-spec-rollback",
      },
    ],
    faq: [
      {
        question: "Can I undo a publish?",
        answer: "Yes: talonic_spec_rollback publishes an earlier version again as a new one.",
      },
    ],
    mentions: ["Spec", "pipeline", "Spec authoring"],
  },
  {
    slug: "talonic-spec-rollback",
    parentSlug: "tools",
    title: "talonic_spec_rollback",
    seoTitle: "talonic_spec_rollback — Roll Back a Spec to an Earlier One",
    description:
      "MCP tool that restores an earlier published version of a Talonic Spec as a new version, or previews what would change first. Version history is never rewritten.",
    content: [
      {
        type: "paragraph",
        text: "Publish an earlier version's document again as a NEW version; history is kept. With `preview` nothing changes and you get what differs. Changes what runs; call only when the user asks. Listed only when the platform serves Spec authoring to the credential (`GET /v1/specs/authoring`); the platform checks the `specs:read` / `specs:write` scopes and the person's Spec editor permissions on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "spec_id",
            type: "string",
            required: true,
            description: "The Spec.",
          },
          {
            name: "version",
            type: "integer",
            required: true,
            description: "The version to restore.",
          },
          {
            name: "preview",
            type: "boolean",
            required: false,
            description: "Only show what would change.",
          },
          {
            name: "acknowledge_issues",
            type: "boolean",
            required: false,
            description: "Proceed over listed issues, after the user agreed.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_spec_rollback({ "spec_id": "1111…", "version": 2 })\n{ "version": 6, "restored_from": 2, "active": true, "issues": [] }',
      },
    ],
    related: [
      {
        label: "talonic_spec_publish",
        slug: "talonic-spec-publish",
      },
      {
        label: "talonic_spec_edit",
        slug: "talonic-spec-edit",
      },
    ],
    faq: [
      {
        question: "Does rollback delete newer versions?",
        answer: "No. Every version stays.",
      },
    ],
    mentions: ["Spec", "pipeline", "Spec authoring"],
  },
]
