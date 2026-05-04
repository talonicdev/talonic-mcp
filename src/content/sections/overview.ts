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
        text: "Seven tools and one resource: `talonic_extract`, `talonic_search`, `talonic_filter`, `talonic_get_document`, `talonic_to_markdown`, `talonic_list_schemas`, `talonic_save_schema`, plus the `talonic://schemas` resource.",
      },
      {
        type: "paragraph",
        text: "Listed on the [official MCP Registry](https://registry.modelcontextprotocol.io/) as `io.github.talonicdev/talonic-mcp`. Verified end-to-end against production.",
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
        text: "With this MCP server installed, the agent has a `talonic_extract` tool that returns schema-validated JSON with per-field confidence scores, a detected document type, and stable IDs for follow-up calls. Six other tools cover the rest of the workflow: searching the workspace, filtering by extracted field values, fetching a document's metadata, getting OCR markdown, listing saved schemas, and saving new ones.",
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
    ],
    mentions: ["OCR", "schema-validated", "confidence scores", "structured data"],
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
    ],
    mentions: ["API key", "tlnc_", "free tier"],
  },
]
