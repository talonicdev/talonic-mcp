import type { NavSection } from './types';

export const MCP_NAV_SECTIONS: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    children: [
      { id: 'mcp-introduction', label: 'Introduction' },
      { id: 'why-mcp', label: 'Why Use This' },
      { id: 'get-api-key', label: 'Get an API Key' },
    ],
  },
  {
    id: 'install',
    label: 'Install',
    children: [
      { id: 'install-overview', label: 'Overview' },
      { id: 'claude-desktop', label: 'Claude Desktop' },
      { id: 'cursor', label: 'Cursor' },
      { id: 'cline', label: 'Cline' },
      { id: 'continue', label: 'Continue' },
      { id: 'cowork', label: 'Cowork' },
    ],
  },
  {
    id: 'tools',
    label: 'Tool Reference',
    children: [
      { id: 'talonic-extract', label: 'talonic_extract' },
      { id: 'talonic-search', label: 'talonic_search' },
      { id: 'talonic-filter', label: 'talonic_filter' },
      { id: 'talonic-get-document', label: 'talonic_get_document' },
      { id: 'talonic-to-markdown', label: 'talonic_to_markdown' },
      { id: 'talonic-list-schemas', label: 'talonic_list_schemas' },
      { id: 'talonic-save-schema', label: 'talonic_save_schema' },
    ],
  },
  {
    id: 'features',
    label: 'Features',
    children: [
      { id: 'drag-and-drop', label: 'Drag & Drop Files' },
      { id: 'how-it-works', label: 'How It Works' },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    children: [
      { id: 'env-variables', label: 'Environment Variables' },
    ],
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    children: [
      { id: 'common-issues', label: 'Common Issues' },
      { id: 'known-limitations', label: 'Known Limitations' },
      { id: 'upgrading', label: 'Upgrading' },
    ],
  },
];
