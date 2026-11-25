import { z } from "zod"
import { apiJson, runTool } from "./_http.js"
import { zUuid } from "./_shared.js"
import { READ, REFUSALS, atLeastOne, destructive, write, type RouteTool } from "./_route-tools.js"

/**
 * Document type tools: the workspace's document types, and the types
 * proposed while new documents were sorted that wait for a decision (create
 * them, merge them into an existing type or into each other, or dismiss
 * them). All hit `/v1/document-types/*`; reads need `documents:read`, writes
 * `documents:write` and an Admin of a workspace that configures its own
 * processing, as in the web app.
 */

const PC = "/v1/document-types/pending-confirmations"

const proposalItem = z.object({
  id: zUuid().describe("The proposal, from talonic_document_types_pending."),
  action: z
    .enum(["create", "merge"])
    .describe("create the proposed type, or merge it into an existing one."),
  merge_into_type_id: zUuid()
    .optional()
    .describe("With merge: the existing type (talonic_document_types_list)."),
})

const mergeNeedsTarget = (a: { action?: unknown; merge_into_type_id?: unknown }) =>
  a.action === "merge" && typeof a.merge_into_type_id !== "string"

export const DOCUMENT_TYPE_TOOLS: readonly RouteTool[] = [
  {
    name: "talonic_document_types_list",
    title: "Document types",
    description:
      "The workspace's document types with how many documents each has, most used first. USE WHEN: finding a type id for talonic_document_types_resolve_pending, talonic_document_types_update or a collection rule.",
    route: "GET /v1/document-types",
    input: {},
    annotations: READ,
  },
  {
    name: "talonic_document_types_create",
    title: "Create a document type",
    description: [
      "Create a document type for the workspace.",
      "RETURNS: { id, name, document_count, … }.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/document-types",
    input: {
      name: z.string().min(1).max(200).describe("The type's name."),
      description: z.string().max(2000).optional().describe("What documents of this type are."),
    },
    body: ["name", "description"],
    annotations: write(false),
  },
  {
    name: "talonic_document_types_update",
    title: "Change a document type",
    description: ["Rename a document type or change its description.", REFUSALS].join("\n"),
    route: "PATCH /v1/document-types/{type_id}",
    input: {
      type_id: zUuid().describe("The type, from talonic_document_types_list."),
      name: z.string().min(1).max(200).optional().describe("The new name."),
      description: z.string().max(2000).optional().describe("The new description."),
    },
    body: ["name", "description"],
    validate: atLeastOne("name", "description"),
    annotations: write(true),
  },
  {
    name: "talonic_document_types_pending",
    title: "Proposed document types",
    description: [
      "Document types proposed while new documents were sorted, waiting for a decision, with suggestions: create as is, merge similar proposals together, or merge into a close existing type. With `count_only: true`, only how many wait.",
      "Decide with talonic_document_types_resolve_pending, _resolve_pending_batch, _merge_pending, _auto_resolve or _dismiss_pending.",
    ].join("\n"),
    route: `GET ${PC}`,
    alsoRoutes: [`GET ${PC}/count`],
    input: { count_only: z.boolean().optional().describe("true: answer only { count }.") },
    handler: (a, ctx) =>
      runTool(() =>
        apiJson(ctx.getToken, ctx.baseUrl, "GET", a["count_only"] === true ? `${PC}/count` : PC),
      ),
    annotations: READ,
  },
  {
    name: "talonic_document_types_resolve_pending",
    title: "Decide one proposed document type",
    description: [
      "Settle one proposal: `create` makes the proposed type, `merge` folds it into `merge_into_type_id`. Its documents move with it.",
      REFUSALS,
    ].join("\n"),
    route: `POST ${PC}/{proposal_id}/resolve`,
    input: {
      proposal_id: zUuid().describe("The proposal, from talonic_document_types_pending."),
      action: z
        .enum(["create", "merge"])
        .describe("create the proposed type, or merge it into an existing one."),
      merge_into_type_id: zUuid().optional().describe("With merge: the existing type."),
    },
    body: ["action", "merge_into_type_id"],
    validate: (a) => (mergeNeedsTarget(a) ? "action `merge` needs `merge_into_type_id`." : null),
    annotations: write(false),
  },
  {
    name: "talonic_document_types_resolve_pending_batch",
    title: "Decide many proposed document types",
    description: [
      "Settle up to 200 proposals in one call, each with `create` or `merge`. Answers a result per item.",
      REFUSALS,
    ].join("\n"),
    route: `POST ${PC}/resolve-batch`,
    input: {
      items: z.array(proposalItem).min(1).max(200).describe("One decision per proposal, 1 to 200."),
    },
    body: ["items"],
    validate: (a) => {
      const bad = ((a["items"] ?? []) as Array<Record<string, unknown>>).findIndex(mergeNeedsTarget)
      return bad >= 0 ? `items[${bad}]: action \`merge\` needs \`merge_into_type_id\`.` : null
    },
    annotations: write(false),
  },
  {
    name: "talonic_document_types_merge_pending",
    title: "Merge proposed document types into one",
    description: [
      "Merge several proposals into one new type named `chosen_name`; their documents move to it.",
      REFUSALS,
    ].join("\n"),
    route: `POST ${PC}/merge-pending`,
    input: {
      pending_ids: z.array(zUuid()).min(1).describe("The proposals to merge."),
      chosen_name: z.string().min(1).max(200).describe("The new type's name."),
    },
    body: ["pending_ids", "chosen_name"],
    annotations: write(false),
  },
  {
    name: "talonic_document_types_auto_resolve",
    title: "Settle every proposed document type",
    description: [
      "Settle every waiting proposal automatically: each is matched to Talonic's standard type list and merged where a matching type exists; the rest are created. Call only when the user wants all of them settled without reviewing each.",
      REFUSALS,
    ].join("\n"),
    route: `POST ${PC}/auto-resolve`,
    input: {},
    annotations: write(false),
  },
  {
    name: "talonic_document_types_dismiss_pending",
    title: "Dismiss a proposed document type",
    description: ["Dismiss one proposal without creating a type.", REFUSALS].join("\n"),
    route: `DELETE ${PC}/{proposal_id}`,
    input: { proposal_id: zUuid().describe("The proposal, from talonic_document_types_pending.") },
    annotations: destructive(true),
  },
]
