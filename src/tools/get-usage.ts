import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Talonic } from "@talonic/node"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"

const DESCRIPTION = [
  "Read the workspace's per-function credit consumption over a trailing window: where the credits actually went.",
  "",
  "USE WHEN: the user asks what they have spent credits on, or you want to see which function (extraction, structuring, intelligence ops) dominates spend.",
  "NOT FOR: the remaining balance (use talonic_get_balance) or per-unit rates (use talonic_get_pricing).",
  "ARGS: days (optional, default 30, clamped 1-365).",
  "RETURNS: period_days, total_credits, and by_function[] — each { operation_type, operations, credits }, highest spend first.",
].join("\n")

const inputSchema = {
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe("Trailing window in days (default 30)."),
}

const outputSchema = {
  period_days: z.number().describe("Length of the reporting window in days."),
  total_credits: z.number().describe("Total credits consumed across all functions in the window."),
  by_function: z
    .array(
      z.object({
        operation_type: z.string().describe("Platform function / billable operation type."),
        operations: z.number().describe("Number of charged operations of this type."),
        credits: z.number().describe("Total credits consumed by this function."),
      }),
    )
    .describe("Per-function breakdown, highest spend first."),
}

/**
 * Pure handler. Calls the SDK and shapes the result. Exported for unit testing.
 *
 * @internal
 */
export async function handleGetUsage(talonic: Talonic, days?: number): Promise<ToolResult> {
  try {
    const result = await talonic.usage.getByFunction(days)
    return jsonOk(result)
  } catch (err) {
    return toolError(err)
  }
}

export function registerGetUsage(server: McpServer, getTalonic: () => Talonic): void {
  server.registerTool(
    "talonic_get_usage",
    {
      title: "Get Talonic Usage",
      description: DESCRIPTION,
      inputSchema,
      outputSchema,
      annotations: {
        title: "Get Talonic Usage",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args: { days?: number }) => handleGetUsage(getTalonic(), args.days),
  )
}
