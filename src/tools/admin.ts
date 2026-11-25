import { z } from "zod"
import { zUuid } from "./_shared.js"
import { READ, describe, write, type ToolGroup } from "./_groups.js"

/**
 * Workspace administration over `/v1/account`, `/v1/webhooks` and
 * `/v1/billing/upgrade-link`: API keys (list, create, revoke), the account
 * snapshot, webhook configurations (CRUD plus the event types they accept),
 * and the buy-credits link a person opens to pay.
 *
 * Policy lives on the platform and is applied on every call: key listing and
 * revoking follow the dashboard's rule (a workspace owner manages every key,
 * anyone else only their own); a new key can never carry a scope the calling
 * credential does not hold; key-management routes refuse the master view.
 * The probe (`GET /v1/account/keys`) only tells whether the credential can
 * reach key management at all; it cannot see the person's role, so a member
 * whose credential reaches it sees the tools and gets the platform's own
 * answer (their own keys, or a 403 that the tool error explains).
 *
 * Webhook re-delivery: the platform has no replay route for `/v1/webhooks`
 * configurations. The same events are readable from `talonic_list_events`
 * (`after` / `next_cursor`), which is how a receiver catches up.
 */

const SCOPES = [
  "extract",
  "read",
  "write",
  "operations",
  "billing",
  "delivery",
  "usage",
  "records_write",
] as const

const LIST_KEYS = describe({
  what: "List the workspace's API keys: name, scopes, masked prefix, active state, last use, creation, revocation and expiry. Never returns a secret. A workspace owner sees every key; anyone else sees only the keys they created.",
  use: "auditing which keys exist, finding the id of a key to revoke, or checking a key's scopes and expiry.",
  not: "creating a key (talonic_create_api_key); the workspace's credits and limits (talonic_get_account).",
  returns:
    "{ data[] { id, name, scopes[], masked_prefix, is_active, last_used, created_at, revoked_at, expires_at } }.",
})

const CREATE_KEY = describe({
  what: "Create a new API key for this workspace. The secret is returned ONCE in `key` and can never be read again: hand it to the user straight away, tell them to store it, and never repeat it, summarize it, write it to a file or log, or pass it to another tool. A new key can only carry scopes the calling credential already holds (a key cannot widen its own access); billing, usage and records_write are granted only by an owner in the app. Ask the user before creating a key.",
  use: "the user asks for a new or narrower key, e.g. a read-only key for a dashboard, or a key that expires.",
  not: "rotating by revoking (talonic_revoke_api_key, after the new key is in place).",
  args: "`name` (1-255 characters, shown in listings), `scopes` (optional subset of extract, read, write, operations, billing, delivery, usage, records_write; omitted = the calling credential's own scopes), `expires_at` (optional ISO-8601 in the future; enterprise workspaces cap keys at 90 days).",
  returns:
    "{ id, name, key (the secret, shown once), masked_prefix, scopes[], created_at, expires_at, warning }.",
  errors:
    "403 scope_not_grantable when a requested scope is not held by the calling credential; 403 when key creation is managed by Talonic for this workspace.",
})

const REVOKE_KEY = describe({
  what: "Revoke an API key: it stops working at once and cannot be turned back on. Anything still using it fails from the next request. Confirm the key (name, masked prefix) with the user before calling. A workspace owner can revoke any key; anyone else only their own.",
  use: "the user asks to revoke, rotate out or disable a key.",
  not: "listing keys (talonic_list_api_keys).",
  args: "`key_id` (UUID from talonic_list_api_keys).",
  returns: "{ id, revoked: true }.",
  errors: "404 key_not_found when no active key with that id is yours to revoke.",
})

