import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { WIDGET_URIS } from "../widgets/types.js"

const DESCRIPTION = [
  "STATUS: stable.",
  "",
  "Read the user's current Talonic credit balance, EUR value, 30-day burn rate,",
  "projected runway, tier, and next-tier-reset timestamp. Use this to make budget-",
  "aware decisions before kicking off large batches or re-extractions.",
  "",
  "USE WHEN:",
  "- The user asks how many credits or how much budget they have left.",
  "- You are about to run a large or expensive operation (batch extract, re-extract",
  "  many documents) and want to confirm budget headroom first.",
  "- The user asks how long their balance will last at the current rate.",
  "",
  "DO NOT USE WHEN:",
  "- The user just wants the per-call cost of a single extraction (that is already",
  "  on the talonic_extract response under `cost`).",
  "- The user wants to top up credits (route them to the dashboard; auto top-up is",
  "  guarded by a separate scope).",
  "",
  "RESPONSE SHAPE:",
  "- balance_credits: current credit balance.",
  "- balance_eur: current balance in EUR (rounded to two decimals).",
  "- burn_rate_30d_credits: total credits consumed in the trailing 30 days.",
  "- projected_runway_days: days of runway at the current 30-day average burn.",
  "  `-1` indicates no consumption in the trailing window (cannot compute runway).",
  "- tier: API tier of the workspace (`free`, `pro`, `enterprise`, etc.).",
  "- tier_resets_at: ISO 8601 timestamp of the next monthly tier reset.",
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
