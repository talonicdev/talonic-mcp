import type { DocBlock, RawSection } from "../types"
import { link, tool } from "../routes"

const issue = (id: string, title: string, fix: string): DocBlock[] => [
  { type: "heading", level: 3, id, text: title },
  { type: "paragraph", text: fix },
]

export const sections: RawSection[] = [
  {
    slug: "common-issues",
    parentSlug: "troubleshooting",
    title: "Troubleshooting",
    seoTitle: "Talonic MCP Troubleshooting: Fix Connection and Tool Errors",
    description:
      "Fix the common Talonic MCP problems: client won't connect, sign-in loops, authentication errors, missing tools, empty search results and stuck uploads.",
    content: [
      {
        type: "paragraph",
        text: "The common problems and their fixes, in the order people hit them. If Talonic is missing from your client's server list, the problem is the connection; if it is listed but a call fails, read the error message first, because it says what to change.",
      },
      { type: "heading", level: 2, id: "connecting", text: "Connecting" },
      ...issue(
        "api-key-required",
        '"TALONIC_API_KEY environment variable is required"',
        "The local server could not read the key. Put it in the `env` block of your client config under exactly `TALONIC_API_KEY`, check the JSON is valid, and fully quit and reopen the client (a new conversation is not enough).",
      ),
      ...issue(
        "not-listed",
        "Talonic does not appear in the client",
        'For a local install, `command` must be `npx` and `args` exactly `["-y", "@talonic/mcp@latest"]`. Run `npx -y @talonic/mcp@latest --version` in a terminal: it should print a version. Node.js 18 or later is required.',
      ),
      ...issue(
        "sign-in",
        "Connector sign-in does not return to the chat",
        "Sign in at app.talonic.com with the account that owns the workspace, allow third-party cookies for app.talonic.com and your chat client, then start the connector again. With several Talonic accounts, sign out first so the right one is used. Last resort: remove the connector and add `https://mcp.talonic.com/mcp` again.",
      ),
      ...issue(
        "auth-error",
        "Every call fails with an authentication error",
        `The key is wrong, revoked or for another workspace. Keys start with \`tlnc_\`; create a new one under **Settings → API Keys** (${link("get-api-key", "Get an API key")}). For connectors, remove and re-add the connector.`,
      ),
      { type: "heading", level: 2, id: "tools", text: "Tools" },
      ...issue(
        "missing-tools",
        "Some tools are missing",
        `Process tools appear only when your role can see processes; app tools only when the app is enabled for you; ChatGPT omits the two generic data-query tools. Decision-task tools marked not callable mean the connector was added before it could ask for \`apps:decide\`: remove and re-add it. ${link("tools-by-task", "Tools by task")} shows what each session lists.`,
      ),
      ...issue(
        "stale-descriptions",
        "Tool descriptions or tools look out of date",
        "Clients cache the tool list. Restart the client, or reconnect the connector, after Talonic adds or changes tools.",
      ),
      ...issue(
        "search-empty",
        "Search returns nothing for something that exists",
        `${tool("talonic_search")} matches words literally. Search with one short, singular keyword (\`invoice\`, not \`invoices from May\`) or the exact file name. For a concept rather than a word, use ${tool("talonic_find_data")}.`,
      ),
      ...issue(
        "filter-zero",
        'A filter like "total > 1000" returns nothing',
        `Number comparisons work only on fields stored as numbers. Check the field's \`dataType\` with ${tool("talonic_search")} or ${tool("talonic_get_field")}, and read any \`warnings[]\` on the response: it names fields it could not match.`,
      ),
      ...issue(
        "extract-schema",
        "Extract asks for fields",
        `${tool("talonic_extract")} needs to know what to pull: an inline \`schema\`, a saved \`schema_id\`, or \`auto_schema: true\` to have Talonic suggest the fields. The error includes a ready-to-use schema for your request.`,
      ),
      ...issue(
        "empty-fields",
        "Extract returns empty fields for a file I attached",
        `In Claude.ai and ChatGPT, a file sent inside the tool call is cut short by the client's size limit. Use ${tool("talonic_request_upload")} instead (${link("files-and-uploads", "Files and uploads")}).`,
      ),
      ...issue(
        "upload-stuck",
        "An upload seems stuck",
        "`pending_upload` means the link has not been used yet; `uploading`, `queued` and `extracting` are normal while a file is read. `ocr_failed`, `extraction_failed` or `error` are final: try a clearer scan or the original file. An expired link can be replaced by asking for a new one.",
      ),
      ...issue(
        "slow",
        "Long documents time out",
        `Reading time grows with page count. If your client gives up first, use an upload link or a Spec run (${tool("talonic_run_spec")}), which return at once and let the agent check progress.`,
      ),
      ...issue(
        "permission",
        "A write is refused (403)",
        "The call runs with your workspace role. The message names what is missing, such as a role, a grant or a scope; ask a workspace admin, or reconnect if it names a scope.",
      ),
      { type: "heading", level: 2, id: "report", text: "Reporting a problem" },
      {
        type: "paragraph",
        text: "Include your client and its version, the server version (`npx -y @talonic/mcp@latest --version` for local installs), the tool name and the full error message. Open an issue on [GitHub](https://github.com/talonicdev/talonic-mcp/issues) or write to support from the web app.",
      },
    ],
    related: [
      { label: "Limits", slug: "known-limitations" },
      { label: "Connect your agent", slug: "install-overview" },
      { label: "Files and uploads", slug: "files-and-uploads" },
    ],
    faq: [
      {
        question: "Why does my agent say it can't find a document I know is there?",
        answer:
          "Search matches words literally. Ask it to search for one short keyword or the exact file name, or to look for the concept instead of the word.",
      },
    ],
    mentions: ["MCP troubleshooting", "connection errors", "authentication"],
  },
  {
    slug: "known-limitations",
    parentSlug: "troubleshooting",
    title: "Limits",
    seoTitle: "Talonic MCP Limits: File Sizes, Batches and Timeouts",
    description:
      "The limits that shape what an agent can do with Talonic: tool-call size in hosted chats, batch sizes, waits for answers, page sizes and what uses credits.",
    content: [
      {
        type: "paragraph",
        text: "The limits an agent works within, and what to do at each one.",
      },
      {
        type: "param-table",
        params: [
          {
            name: "File inside a tool call (hosted chats)",
            type: "about 32 KB",
            description: `Larger files arrive cut short. Use ${tool("talonic_request_upload")}, a \`file_url\` or a \`document_id\`.`,
          },
          {
            name: "File by path",
            type: "local install only",
            description:
              "`file_path` is read by the server on your machine; hosted sessions refuse it.",
          },
          {
            name: "Spec run",
            type: "500 documents or 20 URLs",
            description: "Per call to `talonic_run_spec`; split larger sets into several runs.",
          },
          {
            name: "Answer wait",
            type: "up to 55 s",
            description:
              "`talonic_ask` returns an `ask_id` after `wait_seconds`; collect the answer with `talonic_get_answer`.",
          },
          {
            name: "Run results page",
            type: "up to 200 rows",
            description: "Page through `talonic_get_run_results` with `cursor`.",
          },
          {
            name: "Field values page",
            type: "up to 100 rows",
            description: "Page through `talonic_field_values` with `cursor`.",
          },
          {
            name: "Decision package page",
            type: "up to 2,000 records",
            description: "Page through `talonic_read_decision_package` with `cursor`.",
          },
          {
            name: "Usage window",
            type: "1 to 365 days",
            description: "`talonic_get_usage` defaults to 30 days.",
          },
        ],
      },
      { type: "heading", level: 2, id: "credits", text: "What uses credits" },
      {
        type: "paragraph",
        text: `Reading a new document, extracting fields, asking a question and running a Spec or a process use credits, at the same rates as the web app and the API. Searching, filtering, listing, looking up and reading stored text are free. ${tool("talonic_get_pricing")} has the rates; ${tool("talonic_get_balance")} the balance.`,
      },
      {
        type: "heading",
        level: 2,
        id: "in-the-web-app",
        text: "Done in the web app, not by an agent",
      },
      {
        type: "list",
        items: [
          "Connecting a mailbox or another system, and storing passwords or secrets.",
          "Creating API keys and managing members and roles.",
        ],
      },
    ],
    related: [
      { label: "Troubleshooting", slug: "common-issues" },
      { label: "Files and uploads", slug: "files-and-uploads" },
    ],
    faq: [],
    mentions: ["MCP limits", "file size", "credits"],
  },
  {
    slug: "upgrading",
    parentSlug: "troubleshooting",
    title: "Upgrading",
    seoTitle: "Upgrading the Talonic MCP Server to the Latest Version",
    description:
      "Hosted connections always run the latest Talonic MCP server. Local installs update on restart with @latest; pin an exact version when you need repeatable runs.",
    content: [
      {
        type: "paragraph",
        text: "Hosted connections (`https://mcp.talonic.com/mcp`) always run the latest version; there is nothing to do except reconnect if your client caches the tool list.",
      },
      {
        type: "paragraph",
        text: "Local installs with `@talonic/mcp@latest` pick up the newest version the next time the client starts. Quit the client fully (not just the conversation) to restart the server. To pin, use an exact version such as `@talonic/mcp@0.1.100`; `npm view @talonic/mcp version` shows the latest.",
      },
      {
        type: "paragraph",
        text: "New versions add tools and optional parameters. Existing parameters and response fields are not removed or renamed without a dated notice in the [changelog](https://github.com/talonicdev/talonic-mcp/blob/main/CHANGELOG.md).",
      },
    ],
    related: [{ label: "Connect your agent", slug: "install-overview" }],
    faq: [],
    mentions: ["upgrade", "npm", "version"],
  },
]