const GET_ACCOUNT = describe({
  what: "The workspace's account snapshot: plan (`tier`), status, credit balance (EUR) with any monthly allowance, daily request limits per area and today's usage against them.",
  use: "checking plan, limits or today's request counts, e.g. before a large batch or after a 429.",
  not: "credit spend by function (talonic_get_usage); buying credits (talonic_get_billing_upgrade_link).",
  returns:
    "{ tier, status, email_domain, created_at, credits { balance, currency, monthly_allowance, tier_resets_at }, daily_limits { extract, platform, ingest, operations }, usage_today { extract, platform, ingest, operations } }.",
})

const LIST_WEBHOOKS = describe({
  what: "List the workspace's webhook configurations: target URL, subscribed event types, active state, the source they are limited to (if any). Never returns signing secrets.",
  use: "checking where events are sent, or finding a webhook id to change or delete.",
  not: "the events themselves (talonic_list_events); valid event type names (talonic_list_webhook_event_types).",
  returns:
    "{ data[] { id, url, events[], is_active, source_connection_id, created_at, updated_at } }.",
})

const GET_WEBHOOK = describe({
  what: "One webhook configuration by id.",
  use: "reading one webhook's URL, events and state before changing it.",
  not: "listing every webhook (talonic_list_webhooks).",
  args: "`id` (UUID).",
  returns: "{ id, url, events[], is_active, source_connection_id, created_at, updated_at }.",
})

const CREATE_WEBHOOK = describe({
  what: "Create a webhook: Talonic POSTs the chosen events to `url`, signed with `secret` when one is given (X-Talonic-Signature: sha256=<hex> over the raw body). Ask the user for the URL and confirm it before calling.",
  use: "the user wants Talonic to notify their system, e.g. when an extraction completes or fails.",
  not: "changing an existing webhook (talonic_update_webhook).",
  args: "`url` (https URL that accepts POST), `events` (event types, default extraction.complete and extraction.failed; see talonic_list_webhook_event_types), `secret` (optional signing secret the receiver verifies), `source_connection_id` (optional: only events of that source), `is_active` (default true).",
  returns: "{ id, url, events[], is_active, source_connection_id, created_at, updated_at }.",
})

const UPDATE_WEBHOOK = describe({
  what: "Change a webhook: its URL, events, signing secret or active state. Only the fields sent change. Setting is_active false pauses deliveries without deleting the webhook.",
  use: "pointing a webhook elsewhere, changing its events, rotating its secret, or pausing / resuming it.",
  not: "removing it for good (talonic_delete_webhook).",
  args: "`id` (UUID), and any of `url`, `events`, `secret`, `is_active`.",
  returns: "{ id, url, events[], is_active, source_connection_id, created_at, updated_at }.",
})

const DELETE_WEBHOOK = describe({
  what: "Delete a webhook configuration for good: its target stops receiving events at once. Confirm with the user first; to pause instead, use talonic_update_webhook with is_active false.",
  use: "the user asks to remove a webhook.",
  not: "pausing (talonic_update_webhook).",
  args: "`id` (UUID).",
  returns: "{ deleted: true, id }.",
})

const EVENT_TYPES = describe({
  what: "The event types a webhook can subscribe to, with what each one means. There is no re-delivery of a past webhook call: to catch up on events a receiver missed, read them with talonic_list_events from a saved cursor.",
  use: "choosing `events` for talonic_create_webhook or talonic_update_webhook.",
  not: "the events that happened (talonic_list_events).",
  returns: "{ data[] { event, description } }.",
})

const UPGRADE_LINK = describe({
  what: "A link where a person buys credits. This tool never buys anything: it returns a URL for the user to open and pay. Present the link and tell the user a human must complete the purchase; credits arrive seconds after payment. A workspace billed through a marketplace gets the marketplace page instead.",
  use: "the workspace ran out of credits (HTTP 402) or the user asks how to buy more.",
  not: "checking the balance (talonic_get_balance) or prices (talonic_get_pricing).",
  args: "`pack` (optional: 10, 50, 250 or 1000 EUR; default 50).",
  returns:
    "{ url, provider (stripe | dashboard | aws_marketplace), requires_human: true, pack?, message }.",
})

