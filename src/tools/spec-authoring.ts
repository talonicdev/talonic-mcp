import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { apiJson, buildUrl, runTool } from "./_http.js"
import { zUuid, type ToolResult } from "./_shared.js"

/**
 * Spec authoring tools: create a Spec, edit its draft, check it, test it on
 * sample documents, publish it and roll it back, over `/v1/specs/*` with the
 * caller's bearer. The platform decides every call: the credential needs
 * `specs:read` / `specs:write` (and `runs:write` to test), and the person
 * behind it may do only what they may do in the Spec editor of the workspace.
 *
 * Flow: talonic_spec_create → talonic_spec_check → talonic_spec_edit (fix)
 * → talonic_spec_test → talonic_get_run / talonic_get_run_results →
 * talonic_spec_publish → talonic_run_spec. talonic_spec_rollback restores an
 * earlier version as a new one.
 *
 * Registered only when `probeSpecAuthoringAccess` passes (the platform serves
 * `GET /v1/specs/authoring` to this credential), so a deployment or a
 * credential without Spec authoring never lists tools that would fail.
 */

const BASE = "/v1/specs"
const sid = (a: { spec_id: string }) => `${BASE}/${encodeURIComponent(a.spec_id)}`

/**
 * True when the platform serves Spec authoring to this credential. Never
 * throws; any failure hides the tools.
 */
