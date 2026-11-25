import { z } from "zod"
import { zUuid } from "./_shared.js"
import { READ, REFUSALS, atLeastOne, write, type RouteTool } from "./_route-tools.js"

/**
 * Ingest operation tools: the workspace's processing queue, duplicate
 * detection (what was caught, and processing a caught duplicate anyway), and
 * which optional ingest steps run. Queue and duplicate tools hit
 * `/v1/extract/*` (`documents:read`, `documents:write` with the ingest
 * permission); the settings tools hit `/v1/settings/ingest-stages`
 * (`workspace:read`, `workspace:write` for an Admin).
 */

export const INGEST_OPERATION_TOOLS: readonly RouteTool[] = [
  {
    name: "talonic_ingest_queue_status",
    title: "Processing queue",
    description: [
      "How many of the workspace's documents are in each processing state (queued, extracting, completed, error, …). Workspace totals, as in the web app.",
      "USE WHEN: checking whether uploads are still being processed, or how many failed.",
      "NOT FOR: one document's state (talonic_get_document).",
    ].join("\n"),
    route: "GET /v1/extract/queue-status",
    input: {},
    annotations: READ,
  },
  {
    name: "talonic_ingest_duplicates",
    title: "Duplicate files",
    description: [
      "Groups of identical files in the workspace and how many documents carry a content fingerprint. A group lists only documents the key's person can see and is left out when fewer than two remain.",
      "RETURNS: { duplicate_groups, total_duplicate_files, groups[] { count, document_ids[], filenames[] }, … }.",
    ].join("\n"),
    route: "GET /v1/extract/dedup/stats",
    input: {},
    annotations: READ,
  },
  {
    name: "talonic_ingest_skipped_duplicates",
    title: "Uploads skipped as duplicates",
    description: [
      "Uploads that were not processed because an identical document already existed, newest first (up to 1000), each naming the existing document. Process one anyway with talonic_ingest_process_duplicate.",
      "RETURNS: { entries[] { existing_document_id, filename, … }, total }.",
    ].join("\n"),
    route: "GET /v1/extract/dedup/audit-log",
    input: {},
    annotations: READ,
  },
  {
    name: "talonic_ingest_process_duplicate",
    title: "Process a skipped duplicate anyway",
    description: [
      "Create a new document for an upload that was skipped as a duplicate. It reuses the existing document's content and values (the file is not read again). The existing document must be visible to the key's person. Needs the ingest permission.",
      "Pass `idempotency_key` (any unique string, reused on retries) to make a retry safe: the same key within 24 hours returns the first copy instead of creating another. The same key for another document is refused (409).",
      "RETURNS: { document { id, filename, status } }.",
      REFUSALS,
    ].join("\n"),
    route: "POST /v1/extract/dedup/process-anyway",
    input: {
      existing_document_id: zUuid().describe(
        "The document the upload matched (`existing_document_id` from talonic_ingest_skipped_duplicates).",
      ),
      filename: z
        .string()
        .max(500)
        .optional()
        .describe("Name of the new document; default the existing one's."),
      source_connection_id: zUuid()
        .optional()
        .describe("Source to attach it to; default the existing one's."),
      tags: z
        .array(z.string().max(64))
        .max(50)
        .optional()
        .describe("Tags of the new document; default the existing one's."),
      idempotency_key: z
        .string()
        .min(1)
        .max(255)
        .optional()
        .describe(
          "A unique string for this request; send the same one when retrying so only one copy is made.",
        ),
    },
    body: ["existing_document_id", "filename", "source_connection_id", "tags"],
    headers: { idempotency_key: "Idempotency-Key" },
    annotations: write(false),
  },
]

const STAGES = [
  "classification",
  "triage",
  "grounding_gate",
  "entity_linking",
  "delivery",
  "registry_binding",
]

export const INGEST_SETTINGS_TOOLS: readonly RouteTool[] = [
  {
    name: "talonic_ingest_settings",
    title: "Optional ingest steps",
    description: [
      "Which optional steps run when documents arrive in this workspace, each on by default: `classification` (document types), `triage` (sensitivity tags), `grounding_gate` (checking low-confidence values against the page), `entity_linking` (links between documents), `delivery` (the `document.extracted` notification to webhooks and destinations) and `registry_binding` (matching values to the workspace's fields).",
    ].join("\n"),
    route: "GET /v1/settings/ingest-stages",
    input: {},
    annotations: READ,
  },
  {
    name: "talonic_ingest_update_settings",
    title: "Turn optional ingest steps on or off",
    description: [
      "Turn optional ingest steps on or off; only the steps given change. Applies to documents that arrive from now on. Turning `delivery` off stops `document.extracted` notifications; turning `classification` off leaves new documents without a type. Admin only, as in the web app; call only when the user asks.",
      "RETURNS: the settings after the change.",
      REFUSALS,
    ].join("\n"),
    route: "PATCH /v1/settings/ingest-stages",
    input: {
      classification: z.boolean().optional().describe("Assign document types."),
      triage: z.boolean().optional().describe("Tag sensitive content."),
      grounding_gate: z
        .boolean()
        .optional()
        .describe("Check low-confidence values against the page."),
      entity_linking: z.boolean().optional().describe("Link related documents."),
      delivery: z.boolean().optional().describe("Send the `document.extracted` notification."),
      registry_binding: z.boolean().optional().describe("Match values to the workspace's fields."),
    },
    body: STAGES,
    validate: atLeastOne(...STAGES),
    annotations: write(true),
  },
]
