import type { RawSection } from "../../types"

export const section: RawSection = {
  slug: "admin-tools",
  parentSlug: "tool-groups",
  title: "Workspace administration",
  seoTitle: "Workspace Admin Tools — API Keys, Webhooks, Credits",
  description:
    "MCP tools for Talonic workspace admins: list, create and revoke API keys, manage webhooks and their event types, read the account and get a buy-credits link.",
  content: [
    {
      type: "paragraph",
      text: "Manage the workspace from an agent: API keys, webhooks, the account snapshot and the link where a person buys credits. Each tool calls the same Talonic API your dashboard uses, with your credential.",
    },
    {
      type: "callout",
      variant: "info",
      text: "These tools are meant for workspace admins. Talonic checks every call against the person behind the credential, exactly as in the app: an owner manages every key, anyone else only their own, and a new key can never carry more access than the credential that creates it. A new key's secret is shown once, in the create response; store it straight away.",
    },
    { type: "heading", level: 3, id: "talonic-list-api-keys", text: "talonic_list_api_keys" },
    {
      type: "paragraph",
      text: "The workspace's API keys with name, scopes, masked prefix, active state, last use and expiry. Never returns a secret.",
    },
    { type: "heading", level: 3, id: "talonic-create-api-key", text: "talonic_create_api_key" },
    {
      type: "paragraph",
      text: "Creates a key and returns its secret once in `key`. Scopes can only be a subset of the calling credential's own; `billing`, `usage` and `records_write` are granted only by an owner in the app.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "name",
          type: "string",
          required: true,
          description: "Label shown in listings (1-255 characters).",
        },
        {
          name: "scopes",
          type: "string[]",
          description:
            "Subset of extract, read, write, operations, billing, delivery, usage, records_write. Default: the calling credential's scopes.",
        },
        {
          name: "expires_at",
          type: "string",
          description: "ISO-8601 time in the future when the key stops working.",
        },
      ],
    },
    { type: "heading", level: 3, id: "talonic-revoke-api-key", text: "talonic_revoke_api_key" },
    {
      type: "paragraph",
      text: "Revokes a key at once; it cannot be turned back on. Marked destructive, so clients ask before running it.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "key_id",
          type: "UUID",
          required: true,
          description: "The key, from talonic_list_api_keys.",
        },
      ],
    },
    { type: "heading", level: 3, id: "talonic-get-account", text: "talonic_get_account" },
    {
      type: "paragraph",
      text: "Plan (`tier`), status, credit balance in EUR, daily request limits and today's usage against them.",
    },
    { type: "heading", level: 3, id: "talonic-list-webhooks", text: "talonic_list_webhooks" },
    {
      type: "paragraph",
      text: "Every webhook with its URL, event types, active state and optional source. Signing secrets are never returned.",
    },
    { type: "heading", level: 3, id: "talonic-get-webhook", text: "talonic_get_webhook" },
    { type: "paragraph", text: "One webhook by id." },
    {
      type: "param-table",
      params: [{ name: "id", type: "UUID", required: true, description: "The webhook id." }],
    },
    { type: "heading", level: 3, id: "talonic-create-webhook", text: "talonic_create_webhook" },
    {
      type: "paragraph",
      text: "Sends the chosen events to your URL as signed POST requests (`X-Talonic-Signature: sha256=<hex>` over the raw body when a secret is set).",
    },
    {
      type: "param-table",
      params: [
        {
          name: "url",
          type: "string",
          required: true,
          description: "Receiver URL that accepts POST.",
        },
        {
          name: "events",
          type: "string[]",
          description: "Event types. Default: extraction.complete, extraction.failed.",
        },
        { name: "secret", type: "string", description: "Signing secret your receiver verifies." },
        { name: "source_connection_id", type: "UUID", description: "Only events of this source." },
        { name: "is_active", type: "boolean", description: "Default true." },
      ],
    },
    { type: "heading", level: 3, id: "talonic-update-webhook", text: "talonic_update_webhook" },
    {
      type: "paragraph",
      text: "Changes only the fields you send. `is_active: false` pauses deliveries without deleting the webhook.",
    },
    {
      type: "param-table",
      params: [
        { name: "id", type: "UUID", required: true, description: "The webhook id." },
        { name: "url", type: "string", description: "New receiver URL." },
        { name: "events", type: "string[]", description: "New event types." },
        { name: "secret", type: "string", description: "New signing secret." },
        { name: "is_active", type: "boolean", description: "Pause or resume." },
      ],
    },
    { type: "heading", level: 3, id: "talonic-delete-webhook", text: "talonic_delete_webhook" },
    {
      type: "paragraph",
      text: "Deletes a webhook for good. Marked destructive. To stop deliveries for a while, pause it instead.",
    },
    {
      type: "param-table",
      params: [{ name: "id", type: "UUID", required: true, description: "The webhook id." }],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-list-webhook-event-types",
      text: "talonic_list_webhook_event_types",
    },
    {
      type: "paragraph",
      text: "The event types a webhook can subscribe to, each with a description. A past webhook call is not re-sent; a receiver that missed events reads them with `talonic_list_events` from its saved cursor.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-get-billing-upgrade-link",
      text: "talonic_get_billing_upgrade_link",
    },
    {
      type: "paragraph",
      text: "A link where a person buys credits. The tool never buys anything: a human opens the link and completes the payment, and credits arrive seconds later. Workspaces billed through a marketplace get the marketplace page.",
    },
    {
      type: "param-table",
      params: [
        { name: "pack", type: "string", description: "10, 50, 250 or 1000 (EUR). Default 50." },
      ],
    },
  ],
  related: [],
  faq: [],
  mentions: [],
}
