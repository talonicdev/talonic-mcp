import type { RawSection } from "../types"

export const sections: RawSection[] = [
  {
    slug: "talonic-extract",
    parentSlug: "tools",
    title: "talonic_extract",
    seoTitle: "talonic_extract Tool — Talonic MCP",
    description:
      "Extract structured, schema-validated data from a document. Returns clean JSON with per-field confidence scores.",
    content: [
      { type: "paragraph", text: "Extract structured, schema-validated data from a document." },
      {
        type: "paragraph",
        text: "Inputs: one of `file_data` + `filename` (recommended for chat clients), `file_path`, `file_url`, or `document_id`, plus a `schema` (or `schema_id`). Returns clean JSON with per-field confidence scores.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "file_data",
            type: "string",
            description: "Base64-encoded file bytes. Recommended for chat clients (drag-and-drop).",
          },
          {
            name: "filename",
            type: "string",
            description: "Original filename (used for MIME type inference when using `file_data`).",
          },
          { name: "file_path", type: "string", description: "Local file path." },
          { name: "file_url", type: "string", description: "Remote file URL." },
          {
            name: "document_id",
            type: "string",
            description: "ID of a previously uploaded document.",
          },
          {
            name: "schema",
            type: "object",
            description: "Inline schema definition (JSON Schema or flat key-type map).",
          },
          {
            name: "schema_id",
            type: "string",
            description: "UUID or SCH-XXXXXXXX short ID of a saved schema.",
          },
          {
            name: "instructions",
            type: "string",
            description: "Natural-language guidance for the extractor.",
          },
          {
            name: "include_markdown",
            type: "boolean",
            description: "Include OCR markdown alongside structured data.",
          },
        ],
      },
      {
        type: "callout",
        variant: "warning",
        text: "Always provide a `schema` or `schema_id`. Auto-discovery extract (no schema) is not reliable in v0.1.",
      },
      { type: "heading", level: 3, id: "extract-inline-schema", text: "Example: inline schema" },
      {
        type: "code",
        language: "json",
        title: "Tool input",
        code: `{
  "file_url": "https://example.com/invoice-2026-001.pdf",
  "schema": {
    "type": "object",
    "properties": {
      "vendor_name": { "type": "string" },
      "invoice_number": { "type": "string" },
      "total_amount": { "type": "number" },
      "due_date": { "type": "string", "format": "date" },
      "line_items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "description": { "type": "string" },
            "amount": { "type": "number" }
          }
        }
      }
    },
    "required": ["vendor_name", "total_amount"]
  },
  "instructions": "Amounts are in EUR. Focus on the billing section."
}`,
      },
      {
        type: "code",
        language: "json",
        title: "Tool response",
        code: `{
  "extraction_id": "ext_8f3a...",
  "request_id": "req_2c91...",
  "status": "complete",
  "document": {
    "id": "doc_8f3a...",
    "filename": "invoice-2026-001.pdf",
    "pages": 2,
    "type_detected": "invoice",
    "language_detected": "de"
  },
  "data": {
    "vendor_name": "Meridian Energy AG",
    "invoice_number": "INV-2026-001",
    "total_amount": 1500.00,
    "due_date": "2026-06-15",
    "line_items": [
      { "description": "Consulting, April", "amount": 1200.00 },
      { "description": "Travel expenses", "amount": 300.00 }
    ]
  },
  "schema": {
    "source": "inline"
  },
  "confidence": {
    "overall": 0.97,
    "fields": {
      "vendor_name": 0.98,
      "invoice_number": 0.95,
      "total_amount": 0.99,
      "due_date": 0.97
    }
  },
  "processing": {
    "duration_ms": 2840,
    "pages_processed": 2,
    "region": "eu-central-1"
  }
}`,
      },
      { type: "heading", level: 3, id: "extract-schema-id", text: "Example: saved schema" },
      {
        type: "code",
        language: "json",
        title: "Tool input",
        code: `{
  "file_path": "./contracts/lease-agreement.pdf",
  "schema_id": "SCH-A1B2C3D4"
}`,
      },
      {
        type: "code",
        language: "json",
        title: "Tool response",
        code: `{
  "extraction_id": "ext_b29f...",
  "request_id": "req_4c81...",
  "status": "complete",
  "document": {
    "id": "doc_91ad...",
    "filename": "lease-agreement.pdf",
    "pages": 8,
    "type_detected": "lease_agreement",
    "language_detected": "en"
  },
  "data": {
    "lessor": "Acme Holdings Ltd.",
    "lessee": "Meridian Energy AG",
    "premises_address": "12 Hauptstrasse, 10115 Berlin",
    "term_start": "2026-07-01",
    "term_end": "2031-06-30",
    "monthly_rent_eur": 4250.00
  },
  "schema": {
    "source": "saved",
    "id": "SCH-A1B2C3D4"
  },
  "confidence": {
    "overall": 0.94,
    "fields": {
      "lessor": 0.97,
      "lessee": 0.97,
      "premises_address": 0.92,
      "term_start": 0.95,
      "term_end": 0.95,
      "monthly_rent_eur": 0.91
    }
  },
  "processing": {
    "duration_ms": 4380,
    "pages_processed": 8,
    "region": "eu-central-1"
  }
}`,
      },
    ],
    related: [
      { label: "talonic_to_markdown", slug: "talonic-to-markdown" },
      { label: "talonic_save_schema", slug: "talonic-save-schema" },
      { label: "Drag & Drop Files", slug: "drag-and-drop" },
    ],
    faq: [
      {
        question: "How does talonic_extract work?",
        answer:
          "Send a document (file_data, file_path, file_url, or document_id) with a schema or schema_id. The tool returns schema-validated JSON with per-field confidence scores.",
      },
    ],
    mentions: ["extract", "schema", "confidence scores", "file_data"],
  },
  {
    slug: "talonic-search",
    parentSlug: "tools",
    title: "talonic_search",
    seoTitle: "talonic_search Tool — Talonic MCP",
    description:
      "Omnisearch across documents, fields, sources, and schemas in the workspace. Supports conceptual and fuzzy queries.",
    content: [
      {
        type: "paragraph",
        text: "Omnisearch across documents, fields, sources, and schemas in the workspace. Use for conceptual or fuzzy queries.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "query",
            type: "string",
            required: true,
            description: "The search query. Supports fuzzy and conceptual matching.",
          },
          {
            name: "limit",
            type: "integer",
            description: "Maximum results per entity type. Default: 5.",
          },
        ],
      },
      { type: "heading", level: 3, id: "search-example", text: "Example" },
      {
        type: "code",
        language: "json",
        title: "Tool input",
        code: `{
  "query": "indemnification clauses Acme",
  "limit": 10
}`,
      },
      {
        type: "code",
        language: "json",
        title: "Tool response",
        code: `{
  "documents": [
    {
      "id": "doc_4e7b...",
      "filename": "acme-services-agreement.pdf",
      "type_detected": "Services Agreement",
      "score": 0.92
    }
  ],
  "fieldMatches": [
    {
      "fieldName": "indemnification.cap_amount",
      "documentId": "doc_4e7b...",
      "value": "2x annual fees",
      "score": 0.88
    }
  ],
  "schemas": [],
  "sources": [],
  "fields": [
    { "canonicalName": "indemnification.cap_amount", "type": "string" }
  ]
}`,
      },
    ],
    related: [{ label: "talonic_filter", slug: "talonic-filter" }],
    faq: [
      {
        question: "What does talonic_search do?",
        answer:
          "It searches across documents, fields, sources, and schemas in the workspace using fuzzy and conceptual matching.",
      },
    ],
    mentions: ["search", "omnisearch", "fuzzy"],
  },
  {
    slug: "talonic-filter",
    parentSlug: "tools",
    title: "talonic_filter",
    seoTitle: "talonic_filter Tool — Talonic MCP",
    description:
      "Filter documents by extracted field values using composable conditions like eq, gt, between, and contains.",
    content: [
      {
        type: "paragraph",
        text: "Filter documents by extracted field values using composable conditions (`eq`, `gt`, `between`, `contains`, etc.).",
      },
      {
        type: "paragraph",
        text: "Accepts canonical field names (e.g. `vendor.name`, `policy.0_coverage_type`) which the Talonic API resolves to IDs server-side, or UUIDs directly.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "conditions",
            type: "array",
            required: true,
            description:
              "Filter conditions, AND-ed together. Each has `field` or `field_id`, `operator`, and `value`.",
          },
          {
            name: "search",
            type: "string",
            description: "Optional free-text search applied alongside filters.",
          },
          {
            name: "sort",
            type: "object",
            description: 'Sort by a field: `{ field, direction: "asc" | "desc" }`.',
          },
          { name: "page", type: "integer", description: "Page number for pagination." },
          { name: "limit", type: "integer", description: "Results per page. Default: 50." },
        ],
      },
      {
        type: "callout",
        variant: "warning",
        text: "Two limitations: (1) only fields where the search response shows `filterable: true` can be used with `talonic_filter`; entries with `filterable: false` have no extracted data yet. (2) `is_not_empty` is intentionally not exposed in v0.1; use `eq`/`gt`/`contains` against a known value or invert `is_empty` client-side.",
      },
      { type: "heading", level: 3, id: "filter-example", text: "Example" },
      {
        type: "code",
        language: "json",
        title: "Tool input",
        code: `{
  "conditions": [
    { "field": "vendor.name", "operator": "eq", "value": "Meridian Energy AG" },
    { "field": "invoice.total_eur", "operator": "gt", "value": 1000 }
  ],
  "sort": { "field": "invoice.total_eur", "direction": "desc" },
  "limit": 20
}`,
      },
      {
        type: "code",
        language: "json",
        title: "Tool response",
        code: `{
  "data": [
    {
      "document_id": "doc_8f3a...",
      "filename": "invoice-2026-001.pdf",
      "fields": {
        "vendor.name": "Meridian Energy AG",
        "invoice.total_eur": 1500.00,
        "invoice.due_date": "2026-06-15"
      }
    },
    {
      "document_id": "doc_c2d9...",
      "filename": "invoice-2026-003.pdf",
      "fields": {
        "vendor.name": "Meridian Energy AG",
        "invoice.total_eur": 1200.00,
        "invoice.due_date": "2026-04-30"
      }
    }
  ],
  "total": 2,
  "page": 1
}`,
      },
    ],
    related: [
      { label: "talonic_search", slug: "talonic-search" },
      { label: "Known Limitations", slug: "known-limitations" },
    ],
    faq: [
      {
        question: "How do I filter documents by field value?",
        answer:
          "Use talonic_filter with canonical field names and operators like eq, gt, between, contains. The API resolves field names to IDs server-side.",
      },
    ],
    mentions: ["filter", "canonical field names", "operators"],
  },
  {
    slug: "talonic-get-document",
    parentSlug: "tools",
    title: "talonic_get_document",
    seoTitle: "talonic_get_document Tool — Talonic MCP",
    description:
      "Fetch full metadata for a single document by ID, including processing log and link URLs.",
    content: [
      {
        type: "paragraph",
        text: "Fetch full metadata for a single document by ID, including processing log and link URLs.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "string",
            required: true,
            description: "The document UUID.",
          },
        ],
      },
      { type: "heading", level: 3, id: "get-document-example", text: "Example" },
      {
        type: "code",
        language: "json",
        title: "Tool input",
        code: `{
  "document_id": "doc_8f3a1b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c"
}`,
      },
      {
        type: "code",
        language: "json",
        title: "Tool response",
        code: `{
  "id": "doc_8f3a1b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "filename": "invoice-2026-001.pdf",
  "status": "completed",
  "pages": 2,
  "size_bytes": 184320,
  "mime_type": "application/pdf",
  "type_detected": "Invoice",
  "language_detected": "de",
  "source": { "id": "src_a1b2...", "type": "api" },
  "links": {
    "self": "https://api.talonic.com/v1/documents/doc_8f3a...",
    "extractions": "https://api.talonic.com/v1/documents/doc_8f3a.../extractions",
    "dashboard": "https://app.talonic.com/documents/doc_8f3a..."
  }
}`,
      },
    ],
    related: [
      { label: "talonic_to_markdown", slug: "talonic-to-markdown" },
      { label: "talonic_extract", slug: "talonic-extract" },
    ],
    faq: [
      {
        question: "How do I get document metadata via MCP?",
        answer:
          "Call talonic_get_document with the document UUID to get full metadata including processing log and link URLs.",
      },
    ],
    mentions: ["document", "metadata", "processing log"],
  },
  {
    slug: "talonic-to-markdown",
    parentSlug: "tools",
    title: "talonic_to_markdown",
    seoTitle: "talonic_to_markdown Tool — Talonic MCP",
    description:
      "Get OCR-converted markdown for a document. Accepts document_id, file_data + filename, file_path, or file_url.",
    content: [
      {
        type: "paragraph",
        text: "Get OCR-converted markdown for a document. Accepts `document_id` (cheapest — no re-upload), `file_data` + `filename`, `file_path`, or `file_url`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "document_id",
            type: "string",
            description: "ID of an already-ingested document (cheapest path).",
          },
          {
            name: "file_data",
            type: "string",
            description: "Base64-encoded file bytes. Pair with `filename`.",
          },
          { name: "filename", type: "string", description: "Original filename with extension." },
          { name: "file_path", type: "string", description: "Local file path." },
          {
            name: "file_url",
            type: "string",
            description: "Remote URL the API fetches server-side.",
          },
        ],
      },
      { type: "heading", level: 3, id: "to-markdown-example", text: "Example" },
      {
        type: "code",
        language: "json",
        title: "Tool input",
        code: `{
  "document_id": "doc_8f3a1b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c"
}`,
      },
      {
        type: "code",
        language: "markdown",
        title: "Tool response",
        code: `# Invoice INV-2026-001

**Meridian Energy AG**
Musterstraße 42, 10115 Berlin

| Item                  | Amount     |
|-----------------------|------------|
| Consulting — April    | €1,200.00  |
| Travel expenses       | €300.00    |
| **Total**             | **€1,500.00** |

Due date: 15 June 2026
Payment terms: Net 30`,
      },
    ],
    related: [
      { label: "talonic_extract", slug: "talonic-extract" },
      { label: "Drag & Drop Files", slug: "drag-and-drop" },
    ],
    faq: [
      {
        question: "How do I get markdown from a document via MCP?",
        answer:
          "Call talonic_to_markdown with a document_id (cheapest), or provide the file directly via file_data, file_path, or file_url.",
      },
    ],
    mentions: ["markdown", "OCR", "document_id"],
  },
  {
    slug: "talonic-list-schemas",
    parentSlug: "tools",
    title: "talonic_list_schemas",
    seoTitle: "talonic_list_schemas Tool — Talonic MCP",
    description: "List all saved schemas with their definitions in the workspace.",
    content: [
      {
        type: "paragraph",
        text: "List all saved schemas with their definitions. Returns schema IDs (both UUID and `SCH-XXXXXXXX` short format), names, and field definitions.",
      },
      {
        type: "paragraph",
        text: "The `talonic://schemas` resource exposes the same data to clients that browse resources separately (Claude Desktop and Cowork render these in the UI).",
      },
      { type: "heading", level: 3, id: "list-schemas-example", text: "Example" },
      { type: "paragraph", text: "No input parameters required." },
      {
        type: "code",
        language: "json",
        title: "Tool response",
        code: `{
  "schemas": [
    {
      "id": "sch_7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
      "short_id": "SCH-A1B2C3D4",
      "name": "Standard Invoice",
      "description": "Extracts vendor, line items, totals, and payment terms.",
      "version": 3,
      "field_count": 6,
      "definition": {
        "type": "object",
        "properties": {
          "vendor_name": { "type": "string" },
          "invoice_number": { "type": "string" },
          "total_amount": { "type": "number" },
          "due_date": { "type": "string", "format": "date" },
          "currency": { "type": "string" },
          "line_items": { "type": "array" }
        },
        "required": ["vendor_name", "total_amount"]
      }
    },
    {
      "id": "sch_e5f6a7b8-c9d0-1e2f-3a4b-5c6d7e8f9a0b",
      "short_id": "SCH-E5F6A7B8",
      "name": "Certificate of Insurance",
      "description": "Extracts insured party, coverage types, limits, and expiry.",
      "version": 1,
      "field_count": 8,
      "definition": { "type": "object", "properties": { "..." : {} } }
    }
  ]
}`,
      },
    ],
    related: [
      { label: "talonic_save_schema", slug: "talonic-save-schema" },
      { label: "talonic_extract", slug: "talonic-extract" },
    ],
    faq: [
      {
        question: "How do I list schemas via MCP?",
        answer:
          "Call talonic_list_schemas to get all saved schemas with their definitions. The talonic://schemas resource also exposes this data.",
      },
    ],
    mentions: ["schemas", "list", "SCH-XXXXXXXX"],
  },
  {
    slug: "talonic-save-schema",
    parentSlug: "tools",
    title: "talonic_save_schema",
    seoTitle: "talonic_save_schema Tool — Talonic MCP",
    description: "Save a schema definition to the workspace for reuse across extractions.",
    content: [
      {
        type: "paragraph",
        text: "Save a schema definition to the workspace for reuse. Returns a `schema_id` that can be passed to `talonic_extract`.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "name",
            type: "string",
            required: true,
            description: "Human-readable schema name.",
          },
          {
            name: "definition",
            type: "object",
            required: true,
            description:
              'Schema definition. Full JSON Schema `{type: "object", properties: {...}}` recommended.',
          },
          {
            name: "description",
            type: "string",
            description: "What this schema extracts and when to use it.",
          },
        ],
      },
      {
        type: "callout",
        text: 'Prefer full JSON Schema format with `type: "object"` and `properties`. The flat key-type map format is not fully supported server-side yet.',
      },
      { type: "heading", level: 3, id: "save-schema-example", text: "Example" },
      {
        type: "code",
        language: "json",
        title: "Tool input",
        code: `{
  "name": "Standard Invoice",
  "description": "Extracts vendor, line items, totals, and payment terms from invoices.",
  "definition": {
    "type": "object",
    "properties": {
      "vendor_name": { "type": "string" },
      "invoice_number": { "type": "string" },
      "total_amount": { "type": "number" },
      "due_date": { "type": "string", "format": "date" },
      "line_items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "description": { "type": "string" },
            "amount": { "type": "number" }
          }
        }
      }
    },
    "required": ["vendor_name", "total_amount"]
  }
}`,
      },
      {
        type: "code",
        language: "json",
        title: "Tool response",
        code: `{
  "id": "sch_7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
  "short_id": "SCH-A1B2C3D4",
  "name": "Standard Invoice",
  "description": "Extracts vendor, line items, totals, and payment terms from invoices.",
  "version": 1,
  "field_count": 5
}`,
      },
    ],
    related: [
      { label: "talonic_list_schemas", slug: "talonic-list-schemas" },
      { label: "talonic_extract", slug: "talonic-extract" },
    ],
    faq: [
      {
        question: "How do I save a schema via MCP?",
        answer:
          "Call talonic_save_schema with a name and JSON Schema definition. It returns a schema_id for reuse in talonic_extract calls.",
      },
    ],
    mentions: ["save schema", "JSON Schema", "reuse"],
  },
  {
    slug: "talonic-get-balance",
    parentSlug: "tools",
    title: "talonic_get_balance",
    seoTitle: "talonic_get_balance Tool — Talonic MCP",
    description:
      "MCP tool that returns the current Talonic credit balance, EUR value, 30-day burn rate, projected runway, tier, and next monthly tier-reset timestamp.",
    content: [
      {
        type: "paragraph",
        text: "Returns the workspace's current credit balance, EUR value, 30-day burn rate, projected runway in days, API tier, and the timestamp of the next monthly tier reset. Use it for budget-aware behaviour: read the balance before scheduling a large batch, or after a sequence of extractions to track spend.",
      },
      {
        type: "heading",
        level: 3,
        id: "use-when",
        text: "When to use",
      },
      {
        type: "list",
        items: [
          "The user asks how many credits or how much budget they have left.",
          "Before kicking off a large or expensive operation (batch extract, re-extract many documents), to confirm budget headroom.",
          "The user asks how long the balance will last at the current rate.",
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "do-not-use",
        text: "When not to use",
      },
      {
        type: "list",
        items: [
          "For per-call cost of a single extraction: that is already on every `talonic_extract` response under `cost`.",
          "To top up credits: route the user to the dashboard. Auto top-up is guarded by a separate scope and is intentionally not exposed at the MCP layer.",
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "response-shape",
        text: "Response shape",
      },
      {
        type: "list",
        items: [
          "`balance_credits`: current credit balance (integer).",
          "`balance_eur`: current balance expressed in EUR (rounded to two decimals).",
          "`burn_rate_30d_credits`: total credits consumed in the trailing 30 days.",
          "`projected_runway_days`: days of runway at the current 30-day average burn rate. `-1` indicates no consumption in the trailing window (cannot compute a meaningful runway).",
          "`tier`: API tier of the workspace (`free`, `pro`, `enterprise`, etc.).",
          "`tier_resets_at`: ISO 8601 timestamp of the next monthly tier reset.",
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Tool input",
        code: `{}`,
      },
      {
        type: "code",
        language: "json",
        title: "Tool response",
        code: `{
  "balance_credits": 1888,
  "balance_eur": 9.44,
  "burn_rate_30d_credits": 360,
  "projected_runway_days": 157,
  "tier": "pro",
  "tier_resets_at": "2026-06-01T00:00:00.000Z"
}`,
      },
    ],
    related: [
      { label: "talonic_extract", slug: "talonic-extract" },
      { label: "Pricing", slug: "pricing" },
    ],
    faq: [
      {
        question: "How do I check my Talonic credit balance from an agent?",
        answer:
          "Call talonic_get_balance with no arguments. Returns balance_credits, balance_eur, burn_rate_30d_credits, projected_runway_days, tier, and tier_resets_at. Read-only; safe to call at any time.",
      },
      {
        question: "What does projected_runway_days = -1 mean?",
        answer:
          "It means the workspace has had zero credit consumption in the trailing 30 days, so a meaningful runway projection cannot be computed. Treat -1 as 'unknown' rather than '0 days'.",
      },
    ],
    mentions: ["credits", "balance", "EUR", "burn rate", "runway", "tier", "budget"],
  },
]