const webhookFields = {
  url: z.string().url().describe("Receiver URL (https) that accepts POST."),
  events: z.array(z.string().min(1)).min(1).describe("Event types to send."),
  secret: z.string().min(1).describe("Signing secret the receiver verifies."),
  is_active: z.boolean().describe("false pauses deliveries."),
}

export const adminGroup: ToolGroup = {
  key: "admin",
  label: "Workspace administration",
  docsSlug: "admin-tools",
  probe: { path: "/v1/account/keys" },
  tools: [
    {
      name: "talonic_list_api_keys",
      title: "List API keys",
      description: LIST_KEYS,
      route: "GET /v1/account/keys",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_create_api_key",
      title: "Create an API key",
      description: CREATE_KEY,
      route: "POST /v1/account/keys",
      inputSchema: {
        name: z.string().min(1).max(255).describe("Label shown in listings."),
        scopes: z
          .array(z.enum(SCOPES))
          .min(1)
          .optional()
          .describe("Subset of the calling credential's scopes; omitted = the same scopes."),
        expires_at: z
          .string()
          .optional()
          .describe("When the key stops working, ISO-8601 in the future."),
      },
      annotations: write(false),
      body: ["name", "scopes", "expires_at"],
    },
    {
      name: "talonic_revoke_api_key",
      title: "Revoke an API key",
      description: REVOKE_KEY,
      route: "DELETE /v1/account/keys/{keyId}",
      inputSchema: { key_id: zUuid().describe("The key, from talonic_list_api_keys.") },
      annotations: write(true, true),
    },
    {
      name: "talonic_get_account",
      title: "Account snapshot",
      description: GET_ACCOUNT,
      route: "GET /v1/account",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_list_webhooks",
      title: "List webhooks",
      description: LIST_WEBHOOKS,
      route: "GET /v1/webhooks",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_get_webhook",
      title: "One webhook",
      description: GET_WEBHOOK,
      route: "GET /v1/webhooks/{id}",
      inputSchema: { id: zUuid().describe("The webhook id.") },
      annotations: READ,
    },
    {
      name: "talonic_create_webhook",
      title: "Create a webhook",
      description: CREATE_WEBHOOK,
      route: "POST /v1/webhooks",
      inputSchema: {
        url: webhookFields.url,
        events: webhookFields.events.optional(),
        secret: webhookFields.secret.optional(),
        source_connection_id: zUuid().optional().describe("Only events of this source."),
        is_active: webhookFields.is_active.optional(),
      },
      annotations: write(false),
      body: ["url", "events", "secret", "source_connection_id", "is_active"],
    },
    {
      name: "talonic_update_webhook",
      title: "Change a webhook",
      description: UPDATE_WEBHOOK,
      route: "PATCH /v1/webhooks/{id}",
      inputSchema: {
        id: zUuid().describe("The webhook id."),
        url: webhookFields.url.optional(),
        events: webhookFields.events.optional(),
        secret: webhookFields.secret.optional(),
        is_active: webhookFields.is_active.optional(),
      },
      annotations: write(true),
      body: ["url", "events", "secret", "is_active"],
    },
    {
      name: "talonic_delete_webhook",
      title: "Delete a webhook",
      description: DELETE_WEBHOOK,
      route: "DELETE /v1/webhooks/{id}",
      inputSchema: { id: zUuid().describe("The webhook id.") },
      annotations: write(true, true),
    },
    {
      name: "talonic_list_webhook_event_types",
      title: "Webhook event types",
      description: EVENT_TYPES,
      route: "GET /v1/webhooks/events",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_get_billing_upgrade_link",
      title: "Buy-credits link",
      description: UPGRADE_LINK,
      route: "GET /v1/billing/upgrade-link",
      inputSchema: {
        pack: z.enum(["10", "50", "250", "1000"]).optional().describe("Credit pack in EUR."),
      },
      annotations: READ,
      query: ["pack"],
    },
  ],
}
