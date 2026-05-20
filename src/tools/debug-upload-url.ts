import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { randomBytes } from "node:crypto"
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { z } from "zod"
import { jsonOk, toolError, validationError, type ToolResult } from "./_shared.js"

// Debug-only tool pair. Gated by TALONIC_DEBUG_TOOLS=1 in server-factory.ts.
// Together with talonic_debug_echo, lets us empirically test whether an
// agent running inside Claude.ai's hosted connector can perform an
// out-of-band HTTPS PUT to a presigned URL. Uses a disposable S3 bucket.

interface S3Config {
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

function readS3Config(env: NodeJS.ProcessEnv): S3Config | string {
  const region = env["S3_REGION"]
  const bucket = env["S3_BUCKET"]
  const accessKeyId = env["S3_ACCESS_KEY_ID"]
  const secretAccessKey = env["S3_SECRET_ACCESS_KEY"]
  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    return "S3 debug tools are enabled (TALONIC_DEBUG_TOOLS=1) but S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY are not all set. Tools will return a configuration error until they are."
  }
  return { region, bucket, accessKeyId, secretAccessKey }
}

function makeS3Client(cfg: S3Config): S3Client {
  return new S3Client({
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  })
}

function safeFilenameSegment(filename: string): string {
  return filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80)
}

// ─── talonic_debug_request_upload_url ───────────────────────────────────

const REQUEST_URL_DESCRIPTION = [
  "DEBUG ONLY. Mint a one-time HTTPS PUT URL backed by S3.",
  "Used to test whether the calling agent can perform an out-of-band HTTPS PUT",
  "with a binary body, bypassing the MCP tool-call argument-size cap.",
  "",
  "Flow: call this tool to receive `upload_url` and `object_key`, then PUT the",
  "file bytes to `upload_url`. The URL expires in 15 minutes. Verify the upload",
  "landed by calling `talonic_debug_check_upload` with the returned `object_key`.",
  "",
  "Does not touch the Talonic API. Burns no Talonic credits.",
].join("\n")

const requestUrlInputSchema = {
  filename: z.string().describe("Original filename, used to build the object key."),
  content_type: z
    .string()
    .optional()
    .describe("MIME type the PUT will send (e.g., 'application/pdf'). Optional."),
}

const requestUrlOutputSchema = {
  upload_url: z.string().describe("Presigned HTTPS PUT URL."),
  http_method: z.literal("PUT").describe("HTTP verb required for the upload."),
  required_headers: z
    .record(z.string(), z.string())
    .describe("Headers that must be sent on the PUT for the signature to match."),
  object_key: z.string().describe("S3 object key the upload will land at."),
  bucket: z.string().describe("S3 bucket name."),
  region: z.string().describe("S3 region."),
  expires_in_seconds: z.number().describe("Seconds until the upload URL stops working."),
  expires_at: z.string().describe("ISO 8601 timestamp when the upload URL expires."),
}

export interface RequestUploadUrlArgs {
  filename?: string
  content_type?: string
}

export async function handleRequestUploadUrl(
  env: NodeJS.ProcessEnv,
  args: RequestUploadUrlArgs,
): Promise<ToolResult> {
  if (!args.filename) {
    return validationError("talonic_debug_request_upload_url requires `filename`.")
  }
  const cfg = readS3Config(env)
  if (typeof cfg === "string") return validationError(cfg)

  try {
    const client = makeS3Client(cfg)
    const expiresIn = 900 // 15 minutes
    const safeName = safeFilenameSegment(args.filename)
    const key = `debug-uploads/${Date.now()}-${randomBytes(6).toString("hex")}-${safeName}`
    const contentType = args.content_type ?? "application/octet-stream"

    const command = new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      ContentType: contentType,
    })
    const url = await getSignedUrl(client, command, { expiresIn })

    console.log(
      `[debug-upload-url] minted key=${key} filename="${args.filename}" content_type=${contentType} expires_in=${expiresIn}s`,
    )

    return jsonOk({
      upload_url: url,
      http_method: "PUT",
      required_headers: { "Content-Type": contentType },
      object_key: key,
      bucket: cfg.bucket,
      region: cfg.region,
      expires_in_seconds: expiresIn,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    })
  } catch (err) {
    return toolError(err)
  }
}

export function registerDebugRequestUploadUrl(server: McpServer): void {
  server.registerTool(
    "talonic_debug_request_upload_url",
    {
      title: "Talonic Debug — Request Upload URL",
      description: REQUEST_URL_DESCRIPTION,
      inputSchema: requestUrlInputSchema,
      outputSchema: requestUrlOutputSchema,
      annotations: {
        title: "Talonic Debug — Request Upload URL",
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => handleRequestUploadUrl(process.env, args as RequestUploadUrlArgs),
  )
}

// ─── talonic_debug_check_upload ─────────────────────────────────────────

const CHECK_UPLOAD_DESCRIPTION = [
  "DEBUG ONLY. Check whether an object minted by `talonic_debug_request_upload_url`",
  "actually landed in S3, and report its size and stored content-type.",
  "Use this after attempting the PUT to confirm whether the upload succeeded.",
].join("\n")

const checkUploadInputSchema = {
  object_key: z.string().describe("S3 object key as returned by talonic_debug_request_upload_url."),
}

const checkUploadOutputSchema = {
  found: z.boolean().describe("True when the object exists in the bucket."),
  size_bytes: z.number().nullable().describe("Object size in bytes, or null when not found."),
  content_type: z.string().nullable().describe("Stored Content-Type, or null when not found."),
  last_modified: z
    .string()
    .nullable()
    .describe("ISO 8601 last-modified timestamp, or null when not found."),
  download_url: z
    .string()
    .nullable()
    .describe("Short-lived presigned GET URL for human verification, or null when not found."),
}

export interface CheckUploadArgs {
  object_key?: string
}

export async function handleCheckUpload(
  env: NodeJS.ProcessEnv,
  args: CheckUploadArgs,
): Promise<ToolResult> {
  if (!args.object_key) {
    return validationError("talonic_debug_check_upload requires `object_key`.")
  }
  const cfg = readS3Config(env)
  if (typeof cfg === "string") return validationError(cfg)

  const client = makeS3Client(cfg)
  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: cfg.bucket, Key: args.object_key }),
    )
    const getUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: cfg.bucket, Key: args.object_key }),
      { expiresIn: 900 },
    )
    console.log(
      `[debug-check-upload] found key=${args.object_key} size=${head.ContentLength ?? 0}b`,
    )
    return jsonOk({
      found: true,
      size_bytes: head.ContentLength ?? null,
      content_type: head.ContentType ?? null,
      last_modified: head.LastModified ? head.LastModified.toISOString() : null,
      download_url: getUrl,
    })
  } catch (err) {
    const status =
      err && typeof err === "object" && "$metadata" in err
        ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined
    if (status === 404 || status === 403) {
      console.log(`[debug-check-upload] not_found key=${args.object_key} status=${status}`)
      return jsonOk({
        found: false,
        size_bytes: null,
        content_type: null,
        last_modified: null,
        download_url: null,
      })
    }
    return toolError(err)
  }
}

export function registerDebugCheckUpload(server: McpServer): void {
  server.registerTool(
    "talonic_debug_check_upload",
    {
      title: "Talonic Debug — Check Upload",
      description: CHECK_UPLOAD_DESCRIPTION,
      inputSchema: checkUploadInputSchema,
      outputSchema: checkUploadOutputSchema,
      annotations: {
        title: "Talonic Debug — Check Upload",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => handleCheckUpload(process.env, args as CheckUploadArgs),
  )
}
