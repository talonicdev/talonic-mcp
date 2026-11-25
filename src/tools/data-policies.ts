import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, probeAccessState, runTool } from "./_http.js"
import { zUuid, type ToolResult } from "./_shared.js"

/**
 * Data policy tools: check, preview, publish and run a data policy (the
 * rules that normalise a structuring run's values).
 *
 * All tools hit `/v1/data-policies/*` with the caller's bearer; the platform
 * owns every rule (scopes, workspace role) per call.
 *
 * Loop: talonic_data_policy_check → talonic_data_policy_preview →
 * talonic_data_policy_publish → talonic_data_policy_run, then follow the run
 * on GET /v1/resolutions/{id}.
 */

const write = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

/** True when the caller's credential can read data policies (tools are listed only then). */
export async function probeDataPoliciesAccess(token: string, baseUrl?: string): Promise<boolean> {
  return (
    (await probeAccessState(token, baseUrl, "/v1/data-policies", () => true, { limit: 1 })) === true
  )
}

const ADMIN = "an Admin of the workspace (else 403 `insufficient_role`)."

const D = {
  check: `Check a data policy's latest version and prepare it to run; answers \`{id, status: "compiled", rule_count}\`. A rule that does not check out is a 400 naming it. USE WHEN the user edited a policy and wants to know it is valid. Needs \`specs:write\` and ${ADMIN} NOT FOR: seeing what the policy does to a record (talonic_data_policy_preview).`,
  preview: `Preview a data policy's latest version on one record set without writing anything: one sample record as the policy would leave it and how many records the set holds (\`{ok, sample, total_records}\`). A rule that fails on the record answers \`ok: false\` with the error. A 504 means the preview took over 5 seconds: retry. USE WHEN the user wants to see the effect before publishing. Needs \`specs:write\` and ${ADMIN} NOT FOR: applying it to a whole run (talonic_data_policy_run).`,
  publish: `Publish a data policy's latest checked version and make it the one runs use. Send \`expected_version\` (the version you read): if the policy changed since, the answer is 409 \`revision_conflict\`; read again before retrying. A script rule with a syntax error is a 400 \`POLICY_SCRIPT_SYNTAX_ERROR\` naming the line. USE WHEN the user wants runs to use the current version. Confirm with the user first. Needs \`specs:write\` and ${ADMIN} NOT FOR: checking without publishing (talonic_data_policy_check).`,
  run: `Apply a data policy's published version to a completed structuring run and start it; answers 202 with the new run. Follow it on GET /v1/resolutions/{id} and read its rows on GET /v1/resolutions/{id}/results. 409 \`not_published\` when the policy has no published version (publish it first). USE WHEN the user wants a run's values normalised by the policy. Needs \`runs:write\` and ${ADMIN} NOT FOR: a preview on one record (talonic_data_policy_preview).`,
}

const policyId = () => zUuid().describe("The data policy id (from GET /v1/data-policies)")

/**
 * Register the four `talonic_data_policy_*` tools.
 *
 * @public
 */
export function registerDataPolicyTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  const tools: Array<
    [
      string,
      string,
      string,
      Record<string, z.ZodTypeAny>,
      typeof write,
      (a: any) => Promise<ToolResult>,
    ]
  > = [
    [
      "talonic_data_policy_check",
      "Check a data policy",
      D.check,
      { data_policy_id: policyId() },
      write,
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `/v1/data-policies/${encodeURIComponent(a.data_policy_id)}/compile`,
          ),
        ),
    ],
    [
      "talonic_data_policy_preview",
      "Preview a data policy",
      D.preview,
      {
        data_policy_id: policyId(),
        record_set_id: zUuid().describe("The record set to preview on"),
        sample_record_id: z
          .string()
          .optional()
          .describe("The record to show; the first one when absent"),
      },
      { ...write, readOnlyHint: true },
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `/v1/data-policies/${encodeURIComponent(a.data_policy_id)}/test`,
            {
              body: {
                record_set_id: a.record_set_id,
                ...(a.sample_record_id !== undefined
                  ? { sample_record_id: a.sample_record_id }
                  : {}),
              },
            },
          ),
        ),
    ],
    [
      "talonic_data_policy_publish",
      "Publish a data policy",
      D.publish,
      {
        data_policy_id: policyId(),
        expected_version: z.number().int().min(1).optional().describe("The version you read"),
      },
      { ...write, idempotentHint: false },
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `/v1/data-policies/${encodeURIComponent(a.data_policy_id)}/publish`,
            {
              body:
                a.expected_version !== undefined ? { expected_version: a.expected_version } : {},
            },
          ),
        ),
    ],
    [
      "talonic_data_policy_run",
      "Run a data policy",
      D.run,
      {
        data_policy_id: policyId(),
        source_run_id: zUuid().describe("The completed structuring run to apply the policy to"),
        user_schema_id: zUuid()
          .optional()
          .describe("Write against another schema than the source run's"),
      },
      { ...write, idempotentHint: false },
      (a) =>
        runTool(() =>
          apiJson(
            getToken,
            baseUrl,
            "POST",
            `/v1/data-policies/${encodeURIComponent(a.data_policy_id)}/runs`,
            {
              body: {
                source_run_id: a.source_run_id,
                ...(a.user_schema_id !== undefined ? { user_schema_id: a.user_schema_id } : {}),
              },
            },
          ),
        ),
    ],
  ]
  for (const [name, title, description, inputSchema, annotations, handler] of tools) {
    server.registerTool(
      name,
      { title, description, inputSchema, annotations: { title, ...annotations } },
      async (args: unknown) => handler(args) as Promise<any>,
    )
  }
}
