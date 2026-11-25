import { z } from "zod"
import { apiJson, buildUrl } from "./_http.js"
import { toolError, zUuid, type ToolResult } from "./_shared.js"
import { READ, buildRequest, describe, write, type GroupTool, type ToolGroup } from "./_groups.js"

/**
 * Transport Folders tools over `/v1/transport-folders/*`: one scanned packet
 * per transport, its documents matched to the transport's loads, each load
 * judged (required documents on file, delivery confirmed, quantities agree).
 * Documents that fit no single load wait for a person. Same service as the
 * web app; documents are filtered as the key's person, saving the settings
 * needs an Admin, locating values and confirming a load need the app
 * switched on.
 *
 * The loop: talonic_transport_folders_worklist → talonic_transport_folders_get
 * (evidence; talonic_transport_folders_boxes for where a value sits) →
 * talonic_transport_folders_assign / _confirm_load → _unassign /
 * _unconfirm_load to take it back.
 */

const folderId = zUuid().describe("The folder id (talonic_transport_folders_list or _worklist).")
const documentId = zUuid().describe("The document id, from the folder's documents.")
const loadKey = z.string().min(1).max(200).describe("The load key, from the folder's loads.")

const DETAIL_RETURNS =
  "the folder as talonic_transport_folders_get returns it, after the change: { id, folder_key, status, loads[] { key, verdict complete|check|missing, flags[], comparison[], handover[], confirmed }, documents[] { id, type, status auto|manual|folder|internal|review|pending, load_key, suggested_load_key, candidates[] }, … }."

/** Largest document set PDF returned inline. @internal */
export const HANDOVER_MAX_BYTES = 8 * 1024 * 1024

/** A tool result carrying the load's document set PDF as an embedded resource. */
interface HandoverResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "resource"; resource: { uri: string; mimeType: string; blob: string } }
  >
  structuredContent: Record<string, unknown>
  [key: string]: unknown
}

const handoverTool: GroupTool = {
  name: "talonic_transport_folders_handover",
  title: "Customer document set of a load",
  description: describe({
    what: "The customer document set of one load: one PDF with one document per required type (the copy the recipient confirmed where there is one), returned as an embedded PDF file (up to 8 MB), plus the archive filing values per document (`index`).",
    use: "the user wants the papers to send with the invoice for a load, usually after talonic_transport_folders_confirm_load.",
    not: "the folder's matching (talonic_transport_folders_get).",
    args: "`folder_id`, `load_key`.",
    returns:
      "a text item { filename, size, index[] } and a resource item { uri, mimeType application/pdf, blob }. 422 when the load has no document to hand over.",
  }),
  route: "GET /v1/transport-folders/{folderId}/loads/{loadKey}/handover",
  inputSchema: { folder_id: folderId, load_key: loadKey },
  annotations: READ,
  handler: async (ctx, args): Promise<ToolResult> => {
    try {
      const req = buildRequest(handoverTool, args)
      const r = await apiJson<{ filename: string; index: unknown[]; pdf_base64: string }>(
        ctx.getToken,
        ctx.baseUrl,
        req.method,
        req.path,
      )
      const meta = {
        filename: r.filename,
        size: Math.floor(((r.pdf_base64?.length ?? 0) * 3) / 4),
        index: r.index,
      }
      if (meta.size > HANDOVER_MAX_BYTES) {
        return toolError(
          new Error(
            `The document set is ${meta.size} bytes, over the ${HANDOVER_MAX_BYTES}-byte limit for a tool result. Download it from the Transport Folders app instead.`,
          ),
        )
      }
      const result: HandoverResult = {
        content: [
          { type: "text", text: JSON.stringify(meta) },
          {
            type: "resource",
            resource: {
              uri: buildUrl(ctx.baseUrl, req.path),
              mimeType: "application/pdf",
              blob: r.pdf_base64,
            },
          },
        ],
        structuredContent: meta,
      }
      return result as unknown as ToolResult
    } catch (err) {
      return toolError(err)
    }
  },
}

