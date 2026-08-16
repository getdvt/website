/**
 * dvtType -> ChartDef / family resolver for the programmatic chart-type
 * pages (DVT-3004 slice 2: src/pages/charts/[slug].astro + index.astro).
 *
 * Chart render data lives across two files that this module unifies:
 *   - src/data/charts.ts        (`families`)   — the /spec gallery catalog
 *   - src/data/chart-page-extras.ts (`chartPageExtras`) — the 4 types the
 *     gallery doesn't cover (chart:lines, chart:chord, chart:map,
 *     chart:geo:animated)
 *
 * Kept out of both of those files so their existing drift guards
 * (scripts/check-chart-types.mjs reads charts.ts by regex) stay untouched.
 *
 * Note: this imports src/data/chart-pages.json directly (not via the
 * `chartPages` Content Layer collection in content.config.ts) so the
 * id/title lookups here stay synchronous and usable from plain module
 * scope — the collection loader points at the same file, so there's a
 * single source of truth either way.
 */

import { families, type ChartDef } from './charts';
import { chartPageExtras } from './chart-page-extras';
import chartPagesRaw from './chart-pages.json';

interface ChartPageEntry {
  id: string;
  type: string;
  title: string;
  metaDescription: string;
  whenToUse: string;
  targetQuery: string;
  summary: string;
}
const chartPages = chartPagesRaw as ChartPageEntry[];
const pageByType = new Map(chartPages.map((p) => [p.type, p]));

export interface ChartGroup {
  id: string;
  label: string;
}

interface Resolved {
  def: ChartDef;
  group: ChartGroup;
}

/** Strip a trailing " (label)" suffix (e.g. "chart:scatter (bubble)") to get
 *  the base dvt type. Mirrors scripts/check-chart-types.mjs:56. */
export function baseType(dvtType: string): string {
  return dvtType.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// The 2 extras (map, geo:animated) don't belong to any charts.ts family — a
// small synthetic "Maps" group, per spec. lines/chord fold into the existing
// `flow` family group instead (see the loop below).
const MAPS_GROUP: ChartGroup = { id: 'maps', label: 'Maps' };
const flowFamily = families.find((f) => f.id === 'flow');
if (!flowFamily) {
  throw new Error(
    "charts.ts family 'flow' not found — chart-page-lookup.ts sibling overrides depend on it"
  );
}
const FLOW_GROUP: ChartGroup = { id: flowFamily.id, label: flowFamily.label };

/** base dvtType -> resolved ChartDef + group. First match wins, walking
 *  `families` in declaration order, then `chartPageExtras`. */
const lookup: Map<string, Resolved> = (() => {
  const map = new Map<string, Resolved>();
  for (const family of families) {
    for (const chart of family.charts) {
      const key = baseType(chart.dvtType);
      if (!map.has(key)) {
        map.set(key, { def: chart, group: { id: family.id, label: family.label } });
      }
    }
  }
  for (const chart of chartPageExtras) {
    const key = baseType(chart.dvtType);
    if (map.has(key)) continue;
    const group = key === 'chart:lines' || key === 'chart:chord' ? FLOW_GROUP : MAPS_GROUP;
    map.set(key, { def: chart, group });
  }
  return map;
})();

export function resolveChartDef(dvtType: string): ChartDef | undefined {
  return lookup.get(baseType(dvtType))?.def;
}

export function groupOf(dvtType: string): ChartGroup | undefined {
  return lookup.get(baseType(dvtType))?.group;
}

function pagesForTypes(types: string[]): { id: string; title: string }[] {
  return types
    .map((t) => pageByType.get(t))
    .filter((p): p is ChartPageEntry => !!p)
    .map((p) => ({ id: p.id, title: p.title }));
}

/** 3-4 sibling chart-page links for the "Related chart types" strip. Family
 *  members for the 30 types covered by charts.ts; hardcoded picks for the
 *  4 chart-page-extras types (which don't carry family membership). */
export function siblingsFor(dvtType: string): { id: string; title: string }[] {
  const key = baseType(dvtType);

  if (key === 'chart:lines' || key === 'chart:chord') {
    return pagesForTypes(
      ['chart:sankey', 'chart:tree', 'chart:graph', 'chart:parallel'].filter((t) => t !== key)
    ).slice(0, 4);
  }
  if (key === 'chart:map' || key === 'chart:geo:animated') {
    const other = key === 'chart:map' ? 'chart:geo:animated' : 'chart:map';
    return pagesForTypes([other, 'chart:heatmap', 'chart:scatter']);
  }

  const family = families.find((f) => f.charts.some((c) => baseType(c.dvtType) === key));
  if (!family) return [];
  const siblingTypes = [...new Set(family.charts.map((c) => baseType(c.dvtType)))].filter(
    (t) => t !== key
  );
  return pagesForTypes(siblingTypes).slice(0, 4);
}

/** All families in index-page display order, extras folded in (lines/chord
 *  into `flow`, map/geo:animated into the synthetic `maps` group appended
 *  last), each with its resolved chart-pages.json entries. */
export function pageGroups(): { group: ChartGroup; pages: ChartPageEntry[] }[] {
  const order: ChartGroup[] = [...families.map((f) => ({ id: f.id, label: f.label })), MAPS_GROUP];
  const byGroup = new Map<string, ChartPageEntry[]>(order.map((g) => [g.id, []]));
  for (const entry of chartPages) {
    const group = groupOf(entry.type);
    if (!group) continue;
    byGroup.get(group.id)?.push(entry);
  }
  return order
    .map((group) => ({ group, pages: byGroup.get(group.id) ?? [] }))
    .filter((g) => g.pages.length > 0);
}
