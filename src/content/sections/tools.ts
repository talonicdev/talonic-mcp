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
        type: "paragraph",
        text: "This is the primary tool in the Talonic MCP server. When an agent calls **`talonic_extract`**, the MCP server uploads the document to the Talonic API, runs OCR and field extraction against the provided schema, and returns structured JSON with confidence metadata. The entire pipeline — upload, OCR, extraction, validation — runs server-side in a single request.",
      },
      {
        type: "paragraph",
        text: "The response includes a `document.id` that persists in your workspace. Subsequent calls can reference this ID via the `document_id` parameter to re-extract with a different schema, retrieve markdown, or fetch metadata — all without re-uploading the file. This is both faster and cheaper than sending the file again.",
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
      {
        question: "What is the fastest way to extract data from a document?",
        answer:
          "If the document is already in your workspace, pass its document_id instead of re-uploading. For new documents in chat clients, use file_data with base64-encoded bytes. For files on the web, use file_url to avoid downloading locally first.",
      },
      {
        question: "How long does an extraction typically take?",
        answer:
          "Processing time depends on document size. A 2-page invoice typically completes in 2-4 seconds. Larger documents (8+ pages) may take 4-8 seconds. The processing.duration_ms field in the response shows the exact server-side duration.",
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
        type: "paragraph",
        text: "**`talonic_search`** is designed for discovery. When a user asks a question like 'do I have any contracts about indemnification?' or 'find documents from Acme', this is the right tool. It searches across document filenames, extracted field values, schema names, and source metadata using semantic and fuzzy matching.",
      },
      {
        type: "paragraph",
        text: "The response is grouped by entity type: `documents`, `fieldMatches`, `schemas`, `sources`, and `fields`. Each result includes a relevance `score` (0..1) so the agent can assess match quality. Results with scores below 0.5 are typically not relevant and can be omitted when presenting to the user.",
      },
      {
        type: "paragraph",
        text: "For queries that require exact field-value matching (like 'invoices over 1000 EUR'), use **`talonic_filter`** instead. Search is for exploration and discovery; filter is for precision queries against structured data.",
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
      {
        type: "paragraph",
        text: "A common agent pattern is using `talonic_search` as a first step to orient within a workspace, then following up with more specific tools. For example, an agent might search for 'Acme contracts' to discover relevant documents, note the canonical field names in the response, and then use `talonic_filter` with those field names to narrow down to contracts expiring within a specific date range. This search-then-filter pattern is both efficient and reliable.",
      },
      {
        type: "paragraph",
        text: "Search results are scoped to the authenticated workspace. The query runs against all documents, extracted field values, schema definitions, and source metadata within that workspace. There is no cross-workspace search — each API key sees only its own data. The `limit` parameter controls how many results are returned per entity type (documents, fields, schemas, sources), with a default of 5. Increase the limit when the user needs a broader view of matching content.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Search results include canonical field names in `fields[].canonicalName`. These names can be used directly in `talonic_filter` conditions, making search a good first step before building precise filters.",
      },
      {
        type: "callout",
        variant: "info",
        text: 'Every `fieldMatches[]` and `fields[]` entry carries a `dataType` (`"string"`, `"number"`, `"array"`, etc.). Use it to pick the right `talonic_filter` operator on the first call — numeric operators (`gt`, `gte`, `lt`, `lte`, `between`) only resolve correctly when `dataType === "number"`. See the *Schema typing* section under `talonic_filter` for the full preventive / reactive pattern.',
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
      "documentCount": 3,
      "filterable": true,
      "dataType": "string",
      "score": 0.88
    }
  ],
  "schemas": [],
  "sources": [],
  "fields": [
    { "canonicalName": "indemnification.cap_amount", "dataType": "string", "filterable": true }
  ]
}`,
      },
      { type: "heading", level: 3, id: "search-then-filter", text: "Example: search then filter" },
      {
        type: "code",
        language: "json",
        title: "Step 1: discover field names with search",
        code: `// Agent calls talonic_search:
{
  "query": "vendor invoices total amount",
  "limit": 5
}

