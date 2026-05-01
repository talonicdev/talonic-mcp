// ---------------------------------------------------------------------------
// Pure functions that derive breadcrumbs and prev/next from nav structure.
// ---------------------------------------------------------------------------

interface NavChild {
  id: string;
  label: string;
}

interface NavGroup {
  id: string;
  label: string;
  children?: NavChild[];
}

export function deriveBreadcrumbs(
  sections: NavGroup[],
  leafId: string,
): { label: string; slug: string }[] {
  const root = { label: 'MCP Server', slug: 'mcp' };

  for (const group of sections) {
    const child = group.children?.find((c) => c.id === leafId);
    if (child) {
      return [root, { label: group.label, slug: group.id }, { label: child.label, slug: child.id }];
    }
  }

  const topLevel = sections.find((s) => s.id === leafId);
  if (topLevel) {
    return [root, { label: topLevel.label, slug: topLevel.id }];
  }

  return [root];
}

export function derivePrevNext(
  sections: NavGroup[],
  leafId: string,
): { prev: { slug: string; label: string } | null; next: { slug: string; label: string } | null } {
  const flat: NavChild[] = sections.flatMap(
    (s) => s.children ?? [{ id: s.id, label: s.label }],
  );

  const idx = flat.findIndex((c) => c.id === leafId);
  if (idx === -1) return { prev: null, next: null };

  return {
    prev: idx > 0 ? { slug: flat[idx - 1].id, label: flat[idx - 1].label } : null,
    next: idx < flat.length - 1 ? { slug: flat[idx + 1].id, label: flat[idx + 1].label } : null,
  };
}
