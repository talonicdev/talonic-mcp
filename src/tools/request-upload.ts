import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { WIDGET_URIS } from "../widgets/types.js"

const DESCRIPTION = [
  "Get a browser upload link the user opens to add a file to their workspace. Returns the link plus a pre-allocated document_id.",
  "",
  "USE WHEN: the user wants to upload a document and you cannot pass it directly — hosted/sandboxed clients (ChatGPT, Claude.ai) or files too large for tool-call arguments.",
  "NOT FOR: a document already in the workspace (use its document_id) · a file already on a public URL (use file_url on talonic_extract).",
  "ARGS: filename (with extension).",
  "RETURNS: upload_url, document_id, expires_at. After the user uploads, poll talonic_get_document on that document_id until status is 'completed', then call talonic_extract. If status becomes ocr_failed, extraction_failed, or error, stop polling and report the failure to the user.",
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
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URIS.requestUpload },
        "openai/outputTemplate": WIDGET_URIS.requestUpload,
      },
    },
    async (args) => handleRequestUpload(getToken, baseUrl, args as RequestUploadArgs),
  )
}
