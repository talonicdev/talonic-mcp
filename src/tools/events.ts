import { z } from "zod"
import { READ, describe, type ToolGroup } from "./_groups.js"

/**
 * `talonic_list_events` over `GET /v1/events`: the workspace's event feed
 * (document extractions, run completions and failures, review verdicts,
 * delivery outcomes). The same events webhooks are sent from, so a consumer
 * can catch up on missed deliveries. Two ways to page: newest first with
 * `limit` / `offset`, or a forward tail with `after` = a saved `next_cursor`
 * (oldest first, resumable across pages and sessions).
 */

const LIST_EVENTS = describe({
  what: "Read the workspace's event feed: document extractions, run completions and failures, review verdicts and delivery outcomes, the same events webhooks are sent from. Only events about documents this credential may see are returned.",
  use: "catching up on what happened since a point in time or since a saved cursor (a poller, a missed webhook), or answering 'what finished / failed recently'.",
  not: "configuring webhooks (talonic_list_webhooks and its siblings, for workspace admins); workspace totals over a window (talonic_aggregate).",
  args: "`after` (an event id or a saved `next_cursor`: returns strictly newer events OLDEST FIRST; resume with the returned next_cursor), `since` (ISO-8601 lower bound on created_at), `event_type` (one type or a list), `limit` 1-200 (default 50), `offset` (newest-first listing only, ignored with `after`).",
  returns:
    "{ data[] { id, event_type, payload, created_at }, total, limit, offset, next_cursor }. next_cursor is null only at the end of the feed; on the newest-first listing it is the highest id on the page, so a poller can switch to `after` from there.",
})

export const eventsGroup: ToolGroup = {
  key: "events",
  label: "Events",
  docsSlug: "events-tools",
  probe: { path: "/v1/events", params: { limit: 1 } },
  tools: [
    {
      name: "talonic_list_events",
      title: "Workspace event feed",
      description: LIST_EVENTS,
      route: "GET /v1/events",
      inputSchema: {
        after: z
          .string()
          .max(64)
          .optional()
          .describe(
            "Resume point: a saved next_cursor or an event id. Returns newer events, oldest first.",
          ),
        since: z
          .string()
          .optional()
          .describe("Only events created at or after this ISO-8601 timestamp."),
        event_type: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe("One event type, or several (sent comma-separated)."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Events per page (default 50)."),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Events to skip on the newest-first listing; ignored with `after`."),
      },
      annotations: READ,
      query: ["after", "since", "event_type", "limit", "offset"],
    },
  ],
}
