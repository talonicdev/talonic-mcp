import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

/**
 * Webhook reference info fetched from the Talonic API.
 * These endpoints don't require a request body — just auth.
 */
const WEBHOOK_INFO_ENDPOINTS = [
  { path: "/v1/webhooks/events", key: "events", description: "Available webhook event types" },
  { path: "/v1/webhooks/delivery", key: "delivery", description: "Delivery behavior and retry policy" },
  { path: "/v1/webhooks/signatures", key: "signatures", description: "Signature verification algorithms" },
  { path: "/v1/webhooks/retries", key: "retries", description: "Retry schedule and backoff policy" },
] as const

/**
 * Register the `talonic://webhooks/reference` resource.
 *
 * Aggregates the four webhook info routes into a single resource so
 * agents can look up event types, delivery semantics, signature
 * algorithms, and retry policies without leaving the MCP context.
 *
 * @internal
 */
export function registerWebhooksResource(server: McpServer, apiKey: string, baseUrl?: string): void {
  const base = baseUrl ?? "https://api.talonic.com"

  server.registerResource(
    "talonic-webhooks-reference",
    "talonic://webhooks/reference",
    {
      title: "Talonic Webhooks Reference",
      description:
        "Webhook event types, delivery behavior, signature verification algorithms, and retry policies.",
      mimeType: "application/json",
    },
    async (uri) => {
      const results: Record<string, unknown> = {}

      await Promise.all(
        WEBHOOK_INFO_ENDPOINTS.map(async ({ path, key }) => {
          try {
            const res = await fetch(`${base}${path}`, {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json",
              },
            })
            if (res.ok) {
              results[key] = await res.json()
            } else {
              results[key] = { error: `HTTP ${res.status}`, message: await res.text().catch(() => "") }
            }
          } catch (err) {
            results[key] = { error: "fetch_failed", message: err instanceof Error ? err.message : String(err) }
          }
        }),
      )

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: JSON.stringify(results, null, 2),
          },
        ],
      }
    },
  )
}
