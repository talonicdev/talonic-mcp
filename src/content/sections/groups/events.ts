import type { RawSection } from "../../types"

export const section: RawSection = {
  slug: "events-tools",
  parentSlug: "tool-groups",
  title: "Events",
  seoTitle: "talonic_list_events — Read the Talonic Workspace Event Feed",
  description:
    "MCP tool that reads your Talonic workspace's event feed (extractions, run results, review verdicts, deliveries) and resumes from a saved cursor later.",
  content: [
    {
      type: "paragraph",
      text: "**`talonic_list_events`** reads what happened in the workspace: documents extracted, runs completed or failed, review verdicts, delivery outcomes. These are the same events your webhooks receive, so an agent or a scheduled job can catch up on anything a webhook missed, or answer “what failed since this morning?”.",
    },
    {
      type: "callout",
      variant: "info",
      text: "Listed when the connection can read the workspace. Only events about documents the connected person may see are returned.",
    },
    { type: "heading", level: 3, id: "talonic-list-events", text: "talonic_list_events" },
    {
      type: "paragraph",
      text: "Two ways to page. Without `after` you get the newest events first, paged with `limit` and `offset`. With `after` set to an event id or a saved `next_cursor`, you get strictly newer events, oldest first: process them in order, save the returned `next_cursor`, and pass it as `after` next time. `next_cursor` is `null` only at the end of the feed.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "after",
          type: "string",
          description:
            "Resume point: a saved `next_cursor` or an event id. Returns newer events, oldest first.",
        },
        {
          name: "since",
          type: "string",
          description: "Only events created at or after this ISO-8601 time.",
        },
        {
          name: "event_type",
          type: "string | string[]",
          description: "One event type or several.",
        },
        { name: "limit", type: "integer", description: "Events per page, 1-200.", default: "50" },
        {
          name: "offset",
          type: "integer",
          description: "Events to skip on the newest-first listing.",
        },
      ],
    },
    {
      type: "code",
      language: "json",
      title: "Resume from a saved cursor",
      code: '{ "after": "1042", "limit": 100 }\n\n→ { "data": [{ "id": "1043", "event_type": "extraction.completed", "payload": { … }, "created_at": "2026-11-25T07:01:12Z" }], "next_cursor": "1043" }',
    },
  ],
  related: [],
  faq: [],
  mentions: [],
}
