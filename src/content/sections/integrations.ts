import type { RawSection } from "../types"

// The source connect and import tools (`talonic_integrations_*`, `talonic_sources_*`,
// src/tools/integrations.ts). Rendered at talonic.com/docs/mcp/<slug>; docs/sections.json keeps a
// mirror (`mcp-<slug>`) that tests/content/tool-sections.test.ts holds in step. The tools are
// listed only when the platform serves the integrations routes to the credential; every page says so.

export const sections: RawSection[] = [
  {
    slug: "talonic-integrations-connectors",
    parentSlug: "tools",
    title: "talonic_integrations_connectors",
    seoTitle: "talonic_integrations_connectors — What You Can Connect",
    description:
      "MCP tool that lists what a Talonic workspace can connect: each source or destination, whether it connects by browser sign-in or credentials, and if offered.",
    content: [
      {
        type: "paragraph",
        text: "What the workspace can connect: per connector its slug, name, kind (source or destination), method (`authorize` = a browser sign-in the agent can start; `credentials` = keys or passwords a person enters), `personal` (one person's own account) and `available` (false = not offered on this deployment). Listed only when the platform serves the integrations routes to the credential (the `sources:read` consent); the platform checks the scope and the person's workspace permission on every call.",
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_integrations_connectors({})\n{ "data": [{ "connector": "gmail", "name": "Gmail", "kind": "source", "method": "authorize", "personal": true, "available": true, "connect": { "method": "POST", "path": "/v1/integrations/gmail/authorize" } }] }',
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
    faq: [
      {
        question: "Why can the agent not connect Amazon S3 or a SQL database?",
        answer:
          "No tool connects with credentials (Amazon S3, Azure Blob Storage, SQL databases, Kendox, Granola, a Slack token, an external upload link) and no tool creates a source ingest key: secrets and keys never pass through an agent conversation. A person enters them in the Talonic web app, or the customer's own system sends them to `POST /v1/sources/connections/<type>` and `POST /v1/sources/:id/keys`.",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  {
    slug: "talonic-integrations-connect",
    parentSlug: "tools",
    title: "talonic_integrations_connect",
    seoTitle: "talonic_integrations_connect — Connect Through the Browser",
    description:
      "MCP tool that starts connecting Gmail, Google Drive, SharePoint and other accounts: it returns a link the person opens to sign in at the provider and finish.",
    content: [
      {
        type: "paragraph",
        text: "Starts a browser sign-in and returns `authorize_url`, the authorization `id` and `expires_at` (30 minutes). The person opens the link while signed in to Talonic in the same workspace, confirms, and finishes the provider's sign-in; nothing is connected until they do. The agent then polls talonic_integrations_connect_status. Connecting the same account again renews the existing connection. Personal connections (mailboxes, notes, a person's own drive) show their content only as the connecting person's access allows. Listed only when the platform serves the integrations routes to the credential (the `sources:read` consent); the platform checks the scope and the person's workspace permission on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "connector",
            type: "string",
            required: true,
            description:
              "A connector with method `authorize`, e.g. `gmail`, `google-drive`, `sharepoint`.",
          },
          {
            name: "send",
            type: "boolean",
            required: false,
            description: "gmail, outlook only: the mailbox may also send mail.",
          },
          {
            name: "intake",
            type: "object",
            required: false,
            description: "gmail, notion, slack only: what to read first.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_integrations_connect({ "connector": "google-drive" })\n{ "id": "2222…", "object": "integration_authorization", "connector": "google-drive", "status": "pending", "authorize_url": "https://app.talonic.com/…", "expires_at": "2026-11-25T12:30:00Z", "instructions": "Ask the user to open authorize_url …" }',
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
    mentions: ["sources", "integrations", "connect"],
  },
  {
    slug: "talonic-integrations-connect-status",
    parentSlug: "tools",
    title: "talonic_integrations_connect_status",
    seoTitle: "talonic_integrations_connect_status — Check a Connect",
    description:
      "MCP tool that reports whether a browser connect started by talonic_integrations_connect has finished, failed or expired, and which connection it made.",
    content: [
      {
        type: "paragraph",
        text: "Where a connect stands: `pending`, `connected`, `failed` (with an error code and message), `expired` or `cancelled`. On `connected` it returns `connection_id`, which the source tools take; for Google Sheets it returns the signed-in account. Only the person who started the connect can see it. Listed only when the platform serves the integrations routes to the credential (the `sources:read` consent); the platform checks the scope and the person's workspace permission on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "authorization_id",
            type: "string",
            required: true,
            description: "The id talonic_integrations_connect returned.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_integrations_connect_status({ "authorization_id": "2222…" })\n{ "id": "2222…", "status": "connected", "connection_id": "1111…", "completed_at": "2026-11-25T12:04:10Z" }',
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
    faq: [
      {
        question: "How long can the agent wait?",
        answer:
          "Until `expires_at`, 30 minutes after the connect started. After that, start a new connect.",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  {
    slug: "talonic-sources-connections",
    parentSlug: "tools",
    title: "talonic_sources_connections",
    seoTitle: "talonic_sources_connections — List Connected Sources",
    description:
      "MCP tool that lists the sources connected to a Talonic workspace (mailboxes, drives, CRMs and more) with their status, so other source tools can take the id.",
    content: [
      {
        type: "paragraph",
        text: "Every connected source with its type, name, sync state, `restricted` and `connected_by`. Personal connections (mailboxes, notes, a person's own drive) show their content only as the connecting person's access allows. Listed only when the platform serves the integrations routes to the credential (the `sources:read` consent); the platform checks the scope and the person's workspace permission on every call.",
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_sources_connections({})\n{ "data": [{ "id": "1111…", "type": "google_drive", "name": "Finance Drive", "restricted": false, "connected_by": "anna@example.com" }] }',
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
    faq: [
      {
        question: "Why does a connected mailbox show no content?",
        answer:
          "Personal connections (mailboxes, notes, a person's own drive) show their content only as the connecting person's access allows.",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  {
    slug: "talonic-sources-browse",
    parentSlug: "tools",
    title: "talonic_sources_browse",
    seoTitle: "talonic_sources_browse — Browse the Files in a Source",
    description:
      "MCP tool that lists folders and files inside a connected source, page by page or by name search, so the agent can choose which files to import into Talonic.",
    content: [
      {
        type: "paragraph",
        text: "One level and page at a time: `folder_id` opens a folder, `page_token` continues, `q` searches by name. Shows only what the caller may see in that source. Listed only when the platform serves the integrations routes to the credential (the `sources:read` consent); the platform checks the scope and the person's workspace permission on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "connection_id",
            type: "UUID",
            required: true,
            description: "The connection, from talonic_sources_connections.",
          },
          {
            name: "folder_id",
            type: "string",
            required: false,
            description: "Folder to open; omit for the top level.",
          },
          {
            name: "page_token",
            type: "string",
            required: false,
            description: "From the previous answer, for the next page.",
          },
          {
            name: "q",
            type: "string",
            required: false,
            description: "Search by name.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_sources_browse({ "connection_id": "1111…", "q": "invoice" })\n{ "data": [{ "id": "f_9", "name": "Invoice 2026-11.pdf", "kind": "file" }], "next_page_token": null }',
      },
    ],
    related: [
      {
        label: "talonic_sources_import",
        slug: "talonic-sources-import",
      },
    ],
    faq: [
      {
        question: "Does browsing import anything?",
        answer: "No. Only talonic_sources_import brings files in.",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  {
    slug: "talonic-sources-import",
    parentSlug: "tools",
    title: "talonic_sources_import",
    seoTitle: "talonic_sources_import — Import Files From a Source",
    description:
      "MCP tool that brings chosen files from a connected source into Talonic as documents, optionally tagged; they are read like uploaded documents and use credits.",
    content: [
      {
        type: "paragraph",
        text: "Brings the chosen files in as documents, optionally tagged. Imported files are read like uploaded documents, which uses credits. Needs the `documents:write` consent. Listed only when the platform serves the integrations routes to the credential (the `sources:read` consent); the platform checks the scope and the person's workspace permission on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "connection_id",
            type: "UUID",
            required: true,
            description: "The connection, from talonic_sources_connections.",
          },
          {
            name: "file_ids",
            type: "string[]",
            required: true,
            description: "File ids from talonic_sources_browse.",
          },
          {
            name: "tags",
            type: "string[]",
            required: false,
            description: "Tags for the imported documents.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_sources_import({ "connection_id": "1111…", "file_ids": ["f_9"] })\n{ "id": "3333…", "status": "queued" }',
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
    faq: [
      {
        question: "Does it use credits?",
        answer: "Yes: imported files are read like uploaded documents.",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  {
    slug: "talonic-sources-imports",
    parentSlug: "tools",
    title: "talonic_sources_imports",
    seoTitle: "talonic_sources_imports — Recent Imports From a Source",
    description:
      "MCP tool that lists the recent imports from one connected source in a Talonic workspace: the state of each import and what each of them has brought in so far.",
    content: [
      {
        type: "paragraph",
        text: "Recent imports from one connected source: their state and what each brought in. Listed only when the platform serves the integrations routes to the credential (the `sources:read` consent); the platform checks the scope and the person's workspace permission on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "connection_id",
            type: "UUID",
            required: true,
            description: "The connection, from talonic_sources_connections.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_sources_imports({ "connection_id": "1111…" })\n{ "data": [{ "id": "3333…", "status": "completed" }] }',
      },
    ],
    related: [
      {
        label: "talonic_sources_import",
        slug: "talonic-sources-import",
      },
    ],
    faq: [
      {
        question: "Are sync runs listed too?",
        answer: "The sync state of a connection is on talonic_sources_connections.",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  {
    slug: "talonic-sources-sync-now",
    parentSlug: "tools",
    title: "talonic_sources_sync_now",
    seoTitle: "talonic_sources_sync_now — Sync a Source Right Now",
    description:
      "MCP tool that asks a connected source to check for new and changed files right away, instead of waiting for its next scheduled sync in the Talonic workspace.",
    content: [
      {
        type: "paragraph",
        text: "Starts a sync outside the schedule and answers at once (202); the sync runs in the background. New files are read like uploads, which uses credits. A personal connection can be synced only by the person who connected it. Needs the `documents:write` consent. Listed only when the platform serves the integrations routes to the credential (the `sources:read` consent); the platform checks the scope and the person's workspace permission on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "connection_id",
            type: "UUID",
            required: true,
            description: "The connection, from talonic_sources_connections.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_sources_sync_now({ "connection_id": "1111…" })\n{ "accepted": true, "connection_id": "1111…" }',
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
    faq: [
      {
        question: "How do I see the result?",
        answer:
          "talonic_sources_connections shows the sync state; talonic_sources_imports what came in.",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
  {
    slug: "talonic-sources-sync-settings",
    parentSlug: "tools",
    title: "talonic_sources_sync_settings",
    seoTitle: "talonic_sources_sync_settings — Source Sync Settings",
    description:
      "MCP tool that reads or changes how a connected source stays in sync with Talonic: how often it checks for new files and the scope of what it reads each time.",
    content: [
      {
        type: "paragraph",
        text: "Without `interval` and `scope` it reads the settings. With either it changes them, only for the connection's author or a workspace owner (`sources:write` consent). A schedule other than `off` needs at least one scope entry. Listed only when the platform serves the integrations routes to the credential (the `sources:read` consent); the platform checks the scope and the person's workspace permission on every call.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "connection_id",
            type: "UUID",
            required: true,
            description: "The connection, from talonic_sources_connections.",
          },
          {
            name: "interval",
            type: "string",
            required: false,
            description: "`off`, `every_minute`, `hourly`, `daily` or `weekly`.",
          },
          {
            name: "scope",
            type: "object",
            required: false,
            description:
              "What is watched: `{ type, entries }` in the shape the settings read returns.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Example",
        code: '// talonic_sources_sync_settings({ "connection_id": "1111…", "interval": "daily" })\n{ "interval": "daily", "scope": { "type": "google_drive", "entries": [{ "kind": "folder", "folderId": "f_1", "name": "Invoices" }] } }',
      },
    ],
    related: [
      {
        label: "talonic_sources_sync_now",
        slug: "talonic-sources-sync-now",
      },
    ],
    faq: [
      {
        question: "Can a viewer change the schedule?",
        answer: "No. The platform refuses the change with 403 and a reason.",
      },
    ],
    mentions: ["sources", "integrations", "connect"],
  },
]
