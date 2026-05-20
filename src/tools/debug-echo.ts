import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createHash } from "node:crypto"
import { z } from "zod"
import { jsonOk, type ToolResult } from "./_shared.js"
import { VERSION } from "../version.js"

// Debug-only tool. Gated by TALONIC_DEBUG_TOOLS=1 in server-factory.ts.
// Used to measure exactly what the MCP server receives from a hosted
// connector (Claude.ai) when the user drags a file in. Burns zero API
// credits and touches no external services — it just describes its own
// input back to the agent so the agent can quote those numbers in chat.

const DESCRIPTION = [
  "DEBUG ONLY. Echoes back diagnostic information about the arguments the MCP server received.",
  "Use this to verify what the Talonic MCP server actually receives from your client.",
  "Particularly useful for diagnosing Claude.ai's tool-call argument-size cap on `file_data`.",
  "Does not call the Talonic API. Burns no credits. Stores no data.",
  "",
  "USE WHEN asked to test or measure how a file or argument reaches the Talonic MCP server.",
  "Pass the file or arguments exactly as you would to `talonic_extract`.",
].join("\n")

const inputSchema = {
  file_data: z
    .string()
    .optional()
    .describe("Base64-encoded file bytes, as you would pass to talonic_extract."),
  filename: z.string().optional().describe("Original filename including extension."),
  file_url: z.string().optional().describe("URL of a file, as you would pass to talonic_extract."),
  document_id: z.string().optional().describe("Existing document id."),
  note: z
    .string()
    .optional()
    .describe("Optional free-text label to identify this test run in server logs."),
}

const outputSchema = {
  server_name: z.string().describe("MCP server name."),
  server_version: z.string().describe("MCP server version."),
  received_at: z.string().describe("ISO 8601 timestamp when the server processed the call."),
  keys_present: z.array(z.string()).describe("Argument keys that were provided (non-undefined)."),
  byte_lengths: z
    .record(z.string(), z.number())
    .describe("UTF-8 byte length of each provided string argument."),
  file_data: z
    .object({
      raw_string_byte_length: z
        .number()
        .describe("UTF-8 byte length of the file_data string as received."),
      decoded_byte_length: z
        .number()
        .nullable()
        .describe("Byte length after base64 decode. null if decode failed."),
      base64_valid: z
        .boolean()
        .describe("True when the received file_data is a parseable base64 string."),
      prefix_64: z.string().describe("First 64 characters of the file_data string."),
      suffix_64: z.string().describe("Last 64 characters of the file_data string."),
      sha256_of_string: z.string().describe("SHA-256 of the raw file_data string as received."),
      sha256_of_decoded: z
        .string()
        .nullable()
        .describe("SHA-256 of the base64-decoded bytes. null if decode failed."),
    })
    .nullable()
    .describe("Diagnostics for the file_data argument, or null when not provided."),
  note: z.string().nullable().describe("Echoed `note` argument."),
}

export interface DebugEchoArgs {
  file_data?: string
  filename?: string
  file_url?: string
  document_id?: string
  note?: string
}

export async function handleDebugEcho(args: DebugEchoArgs): Promise<ToolResult> {
  const keysPresent: string[] = []
  const byteLengths: Record<string, number> = {}
  for (const key of ["file_data", "filename", "file_url", "document_id", "note"] as const) {
    const v = args[key]
    if (v !== undefined) {
      keysPresent.push(key)
      byteLengths[key] = Buffer.byteLength(v, "utf8")
    }
  }

  let fileDataDiagnostics: {
    raw_string_byte_length: number
    decoded_byte_length: number | null
    base64_valid: boolean
    prefix_64: string
    suffix_64: string
    sha256_of_string: string
    sha256_of_decoded: string | null
  } | null = null

  if (args.file_data !== undefined) {
    const raw = args.file_data
    const rawBytes = Buffer.byteLength(raw, "utf8")
    let decoded: Buffer | null = null
    let base64Valid = false
    try {
      const buf = Buffer.from(raw, "base64")
      // Buffer.from with base64 is lenient; verify roundtrip to detect garbage.
      const roundtrip = buf.toString("base64")
      base64Valid = roundtrip.replace(/=+$/, "") === raw.replace(/=+$/, "").replace(/\s/g, "")
      decoded = buf
    } catch {
      decoded = null
    }
    fileDataDiagnostics = {
      raw_string_byte_length: rawBytes,
      decoded_byte_length: decoded ? decoded.byteLength : null,
      base64_valid: base64Valid,
      prefix_64: raw.slice(0, 64),
      suffix_64: raw.length > 64 ? raw.slice(-64) : "",
      sha256_of_string: createHash("sha256").update(raw, "utf8").digest("hex"),
      sha256_of_decoded: decoded ? createHash("sha256").update(decoded).digest("hex") : null,
    }
  }

  // Server-side log line so we can correlate the chat with the deploy logs.
  console.log(
    `[debug-echo] keys=${keysPresent.join(",")} ` +
      Object.entries(byteLengths)
        .map(([k, v]) => `${k}=${v}b`)
        .join(" ") +
      (args.note ? ` note="${args.note}"` : ""),
  )

  return jsonOk({
    server_name: "talonic-mcp",
    server_version: VERSION,
    received_at: new Date().toISOString(),
    keys_present: keysPresent,
    byte_lengths: byteLengths,
    file_data: fileDataDiagnostics,
    note: args.note ?? null,
  })
}

export function registerDebugEcho(server: McpServer): void {
  server.registerTool(
    "talonic_debug_echo",
    {
      title: "Talonic Debug Echo",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        title: "Talonic Debug Echo",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args) => handleDebugEcho(args as DebugEchoArgs),
  )
}
