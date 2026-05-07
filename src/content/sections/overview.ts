import type { RawSection } from "../types"

export const sections: RawSection[] = [
  {
    slug: "mcp-introduction",
    parentSlug: "overview",
    title: "Introduction",
    seoTitle: "MCP Server Introduction — Talonic Docs",
    description:
      "Official Talonic MCP server. Lets AI agents extract structured, schema-validated data from any document via the Model Context Protocol.",
    content: [
      {
        type: "paragraph",
        text: "Official Talonic MCP server. Lets AI agents extract structured, schema-validated data from any document via the [Model Context Protocol](https://modelcontextprotocol.io).",
      },
      {
        type: "paragraph",
        text: "Eight tools and two resources: `talonic_extract`, `talonic_search`, `talonic_filter`, `talonic_get_document`, `talonic_to_markdown`, `talonic_list_schemas`, `talonic_save_schema`, `talonic_get_balance`, plus the `talonic://schemas` and `talonic://webhooks/reference` resources.",
      },
      {
        type: "paragraph",
        text: "Listed on the [official MCP Registry](https://registry.modelcontextprotocol.io/) as `io.github.talonicdev/talonic-mcp`. Verified end-to-end against production.",
      },
      {
        type: "paragraph",
        text: "The MCP server acts as a bridge between your AI agent and the Talonic document extraction API. Instead of writing custom HTTP integration code, agent developers get a standards-compliant MCP interface that any compatible client can discover and invoke automatically. The server handles authentication, file upload serialisation, retry logic, and structured error formatting so the agent can focus on the user's task.",
      },
      {
        type: "paragraph",
        text: "Installation takes under a minute: paste a JSON snippet into your MCP client config, supply a `tlnc_` API key, and restart the client. The hosted option at `mcp.talonic.com` requires zero local dependencies — no Node.js, no npm, no build step. The local `npx` option is equally simple and runs on any machine with Node.js 18 or later.",
      },
      {
        type: "callout",
        variant: "info",
        text: "The MCP server is open-source and published to npm as `@talonic/mcp`. You can inspect the source, report issues, and contribute on GitHub.",
      },
    ],
    related: [
      { label: "Why Use This", slug: "why-mcp" },
      { label: "Claude Desktop", slug: "claude-desktop" },
      { label: "Node SDK", slug: "introduction" },
    ],
    faq: [
      {
        question: "What is the Talonic MCP server?",
        answer:
          "An official MCP server that gives AI agents (Claude Desktop, Cursor, Cline, etc.) the ability to extract structured data from documents using the Model Context Protocol.",
      },
      {
        question: "Is the Talonic MCP server on the official MCP Registry?",
        answer:
          "Yes. It is listed as io.github.talonicdev/talonic-mcp on registry.modelcontextprotocol.io, maintained by Anthropic and the MCP steering group.",
      },
      {
        question: "Do I need to install anything to use the Talonic MCP server?",
        answer:
          "Not necessarily. The hosted server at mcp.talonic.com requires zero local installation — just a URL and API key in your MCP client config. Alternatively, the local npx option requires Node.js 18+.",
      },
    ],
    mentions: ["MCP", "Model Context Protocol", "AI agents", "document extraction"],
  },
  {
    slug: "why-mcp",
    parentSlug: "overview",
    title: "Why Use This",
    seoTitle: "Why Talonic MCP — Talonic Docs",
    description:
      "Why AI agents should use the Talonic MCP server instead of raw OCR plus LLM calls for document extraction.",
    content: [
      {
        type: "paragraph",
        text: "When an agent needs to pull structured data out of a PDF, scan, image, or messy document, the usual approach is raw OCR plus an LLM call. Results are unreliable; tables get mangled, dates get misread, totals drift.",
      },
      {
        type: "paragraph",
        text: "With this MCP server installed, the agent has a `talonic_extract` tool that returns schema-validated JSON with per-field confidence scores, a detected document type, and stable IDs for follow-up calls. Seven other tools cover the rest of the workflow: searching the workspace, filtering by extracted field values, fetching a document's metadata, getting OCR markdown, listing saved schemas, saving new ones, and reading the workspace credit balance for budget-aware behaviour.",
      },
      {
        type: "paragraph",
        text: "The extraction pipeline runs server-side on Talonic's infrastructure, which means the agent does not need to manage OCR libraries, prompt engineering for data extraction, or post-processing heuristics. A single tool call replaces what would otherwise be a multi-step chain of OCR, schema validation, and confidence estimation inside the agent's own context window.",
      },
      {
        type: "paragraph",
        text: "Because each extraction returns **per-field confidence scores**, agents can make informed decisions about when to trust extracted values and when to escalate to the user for review. This is especially valuable for high-stakes fields like financial amounts, legal terms, and dates where silent errors are costly.",
      },
      {
        type: "callout",
        variant: "info",
        text: "Every document processed through the MCP server is stored in your Talonic workspace with a stable `document_id`. Subsequent operations — re-extraction with a different schema, markdown retrieval, metadata lookup — reuse that ID without re-uploading the file, saving both time and credits.",
      },
    ],
    related: [
      { label: "talonic_extract", slug: "talonic-extract" },
      { label: "Get an API Key", slug: "get-api-key" },
    ],
    faq: [
      {
        question: "Why use Talonic MCP instead of OCR + LLM?",
        answer:
          "Raw OCR + LLM calls produce unreliable results — mangled tables, misread dates, drifting totals. Talonic returns schema-validated JSON with per-field confidence scores and stable IDs for follow-up calls.",
      },
      {
        question: "Does the MCP server handle retries and errors automatically?",
        answer:
          "Yes. The server retries on transient failures (429 rate limits, 5xx server errors) and returns structured error messages the agent can reason about, rather than raw HTTP status codes.",
      },
      {
        question: "Can I re-extract a document with a different schema without re-uploading?",
        answer:
          "Yes. Pass the document_id from a previous extraction to talonic_extract with a new schema. The server reuses the already-ingested document, which is faster and costs fewer credits.",
      },
    ],
    mentions: ["OCR", "schema-validated", "confidence scores", "structured data"],
  },
  {
    slug: "agent-decision-guide",
    parentSlug: "overview",
    title: "Agent Decision Guide",
    seoTitle: "Agent Decision Guide — Talonic MCP",
    description:
      "How an AI agent should pick between Talonic's tools, handle low-confidence results, and avoid unnecessary calls.",
    content: [
      {
        type: "paragraph",
        text: "Use this guide to pick the right Talonic tool for the user's request. Match the user's intent to one of the scenarios below before calling a tool. The wrong tool returns the wrong data, costs unnecessary credits, and slows the conversation.",
      },
      {
        type: "paragraph",
        text: "The seven tools are designed for distinct use cases with minimal overlap. **`talonic_extract`** is for structured field extraction with a schema, **`talonic_to_markdown`** is for full-text conversion, **`talonic_search`** handles fuzzy discovery, **`talonic_filter`** handles precise field-value queries, **`talonic_get_document`** returns metadata, and the schema tools (**`talonic_list_schemas`**, **`talonic_save_schema`**) manage reusable extraction templates.",
      },
      {
        type: "paragraph",
        text: "A well-built agent should check conversation history before making any tool call. If the user already extracted data from a document in an earlier turn, re-use that result rather than calling `talonic_extract` again. Repeat calls cost credits and add latency without providing new information.",
      },
      {
        type: "paragraph",
        text: "When in doubt about which tool to use, consider the user's underlying intent: do they want specific field values (extract), the full document text (to_markdown), to find documents (search/filter), or to manage extraction templates (schema tools)? This mental model covers every scenario.",
      },
      {
        type: "heading",
        level: 3,
        id: "decide-extract-vs-markdown",
        text: "User has a file (or just dropped one in)",
      },
      {
        type: "list",
        items: [
          "**They want specific fields**: vendor, total, dates, parties, line items. Use `talonic_extract` with a `schema` (full JSON Schema is most reliable) or a `schema_id` from `talonic_list_schemas`. Schema is required; the MCP layer rejects schema-less calls.",
          "**They want the full text content**, e.g. for summarisation, translation, or general analysis. Use `talonic_to_markdown`. It returns OCR-converted markdown without forcing a schema.",
          "**They want both**: extract once with a schema (which also yields markdown when `include_markdown: true` is set), avoiding two uploads.",
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "decide-find-existing",
        text: "User is asking about existing documents in the workspace",
      },
      {
        type: "list",
        items: [
          "**Conceptual or fuzzy** (e.g. 'do I have any docs about indemnification?', 'find Acme contracts'): use `talonic_search`.",
          "**Value-based on extracted fields** (e.g. 'invoices over 1000 EUR', 'contracts expiring before 2026-12-31'): use `talonic_filter`. `is_not_empty` is not exposed in v0.1; for presence checks against populated fields, filter against a known value or use `is_empty` and invert client-side.",
          "**They reference a specific document_id**: use `talonic_get_document` for metadata, `talonic_to_markdown` (with `document_id`) for text, or `talonic_extract` (with `document_id`) to re-extract with a new schema. Re-using a document_id is cheaper than re-uploading.",
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "decide-schema-mgmt",
        text: "User is working with schemas",
      },
      {
        type: "list",
        items: [
          "**One-off extraction**: pass the schema inline on `talonic_extract`. Do not save it.",
          "**The same schema across many documents**: call `talonic_save_schema` once, then pass the returned id (UUID or `SCH-XXXXXXXX`) as `schema_id` on every future `talonic_extract` call. Either id form is accepted.",
          "**Discovering existing schemas** before designing a new one: call `talonic_list_schemas`. The `talonic://schemas` resource is the same list rendered as a browseable resource for clients that support it.",
          "**Avoid clutter**: do not save a schema until the user has reviewed and confirmed the design. Iterate inline first.",
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "decide-confidence",
        text: "Handling confidence and human review",
      },
      {
        type: "paragraph",
        text: "Every `talonic_extract` response includes `confidence.overall` (0..1) and `confidence.fields` (per-field 0..1). Use these to decide when to escalate.",
      },
      {
        type: "list",
        items: [
          "**`confidence.overall` below ~0.7**: tell the user the extraction may be unreliable, show the top low-confidence fields, and ask them to confirm before taking any downstream action (payment, contract execution, data import).",
          "**Per-field confidence below ~0.7**: surface those fields with a 'needs review' marker. Do not silently use them in calculations or external API calls.",
          "**Critical fields at any confidence**: financial amounts, legal terms, names, dates. Always confirm with the user before acting on them, even at high confidence.",
          "**Provenance is not surfaced in v0.1.** Per-field source page or bounding box is not in the response. If the user needs to verify a specific field against the source, send them to the document via `links.dashboard` from the response.",
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "decide-not-call",
        text: "When not to call Talonic",
      },
      {
        type: "list",
        items: [
          "**The user's question is general knowledge or conversation.** Do not pre-emptively extract or search.",
          "**The needed data is already in conversation history** from a previous tool call. Re-use it. Repeat calls cost credits and slow the response.",
          "**The user wants to discuss or revise** an extraction you already produced. Reason over the previous result instead of re-extracting.",
          "**Schema design iteration**. Iterate the schema with the user via `talonic_extract` with an inline schema; only call `talonic_save_schema` once they confirm.",
          "**Cost, EUR price, and remaining credit balance are not surfaced in v0.1 tool responses.** If the user asks 'how much will this cost' or 'how many credits do I have left', point them to the Talonic dashboard at https://app.talonic.com.",
        ],
      },
    ],
    related: [
      { label: "talonic_extract", slug: "talonic-extract" },
      { label: "talonic_filter", slug: "talonic-filter" },
      { label: "talonic_search", slug: "talonic-search" },
      { label: "Known Limitations", slug: "known-limitations" },
    ],
    faq: [
      {
        question: "When should an agent use talonic_extract vs talonic_to_markdown?",
        answer:
          "Use talonic_extract when the user wants specific structured fields (with a schema). Use talonic_to_markdown when the user wants the full text content for summarisation or analysis without a schema.",
      },
      {
        question: "When should an agent use talonic_search vs talonic_filter?",
        answer:
          "Use talonic_search for conceptual or fuzzy queries across the workspace. Use talonic_filter when the user wants documents matching specific structured field values like 'invoices over 1000 EUR'.",
      },
      {
        question: "How should an agent handle low-confidence extractions?",
        answer:
          "Treat confidence below ~0.7 as needing human review. Surface low-confidence fields explicitly and confirm critical fields (amounts, dates, names) with the user before any downstream action.",
      },
    ],
    mentions: ["decision guide", "agent", "tool selection", "confidence", "human review", "cost"],
  },
  {
    slug: "get-api-key",
    parentSlug: "overview",
    title: "Get an API Key",
    seoTitle: "Get an API Key — Talonic MCP",
    description:
      "Get a Talonic API key in 30 seconds. Each user runs against their own isolated workspace with private documents and schemas.",
    content: [
      {
        type: "paragraph",
        text: "Each user runs against their own isolated Talonic workspace. Your documents and schemas are private to you.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Sign up at [app.talonic.com](https://app.talonic.com). Free tier: 50 extractions per day, no credit card.",
          "Settings → API Keys → Create New Key.",
          "Copy the `tlnc_` value into your MCP client config (snippets below).",
        ],
      },
      {
        type: "paragraph",
        text: "The API key authenticates every tool call the MCP server makes on your behalf. It is passed as a `TALONIC_API_KEY` environment variable in the local `npx` setup, or as a `Bearer` token in the `Authorization` header for the hosted server. The key is never sent to the AI agent itself — it stays within the MCP server process.",
      },
      {
        type: "paragraph",
        text: "Keep your API key private. Do not commit it to version control or share it in public MCP config examples. If a key is compromised, revoke it immediately in the Talonic dashboard under Settings → API Keys and generate a new one.",
      },
      {
        type: "paragraph",
        text: "The free tier includes 50 extractions per day, which is enough for development and testing. For production workloads or higher volume, upgrade your plan in the Talonic dashboard. All plans share the same API — the key determines your rate limits and quota.",
      },
      {
        type: "callout",
        variant: "warning",
        text: "Never hardcode your `tlnc_` key in source code or share it in screenshots. Use environment variables or your MCP client's config file, which is typically stored in a user-specific directory.",
      },
    ],
    related: [
      { label: "Claude Desktop", slug: "claude-desktop" },
      { label: "Install Overview", slug: "install-overview" },
    ],
    faq: [
      {
        question: "How do I get a Talonic API key for MCP?",
        answer:
          "Sign up at app.talonic.com (free, no credit card), go to Settings > API Keys > Create New Key, and copy the tlnc_ value into your MCP client config.",
      },
      {
        question: "Is the free tier enough for development?",
        answer:
          "Yes. The free tier includes 50 extractions per day with no credit card required, which is sufficient for development and testing. Upgrade in the dashboard for production workloads.",
      },
      {
        question: "What should I do if my API key is compromised?",
        answer:
          "Revoke it immediately in the Talonic dashboard under Settings > API Keys, then generate a new one. Update your MCP client config with the new key and restart the client.",
      },
    ],
    mentions: ["API key", "tlnc_", "free tier"],
  },
]
