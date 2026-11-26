// Hand-written copy for each generated tool reference page: the task it
// serves, search-result copy, examples, FAQ and related links. Everything
// else on the page (summary, how to use it, parameters, availability,
// behaviour) comes from the live tool registry; see sections/tool-reference.ts.

import type { ToolPage } from "./tool-reference-types"
import { PROCESS_BUILD_PAGES } from "./pages/process-build"
import { SPEC_AND_SOURCE_PAGES } from "./pages/specs-sources"
import { OPERATIONS_PAGES } from "./pages/operations"
import { REVIEW_AND_DATA_PAGES } from "./pages/review-data"
import { ADMIN_AND_THREAD_PAGES } from "./pages/admin-thread"
import { APP_WORKFLOW_PAGES } from "./pages/app-workflows"

// Tools that arrived with the probe-gated groups keep their copy in
// src/content/pages/*.ts, one file per area; the first block below is the
// public groups and the original Process Plane tools.
export const TOOL_PAGES: Record<string, ToolPage> = {
  ...PROCESS_BUILD_PAGES,
  ...SPEC_AND_SOURCE_PAGES,
  ...OPERATIONS_PAGES,
  ...REVIEW_AND_DATA_PAGES,
  ...ADMIN_AND_THREAD_PAGES,
  ...APP_WORKFLOW_PAGES,
  talonic_list_schemas: {
    task: "extract",
    seoTitle: "talonic_list_schemas — List Saved Extraction Schemas",
    description:
      "MCP tool that lists every saved schema in your Talonic workspace with IDs, names, and full field definitions, so agents reuse schemas instead of redesigning.",
    examples: [
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "schemas": [\n    {\n      "id": "sch_7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",\n      "short_id": "SCH-A1B2C3D4",\n      "name": "Standard Invoice",\n      "description": "Extracts vendor, line items, totals, and payment terms.",\n      "version": 3,\n      "field_count": 6,\n      "definition": {\n        "type": "object",\n        "properties": {\n          "vendor_name": { "type": "string" },\n          "invoice_number": { "type": "string" },\n          "total_amount": { "type": "number" },\n          "due_date": { "type": "string", "format": "date" },\n          "currency": { "type": "string" },\n          "line_items": { "type": "array" }\n        },\n        "required": ["vendor_name", "total_amount"]\n      }\n    },\n    {\n      "id": "sch_e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b",\n      "short_id": "SCH-E5F6A7B8",\n      "name": "Certificate of Insurance",\n      "description": "Extracts insured party, coverage types, limits, and expiry.",\n      "version": 1,\n      "field_count": 8,\n      "definition": { "type": "object", "properties": { "..." : {} } }\n    }\n  ]\n}',
      },
    ],
    faq: [
      {
        question: "How do I list schemas via MCP?",
        answer:
          "Call talonic_list_schemas to get all saved schemas with their definitions. The talonic://schemas resource also exposes this data.",
      },
      {
        question: "What is the difference between the UUID and SCH-XXXXXXXX ID?",
        answer:
          "Both reference the same schema. The UUID (id) is the full identifier, while SCH-XXXXXXXX (short_id) is a shorter, human-friendly format. Either can be passed as schema_id to talonic_extract.",
      },
      {
        question: "Does talonic_list_schemas require any parameters?",
        answer:
          "No. It takes no input parameters and returns all saved schemas in the workspace with their full definitions.",
      },
      {
        question: "Is talonic_list_schemas free to call?",
        answer:
          "Yes. It reads metadata only and uses no credits, so an agent can call it whenever it needs to check for an existing schema.",
      },
      {
        question: "How do I know which schema to use for a document?",
        answer:
          "Match the schema's name and description to the document. For example, use a 'Standard Invoice' schema for invoices and a 'Certificate of Insurance' schema for COIs. When unsure, start with an inline schema and save it once the results look right.",
      },
    ],
    related: [
      {
        label: "talonic_save_schema",
        slug: "talonic-save-schema",
      },
      {
        label: "talonic_extract",
        slug: "talonic-extract",
      },
    ],
    mentions: ["schemas", "list", "SCH-XXXXXXXX", "resource"],
  },
  talonic_get_schema: {
    task: "extract",
    seoTitle: "talonic_get_schema — Read a Saved Schema's Field List",
    description:
      "MCP tool that returns one saved Talonic schema with its full field definition (names, types, descriptions), so an agent knows which fields extraction returns.",
    related: [
      {
        label: "talonic_list_schemas",
        slug: "talonic-list-schemas",
      },
      {
        label: "talonic_extract",
        slug: "talonic-extract",
      },
    ],
    mentions: ["schema", "schema_id", "fields"],
  },
  talonic_save_schema: {
    task: "extract",
    seoTitle: "talonic_save_schema — Save Reusable Extraction Schemas",
    description:
      "MCP tool that persists a JSON Schema for reuse across extractions. Returns a schema_id (UUID or SCH-XXXXXXXX) to pass on every future talonic_extract call.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{\n  "name": "Standard Invoice",\n  "description": "Extracts vendor, line items, totals, and payment terms from invoices.",\n  "definition": {\n    "type": "object",\n    "properties": {\n      "vendor_name": { "type": "string" },\n      "invoice_number": { "type": "string" },\n      "total_amount": { "type": "number" },\n      "due_date": { "type": "string", "format": "date" },\n      "line_items": {\n        "type": "array",\n        "items": {\n          "type": "object",\n          "properties": {\n            "description": { "type": "string" },\n            "amount": { "type": "number" }\n          }\n        }\n      }\n    },\n    "required": ["vendor_name", "total_amount"]\n  }\n}',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "id": "sch_7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",\n  "short_id": "SCH-A1B2C3D4",\n  "name": "Standard Invoice",\n  "description": "Extracts vendor, line items, totals, and payment terms from invoices.",\n  "version": 1,\n  "field_count": 5\n}',
      },
    ],
    faq: [
      {
        question: "How do I save a schema via MCP?",
        answer:
          "Call talonic_save_schema with a name and JSON Schema definition. It returns a schema_id for reuse in talonic_extract calls.",
      },
      {
        question: "When should I save a schema vs use an inline schema?",
        answer:
          "Save a schema when you will reuse it across many documents (e.g., a standard invoice template). Use inline schemas for one-off extractions or when iterating on schema design with the user.",
      },
      {
        question: "Can I update a saved schema?",
        answer:
          "Schema updates are managed through the Talonic dashboard. The version field in the response tracks changes. Via MCP, you can save a new schema with a different name if the design changes significantly.",
      },
      {
        question: "What is the recommended workflow for schema design?",
        answer:
          "Iterate inline first: pass the schema directly to talonic_extract, review results with the user, adjust fields as needed. Once the user confirms the schema produces good results, call talonic_save_schema to persist it. This prevents cluttering the workspace with draft schemas that never get used.",
      },
      {
        question: "Should I include a description when saving a schema?",
        answer:
          "Yes. A clear description ('Vendor, line items, totals and payment terms from invoices') helps people on your team and agents pick the right schema for a document.",
      },
    ],
    related: [
      {
        label: "talonic_list_schemas",
        slug: "talonic-list-schemas",
      },
      {
        label: "talonic_extract",
        slug: "talonic-extract",
      },
    ],
    mentions: ["save schema", "JSON Schema", "reuse", "version"],
  },
  talonic_get_document: {
    task: "find",
    seoTitle: "talonic_get_document — Document Metadata & Status Tool",
    description:
      "MCP tool that fetches one document's details by id: status, page count, type, language and a link to open it in Talonic. Use it to follow an upload too.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{\n  "document_id": "doc_8f3a1b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c"\n}',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "id": "doc_8f3a1b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",\n  "filename": "invoice-2026-001.pdf",\n  "status": "completed",\n  "pages": 2,\n  "size_bytes": 184320,\n  "mime_type": "application/pdf",\n  "type_detected": "Invoice",\n  "language_detected": "de",\n  "source": { "id": "src_a1b2...", "type": "api" },\n  "links": {\n    "self": "https://api.talonic.com/v1/documents/doc_8f3a...",\n    "extractions": "https://api.talonic.com/v1/documents/doc_8f3a.../extractions",\n    "dashboard": "https://app.talonic.com/documents/doc_8f3a..."\n  }\n}',
      },
    ],
    faq: [
      {
        question: "How do I get document metadata via MCP?",
        answer:
          "Call talonic_get_document with the document id. It returns the file name, status, pages, detected type, language and links.",
      },
      {
        question: "Does talonic_get_document return extracted data?",
        answer:
          "No. It returns metadata (filename, status, pages, type, language, links). For extracted field data, use talonic_extract with the same document_id.",
      },
      {
        question: "How can I link the user to the original document?",
        answer:
          "The response includes links.dashboard, which is a direct URL to view the document in the Talonic web interface. Present this to the user when they need to verify an extraction.",
      },
      {
        question: "Does talonic_get_document cost any credits?",
        answer:
          "No. It is a free look-up. Call it as often as needed to check status or get the link to the document.",
      },
      {
        question: "What document statuses can talonic_get_document return?",
        answer:
          "While a file is on its way: pending_upload, uploading, queued, extracting, then completed (or extracted for text-only uploads). ocr_failed, extraction_failed and error are final: stop and tell the user.",
      },
    ],
    related: [
      {
        label: "talonic_to_markdown",
        slug: "talonic-to-markdown",
      },
      {
        label: "talonic_extract",
        slug: "talonic-extract",
      },
    ],
    mentions: ["document", "metadata", "status", "dashboard link"],
  },
  talonic_search: {
    task: "find",
    seoTitle: "talonic_search — Find Documents, Fields and Schemas by Name",
    description:
      "MCP tool that finds documents, fields, schemas and sources in a Talonic workspace by keyword or by file name, and returns the ids the other tools need.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{\n  "query": "indemnification",\n  "limit": 10\n}',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "documents": [\n    {\n      "id": "doc_4e7b...",\n      "filename": "acme-services-agreement.pdf",\n      "type_detected": "Services Agreement",\n      "score": 0.92\n    }\n  ],\n  "fieldMatches": [\n    {\n      "fieldName": "indemnification.cap_amount",\n      "documentId": "doc_4e7b...",\n      "value": "2x annual fees",\n      "documentCount": 3,\n      "filterable": true,\n      "dataType": "string",\n      "score": 0.88\n    }\n  ],\n  "schemas": [],\n  "sources": [],\n  "fields": [\n    { "canonicalName": "indemnification.cap_amount", "dataType": "string", "filterable": true }\n  ]\n}',
      },
    ],
    faq: [
      {
        question: "What does talonic_search do?",
        answer:
          "It finds documents, fields, schemas and sources whose name or text contains your keyword, and returns their ids. Search with one short, singular word or an exact file name.",
      },
      {
        question: "When should I use talonic_search vs talonic_filter?",
        answer:
          "Use search to find a document or field by name ('Acme', 'invoice'). Use filter for conditions on extracted values ('invoices over 1000 EUR').",
      },
      {
        question: "Can I search for schemas by name?",
        answer:
          "Yes. talonic_search includes schemas in its results. If you search for 'invoice', any schema with 'invoice' in its name or description will appear in the schemas array of the response. This is useful for discovering existing templates before creating new ones.",
      },
      {
        question: "How do I use search results to build a filter?",
        answer:
          "The fields in the response carry a canonicalName and a filterable flag. Use canonicalName values where filterable is true as `field` in talonic_filter conditions.",
      },
    ],
    related: [
      {
        label: "talonic_filter",
        slug: "talonic-filter",
      },
      {
        label: "talonic_extract",
        slug: "talonic-extract",
      },
      {
        label: "Agent Decision Guide",
        slug: "agent-decision-guide",
      },
    ],
    mentions: ["search", "find documents", "file name", "document_id"],
  },
  talonic_filter: {
    task: "find",
    seoTitle: "talonic_filter — Filter Documents by Extracted Fields",
    description:
      "MCP tool that finds documents by their extracted field values with conditions such as eq, gt, between and contains, and reports fields it couldn't match.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{\n  "conditions": [\n    { "field": "vendor.name", "operator": "eq", "value": "Meridian Energy AG" },\n    { "field": "invoice.total_eur", "operator": "gt", "value": 1000 }\n  ],\n  "sort": { "field": "invoice.total_eur", "direction": "desc" },\n  "limit": 20\n}',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "data": [\n    {\n      "document_id": "doc_8f3a...",\n      "filename": "invoice-2026-001.pdf",\n      "fields": {\n        "vendor.name": "Meridian Energy AG",\n        "invoice.total_eur": 1500.00,\n        "invoice.due_date": "2026-06-15"\n      }\n    },\n    {\n      "document_id": "doc_c2d9...",\n      "filename": "invoice-2026-003.pdf",\n      "fields": {\n        "vendor.name": "Meridian Energy AG",\n        "invoice.total_eur": 1200.00,\n        "invoice.due_date": "2026-04-30"\n      }\n    }\n  ],\n  "total": 2,\n  "page": 1\n}',
      },
      {
        title: "Response with a warning",
        language: "json",
        code: '{\n  "data": [],\n  "total": 0,\n  "warnings": [\n    {\n      "code": "numeric_operator_on_string_field",\n      "message": "Operator `gt` was applied to field `invoice_total` typed as string. Numeric comparisons against string-typed fields use lexicographic ordering and may return zero matches.",\n      "field": "invoice_total",\n      "field_id": "fld_inv_total",\n      "suggestion": "Change the field\'s data_type to `number` in the schema definition."\n    }\n  ]\n}',
      },
    ],
    faq: [
      {
        question: "How do I filter documents by field value?",
        answer:
          "Use talonic_filter with field names and operators such as eq, gt, between or contains. Field names are matched for you; one it can't match comes back in warnings[].",
      },
      {
        question: "How do I find the correct canonical field names for filtering?",
        answer:
          "For text fields, try the natural name ('vendor_name', 'currency'). For numbers and dates, call talonic_search first: the canonical names are in fields[].canonicalName.",
      },
      {
        question: "Can I combine free-text search with field filters?",
        answer:
          "Yes. Pass `search` alongside `conditions` to combine a keyword with value conditions in one call.",
      },
      {
        question: "What operators are available for talonic_filter?",
        answer:
          "eq, neq, gt, gte, lt, lte, between (with value_to), contains, is_empty and is_not_empty. The number comparisons work only on fields stored as numbers.",
      },
      {
        question: "Why does my filter return zero results even though matching documents exist?",
        answer:
          "Usually a number comparison on a field stored as text, for example amounts with currency symbols. Check the field's dataType first, and read warnings[] on the response.",
      },
    ],
    related: [
      {
        label: "talonic_search",
        slug: "talonic-search",
      },
      {
        label: "Known Limitations",
        slug: "known-limitations",
      },
      {
        label: "Agent Decision Guide",
        slug: "agent-decision-guide",
      },
    ],
    mentions: ["filter", "canonical field names", "operators", "conditions"],
  },
  talonic_to_markdown: {
    task: "extract",
    seoTitle: "talonic_to_markdown — Read Any Document as Clean Markdown",
    description:
      "MCP tool that returns a whole document's text as markdown, scanned pages included. Takes a document_id, a file URL, or a local file or bytes; no schema needed.",
    credits: "Free with `document_id`; a file input is read first and uses credits.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{\n  "document_id": "doc_8f3a1b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c"\n}',
      },
      {
        title: "Tool response",
        language: "markdown",
        code: "# Invoice INV-2026-001\n\n**Meridian Energy AG**\nMusterstraße 42, 10115 Berlin\n\n| Item                  | Amount     |\n|-----------------------|------------|\n| Consulting — April    | €1,200.00  |\n| Travel expenses       | €300.00    |\n| **Total**             | **€1,500.00** |\n\nDue date: 15 June 2026\nPayment terms: Net 30",
      },
      {
        title: "Tool input: convert a remote PDF to markdown",
        language: "json",
        code: '{\n  "file_url": "https://example.com/annual-report-2025.pdf"\n}',
      },
    ],
    faq: [
      {
        question: "How do I get markdown from a document via MCP?",
        answer:
          "Call talonic_to_markdown with a document_id (free), or pass the file as file_url, file_path (local installs) or file_data.",
      },
      {
        question: "Does talonic_to_markdown preserve table structure?",
        answer:
          "Yes. Tables come back as markdown tables, and headings and reading order follow the original document.",
      },
      {
        question: "Should I use talonic_to_markdown or talonic_extract with include_markdown?",
        answer:
          "If you only need the text, use talonic_to_markdown. If you need both structured fields and the full text, use talonic_extract with include_markdown: true to avoid two separate calls.",
      },
      {
        question: "Can I use talonic_to_markdown for document comparison?",
        answer:
          "Yes. Get both versions as markdown and compare the text. Use document_id for files already in the workspace so nothing is uploaded twice.",
      },
      {
        question: "Does talonic_to_markdown handle scanned documents?",
        answer:
          "Yes. Scanned PDFs, photos and images (PNG, JPG, TIFF) are read too, including headers, stamps and legible handwriting.",
      },
    ],
    related: [
      {
        label: "talonic_extract",
        slug: "talonic-extract",
      },
      {
        label: "Drag & Drop Files",
        slug: "drag-and-drop",
      },
    ],
    mentions: ["markdown", "document text", "scanned documents", "tables"],
  },
  talonic_extract: {
    task: "extract",
    seoTitle: "talonic_extract — Structured Document Extraction Tool",
    description:
      "MCP tool that extracts structured, schema-validated JSON from documents with per-field confidence scores. Accepts file data, paths, URLs, or document IDs.",
    credits: "Uses credits per page read.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{\n  "file_url": "https://example.com/invoice-2026-001.pdf",\n  "schema": {\n    "type": "object",\n    "properties": {\n      "vendor_name": { "type": "string" },\n      "invoice_number": { "type": "string" },\n      "total_amount": { "type": "number" },\n      "due_date": { "type": "string", "format": "date" },\n      "line_items": {\n        "type": "array",\n        "items": {\n          "type": "object",\n          "properties": {\n            "description": { "type": "string" },\n            "amount": { "type": "number" }\n          }\n        }\n      }\n    },\n    "required": ["vendor_name", "total_amount"]\n  },\n  "instructions": "Amounts are in EUR. Focus on the billing section."\n}',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "extraction_id": "ext_8f3a...",\n  "request_id": "req_2c91...",\n  "status": "complete",\n  "document": {\n    "id": "doc_8f3a...",\n    "filename": "invoice-2026-001.pdf",\n    "pages": 2,\n    "type_detected": "invoice",\n    "language_detected": "de"\n  },\n  "data": {\n    "vendor_name": "Meridian Energy AG",\n    "invoice_number": "INV-2026-001",\n    "total_amount": 1500.00,\n    "due_date": "2026-06-15",\n    "line_items": [\n      { "description": "Consulting, April", "amount": 1200.00 },\n      { "description": "Travel expenses", "amount": 300.00 }\n    ]\n  },\n  "schema": {\n    "source": "inline"\n  },\n  "confidence": {\n    "overall": 0.97,\n    "fields": {\n      "vendor_name": 0.98,\n      "invoice_number": 0.95,\n      "total_amount": 0.99,\n      "due_date": 0.97\n    }\n  },\n  "processing": {\n    "duration_ms": 2840,\n    "pages_processed": 2,\n    "region": "eu-central-1"\n  }\n}',
      },
      {
        title: "Tool input",
        language: "json",
        code: '{\n  "file_path": "./contracts/lease-agreement.pdf",\n  "schema_id": "SCH-A1B2C3D4"\n}',
      },
    ],
    faq: [
      {
        question: "How does talonic_extract work?",
        answer:
          "Send a document (document_id, file_url, file_path in a local install, or small file_data) with the fields you want (schema or schema_id). It returns JSON in that shape with a confidence score per field.",
      },
      {
        question: "What is the fastest way to extract data from a document?",
        answer:
          "If the document is already in your workspace, pass its document_id. For files on the web, pass file_url. In Claude.ai and ChatGPT, get an upload link with talonic_request_upload rather than sending file bytes.",
      },
      {
        question: "How long does an extraction typically take?",
        answer:
          "It grows with the document: a two-page invoice usually takes a few seconds, longer documents more. processing.duration_ms on the response shows how long it took.",
      },
    ],
    related: [
      {
        label: "talonic_to_markdown",
        slug: "talonic-to-markdown",
      },
      {
        label: "talonic_save_schema",
        slug: "talonic-save-schema",
      },
      {
        label: "Drag & Drop Files",
        slug: "drag-and-drop",
      },
    ],
    mentions: ["extract", "schema", "confidence scores", "file_data"],
  },
  talonic_get_balance: {
    task: "workspace",
    seoTitle: "talonic_get_balance — Check Credits, Burn Rate, Runway",
    description:
      "MCP tool that returns your Talonic credit balance, its EUR value, 30-day burn rate, projected runway and plan reset date, for agents that watch their budget.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: "{}",
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "balance_credits": 1888,\n  "balance_eur": 9.44,\n  "burn_rate_30d_credits": 360,\n  "projected_runway_days": 157,\n  "tier": "pro",\n  "tier_resets_at": "2026-06-01T00:00:00.000Z"\n}',
      },
    ],
    faq: [
      {
        question: "How do I check my Talonic credit balance from an agent?",
        answer:
          "Call talonic_get_balance with no arguments. It returns balance_credits, balance_eur, burn_rate_30d_credits, projected_runway_days, tier and tier_resets_at. Read-only and free.",
      },
      {
        question: "What does projected_runway_days = -1 mean?",
        answer:
          "It means the workspace has had zero credit consumption in the trailing 30 days, so a meaningful runway projection cannot be computed. Treat -1 as 'unknown' rather than '0 days'.",
      },
      {
        question: "Should the agent check balance before every extraction?",
        answer:
          "Not for single extractions — that would add unnecessary latency. Check the balance before batch operations (10+ documents) or when the user explicitly asks about credits. For single extractions, proceed directly and let the API return a quota error if the balance is exhausted.",
      },
      {
        question: "How does the agent know the cost of an extraction?",
        answer:
          "Each talonic_extract response carries a cost field with the credits it used. Check the balance before a large batch and again after it.",
      },
    ],
    related: [
      {
        label: "talonic_extract",
        slug: "talonic-extract",
      },
      {
        label: "talonic_get_pricing",
        slug: "talonic-get-pricing",
      },
      {
        label: "talonic_get_usage",
        slug: "talonic-get-usage",
      },
    ],
    mentions: ["credits", "balance", "EUR", "burn rate", "runway", "budget"],
  },
  talonic_get_pricing: {
    task: "workspace",
    seoTitle: "talonic_get_pricing — Credit Pricing Catalog for Agents",
    description:
      "MCP tool that returns Talonic's public credit pricing catalog: per-unit rates, EUR equivalents, and batch multipliers, so agents can predict spend upfront.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: "{}",
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "currency": "EUR",\n  "credits_per_eur": 1000,\n  "multipliers": { "realtime": 1, "batch": 0.5 },\n  "units": [\n    { "unit": "page_ingest", "label": "Document page ingestion", "credits": 100, "eur": 0.1, "free": false },\n    { "unit": "structuring_cell", "label": "Structuring cell (LLM-reasoned)", "credits": 20, "eur": 0.02, "free": false },\n    { "unit": "registry_resolved_cell", "label": "Structuring cell (Field Registry resolved)", "credits": 0, "eur": 0, "free": true },\n    { "unit": "intelligence_op", "label": "Intelligence operation (matching, cases, reconciliation)", "credits": 100, "eur": 0.1, "free": false },\n    { "unit": "delivery", "label": "Delivery (webhook / export)", "credits": 0, "eur": 0, "free": true },\n    { "unit": "validation", "label": "Validation / quality check", "credits": 0, "eur": 0, "free": true }\n  ]\n}',
      },
    ],
    faq: [
      {
        question: "Does talonic_get_pricing require an API key?",
        answer:
          "No. The pricing catalog is public, so an agent can read rates before signing up or provisioning a key. Call it with no arguments; it is read-only and safe to call at any time.",
      },
      {
        question: "How does an agent compute the cost of a job from the catalog?",
        answer:
          "Multiply the credits per unit by the number of units (pages, fields or operations), apply the multiplier (batch work costs half), and divide by credits_per_eur for euros.",
      },
      {
        question: "Which operations are free in the catalog?",
        answer:
          "The catalog marks free units with `free: true`. Searching, listing, look-ups and reading stored text are free; reading new documents, filling fields and matching use credits.",
      },
    ],
    related: [
      {
        label: "talonic_get_usage",
        slug: "talonic-get-usage",
      },
      {
        label: "talonic_get_balance",
        slug: "talonic-get-balance",
      },
    ],
    mentions: [
      "pricing",
      "credit catalog",
      "cost estimation",
      "per-page pricing",
      "batch discount",
      "credits per EUR",
      "budget",
    ],
  },
  talonic_get_usage: {
    task: "workspace",
    seoTitle: "talonic_get_usage — See What Your Talonic Credits Went On",
    description:
      "MCP tool that breaks down Talonic credit use by kind of work over a trailing window (30 days by default), largest first, so you can see what drives spend.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{ "days": 30 }',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "period_days": 30,\n  "total_credits": 48200,\n  "by_function": [\n    { "operation_type": "page_ingest", "operations": 412, "credits": 41200 },\n    { "operation_type": "structuring_cell", "operations": 300, "credits": 6000 },\n    { "operation_type": "intelligence_op", "operations": 10, "credits": 1000 }\n  ]\n}',
      },
    ],
    faq: [
      {
        question: "How is talonic_get_usage different from talonic_get_balance?",
        answer:
          "Balance says what is left (and how long it lasts); usage says what was spent and on what. Use balance to check headroom and usage to see where credits went.",
      },
      {
        question: "What window does talonic_get_usage cover?",
        answer:
          "The last 30 days by default. Pass days to change it, anywhere from 1 to 365. The response echoes period_days so the agent can confirm the window it summarized.",
      },
      {
        question: "Why is the breakdown empty?",
        answer:
          "Rows appear once work has been charged in the window. A new workspace, or one with no charged work in the period, returns an empty breakdown; widen `days` to look further back.",
      },
    ],
    related: [
      {
        label: "talonic_get_pricing",
        slug: "talonic-get-pricing",
      },
      {
        label: "talonic_get_balance",
        slug: "talonic-get-balance",
      },
    ],
    mentions: [
      "credit usage",
      "per-function spend",
      "credit consumption",
      "burn rate",
      "operation type",
      "spend report",
    ],
  },
  talonic_request_upload: {
    task: "extract",
    seoTitle: "talonic_request_upload — Upload Links for Large Files",
    description:
      "MCP tool that gives the user a browser link to upload a file too large for a chat tool call. Returns the link, a reserved document_id and when the link expires.",
    credits: "The link is free; reading the uploaded file uses credits.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{\n  "filename": "invoice-2026-001.pdf"\n}',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "document_id": "doc_8f3a2b9c-1d4e-5f6a-7b8c-9d0e1f2a3b4c",\n  "upload_url": "https://app.talonic.com/u/069b8d9a-b05d-41df-8047-129af7c7aad5",\n  "expires_at": "2026-05-28T20:35:00.000Z"\n}',
      },
    ],
    faq: [
      {
        question: "When should the agent use `talonic_request_upload` instead of `file_data`?",
        answer:
          "In Claude.ai and ChatGPT, where a tool call can carry only about 32 KB; real documents are larger and arrive cut short as file_data. Local installs (Claude Desktop, Cursor, Cline, Continue, Cowork) can pass files by path instead.",
      },
      {
        question: "Does a user message like 'uploaded' mean the file is ready to extract?",
        answer:
          "No. It means the browser finished sending the file; Talonic still needs a short while to read it. Check talonic_get_document until status is 'completed' before extracting.",
      },
      {
        question: "What happens if the user never opens the upload link?",
        answer:
          "The reserved document stays in pending_upload. The link stops working at expires_at; ask for a new one with talonic_request_upload, which reserves a new document_id.",
      },
      {
        question: "Can the agent PUT the file to the upload_url itself?",
        answer:
          "Usually not: hosted chat clients can't send data to arbitrary addresses. And the user should choose the file anyway, so give them the link.",
      },
      {
        question: "How do I keep a company's files together, and make them workspace data?",
        answer:
          "Pass `account` (a company name, alias or id from talonic_list_accounts; create one with talonic_create_account) so the document belongs to that company, and `add_to_workspace: true` so it is fully processed and can be asked about later. Without add_to_workspace only its text is kept, for one talonic_extract call.",
      },
      {
        question: "Why a separate tool instead of changing `talonic_extract`?",
        answer:
          "Keeping the upload step separate means the user sees the link and knows what is happening, and talonic_extract behaves the same for every file.",
      },
    ],
    related: [
      {
        label: "talonic_extract",
        slug: "talonic-extract",
      },
      {
        label: "talonic_get_document",
        slug: "talonic-get-document",
      },
      {
        label: "Drag & Drop Files",
        slug: "drag-and-drop",
      },
      {
        label: "Known Limitations",
        slug: "known-limitations",
      },
    ],
    mentions: ["upload", "upload link", "document_id", "Claude.ai", "ChatGPT", "file size"],
  },
  talonic_list_accounts: {
    task: "workspace",
    seoTitle: "talonic_list_accounts — List Per-Company Workspace Accounts",
    description:
      "MCP tool that lists the companies a Talonic workspace keeps apart (portfolio companies, clients, entities), so uploads and questions stay separate per company.",
    faq: [
      {
        question: "What if the company is missing?",
        answer:
          "Create it with talonic_create_account, then upload with `account` set to its name.",
      },
    ],
    related: [
      {
        label: "talonic_request_upload",
        slug: "talonic-request-upload",
      },
    ],
    mentions: ["account", "company", "portfolio company", "upload"],
  },
  talonic_create_account: {
    task: "workspace",
    seoTitle: "talonic_create_account — Add a Company Account to Talonic",
    description:
      "MCP tool that adds a company to a Talonic workspace, with the other names it goes by, so its documents and answers are kept apart from every other company's.",
    faq: [
      {
        question: "Why give aliases?",
        answer:
          'Documents name the same company differently ("Filu", "Filu Group GmbH"). Aliases let uploads and questions refer to the account by any of those names.',
      },
    ],
    related: [
      {
        label: "talonic_request_upload",
        slug: "talonic-request-upload",
      },
    ],
    mentions: ["account", "company", "portfolio company", "upload"],
  },
  talonic_list_fields: {
    task: "find",
    seoTitle: "talonic_list_fields — List the Fields Your Documents Carry",
    description:
      "MCP tool that lists the fields across a Talonic workspace's documents with stable ids, maturity, data type, synonyms and counts, so agents query the right one.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{ "search": "invoice", "maturity": "proven", "limit": 5 }',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "data": [\n    {\n      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",\n      "canonical_name": "invoice_number",\n      "display_name": "Invoice Number",\n      "data_type": "string",\n      "maturity": "proven",\n      "tier": 2,\n      "synonyms": ["inv_no", "invoice no"],\n      "description": "The supplier\'s invoice identifier",\n      "occurrence_count": 412,\n      "superseded_by": null,\n      "links": { "self": "/v1/fields/a1b2…", "card": "/v1/fields/a1b2…/card", "values": "/v1/fields/a1b2…/values" }\n    }\n  ],\n  "pagination": { "total": 1, "limit": 5, "has_more": false, "next_cursor": null }\n}',
      },
    ],
    faq: [
      {
        question: "What does maturity mean and which level should I build on?",
        answer:
          "`core` fields are established and trusted; `proven` fields recur and have a stable id; `candidate` fields were seen recently and may still be merged or renamed. Build on `core` or `proven`; treat `candidate` as a hint.",
      },
    ],
    related: [
      {
        label: "talonic_search",
        slug: "talonic-search",
      },
      {
        label: "talonic_filter",
        slug: "talonic-filter",
      },
    ],
    mentions: ["list fields", "maturity", "field names", "superseded_by", "field ids"],
  },
  talonic_get_field: {
    task: "find",
    seoTitle: "talonic_get_field — Describe One Field, by Id or Name",
    description:
      "MCP tool that describes one field by id or name: what it means, synonyms, maturity, how often it occurs, its top values with examples and the schemas using it.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{ "name": "Invoice No", "include_history": true }',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",\n  "canonical_name": "invoice_number",\n  "maturity": "proven",\n  "data_type": "string",\n  "definition": { "description": "The supplier\'s invoice identifier", "instruction": "Extract the invoice number as printed", "synonyms": ["inv_no"], "aliases": [{ "name": "invoice no", "source": "merge" }] },\n  "identity": { "pinned": false, "source": null, "superseded_by": null, "absorbed": [] },\n  "occurrence": { "occurrence_count": 412, "document_count": 398, "first_seen_at": "2026-03-02T09:14:00.000Z", "last_seen_at": "2026-09-04T16:02:11.000Z", "document_type_distribution": { "invoice": 398 } },\n  "values": { "total": 412, "distinct_count": 405, "top": [{ "value": "INV-2026-0001", "count": 2, "share": 0.0049 }], "examples": ["INV-2026-0001", "RE-88231"] },\n  "usage": { "schema_count": 2, "schema_field_count": 2 },\n  "resolution": { "matched_by": "synonym", "redirected_from": [] },\n  "history": { "total": 1, "data": [{ "kind": "tier_changed", "at": "2026-04-01T00:00:00.000Z", "detail": { "direction": "promoted", "from_maturity": "candidate", "to_maturity": "proven" } }] }\n}',
      },
    ],
    faq: [
      {
        question: "Can I pass the user's wording instead of an id?",
        answer:
          "Yes. `name` is matched against field names, other spellings and synonyms, and followed to the current field if it was merged; `resolution.matched_by` says how it matched.",
      },
    ],
    related: [
      {
        label: "talonic_search",
        slug: "talonic-search",
      },
      {
        label: "talonic_filter",
        slug: "talonic-filter",
      },
    ],
    mentions: ["field definition", "field by name", "example values", "field history"],
  },
  talonic_field_values: {
    task: "find",
    seoTitle: "talonic_field_values — Read a Field Across Documents",
    description:
      "MCP tool that reads one field's current values across all documents with evidence: the document, the value, its confidence, the source text and how it matched.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{ "name": "invoice_number", "value": "2026", "limit": 2 }',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "field_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",\n  "canonical_name": "invoice_number",\n  "concept_ids": ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],\n  "data": [\n    {\n      "occurrence_id": "0f1e2d3c-…",\n      "document_id": "f0e1d2c3-…",\n      "document_filename": "RE-2026-0142.pdf",\n      "document_type": "invoice",\n      "value": "INV-2026-0142",\n      "confidence": 0.97,\n      "provenance": { "raw_field_name": "Rechnungsnummer", "source_text": "Rechnungsnummer: INV-2026-0142", "resolved_by": "exact", "needs_confirmation": false, "via_redirect": false },\n      "links": { "document": "/v1/documents/f0e1…", "document_fields": "/v1/documents/f0e1…/fields" }\n    }\n  ],\n  "pagination": { "total": 37, "limit": 2, "has_more": true, "next_cursor": "MGYx…" }\n}',
      },
    ],
    faq: [
      {
        question: "Are the values filtered by the caller's document visibility?",
        answer:
          "Yes. Only values from documents you are allowed to see come back, and `pagination.total` counts only those.",
      },
    ],
    related: [
      {
        label: "talonic_search",
        slug: "talonic-search",
      },
      {
        label: "talonic_filter",
        slug: "talonic-filter",
      },
    ],
    mentions: [
      "field values",
      "values across documents",
      "provenance",
      "source text",
      "cross-document",
    ],
  },
  talonic_find_data: {
    task: "find",
    seoTitle: "talonic_find_data — Find Where the Data for a Concept Lives",
    description:
      "MCP tool that finds the fields, values, documents and passages behind a concept in your own words, even under another field name, optionally within one company.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{ "query": "revenue", "account": "Filu", "top_k": 5 }',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "tool": "find_data",\n  "result": {\n    "fields": [{ "canonical_name": "contract_end_date", "field_key": "contract_end_date", "occurrence_count": 88, "samples": [{ "value": "2027-12-31", "document_id": "f0e1…" }] }],\n    "documents": [{ "document_id": "f0e1…", "filename": "Supply-Agreement-2024.pdf", "score": 0.81 }],\n    "passages": []\n  },\n  "citations": [{ "document_id": "f0e1…" }]\n}',
      },
    ],
    faq: [
      {
        question: "How is this different from talonic_search?",
        answer:
          "`talonic_search` matches your words literally. `talonic_find_data` also matches what you mean, across fields and document text, and returns ids (fields, documents, passages) ready for the next call.",
      },
    ],
    related: [
      {
        label: "talonic_search",
        slug: "talonic-search",
      },
      {
        label: "talonic_filter",
        slug: "talonic-filter",
      },
    ],
    mentions: ["find data", "which field holds", "locate data", "passages"],
  },
  talonic_list_agent_tools: {
    task: "ask",
    seoTitle: "talonic_list_agent_tools — List Talonic's Data Query Tools",
    description:
      "MCP tool that lists Talonic's read-only data tools, such as SQL over extracted data and document text, with their input schemas and whether you may call them.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{ "only_invocable": true, "include_schemas": false }',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "tools": [\n    { "name": "find_data", "description": "CALL THIS FIRST to locate the real data behind a natural-language concept…", "impact": "read", "capability": "data.read", "can_invoke": true },\n    { "name": "query_data", "description": "Run a read-only SQL SELECT over the extracted data…", "impact": "read", "capability": "data.read", "can_invoke": true }\n  ],\n  "invocable_count": 12,\n  "totalCount": 48\n}',
      },
    ],
    faq: [
      {
        question: "Why are some tools listed with can_invoke false?",
        answer:
          "Calls through this route run with read-only access (`data.read`), so tools that spend credits or write are listed for completeness but cannot be called here.",
      },
    ],
    related: [
      {
        label: "talonic_search",
        slug: "talonic-search",
      },
      {
        label: "talonic_filter",
        slug: "talonic-filter",
      },
    ],
    mentions: ["data tools", "query_data", "describe_data", "capabilities", "can_invoke"],
  },
  talonic_invoke_agent_tool: {
    task: "ask",
    seoTitle: "talonic_invoke_agent_tool — Run a Read-Only Data Query Tool",
    description:
      "MCP tool that runs one of Talonic's read-only data tools with your own arguments, for example a SQL query over extracted data or a document's text. Reads only.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{ "name": "query_data", "args": { "sql": "SELECT field_key, count(*) FROM cells GROUP BY 1 ORDER BY 2 DESC LIMIT 5" } }',
      },
      {
        title: "Tool response",
        language: "json",
        code: '{\n  "tool": "query_data",\n  "result": { "rows": [{ "field_key": "invoice_number", "count": 412 }], "row_count": 1 }\n}',
      },
    ],
    faq: [
      {
        question: "Does invoking a tool cost credits?",
        answer:
          "No. The tools you can call here only read data and use no credits; the route has its own rate limit instead.",
      },
    ],
    related: [
      {
        label: "talonic_search",
        slug: "talonic-search",
      },
      {
        label: "talonic_filter",
        slug: "talonic-filter",
      },
    ],
    mentions: [
      "invoke tool",
      "query_data",
      "sql over extracted data",
      "document markdown",
      "read-only",
    ],
  },
  talonic_list_specs: {
    task: "run",
    seoTitle: "talonic_list_specs — List the Specs Your Agent Can Run",
    description:
      "MCP tool that lists the Specs in your Talonic workspace (saved ways of reading a kind of document) with schema ids, publish state and field and step counts.",
    faq: [
      {
        question: "Why does a Spec have both an id and a schema_id?",
        answer:
          "The Spec is what you set up; the rows a run produces follow a schema, which has its own id. `talonic_run_spec` takes the Spec id.",
      },
    ],
    related: [
      {
        label: "talonic_get_spec",
        slug: "talonic-get-spec",
      },
      {
        label: "talonic_run_spec",
        slug: "talonic-run-spec",
      },
    ],
    mentions: ["specs", "list specs", "spec id"],
  },
  talonic_get_spec: {
    task: "run",
    seoTitle: "talonic_get_spec — Read a Spec's Steps, Schema and Fields",
    description:
      "MCP tool that returns one Spec in full: version state, the schema its rows follow, its steps as set up and in run order, and how its fields map to the schema.",
    faq: [
      {
        question: "Why do nodes and phases differ?",
        answer:
          "`nodes[]` lists the steps as they were set up, in editing order; `phases[]` lists them in the order a run carries them out. One check can appear several times in `phases[]`, so the lists can differ.",
      },
    ],
    related: [
      {
        label: "talonic_list_specs",
        slug: "talonic-list-specs",
      },
      {
        label: "talonic_run_spec",
        slug: "talonic-run-spec",
      },
    ],
    mentions: ["spec structure", "steps", "spec versions"],
  },
  talonic_run_spec: {
    task: "run",
    seoTitle: "talonic_run_spec — Run a Spec over Your Documents via MCP",
    description:
      "MCP tool that runs a Spec over workspace documents or public file URLs in one call and returns a run the agent follows until one row per document is ready.",
    credits: "Uses credits per document processed.",
    faq: [
      {
        question: "Does this cost credits?",
        answer:
          "Yes. Reading documents and filling fields use credits per document, exactly as a run started in the web app; checks and delivery are free. Check talonic_get_pricing and talonic_get_balance before a large batch.",
      },
    ],
    related: [
      {
        label: "talonic_get_run",
        slug: "talonic-get-run",
      },
      {
        label: "talonic_get_run_results",
        slug: "talonic-get-run-results",
      },
      {
        label: "talonic_request_upload",
        slug: "talonic-request-upload",
      },
    ],
    mentions: ["run spec", "file_urls", "document_ids", "pipeline_mode"],
  },
  talonic_get_run: {
    task: "run",
    seoTitle: "talonic_get_run — Poll a Spec Run's Status and Progress",
    description:
      "MCP tool that checks a Spec run started by talonic_run_spec: its status, how many documents are done or failed, and for larger runs the progress of each step.",
    faq: [
      {
        question: "How long does a run take?",
        answer:
          "Seconds per document to read it, plus whatever checks, look-ups and deliveries the Spec has. Check every 5 to 10 seconds and stop on completed or failed.",
      },
    ],
    related: [
      {
        label: "talonic_run_spec",
        slug: "talonic-run-spec",
      },
      {
        label: "talonic_get_run_results",
        slug: "talonic-get-run-results",
      },
    ],
    mentions: ["run status", "poll run", "run progress"],
  },
  talonic_get_run_results: {
    task: "run",
    seoTitle: "talonic_get_run_results — Read Structured Rows of a Run",
    description:
      "MCP tool that reads a Spec run's structured rows, one per document, with column definitions, clean per-field values and the count of values still in review.",
    faq: [
      {
        question: "Why is a value null?",
        answer:
          "Values held for review come back null until a reviewer approves them; `pending_review_count` says how many are held on the page.",
      },
    ],
    related: [
      {
        label: "talonic_get_run",
        slug: "talonic-get-run",
      },
      {
        label: "talonic_field_values",
        slug: "talonic-field-values",
      },
    ],
    mentions: ["run results", "structured rows", "columns", "pending review"],
  },
  talonic_ask: {
    task: "ask",
    seoTitle: "talonic_ask — Ask Cited, Verified Questions of Documents",
    description:
      "MCP tool that answers a natural-language question over your workspace documents as cited markdown with per-claim source links and a verification verdict.",
    credits: "Uses credits per question; `usage.credits_charged` on the answer says how many.",
    faq: [
      {
        question: "What if the answer is not ready in time?",
        answer:
          "The tool returns status `processing` with the `ask_id`; call `talonic_get_answer` with it a few seconds later. Passing `conversation_id` lets follow-up questions see earlier turns.",
      },
    ],
    related: [
      {
        label: "talonic_get_answer",
        slug: "talonic-get-answer",
      },
      {
        label: "talonic_find_data",
        slug: "talonic-find-data",
      },
      {
        label: "talonic_field_values",
        slug: "talonic-field-values",
      },
    ],
    mentions: ["ask", "question answering", "cited answer", "verification", "conversation"],
  },
  talonic_get_answer: {
    task: "ask",
    seoTitle: "talonic_get_answer — Poll a Talonic Ask for Its Answer",
    description:
      "MCP tool that collects the answer to a question started with talonic_ask once it is ready, cited and checked, so agents never block on long questions.",
    faq: [
      {
        question: "How often should I poll?",
        answer: "Every 2–5 seconds; most asks complete within a minute.",
      },
    ],
    related: [
      {
        label: "talonic_ask",
        slug: "talonic-ask",
      },
    ],
    mentions: ["get answer", "poll ask", "answer status"],
  },
  talonic_list_apps: {
    task: "apps",
    seoTitle: "talonic_list_apps — List the Apps in Your Workspace",
    description:
      "MCP tool that lists the Talonic Apps in a workspace with their id, name, one-line description, mode and enabled state, and supplies the app ids tools need.",
    related: [
      {
        label: "talonic_list_decision_tasks",
        slug: "talonic-list-decision-tasks",
      },
    ],
    mentions: ["apps", "app_id", "External mode"],
  },
  talonic_list_agent_tasks: {
    task: "review",
    seoTitle: "talonic_list_agent_tasks — Tasks Waiting for Your Agent",
    description:
      "MCP tool that lists the agent tasks in your Talonic workspace: checks a Spec hands to an outside agent, metadata only, with a status filter and cursor paging.",
    examples: [
      {
        title: "Tool input and response",
        language: "json",
        code: '// talonic_list_agent_tasks({ "status": "available", "limit": 2 })\n{\n  "data": [\n    {\n      "id": "11111111-1111-4111-8111-111111111111",\n      "document_id": "22222222-2222-4222-8222-222222222222",\n      "stage_id": "33333333-3333-4333-8333-333333333333",\n      "status": "available",\n      "execution_epoch": 1,\n      "claimed_at": null,\n      "lease_expires_at": null,\n      "timeout_at": "2026-08-30T12:00:00.000Z",\n      "created_at": "2026-08-29T09:15:00.000Z"\n    }\n  ],\n  "pagination": { "has_more": false, "next_cursor": null }\n}',
      },
    ],
    faq: [
      {
        question: "Does listing Agent tasks expose document data?",
        answer:
          "No. The list returns metadata only. Reading a task's input takes talonic_get_agent_task, and each read is recorded.",
      },
      {
        question: "What do the Agent task statuses mean?",
        answer:
          "available: no one holds it; claimed: an agent holds a live lease; submitted: the outputs were accepted and the document moved on; timed_out: the deadline passed without a submission; cancelled: the task was withdrawn, for example because the document was removed or the Spec changed.",
      },
      {
        question: "How does pagination work on the Agent-task worklist?",
        answer:
          "Pass limit (1 to 100, default 50). While pagination.has_more is true, pass pagination.next_cursor as cursor on the next call, with the same status filter.",
      },
    ],
    related: [
      {
        label: "talonic_get_agent_task",
        slug: "talonic-get-agent-task",
      },
      {
        label: "talonic_claim_agent_task",
        slug: "talonic-claim-agent-task",
      },
      {
        label: "talonic_submit_agent_task",
        slug: "talonic-submit-agent-task",
      },
    ],
    mentions: ["agent tasks", "worklist", "MCP agent", "cursor pagination"],
  },
  talonic_get_agent_task: {
    task: "review",
    seoTitle: "talonic_get_agent_task — Fetch an Agent Task's Payload",
    description:
      "MCP tool that reads one agent task's fixed input, instructions and the output fields it expects, before your agent decides to take it. Every read is recorded.",
    examples: [
      {
        title: "Tool input",
        language: "json",
        code: '{ "task_id": "11111111-1111-4111-8111-111111111111" }',
      },
    ],
    faq: [
      {
        question: "Can the snapshot change while an agent processes it?",
        answer:
          "No. The input is fixed when the task is created and does not change. Results are checked against the task's output_contract.",
      },
      {
        question: "Does fetching an Agent task claim it?",
        answer:
          "No. talonic_get_agent_task is read-only; the task stays available and another agent can claim it while you inspect. Call talonic_claim_agent_task to take the lease before processing.",
      },
      {
        question: "What does timeout_fallthrough mean?",
        answer:
          "It says what happens if nobody submits before timeout_at: hold keeps the document waiting, skip lets it continue without the agent's outputs, and route_to_review sends it to a person. Use it to judge how urgent a task is.",
      },
    ],
    related: [
      {
        label: "talonic_list_agent_tasks",
        slug: "talonic-list-agent-tasks",
      },
      {
        label: "talonic_claim_agent_task",
        slug: "talonic-claim-agent-task",
      },
    ],
    mentions: ["agent task", "output contract", "audit trail", "document task"],
  },
  talonic_claim_agent_task: {
    task: "review",
    seoTitle: "talonic_claim_agent_task — Lease an Agent Task Safely",
    description:
      "MCP tool that claims an available agent task before your agent works on it. Returns the task, an execution epoch and a lease, so two agents never collide.",
    examples: [
      {
        title: "Tool input and response (payload fields elided)",
        language: "json",
        code: '// talonic_claim_agent_task({ "task_id": "11111111-1111-4111-8111-111111111111" })\n{\n  "id": "11111111-1111-4111-8111-111111111111",\n  "status": "claimed",\n  "execution_epoch": 2,\n  "claimed_at": "2026-08-29T10:00:00.000Z",\n  "lease_expires_at": "2026-08-29T10:10:00.000Z",\n  "input_snapshot": { "...": "full payload, same shape as talonic_get_agent_task" },\n  "output_contract": [{ "key": "risk_score", "dataType": "number", "required": true }],\n  "instructions": "Assess supplier risk from the supplied evidence."\n}',
      },
    ],
    faq: [
      {
        question: "What is an execution epoch?",
        answer:
          "A number that identifies your claim. Every claim or reclaim gets a new one, and calls with an old one are refused, so an agent whose claim ran out cannot overwrite a newer result.",
      },
      {
        question: "Can I claim a task that is already claimed?",
        answer:
          "Only once its lease has expired. A live claim by another actor returns HTTP 409; after lease_expires_at passes without a heartbeat, the same claim call succeeds as a reclaim and increments the execution epoch.",
      },
      {
        question: "What happens if I claim a task and never finish it?",
        answer:
          "Nothing is written. The lease runs out and the task can be claimed again; if timeout_at passes with no submission, the task's timeout_fallthrough (hold, skip or route_to_review) decides what happens to the document. An abandoned claim never damages data; it only delays the document.",
      },
    ],
    related: [
      {
        label: "talonic_heartbeat_agent_task",
        slug: "talonic-heartbeat-agent-task",
      },
      {
        label: "talonic_submit_agent_task",
        slug: "talonic-submit-agent-task",
      },
    ],
    mentions: ["claim lease", "execution epoch", "conflict", "reclaim"],
  },
  talonic_heartbeat_agent_task: {
    task: "review",
    seoTitle: "talonic_heartbeat_agent_task — Keep a Task Lease Alive",
    description:
      "MCP tool that extends the lease on a claimed agent task using its execution epoch, so long-running work is not handed to another agent halfway through.",
    examples: [
      {
        title: "Tool input and response (metadata only)",
        language: "json",
        code: '// talonic_heartbeat_agent_task({\n//   "task_id": "11111111-1111-4111-8111-111111111111",\n//   "execution_epoch": 2\n// })\n{\n  "id": "11111111-1111-4111-8111-111111111111",\n  "status": "claimed",\n  "execution_epoch": 2,\n  "lease_expires_at": "2026-08-29T10:20:00.000Z",\n  "timeout_at": "2026-08-30T12:00:00.000Z"\n}',
      },
    ],
    faq: [
      {
        question: "How often should an agent heartbeat?",
        answer:
          "Only when needed, comfortably before lease_expires_at. Use the updated lease expiry returned by each successful heartbeat rather than a fixed client-side assumption.",
      },
      {
        question: "What does a heartbeat return?",
        answer:
          "The task's metadata with the new lease_expires_at and the current execution_epoch. Never the input; the claim already gave you that.",
      },
      {
        question: "My heartbeat returned HTTP 409 — can I still submit?",
        answer:
          "No. A 409 means your execution epoch is stale: the lease expired and the task was reclaimed or withdrawn. Submits with that epoch will also be rejected, so discard the in-flight work and claim a different task.",
      },
    ],
    related: [
      {
        label: "talonic_claim_agent_task",
        slug: "talonic-claim-agent-task",
      },
      {
        label: "talonic_submit_agent_task",
        slug: "talonic-submit-agent-task",
      },
    ],
    mentions: ["heartbeat", "lease expiry", "execution epoch", "long-running task"],
  },
  talonic_submit_agent_task: {
    task: "review",
    seoTitle: "talonic_submit_agent_task — Submit Typed Task Outputs",
    description:
      "MCP tool that submits the declared, typed outputs for a claimed agent task in one step, checked against the expected fields, after which the document moves on.",
    faq: [
      {
        question: "Can an Agent task return extra fields it discovered?",
        answer:
          "No. Fields that weren't asked for, and values of the wrong type, are refused before anything is written. Add the output to the Spec first; new documents then ask for it.",
      },
      {
        question: "What happens if my submission fails validation?",
        answer:
          "Nothing is written: all fields are saved or none. The task stays claimed under your execution epoch, so fix the outputs and submit again before the lease runs out.",
      },
      {
        question: "Can I resubmit or amend after a successful submit?",
        answer:
          "No. A successful submit ends the task and the document moves on. Corrections happen later, in review or by running the document again.",
      },
    ],
    related: [
      {
        label: "talonic_get_agent_task",
        slug: "talonic-get-agent-task",
      },
      {
        label: "talonic_claim_agent_task",
        slug: "talonic-claim-agent-task",
      },
      {
        label: "talonic_heartbeat_agent_task",
        slug: "talonic-heartbeat-agent-task",
      },
    ],
    mentions: ["submit outputs", "typed outputs", "agent task"],
  },
  talonic_list_decision_tasks: {
    task: "review",
    seoTitle: "talonic_list_decision_tasks — App Decision Inbox for Agents",
    description:
      "MCP tool that lists the decisions an app hands to an outside agent (apps in External mode), one task per run, with a status filter and cursor-based paging.",
    examples: [
      {
        title: "Tool input and response",
        language: "json",
        code: '// talonic_list_decision_tasks({ "app_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "status": "available", "limit": 1 })\n{\n  "data": [\n    {\n      "id": "11111111-1111-4111-8111-111111111111",\n      "customer_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",\n      "run_id": "22222222-2222-4222-8222-222222222222",\n      "app_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",\n      "status": "available",\n      "execution_epoch": 0,\n      "input_package_ref": "run",\n      "lease_seconds": 120,\n      "claimed_by": null,\n      "claimed_at": null,\n      "lease_expires_at": null,\n      "heartbeat_at": null,\n      "sla_deadline_at": "2026-09-22T10:10:00.000Z",\n      "submitted_at": null,\n      "created_at": "2026-09-22T10:00:00.000Z",\n      "updated_at": "2026-09-22T10:00:00.000Z"\n    }\n  ],\n  "pagination": { "has_more": false, "next_cursor": null }\n}',
      },
    ],
    faq: [
      {
        question: "How is a decision task different from an Agent task?",
        answer:
          "An agent task asks for output fields for one document in a Spec. A decision task asks for one app run's decision: it must match the app's output contract, cite evidence from the task's input, and is recorded as decided by an external agent. Both use the same claim, lease, heartbeat and execution-epoch rules.",
      },
      {
        question:
          "Why does the tool return 403 insufficient_scope, or carry talonic/can_invoke: false in its _meta?",
        answer:
          "Deciding is a separate permission. A tlnc_ key needs a decide grant on that app from a workspace owner. A connector session needs the apps:decide scope and a role of senior member or above, checked on every call. A connector added before that scope existed lacks it: the tools are listed but marked not callable, and removing and re-adding the Talonic connector fixes it.",
      },
      {
        question: "What do the decision task statuses mean?",
        answer:
          "available means no one holds the task; claimed means an agent holds a live lease; submitted means a decision was accepted and the run resumed; released means the claimant gave it back (it returns to available); failed means the claimant declared it undecidable and the fallback applied; timed_out means the SLA passed; cancelled means the run was cancelled or the task withdrawn.",
      },
    ],
    related: [
      {
        label: "talonic_claim_decision_task",
        slug: "talonic-claim-decision-task",
      },
      {
        label: "talonic_read_decision_package",
        slug: "talonic-read-decision-package",
      },
      {
        label: "talonic_submit_decision_task",
        slug: "talonic-submit-decision-task",
      },
      {
        label: "talonic_list_agent_tasks",
        slug: "talonic-list-agent-tasks",
      },
    ],
    mentions: [
      "decision task",
      "External mode",
      "Talonic Apps",
      "decide grant",
      "cursor pagination",
    ],
  },
  talonic_claim_decision_task: {
    task: "review",
    seoTitle: "talonic_claim_decision_task — Lease an App Decision Task",
    description:
      "MCP tool that claims an app's decision task and returns what is needed to decide: a new execution epoch, the output contract, precedents and the input outline.",
    faq: [
      {
        question: "Can I inspect a decision task before claiming it?",
        answer:
          "Only its metadata, through the list. The output contract, precedents and input go only to the agent that claims it, and that is recorded. Claim, read, and release it if it is not yours to decide.",
      },
      {
        question: "What happens when two agents claim the same task?",
        answer:
          "The second claim returns HTTP 409 while the first lease is live. Once the lease expires without a heartbeat, the task can be reclaimed; the epoch is bumped and any submit carrying the old epoch is rejected.",
      },
    ],
    related: [
      {
        label: "talonic_read_decision_package",
        slug: "talonic-read-decision-package",
      },
      {
        label: "talonic_heartbeat_decision_task",
        slug: "talonic-heartbeat-decision-task",
      },
      {
        label: "talonic_submit_decision_task",
        slug: "talonic-submit-decision-task",
      },
    ],
    mentions: ["claim", "exclusive lease", "execution epoch", "output contract", "precedents"],
  },
  talonic_read_decision_package: {
    task: "review",
    seoTitle: "talonic_read_decision_package — Read a Decision's Input",
    description:
      "MCP tool that pages through a claimed decision task's fixed input: the records the decision must rest on, each with the locator to cite it as evidence.",
    faq: [
      {
        question: "Why does reading the package return HTTP 409?",
        answer:
          "The package is readable by the current claimant only. Either the task was never claimed by this credential, or the lease lapsed and another agent reclaimed it. Claim (or reclaim) the task first, then read.",
      },
      {
        question: "Is reading the package a side effect?",
        answer:
          "It changes nothing in the task or run, but each page read is recorded, so the run's history shows what the deciding agent actually looked at.",
      },
    ],
    related: [
      {
        label: "talonic_claim_decision_task",
        slug: "talonic-claim-decision-task",
      },
      {
        label: "talonic_submit_decision_task",
        slug: "talonic-submit-decision-task",
      },
    ],
    mentions: ["input package", "evidence locator", "evidence", "cursor pagination"],
  },
  talonic_heartbeat_decision_task: {
    task: "review",
    seoTitle: "talonic_heartbeat_decision_task — Keep a Decision Lease",
    description:
      "MCP tool that extends the lease on a claimed decision task using the execution epoch from the claim, never past the SLA deadline, so long reviews keep it.",
    faq: [
      {
        question: "How often should an agent heartbeat a decision task?",
        answer:
          "Comfortably inside the lease: with the default 120-second lease, roughly every 60 seconds while the decision is still being worked on. Stop once the task is submitted, released or failed.",
      },
      {
        question: "Can a heartbeat extend past the SLA deadline?",
        answer:
          "No. The lease is clamped to sla_deadline_at. If the decision cannot be made before then, submit what you have with an honest confidence, release the task, or fail it with a reason so the fallback policy runs deliberately rather than by timeout.",
      },
    ],
    related: [
      {
        label: "talonic_claim_decision_task",
        slug: "talonic-claim-decision-task",
      },
      {
        label: "talonic_submit_decision_task",
        slug: "talonic-submit-decision-task",
      },
      {
        label: "talonic_release_decision_task",
        slug: "talonic-release-decision-task",
      },
    ],
    mentions: ["heartbeat", "lease expiry", "SLA deadline", "execution epoch"],
  },
  talonic_submit_decision_task: {
    task: "review",
    seoTitle: "talonic_submit_decision_task — Submit an Evidenced Decision",
    description:
      "MCP tool that submits the decision for a claimed task: outcome checked against the output contract, evidence against the task's input, and a rationale.",
    faq: [
      {
        question: "Can the evidence cite something outside the input package?",
        answer:
          "Only a db: or ref: locator naming a connection or reference table the app is allowed to read; those are accepted and recorded. Any other locator from outside the input, and the reserved api: prefix, is refused.",
      },
      {
        question: "What if the app's thresholds disagree with my decision?",
        answer:
          "The decision is still accepted. The app's limits (the confidence needed to act automatically, amounts that need approval) are applied afterwards; a breach sends the run to a person and is never silent.",
      },
    ],
    related: [
      {
        label: "talonic_claim_decision_task",
        slug: "talonic-claim-decision-task",
      },
      {
        label: "talonic_read_decision_package",
        slug: "talonic-read-decision-package",
      },
      {
        label: "talonic_release_decision_task",
        slug: "talonic-release-decision-task",
      },
      {
        label: "talonic_fail_decision_task",
        slug: "talonic-fail-decision-task",
      },
    ],
    mentions: ["evidence", "rationale", "output contract", "submit decision"],
  },
  talonic_release_decision_task: {
    task: "review",
    seoTitle: "talonic_release_decision_task — Give a Decision Task Back",
    description:
      "MCP tool that releases a claimed decision task back to available without deciding it, so another agent can claim it; the next claim bumps the execution epoch.",
    faq: [
      {
        question: "Release or fail — which one?",
        answer:
          "Release when the task is decidable but not by you right now: another claimant gets the same package and contract. Fail when no claimant could decide it from this package: that raises a Human Review with your reason and applies the app's fallback policy.",
      },
    ],
    related: [
      {
        label: "talonic_claim_decision_task",
        slug: "talonic-claim-decision-task",
      },
      {
        label: "talonic_fail_decision_task",
        slug: "talonic-fail-decision-task",
      },
    ],
    mentions: ["release", "give-back", "execution epoch"],
  },
  talonic_fail_decision_task: {
    task: "review",
    seoTitle: "talonic_fail_decision_task — Declare a Task Undecidable",
    description:
      "MCP tool that marks a claimed decision task as undecidable: it raises a Human Review carrying the agent's reason and applies the app's declared fallback policy.",
    faq: [
      {
        question: "Is failing a decision task destructive?",
        answer:
          "Yes, and it is marked destructive. No data is deleted, but the task ends as failed, a review is raised with your reason, and the app's fallback runs, which can fail the whole run. A failed task can't be claimed again.",
      },
    ],
    related: [
      {
        label: "talonic_release_decision_task",
        slug: "talonic-release-decision-task",
      },
      {
        label: "talonic_submit_decision_task",
        slug: "talonic-submit-decision-task",
      },
    ],
    mentions: ["fail", "fallback policy", "Human Review", "undecidable"],
  },
  talonic_process_list: {
    task: "automate",
    seoTitle: "talonic_process_list — List a Workspace's Processes",
    description:
      "MCP tool that lists a Talonic workspace's processes with their live version, folder, tags and number of steps. Start here: the other process tools take its id.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_list({})\n{ "data": [{ "id": "11111111-1111-4111-8111-111111111111", "name": "Vendor bank details change", "liveVersion": 3, "folder": "Finance", "tags": ["ap"], "steps": 7 }] }',
      },
    ],
    faq: [
      {
        question: "Does it show drafts?",
        answer:
          "Yes. A process with `liveVersion: null` has never been published and cannot be started.",
      },
    ],
    related: [
      {
        label: "talonic_process_run",
        slug: "talonic-process-run",
      },
      {
        label: "talonic_process_runs",
        slug: "talonic-process-runs",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_run: {
    task: "automate",
    seoTitle: "talonic_process_run — Start a Process for One Item",
    description:
      "MCP tool that starts a published Talonic process for one item, with values given by field name, and returns the process's reply or where the run stands now.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_run({ "process_id": "11111111-1111-4111-8111-111111111111", "values": { "Vendor": "Acme", "Amount": 1200 } })\n{ "runId": "22222222-2222-4222-8222-222222222222", "process": "Vendor bank details change", "reply": { "status": 200, "body": "Received" } }',
      },
    ],
    faq: [
      {
        question: "Is it a write?",
        answer:
          "Yes. It needs permission to run processes and the write scope, and it is marked as a write.",
      },
    ],
    related: [
      {
        label: "talonic_process_status",
        slug: "talonic-process-status",
      },
      {
        label: "talonic_process_list",
        slug: "talonic-process-list",
      },
    ],
    mentions: ["start", "run", "process", "workflow"],
  },
  talonic_process_status: {
    task: "automate",
    seoTitle: "talonic_process_status — Where a Process Run Stands",
    description:
      "MCP tool that shows where a Talonic process run stands: per step how many items are waiting, done or failed, and each item's state. Default: the latest run.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_status({ "process_id": "11111111-1111-4111-8111-111111111111" })\n{ "status": { "...": "per step counts" }, "items": { "runId": "22222222-2222-4222-8222-222222222222", "items": [{ "name": "Acme", "state": "waiting" }] } }',
      },
    ],
    related: [
      {
        label: "talonic_process_runs",
        slug: "talonic-process-runs",
      },
      {
        label: "talonic_process_sign",
        slug: "talonic-process-sign",
      },
    ],
    mentions: ["status", "run", "process"],
  },
  talonic_process_runs: {
    task: "automate",
    seoTitle: "talonic_process_runs — Process Runs Across Processes",
    description:
      "MCP tool that lists Talonic process runs across all processes, newest first, with items done, waiting and failed; filter by process or runs waiting for you.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_runs({ "state": "stuck" })\n{ "runs": [{ "runId": "22222222-2222-4222-8222-222222222222", "process": "Vendor bank details change", "status": "running", "items": 3, "failed": 1 }], "page": 0, "more": false }',
      },
    ],
    related: [
      {
        label: "talonic_process_status",
        slug: "talonic-process-status",
      },
    ],
    mentions: ["runs", "executions", "stuck"],
  },
  talonic_process_waiting_for_me: {
    task: "review",
    seoTitle: "talonic_process_waiting_for_me — Sign-offs for You",
    description:
      "MCP tool that lists the Talonic sign-offs and forms waiting for the caller, per process and step, with how many items wait on each before the run moves on.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_waiting_for_me({})\n{ "data": [{ "processId": "11111111-1111-4111-8111-111111111111", "process": "Vendor bank details change", "stepId": "ok", "step": "Finance signs", "waiting": 2 }] }',
      },
    ],
    related: [
      {
        label: "talonic_process_sign",
        slug: "talonic-process-sign",
      },
      {
        label: "talonic_process_status",
        slug: "talonic-process-status",
      },
    ],
    mentions: ["approval", "sign-off", "inbox"],
  },
  talonic_process_sign: {
    task: "review",
    seoTitle: "talonic_process_sign — Sign a Step of a Process Run",
    description:
      "MCP tool that signs a sign-off step of a Talonic process run for the caller: approve every waiting item or only some, with a decision where the step offers one.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_sign({ "process_id": "11111111-1111-4111-8111-111111111111", "run_id": "22222222-2222-4222-8222-222222222222", "step_id": "ok" })\n{ "released": 2, "alreadySigned": 0 }',
      },
    ],
    faq: [
      {
        question: "Can it sign for someone else?",
        answer:
          "No. It signs as the person behind the key, and only steps that person is assigned to.",
      },
    ],
    related: [
      {
        label: "talonic_process_waiting_for_me",
        slug: "talonic-process-waiting-for-me",
      },
    ],
    mentions: ["approve", "sign", "sign-off"],
  },
  talonic_process_get: {
    task: "build",
    seoTitle: "talonic_process_get — Read One Process and Its Draft",
    description:
      "MCP tool that reads one Talonic process with its draft: its fields, its steps with their ids and settings, and the arrows between them, before changing it.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_get({ "process_id": "1111…" })\n{ "id": "1111…", "name": "Invoice approval", "activeVersion": 2, "draft": { "fields": [], "steps": [{ "id": "s_1", "kind": "approval", "name": "Manager approval" }], "flow": [] } }',
      },
    ],
    faq: [
      {
        question: "Does it return the live version or the draft?",
        answer:
          "The draft. `activeVersion` says which published version is live; talonic_process_check shows how the draft differs from it.",
      },
    ],
    related: [
      {
        label: "talonic_process_change",
        slug: "talonic-process-change",
      },
      {
        label: "talonic_process_check",
        slug: "talonic-process-check",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_create: {
    task: "build",
    seoTitle: "talonic_process_create — Set Up a New Process Draft",
    description:
      "MCP tool that sets up a new Talonic process as a draft, from a description in plain words or an exported n8n workflow. Nothing runs until it is published.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_create({ "description": "Invoices arrive by mail. Read vendor and amount. Over 10,000 a manager approves." })\n{ "id": "1111…", "name": "Invoice approval", "steps": 5, "explanation": "Reads each invoice and sends large ones to a manager.", "questions": ["Who is the manager?"], "stillOpen": ["Who signs here? Choose a person, a role or a group."], "notes": [] }',
      },
    ],
    faq: [
      {
        question: "Does creating a process start anything?",
        answer:
          "No. It is a draft until talonic_process_publish; no document is read, no mail sent and no system called before that.",
      },
    ],
    related: [
      {
        label: "talonic_process_change",
        slug: "talonic-process-change",
      },
      {
        label: "talonic_process_check",
        slug: "talonic-process-check",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_change: {
    task: "build",
    seoTitle: "talonic_process_change — Change a Talonic Process Draft",
    description:
      "MCP tool that changes a Talonic process draft from an instruction in plain words, and saves nothing until the user agreed when the change reduces governance.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_change({ "process_id": "1111…", "change": "Remove the manager approval." })\n{ "status": "needs_confirmation", "reductions": ["\\"Manager approval\\" is removed: nobody signs or reviews there any more."] }',
      },
    ],
    faq: [
      {
        question: "What does needs_confirmation mean?",
        answer:
          "Nothing was saved. The change takes control away from people; show the user the listed points and send the same change with `confirmed: true` only if they agree.",
      },
    ],
    related: [
      {
        label: "talonic_process_get",
        slug: "talonic-process-get",
      },
      {
        label: "talonic_process_check",
        slug: "talonic-process-check",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_check: {
    task: "build",
    seoTitle: "talonic_process_check — Check a Draft Before Going Live",
    description:
      "MCP tool that says what a Talonic process draft still needs per step before it can go live, every problem it finds, and what publishing it would change.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_check({ "process_id": "1111…" })\n{ "check": { "canPublish": false, "stillNeeded": [{ "stepId": "s_1", "key": "assignees", "message": "Who signs here? Choose a person, a role or a group." }], "problems": [] }, "changes": { "changes": [{ "type": "step_added", "text": "Manager approval added" }] } }',
      },
    ],
    faq: [
      {
        question: "Can a draft with open points be published?",
        answer: "No. talonic_process_publish is refused while `canPublish` is false.",
      },
    ],
    related: [
      {
        label: "talonic_process_change",
        slug: "talonic-process-change",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
      {
        label: "talonic_process_test_run",
        slug: "talonic-process-test-run",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_test_run: {
    task: "build",
    seoTitle: "talonic_process_test_run — Test a Process Draft Safely",
    description:
      "MCP tool that runs a Talonic process draft on real documents in a test copy that sends nothing out, so you can see each step's result before going live.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_test_run({ "process_id": "1111…", "document_ids": ["3333…"] })\n{ "processId": "4444…", "endsAt": [{ "stepId": "s_1", "name": "Manager approval" }], "runId": "2222…" }',
      },
    ],
    faq: [
      {
        question: "Does a test run send mail?",
        answer: "No. A test copy delivers nothing, sends no mail and calls no system.",
      },
    ],
    related: [
      {
        label: "talonic_process_status",
        slug: "talonic-process-status",
      },
      {
        label: "talonic_process_check",
        slug: "talonic-process-check",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_publish: {
    task: "build",
    seoTitle: "talonic_process_publish — Make a Process Draft Live",
    description:
      "MCP tool that makes a Talonic process draft the live version, so it starts, sends mail and calls systems for real. Refused while the check still finds an error.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_publish({ "process_id": "1111…", "reason": "Second approver added" })\n{ "version": 3, "changed": true }',
      },
    ],
    faq: [
      {
        question: "Can a publish be undone?",
        answer:
          "talonic_process_rollback makes an earlier version live again. What the new version already did (mail sent, systems called) stays done.",
      },
    ],
    related: [
      {
        label: "talonic_process_check",
        slug: "talonic-process-check",
      },
      {
        label: "talonic_process_versions",
        slug: "talonic-process-versions",
      },
      {
        label: "talonic_process_rollback",
        slug: "talonic-process-rollback",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_versions: {
    task: "build",
    seoTitle: "talonic_process_versions — Published Process Versions",
    description:
      "MCP tool that lists the published versions of a Talonic process, newest first, with who published each one and why, to choose a version to roll back to.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_versions({ "process_id": "1111…" })\n[{ "n": 3, "publishedAt": "2026-11-24T06:22:00Z", "reason": "Second approver added" }]',
      },
    ],
    faq: [
      {
        question: "Is the draft a version?",
        answer: "No. Only published states are versions.",
      },
    ],
    related: [
      {
        label: "talonic_process_rollback",
        slug: "talonic-process-rollback",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_rollback: {
    task: "build",
    seoTitle: "talonic_process_rollback — Roll a Process Back Live",
    description:
      "MCP tool that makes an earlier published version of a Talonic process live again. It changes what runs for real, so call it only when the user asks for it.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_rollback({ "process_id": "1111…", "version": 2 })\n{ "version": 2 }',
      },
    ],
    faq: [
      {
        question: "Does a rollback change the draft?",
        answer: "No. The draft stays as it is; only the live version changes.",
      },
    ],
    related: [
      {
        label: "talonic_process_versions",
        slug: "talonic-process-versions",
      },
      {
        label: "talonic_process_publish",
        slug: "talonic-process-publish",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_delete: {
    task: "build",
    seoTitle: "talonic_process_delete — Delete a Process for Good",
    description:
      "MCP tool that deletes a Talonic process. Not possible while a run is open, and it cannot be undone: call it only when the user named the process to delete.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_delete({ "process_id": "1111…" })\n{ "deleted": true }',
      },
    ],
    faq: [
      {
        question: "What happens to its past runs?",
        answer: "A process with an open run cannot be deleted. Finished runs go with the process.",
      },
    ],
    related: [
      {
        label: "talonic_process_list",
        slug: "talonic-process-list",
      },
      {
        label: "talonic_process_runs",
        slug: "talonic-process-runs",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_item: {
    task: "automate",
    seoTitle: "talonic_process_item — One Item's Way Through a Run",
    description:
      "MCP tool that shows one item's way through a Talonic process run, step by step, with status, time and notes such as why it stopped, and its values now.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_item({ "process_id": "1111…", "run_id": "2222…", "item_key": "3333…" })\n{ "steps": [{ "name": "Log it", "status": "stopped", "note": "The other system answered 500.", "canRetry": true }], "values": [{ "name": "amount", "value": 900 }] }',
      },
    ],
    faq: [
      {
        question: "Where do I see why an item failed?",
        answer: "In the `note` of the step that stopped.",
      },
    ],
    related: [
      {
        label: "talonic_process_status",
        slug: "talonic-process-status",
      },
      {
        label: "talonic_process_retry",
        slug: "talonic-process-retry",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_retry: {
    task: "automate",
    seoTitle: "talonic_process_retry — Retry the Failed Steps of a Run",
    description:
      "MCP tool that tries every failed step of a Talonic process run again. Steps that send or call will send or call again: use it once the cause is fixed.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_retry({ "run_id": "2222…" })\n{ "retried": 1 }',
      },
    ],
    faq: [
      {
        question: "Does a retry repeat steps that succeeded?",
        answer: "No. Only failed steps run again.",
      },
    ],
    related: [
      {
        label: "talonic_process_runs",
        slug: "talonic-process-runs",
      },
      {
        label: "talonic_process_item",
        slug: "talonic-process-item",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_send_back: {
    task: "review",
    seoTitle: "talonic_process_send_back — Send Items Back in a Run",
    description:
      "MCP tool that sends items back from a sign-off step of a Talonic process run with a reason, for the caller: the opposite of signing, where they are assigned.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_send_back({ "process_id": "1111…", "run_id": "2222…", "step_id": "s_1", "items": ["3333…"], "reason": "Amount does not match the order" })\n{ "sentBack": 1 }',
      },
    ],
    faq: [
      {
        question: "Where do sent-back items go?",
        answer:
          "To where the process says: the step before, or the step its settings name for stopped items.",
      },
    ],
    related: [
      {
        label: "talonic_process_sign",
        slug: "talonic-process-sign",
      },
      {
        label: "talonic_process_waiting_for_me",
        slug: "talonic-process-waiting-for-me",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_setup: {
    task: "build",
    seoTitle: "talonic_process_setup — People, Mailboxes and Look-ups",
    description:
      "MCP tool that lists what Talonic processes can use: who a step can wait for, the connected mailboxes, the names of stored secrets and data look-ups can read.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_setup({})\n{ "people": { "roles": [{ "id": "owner", "name": "Admin" }], "groups": [] }, "mailboxes": { "data": [{ "id": "5555…", "name": "Gmail (ap@example.com)", "canSend": true, "ownership": "company", "usable": true }] }, "secrets": { "data": ["erp_token"] }, "lookupData": { "state": "ready", "indexes": [{ "name": "contracts.contracts", "rows": 3, "ready": true }] } }',
      },
    ],
    faq: [
      {
        question: "Can a secret's value be read?",
        answer: "No. Only names are returned, by this tool and by the API.",
      },
    ],
    related: [
      {
        label: "talonic_process_mailbox_ownership",
        slug: "talonic-process-mailbox-ownership",
      },
      {
        label: "talonic_process_change",
        slug: "talonic-process-change",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_mailbox_ownership: {
    task: "build",
    seoTitle: "talonic_process_mailbox_ownership — Mailbox Owners",
    description:
      "MCP tool that marks a connected mailbox as one person's own or the company's, which decides who may put it on a Talonic process. A governance decision.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_mailbox_ownership({ "mailbox_id": "5555…", "ownership": "company" })\n{ "id": "5555…", "ownership": "company" }',
      },
    ],
    faq: [
      {
        question: "Who may change this?",
        answer: "People allowed to govern processes in the workspace.",
      },
    ],
    related: [
      {
        label: "talonic_process_setup",
        slug: "talonic-process-setup",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
  talonic_process_address: {
    task: "build",
    seoTitle: "talonic_process_address — A Process's Inbound Address",
    description:
      "MCP tool that shows whether a Talonic process has an address other systems send items to, and makes one when asked; the address is shown once, when made.",
    examples: [
      {
        title: "Example",
        language: "json",
        code: '// talonic_process_address({ "process_id": "1111…", "make": true })\n{ "token": "…", "path": "/process-hooks/…" }',
      },
    ],
    faq: [
      {
        question: "Can I read an address again later?",
        answer: "No. It is shown once. Making a new one switches the old one off.",
      },
    ],
    related: [
      {
        label: "talonic_process_run",
        slug: "talonic-process-run",
      },
      {
        label: "talonic_process_setup",
        slug: "talonic-process-setup",
      },
    ],
    mentions: ["process", "workflow", "Process Plane"],
  },
}
