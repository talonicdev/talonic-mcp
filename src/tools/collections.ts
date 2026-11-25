import { z } from "zod"
import { apiJson, runTool } from "./_http.js"
import { zUuid } from "./_shared.js"
import { READ, REFUSALS, atLeastOne, destructive, write, type RouteTool } from "./_route-tools.js"

/**
 * Collection tools: named groups of documents, filled by rules (every
 * document of a source, a document type or a case) and by hand, optionally
 * assigned to people or groups. All hit `/v1/collections/*` with the
 * caller's bearer; reads need `documents:read`, writes `documents:write` and
 * an Admin, as in the web app. Document lists show only what the key's person
 * can see.
 */

const collectionId = zUuid().describe("The collection, from talonic_collections_list.")
const C = "/v1/collections/{collection_id}"

const name = z.string().min(1).max(200).describe("Name, up to 200 characters.")
const description = z.string().max(2000).optional().describe("What the collection holds.")
const kind = z
  .enum(["collection", "account"])
  .optional()
  .describe("`account` makes it an account (one company; a document belongs to one account).")
const aliases = z
  .array(z.string().max(200))
  .max(50)
  .optional()
  .describe("Other names the account goes by.")

export const COLLECTION_TOOLS: readonly RouteTool[] = [
  {
    name: "talonic_collections_list",
    title: "Collections",
    description: [
      "The workspace's collections. `view`: `all` (default) lists every collection with its rule, document and assignment counts; `mine` the collections assigned to the key's person; `counts` the number of visible documents per collection.",
      "Start here; use the id with the other talonic_collections_* tools. Accounts are collections with kind `account`.",
    ].join("\n"),
    route: "GET /v1/collections",
    alsoRoutes: ["GET /v1/collections/mine", "GET /v1/collections/counts"],
    input: {
      view: z.enum(["all", "mine", "counts"]).optional().describe("all (default), mine or counts."),
    },
    handler: (a, ctx) =>
      runTool(() =>
        apiJson(
          ctx.getToken,
          ctx.baseUrl,
          "GET",
          a["view"] === "mine" || a["view"] === "counts"
            ? `/v1/collections/${a["view"]}`
            : "/v1/collections",
        ),
      ),
    annotations: READ,
  },
  {
    name: "talonic_collections_create",
    title: "Create a collection",
    description: [
      "Create a collection (or, with kind `account`, an account). It starts empty: fill it with talonic_collections_add_rule or talonic_collections_add_documents. Admin only. 409 when the name is taken.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/collections",
    input: { name, description, kind, aliases },
    body: ["name", "description", "kind", "aliases"],
    annotations: write(false),
  },
  {
    name: "talonic_collections_preview",
    title: "Preview a collection's documents",
    description:
      "A sample of the documents the collection holds under its current rules and hand-added documents, limited to what the key's person can see. Admin only, as in the web app.",
    route: `GET ${C}/preview`,
    input: { collection_id: collectionId },
    annotations: READ,
  },
  {
    name: "talonic_collections_update",
    title: "Change a collection",
    description: [
      "Rename or describe a collection, or change its kind or aliases. Admin only.",
      REFUSALS,
    ].join("\n"),
    route: `PATCH ${C}`,
    input: { collection_id: collectionId, name: name.optional(), description, kind, aliases },
    body: ["name", "description", "kind", "aliases"],
    validate: atLeastOne("name", "description", "kind", "aliases"),
    annotations: write(true),
  },
  {
    name: "talonic_collections_delete",
    title: "Delete a collection",
    description: [
      "Delete a collection with its rules, hand-added documents and assignments. The documents themselves stay. People assigned to it with mode `enforced` lose the view it gave them. Cannot be undone: call only when the user asked to delete this collection by name. Admin only.",
      REFUSALS,
    ].join("\n"),
    route: `DELETE ${C}`,
    input: { collection_id: collectionId },
    annotations: destructive(true),
  },
  {
    name: "talonic_collections_rules",
    title: "Rules of a collection",
    description: "The rules that fill a collection: each names a `rule_type` and a `rule_value`.",
    route: `GET ${C}/rules`,
    input: { collection_id: collectionId },
    annotations: READ,
  },
  {
    name: "talonic_collections_add_rule",
    title: "Add a rule to a collection",
    description: [
      "Add a rule: every document of a source (`source_connection`, value = the source id), a document type (`document_type`, value = the type id) or a case (`case`, value = the case id) joins the collection, including documents that arrive later. Admin only.",
      REFUSALS,
    ].join("\n"),
    route: `POST ${C}/rules`,
    input: {
      collection_id: collectionId,
      rule_type: z
        .enum(["source_connection", "document_type", "case"])
        .describe("What the rule matches: a source, a document type or a case."),
      rule_value: z
        .string()
        .min(1)
        .max(200)
        .describe("The id of the source, document type or case."),
    },
    body: ["rule_type", "rule_value"],
    annotations: write(false),
  },
  {
    name: "talonic_collections_remove_rule",
    title: "Remove a rule from a collection",
    description: [
      "Remove one rule; the documents it brought in leave the collection unless another rule or a hand-add keeps them. Admin only.",
      REFUSALS,
    ].join("\n"),
    route: `DELETE ${C}/rules/{rule_id}`,
    input: {
      collection_id: collectionId,
      rule_id: zUuid().describe("The rule, from talonic_collections_rules."),
    },
    annotations: destructive(true),
  },
  {
    name: "talonic_collections_documents",
    title: "Hand-added documents of a collection",
    description:
      "The documents added to a collection by hand (not those its rules bring in), limited to what the key's person can see. For everything the collection holds, use talonic_collections_preview.",
    route: `GET ${C}/documents`,
    input: { collection_id: collectionId },
    annotations: READ,
  },
  {
    name: "talonic_collections_add_documents",
    title: "Add documents to a collection",
    description: [
      "Add documents to a collection by hand. Every id must be a document the key's person can see (404 otherwise, nothing added). Admin only.",
      REFUSALS,
    ].join("\n"),
    route: `POST ${C}/documents`,
    input: {
      collection_id: collectionId,
      document_ids: z.array(zUuid()).min(1).max(1000).describe("Documents to add."),
    },
    body: ["document_ids"],
    annotations: write(true),
  },
  {
    name: "talonic_collections_remove_document",
    title: "Take a document out of a collection",
    description: [
      "Take one hand-added document out of a collection. A rule of the collection may still include it. Admin only.",
      REFUSALS,
    ].join("\n"),
    route: `DELETE ${C}/documents/{document_id}`,
    input: {
      collection_id: collectionId,
      document_id: zUuid().describe("The document, from talonic_collections_documents."),
    },
    annotations: destructive(true),
  },
  {
    name: "talonic_collections_assignments",
    title: "Who a collection is assigned to",
    description:
      "The people and groups a collection is assigned to, each with its mode (`enforced` or `default`).",
    route: `GET ${C}/assignments`,
    input: { collection_id: collectionId },
    annotations: READ,
  },
  {
    name: "talonic_collections_assign",
    title: "Assign a collection",
    description: [
      "Assign a collection to a person (`user`) or a `group`. Mode `enforced` limits what they see to the collection's documents; `default` only preselects it for them. `enforced` changes what someone can see: call only when the user asked. Admin only.",
      REFUSALS,
    ].join("\n"),
    route: `POST ${C}/assignments`,
    input: {
      collection_id: collectionId,
      principal_type: z.enum(["user", "group"]).describe("A person or a group."),
      principal_id: zUuid().describe("The person's user id or the group id."),
      mode: z
        .enum(["enforced", "default"])
        .describe("enforced: they see only the collection; default: preselected for them."),
    },
    body: ["principal_type", "principal_id", "mode"],
    annotations: write(false),
  },
  {
    name: "talonic_collections_unassign",
    title: "Remove a collection assignment",
    description: [
      "Remove one assignment. A person who was limited to the collection (mode `enforced`) sees their usual documents again. Admin only.",
      REFUSALS,
    ].join("\n"),
    route: `DELETE ${C}/assignments/{assignment_id}`,
    input: {
      collection_id: collectionId,
      assignment_id: zUuid().describe("The assignment, from talonic_collections_assignments."),
    },
    annotations: destructive(true),
  },
]
