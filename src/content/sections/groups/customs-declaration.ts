import type { RawSection } from "../../types"

// Generated from src/tools/customs-declaration.ts (names, summaries, parameters); keep in step with it.
export const section: RawSection = {
  slug: "customs-declaration-tools",
  parentSlug: "tool-groups",
  title: "Customs declaration",
  seoTitle: "Customs Declaration MCP Tools — Compare and Check Orders",
  description:
    "MCP tools for the Talonic customs declaration app: list orders whose documents and filed declaration disagree, and read the field-by-field comparison per order.",
  content: [
    {
      type: "paragraph",
      text: "Compare the transport documents of each order with the customs declaration filed for it, field by field, and see which orders fail a check before filing.",
    },
    {
      type: "paragraph",
      text: "The usual loop: **`talonic_customs_declaration_issues`** lists the orders that fail a check, and **`talonic_customs_declaration_orders`** with `q` set to the order's LRN shows the comparison and the documents behind it. Corrections happen on the documents themselves; the order is compared again afterwards.",
    },
    {
      type: "callout",
      variant: "info",
      text: "These tools are listed only when the Customs declaration app is available to the connection. Every call is checked against the role and permissions of the person behind the connection, exactly as in the web app.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-customs-declaration-pipelines",
      text: "talonic_customs_declaration_pipelines",
    },
    {
      type: "paragraph",
      text: "The pipelines whose Spec compares transport documents with a filed customs declaration.",
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-customs-declaration-issues",
      text: "talonic_customs_declaration_issues",
    },
    {
      type: "paragraph",
      text: "The worklist: orders with a failing check, with the checks that fail (message and fields concerned) and the fields where documents and declaration differ or a value is missing.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "pipeline_id",
          type: "UUID",
          required: false,
          description:
            "The pipeline (talonic_customs_declaration_pipelines); default: the workspace's first.",
        },
      ],
    },
    {
      type: "heading",
      level: 3,
      id: "talonic-customs-declaration-orders",
      text: "talonic_customs_declaration_orders",
    },
    {
      type: "paragraph",
      text: "Orders of a pipeline with their field-by-field comparison (document value, declared value, state match / mismatch / missing) and checks; the evidence for one order's issues.",
    },
    {
      type: "param-table",
      params: [
        {
          name: "pipeline_id",
          type: "UUID",
          required: false,
          description:
            "The pipeline (talonic_customs_declaration_pipelines); default: the workspace's first.",
        },
        {
          name: "status",
          type: '"ready" | "review"',
          required: false,
          description: "ready = every check passes; review = at least one fails.",
        },
        {
          name: "q",
          type: "string",
          required: false,
          description: "LRN, sender, receiver or plates contains.",
        },
        {
          name: "page",
          type: "integer",
          required: false,
          description: "Page number (asks for one page).",
        },
        {
          name: "limit",
          type: "integer",
          required: false,
          description: "Orders per page, at most 200 (default 50).",
        },
      ],
    },
  ],
  related: [],
  faq: [],
  mentions: [],
}
