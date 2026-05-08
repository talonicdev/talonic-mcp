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
        type: "heading",
        level: 3,
        id: "drag-drop-example",
        text: "Example: drag-and-drop extraction flow",
      },
      {
        type: "code",
        language: "json",
        title: "What the agent sends when a user drops a PDF",
        code: `// User drops "receipt-2026-05.pdf" into the chat
// The MCP client base64-encodes the file bytes automatically
// Agent calls talonic_extract:
{
  "file_data": "JVBERi0xLjQKJcOkw7zDtsO8...",
  "filename": "receipt-2026-05.pdf",
  "schema": {
    "type": "object",
    "properties": {
      "merchant": { "type": "string" },
      "date": { "type": "string", "format": "date" },
      "total": { "type": "number" },
      "payment_method": { "type": "string" }
    },
    "required": ["merchant", "total"]
  }
}`,
      },
      {
        type: "code",
        language: "json",
        title: "Extraction response from dropped file",
        code: `{
  "status": "complete",
  "document": {
    "id": "doc_f1e2...",
    "filename": "receipt-2026-05.pdf",
    "pages": 1,
    "type_detected": "receipt"
  },
  "data": {
    "merchant": "Coffee House Berlin",
    "date": "2026-05-07",
    "total": 14.80,
    "payment_method": "Visa ending 4242"
  },
  "confidence": { "overall": 0.95 }
}`,
      },
      {
        type: "paragraph",
        text: "The drag-and-drop flow works identically across Claude Desktop, Cowork, and other chat-style MCP clients that support file attachments. The key requirement is that the client encodes the file as base64 and passes it in the `file_data` parameter alongside the original `filename`. The MCP server uses the filename extension to determine the MIME type, decodes the base64 bytes, and uploads the file to the Talonic API in a single request.",
      },
      {
        type: "paragraph",
        text: "For large files (over 10 MB), the base64 encoding increases the payload size by approximately 33%. Most MCP clients handle this transparently, but some hosted connectors (notably Claude.ai's web connector) have payload size limits that can truncate the encoded data. If you encounter issues with large files in a hosted connector, use `file_url` with a publicly reachable URL or upload the document through the Talonic dashboard and reference it by `document_id` instead.",
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
      {
        question: "What happens if the dropped file is too large?",
        answer:
          "Base64 encoding increases payload size by about 33%. Most local MCP clients handle this fine, but hosted connectors may have payload limits. For large files (over 10 MB), use file_url with a public URL or upload via the Talonic dashboard and reference by document_id instead.",
      },
      {
        question: "Do I need to configure anything for drag-and-drop to work?",
        answer:
          "No. The file_data parameter is advertised in the tool descriptions, so MCP clients that support file attachments automatically encode and pass the file. Just drop the file into the chat and provide a schema — the agent handles the rest.",
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
        type: "heading",
        level: 3,
        id: "request-lifecycle",
        text: "Request lifecycle",
      },
      {
        type: "code",
        language: "json",
        title: "What happens during a talonic_extract call",
        code: `// 1. Agent sends MCP tool call over stdio/HTTP:
{
  "tool": "talonic_extract",
  "arguments": {
    "file_url": "https://example.com/invoice.pdf",
    "schema": { "type": "object", "properties": { "total": { "type": "number" } } }
  }
}

// 2. MCP server validates parameters, constructs API request:
// POST https://api.talonic.com/v1/extract
// Authorization: Bearer tlnc_...
// Content-Type: multipart/form-data (for file uploads)

// 3. API processes: download file → OCR → extract fields → validate schema

// 4. MCP server formats response as MCP content:
{
  "content": [
    {
      "type": "text",
      "text": "{ \\"status\\": \\"complete\\", \\"data\\": { \\"total\\": 1500.00 }, ... }"
    }
  ]
}`,
      },
      {
        type: "paragraph",
        text: "The MCP server is stateless between tool calls. It does not cache documents, schemas, or extraction results locally. Every tool call is an independent HTTP request to the Talonic API, which means the server can be restarted at any time without losing state. All persistence — documents, schemas, extraction history — lives in the Talonic cloud workspace, accessible via your API key.",
      },
      {
        type: "paragraph",
        text: "Authentication is handled transparently by the MCP server. For the local `npx` option, the server reads the `TALONIC_API_KEY` environment variable at startup and attaches it as a `Bearer` token to every API request. For the hosted option at `mcp.talonic.com`, the client passes the API key in the `Authorization` header, and the hosted server forwards it to the Talonic API. In neither case does the API key reach the AI agent — it stays within the MCP server process boundary.",
      },
      {
        type: "paragraph",
        text: "Transport modes differ between local and hosted deployments. The local `npx` server communicates with the MCP client over **stdio** (standard input/output), which is the default transport for locally-spawned MCP servers. The hosted server at `mcp.talonic.com` uses **streamable HTTP**, where the client sends HTTP requests and receives streamed responses. Both transports implement the same MCP protocol, so tool behaviour is identical regardless of transport mode.",
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
      {
        question: "Does the MCP server store any data locally?",
        answer:
          "No. The server is stateless between tool calls. It does not cache documents, schemas, or results locally. All persistence lives in the Talonic cloud workspace. The server can be restarted at any time without losing state.",
      },
      {
        question: "Is my API key exposed to the AI agent?",
        answer:
          "No. The API key stays within the MCP server process boundary. For local setups, it is read from the TALONIC_API_KEY environment variable. For hosted setups, it is passed in the Authorization header. In neither case does the key reach the AI agent's context window.",
      },
    ],
    mentions: ["stdio", "HTTPS", "Bearer auth", "architecture", "retry", "error handling"],
  },
]
