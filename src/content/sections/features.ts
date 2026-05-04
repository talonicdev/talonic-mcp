import type { RawSection } from "../types"

export const sections: RawSection[] = [
  {
    slug: "drag-and-drop",
    parentSlug: "features",
    title: "Drag & Drop Files",
    seoTitle: "Drag & Drop File Support — Talonic MCP",
    description:
      "Drop PDFs and documents directly into Claude Desktop, Cursor, or Cowork and extract data without file path configuration.",
    content: [
      {
        type: "paragraph",
        text: "When the user drag-drops a PDF (or any supported file) into a chat-style MCP host such as Claude Desktop, Cowork, or Cursor, the file lands in a host-owned sandbox directory the MCP server cannot read. The path the host hands the agent is meaningless to a separately-running `npx` MCP process.",
      },
      {
        type: "paragraph",
        text: "`@talonic/mcp@0.1.4` and later solve this by accepting **`file_data`** (base64-encoded file bytes) and **`filename`** on `talonic_extract` and `talonic_to_markdown`. The agent reads the file bytes from the conversation, base64-encodes them, and passes them through the MCP tool call. The MCP server decodes, infers MIME type from the filename, and uploads to the Talonic API.",
      },
      {
        type: "callout",
        text: "Tool descriptions advertise `file_data` as the recommended input for chat-style clients, so well-trained agents reach for it automatically. No client-side configuration required.",
      },
    ],
    related: [
      { label: "talonic_extract", slug: "talonic-extract" },
      { label: "talonic_to_markdown", slug: "talonic-to-markdown" },
    ],
    faq: [
      {
        question: "Can I drag and drop files into Claude Desktop with Talonic?",
        answer:
          "Yes. Since @talonic/mcp@0.1.4, talonic_extract and talonic_to_markdown accept base64 file data directly, so you can drop a PDF into Claude Desktop and extract data without file path setup.",
      },
    ],
    mentions: ["drag-and-drop", "file_data", "base64", "Claude Desktop"],
  },
  {
    slug: "how-it-works",
    parentSlug: "features",
    title: "How It Works",
    seoTitle: "How Talonic MCP Works — Talonic Docs",
    description:
      "Architecture of the Talonic MCP server: MCP protocol over stdio to the agent, HTTPS with Bearer auth to api.talonic.com.",
    content: [
      {
        type: "code",
        language: "text",
        title: "Architecture",
        code: `Agent (Claude Desktop / Cursor / Cline / etc.)
  ↓ MCP protocol over stdio
Talonic MCP server (this package)
  ↓ HTTPS, Bearer auth
api.talonic.com`,
      },
      {
        type: "paragraph",
        text: "Each tool call is one HTTP request to the Talonic API, using your API key. The server handles auth, retries on transient failures (429, 5xx), MIME-type detection on file uploads, multipart serialisation, and structured error formatting.",
      },
    ],
    related: [
      { label: "Environment Variables", slug: "env-variables" },
      { label: "Node SDK", slug: "introduction" },
    ],
    faq: [
      {
        question: "How does the Talonic MCP server work?",
        answer:
          "The MCP server communicates with AI agents over stdio using the MCP protocol. Each tool call translates to one HTTPS request to api.talonic.com with automatic auth, retries, and error formatting.",
      },
    ],
    mentions: ["stdio", "HTTPS", "Bearer auth", "architecture"],
  },
]