export const transportFoldersGroup: ToolGroup = {
  key: "transport_folders",
  label: "Transport Folders",
  docsSlug: "transport-folders-tools",
  probe: { path: "/v1/transport-folders/settings" },
  tools: [
    {
      name: "talonic_transport_folders_list",
      title: "Transport folders",
      description: describe({
        what: "Every transport folder (one scanned packet per transport) with its transport number, status (complete, check, missing, review, no_loads, processing) and load counts, and whether the app is set up.",
        use: "an overview of the folders, or finding one by transport number.",
        not: "only what needs a person (talonic_transport_folders_worklist); one folder's loads and documents (talonic_transport_folders_get).",
        returns: "{ configured, data[] { id, folder_key, status, loads, documents, … } }.",
      }),
      route: "GET /v1/transport-folders",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_transport_folders_worklist",
      title: "Transport Folders worklist",
      description: describe({
        what: "Everything that needs a person, across all folders: loads that are not complete and documents not assigned to a load.",
        use: "starting work; each entry names its folder for talonic_transport_folders_get.",
        not: "all folders (talonic_transport_folders_list).",
        returns:
          "{ loads[] { folder_id, load_key, verdict, flags, … }, documents[] { folder_id, document_id, type, suggested_load_key, … }, type_labels }.",
      }),
      route: "GET /v1/transport-folders/worklist",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_transport_folders_get",
      title: "One transport folder",
      description: describe({
        what: "One folder with its loads and matched documents: per load its verdict, what is missing, the record compared with the documents (naming the source document of each value) and whether it is confirmed; per document its type, the load it belongs to and why, or the candidate loads and a suggestion when it waits for a person.",
        use: "the evidence before assigning a document or confirming a load.",
        not: "where a value sits on the page (talonic_transport_folders_boxes).",
        args: "`folder_id`.",
        returns: DETAIL_RETURNS,
      }),
      route: "GET /v1/transport-folders/{folderId}",
      inputSchema: { folder_id: folderId },
      annotations: READ,
    },
    {
      name: "talonic_transport_folders_boxes",
      title: "Where a document's values sit",
      description: describe({
        what: "Where each captured value of one document sits on its pages (boxes as page fractions), as far as already located.",
        use: "pointing the user to the value on the scan.",
        not: "locating values that have no box yet (talonic_transport_folders_locate_document).",
        args: "`folder_id`, `document_id`.",
        returns: "{ document_id, pages[], boxes[] { field, value, page, x, y, w, h } }.",
      }),
      route: "GET /v1/transport-folders/{folderId}/documents/{documentId}/boxes",
      inputSchema: { folder_id: folderId, document_id: documentId },
      annotations: READ,
    },
    {
      name: "talonic_transport_folders_locate_document",
      title: "Locate a document's values",
      description: describe({
        what: "Find where each captured value of one document sits on its page images and keep the boxes. Does nothing when the values were already located. Needs the app switched on.",
        use: "talonic_transport_folders_boxes came back without boxes.",
        not: "a whole folder (talonic_transport_folders_locate_folder).",
        args: "`folder_id`, `document_id`.",
        returns: "the document's boxes, as talonic_transport_folders_boxes returns them.",
      }),
      route: "POST /v1/transport-folders/{folderId}/documents/{documentId}/locate",
      inputSchema: { folder_id: folderId, document_id: documentId },
      annotations: write(true),
    },
    {
      name: "talonic_transport_folders_locate_folder",
      title: "Locate a folder's values",
      description: describe({
        what: "Find where the captured values of every document of a folder sit on the page images. Documents already located are skipped. Needs the app switched on.",
        use: "before going through a folder's documents on screen.",
        not: "one document (talonic_transport_folders_locate_document).",
        args: "`folder_id`.",
        returns: "per document whether boxes are now stored.",
      }),
      route: "POST /v1/transport-folders/{folderId}/locate",
      inputSchema: { folder_id: folderId },
      annotations: write(true),
    },
    {
      name: "talonic_transport_folders_assign",
      title: "Assign a document to a load",
      description: describe({
        what: "Record which load a document belongs to, or that it belongs to no load (`load_key` null). A person's assignment wins over the matching. Undo with talonic_transport_folders_unassign.",
        use: "a document waits for review, or was matched to the wrong load.",
        not: "confirming the load (talonic_transport_folders_confirm_load).",
        args: "`folder_id`, `document_id`, `load_key` (a load of this folder, or null for no load).",
        returns: DETAIL_RETURNS,
        errors: "400 load_key is not a load of this folder; 404 document not in this folder.",
      }),
      route: "POST /v1/transport-folders/{folderId}/documents/{documentId}/assign",
      inputSchema: {
        folder_id: folderId,
        document_id: documentId,
        load_key: z
          .string()
          .max(200)
          .nullable()
          .describe("The load the document belongs to; null = it belongs to no load."),
      },
      annotations: write(true),
      body: ["load_key"],
    },
    {
      name: "talonic_transport_folders_unassign",
      title: "Withdraw a document's assignment",
      description: describe({
        what: "Withdraw a person's assignment of a document, so the matching decides again.",
        use: "an assignment made with talonic_transport_folders_assign was wrong.",
        args: "`folder_id`, `document_id`.",
        returns: DETAIL_RETURNS,
      }),
      route: "DELETE /v1/transport-folders/{folderId}/documents/{documentId}/assign",
      inputSchema: { folder_id: folderId, document_id: documentId },
      annotations: write(true),
    },
    {
      name: "talonic_transport_folders_confirm_load",
      title: "Confirm a load",
      description: describe({
        what: "Confirm a load as ready to invoice and hand its customer document set over. Records who confirmed and which documents. Needs the app switched on. Undo with talonic_transport_folders_unconfirm_load.",
        use: "the load's verdict is complete, or the user checked it and accepts it.",
        not: "getting the PDF (talonic_transport_folders_handover).",
        args: "`folder_id`, `load_key`.",
        returns: DETAIL_RETURNS,
      }),
      route: "POST /v1/transport-folders/{folderId}/loads/{loadKey}/confirm",
      inputSchema: { folder_id: folderId, load_key: loadKey },
      annotations: write(true),
    },
    {
      name: "talonic_transport_folders_unconfirm_load",
      title: "Withdraw a load's confirmation",
      description: describe({
        what: "Withdraw the confirmation of a load.",
        use: "a load was confirmed by mistake.",
        args: "`folder_id`, `load_key`.",
        returns: DETAIL_RETURNS,
      }),
      route: "DELETE /v1/transport-folders/{folderId}/loads/{loadKey}/confirm",
      inputSchema: { folder_id: folderId, load_key: loadKey },
      annotations: write(true),
    },
    handoverTool,
    {
      name: "talonic_transport_folders_settings",
      title: "Transport Folders settings",
      description: describe({
        what: "The app's settings (the Spec whose results describe the documents, the reference table holding the loads, the pattern that reads the transport number from a filename, matching overrides) and what they can be set to (the workspace's Specs and ready reference tables).",
        use: "setting up the app, or explaining why a folder has no loads.",
        not: "changing them (talonic_transport_folders_save_settings).",
        returns:
          "{ settings, pipelines[] { id, name, status }, reference_tables[] { id, name, row_count } }.",
      }),
      route: "GET /v1/transport-folders/settings",
      inputSchema: {},
      annotations: READ,
    },
    {
      name: "talonic_transport_folders_save_settings",
      title: "Change Transport Folders settings",
      description: describe({
        what: "Change the app's settings. Only the keys sent change; null clears one. Needs an Admin of the workspace.",
        use: "setting up the app or pointing it at another Spec or reference table.",
        args: "`pipeline_id` (from talonic_transport_folders_settings pipelines), `reference_data_id`, `folder_key_pattern` (a regular expression whose first group is the transport number), `matcher` (overrides of column names, field names, document type lists).",
        returns:
          "the settings and choices, as talonic_transport_folders_settings returns them. 400 for an invalid pattern.",
      }),
      route: "PUT /v1/transport-folders/settings",
      inputSchema: {
        pipeline_id: zUuid()
          .nullable()
          .optional()
          .describe("The Spec run whose results describe the documents."),
        reference_data_id: zUuid()
          .nullable()
          .optional()
          .describe("The reference table holding the loads."),
        folder_key_pattern: z
          .string()
          .max(200)
          .nullable()
          .optional()
          .describe("Regular expression; its first group is the transport number in a filename."),
        matcher: z
          .record(z.string(), z.unknown())
          .nullable()
          .optional()
          .describe("Overrides of the matching defaults."),
      },
      annotations: write(true),
      body: ["pipeline_id", "reference_data_id", "folder_key_pattern", "matcher"],
    },
  ],
}
