import type { RawSection } from "../types"
import { link, tool } from "../routes"

export const sections: RawSection[] = [
  {
    slug: "files-and-uploads",
    parentSlug: "files",
    title: "Files and uploads from an agent",
    seoTitle: "Files and Uploads from an AI Agent: Talonic MCP — Talonic",
    description:
      "Four ways an agent gets a file to Talonic: a document already in the workspace, a public URL, a local path or bytes, or an upload link the user opens.",
    content: [
      {
        type: "paragraph",
        text: "Before Talonic can read a document, the file has to reach it. This page shows the four ways an agent can do that, which one to use, and what to tell the user while a file is on its way.",
      },
      { type: "heading", level: 2, id: "pick-a-way", text: "Pick a way" },
      {
        type: "list",
        items: [
          `**Already in the workspace.** Use its \`document_id\`. If the user names the file, find the id with ${tool("talonic_search")} (search by file name or one keyword). Free and instant.`,
          "**On a public URL.** Pass `file_url` (https). Talonic fetches it. Good for links the user pastes.",
          "**On the user's machine, in a local install.** Pass `file_path`; the local server reads the file. Small files can also go as `file_data` (base64) with `filename`.",
          `**Anything else, especially in Claude.ai or ChatGPT.** Call ${tool("talonic_request_upload")} and give the user the link. They open it in their browser and drop the file.`,
        ],
      },
      {
        type: "callout",
        variant: "warning",
        text: "Hosted chat clients cap the size of a tool call (around 32 KB), which is smaller than most real documents. A file sent as `file_data` there arrives cut short and comes back with empty fields. Use an upload link instead.",
      },
      { type: "heading", level: 2, id: "upload-link", text: "The upload link, step by step" },
      {
        type: "list",
        ordered: true,
        items: [
          `The agent calls ${tool("talonic_request_upload")} with the \`filename\`. Pass \`account\` to file it under one company, and \`add_to_workspace: true\` if the user will ask questions about it later (otherwise only its text is kept for the next extraction).`,
          "It returns `upload_url`, a `document_id` reserved for the file, and `expires_at`. The agent shows the user the link and says when it expires.",
          `The user opens the link and drops the file. The agent checks ${tool("talonic_get_document")} every few seconds.`,
          "When `status` is `completed` (or `extracted` without `add_to_workspace`), the file is ready: extract fields, read its text, or ask about it.",
        ],
      },
      {
        type: "param-table",
        title: "Status while a file is on its way",
        params: [
          {
            name: "pending_upload",
            type: "waiting",
            description: "Link issued; the user has not dropped the file yet.",
          },
          {
            name: "uploading",
            type: "in progress",
            description: "The file is arriving. Keep checking.",
          },
          {
            name: "queued / extracting",
            type: "in progress",
            description: "Talonic is reading the file.",
          },
          {
            name: "extracted",
            type: "ready",
            description: "Text is ready (uploads without `add_to_workspace`).",
          },
          { name: "completed", type: "ready", description: "Fully processed and searchable." },
          {
            name: "ocr_failed / extraction_failed / error",
            type: "failed",
            description:
              "Stop checking and tell the user; the file could not be read. A clearer scan or the original file usually works.",
          },
        ],
      },
      { type: "heading", level: 2, id: "what-files", text: "What files work" },
      {
        type: "paragraph",
        text: "PDFs (text or scanned), images and phone photos, Word documents (DOCX) and emails. Long documents take longer; very large files are better sent as an upload link or a URL than as bytes.",
      },
      { type: "heading", level: 2, id: "companies", text: "Keeping companies apart" },
      {
        type: "paragraph",
        text: `If the workspace holds documents for several companies (clients, portfolio companies, entities), pass \`account\` when uploading. Questions scoped to that account never mix in another company's files. ${tool("talonic_list_accounts")} lists them; ${tool("talonic_create_account")} adds one.`,
      },
      { type: "heading", level: 2, id: "cost", text: "Cost" },
      {
        type: "paragraph",
        text: `Issuing a link and checking status are free. Reading a new file uses credits, as in the web app; ${tool("talonic_get_pricing")} shows the rates.`,
      },
    ],
    related: [
      { label: "talonic_request_upload", slug: "talonic-request-upload" },
      { label: "talonic_get_document", slug: "talonic-get-document" },
      { label: "Recipe: set up a workspace", slug: "recipe-set-up-workspace" },
    ],
    faq: [
      {
        question: "Why does my agent ask me to open a link instead of reading the file I attached?",
        answer:
          "Hosted chat clients limit how much data one tool call can carry, so an attached document would arrive incomplete. The upload link sends the whole file straight from your browser to your workspace.",
      },
      {
        question: "How long is an upload link valid?",
        answer:
          "Until the `expires_at` time returned with it. If it expires, ask the agent for a new link; nothing is lost.",
      },
    ],
    mentions: ["file upload", "upload link", "document upload", "MCP files"],
  },
  {
    slug: "drag-and-drop",
    parentSlug: "files",
    title: "Drag and drop files",
    seoTitle: "Drag and Drop Files into Your Agent: Talonic MCP Docs",
    description:
      "Drop a file into your AI client and have Talonic read it: when attaching works, when an upload link is better, and how a local install reads files by path.",
    content: [
      {
        type: "paragraph",
        text: "Desktop and IDE clients running the local server can pass a dropped or attached file straight to Talonic. In Claude.ai and ChatGPT, attached files are too large for a tool call, so the agent gives you an upload link instead.",
      },
      {
        type: "paragraph",
        text: `All the options, and which to use when, are on ${link("files-and-uploads", "Files and uploads")}.`,
      },
    ],
    related: [{ label: "Files and uploads", slug: "files-and-uploads" }],
    faq: [],
    mentions: ["drag and drop"],
  },
  {
    slug: "how-it-works",
    parentSlug: "files",
    title: "How a file gets to Talonic",
    seoTitle: "How a File Gets from Your Agent to Talonic MCP — Talonic",
    description:
      "What happens between your agent and Talonic when it reads a file: the four ways a file arrives, the status you can check, and when results are ready to use.",
    content: [
      {
        type: "paragraph",
        text: "Your agent sends Talonic a document id, a URL, a local file or an upload link. Talonic reads the file, fills the fields you asked for, and links each value to the page and passage it came from. Values it is unsure about are marked with a lower confidence score so you can check them.",
      },
      {
        type: "paragraph",
        text: `The four ways in and the status to check are on ${link("files-and-uploads", "Files and uploads")}.`,
      },
    ],
    related: [{ label: "Files and uploads", slug: "files-and-uploads" }],
    faq: [],
    mentions: [],
  },
]