export async function probeSpecAuthoringAccess(token: string, baseUrl?: string): Promise<boolean> {
  try {
    const res = await fetch(buildUrl(baseUrl, `${BASE}/authoring`), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** A minimal document the platform accepts; shown in descriptions so a model starts from a valid shape. */
const DOC_SHAPE =
  '{"format":1,"name":"Invoices","fields":[{"field_id":"f-vendor","name":"vendor_name","data_type":"string","description":"Legal name of the issuing company"},{"field_id":"f-total","name":"total_amount","data_type":"number"}],"stages":[{"id":"s-source","type":"source"},{"id":"s-extract","type":"extraction","config":{}},{"id":"s-deliver","type":"deliver"}],"gates":[],"policies":[]}'

const CREATE_DESCRIPTION = [
  "Create a Spec (a saved extraction pipeline: the fields to capture and the steps that produce them). Not live until published.",
  "",
  "USE WHEN: the user wants a new pipeline for a kind of document, or wants to bring in a Spec JSON export or an existing schema.",
  "ARGS: `name`; optional `description`; then ONE of: `doc` (a complete Spec document), `spec_json` (a Spec JSON export from the editor), `schema_id` (an existing schema to turn into a Spec), or nothing (empty draft).",
  `A minimal valid doc: ${DOC_SHAPE}. Give every field a stable, unique field_id and a clear description of what to capture.`,
  "RETURNS: { spec_id, revision, doc, has_unpublished_changes, links } (or { spec_id, issues } for an import). Next: talonic_spec_check.",
].join("\n")

const EDIT_DESCRIPTION = [
  "Read or change a Spec's draft.",
  "",
  "With only `spec_id`: returns the draft { revision, doc, published_version, has_unpublished_changes }. Read it before every edit.",
  "With `doc` + `revision`: replaces the WHOLE draft. `revision` is the one you read; a 409 means someone saved in between, so read again and re-apply. Keep each field's field_id when you change a field (ground truth and rules point at it); replacing most fields needs `allow_field_reset: true`.",
  "With `name` / `description`: renames the Spec.",
  "Saving never changes what runs: publish does (talonic_spec_publish).",
].join("\n")

const CHECK_DESCRIPTION = [
  "Check a Spec without saving anything: the draft, or `doc` before you save it.",
  "RETURNS: { valid, errors[], warnings[] }, each { code, message, path, field_id, stage_id }. A draft with errors cannot be published; warnings do not block. Free.",
].join("\n")

const TEST_DESCRIPTION = [
  "Test the draft on sample documents: a preview run that is never delivered to the workspace's destinations. A draft with unpublished changes is published first, as in the Spec editor. Uses credits.",
  "",
  "ARGS: `spec_id`; `document_ids` (up to 20 documents already in the workspace, e.g. from talonic_extract or an upload) or none to use the pinned samples; `pin` true also pins the given documents as samples.",
  "RETURNS: { pipeline_id, version, status, links }. Then poll talonic_get_run with the pipeline_id and read rows with their evidence with talonic_get_run_results.",
  "A 422 listing issues: tell the user, and retry with `acknowledge_issues: true` only if they agree.",
].join("\n")

const PUBLISH_DESCRIPTION = [
  "Publish the draft as the next version: new runs use it from now on. Changes what runs for real; call only when the user asks to publish.",
  "",
  "ARGS: `spec_id`; `expected_draft_revision` (the revision you checked, recommended); `acknowledge_issues` only after the user agreed to the issues a previous attempt listed.",
  "Refused (nothing published) when the draft has errors or unacknowledged issues. RETURNS: { version, schema_id, active, activation_pending, issues }. Run it with talonic_run_spec.",
].join("\n")

const ROLLBACK_DESCRIPTION = [
  "Go back to an earlier published version: its document is published again as a NEW version (history is kept). Changes what runs for real; call only when the user asks.",
  "",
  "ARGS: `spec_id`, `version`. With `preview: true` nothing changes: returns what differs between the current version and `version`, so the user can decide.",
  "RETURNS: { version, restored_from, active, issues } or, with preview, { from, to, diff }.",
].join("\n")

const write = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const
/** Changes what runs for real: clients ask the person before calling. */
const destructive = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const
const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

const zDoc = z.record(z.string(), z.unknown())

export interface SpecCreateArgs {
  name: string
  description?: string
  doc?: Record<string, unknown>
  spec_json?: Record<string, unknown>
  schema_id?: string
}

/** @internal Exported for unit testing. */
export async function handleSpecCreate(
  getToken: () => string,
  baseUrl: string | undefined,
  a: SpecCreateArgs,
): Promise<ToolResult> {
  const sources = [a.doc, a.spec_json, a.schema_id].filter((v) => v !== undefined).length
  if (sources > 1) {
    return {
      isError: true,
      content: [{ type: "text", text: "Pass at most one of doc, spec_json or schema_id." }],
    }
  }
  return runTool(async () => {
    if (a.spec_json || a.schema_id) {
      const imported = await apiJson<{ spec_id: string }>(
        getToken,
        baseUrl,
        "POST",
        `${BASE}/import`,
        {
          body: a.spec_json ? { spec_json: a.spec_json } : { schema_id: a.schema_id },
        },
      )
      // An import names itself from the export or the schema; apply the requested name.
      if (a.name || a.description) {
        await apiJson(
          getToken,
          baseUrl,
          "PATCH",
          `${BASE}/${encodeURIComponent(imported.spec_id)}`,
          {
            body: { name: a.name, ...(a.description ? { description: a.description } : {}) },
          },
        )
      }
      return imported
    }
    return apiJson(getToken, baseUrl, "POST", BASE, {
      body: {
        name: a.name,
        ...(a.description ? { description: a.description } : {}),
        ...(a.doc ? { doc: a.doc } : {}),
      },
    })
  })
}

export interface SpecEditArgs {
  spec_id: string
  doc?: Record<string, unknown>
  revision?: number
  allow_field_reset?: boolean
  name?: string
  description?: string
}

/** @internal Exported for unit testing. */
export async function handleSpecEdit(
  getToken: () => string,
  baseUrl: string | undefined,
  a: SpecEditArgs,
): Promise<ToolResult> {
  if (a.doc && a.revision === undefined) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "Pass the draft `revision` you read with talonic_spec_edit (spec_id only) together with `doc`.",
        },
      ],
    }
  }
  return runTool(async () => {
    let renamed: unknown
    if (a.name !== undefined || a.description !== undefined) {
      renamed = await apiJson(getToken, baseUrl, "PATCH", sid(a), {
        body: {
          ...(a.name !== undefined ? { name: a.name } : {}),
          ...(a.description !== undefined ? { description: a.description } : {}),
        },
      })
    }
    if (a.doc) {
      return apiJson(getToken, baseUrl, "PUT", `${sid(a)}/draft`, {
        body: {
          doc: a.doc,
          revision: a.revision,
          ...(a.allow_field_reset ? { allow_field_reset: true } : {}),
        },
      })
    }
    return renamed ?? apiJson(getToken, baseUrl, "GET", `${sid(a)}/draft`)
  })
}

export interface SpecTestArgs {
  spec_id: string
  document_ids?: string[]
  pin?: boolean
  acknowledge_issues?: boolean
}

/** @internal Exported for unit testing. */
export async function handleSpecTest(
  getToken: () => string,
  baseUrl: string | undefined,
  a: SpecTestArgs,
): Promise<ToolResult> {
  return runTool(async () => {
    if (a.pin && a.document_ids?.length) {
      for (const document_id of a.document_ids) {
        await apiJson(getToken, baseUrl, "POST", `${sid(a)}/samples`, {
          body: { document_id, ...(a.acknowledge_issues ? { acknowledge_issues: true } : {}) },
        })
      }
    }
    return apiJson(getToken, baseUrl, "POST", `${sid(a)}/test`, {
      body: {
        ...(a.document_ids?.length ? { document_ids: a.document_ids } : {}),
        ...(a.acknowledge_issues ? { acknowledge_issues: true } : {}),
      },
    })
  })
}

export interface SpecRollbackArgs {
  spec_id: string
  version: number
  preview?: boolean
  acknowledge_issues?: boolean
}

