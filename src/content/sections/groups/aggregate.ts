import type { RawSection } from "../../types"

export const section: RawSection = {
  slug: "aggregate-tools",
  parentSlug: "tool-groups",
  title: "Workspace metrics",
  seoTitle: "talonic_aggregate — Workspace Metrics in One MCP Call",
  description:
    "MCP tools that answer monitoring questions about a Talonic workspace in one call: documents received or failed, app verdicts, deliveries and cost per document.",
  content: [
    {
      type: "paragraph",
      text: "Ask for several numbers about the workspace in one request: how many documents arrived or failed in the last 12 hours, how many lack a value, verdicts by state, median cost per document. Only numbers come back, never document content, and only documents the connected person may see are counted.",
    },
    {
      type: "callout",
      variant: "info",
      text: "Listed when the workspace offers metrics to the connection. One metrics request per workspace runs at a time; a second one answers 429 and should be retried after a few seconds.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-aggregate-catalog",
      text: "talonic_aggregate_catalog",
    },
    {
      type: "paragraph",
      text: "What can be counted: every dataset with its fields, which fields can be grouped and filtered with which operators, the measures, the limits (window length, queries per request) and whether this workspace may see cost fields. Free; call it before the first metrics request.",
    },
    { type: "heading", level: 3, id: "talonic-aggregate", text: "talonic_aggregate" },
    {
      type: "paragraph",
      text: "Computes several named numbers (20 by default) over a half-open window `[from, to)` of at most 31 days by default; the catalog states the limits that apply. Each query picks a dataset and a measure (`count`, `count_distinct`, `sum`, `avg`, `min`, `max`, `median`, `p1`-`p99`), optional filters and up to three group-by fields or `hour` / `day`. A count over nothing is `0`; an average or percentile over nothing is `null`. Cost fields are in US dollars.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "from",
          type: "string",
          required: true,
          description: "Window start, inclusive, ISO-8601 with an offset (`2026-11-05T12:00:00Z`).",
        },
        {
          name: "to",
          type: "string",
          required: true,
          description: "Window end, exclusive, with an offset.",
        },
        {
          name: "scope",
          type: "object",
          description:
            "Document selectors for every query: `document_ids`, `tags`, `system_tags`, `source_connection_ids`, `document_types`, `client_batch_ids`, `roots_only`, `attachments_only`.",
        },
        {
          name: "queries",
          type: "object[]",
          required: true,
          description:
            "Each `{ id, dataset, measure, of?, where?, group_by? }`; `id` is lowercase letters, digits and underscores and keys the result.",
        },
      ],
    },
    {
      type: "code",
      language: "json",
      title: "Documents received and failed today",
      code: '{\n  "from": "2026-11-25T00:00:00Z",\n  "to": "2026-11-26T00:00:00Z",\n  "queries": [\n    { "id": "received", "dataset": "documents", "measure": "count" },\n    { "id": "failed", "dataset": "documents", "measure": "count", "where": [{ "field": "failed", "op": "eq", "value": true }] }\n  ]\n}',
    },
    {
      type: "paragraph",
      text: "Errors: `400 invalid_aggregate` names the allowed datasets, fields or measures; `403 cost_not_visible` when the workspace may not see costs; `422 aggregate_timeout` names the dataset to narrow.",
    },
  ],
  related: [],
  faq: [],
  mentions: [],
}
