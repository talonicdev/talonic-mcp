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
        type: "paragraph",
        text: "This approach works transparently across all chat-style MCP clients. The agent does not need to know where the file is stored on disk, and the user does not need to configure file paths or directory permissions. The entire flow — from drop to structured extraction — happens in a single conversation turn.",
      },
      {
        type: "paragraph",
        text: "Supported file types include PDF, PNG, JPG, TIFF, DOCX, XLSX, and other common document formats. The MCP server infers the MIME type from the `filename` extension, so always include the original file extension when passing `file_data`. If the extension is missing or unusual, the server may reject the upload with an `unsupported_file_type` error.",
      },
      {
        type: "callout",
        text: "Tool descriptions advertise `file_data` as the recommended input for chat-style clients, so well-trained agents reach for it automatically. No client-side configuration required.",
      },
    ],
    related: [
      { label: "talonic_extract", slug: "talonic-extract" },
      { label: "talonic_to_markdown", slug: "talonic-to-markdown" },
      { label: "Common Issues", slug: "common-issues" },
    ],
    faq: [
      {
        question: "Can I drag and drop files into Claude Desktop with Talonic?",
        answer:
          "Yes. Since @talonic/mcp@0.1.4, talonic_extract and talonic_to_markdown accept base64 file data directly, so you can drop a PDF into Claude Desktop and extract data without file path setup.",
      },
      {
        question: "What file types can I drag and drop?",
        answer:
          "PDF, PNG, JPG, TIFF, DOCX, XLSX, and other common document formats. The MCP server infers the MIME type from the filename extension.",
      },
      {
        question: "Why does drag-and-drop fail with an unsupported_file_type error?",
        answer:
          "The filename is missing a recognisable extension. Make sure the original filename with its extension is passed in the filename parameter alongside file_data.",
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
      {
        type: "paragraph",
        text: "The MCP server acts as a thin translation layer between the MCP protocol and the Talonic REST API. It receives tool calls from the agent over **stdio** (local mode) or **streamable HTTP** (hosted mode), validates parameters, constructs the appropriate API request, and returns the response in the MCP-standard `content` format the agent expects.",
      },
      {
        type: "paragraph",
        text: "For file uploads, the server handles the complexity of multipart form encoding. It reads file bytes from `file_data` (base64), `file_path` (local disk), or `file_url` (remote URL), detects the MIME type from the filename extension, and streams the upload to `api.talonic.com`. This means the agent never needs to deal with multipart boundaries or content-type headers.",
      },
      {
        type: "paragraph",
        text: "Error handling is designed for agent consumption. API errors are reformatted into structured messages that include the error type, a human-readable description, and actionable next steps. For example, a missing schema error tells the agent to provide a `schema` or `schema_id`, rather than returning a raw 400 status code.",
      },
      {
        type: "callout",
        variant: "info",
        text: "The MCP server automatically retries on `429` (rate limit) and `5xx` (server error) responses with exponential backoff. Agents do not need to implement retry logic themselves.",
      },
    ],
    related: [
      { label: "Environment Variables", slug: "env-variables" },
      { label: "Node SDK", slug: "introduction" },
      { label: "Install Overview", slug: "install-overview" },
    ],
    faq: [
      {
        question: "How does the Talonic MCP server work?",
        answer:
          "The MCP server communicates with AI agents over stdio using the MCP protocol. Each tool call translates to one HTTPS request to api.talonic.com with automatic auth, retries, and error formatting.",
      },
      {
        question: "Does the MCP server handle retries automatically?",
        answer:
          "Yes. The server retries on 429 (rate limit) and 5xx (server error) responses with exponential backoff. Agents do not need to implement retry logic.",
      },
      {
        question: "How are errors returned to the agent?",
        answer:
          "API errors are reformatted into structured messages with error type, description, and actionable next steps. The agent receives clear guidance instead of raw HTTP status codes.",
      },
    ],
    mentions: ["stdio", "HTTPS", "Bearer auth", "architecture", "retry", "error handling"],
  },
]