/** @internal Exported for unit testing. */
export async function handleSpecRollback(
  getToken: () => string,
  baseUrl: string | undefined,
  a: SpecRollbackArgs,
): Promise<ToolResult> {
  return runTool(async () => {
    if (a.preview) {
      const versions = await apiJson<{ data?: Array<{ version: number }> }>(
        getToken,
        baseUrl,
        "GET",
        `${sid(a)}/versions`,
      )
      const head = versions.data?.[0]?.version
      if (head === undefined) throw new Error("This Spec has no published version yet.")
      return apiJson(getToken, baseUrl, "GET", `${sid(a)}/versions/${head}/diff/${a.version}`)
    }
    return apiJson(getToken, baseUrl, "POST", `${sid(a)}/versions/${a.version}/rollback`, {
      body: a.acknowledge_issues ? { acknowledge_issues: true } : {},
    })
  })
}

/** Register the six Spec authoring tools. @internal */
export function registerSpecAuthoringTools(
  server: McpServer,
  getToken: () => string,
  baseUrl?: string,
): void {
  server.registerTool(
    "talonic_spec_create",
    {
      title: "Create a pipeline",
      description: CREATE_DESCRIPTION,
      inputSchema: {
        name: z.string().min(1).max(300),
        description: z.string().max(5000).optional(),
        doc: zDoc.optional().describe("A complete Spec document"),
        spec_json: zDoc.optional().describe("A Spec JSON export from the Spec editor"),
        schema_id: zUuid().optional().describe("An existing schema to turn into a Spec"),
      },
      annotations: { title: "Create a pipeline", ...write },
    },
    async (args) => handleSpecCreate(getToken, baseUrl, args as SpecCreateArgs),
  )
  server.registerTool(
    "talonic_spec_edit",
    {
      title: "Edit a pipeline draft",
      description: EDIT_DESCRIPTION,
      inputSchema: {
        spec_id: zUuid(),
        doc: zDoc.optional().describe("The complete new draft document"),
        revision: z.number().int().min(0).optional().describe("The draft revision you read"),
        allow_field_reset: z.boolean().optional(),
        name: z.string().min(1).max(300).optional(),
        description: z.string().max(5000).optional(),
      },
      annotations: { title: "Edit a pipeline draft", ...write },
    },
    async (args) => handleSpecEdit(getToken, baseUrl, args as SpecEditArgs),
  )
  server.registerTool(
    "talonic_spec_check",
    {
      title: "Check a pipeline",
      description: CHECK_DESCRIPTION,
      inputSchema: {
        spec_id: zUuid(),
        doc: zDoc.optional().describe("A document to check instead of the saved draft"),
      },
      annotations: { title: "Check a pipeline", ...readOnly },
    },
    async (args) => {
      const a = args as { spec_id: string; doc?: Record<string, unknown> }
      return runTool(() =>
        apiJson(getToken, baseUrl, "POST", `${sid(a)}/check`, {
          body: a.doc ? { doc: a.doc } : {},
        }),
      )
    },
  )
  server.registerTool(
    "talonic_spec_test",
    {
      title: "Test a pipeline on samples",
      description: TEST_DESCRIPTION,
      inputSchema: {
        spec_id: zUuid(),
        document_ids: z.array(zUuid()).min(1).max(20).optional(),
        pin: z.boolean().optional().describe("Also pin document_ids as the Spec's samples"),
        acknowledge_issues: z.boolean().optional(),
      },
      annotations: { title: "Test a pipeline on samples", ...write },
    },
    async (args) => handleSpecTest(getToken, baseUrl, args as SpecTestArgs),
  )
  server.registerTool(
    "talonic_spec_publish",
    {
      title: "Publish a pipeline",
      description: PUBLISH_DESCRIPTION,
      inputSchema: {
        spec_id: zUuid(),
        expected_draft_revision: z.number().int().min(0).optional(),
        acknowledge_issues: z.boolean().optional(),
      },
      annotations: { title: "Publish a pipeline", ...destructive },
    },
    async (args) => {
      const a = args as {
        spec_id: string
        expected_draft_revision?: number
        acknowledge_issues?: boolean
      }
      return runTool(() =>
        apiJson(getToken, baseUrl, "POST", `${sid(a)}/publish`, {
          body: {
            ...(a.expected_draft_revision !== undefined
              ? { expected_draft_revision: a.expected_draft_revision }
              : {}),
            ...(a.acknowledge_issues ? { acknowledge_issues: true } : {}),
          },
        }),
      )
    },
  )
  server.registerTool(
    "talonic_spec_rollback",
    {
      title: "Roll back a pipeline",
      description: ROLLBACK_DESCRIPTION,
      inputSchema: {
        spec_id: zUuid(),
        version: z.number().int().min(1),
        preview: z.boolean().optional().describe("Only show what would change"),
        acknowledge_issues: z.boolean().optional(),
      },
      annotations: { title: "Roll back a pipeline", ...destructive },
    },
    async (args) => handleSpecRollback(getToken, baseUrl, args as SpecRollbackArgs),
  )
}
