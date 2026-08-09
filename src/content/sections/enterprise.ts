import type { RawSection } from "../types"

// ---------------------------------------------------------------------------
// Enterprise sections — access control, self-hosted deployments, audit
// logging, and server-side integration for custom agents.
//
// ⚠ DRAFT STATUS: verified against the platform codebase on 2026-08-09
// (packages/api: api/, auth/, oauth-server/, compartments/, filter/,
// records/). Two kinds of markers remain and must be resolved before this
// file ships to talonic.com:
//   [CONFIRM: …]     — a business/deployment fact code cannot answer.
//   [PRODUCT GAP: …] — the platform does not do this yet; either ship the
//                      capability or reword the section. Do NOT publish the
//                      claim as-is.
// Grep for "[CONFIRM" and "[PRODUCT GAP" to find all open items.
// ---------------------------------------------------------------------------

export const sections: RawSection[] = [
  // -------------------------------------------------------------------------
  // Access Control & Permissions
  // -------------------------------------------------------------------------
  {
    slug: "access-control",
    parentSlug: "enterprise",
    title: "Access Control & Permissions",
    seoTitle: "MCP Access Control & Permissions — Talonic",
    description:
      "How Talonic workspace isolation and API key scopes apply to MCP tool calls, what an agent's credential can and cannot reach, and what happens on out-of-scope requests.",
    content: [
      {
        type: "paragraph",
        text: "The MCP server enforces no permissions of its own — and that is the point. It is a stateless protocol adapter: every tool call is translated into a request against the Talonic platform API, carrying the caller's own credential. Access control is evaluated by the platform on every request. There is no separate permission model for agents; an agent connected through MCP can never see more than the credential it presents is allowed to see.",
      },
      {
        type: "heading",
        level: 3,
        id: "access-control-credentials",
        text: "What the permissions attach to",
      },
      {
        type: "paragraph",
        text: "MCP calls authenticate with one of two credential types. A **Talonic API key** (`tlnc_...`) is bound to exactly one workspace — it cannot span workspaces — and carries a set of scopes granted at creation: `read`, `write`, `extract`, `usage`, and operational scopes. A key with only `read` cannot extract, upload, or save schemas. An **OAuth 2.1 access token** is issued to an individual user after verifying their active workspace membership; on the API surface it authorizes with the same shape as a key — the user's workspace plus coarse scopes. In both cases the credential travels with every individual tool call — the hosted MCP server holds no session state and no ambient permissions.",
      },
      {
        type: "heading",
        level: 3,
        id: "access-control-layers",
        text: "The enforced boundary",
      },
      {
        type: "paragraph",
        text: "Two controls apply to every MCP call. **Workspace isolation:** every query the platform runs is scoped to the credential's workspace; documents, schemas, fields, and extractions of other workspaces are unreachable by construction, not by filtering after the fact. **Scope enforcement:** each endpoint declares required scopes, and a call with a credential missing the scope is rejected with an explicit `403 insufficient_scope` error. Read tools (`talonic_search`, `talonic_filter`, `talonic_get_document`, `talonic_list_schemas`) require `read`; write-capable tools (`talonic_extract`, `talonic_save_schema`, `talonic_request_upload`) require `write` or `extract`.",
      },
      {
        type: "paragraph",
        text: "Within a workspace, **compartments** provide need-to-know restriction below the workspace boundary: a workspace admin can bind users to compartments scoped to individual documents, document types, or sources, and non-admin members outside a compartment cannot list, read, or export its documents in the application.",
      },
      {
        type: "callout",
        variant: "warning",
        text: "[PRODUCT GAP: compartment restrictions are enforced for signed-in application users on document reads, but are not yet applied to API-key or OAuth-authenticated calls on the public API — the surface MCP uses — and not yet to the search/filter endpoints. Until that enforcement ships, an API credential reads workspace-wide. Do not publish this page, and do not tell customers compartments constrain MCP, before the /v1 + filter enforcement lands. Isolation pattern that IS fully enforced today: separate workspaces with per-workspace keys.]",
      },
      {
        type: "callout",
        variant: "info",
        text: "Talonic does not have field-level or sensitivity-classification access control. Document sensitivity tiers exist as classification metadata that agents can filter on, but they do not gate access. If a team must not see a class of documents, put those documents in a separate workspace (fully enforced) or compartment (see gap note above).",
      },
      {
        type: "heading",
        level: 3,
        id: "access-control-out-of-scope",
        text: "Out-of-scope requests: filtering vs. errors",
      },
      {
        type: "paragraph",
        text: "Three behaviors matter to a security review. A **direct lookup** of a resource outside the credential's workspace (for example `talonic_get_document` with a foreign document ID) returns an explicit `404 not found` — deliberately indistinguishable from a nonexistent ID, so out-of-scope resources cannot even be confirmed to exist. A **query** (`talonic_search`, `talonic_filter`) is scoped to the credential's workspace at the SQL level: out-of-scope rows are absent from the result set, not flagged in it, and a query can never leak a count or a name across the boundary. A **missing scope** (a read-only key calling `talonic_extract`) fails with an explicit `403 insufficient_scope` error naming the scope required.",
      },
      {
        type: "heading",
        level: 3,
        id: "access-control-worked-example",
        text: "Worked example: two keys, one query",
      },
      {
        type: "paragraph",
        text: "Consider two workspaces — Clinical and Procurement — each holding documents mentioning the counterparty \"Acme\", and one API key per workspace. The same `talonic_filter` call returns entirely disjoint result sets under the two keys: each key sees only its own workspace's records, and neither response indicates that the other workspace's matches exist.",
      },
      {
        type: "code",
        language: "json",
        title: "Same talonic_filter call, keys from two different workspaces",
        code: `// Request (identical under both keys)
{
  "tool": "talonic_filter",
  "arguments": {
    "filters": [{ "field": "counterparty", "op": "eq", "value": "Acme" }]
  }
}

// key A (Clinical workspace)          // key B (Procurement workspace)
//  → only Clinical documents           //  → only Procurement documents
//  → no indication that Procurement    //  → no indication that Clinical
//    matches exist                     //    matches exist`,
      },
      {
        type: "callout",
        variant: "warning",
        text: "[CONFIRM: run this example against two real workspaces and paste the actual response payloads before publishing. Also reconcile this page with what was committed to MSD on 29 July — if finer-than-workspace control through MCP was implied, that requires the compartment enforcement noted above, not just documentation.]",
      },
    ],
    related: [
      { label: "Audit Logging", slug: "audit-logging" },
      { label: "Get an API Key", slug: "get-api-key" },
      { label: "talonic_filter", slug: "talonic-filter" },
    ],
    faq: [
      {
        question: "Does MCP have its own permission model?",
        answer:
          "No. The MCP server is a stateless adapter; every tool call is authorized by the Talonic platform using the credential the call carries. Agents get exactly the access of the API key or OAuth token they authenticate with — never more.",
      },
      {
        question: "Do permissions attach to the API key or to the calling user?",
        answer:
          "An API key is bound to exactly one workspace and a set of scopes granted at creation. An OAuth 2.1 token is issued to an individual user after verifying workspace membership and authorizes with the same workspace-plus-scopes shape on the API surface.",
      },
      {
        question: "What happens when an agent requests a document it is not allowed to see?",
        answer:
          "A direct lookup outside the credential's workspace returns 404 — indistinguishable from a nonexistent ID. Queries are scoped at the SQL level, so out-of-scope documents are simply absent from results. A call missing a required scope fails with an explicit 403 error.",
      },
      {
        question: "Can one API key access multiple workspaces?",
        answer:
          "No. A key is bound to exactly one workspace at creation and cannot span workspaces. Teams working across workspaces use one key per workspace, which also keeps audit attribution clean.",
      },
    ],
    mentions: [
      "access control",
      "permissions",
      "API key scope",
      "OAuth 2.1",
      "workspace",
      "compartments",
    ],
  },

  // -------------------------------------------------------------------------
  // Self-Hosted & VPC Deployments
  // -------------------------------------------------------------------------
  {
    slug: "self-hosted-mcp",
    parentSlug: "enterprise",
    title: "VPC & On-Premises Deployments",
    seoTitle: "MCP in VPC & On-Premises Deployments — Talonic",
    description:
      "Running the Talonic MCP server inside your own tenant: endpoint addressing, authentication, network requirements, and whether any traffic reaches Talonic-hosted infrastructure.",
    content: [
      {
        type: "paragraph",
        text: "`mcp.talonic.com` is the hosted endpoint for Talonic's shared EU infrastructure. In a dedicated VPC or on-premises deployment, the MCP server runs **inside your tenant**, alongside the platform API it fronts. It is the same open-source package (`@talonic/mcp`) in both cases: a stateless Node service that translates MCP tool calls into requests against a Talonic API base URL. Point it at your in-tenant API endpoint and every byte of document data stays inside your network boundary.",
      },
      {
        type: "heading",
        level: 3,
        id: "self-hosted-endpoint",
        text: "Endpoint addressing",
      },
      {
        type: "paragraph",
        text: "The server ships in the platform deployment bundle and is addressed under your deployment's domain — for a tenant reached at `app.talonic.yourcompany.com`, the MCP endpoint is served alongside it and configured with `TALONIC_BASE_URL` pointing at your in-tenant API. Teams can also run the server themselves from npm (`npx @talonic/mcp`) or the published Docker image, on any host that can reach the in-tenant API.",
      },
      {
        type: "callout",
        variant: "warning",
        text: "[CONFIRM: the actual addressing convention for VPC/on-prem installs — is a hosted-style HTTP endpoint (mcp.<tenant-domain>) part of the standard deployment bundle today, or do customers run the npm/Docker package themselves? State the default and the exact URL pattern.]",
      },
      {
        type: "heading",
        level: 3,
        id: "self-hosted-traffic",
        text: "Does any traffic reach Talonic-hosted infrastructure?",
      },
      {
        type: "paragraph",
        text: "**No.** [CONFIRM: this must be verifiable before publishing — audit the packaged MCP server config for any default that calls out to talonic.com infrastructure: telemetry, version checks, the OAuth authorization-server default (`OAUTH_AUTHORIZATION_SERVER` falls back to `https://api.talonic.com` in code and MUST be overridden to the in-tenant authorization server in the deployment bundle), and npm registry access if launched via npx. If the answer has any caveat, state the caveat here instead of an unqualified no.] In a dedicated deployment, MCP traffic flows from your agents to the in-tenant MCP server to the in-tenant platform API. Document content, extraction results, queries, and API keys do not transit Talonic-operated infrastructure.",
      },
      {
        type: "heading",
        level: 3,
        id: "self-hosted-auth",
        text: "Authentication differences",
      },
      {
        type: "paragraph",
        text: "The authentication model is identical to the hosted setup: every request carries a bearer credential — a workspace API key or an OAuth 2.1 access token. What changes is the issuer: tokens are issued by **your** deployment's authorization server, and SSO flows through your identity provider (Entra ID via OIDC). The MCP server advertises its authorization server through standard OAuth protected-resource metadata (`/.well-known/oauth-protected-resource`), so MCP clients discover the in-tenant issuer automatically.",
      },
      {
        type: "heading",
        level: 3,
        id: "self-hosted-network",
        text: "Network requirements",
      },
      {
        type: "list",
        items: [
          "**Inbound:** agents (desktop clients or server-side agent runtimes) need HTTPS reachability to the in-tenant MCP endpoint — via your VPN, private link, or internal network, per your deployment's networking setup.",
          "**Outbound from the MCP server:** HTTPS to the in-tenant platform API only. No other egress is required at runtime.",
          "**stdio mode needs no inbound port at all:** a locally-launched server (`npx @talonic/mcp` with `TALONIC_BASE_URL` set to your API) only needs outbound HTTPS to the in-tenant API.",
          "[CONFIRM: private link / VPC peering options offered for agent-to-MCP connectivity, and whether the deployment bundle terminates TLS itself or expects the customer's ingress to.]",
        ],
      },
      {
        type: "code",
        language: "json",
        title: "Desktop client config pointing at an in-tenant deployment",
        code: `{
  "mcpServers": {
    "talonic": {
      "command": "npx",
      "args": ["-y", "@talonic/mcp@latest"],
      "env": {
        "TALONIC_API_KEY": "tlnc_your_key_here",
        "TALONIC_BASE_URL": "https://api.talonic.yourcompany.com"
      }
    }
  }
}`,
      },
    ],
    related: [
      { label: "Environment Variables", slug: "env-variables" },
      { label: "Access Control & Permissions", slug: "access-control" },
      { label: "Server-Side Integration", slug: "custom-agents" },
    ],
    faq: [
      {
        question: "Is mcp.talonic.com the only way to use MCP?",
        answer:
          "No. mcp.talonic.com serves Talonic's hosted infrastructure. In VPC and on-premises deployments the same MCP server runs inside your tenant, pointed at your in-tenant API via TALONIC_BASE_URL, so document data never leaves your network boundary.",
      },
      {
        question: "Does a self-hosted MCP server send anything to Talonic?",
        answer:
          "In a dedicated deployment, MCP traffic flows only between your agents, your MCP server, and your in-tenant platform API. [CONFIRM: unqualified no pending the egress audit noted on this page.]",
      },
      {
        question: "How do agents authenticate against a self-hosted MCP server?",
        answer:
          "Exactly as against the hosted one: a workspace API key or an OAuth 2.1 access token as a bearer credential on every request — except tokens are issued by your deployment's own authorization server, with SSO through your identity provider.",
      },
    ],
    mentions: ["VPC", "on-premises", "self-hosted", "TALONIC_BASE_URL", "private link", "egress"],
  },

  // -------------------------------------------------------------------------
  // Audit Logging
  // -------------------------------------------------------------------------
  {
    slug: "audit-logging",
    parentSlug: "enterprise",
    title: "Audit Logging",
    seoTitle: "MCP Audit Logging & Export — Talonic",
    description:
      "Talonic's tamper-evident audit trail — what each record contains, retention and legal holds, export paths, and how MCP agent activity is attributed after the fact.",
    content: [
      {
        type: "callout",
        variant: "warning",
        text: "[PRODUCT GAP — blocks this entire page: public-API calls (the path every MCP tool call takes) do not yet emit audit-trail events. Today the audit trail records application activity and lifecycle events; /v1 requests land only in a separate API request log that captures method and path but not the key identity or the documents touched. Instrumenting /v1 reads into the audit trail — with key ID and affected document IDs — must ship before this page is published or the capability is claimed to a customer. Note: the existing platform Archive docs already overclaim this ('an API call that touches a document produces the same audit event as a click in the UI') and should be corrected in the same pass.]",
      },
      {
        type: "paragraph",
        text: "Talonic keeps a tamper-evident audit trail per workspace: every record is SHA-256 hash-chained to its predecessor, chains are anchored daily, and an integrity-verification endpoint walks the chain on demand. Audit records survive the deletion of what they describe — deleting a document does not delete its history.",
      },
      {
        type: "heading",
        level: 3,
        id: "audit-record-contents",
        text: "What each record contains",
      },
      {
        type: "param-table",
        title: "Audit record fields",
        params: [
          {
            name: "actor_type / actor_id / actor_label",
            type: "string",
            description:
              "The authenticated principal: a user (ID plus email), an API key (key ID, never the secret), or the system. This is the field that turns the audit trail into an agent-attribution tool once /v1 instrumentation lands.",
          },
          {
            name: "action",
            type: "string",
            description:
              "Namespaced action, e.g. `document.viewed`, `document.exported`, `document.deleted`, `hold.applied`, `erasure.executed`.",
          },
          {
            name: "entity_type / entity_id / entity_label",
            type: "string",
            description:
              "The affected resource — for document access, the document ID and filename. Recorded without foreign keys so the record survives deletion of the resource.",
          },
          {
            name: "occurred_at",
            type: "timestamp",
            description: "Server-side timestamp at emission.",
          },
          {
            name: "reason / context",
            type: "object",
            description:
              "Free-text reason where the action carries one (e.g. legal-hold release) and small structured extras. Request payloads and file contents are never stored in the audit trail.",
          },
          {
            name: "prev_hash / event_hash",
            type: "string",
            description:
              "The tamper-evidence chain: each record's hash covers its content plus the previous record's hash.",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "audit-retention-export",
        text: "Retention and export",
      },
      {
        type: "paragraph",
        text: "Audit records are retained for **24 months** by default (a deployment-level setting; dedicated deployments can run a different window). Trimming is suspended entirely for any workspace with an active legal hold. Export is admin-only: a filterable query API (`GET /records/audit-events` — by time range, action, actor, and entity), a CSV export endpoint, and a chain-integrity verification endpoint. The full-tenant export bundle includes the audit log. Streaming delivery to external SIEM systems is on the roadmap; today, SIEM ingestion works by scheduled pulls of the CSV export API.",
      },
      {
        type: "callout",
        variant: "warning",
        text: "[CONFIRM: whether per-tenant audit-retention configuration is a commitment we make for dedicated deployments (the setting is deployment-level today, not per-workspace), and what SIEM integration is actually promised to customers — the CSV-pull pattern is what exists.]",
      },
      {
        type: "heading",
        level: 3,
        id: "audit-attribution",
        text: "Attributing a data point to an agent call",
      },
      {
        type: "paragraph",
        text: "The attribution question an admin actually asks after the fact is: *this value surfaced in an agent's output — which call produced it, under whose credential?* The audit query API filters by entity ID, so `GET /records/audit-events?entity_type=document&entity_id=<uuid>` returns every recorded access to that document with the acting credential and timestamp. [PRODUCT GAP: for MCP traffic this query returns nothing until /v1 reads emit audit events — see the note at the top of this page. The query mechanics, indexes, and admin surface already exist; the missing piece is emission on the public API path.]",
      },
      {
        type: "callout",
        variant: "info",
        text: "One key per agent makes attribution trivial: if each agent identity holds its own API key, the audit trail's actor column is an agent column. See Server-Side Integration for key-handling patterns.",
      },
    ],
    related: [
      { label: "Access Control & Permissions", slug: "access-control" },
      { label: "Server-Side Integration", slug: "custom-agents" },
      { label: "talonic_get_usage", slug: "talonic-get-usage" },
    ],
    faq: [
      {
        question: "Is the Talonic audit trail tamper-evident?",
        answer:
          "Yes. Every record is SHA-256 hash-chained to its predecessor, chains are anchored daily, and an integrity-verification endpoint walks the chain on demand. Audit records survive deletion of the resources they describe.",
      },
      {
        question: "How long are audit records kept?",
        answer:
          "24 months by default, as a deployment-level setting. Workspaces under an active legal hold are excluded from trimming entirely — audit history is preserved for as long as the hold stands.",
      },
      {
        question: "How do I get Talonic audit logs into my SIEM?",
        answer:
          "Via scheduled pulls of the admin-only CSV export API (GET /records/audit-events/export), filterable by time range, action, actor, and entity. Streaming SIEM delivery is on the roadmap.",
      },
    ],
    mentions: ["audit logging", "SIEM", "retention", "attribution", "hash chain", "legal hold"],
  },

  // -------------------------------------------------------------------------
  // Server-Side Integration (custom agents)
  // -------------------------------------------------------------------------
  {
    slug: "custom-agents",
    parentSlug: "enterprise",
    title: "Server-Side Integration",
    seoTitle: "MCP from Custom Agents, Server-Side — Talonic",
    description:
      "Connecting to the Talonic MCP server from your own agent stack: minimal Python and TypeScript clients, running in containers or serverless functions, and API key handling.",
    content: [
      {
        type: "paragraph",
        text: "The desktop clients on the install pages are one way to consume MCP — not the only one. The hosted server speaks standard Streamable HTTP, so any MCP client library can connect from your own agent runtime: a Python service, a TypeScript worker, a container, or a serverless function. Authentication is a single `Authorization: Bearer` header carrying a Talonic API key; there is no session to establish and nothing to install server-side.",
      },
      {
        type: "heading",
        level: 3,
        id: "custom-agents-python",
        text: "Python",
      },
      {
        type: "code",
        language: "python",
        title: "Minimal Python client (official mcp SDK)",
        code: `import asyncio
import os

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

TALONIC_MCP_URL = os.environ.get("TALONIC_MCP_URL", "https://mcp.talonic.com/mcp")
API_KEY = os.environ["TALONIC_API_KEY"]  # inject via your secret manager


async def main() -> None:
    headers = {"Authorization": f"Bearer {API_KEY}"}
    async with streamablehttp_client(TALONIC_MCP_URL, headers=headers) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            print([t.name for t in tools.tools])  # the eleven talonic_* tools

            result = await session.call_tool(
                "talonic_search",
                {"query": "termination clauses in supplier contracts"},
            )
            print(result.content)


asyncio.run(main())`,
      },
      {
        type: "heading",
        level: 3,
        id: "custom-agents-typescript",
        text: "TypeScript",
      },
      {
        type: "code",
        language: "typescript",
        title: "Minimal TypeScript client (@modelcontextprotocol/sdk)",
        code: `import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

const url = process.env.TALONIC_MCP_URL ?? "https://mcp.talonic.com/mcp"
const apiKey = process.env.TALONIC_API_KEY! // inject via your secret manager

const transport = new StreamableHTTPClientTransport(new URL(url), {
  requestInit: { headers: { Authorization: \`Bearer \${apiKey}\` } },
})

const client = new Client({ name: "my-agent", version: "1.0.0" })
await client.connect(transport)

const tools = await client.listTools()
console.log(tools.tools.map((t) => t.name)) // the eleven talonic_* tools

const result = await client.callTool({
  name: "talonic_filter",
  arguments: { filters: [{ field: "counterparty", op: "eq", value: "Acme" }] },
})
console.log(result.content)`,
      },
      {
        type: "paragraph",
        text: "If your agent is built on the Claude API, you can skip the client code entirely: pass the Talonic server in the `mcp_servers` array of a Messages API call and the model calls the tools directly, with your API key as the `authorization_token`.",
      },
      {
        type: "heading",
        level: 3,
        id: "custom-agents-containers",
        text: "Containers and serverless",
      },
      {
        type: "paragraph",
        text: "Because the transport is plain HTTPS and every request is independently authenticated, the client patterns above work unchanged inside a container or a serverless function — there is no long-lived connection that a cold start would break. Open the session, make the calls, close it. For latency-sensitive paths, keep the MCP session open for the lifetime of a warm function instance rather than per request. Alternatively, a container can run its own private server instance (`npx @talonic/mcp` over stdio, or the published Docker image) — useful when you want the MCP endpoint itself inside your network boundary; see VPC & On-Premises Deployments.",
      },
      {
        type: "heading",
        level: 3,
        id: "custom-agents-keys",
        text: "Key handling",
      },
      {
        type: "list",
        items: [
          "**Inject, never bake:** keys enter the runtime as environment variables or through your secret manager (AWS Secrets Manager, Azure Key Vault, Vault) — never in an image, a repo, or agent prompt text.",
          "**Grant minimal scopes:** keys carry scopes fixed at creation. An agent that only queries needs a `read`-only key; reserve `write` and `extract` for agents that ingest. A read-only key calling a write tool fails with an explicit 403.",
          "**One key per agent identity:** give each distinct agent its own key rather than sharing one per team. Scopes stay minimal, a compromised agent is revocable in isolation, and each key becomes an attribution handle for that agent's activity.",
          "**Rotation is mint-then-revoke:** key management is fully programmatic — `GET/POST/DELETE /v1/account/keys` (a `write`-scoped key can mint and revoke keys). Any number of keys can be active simultaneously, so zero-downtime rotation is: mint the successor, roll it out, revoke the predecessor. [CONFIRM: on enterprise plans, dashboard key creation is managed by Talonic — document how enterprise customers request or self-serve keys in practice.]",
          "**Guard the `write` scope:** because a `write`-scoped key can mint further keys, treat `write` keys like credentials-issuing credentials — store them with the same care as the workspace itself, and prefer `read`-only keys everywhere possible.",
        ],
      },
      {
        type: "callout",
        variant: "info",
        text: "Large files from server-side agents: tool-call arguments on hosted platforms cap at roughly 32 KB decoded, so do not inline big files as base64. Use `talonic_request_upload` to get an upload URL, or `file_url` pointing at storage your deployment can reach.",
      },
    ],
    related: [
      { label: "VPC & On-Premises Deployments", slug: "self-hosted-mcp" },
      { label: "Audit Logging", slug: "audit-logging" },
      { label: "Environment Variables", slug: "env-variables" },
    ],
    faq: [
      {
        question: "Can I use Talonic MCP without a desktop client?",
        answer:
          "Yes. The hosted server speaks standard Streamable HTTP, so any MCP client library — Python's mcp package, the TypeScript @modelcontextprotocol/sdk, or the Claude API's mcp_servers option — connects from your own service with a Bearer API key.",
      },
      {
        question: "Does MCP work from serverless functions?",
        answer:
          "Yes. Every request is independently authenticated over HTTPS, so there is no long-lived state a cold start would break. Open a session, call tools, close it — or hold the session open for the lifetime of a warm instance.",
      },
      {
        question: "How do I rotate an agent's API key without downtime?",
        answer:
          "Mint the replacement key via POST /v1/account/keys, deploy it to the agent, then revoke the old key via DELETE /v1/account/keys/:keyId. Multiple keys can be active at once, so there is no gap.",
      },
      {
        question: "How should agents store the Talonic API key?",
        answer:
          "Inject it at runtime via environment variables or a secret manager, never in images or repos. Give each agent identity its own minimally-scoped key — read-only unless the agent ingests — so a compromise is contained and revocable in isolation.",
      },
    ],
    mentions: [
      "custom agents",
      "Python",
      "TypeScript",
      "serverless",
      "Streamable HTTP",
      "API key rotation",
      "scopes",
    ],
  },
]
