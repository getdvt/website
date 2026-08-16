#!/usr/bin/env node
//
// Guard: every `spec:` snippet in the chart catalog (src/data/charts.ts and
// src/data/chart-page-extras.ts) must validate against dvt's canonical
// dashboard.schema.json #/$defs/Panel. Two `table` snippets shipped to the
// live /spec gallery carrying schema violations (a conditionalFormat[0]
// .apply.fill pattern violation and cell oneOf violations) because no script
// checked this. Review alone missed it.
//
// What this gate CANNOT catch: it checks the snippets against dvt's JSON
// **schema** only. It cannot reproduce two classes of problem that dvt's
// server-side `dvt_spec_validate` reports, because neither lives in the
// schema: (a) data-binding warnings (a schema-valid panel that will render
// EMPTY for want of a data source or inline series[].data), and (b)
// echarts-key warnings (an unknown or mistyped ECharts option, e.g. a
// `steps` key on a funnel, or `sizeField` on a series instead of on spec).
// Both were real defects in this catalog and both passed ajv cleanly.
// Re-run the snippets through dvt_spec_validate by hand when changing them.
//
// That gap is STRUCTURALLY PERMANENT, not a current-state limitation — do not
// try to close it by tightening the vendored schema. `$defs/ChartSpec` is
// `additionalProperties: true` by ADR-0016 design (so an unknown ECharts key can
// never be a schema error) and `$defs/Panel.required` omits `data` (so a panel
// with no data source can never be a schema error). No ajv gate over
// dashboard.schema.json can catch either class, however strictly it is written.
// The real source of truth for the echarts-key class is dvt's
// spec/schema/echarts/chart-types.json (`status == "passthrough"`), which is
// already codegen'd across the language boundary; rebasing this gate onto it is
// DVT-3113.
//
// Zero-dependency guards (check-chart-types.mjs, check-chart-pages.mjs) run
// before this one in CI, since this one needs `npm ci` for ajv first.
//

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARTS_FILE = resolve(REPO_ROOT, 'src/data/charts.ts');
const EXTRAS_FILE = resolve(REPO_ROOT, 'src/data/chart-page-extras.ts');
const SCHEMA_FILE = resolve(REPO_ROOT, 'src/data/dashboard.schema.json');

const VERBOSE = process.argv.includes('--verbose');

const dvtTypeRe = /dvtType:\s*'([^']+)'/g;
const specRe = /spec:\s*`([\s\S]*?)`/;
const stripLabel = (raw) => raw.replace(/\s*\([^)]*\)\s*$/, '').trim();

