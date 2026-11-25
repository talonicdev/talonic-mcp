import type { DocBlock, Param, RawSection } from "../../types"

const tool = (name: string, text: string, params: Param[] = []): DocBlock[] => [
  { type: "heading", level: 3, id: name.replace(/_/g, "-"), text: name },
  { type: "paragraph", text },
  ...(params.length ? [{ type: "param-table" as const, params }] : []),
]

const folder: Param = {
  name: "folder_id",
  type: "UUID",
  required: true,
  description: "The transport folder.",
}
const doc: Param = {
  name: "document_id",
  type: "UUID",
  required: true,
  description: "A document of the folder.",
}
const load: Param = {
  name: "load_key",
  type: "string",
  required: true,
  description: "A load of the folder.",
}

export const section: RawSection = {
  slug: "transport-folders-tools",
  parentSlug: "tool-groups",
  title: "Transport Folders",
  seoTitle: "Transport Folders MCP Tools — Loads, Documents, Handover",
  description:
    "Use Transport Folders from an AI agent: list loads and documents that need a person, open the evidence, assign documents, confirm loads, get the customer set.",
  content: [
    {
      type: "paragraph",
      text: "Transport Folders turns each scanned packet of a transport into one folder, matches its documents to the transport's loads and judges each load: required documents on file, delivery confirmed, quantities agree. Documents that fit no single load wait for a person. With these tools an agent works the worklist, opens a folder's evidence, assigns a document to a load or confirms a load, and can take either back.",
    },
    {
      type: "callout",
      variant: "info",
      text: "These tools are listed only when Transport Folders is available to your connection. Every call is checked against your role in the workspace, exactly as in the app: documents are shown as you may see them, changing the settings needs an Admin, and locating values and confirming loads need the app switched on.",
    },
    {
      type: "list",
      ordered: true,
      items: [
        "`talonic_transport_folders_worklist` — loads not complete and documents not assigned.",
        "`talonic_transport_folders_get` — one folder's loads, documents and comparisons.",
        "`talonic_transport_folders_assign` or `talonic_transport_folders_confirm_load` — record the decision.",
        "`talonic_transport_folders_unassign` or `talonic_transport_folders_unconfirm_load` — take it back.",
      ],
    },
    ...tool(
      "talonic_transport_folders_list",
      "Every folder with its transport number, status and load counts, and whether the app is set up.",
    ),
    ...tool(
      "talonic_transport_folders_worklist",
      "Everything that needs a person across all folders: loads not complete and documents not assigned to a load.",
    ),
    ...tool(
      "talonic_transport_folders_get",
      "One folder: per load its verdict, what is missing, the record compared with the documents and whether it is confirmed; per document the load it belongs to and why, or the candidate loads and a suggestion.",
      [folder],
    ),
    ...tool(
      "talonic_transport_folders_boxes",
      "Where each captured value of a document sits on its pages, as far as already located.",
      [folder, doc],
    ),
    ...tool(
      "talonic_transport_folders_locate_document",
      "Find where a document's values sit on its page images and keep the result. Does nothing when already done.",
      [folder, doc],
    ),
    ...tool(
      "talonic_transport_folders_locate_folder",
      "Find where the values of every document of a folder sit on the page images.",
      [folder],
    ),
    ...tool(
      "talonic_transport_folders_assign",
      "Record which load a document belongs to, or that it belongs to no load. Your assignment wins over the matching.",
      [
        folder,
        doc,
        {
          name: "load_key",
          type: "string | null",
          required: true,
          description: "A load of the folder, or null for no load.",
        },
      ],
    ),
    ...tool(
      "talonic_transport_folders_unassign",
      "Withdraw an assignment, so the matching decides again.",
      [folder, doc],
    ),
    ...tool(
      "talonic_transport_folders_confirm_load",
      "Confirm a load as ready to invoice and hand its customer document set over. Records who confirmed and which documents.",
      [folder, load],
    ),
    ...tool("talonic_transport_folders_unconfirm_load", "Withdraw a load's confirmation.", [
      folder,
      load,
    ]),
    ...tool(
      "talonic_transport_folders_handover",
      "The customer document set of a load as one PDF (returned as an embedded file), with the archive filing values per document (`index`).",
      [folder, load],
    ),
    ...tool(
      "talonic_transport_folders_settings",
      "The app's settings and what they can be set to: your Specs and ready reference tables.",
    ),
    ...tool(
      "talonic_transport_folders_save_settings",
      "Change the settings; only the keys sent change and null clears one. Needs an Admin.",
      [
        {
          name: "pipeline_id",
          type: "UUID | null",
          description: "The Spec run whose results describe the documents.",
        },
        {
          name: "reference_data_id",
          type: "UUID | null",
          description: "The reference table holding the loads.",
        },
        {
          name: "folder_key_pattern",
          type: "string | null",
          description:
            "Regular expression whose first group is the transport number in a filename.",
        },
        {
          name: "matcher",
          type: "object | null",
          description: "Overrides of column names, field names and document type lists.",
        },
      ],
    ),
  ],
  related: [],
  faq: [],
  mentions: [],
}
