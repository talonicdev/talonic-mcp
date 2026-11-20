import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { jsonOk, toolError, type ToolResult } from "./_shared.js"
import { resolveFetch } from "./_http.js"
import { widgetToolMeta } from "../widgets/types.js"

const LIST_DESCRIPTION = [
  "List the workspace's accounts: the companies (portfolio companies, clients, entities) whose documents it keeps apart.",
  "",
  "USE WHEN: before uploading a company's files (pass its name as `account` on talonic_request_upload), or to see which companies exist.",
  "NOT FOR: listing documents (talonic_search / talonic_filter) · creating an account (talonic_create_account). Not a warm-up before answering a question about the documents: call talonic_ask for that.",
  "ARGS: none.",
  "RETURNS: data[] of { id, name, aliases[], description, created_at }.",
].join("\n")

const CREATE_DESCRIPTION = [
  "Create an account: a company whose documents the workspace keeps apart, so answers about it never mix in another company's files.",
  "",
  "USE WHEN: the user is about to add files for a company that talonic_list_accounts does not show yet.",
  "NOT FOR: tagging single documents · a company that already exists (reuse its name).",
  "ARGS: name; optional aliases[] (other names it appears under, e.g. its legal name), description.",
  "RETURNS: { id, name, aliases[], description, created_at }. 409 when the name is taken.",
].join("\n")

const accountShape = {
  id: z.string().describe("Account id."),
  name: z.string().describe("Company name."),
  aliases: z.array(z.string()).describe("Other names the company appears under."),
  description: z.string().nullable().optional().describe("Free-text description."),
  created_at: z.string().optional().describe("ISO 8601 creation time."),
}

async function call(
  getToken: () => string,
  baseUrl: string | undefined,
  method: "GET" | "POST",
  body?: unknown,
): Promise<ToolResult> {
  try {
    const res = await resolveFetch(getToken)(
      `${baseUrl ?? "https://api.talonic.com"}/v1/accounts`,
      {
        method,
        headers: {
          Authorization: `Bearer ${getToken()}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    )
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return toolError(
        new Error(`Talonic API error: HTTP ${res.status}${text ? ` — ${text}` : ""}`),
      )
    }
    return jsonOk(await res.json())
  } catch (err) {
    return toolError(err)
  }
}

/** @internal Exported for tests. */
export const handleListAccounts = (getToken: () => string, baseUrl?: string) =>
  call(getToken, baseUrl, "GET")

/** @internal Exported for tests. */
export const handleCreateAccount = (
  getToken: () => string,
  baseUrl: string | undefined,
  args: { name: string; aliases?: string[]; description?: string },
) => call(getToken, baseUrl, "POST", args)

/** Registers talonic_list_accounts and talonic_create_account. */
export function registerAccounts(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_list_accounts",
    {
      title: "List companies",
      description: LIST_DESCRIPTION,
      inputSchema: {},
      outputSchema: { data: z.array(z.object(accountShape)).describe("The workspace's accounts.") },
      _meta: widgetToolMeta("listAccounts"),
      annotations: {
        title: "List companies",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => handleListAccounts(getToken, baseUrl),
  )
  server.registerTool(
    "talonic_create_account",
    {
      title: "Add a company",
      description: CREATE_DESCRIPTION,
      inputSchema: {
        name: z.string().min(1).max(255).describe("Company name, e.g. 'Filu'."),
        aliases: z
          .array(z.string().max(255))
          .max(50)
          .optional()
          .describe("Other names, e.g. ['Filu Group GmbH']."),
        description: z.string().max(2000).optional().describe("Optional description."),
      },
      outputSchema: accountShape,
      _meta: widgetToolMeta("createAccount"),
      annotations: {
        title: "Add a company",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) =>
      handleCreateAccount(
        getToken,
        baseUrl,
        args as { name: string; aliases?: string[]; description?: string },
      ),
  )
}
