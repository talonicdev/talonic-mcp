// ---------------------------------------------------------------------------
// Serializable content types for @talonic/mcp structured doc export.
// Same shape as @talonic/docs content types for website compatibility.
// No React, no JSX — pure data.
// ---------------------------------------------------------------------------

/** HTTP method for API endpoint blocks. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** A single parameter row in a param-table block. */
export interface Param {
  name: string;
  type: string;
  required?: boolean;
  description: string;
  default?: string;
}

/**
 * A single content block. The union discriminates on `type`.
 *
 * Text fields use lightweight inline markup:
 * - `**bold**` for strong emphasis
 * - `` `code` `` for inline code
 * - `[text](url)` for links
 */
export type DocBlock =
  | { type: 'heading'; level: 2 | 3; id: string; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'code'; language?: string; title?: string; code: string }
  | { type: 'callout'; variant?: 'info' | 'warning'; text: string }
  | { type: 'param-table'; title?: string; params: Param[] }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | {
      type: 'endpoint';
      method: HttpMethod;
      path: string;
      summary: string;
      description?: string;
      blocks: DocBlock[];
    };

/** Navigation section for sidebar rendering. */
export interface NavSection {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
}

/**
 * A fully-resolved documentation section ready for SEO page rendering.
 */
export interface DocSection {
  slug: string;
  parentSlug: string;
  title: string;
  seoTitle: string;
  description: string;
  breadcrumbs: { label: string; slug: string }[];
  content: DocBlock[];
  related: { label: string; slug: string }[];
  faq: { question: string; answer: string }[];
  mentions: string[];
  prev: { slug: string; label: string } | null;
  next: { slug: string; label: string } | null;
}

/**
 * Raw section data before prev/next and breadcrumbs are derived.
 */
export interface RawSection {
  slug: string;
  parentSlug: string;
  title: string;
  seoTitle: string;
  description: string;
  content: DocBlock[];
  related: { label: string; slug: string }[];
  faq: { question: string; answer: string }[];
  mentions: string[];
}
