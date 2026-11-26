import { z } from "zod"
import { zUuid } from "./_shared.js"
import { READ, REFUSALS, destructive, write, type RouteTool } from "./_route-tools.js"

/**
 * Saved filter tools: the filter presets shown in the web app's filter
 * picker. Listing reads the workspace's presets; saving and deleting act on
 * the key's person's own presets, which any member may do, so both need only
 * `documents:read`. All hit `/v1/search/saved-filters`.
 */

export const SAVED_FILTER_TOOLS: readonly RouteTool[] = [
  {
    name: "talonic_saved_filters_list",
    title: "Saved filters",
    description: [
      "The workspace's saved filter presets, newest first: name, conditions, search text, sort and source. Narrow to one source with `source_id`.",
      "Run a preset's conditions with talonic_filter.",
    ].join("\n"),
    route: "GET /v1/search/saved-filters",
    input: { source_id: zUuid().optional().describe("Only presets of this source.") },
    query: ["source_id"],
    annotations: READ,
  },
  {
    name: "talonic_saved_filters_create",
    title: "Save a filter",
    description: [
      "Save a filter preset for the key's person, so it appears in their filter picker in the web app. `conditions` take the same shape as talonic_filter's conditions.",
      "RETURNS: { id, name, conditions, search, sort, source_connection_id, created_at, updated_at }.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/search/saved-filters",
    input: {
      name: z
        .string()
        .min(1)
        .max(200)
        .regex(/\S/, "a name needs a visible character")
        .describe("Name in the picker."),
      conditions: z
        .array(z.record(z.string(), z.unknown()))
        .max(100)
        .optional()
        .describe("Filter conditions, as talonic_filter takes them."),
      search: z.string().max(1000).optional().describe("Free-text search kept with the filter."),
      sort: z.record(z.string(), z.unknown()).optional().describe("Sort kept with the filter."),
      source_connection_id: zUuid().optional().describe("Narrow the filter to one source."),
    },
    body: ["name", "conditions", "search", "sort", "source_connection_id"],
    annotations: write(false),
  },
  {
    name: "talonic_saved_filters_delete",
    title: "Delete a saved filter",
    description: [
      "Delete one of the key's person's own saved filters (404 for anyone else's). Cannot be undone.",
      REFUSALS,
    ].join("\n"),
    route: "DELETE /v1/search/saved-filters/{filter_id}",
    input: { filter_id: zUuid().describe("The preset, from talonic_saved_filters_list.") },
    annotations: destructive(true),
  },
]
