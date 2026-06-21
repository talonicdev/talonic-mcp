import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

const DESCRIPTION = [
  "Read Talonic's machine-readable credit pricing catalog: fixed per-unit rates so you can predict spend BEFORE running anything.",
  "",
  "USE WHEN: estimating the cost of a planned extraction/structuring/matching job, or answering a pricing question. Public — works without spending credits.",
  "NOT FOR: the workspace's current balance (use talonic_get_balance) or what it has already spent (use talonic_get_usage).",
  "ARGS: none.",
  "RETURNS: currency, credits_per_eur, multipliers (e.g. batch 0.5x), and units[] — each { unit, label, credits, eur, free }.",
].join("\n")

const inputSchema = {}

const outputSchema = {
  currency: z.string().describe("Billing currency (always EUR)."),
  credits_per_eur: z.number().describe("Credits per EUR (e.g. 1000 = €1)."),
  multipliers: z
    .record(z.string(), z.number())
    .describe(
      "Processing-mode multipliers applied on top of per-unit cost (e.g. { realtime: 1, batch: 0.5 }).",
    ),
  units: z
    .array(
      z.object({
        unit: z.string().describe("Billable unit identifier."),
        label: z.string().describe("Human-readable label."),
        credits: z.number().describe("Credits per unit (0 = free)."),
        eur: z.number().describe("EUR per unit."),
        free: z.boolean().describe("Whether the unit is free."),
      }),
    )
    .describe("The per-unit pricing catalog."),
}

/**
 * Pure handler. Calls the SDK and shapes the result. Exported for unit testing.
 *
 * @internal
 */
export async function handleGetPricing(talonic: Talonic): Promise<ToolResult> {
  try {
    const result = await talonic.pricing.get()
    return jsonOk(result)
  } catch (err) {
    return toolError(err)
  }
}

export function registerGetPricing(server: McpServer, getTalonic: () => Talonic): void {
  server.registerTool(
    "talonic_get_pricing",
    {
      title: "Get Talonic Pricing",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        title: "Get Talonic Pricing",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => handleGetPricing(getTalonic()),
  )
}