// Extract every (dvtType, spec) pair from one source file. Mirrors the
// extraction style in scripts/check-chart-pages.mjs:112-126: find every
// dvtType match, then slice the source between consecutive matches and pull
// that entry's spec snippet out of the slice.
function extractEntries(file) {
  const source = readFileSync(file, 'utf8');
  const dvtMatches = [...source.matchAll(dvtTypeRe)];
  const entries = [];
  const label = file === CHARTS_FILE ? 'charts.ts' : 'chart-page-extras.ts';
  const occurrenceCounts = new Map();

  for (let i = 0; i < dvtMatches.length; i++) {
    const match = dvtMatches[i];
    const start = match.index;
    const end = i + 1 < dvtMatches.length ? dvtMatches[i + 1].index : source.length;
    const slice = source.slice(start, end);

    const baseType = stripLabel(match[1]);
    const specMatch = slice.match(specRe);
    if (!specMatch) {
      entries.push({
        file: label,
        dvtType: baseType,
        occurrence: null,
        name: null,
        error: `no 'spec: \`...\`' snippet found for dvtType '${match[1]}'`,
      });
      continue;
    }

    const occurrence = (occurrenceCounts.get(baseType) ?? 0) + 1;
    occurrenceCounts.set(baseType, occurrence);
    const name = `${label}#${baseType}[${occurrence}]`;

    entries.push({
      file: label,
      dvtType: baseType,
      occurrence,
      name,
      raw: specMatch[1],
    });
  }

  // Derived completeness guard. A catalog entry that the dvtType regex stops
  // matching would drop out SILENTLY: its `spec:` snippet just falls inside the
  // preceding entry's slice, where only the first snippet is read. So count the
  // snippets independently of the dvtType regex and require one entry per
  // snippet. `/spec:\s*`/` cannot match the TS interface field (`spec: string;`
  // has no backtick), so this count is exactly the number of snippets in the file.
  const snippetCount = (source.match(/spec:\s*`/g) ?? []).length;
  if (entries.length !== snippetCount) {
    console.error(
      `ERROR: ${label} contains ${snippetCount} 'spec: \`...\`' snippet(s) but only ` +
        `${entries.length} (dvtType, spec) pair(s) were extracted. An entry is being skipped, ` +
        `which would make this check silently vacuous. Update the regexes in ` +
        `scripts/check-chart-specs.mjs to match the current shape of ${label}.`
    );
    process.exit(1);
  }

  return entries;
}

const entries = [...extractEntries(CHARTS_FILE), ...extractEntries(EXTRAS_FILE)];

// Sanity guard, mirroring check-chart-pages.mjs:40-43: a near-empty extraction
// would make this check vacuously "pass", which is worse than a failure.
//
// The per-file guard in extractEntries already catches an entry dropping out one
// at a time (it compares against an independently-derived snippet count). This
// floor covers the remaining case: BOTH regexes stopping at once on a wholesale
// reshape of the source, where the derived count would agree at a much lower
// number. Keep it just under the current catalog size (40) so it stays tight —
// raise it when the catalog grows.
const MIN_SNIPPETS = 39;
if (entries.length < MIN_SNIPPETS) {
  console.error(
    `ERROR: only ${entries.length} chart-catalog snippet(s) were extracted from ${CHARTS_FILE} ` +
      `and ${EXTRAS_FILE} (expected ${MIN_SNIPPETS}+). The file shape may have changed; update ` +
      `the regexes in scripts/check-chart-specs.mjs.`
  );
  process.exit(1);
}

// Parse each snippet: undo the template-literal escape, then JSON.parse, then
// complete the id/title-less fragment into a real Panel.
const parsed = [];
const parseErrors = [];
for (const entry of entries) {
  if (entry.error) {
    parseErrors.push(`${entry.file}#${entry.dvtType}: ${entry.error}`);
    continue;
  }
  const unescaped = entry.raw.replace(/\\\\/g, '\\');
  let fragment;
  try {
    fragment = JSON.parse(unescaped);
  } catch (e) {
    parseErrors.push(`${entry.name}: failed to JSON.parse its spec snippet: ${e.message}`);
    continue;
  }
  parsed.push({
    name: entry.name,
    panel: { id: `check-chart-specs-${entry.name}`, title: entry.name, ...fragment },
  });
}

if (parseErrors.length > 0) {
  console.error('ERROR: the following chart-catalog snippets could not be parsed:');
  for (const e of parseErrors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
}

// Compile the vendored schema with ajv 2020 and validate each panel against
// #/$defs/Panel. strict: false is required, because the schema uses keywords ajv's
// strict mode rejects. This exact config was verified against the real
// schema before this script was written.
const schema = JSON.parse(readFileSync(SCHEMA_FILE, 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(schema, 'dashboard');
const validate = ajv.getSchema('dashboard#/$defs/Panel');

if (!validate) {
  console.error(`ERROR: could not resolve schema ref 'dashboard#/$defs/Panel' in ${SCHEMA_FILE}.`);
  console.error('The vendored schema may be stale or its shape may have changed upstream.');
  process.exit(1);
}

const MAX_ERRORS_PER_SNIPPET = 6;
const failures = [];

for (const { name, panel } of parsed) {
  const valid = validate(panel);
  if (valid) continue;

  const allErrors = validate.errors ?? [];
  const seen = new Set();
  const deduped = [];
  for (const err of allErrors) {
    // A separator is needed so two distinct (path, message) pairs can't collide by
    // concatenation; a plain space is fine since ajv never puts a space in instancePath.
    const key = `${err.instancePath} ${err.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(err);
  }

  const toPrint = VERBOSE ? deduped : deduped.slice(0, MAX_ERRORS_PER_SNIPPET);
  const suppressed = deduped.length - toPrint.length;

  failures.push({ name, toPrint, suppressed, total: deduped.length });
}

if (failures.length > 0) {
  console.error(`ERROR: ${failures.length} chart-catalog snippet(s) failed schema validation:`);
  for (const { name, toPrint, suppressed } of failures) {
    console.error('');
    console.error(`  ${name}:`);
    for (const err of toPrint) {
      console.error(`    ${err.instancePath || '(root)'}: ${err.message}`);
    }
    if (suppressed > 0) {
      console.error(`    ...${suppressed} more error line(s) suppressed (use --verbose to see all).`);
    }
  }
  console.error('');
  console.error(
    'Fix hint: run the failing snippet through dvt_spec_validate to see the same violation with ' +
      'more context, then correct the snippet in charts.ts / chart-page-extras.ts.'
  );
  process.exit(1);
}

console.log(
  `OK — all ${parsed.length} chart-catalog snippets validate against dvt's Panel schema.`
);
