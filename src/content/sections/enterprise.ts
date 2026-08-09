import type { RawSection } from "../types"

// ---------------------------------------------------------------------------
// Enterprise sections — access control, self-hosted deployments, audit
// logging, and server-side integration for custom agents.
//
// ⚠ DRAFT STATUS: paragraphs containing "[CONFIRM: ...]" state product
// behavior that has not yet been verified against the platform. Every
// [CONFIRM] marker must be resolved (verified, corrected, or deleted) by a
// platform owner before this file ships to talonic.com. Grep for "[CONFIRM"
// to find all open items.
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
      "How Talonic workspace, document-type, and record-level permissions apply to MCP tool calls, what scope attaches to an API key, and what happens on out-of-scope requests.",
    content: [
      {
        type: "paragraph",
        text: "The MCP server enforces no permissions of its own — and that is the point. It is a stateless protocol adapter: every tool call is translated into a request against the Talonic platform API, carrying the caller's own credential. Access control is evaluated by the platform on every request, exactly as it is for the web application and the REST API. There is no separate, weaker permission model for agents; an agent connected through MCP can never see more than the credential it presents is allowed to see.",
      },
      {
        type: "heading",
        level: 3,
        id: "access-control-credentials",
        text: "What the permissions attach to",
      },
      {
        type: "paragraph",
        text: "MCP calls authenticate with one of two credential types, and permissions attach to whichever is presented. A **Talonic API key** (`tlnc_...`) is scoped to the workspace it was created in and carries that workspace's access rights. An **OAuth 2.1 access token**, issued by the Talonic authorization server when a user connects through a hosted client such as Claude.ai, acts on behalf of that user and carries the user's own role and workspace memberships. In both cases the credential travels with every individual tool call — the hosted MCP server holds no session state and no ambient permissions.",
      },
      {
        type: "callout",
        variant: "warning",
        text: "[CONFIRM: exact scoping granularity of an API key — is a key bound to one workspace only, or can it span workspaces? Can a key be restricted to specific document types, schemas, or read-only access at creation time? Document the key-creation options here.]",
      },
      {
        type: "heading",
        level: 3,
        id: "access-control-layers",
        text: "Permission layers applied to a call",
      },
      {
        type: "paragraph",
        text: "The platform evaluates access at the workspace, schema, and record level. A tool call such as `talonic_search` or `talonic_filter` only ever operates within the workspace the credential resolves to, and results are limited to documents and records that credential may read. Write-capable tools (`talonic_extract`, `talonic_save_schema`, `talonic_request_upload`) additionally require write permission on the target workspace.",
      },
      {
        type: "callout",
        variant: "warning",
        text: "[CONFIRM: (1) whether field-level and sensitivity-classification permissions are enforced on API/MCP reads, or only in the UI; (2) whether compartments apply to MCP calls identically to the UI and the platform agent; (3) whether a document type restriction on a role filters MCP search/filter results. Each of these was asserted to MSD on 29 July — the wording here must match what was committed.]",
      },
      {
        type: "heading",
        level: 3,
        id: "access-control-out-of-scope",
        text: "Out-of-scope requests: filtering vs. errors",
      },
      {
        type: "paragraph",
        text: "Two behaviors matter to a security review and they are different by design. When an agent requests a **specific resource** it cannot access (for example `talonic_get_document` with a document ID outside its workspace), the platform returns an explicit error rather than an empty success — the agent knows it was denied. When an agent runs a **query** (`talonic_search`, `talonic_filter`), results are scoped to what the credential may read: documents outside its scope are absent from the result set, not flagged in it.",
      },
      {
        type: "callout",
        variant: "warning",
        text: "[CONFIRM: verify both behaviors against the platform — the exact error code/message for a denied direct lookup, and that query tools silently scope rather than error. If a query against an entirely forbidden document type errors instead, document that.]",
      },
      {
        type: "heading",
        level: 3,
        id: "access-control-worked-example",
        text: "Worked example: two keys, one query",
      },
      {
        type: "paragraph",
        text: 'Consider a workspace holding both HR contracts and supplier invoices, and two API keys: `key A`, created with access to the full workspace, and `key B`, restricted to the invoices document type. The same `talonic_filter` call — filter invoices and contracts where `counterparty = "Acme"` — returns both document sets under key A, and only the invoice records under key B. The contract records are not redacted or stubbed for key B; they are simply not part of its result set.',
      },
      {
        type: "code",
        language: "json",
        title: "Same talonic_filter call, two differently-scoped keys",
        code: `// Request (identical for both keys)
{
  "tool": "talonic_filter",
  "arguments": {
    "filters": [{ "field": "counterparty", "op": "eq", "value": "Acme" }]
  }
}

// Response with key A (full workspace)      // Response with key B (invoices only)
{                                            {
  "results": [                                 "results": [
    { "document_type": "contract", ... },        { "document_type": "invoice", ... }
    { "document_type": "invoice", ... }        ],
  ],                                           "total": 1
  "total": 2                                 }
}`,
      },
      {
        type: "callout",
        variant: "warning",
        text: "[CONFIRM: run this example against a real workspace with two scoped keys and replace the sketch above with the actual request/response payloads. Do not ship a fabricated response shape.]",
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
          "No. The MCP server is a stateless adapter; every tool call is authorized by the Talonic platform using the credential the call carries. Agents get exactly the access of the API key or OAuth user they authenticate as — never more.",
      },
      {
        question: "Do permissions attach to the API key or to the calling user?",
        answer:
          "Both paths exist. An API key carries the scope it was created with; an OAuth 2.1 access token (used by hosted clients like Claude.ai) carries the connecting user's own permissions. Whichever credential a call presents is what gets evaluated.",
      },
      {
        question: "What happens when an agent requests a document it is not allowed to see?",
        answer:
          "A direct lookup of an out-of-scope resource returns an explicit error. Query tools like talonic_search and talonic_filter scope their result sets to what the credential may read, so out-of-scope documents are absent rather than flagged.",
      },
    ],
    mentions: ["access control", "permissions", "API key scope", "OAuth 2.1", "workspace"],
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
    seoTitle: "MCP Audit Logging & SIEM Export — Talonic",
    description:
      "What Talonic logs for every MCP tool call — identity, tool, arguments, documents returned — plus retention, SIEM export, and attributing returned data to a specific agent call.",
    content: [
      {
        type: "paragraph",
        text: "Every MCP tool call reaches the platform as an authenticated API request, and is logged by the same audit pipeline that records UI and REST API activity. There is no side channel: an agent reading documents through MCP produces the same class of audit evidence as a user reading them in the application.",
      },
      {
        type: "heading",
        level: 3,
        id: "audit-record-contents",
        text: "What each record contains",
      },
      {
        type: "param-table",
        title: "Audit record fields for an MCP tool call",
        params: [
          {
            name: "identity",
            type: "string",
            description:
              "The authenticated principal: the API key ID (not the secret) or, for OAuth-authenticated calls, the user. [CONFIRM: exact field names and whether key ID and user are both present when applicable.]",
          },
          {
            name: "tool",
            type: "string",
            description:
              "The MCP tool invoked, e.g. `talonic_filter`. [CONFIRM: whether the platform records the MCP tool name or the underlying REST endpoint; if the latter, document the tool-to-endpoint mapping here.]",
          },
          {
            name: "arguments",
            type: "object",
            description:
              "The call's arguments. [CONFIRM: logged in full, truncated, or redacted? File payloads are large — state the exact policy.]",
          },
          {
            name: "documents_returned",
            type: "string[]",
            description:
              "IDs of documents/records included in the response. [CONFIRM: is response content or only resource IDs recorded? This is the field MSD's question hinges on.]",
          },
          {
            name: "timestamp",
            type: "string",
            description: "ISO 8601 time of the call. [CONFIRM: field name and precision.]",
          },
          {
            name: "workspace",
            type: "string",
            description: "The workspace the call was scoped to. [CONFIRM: field name.]",
          },
        ],
      },
      {
        type: "heading",
        level: 3,
        id: "audit-retention-export",
        text: "Retention and SIEM export",
      },
      {
        type: "paragraph",
        text: "[CONFIRM: state the actual retention period (and whether it is configurable per tenant), and the supported export paths to a customer SIEM — API pull, scheduled export to customer storage, streaming. Pharma reviewers will expect a concrete integration path, e.g. Sentinel or Splunk; name what is actually supported today and nothing more.]",
      },
      {
        type: "heading",
        level: 3,
        id: "audit-attribution",
        text: "Attributing a data point to an agent call",
      },
      {
        type: "paragraph",
        text: "The attribution question an admin actually asks after the fact is: *this value surfaced in an agent's output — which call produced it, under whose credential?* Because every MCP call is individually authenticated and logged with the documents it returned, an admin can [CONFIRM: describe the actual workflow — filter the audit trail by key/user + time window + document ID? Is there a UI for this or is it API-only? Verify this end-to-end with a real query before shipping this paragraph].",
      },
      {
        type: "callout",
        variant: "info",
        text: "One key per agent makes attribution trivial: if each agent identity holds its own API key, the audit trail's key ID column is an agent ID column. See Server-Side Integration for key-handling patterns.",
      },
    ],
    related: [
      { label: "Access Control & Permissions", slug: "access-control" },
      { label: "Server-Side Integration", slug: "custom-agents" },
      { label: "talonic_get_usage", slug: "talonic-get-usage" },
    ],
    faq: [
      {
        question: "Are MCP calls audited differently from UI activity?",
        answer:
          "No — every MCP tool call reaches the platform as an authenticated API request and is recorded by the same audit pipeline as UI and REST activity. Agents do not have a quieter path to data.",
      },
      {
        question: "Can I tell which agent retrieved a specific document?",
        answer:
          "Yes, if agents hold distinct credentials: each audit record carries the authenticated key or user plus the documents returned, so filtering the trail by document ID shows every call — and every credential — that touched it.",
      },
      {
        question: "How do I get Talonic audit logs into my SIEM?",
        answer:
          "[CONFIRM: answer with the actually-supported export path and retention period before publishing.]",
      },
    ],
    mentions: ["audit logging", "SIEM", "retention", "attribution", "compliance"],
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
          "**One key per agent identity:** give each distinct agent its own key rather than sharing one per team. Scoping stays minimal and the audit trail's key column becomes an agent column — attribution for free.",
          "**Rotation:** [CONFIRM: document the actual rotation mechanics — can two keys be active during a rotation window? Is there an API to mint/revoke keys programmatically, or is it UI-only? State what exists today.]",
          "[CONFIRM: any per-key rate limits that make one-key-per-agent the wrong choice at high call volumes — link the limits page once it exists.]",
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
        question: "How should agents store the Talonic API key?",
        answer:
          "Inject it at runtime via environment variables or a secret manager, never in images or repos, and give each agent identity its own key — scoping stays minimal and every audit record then identifies the agent directly.",
      },
    ],
    mentions: [
      "custom agents",
      "Python",
      "TypeScript",
      "serverless",
      "Streamable HTTP",
      "API key rotation",
    ],
  },
]
