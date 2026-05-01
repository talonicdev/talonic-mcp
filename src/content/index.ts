// ---------------------------------------------------------------------------
// Structured content export for @talonic/mcp documentation.
//
// Usage:
//   import { getMcpSection, getAllMcpSections, MCP_NAV_SECTIONS } from '@talonic/mcp/content'
// ---------------------------------------------------------------------------

export type {
  DocBlock,
  DocSection,
  RawSection,
  Param,
  HttpMethod,
  NavSection,
} from './types';

export { MCP_NAV_SECTIONS } from './seo';

import type { DocSection, RawSection } from './types';
import { deriveBreadcrumbs, derivePrevNext } from './helpers';
import { MCP_NAV_SECTIONS } from './seo';

// --- Section imports ---
import { sections as overview } from './sections/overview';
import { sections as install } from './sections/install';
import { sections as tools } from './sections/tools';
import { sections as features } from './sections/features';
import { sections as configuration } from './sections/configuration';
import { sections as troubleshooting } from './sections/troubleshooting';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const ALL_RAW: RawSection[] = [
  ...overview,
  ...install,
  ...tools,
  ...features,
  ...configuration,
  ...troubleshooting,
];

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

function enrich(raw: RawSection[]): DocSection[] {
  return raw.map((r) => {
    const { prev, next } = derivePrevNext(MCP_NAV_SECTIONS, r.slug);
    return {
      ...r,
      breadcrumbs: deriveBreadcrumbs(MCP_NAV_SECTIONS, r.slug),
      prev,
      next,
    };
  });
}

let _sections: DocSection[] | null = null;

function getSectionsAll(): DocSection[] {
  if (!_sections) {
    _sections = enrich(ALL_RAW);
  }
  return _sections;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get a single MCP section by slug, or null if not found. */
export function getMcpSection(slug: string): DocSection | null {
  return getSectionsAll().find((s) => s.slug === slug) ?? null;
}

/** Get all MCP sections in reading order. */
export function getAllMcpSections(): DocSection[] {
  return getSectionsAll();
}
