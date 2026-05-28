import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

const DESCRIPTION = [
  "STATUS: stable.",
  "",
  "Request a file upload link for the user. Use this when the user wants to",
  "extract a file but you cannot deliver it directly (e.g., the file is too",
  "large for tool-call arguments, or you're running in a sandboxed environment",
  "like Claude.ai).",
  "",
  "Returns an upload URL the user can open in their browser to drop the file,",
  "plus a document_id to track the upload.",
  "",
  "After showing the URL to the user, poll with talonic_get_document until",
  "status is 'completed' (the file has been uploaded, OCR'd, and is ready for",
  "schema-specific extraction). Then call talonic_extract with the document_id",
  "and a schema or schema_id.",
  "",
  "IMPORTANT: a user message like 'uploaded', 'done', or 'I dropped it' only",
  "confirms the browser-side upload finished. It is NOT a signal that server-side",
  "processing is complete. The document still needs OCR and exhaustive extraction",
  "(typically 10-30 s after the browser upload). You MUST poll talonic_get_document",
  "yourself until status is 'completed' regardless of what the user says. Calling",
  "talonic_extract before status is 'completed' may return errors.",
  "",
  "USE WHEN:",
  "- The user has a file to extract but you cannot send it via tool-call arguments",
  "  (e.g., file is larger than ~32KB, or the environment blocks outbound data).",
  "- You are running in a hosted/sandboxed environment (Claude.ai, ChatGPT) where",
  "  file_data cannot be used reliably.",
  "- The user explicitly asks for an upload link.",
  "",
  "DO NOT USE WHEN:",
  "- You can deliver the file directly via file_data (local-stdio installs with small files).",
  "- The file is already accessible via a public URL (use file_url on talonic_extract instead).",
  "- The document is already in the workspace (use document_id on talonic_extract instead).",
].join("\n")

const inputSchema = {
  filename: z
    .string()
    .min(1)
    .describe(
      "The name of the file being uploaded, including extension (e.g. 'invoice.pdf'). Used to pre-allocate the document and infer MIME type.",
    ),
}

const outputSchema = {
  document_id: z
    .string()
    .describe(
      "The pre-allocated document ID. Use with talonic_get_document to poll status, and with talonic_extract once uploaded.",
    ),
  upload_url: z.string().describe("URL the user should open in their browser to drop the file."),
  expires_at: z.string().describe("ISO 8601 timestamp when the upload link expires."),
}

export interface RequestUploadArgs {
  filename: string
}

export async function handleRequestUpload(
  getToken: () => string,
  baseUrl: string | undefined,
  args: RequestUploadArgs,
): Promise<ToolResult> {
  try {
    const base = baseUrl ?? "https://api.talonic.com"
    const token = getToken()

    const res = await fetch(`${base}/v1/documents/upload-session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ filename: args.filename }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return toolError(
        new Error(`Talonic API error: HTTP ${res.status}${body ? ` — ${body}` : ""}`),
      )
    }

    const data = (await res.json()) as {
      document_id: string
      upload_url: string
      expires_at: string
    }
    return jsonOk({
      document_id: data.document_id,
      upload_url: data.upload_url,
      expires_at: data.expires_at,
    })
  } catch (err) {
    return toolError(err)
  }
}

export function registerRequestUpload(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_request_upload",
    {
      title: "Request File Upload",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        title: "Request File Upload",
        readOnlyHint: false,
        openWorldHint: true,
      },
    },
    async (args) => handleRequestUpload(getToken, baseUrl, args as RequestUploadArgs),
  )
}
