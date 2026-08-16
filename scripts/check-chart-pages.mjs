#!/usr/bin/env node
//
// Guard: every chart:* member of the vendored PanelType enum (except the
// non-page chart:custom) must have exactly one corresponding entry in
// src/data/chart-pages.json, and every entry's id must follow the slug law
// derived from its type (chart:bar:stacked -> bar-stacked). Also guards that
// every chart-pages.json entry actually resolves to a renderable ChartDef in
// src/data/charts.ts or src/data/chart-page-extras.ts — a deleted/renamed
// `families`/`chartPageExtras` entry passes checks (a)-(d) but would only
// fail at Cloudflare deploy build time (chart-page-lookup.ts throws), so
// catching it here mirrors check-chart-types.mjs's regex approach.
//
// Coverage split (mirrors check-chart-types.mjs):
//   - PR trigger (paths filter in .github/workflows/chart-types-drift.yml)
//     catches a hand-edit of chart-pages.json or panel-types.json that
//     introduces a mismatch.
//   - Upstream drift (a new/removed chart:* PanelType member in getdvt/dvt)
//     is caught the same way charts.ts drift is: refresh panel-types.json
//     via scripts/sync-panel-types.sh, which will then flag the new/removed
//     type here on the next PR.
//
// Zero external dependencies: reads local files, pure Node built-ins.
//

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_FILE = resolve(REPO_ROOT, 'src/data/chart-pages.json');
const ENUM_FILE = resolve(REPO_ROOT, 'src/data/panel-types.json');
const CHARTS_FILE = resolve(REPO_ROOT, 'src/data/charts.ts');
const EXTRAS_FILE = resolve(REPO_ROOT, 'src/data/chart-page-extras.ts');

const pages = JSON.parse(readFileSync(PAGES_FILE, 'utf8'));
const { panelTypes } = JSON.parse(readFileSync(ENUM_FILE, 'utf8'));

// Sanity guard: an empty chart-pages.json would make every check below
// vacuously "pass" — that's worse than a failure.
if (!Array.isArray(pages) || pages.length === 0) {
  console.error(`ERROR: ${PAGES_FILE} is missing, not an array, or has zero entries.`);
  process.exit(1);
}

// The full set of PanelType members that should have a chart-type page:
// every "chart:*" member except chart:custom (not a real, page-worthy type).
const expectedTypes = panelTypes.filter((t) => t.startsWith('chart:') && t !== 'chart:custom');

const errors = [];

// (a) every expected type has exactly one chart-pages.json entry.
const typeCounts = new Map();
for (const entry of pages) {
  typeCounts.set(entry.type, (typeCounts.get(entry.type) ?? 0) + 1);
}

const missing = expectedTypes.filter((t) => !typeCounts.has(t));
const extra = [...typeCounts.keys()].filter((t) => !expectedTypes.includes(t));
const duplicated = [...typeCounts.entries()].filter(([, n]) => n > 1).map(([t]) => t);

if (missing.length > 0) {
  errors.push(
    `Missing chart-pages.json entries for PanelType member(s): ${JSON.stringify(missing)}`
  );
}
if (extra.length > 0) {
  errors.push(
    `chart-pages.json has entries for type(s) not in the vendored PanelType enum (or is chart:custom): ${JSON.stringify(extra)}`
  );
}
if (duplicated.length > 0) {
  errors.push(`chart-pages.json has more than one entry for type(s): ${JSON.stringify(duplicated)}`);
}

// (b) slug law: id === type with "chart:" stripped and ":" -> "-".
const slugify = (type) => type.replace(/^chart:/, '').replace(/:/g, '-');
for (const entry of pages) {
  const expectedId = slugify(entry.type ?? '');
  if (entry.id !== expectedId) {
    errors.push(
      `id '${entry.id}' does not match the slug law for type '${entry.type}' (expected '${expectedId}')`
    );
  }
}

// (c) ids are unique.
const idCounts = new Map();
for (const entry of pages) {
  idCounts.set(entry.id, (idCounts.get(entry.id) ?? 0) + 1);
}
const dupIds = [...idCounts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
if (dupIds.length > 0) {
  errors.push(`Duplicate id(s) in chart-pages.json: ${JSON.stringify(dupIds)}`);
}

// (d) every entry has non-empty title/metaDescription/whenToUse/targetQuery.
const REQUIRED_STRING_FIELDS = ['title', 'metaDescription', 'whenToUse', 'targetQuery', 'summary'];
for (const entry of pages) {
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof entry[field] !== 'string' || entry[field].trim().length === 0) {
      errors.push(`Entry '${entry.id ?? '(no id)'}' is missing a non-empty '${field}'`);
    }
  }
}

// (e) resolution guard: every chart-pages.json `type` must appear among the
// dvtType literals defined in charts.ts `families` ∪ chart-page-extras.ts
// `chartPageExtras` — the two files chart-page-lookup.ts actually resolves
// against at render time. Mirrors check-chart-types.mjs's regex extraction
// (incl. stripping a trailing " (label)" display suffix), run once per file
// so a missing match names the file to fix.
const dvtTypeRe = /dvtType:\s*'([^']+)'/g;
const stripLabel = (raw) => raw.replace(/\s*\([^)]*\)\s*$/, '').trim();

function extractDvtTypes(file) {
  const source = readFileSync(file, 'utf8');
  const matches = [...source.matchAll(dvtTypeRe)];
  if (matches.length === 0) {
    errors.push(
      `Regex /dvtType:\\s*'([^']+)'/g matched nothing in ${file} — the file shape may have ` +
        `changed; update the regex in scripts/check-chart-pages.mjs.`
    );
    return new Set();
  }
  return new Set(matches.map(([, raw]) => stripLabel(raw)));
}

const chartsTypes = extractDvtTypes(CHARTS_FILE);
const extrasTypes = extractDvtTypes(EXTRAS_FILE);
const resolvableTypes = new Set([...chartsTypes, ...extrasTypes]);

for (const entry of pages) {
  if (!resolvableTypes.has(entry.type)) {
    errors.push(
      `chart-pages.json entry '${entry.id}' has type '${entry.type}', which does not resolve ` +
        `to any dvtType literal in ${CHARTS_FILE} or ${EXTRAS_FILE} — fix chart-pages.json, or ` +
        `restore/rename the matching entry in whichever of those two files dropped it.`
    );
  }
}

if (errors.length > 0) {
  console.error('ERROR: chart-pages.json failed the chart-page content guard:');
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  console.error('');
  console.error(
    'Fix hint: if a PanelType member was added/removed/renamed upstream, run scripts/sync-panel-types.sh ' +
      'to refresh src/data/panel-types.json, then add/remove/rename the matching chart-pages.json entry ' +
      "(id = type with 'chart:' stripped and ':' -> '-'). If it's a typo, fix chart-pages.json directly."
  );
  process.exit(1);
}

console.log(
  `OK — all ${expectedTypes.length} page-worthy PanelType chart:* members have exactly one valid chart-pages.json entry.`
);
