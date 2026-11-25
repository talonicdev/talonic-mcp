import { z } from "zod"
import { READ, describe, type ToolGroup } from "./_groups.js"
import { zUuid } from "./_shared.js"

/**
 * Customs declaration tools over the platform's public
 * `/v1/customs-declaration/*`: orders whose transport documents are compared
 * with the customs declaration filed for them, each comparison field by
 * field, plus the checks every order must pass.
 *
 * The loop: talonic_customs_declaration_issues (orders with a failing check)
 * → talonic_customs_declaration_orders with `q` = the order's LRN (the
 * field-by-field comparison and the documents it rests on) → the correction
 * happens on the documents (re-read or fix the value), after which the order
 * is compared again. The review, link and import routes are source-only (no
 * public operation yet) and have no tool.
 */

const pipelineId = zUuid()
  .optional()
  .describe("The pipeline (talonic_customs_declaration_pipelines); default: the workspace's first.")

export const customsDeclarationGroup: ToolGroup = {
  key: "customs_declaration",
  label: "Customs declaration",
  docsSlug: "customs-declaration-tools",
  probe: { path: "/v1/customs-declaration/pipelines" },
  tools: [
    {
      name: "talonic_customs_declaration_pipelines",
      title: "Customs declaration pipelines",
      description: describe({
        what: "The pipelines whose Spec compares transport documents with a filed customs declaration.",
        use: "finding the pipeline_id the other customs tools take, when the workspace has more than one.",
        returns: "{ data[] } pipelines with id and name.",
      }),
      route: "GET /v1/customs-declaration/pipelines",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_customs_declaration_issues",
      title: "Customs declaration worklist",
      description: describe({
        what: "The worklist: orders with a failing check, with the checks that fail (message and fields concerned) and the fields where documents and declaration differ or a value is missing.",
        use: "'which declarations are not ready to file', the starting point before opening an order.",
        not: "every order including ready ones (talonic_customs_declaration_orders).",
        args: "`pipeline_id` (optional).",
        returns:
          "{ pipeline, read, available, truncated, data[] { lrn, record_document_id, sender, receiver, checks[] { id, message, fields }, differs[] } }. truncated = more orders exist than were read.",
      }),
      route: "GET /v1/customs-declaration/issues",
      inputSchema: { pipeline_id: pipelineId },
      annotations: READ,
      query: ["pipeline_id"],
    },
    {
      name: "talonic_customs_declaration_orders",
      title: "Customs declaration orders",
      description: describe({
        what: "Orders of a pipeline with their field-by-field comparison (document value, declared value, state match / mismatch / missing) and checks; the evidence for one order's issues.",
        use: "retrieving the evidence behind an issue (filter with `q` = its LRN), or listing orders ready to file.",
        args: "`pipeline_id`, `status` ready|review, `q` (LRN, sender, receiver or plates contains), `page` and `limit` (1-200; either asks for one page).",
        returns:
          "{ pipeline, read, available, items[] { lrn, ready, sender, receiver, plates, record_document_id, comparison[], checks[] }, page? { page, limit, total, filtered } }.",
      }),
      route: "GET /v1/customs-declaration/declarations",
      inputSchema: {
        pipeline_id: pipelineId,
        status: z
          .enum(["ready", "review"])
          .optional()
          .describe("ready = every check passes; review = at least one fails."),
        q: z.string().max(200).optional().describe("LRN, sender, receiver or plates contains."),
        page: z.number().int().min(1).optional().describe("Page number (asks for one page)."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Orders per page, at most 200 (default 50)."),
      },
      annotations: READ,
      query: ["pipeline_id", "status", "q", "page", "limit"],
    },
  ],
}
