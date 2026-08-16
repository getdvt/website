#!/usr/bin/env node
//
// Guard: every dvtType string in src/data/charts.ts must be a member of
// the vendored PanelType enum in src/data/panel-types.json.
//
// The enum is VENDORED (not fetched live) because getdvt/dvt is private and
// CI has no token to read it, and there is no public schema URL. Refresh it
// locally with: scripts/sync-panel-types.sh (needs getdvt/dvt checked out
// as a sibling of this repo, or DVT_REPO=/path/to/dvt set).
//
// Coverage split:
//   - PR trigger (paths filter) catches a hand-edit of charts.ts that
//     introduces a typo or an invented type, and catches a stale panel-types.json
//     after a manual refresh that didn't get committed.
//   - UPSTREAM drift (a silent rename in getdvt/dvt while both local files sit
//     unchanged) is caught by the weekly `upstream-sweep` job in
//     .github/workflows/chart-types-drift.yml, which reads origin/main's schema
//     live via `gh api` using a short-lived getdvt-ci-reader GitHub App token
//     (gated on the DVT_SCHEMA_APP_ID variable) and both set-compares the enum and
//     byte-compares the full schema. The sweep is a no-op until the App is
//     provisioned — see .github/github-app-ci-reader.md.
//
// This script also gates the two vendored artifacts (panel-types.json and the
// full dashboard.schema.json) against each other — see the set-compare below.
//
// Zero external dependencies: reads three local files, pure Node built-ins.
//

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARTS_FILE = resolve(REPO_ROOT, 'src/data/charts.ts');
const ENUM_FILE = resolve(REPO_ROOT, 'src/data/panel-types.json');
const SCHEMA_FILE = resolve(REPO_ROOT, 'src/data/dashboard.schema.json');

const chartsSource = readFileSync(CHARTS_FILE, 'utf8');
const { panelTypes } = JSON.parse(readFileSync(ENUM_FILE, 'utf8'));

// Gate: the two vendored artifacts must agree. sync-panel-types.sh writes both
// from ONE fetch, so they cannot drift when the script is used — but a hand-edit
// of either file can still split them, and nothing else would notice. Reading the
// enum out of the schema needs no dependency, so this script stays zero-dep and
// keeps running BEFORE `npm ci` in CI.
const schemaEnum = JSON.parse(readFileSync(SCHEMA_FILE, 'utf8'))?.$defs?.PanelType?.enum;
if (!Array.isArray(schemaEnum) || schemaEnum.length === 0) {
  console.error(
    `ERROR: could not read $defs.PanelType.enum from ${SCHEMA_FILE}. The vendored schema is ` +
      'malformed or its shape changed upstream. Fix: run scripts/sync-panel-types.sh.'
  );
  process.exit(1);
}
const schemaSet = new Set(schemaEnum);
const vendoredSet = new Set(panelTypes);
const onlyInSchema = schemaEnum.filter((t) => !vendoredSet.has(t));
const onlyInVendored = panelTypes.filter((t) => !schemaSet.has(t));
if (onlyInSchema.length > 0 || onlyInVendored.length > 0) {
  console.error(
    'ERROR: the two vendored artifacts disagree — src/data/panel-types.json is out of sync with ' +
      '$defs.PanelType.enum in src/data/dashboard.schema.json.'
  );
  if (onlyInSchema.length > 0) {
    console.error(`  In the schema but not in panel-types.json: ${JSON.stringify(onlyInSchema)}`);
  }
  if (onlyInVendored.length > 0) {
    console.error(`  In panel-types.json but not in the schema: ${JSON.stringify(onlyInVendored)}`);
  }
  console.error('Fix: run ./scripts/sync-panel-types.sh and commit BOTH files.');
  process.exit(1);
}

// Extract every dvtType string-literal value. The regex only matches quoted
// string assignments — the TS interface field `dvtType: string;` has no quotes
// so it never fires here.
const dvtTypeRe = /dvtType:\s*'([^']+)'/g;
const matches = [...chartsSource.matchAll(dvtTypeRe)];

// Sanity guard: if zero literals were found the file shape changed and the
// check would silently pass on an empty set — that's worse than a failure.
if (matches.length === 0) {
  console.error(
    'ERROR: regex /dvtType:\\s*\'([^\']+)\'/g matched nothing in ' + CHARTS_FILE
  );
  console.error('The shape of charts.ts may have changed. Update the regex in this script.');
  process.exit(1);
}

// Strip display-label suffixes of the form " (anything)" to get the base type.
// e.g. "chart:scatter (bubble)" -> "chart:scatter", "table (retention)" -> "table"
const offenders = [];
for (const [, rawValue] of matches) {
  const baseType = rawValue.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!panelTypes.includes(baseType)) {
    offenders.push({ rawValue, baseType });
  }
}

if (offenders.length > 0) {
  console.error('ERROR: the following dvtType values in charts.ts are not in the vendored PanelType enum:');
  for (const { rawValue, baseType } of offenders) {
    console.error(
      `  raw: '${rawValue}'  ->  base: '${baseType}'  (missing from ${ENUM_FILE})`
    );
  }
  console.error('');
  console.error(
    'Fix hint: if the type was renamed/removed upstream, run scripts/sync-panel-types.sh to refresh src/data/panel-types.json; if it\'s a typo, fix charts.ts.'
  );
  process.exit(1);
}

console.log(
  `OK — all ${matches.length} chart/table types in charts.ts are valid PanelType members (${panelTypes.length} in vendored enum).`
);