// Response includes canonical field names plus dataType:
{
  "fields": [
    { "canonicalName": "vendor.name", "dataType": "string", "filterable": true },
    { "canonicalName": "invoice.total_eur", "dataType": "number", "filterable": true },
    { "canonicalName": "invoice.due_date", "dataType": "string", "filterable": true }
  ]
}`,
      },
      {
        type: "code",
        language: "json",
        title: "Step 2: use discovered field names in talonic_filter",
        code: `// Agent uses canonical names from search to build a filter:
{
  "conditions": [
    { "field": "invoice.total_eur", "operator": "gt", "value": 500 }
  ],
  "sort": { "field": "invoice.total_eur", "direction": "desc" }
}`,
      },
    ],
    related: [
      { label: "talonic_filter", slug: "talonic-filter" },
      { label: "talonic_extract", slug: "talonic-extract" },
      { label: "Agent Decision Guide", slug: "agent-decision-guide" },
    ],
    faq: [
      {
        question: "What does talonic_search do?",
        answer:
          "It searches across documents, fields, sources, and schemas in the workspace using fuzzy and conceptual matching.",
      },
      {
        question: "When should I use talonic_search vs talonic_filter?",
        answer:
          "Use search for discovery and fuzzy queries ('find Acme contracts'). Use filter for precise field-value conditions ('invoices over 1000 EUR'). Search is exploration; filter is precision.",
      },
      {
        question: "What do the search scores mean?",
        answer:
          "Each result includes a relevance score from 0 to 1. Scores above 0.7 are strong matches, 0.5-0.7 are partial matches, and below 0.5 are typically not relevant.",
      },
      {
        question: "Can I search for schemas by name?",
        answer:
          "Yes. talonic_search includes schemas in its results. If you search for 'invoice', any schema with 'invoice' in its name or description will appear in the schemas array of the response. This is useful for discovering existing templates before creating new ones.",
      },
      {
        question: "How do I use search results to build a filter?",
        answer:
          "The fields array in the search response includes canonicalName values with a filterable flag. Use canonicalName values where filterable is true as the field parameter in talonic_filter conditions. This search-then-filter pattern is the recommended workflow for precise queries.",
      },
    ],
    mentions: ["search", "omnisearch", "fuzzy", "discovery"],
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
        type: "paragraph",
        text: "**`talonic_filter`** is the precision counterpart to **`talonic_search`**. While search uses fuzzy matching for discovery, filter applies exact conditions against extracted field values. This makes it ideal for queries like 'show me all invoices from vendor X over 1000 EUR' or 'contracts expiring before 2026-12-31'.",
      },
      {
        type: "paragraph",
        text: "Multiple conditions are AND-ed together, allowing you to build precise queries that narrow results progressively. The optional `search` parameter lets you combine free-text search with structured filters in a single call, and `sort` controls the result ordering.",
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
        text: "Only fields where the search response shows `filterable: true` can be used with `talonic_filter`; entries with `filterable: false` have no extracted data yet. The `is_not_empty` operator checks materialized values, which are updated within seconds of extraction completing.",
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
      { type: "heading", level: 3, id: "filter-operators", text: "Available operators" },
      {
        type: "paragraph",
        text: "The following operators are available for filter conditions: `eq` (equals), `neq` (not equals), `gt` (greater than), `gte` (greater than or equal), `lt` (less than), `lte` (less than or equal), `between` (range, requires a two-element array as value), `contains` (substring match), `starts_with`, `ends_with`, `is_empty` (checks for null or empty values), and `is_not_empty` (checks for materialized values). Numeric operators (`gt`, `gte`, `lt`, `lte`, `between`) only resolve correctly when the schema field is typed as `number`. The next section explains how to handle that constraint.",
      },
      {
        type: "heading",
        level: 3,
        id: "filter-schema-typing",
        text: "Schema typing (preventive + reactive)",
      },
      {
        type: "paragraph",
        text: 'A numeric operator on a string-typed field that happens to hold numeric content (e.g. `"€1,500.00"`) silently returns zero matches — the comparison falls back to lexicographic ordering and almost never produces the result the user expects. There are two ways to handle this; pick the right one before constructing the call.',
      },
      {
        type: "heading",
        level: 3,
        id: "filter-preventive",
        text: "Preventive — gate on `dataType`",
      },
      {
        type: "paragraph",
        text: 'Call `talonic_search` first and read `dataType` on the field entry. If `dataType !== "number"`, do not issue a numeric operator on that field. Pick a string-friendly operator (`eq`, `contains`) or warn the user that the field needs a `data_type` change in the schema definition before the query can succeed. This avoids the silent-zero-matches outcome entirely.',
      },
      {
        type: "heading",
        level: 3,
        id: "filter-reactive",
        text: "Reactive — handle `warnings[]`",
      },
      {
        type: "paragraph",
        text: "When a numeric operator is applied to a string-typed field anyway, the API attaches a `warnings[]` array to the filter response. Each entry has `code`, `message`, `field`/`field_id`, and a `suggestion`. The MCP tool surfaces this in `structuredContent` — agents should relay the `message` (and `suggestion`, when present) to the user rather than silently retrying.",
      },
      {
        type: "code",
        language: "json",
        title: "Response with a warning",
        code: `{
  "data": [],
  "total": 0,
  "warnings": [
    {
      "code": "numeric_operator_on_string_field",
      "message": "Operator \`gt\` was applied to field \`invoice_total\` typed as string. Numeric comparisons against string-typed fields use lexicographic ordering and may return zero matches.",
      "field": "invoice_total",
      "field_id": "fld_inv_total",
      "suggestion": "Change the field's data_type to \`number\` in the schema definition."
    }
  ]
}`,
      },
      {
        type: "heading",
        level: 3,
        id: "filter-combined-example",
        text: "Example: combined search and filter",
      },
      {
        type: "code",
        language: "json",
        title: "Combining free-text search with field-value filters",
        code: `{
  "conditions": [
    { "field": "invoice.due_date", "operator": "lte", "value": "2026-06-30" },
    { "field": "invoice.total_eur", "operator": "gte", "value": 500 }
  ],
  "search": "consulting services",
  "sort": { "field": "invoice.due_date", "direction": "asc" },
  "limit": 10
}`,
      },
      {
        type: "paragraph",
        text: "Pagination is supported via the `page` and `limit` parameters. The default page size is 50 results. For large workspaces with many matching documents, iterate through pages by incrementing `page` from 1. The response includes a `total` field showing the total number of matches, so the agent can determine how many pages remain and communicate this to the user.",
      },
      {
        type: "paragraph",
        text: "When building filters dynamically from user requests, agents should validate field names against the workspace's field registry first. The most reliable way is to call `talonic_search` to discover available canonical field names and check the `filterable` flag. Attempting to filter on a field that does not exist or is not yet filterable returns a `VALIDATION_ERROR` with a descriptive message. The agent should catch this error and suggest alternative field names rather than failing silently.",
      },
    ],
    related: [
      { label: "talonic_search", slug: "talonic-search" },
      { label: "Known Limitations", slug: "known-limitations" },
      { label: "Agent Decision Guide", slug: "agent-decision-guide" },
    ],
    faq: [
      {
        question: "How do I filter documents by field value?",
        answer:
          "Use talonic_filter with canonical field names and operators like eq, gt, between, contains. The API resolves field names to IDs server-side.",
      },
      {
        question: "How do I find the correct canonical field names for filtering?",
        answer:
          "Call talonic_search first — canonical field names appear in the fields[].canonicalName array. You can also inspect previously extracted documents to see their field structure.",
      },
      {
        question: "Can I combine free-text search with field filters?",
        answer:
          "Yes. Pass the search parameter alongside conditions to combine fuzzy text matching with structured field-value filters in a single call.",
      },
      {
        question: "What operators are available for talonic_filter?",
        answer:
          "Supported operators include eq, neq, gt, gte, lt, lte, between, contains, starts_with, ends_with, and is_empty. Numeric operators (gt, gte, lt, lte, between) require the schema field to be typed as number. String operators work on all field types.",
      },
      {
        question: "Why does my filter return zero results even though matching documents exist?",
        answer:
          "The most common cause is using a numeric operator (gt, lt, between) on a field that is typed as string in the schema. Currency symbols, commas, or locale formatting in the value also cause mismatches. Ensure the schema defines numeric fields as type number and that values are stored without formatting.",
      },
    ],
    mentions: ["filter", "canonical field names", "operators", "conditions"],
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
        type: "paragraph",
        text: "**`talonic_get_document`** retrieves comprehensive information about a document that has already been ingested into your Talonic workspace. This includes the file's status, page count, size, detected document type and language, the source that uploaded it, and direct links to the document in the Talonic dashboard and API.",
      },
      {
        type: "paragraph",
        text: "This tool is useful when the agent needs to check whether a document has finished processing, verify its detected type, or retrieve the dashboard link so the user can view the original. It does not return extracted data — for that, use **`talonic_extract`** with the same `document_id`.",
      },
      {
        type: "paragraph",
        text: "The `links.dashboard` URL in the response is particularly valuable for human-in-the-loop workflows. When the agent needs the user to verify an extraction against the original document, it can present this link as a direct way to view the source in the Talonic web interface.",
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
      {
        type: "callout",
        variant: "info",
        text: "The `document_id` returned by `talonic_extract` and other tools is stable. You can call `talonic_get_document` at any time to check the document's current status and metadata.",
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
      {
        type: "heading",
        level: 3,
        id: "get-document-workflow",
        text: "Example: human-in-the-loop verification",
      },
      {
        type: "code",
        language: "json",
        title: "Agent uses dashboard link for user verification",
        code: `// After extracting data with low confidence on a critical field:
