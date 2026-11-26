// Page copy for the generated tool reference (see src/content/tool-pages.ts).

import type { ToolPage } from "../tool-reference-types"

export const SPEC_AND_SOURCE_PAGES: Record<string, ToolPage> = {
  talonic_spec_create: {
    task: "specs",
    seoTitle: "talonic_spec_create — Create a Spec for Your Documents",
    description:
      "MCP tool that creates a Talonic Spec, the saved definition of what to capture, from a complete document, a Spec JSON export, an existing schema or as empty.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_spec_create({ "name": "Invoices", "doc": { "format": 1, "name": "Invoices", "fields": [{ "field_id": "f-total", "name": "total_amount", "data_type": "number" }], "stages": [{ "id": "s-source", "type": "source" }, { "id": "s-extract", "type": "extraction", "config": {} }, { "id": "s-deliver", "type": "deliver" }], "gates": [], "policies": [] } })\n{ "spec_id": "1111…", "revision": 1, "published_version": null, "has_unpublished_changes": true }',
      },
    ],
    faq: [
      {
        question: "Is a new Spec live?",
        answer: "No. It is a draft until talonic_spec_publish.",
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
    mentions: ["Spec", "pipeline", "Spec authoring"],
  },
  talonic_spec_edit: {
    task: "specs",
    seoTitle: "talonic_spec_edit — Read, Replace or Rename a Spec Draft",
    description:
      "MCP tool that reads a Talonic Spec draft, replaces it under its revision so no edit is lost, or renames the Spec. Runs keep using the published version.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_spec_edit({ "spec_id": "1111…", "doc": { … }, "revision": 1 })\n{ "spec_id": "1111…", "revision": 2, "updated_at": "2026-11-25T10:00:00.000Z", "field_adoptions": {} }',
      },
    ],
    faq: [
      {
        question: "What if someone else saved first?",
        answer:
          "The call fails with a conflict and nothing changes. Read the draft again and re-apply the change.",
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
    mentions: ["Spec", "pipeline", "Spec authoring"],
  },
  talonic_spec_check: {
    task: "specs",
    seoTitle: "talonic_spec_check — Check a Spec Draft Before You Publish",
    description:
      "MCP tool that checks a Talonic Spec draft, or a document before it is saved, and returns its errors and warnings so you can fix them first. It saves nothing.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_spec_check({ "spec_id": "1111…" })\n{ "valid": false, "errors": [{ "code": "SPEC2_DUPLICATE_FIELD_NAME", "message": "Two fields are named total_amount.", "path": "fields[3].name" }], "warnings": [] }',
      },
    ],
    faq: [
      {
        question: "Does check cost credits?",
        answer: "No.",
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
    mentions: ["Spec", "pipeline", "Spec authoring"],
  },
  talonic_spec_test: {
    task: "specs",
    seoTitle: "talonic_spec_test — Test a Spec Draft on Sample Documents",
    description:
      "MCP tool that tests a Talonic Spec draft on sample documents as a preview run that is never delivered, so you can read the resulting rows with evidence first.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_spec_test({ "spec_id": "1111…", "document_ids": ["2222…"] })\n{ "pipeline_id": "3333…", "version": 1, "status": "processing", "links": { "results": "/v1/pipelines/3333…/results" } }',
      },
    ],
    faq: [
      {
        question: "Are test results delivered?",
        answer: "No. Tests are preview runs.",
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
    mentions: ["Spec", "pipeline", "Spec authoring"],
  },
  talonic_spec_publish: {
    task: "specs",
    seoTitle: "talonic_spec_publish — Publish a Spec as the Next Version",
    description:
      "MCP tool that publishes a Talonic Spec draft as the next version, the one that new runs use. It is refused while the draft still has errors; check it first.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_spec_publish({ "spec_id": "1111…", "expected_draft_revision": 2 })\n{ "version": 1, "schema_id": "4444…", "active": true, "activation_pending": false, "issues": [] }',
      },
    ],
    faq: [
      {
        question: "Can I undo a publish?",
        answer: "Yes: talonic_spec_rollback publishes an earlier version again as a new one.",
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
    mentions: ["Spec", "pipeline", "Spec authoring"],
  },
  talonic_spec_rollback: {
    task: "specs",
    seoTitle: "talonic_spec_rollback — Roll Back a Spec to an Earlier One",
    description:
      "MCP tool that restores an earlier published version of a Talonic Spec as a new version, or previews what would change first. Version history is never rewritten.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_spec_rollback({ "spec_id": "1111…", "version": 2 })\n{ "version": 6, "restored_from": 2, "active": true, "issues": [] }',
      },
    ],
    faq: [
      {
        question: "Does rollback delete newer versions?",
        answer: "No. Every version stays.",
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
    mentions: ["Spec", "pipeline", "Spec authoring"],
  },
  talonic_integrations_connectors: {
    task: "sources",
    seoTitle: "talonic_integrations_connectors — What You Can Connect",
    description:
      "MCP tool that lists what a Talonic workspace can connect: each source or destination, whether it connects by browser sign-in or credentials, and if offered.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_integrations_connectors({})\n{ "data": [{ "connector": "gmail", "name": "Gmail", "kind": "source", "method": "authorize", "personal": true, "available": true, "connect": { "method": "POST", "path": "/v1/integrations/gmail/authorize" } }] }',
      },
    ],
    faq: [
      {
        question: "Why can the agent not connect Amazon S3 or a SQL database?",
        answer:
          "No tool connects with credentials (Amazon S3, Azure Blob Storage, SQL databases, Kendox, Granola, a Slack token, an external upload link) and no tool creates a source ingest key: secrets and keys never pass through an agent conversation. A person enters them in the Talonic web app, or the customer's own system sends them to `POST /v1/sources/connections/<type>` and `POST /v1/sources/:id/keys`.",
      },
    ],
    related: [
      {
        label: "talonic_integrations_connect",
        slug: "talonic-integrations-connect",
      },
      {
        label: "talonic_sources_connections",
        slug: "talonic-sources-connections",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  talonic_integrations_connect: {
    task: "sources",
    seoTitle: "talonic_integrations_connect — Connect Through the Browser",
    description:
      "MCP tool that starts connecting Gmail, Google Drive, SharePoint and other accounts: it returns a link the person opens to sign in at the provider and finish.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_integrations_connect({ "connector": "google-drive" })\n{ "id": "2222…", "object": "integration_authorization", "connector": "google-drive", "status": "pending", "authorize_url": "https://app.talonic.com/…", "expires_at": "2026-11-25T12:30:00Z", "instructions": "Ask the user to open authorize_url …" }',
      },
    ],
    faq: [
      {
        question: "Can the agent connect a source that needs a password or key?",
        answer:
          "No tool connects with credentials (Amazon S3, Azure Blob Storage, SQL databases, Kendox, Granola, a Slack token, an external upload link) and no tool creates a source ingest key: secrets and keys never pass through an agent conversation. A person enters them in the Talonic web app, or the customer's own system sends them to `POST /v1/sources/connections/<type>` and `POST /v1/sources/:id/keys`.",
      },
      {
        question: "What if the connector is not offered?",
        answer:
          "The call answers 503 `connector_not_configured`; talonic_integrations_connectors shows `available: false` for it.",
      },
    ],
    related: [
      {
        label: "talonic_integrations_connect_status",
        slug: "talonic-integrations-connect-status",
      },
      {
        label: "talonic_integrations_connectors",
        slug: "talonic-integrations-connectors",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  talonic_integrations_connect_status: {
    task: "sources",
    seoTitle: "talonic_integrations_connect_status — Check a Connect",
    description:
      "MCP tool that reports whether a browser connect started by talonic_integrations_connect has finished, failed or expired, and which connection it made.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_integrations_connect_status({ "authorization_id": "2222…" })\n{ "id": "2222…", "status": "connected", "connection_id": "1111…", "completed_at": "2026-11-25T12:04:10Z" }',
      },
    ],
    faq: [
      {
        question: "How long can the agent wait?",
        answer:
          "Until `expires_at`, 30 minutes after the connect started. After that, start a new connect.",
      },
    ],
    related: [
      {
        label: "talonic_integrations_connect",
        slug: "talonic-integrations-connect",
      },
      {
        label: "talonic_sources_connections",
        slug: "talonic-sources-connections",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  talonic_sources_connections: {
    task: "sources",
    seoTitle: "talonic_sources_connections — List Connected Sources",
    description:
      "MCP tool that lists the sources connected to a Talonic workspace (mailboxes, drives, CRMs and more) with their status, so other source tools can take the id.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_sources_connections({})\n{ "data": [{ "id": "1111…", "type": "google_drive", "name": "Finance Drive", "restricted": false, "connected_by": "anna@example.com" }] }',
      },
    ],
    faq: [
      {
        question: "Why does a connected mailbox show no content?",
        answer:
          "Personal connections (mailboxes, notes, a person's own drive) show their content only as the connecting person's access allows.",
      },
    ],
    related: [
      {
        label: "talonic_sources_browse",
        slug: "talonic-sources-browse",
      },
      {
        label: "talonic_sources_sync_settings",
        slug: "talonic-sources-sync-settings",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  talonic_sources_browse: {
    task: "sources",
    seoTitle: "talonic_sources_browse — Browse the Files in a Source",
    description:
      "MCP tool that lists folders and files inside a connected source, page by page or by name search, so the agent can choose which files to import into Talonic.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_sources_browse({ "connection_id": "1111…", "q": "invoice" })\n{ "data": [{ "id": "f_9", "name": "Invoice 2026-11.pdf", "kind": "file" }], "next_page_token": null }',
      },
    ],
    faq: [
      {
        question: "Does browsing import anything?",
        answer: "No. Only talonic_sources_import brings files in.",
      },
    ],
    related: [
      {
        label: "talonic_sources_import",
        slug: "talonic-sources-import",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  talonic_sources_import: {
    task: "sources",
    seoTitle: "talonic_sources_import — Import Files From a Source",
    description:
      "MCP tool that brings chosen files from a connected source into Talonic as documents, optionally tagged; they are read like uploaded documents and use credits.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_sources_import({ "connection_id": "1111…", "file_ids": ["f_9"] })\n{ "id": "3333…", "status": "queued" }',
      },
    ],
    faq: [
      {
        question: "Does it use credits?",
        answer: "Yes: imported files are read like uploaded documents.",
      },
    ],
    related: [
      {
        label: "talonic_sources_imports",
        slug: "talonic-sources-imports",
      },
      {
        label: "talonic_sources_browse",
        slug: "talonic-sources-browse",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  talonic_sources_imports: {
    task: "sources",
    seoTitle: "talonic_sources_imports — Recent Imports From a Source",
    description:
      "MCP tool that lists the recent imports from one connected source in a Talonic workspace: the state of each import and what each of them has brought in so far.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_sources_imports({ "connection_id": "1111…" })\n{ "data": [{ "id": "3333…", "status": "completed" }] }',
      },
    ],
    faq: [
      {
        question: "Are sync runs listed too?",
        answer: "The sync state of a connection is on talonic_sources_connections.",
      },
    ],
    related: [
      {
        label: "talonic_sources_import",
        slug: "talonic-sources-import",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  talonic_sources_sync_now: {
    task: "sources",
    seoTitle: "talonic_sources_sync_now — Sync a Source Right Now",
    description:
      "MCP tool that asks a connected source to check for new and changed files right away, instead of waiting for its next scheduled sync in the Talonic workspace.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_sources_sync_now({ "connection_id": "1111…" })\n{ "accepted": true, "connection_id": "1111…" }',
      },
    ],
    faq: [
      {
        question: "How do I see the result?",
        answer:
          "talonic_sources_connections shows the sync state; talonic_sources_imports what came in.",
      },
    ],
    related: [
      {
        label: "talonic_sources_sync_settings",
        slug: "talonic-sources-sync-settings",
      },
      {
        label: "talonic_sources_connections",
        slug: "talonic-sources-connections",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  talonic_sources_sync_settings: {
    task: "sources",
    seoTitle: "talonic_sources_sync_settings — Source Sync Settings",
    description:
      "MCP tool that reads or changes how a connected source stays in sync with Talonic: how often it checks for new files and the scope of what it reads each time.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_sources_sync_settings({ "connection_id": "1111…", "interval": "daily" })\n{ "interval": "daily", "scope": { "type": "google_drive", "entries": [{ "kind": "folder", "folderId": "f_1", "name": "Invoices" }] } }',
      },
    ],
    faq: [
      {
        question: "Can a viewer change the schedule?",
        answer: "No. The platform refuses the change with 403 and a reason.",
      },
    ],
    related: [
      {
        label: "talonic_sources_sync_now",
        slug: "talonic-sources-sync-now",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
}
