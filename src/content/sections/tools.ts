import type { RawSection } from '../types';

export const sections: RawSection[] = [
  {
    slug: 'talonic-extract',
    parentSlug: 'tools',
    title: 'talonic_extract',
    seoTitle: 'talonic_extract Tool — Talonic MCP',
    description: 'Extract structured, schema-validated data from a document. Returns clean JSON with per-field confidence scores.',
    content: [
      { type: 'paragraph', text: 'Extract structured, schema-validated data from a document.' },
      { type: 'paragraph', text: 'Inputs: one of `file_data` + `filename` (recommended for chat clients), `file_path`, `file_url`, or `document_id`, plus a `schema` (or `schema_id`). Returns clean JSON with per-field confidence scores.' },
      { type: 'param-table', params: [
        { name: 'file_data', type: 'string', description: 'Base64-encoded file bytes. Recommended for chat clients (drag-and-drop).' },
        { name: 'filename', type: 'string', description: 'Original filename (used for MIME type inference when using `file_data`).' },
        { name: 'file_path', type: 'string', description: 'Local file path.' },
        { name: 'file_url', type: 'string', description: 'Remote file URL.' },
        { name: 'document_id', type: 'string', description: 'ID of a previously uploaded document.' },
        { name: 'schema', type: 'object', description: 'Inline schema definition (JSON Schema).' },
        { name: 'schema_id', type: 'string', description: 'UUID of a saved schema.' },
      ]},
      { type: 'callout', variant: 'warning', text: 'Always provide a `schema` or `schema_id`. Auto-discovery extract (no schema) is not reliable in v0.1.' },
    ],
    related: [
      { label: 'talonic_to_markdown', slug: 'talonic-to-markdown' },
      { label: 'talonic_save_schema', slug: 'talonic-save-schema' },
      { label: 'Drag & Drop Files', slug: 'drag-and-drop' },
    ],
    faq: [
      { question: 'How does talonic_extract work?', answer: 'Send a document (file_data, file_path, file_url, or document_id) with a schema or schema_id. The tool returns schema-validated JSON with per-field confidence scores.' },
    ],
    mentions: ['extract', 'schema', 'confidence scores', 'file_data'],
  },
  {
    slug: 'talonic-search',
    parentSlug: 'tools',
    title: 'talonic_search',
    seoTitle: 'talonic_search Tool — Talonic MCP',
    description: 'Omnisearch across documents, fields, sources, and schemas in the workspace. Supports conceptual and fuzzy queries.',
    content: [
      { type: 'paragraph', text: 'Omnisearch across documents, fields, sources, and schemas in the workspace. Use for conceptual or fuzzy queries.' },
      { type: 'param-table', params: [
        { name: 'query', type: 'string', required: true, description: 'The search query. Supports fuzzy and conceptual matching.' },
      ]},
    ],
    related: [
      { label: 'talonic_filter', slug: 'talonic-filter' },
    ],
    faq: [
      { question: 'What does talonic_search do?', answer: 'It searches across documents, fields, sources, and schemas in the workspace using fuzzy and conceptual matching.' },
    ],
    mentions: ['search', 'omnisearch', 'fuzzy'],
  },
  {
    slug: 'talonic-filter',
    parentSlug: 'tools',
    title: 'talonic_filter',
    seoTitle: 'talonic_filter Tool — Talonic MCP',
    description: 'Filter documents by extracted field values using composable conditions like eq, gt, between, and contains.',
    content: [
      { type: 'paragraph', text: 'Filter documents by extracted field values using composable conditions (`eq`, `gt`, `between`, `contains`, etc.).' },
      { type: 'paragraph', text: 'Accepts canonical field names (e.g. `vendor.name`, `policy.0_coverage_type`) which the Talonic API resolves to IDs server-side, or UUIDs directly.' },
      { type: 'callout', variant: 'warning', text: 'The `is_not_empty` operator currently underreports. Use specific operators (`eq`, `gt`, `contains`, etc.) against known values when possible.' },
    ],
    related: [
      { label: 'talonic_search', slug: 'talonic-search' },
      { label: 'Known Limitations', slug: 'known-limitations' },
    ],
    faq: [
      { question: 'How do I filter documents by field value?', answer: 'Use talonic_filter with canonical field names and operators like eq, gt, between, contains. The API resolves field names to IDs server-side.' },
    ],
    mentions: ['filter', 'canonical field names', 'operators'],
  },
  {
    slug: 'talonic-get-document',
    parentSlug: 'tools',
    title: 'talonic_get_document',
    seoTitle: 'talonic_get_document Tool — Talonic MCP',
    description: 'Fetch full metadata for a single document by ID, including processing log and link URLs.',
    content: [
      { type: 'paragraph', text: 'Fetch full metadata for a single document by ID, including processing log and link URLs.' },
      { type: 'param-table', params: [
        { name: 'document_id', type: 'string', required: true, description: 'The document UUID.' },
      ]},
    ],
    related: [
      { label: 'talonic_to_markdown', slug: 'talonic-to-markdown' },
      { label: 'talonic_extract', slug: 'talonic-extract' },
    ],
    faq: [
      { question: 'How do I get document metadata via MCP?', answer: 'Call talonic_get_document with the document UUID to get full metadata including processing log and link URLs.' },
    ],
    mentions: ['document', 'metadata', 'processing log'],
  },
  {
    slug: 'talonic-to-markdown',
    parentSlug: 'tools',
    title: 'talonic_to_markdown',
    seoTitle: 'talonic_to_markdown Tool — Talonic MCP',
    description: 'Get OCR-converted markdown for a document. Accepts document_id, file_data + filename, file_path, or file_url.',
    content: [
      { type: 'paragraph', text: 'Get OCR-converted markdown for a document. Accepts `document_id` (cheapest — no re-upload), `file_data` + `filename`, `file_path`, or `file_url`.' },
    ],
    related: [
      { label: 'talonic_extract', slug: 'talonic-extract' },
      { label: 'Drag & Drop Files', slug: 'drag-and-drop' },
    ],
    faq: [
      { question: 'How do I get markdown from a document via MCP?', answer: 'Call talonic_to_markdown with a document_id (cheapest), or provide the file directly via file_data, file_path, or file_url.' },
    ],
    mentions: ['markdown', 'OCR', 'document_id'],
  },
  {
    slug: 'talonic-list-schemas',
    parentSlug: 'tools',
    title: 'talonic_list_schemas',
    seoTitle: 'talonic_list_schemas Tool — Talonic MCP',
    description: 'List all saved schemas with their definitions in the workspace.',
    content: [
      { type: 'paragraph', text: 'List all saved schemas with their definitions. Returns schema IDs (both UUID and `SCH-XXXXXXXX` short format), names, and field definitions.' },
      { type: 'paragraph', text: 'The `talonic://schemas` resource exposes the same data to clients that browse resources separately (Claude Desktop and Cowork render these in the UI).' },
    ],
    related: [
      { label: 'talonic_save_schema', slug: 'talonic-save-schema' },
      { label: 'talonic_extract', slug: 'talonic-extract' },
    ],
    faq: [
      { question: 'How do I list schemas via MCP?', answer: 'Call talonic_list_schemas to get all saved schemas with their definitions. The talonic://schemas resource also exposes this data.' },
    ],
    mentions: ['schemas', 'list', 'SCH-XXXXXXXX'],
  },
  {
    slug: 'talonic-save-schema',
    parentSlug: 'tools',
    title: 'talonic_save_schema',
    seoTitle: 'talonic_save_schema Tool — Talonic MCP',
    description: 'Save a schema definition to the workspace for reuse across extractions.',
    content: [
      { type: 'paragraph', text: 'Save a schema definition to the workspace for reuse. Returns a `schema_id` that can be passed to `talonic_extract`.' },
      { type: 'callout', text: 'Prefer full JSON Schema format with `type: "object"` and `properties`. The flat key-type map format is not fully supported server-side yet.' },
    ],
    related: [
      { label: 'talonic_list_schemas', slug: 'talonic-list-schemas' },
      { label: 'talonic_extract', slug: 'talonic-extract' },
    ],
    faq: [
      { question: 'How do I save a schema via MCP?', answer: 'Call talonic_save_schema with a name and JSON Schema definition. It returns a schema_id for reuse in talonic_extract calls.' },
    ],
    mentions: ['save schema', 'JSON Schema', 'reuse'],
  },
];