// Agent calls talonic_get_document to get the dashboard link:
{
  "document_id": "doc_8f3a1b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c"
}

// Agent presents to user:
// "The total_amount field has confidence 0.68.
//  Please verify against the original document:
//  https://app.talonic.com/documents/doc_8f3a..."`,
      },
      {
        type: "paragraph",
        text: "The `status` field in the response indicates the document's processing state. Common values are `completed` (ready for extraction and markdown retrieval), `processing` (still being ingested), and `failed` (ingestion encountered an error). Agents should check the status before attempting follow-up operations — calling `talonic_extract` on a document that is still `processing` will either wait or fail depending on the API's current behaviour.",
      },
      {
        type: "paragraph",
        text: "The `source` object in the response tells you how the document was uploaded. A `type` of `api` means it was uploaded via the MCP server or REST API, while `dashboard` means it was uploaded through the Talonic web interface. The `source.id` can be useful for filtering documents by upload source when a workspace has documents from multiple integration points.",
      },
      {
        type: "paragraph",
        text: "This tool is free to call — it does not consume extraction credits. Agents can call it as often as needed to check document status, retrieve links, or verify metadata without any cost concern. This makes it safe for polling scenarios where an agent needs to wait for a document to finish processing before proceeding with extraction.",
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
          "No. It is a free metadata lookup that does not consume extraction credits. Agents can call it as often as needed to check document status, retrieve dashboard links, or verify metadata without cost concerns.",
      },
      {
        question: "What document statuses can talonic_get_document return?",
        answer:
          "Common statuses include completed (ready for extraction), processing (still being ingested), and failed (ingestion error). Check the status before attempting follow-up operations like extraction or markdown retrieval.",
      },
    ],
    mentions: ["document", "metadata", "processing log", "dashboard link"],
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
        type: "paragraph",
        text: "**`talonic_to_markdown`** converts a document's visual content into clean, structured markdown. Tables are rendered as markdown tables, headings are preserved, and the text is ordered to match the visual layout of the original document. This is the right tool when the user wants the full text of a document for summarisation, translation, or general analysis without needing structured field extraction.",
      },
      {
        type: "paragraph",
        text: "If you have already ingested the document (via a previous `talonic_extract` or `talonic_to_markdown` call), pass the `document_id` to skip re-uploading. This is the cheapest and fastest path because the OCR has already been performed. For new documents, use `file_data` + `filename` in chat clients, `file_path` for local files, or `file_url` for remote files.",
      },
      {
        type: "paragraph",
        text: "The returned markdown is suitable for feeding into an LLM's context window for downstream tasks. Because the conversion preserves table structure and heading hierarchy, the LLM can reason about the document's content without losing structural information that raw text extraction would discard.",
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
      {
        type: "callout",
        variant: "info",
        text: "If you need both structured data and markdown, use `talonic_extract` with `include_markdown: true` instead of making two separate calls. This saves one upload and one processing cycle.",
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
      {
        type: "heading",
        level: 3,
        id: "to-markdown-url-example",
        text: "Example: convert from URL",
      },
      {
        type: "code",
        language: "json",
        title: "Tool input: convert a remote PDF to markdown",
        code: `{
  "file_url": "https://example.com/annual-report-2025.pdf"
}`,
      },
      {
        type: "code",
        language: "markdown",
        title: "Tool response: structured markdown output",
        code: `# Annual Report 2025

## Financial Highlights

| Metric              | 2025       | 2024       | Change  |
|---------------------|------------|------------|---------|
| Revenue             | €12.4M     | €9.8M      | +26.5%  |
| Net Income          | €2.1M      | €1.4M      | +50.0%  |
| Employees           | 142        | 98         | +44.9%  |

## Board of Directors

- **Chair**: Dr. Maria Fischer
- **CEO**: Thomas Bergmann
- **CFO**: Sarah Lindqvist`,
      },
      {
        type: "paragraph",
        text: "The markdown output is designed to be LLM-friendly. Agents can feed the returned markdown directly into their context window for summarisation, translation, comparison, or question-answering tasks. Because the conversion preserves semantic structure (headings denote sections, tables retain rows and columns, lists maintain hierarchy), downstream LLM reasoning is significantly more accurate than working with raw OCR text that has lost all formatting cues.",
      },
      {
        type: "paragraph",
        text: "For multi-page documents, the markdown includes page break indicators and preserves the reading order across pages. Headers, footers, and page numbers are typically stripped or de-duplicated to produce a clean reading experience. If the document contains images with embedded text (like scanned letterheads or stamps), the OCR engine extracts visible text from those regions as well, though image-only content without text is omitted from the markdown output.",
      },
      {
        type: "paragraph",
        text: "When an agent needs to compare two versions of a document, `talonic_to_markdown` is the right starting point. Convert both documents to markdown, then use standard text diffing within the agent's context to identify changes. This is more reliable than visual comparison because the markdown normalises formatting differences and focuses on content. The stable document IDs make it easy to retrieve markdown for previously processed documents without re-uploading.",
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
      {
        question: "Does talonic_to_markdown preserve table structure?",
        answer:
          "Yes. Tables are rendered as markdown tables with proper column alignment. Headings and text ordering are also preserved to match the original document layout.",
      },
      {
        question: "Should I use talonic_to_markdown or talonic_extract with include_markdown?",
        answer:
          "If you only need the text, use talonic_to_markdown. If you need both structured fields and the full text, use talonic_extract with include_markdown: true to avoid two separate calls.",
      },
      {
        question: "Can I use talonic_to_markdown for document comparison?",
        answer:
          "Yes. Convert both document versions to markdown, then diff the text in the agent's context. Markdown normalises formatting differences and focuses on content, making comparison more reliable than visual methods. Use document_id for previously processed files to avoid re-uploading.",
      },
      {
        question: "Does talonic_to_markdown handle scanned documents?",
        answer:
          "Yes. The tool runs OCR on scanned PDFs, images (PNG, JPG, TIFF), and other image-based documents. Text is extracted from all visible regions including headers, stamps, and handwritten annotations where legible. The output is clean markdown regardless of whether the source is digital or scanned.",
      },
    ],
    mentions: ["markdown", "OCR", "document_id", "tables"],
  },
  {
    slug: "talonic-list-schemas",
    parentSlug: "tools",
    title: "talonic_list_schemas",
    seoTitle: "talonic_list_schemas Tool — Talonic MCP",
    description: "List all saved schemas in the workspace as compact summaries.",
    content: [
      {
        type: "paragraph",
        text: "List all saved schemas as compact summaries. Returns schema IDs (both UUID and `SCH-XXXXXXXX` short format), names, descriptions, version, and field counts.",
      },
      {
        type: "paragraph",
        text: "The full per-field JSON Schema definition is intentionally omitted from the list — across many schemas that payload is large and can get truncated by some clients. To inspect a schema's full field definitions, read the `talonic://schemas` resource, which clients that browse resources separately (Claude Desktop and Cowork) also render in the UI.",
      },
      {
        type: "paragraph",
        text: "**`talonic_list_schemas`** is a read-only tool that returns every saved schema in your workspace as a summary. Agents should call this before creating a new schema to avoid duplicates, and when the user asks about their available extraction templates. To read the full field structure of a specific schema, use the `talonic://schemas` resource.",
      },
      {
        type: "paragraph",
        text: "Each schema in the response includes both a UUID (`id`) and a human-friendly short ID (`short_id` in `SCH-XXXXXXXX` format). Either can be passed as `schema_id` to `talonic_extract`. The short ID is easier for users to reference in conversation, while the UUID is useful for programmatic workflows.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Call `talonic_list_schemas` before `talonic_save_schema` to check if a similar schema already exists. This prevents cluttering the workspace with near-duplicate schemas.",
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
      {
        type: "heading",
        level: 3,
        id: "list-schemas-workflow",
        text: "Example: check for duplicates before saving",
      },
      {
        type: "code",
        language: "json",
        title: "Agent checks existing schemas before creating a new one",
        code: `// User: "Create a schema for purchase orders"
// Agent first checks existing schemas:
// talonic_list_schemas → {}

// Response shows existing schemas:
{
  "schemas": [
    {
      "id": "sch_7a1b...",
      "short_id": "SCH-A1B2C3D4",
      "name": "Standard Invoice",
      "field_count": 6
    },
    {
      "id": "sch_c3d4...",
      "short_id": "SCH-C3D4E5F6",
      "name": "Purchase Order",
      "field_count": 7
    }
  ]
}

// Agent: "You already have a 'Purchase Order' schema (SCH-C3D4E5F6)
//  with 7 fields. Would you like to use it, or create a new one?"`,
      },
      {
        type: "paragraph",
        text: "Agents should call `talonic_list_schemas` proactively in several scenarios: before saving a new schema (to prevent duplicates), when the user asks about available extraction templates, and when starting a session that involves document extraction (to present schema options). The call is free and returns quickly, so there is no cost or latency penalty for checking frequently.",
      },
      {
        type: "paragraph",
        text: "The `version` field on each schema tracks how many times it has been updated through the Talonic dashboard. A schema at version 1 has never been modified since creation. Higher versions indicate the schema has been refined — potentially adding new fields, changing types, or updating required fields. Agents can use this information to inform the user about schema maturity when choosing between multiple similar schemas.",
      },
      {
        type: "paragraph",
        text: "The `field_count` in the response is a quick indicator of schema complexity without needing to parse the full definition. Schemas with fewer fields are faster to extract and produce more focused results. Schemas with many fields (10+) cover more ground but may have lower per-field confidence on complex documents. Agents can use field count to help users choose between a detailed schema and a simpler one for quick extractions.",
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
          "Yes. It is a read-only metadata call that does not consume extraction credits. Agents can call it as often as needed to check for existing schemas, present options to the user, or verify a schema exists before using it in an extraction.",
      },
      {
        question: "How do I know which schema to use for a document?",
        answer:
          "Call talonic_list_schemas to see all available schemas with their names, descriptions, and field counts. Match the schema name and description to the document type. For example, use a 'Standard Invoice' schema for invoices and a 'Certificate of Insurance' schema for COIs. When unsure, start with an inline schema and save it after confirming the results.",
      },
    ],
    mentions: ["schemas", "list", "SCH-XXXXXXXX", "resource"],
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
        type: "paragraph",
        text: "**`talonic_save_schema`** persists an extraction template so it can be referenced by ID in future `talonic_extract` calls. This is useful when the same schema will be applied to many documents — for example, a standard invoice schema used across all vendor invoices, or a contract schema applied to every new agreement.",
      },
      {
        type: "paragraph",
        text: "The recommended workflow is to iterate on the schema inline first (passing it directly to `talonic_extract`), verify the extraction results with the user, and only call `talonic_save_schema` once the schema design is confirmed. This avoids cluttering the workspace with draft schemas that never get used.",
      },
      {
        type: "paragraph",
        text: "The response returns both a UUID (`id`) and a short ID (`short_id` in `SCH-XXXXXXXX` format). Either can be used as `schema_id` in subsequent `talonic_extract` calls. The `version` field starts at 1 and increments if the schema is updated through the Talonic dashboard.",
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
      {
        type: "heading",
        level: 3,
        id: "save-schema-workflow",
        text: "Example: iterate inline then save",
      },
      {
        type: "code",
        language: "json",
        title: "Step 1: test the schema inline with talonic_extract",
        code: `// Agent extracts with inline schema first:
{
  "file_url": "https://example.com/sample-po.pdf",
  "schema": {
    "type": "object",
    "properties": {
      "po_number": { "type": "string" },
      "vendor": { "type": "string" },
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "description": { "type": "string" },
            "quantity": { "type": "integer" },
            "unit_price": { "type": "number" }
          }
        }
      },
      "total": { "type": "number" },
      "delivery_date": { "type": "string", "format": "date" }
    },
    "required": ["po_number", "vendor", "total"]
  }
}
// → User reviews results, confirms the schema looks right`,
      },
      {
        type: "code",
        language: "json",
        title: "Step 2: save the confirmed schema for reuse",
        code: `// Agent calls talonic_save_schema:
{
  "name": "Purchase Order",
  "description": "Extracts PO number, vendor, line items, total, and delivery date.",
  "definition": {
    "type": "object",
    "properties": {
      "po_number": { "type": "string" },
      "vendor": { "type": "string" },
      "items": { "type": "array" },
      "total": { "type": "number" },
      "delivery_date": { "type": "string", "format": "date" }
    },
    "required": ["po_number", "vendor", "total"]
  }
}

// Response:
{
  "id": "sch_d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a",
  "short_id": "SCH-D4E5F6A7",
  "name": "Purchase Order",
  "version": 1,
  "field_count": 5
}
// → Future extractions use: { "schema_id": "SCH-D4E5F6A7" }`,
      },
      {
        type: "paragraph",
        text: "The `description` field is optional but strongly recommended. A clear description helps agents (and users) understand when to use a particular schema. Agents can read schema descriptions from `talonic_list_schemas` to auto-select the right schema based on the document type. For example, if the user drops a purchase order, the agent can scan saved schema descriptions for keywords like 'purchase order' or 'PO' and suggest the matching schema automatically.",
      },
      {
        type: "paragraph",
        text: "Schema naming conventions matter for discoverability. Use descriptive, consistent names like 'Standard Invoice', 'Certificate of Insurance', or 'Employment Contract' rather than abbreviations or internal codes. These names appear in `talonic_list_schemas` results and the `talonic://schemas` resource, where users and agents browse them to find the right template. A well-named schema library reduces friction across the entire team.",
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
          "Yes. The description helps agents auto-select the right schema based on document type, and helps team members understand what each schema extracts. Use clear language like 'Extracts vendor, line items, totals, and payment terms from invoices' so both humans and AI agents can match schemas to documents.",
      },
    ],
    mentions: ["save schema", "JSON Schema", "reuse", "version"],
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
      {
        type: "heading",
        level: 3,
        id: "balance-budget-check",
        text: "Example: budget check before batch extraction",
      },
      {
        type: "code",
        language: "json",
        title: "Agent checks balance before processing 50 documents",
        code: `// User: "Extract data from all 50 invoices in my workspace"
// Agent first checks budget:
// talonic_get_balance → {}

// Response:
{
  "balance_credits": 120,
  "balance_eur": 0.60,
  "burn_rate_30d_credits": 360,
  "projected_runway_days": 10,
  "tier": "free",
  "tier_resets_at": "2026-06-01T00:00:00.000Z"
}

// Agent: "You have 120 credits remaining. Extracting 50 documents
//  will cost approximately 50 credits, leaving 70 credits.
//  Your tier resets on June 1st. Shall I proceed?"`,
      },
      {
        type: "paragraph",
        text: "Budget-aware agents use `talonic_get_balance` to prevent unexpected credit depletion. Before starting a large batch extraction, the agent checks the remaining balance and estimates whether the batch will exceed available credits. If the balance is low, the agent can warn the user, suggest processing a subset, or recommend upgrading the plan. This proactive approach prevents mid-batch failures due to exhausted credits.",
      },
      {
        type: "paragraph",
        text: "The `tier` field indicates the workspace's API plan: `free`, `pro`, or `enterprise`. Each tier has different daily extraction limits and credit allowances. The `tier_resets_at` timestamp shows when the monthly credit cycle resets, which helps agents answer questions like 'when will my credits refresh?' or 'should I wait for the reset before processing this batch?'. Agents can use this information to advise users on timing large extraction jobs.",
      },
      {
        type: "paragraph",
        text: "The `burn_rate_30d_credits` field shows total consumption over the trailing 30 days, not a daily average. Agents can divide by 30 to estimate daily usage. Combined with `balance_credits`, this provides a clear picture of workspace sustainability. A high burn rate with a low balance signals the need for a plan upgrade or reduced usage before the next tier reset.",
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
      {
        question: "Should the agent check balance before every extraction?",
        answer:
          "Not for single extractions — that would add unnecessary latency. Check the balance before batch operations (10+ documents) or when the user explicitly asks about credits. For single extractions, proceed directly and let the API return a quota error if the balance is exhausted.",
      },
      {
        question: "How does the agent know the cost of an extraction?",
        answer:
          "Each talonic_extract response includes a cost field showing credits consumed for that extraction. Use talonic_get_balance before a batch to check available credits, and after to verify the remaining balance. Single extractions typically cost 1 credit each.",
      },
    ],
    mentions: ["credits", "balance", "EUR", "burn rate", "runway", "tier", "budget"],
  },
  {
    slug: "talonic-get-pricing",
    parentSlug: "tools",
    title: "talonic_get_pricing",
    seoTitle: "talonic_get_pricing Tool — Talonic MCP",
    description:
      "MCP tool that returns the machine-readable Talonic credit pricing catalog: fixed per-unit credit rates, EUR equivalents, the credits-per-EUR conversion, and processing-mode multipliers, so an agent can predict spend before running anything.",
    content: [
      {
        type: "paragraph",
        text: "Returns the credit pricing catalog: fixed per-unit credit rates, their EUR equivalents, the credits-per-EUR conversion rate, and processing-mode multipliers (such as batch at 0.5x). Because the rates are fixed rather than token-based, an agent can read them and compute the exact cost of a planned job before spending a credit. The endpoint is public, so it works even before an API key is provisioned.",
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
          "Estimating the cost of a planned extraction, structuring, or matching job before running it.",
          "Answering a user question about how much Talonic costs per page or per operation.",
          "Deciding whether a workload fits a budget, especially before signing up.",
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
          "For the workspace's remaining credit balance: use `talonic_get_balance`.",
          "For what the workspace has already spent and on what: use `talonic_get_usage`.",
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
          "`currency`: billing currency for the EUR equivalents (always `EUR`).",
          "`credits_per_eur`: conversion rate between credits and EUR (1,000 credits = 1 EUR at the standard rate).",
          "`multipliers`: processing-mode multipliers keyed by mode (e.g. `realtime: 1`, `batch: 0.5`).",
          "`units`: array of catalog lines, each with `unit`, `label`, `credits`, `eur`, and `free`.",
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
  "currency": "EUR",
  "credits_per_eur": 1000,
  "multipliers": { "realtime": 1, "batch": 0.5 },
  "units": [
    { "unit": "page_ingest", "label": "Document page ingestion", "credits": 100, "eur": 0.1, "free": false },
    { "unit": "structuring_cell", "label": "Structuring cell (LLM-reasoned)", "credits": 20, "eur": 0.02, "free": false },
    { "unit": "registry_resolved_cell", "label": "Structuring cell (Field Registry resolved)", "credits": 0, "eur": 0, "free": true },
    { "unit": "intelligence_op", "label": "Intelligence operation (matching, cases, reconciliation)", "credits": 100, "eur": 0.1, "free": false },
    { "unit": "delivery", "label": "Delivery (webhook / export)", "credits": 0, "eur": 0, "free": true },
    { "unit": "validation", "label": "Validation / quality check", "credits": 0, "eur": 0, "free": true }
  ]
}`,
      },
      {
        type: "heading",
        level: 3,
        id: "pricing-estimate-example",
        text: "Example: quote a workload before running it",
      },
      {
        type: "code",
        language: "json",
        title: "Agent estimates the cost of a 20-page batch extraction",
        code: `// User: "How much will it cost to extract this 20-page contract in batch mode?"
// Agent reads pricing:
// talonic_get_pricing → {}

// page_ingest = 100 credits, batch multiplier = 0.5
// 20 pages * 100 credits * 0.5 = 1000 credits = 1.00 EUR

// Agent: "Extracting 20 pages in batch mode costs about 1,000 credits
//  (1.00 EUR). Realtime would be 2,000 credits (2.00 EUR). Proceed in batch?"`,
      },
      {
        type: "paragraph",
        text: "Cost-aware agents call `talonic_get_pricing` to turn a workload into a concrete quote before committing to it. Multiply the relevant per-unit rate by the expected unit count, then apply the processing-mode multiplier. Because the catalog also returns the credits-per-EUR rate, the agent can present the estimate in either credits or euros without hardcoding any number.",
      },
      {
        type: "paragraph",
        text: "The catalog distinguishes billable units from free ones. Document page ingestion, structuring cells filled by fresh model reasoning, and intelligence operations carry a cost; Field Registry resolved cells, delivery, and validation are free. A document whose fields are answered entirely from the Field Registry therefore incurs only its page-ingestion cost, which an agent can surface as a reason to reuse schemas across similar documents.",
      },
    ],
    related: [
      { label: "talonic_get_usage", slug: "talonic-get-usage" },
      { label: "talonic_get_balance", slug: "talonic-get-balance" },
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
          "Multiply the per-unit credits by the number of units (pages, cells, or operations), then apply the processing-mode multiplier (1 for realtime, 0.5 for batch). Divide by credits_per_eur to express the result in euros.",
      },
      {
        question: "Which operations are free in the catalog?",
        answer:
          "Field Registry resolved cells, delivery, and validation cost zero credits. Only fresh ingestion, fresh model-reasoned structuring cells, and intelligence operations (matching, cases, reconciliation) are billable.",
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
  {
    slug: "talonic-get-usage",
    parentSlug: "tools",
    title: "talonic_get_usage",
    seoTitle: "talonic_get_usage Tool — Talonic MCP",
    description:
      "MCP tool that returns per-function credit consumption for the workspace over a trailing window, so an agent can see where credits went across extraction, structuring, and intelligence operations.",
    content: [
      {
        type: "paragraph",
        text: "Returns the workspace's credit consumption grouped by platform function over a trailing window, plus the total. Where `talonic_get_balance` reports what is left, this tool reports where the credits went: how much each function (page ingestion, structuring cells, intelligence operations) cost over the period. The breakdown is ordered by spend, highest first, so the dominant cost driver is the first row.",
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
          "The user asks what they have spent credits on, or which function dominates their spend.",
          "Reviewing burn by function to decide whether to shift work to batch mode or trim an operation.",
          "Producing a spend report for the last N days.",
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
          "For the remaining balance and runway: use `talonic_get_balance`.",
          "For per-unit rates before running a job: use `talonic_get_pricing`.",
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "arguments",
        text: "Arguments",
      },
      {
        type: "list",
        items: [
          "`days` (optional): trailing reporting window in days. Default 30, clamped between 1 and 365.",
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
          "`period_days`: length of the reporting window in days.",
          "`total_credits`: total credits consumed across all functions in the window.",
          "`by_function`: array of `{ operation_type, operations, credits }`, highest spend first.",
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Tool input",
        code: `{ "days": 30 }`,
      },
      {
        type: "code",
        language: "json",
        title: "Tool response",
        code: `{
  "period_days": 30,
  "total_credits": 48200,
  "by_function": [
    { "operation_type": "page_ingest", "operations": 412, "credits": 41200 },
    { "operation_type": "structuring_cell", "operations": 300, "credits": 6000 },
    { "operation_type": "intelligence_op", "operations": 10, "credits": 1000 }
  ]
}`,
      },
      {
        type: "paragraph",
        text: "Agents use `talonic_get_usage` to attribute spend to the functions that caused it. Pairing it with `talonic_get_balance` gives a full picture: balance shows how much is left, usage shows what consumed it, and pricing shows the rate of each function. An agent noticing that page ingestion dominates spend might suggest batch mode for the 0.5x discount, or reusing schemas so more cells resolve from the Field Registry for free.",
      },
      {
        type: "paragraph",
        text: "The figures read from the credit transaction ledger, so they reconcile exactly with the balance and history reported elsewhere. The `operation_type` values match the unit identifiers in the pricing catalog, which lets an agent join usage to rates and explain not just how many credits a function consumed but why. To express any figure in euros, divide by the credits-per-EUR rate from the pricing catalog.",
      },
    ],
    related: [
      { label: "talonic_get_pricing", slug: "talonic-get-pricing" },
      { label: "talonic_get_balance", slug: "talonic-get-balance" },
    ],
    faq: [
      {
        question: "How is talonic_get_usage different from talonic_get_balance?",
        answer:
          "Balance reports what is left (and runway); usage reports what was spent, grouped by function. Use balance to check headroom and usage to attribute spend to extraction, structuring, or intelligence operations.",
      },
      {
        question: "What window does talonic_get_usage cover?",
        answer:
          "The last 30 days by default. Pass days to change it, anywhere from 1 to 365. The response echoes period_days so the agent can confirm the window it summarized.",
      },
      {
        question: "Why is the breakdown empty?",
        answer:
          "Per-function rows populate as billable operations are charged. While metering runs in shadow mode the ledger records what each operation would cost without deducting, so the breakdown can be empty until enforcement is enabled. Pricing still returns the rates in the meantime.",
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
  {
    slug: "talonic-request-upload",
    parentSlug: "tools",
    title: "talonic_request_upload",
    seoTitle: "talonic_request_upload Tool — Talonic MCP",
    description:
      "Request a browser-handoff upload link for files that can't be delivered via tool-call arguments. Returns a pre-allocated document_id, an upload URL, and an expiry timestamp.",
    content: [
      {
        type: "paragraph",
        text: "Request a one-time upload link for a file the agent cannot deliver directly. Returns a pre-allocated `document_id`, a browser-openable `upload_url` the user drops the file into, and an `expires_at` timestamp.",
      },
      {
        type: "paragraph",
        text: "**`talonic_request_upload`** exists to route around the **~32 KB tool-call argument cap** in hosted-connector environments like Claude.ai's web UI. Above that ceiling, `file_data` on `talonic_extract` is silently truncated and the extraction returns null fields. The browser-handoff flow sidesteps the cap entirely: the user opens the upload URL in a separate tab, drops the file, and the agent then references the resulting document by ID.",
      },
      {
        type: "paragraph",
        text: "Local-stdio installs (Claude Desktop, Cursor, Cline, Continue, Cowork) do not have this cap and should keep using `file_data` for small-to-medium files. This tool is for the hosted connector path or any sandboxed environment where you can't reliably stream the file through the tool call.",
      },
      { type: "heading", level: 3, id: "request-upload-use-when", text: "When to use" },
      {
        type: "list",
        items: [
          "The user has a file to extract and you are running in a hosted-connector environment (Claude.ai, ChatGPT) where `file_data` is not reliable.",
          "The file is larger than ~32 KB (typical for real invoices, contracts, COIs).",
          "The user explicitly asks for an upload link.",
        ],
      },
      { type: "heading", level: 3, id: "request-upload-do-not-use", text: "When not to use" },
      {
        type: "list",
        items: [
          "You can deliver the file directly via `file_data` (local-stdio installs with small files).",
          "The file is already accessible via a public URL — use `file_url` on `talonic_extract` instead.",
          "The document is already in the workspace — use `document_id` on `talonic_extract` instead.",
        ],
      },
      {
        type: "param-table",
        params: [
          {
            name: "filename",
            type: "string",
            required: true,
            description:
              "Filename with extension (e.g. `invoice.pdf`). Used to pre-allocate the document record and infer MIME type.",
          },
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Tool input",
        code: `{
  "filename": "invoice-2026-001.pdf"
}`,
      },
      {
        type: "code",
        language: "json",
        title: "Tool response",
        code: `{
  "document_id": "doc_8f3a2b9c-1d4e-5f6a-7b8c-9d0e1f2a3b4c",
  "upload_url": "https://app.talonic.com/u/069b8d9a-b05d-41df-8047-129af7c7aad5",
  "expires_at": "2026-05-28T20:35:00.000Z"
}`,
      },
      {
        type: "heading",
        level: 3,
        id: "request-upload-workflow",
        text: "End-to-end workflow",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Call `talonic_request_upload` with the filename. Capture `document_id`, `upload_url`, and `expires_at` from the response.",
          "Show the `upload_url` to the user and ask them to open it in a new browser tab and drop the file.",
          'Poll `talonic_get_document` with the `document_id` until `status` is `completed`. **Do not skip this step** — a user confirmation like "uploaded" only signals that the browser-side upload finished, not that server-side OCR and processing are done.',
          'Once `status === "completed"`, call `talonic_extract` with the `document_id` and a `schema` or `schema_id` to pull out structured fields.',
        ],
      },
      {
        type: "callout",
        variant: "warning",
        text: 'Server-side processing (OCR + classification) typically takes 10–30 seconds after the browser upload completes. The agent must poll `talonic_get_document` until `status === "completed"` before calling `talonic_extract`. Calling extract too early returns errors that look like the file is missing.',
      },
      {
        type: "code",
        language: "json",
        title: "Full sequence for a Claude.ai hosted-connector chat",
        code: `// 1. Agent requests an upload link.
// talonic_request_upload({ filename: "rental-agreement.pdf" })
{
  "document_id": "doc_1a2b3c4d-...",
  "upload_url": "https://app.talonic.com/u/069b8d9a-...",
  "expires_at": "2026-05-28T20:35:00.000Z"
}

// 2. Agent: "Open this link in a new tab and drop your file:
//            https://app.talonic.com/u/069b8d9a-...
//            I'll let you know once Talonic is done processing."

// 3. After user drops the file, agent polls:
// talonic_get_document({ document_id: "doc_1a2b3c4d-..." })
// → status: "processing"  → wait ~10s, poll again
// → status: "completed"   → ready to extract

// 4. Agent extracts:
// talonic_extract({
//   document_id: "doc_1a2b3c4d-...",
//   schema_id: "SCH-RENTAL01"
// })
// → structured JSON with per-field confidence scores`,
      },
      {
        type: "paragraph",
        text: "The pre-allocated `document_id` is a real Talonic document from the moment the upload link is minted, but it stays in `pending` status until the user actually uploads. If the user closes the tab or the link expires (`expires_at`) without uploading, the document remains in `pending` and can be cleaned up via the dashboard. Re-issuing a fresh upload link for the same file is safe: the new link creates a new `document_id` with no link to the abandoned one.",
      },
      {
        type: "paragraph",
        text: "Agents should treat the `upload_url` as user-only information and never attempt to PUT to it themselves from the sandbox. Most sandboxed environments (Claude.ai's web tools, ChatGPT's Code Interpreter) cannot reach arbitrary S3-like endpoints, and even when they can, asking the user to open the link in their own browser preserves the user-agent boundary and avoids surprising the user with a backend upload they did not consent to.",
      },
    ],
    related: [
      { label: "talonic_extract", slug: "talonic-extract" },
      { label: "talonic_get_document", slug: "talonic-get-document" },
      { label: "Drag & Drop Files", slug: "drag-and-drop" },
      { label: "Known Limitations", slug: "known-limitations" },
    ],
    faq: [
      {
        question: "When should the agent use `talonic_request_upload` instead of `file_data`?",
        answer:
          "In hosted-connector environments (Claude.ai web, ChatGPT) where tool-call arguments are capped around ~32 KB decoded payload. Real-world documents (100 KB+) get silently truncated when sent via file_data. Local-stdio installs (Claude Desktop, Cursor, Cline, Continue, Cowork) have no such cap and can keep using file_data.",
      },
      {
        question: "Does a user message like 'uploaded' mean the file is ready to extract?",
        answer:
          "No. That confirms only the browser-side upload finished. Server-side OCR and extraction typically need another 10–30 seconds. The agent must poll talonic_get_document until status is 'completed' before calling talonic_extract; calling earlier may return errors that look like the file is missing.",
      },
      {
        question: "What happens if the user never opens the upload link?",
        answer:
          "The pre-allocated document_id remains in pending status. The expires_at timestamp indicates when the upload URL stops accepting writes — typically a short window (minutes). Past that, request a fresh link with talonic_request_upload again; the new call mints a new document_id and a new URL.",
      },
      {
        question: "Can the agent PUT the file to the upload_url itself?",
        answer:
          "It usually cannot — Claude.ai's sandbox and similar hosted environments restrict outbound egress to arbitrary endpoints. Even where it would technically work, you should still hand the link to the user: it preserves the user-agent boundary (the user controls what file gets uploaded) and matches what every other browser-handoff flow looks like.",
      },
      {
        question: "Why a separate tool instead of changing `talonic_extract`?",
        answer:
          "Keeping the upload-link step explicit makes the agent's reasoning visible to the user (the user sees an upload link in chat and knows what's happening). Folding it into talonic_extract would either silently change the contract for small files or introduce a hidden mode switch — both bad for predictability.",
      },
    ],
    mentions: [
      "upload",
      "browser-handoff",
      "presigned URL",
      "document_id",
      "Claude.ai",
      "32 KB cap",
    ],
  },
]
