import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { WIDGET_URIS } from "../widgets/types.js"

const DESCRIPTION = [
  "Read the workspace's Talonic credit balance, EUR value, tier, 30-day burn, and projected runway.",
  "",
  "USE WHEN: the user asks about credits/budget, or before a large batch when you want to confirm headroom.",
  "NOT FOR: the per-call cost of a single extraction (that is on the talonic_extract response).",
  "ARGS: none.",
  "RETURNS: balance_credits, balance_eur, tier, burn_rate_30d_credits, projected_runway_days (-1 = no recent usage), tier_resets_at.",
].join("\n")

const inputSchema = {}

const outputSchema = {
  balance_credits: z.number().describe("Current credit balance."),
  balance_eur: z.number().describe("Current balance in EUR (two decimals)."),
  burn_rate_30d_credits: z.number().describe("Total credits consumed in the trailing 30 days."),
  projected_runway_days: z
    .number()
    .describe(
      "Projected days of runway at the current 30-day average burn. `-1` when burn is zero (cannot compute).",
    ),
  tier: z.string().describe("API tier of the workspace."),
  tier_resets_at: z.string().describe("ISO 8601 timestamp of the next monthly tier reset."),
}

/**
 * Pure handler. Calls the SDK and shapes the result. Exported for unit
 * testing; the public registration is via `register()` below.
 *
 * @internal
 */
export async function handleGetBalance(talonic: Talonic): Promise<ToolResult> {
  try {
    const result = await talonic.credits.getBalance()
    return jsonOk(result)
  } catch (err) {
    return toolError(err)
  }
}

export function registerGetBalance(server: McpServer, getTalonic: () => Talonic): void {
  server.registerTool(
    "talonic_get_balance",
    {
      title: "Get Talonic Credit Balance",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        title: "Get Talonic Credit Balance",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URIS.getBalance },
        "openai/outputTemplate": WIDGET_URIS.getBalance,
      },
    },
    async () => handleGetBalance(getTalonic()),
  )
}
