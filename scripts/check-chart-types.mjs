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
//     .github/workflows/chart-types-drift.yml, which reads origin/main's enum live
//     via `gh api` using a short-lived getdvt-ci-reader GitHub App token (gated on
//     the DVT_SCHEMA_APP_ID variable). The sweep is a no-op until the App is
//     provisioned — see .github/github-app-ci-reader.md.
//
// Zero external dependencies: reads two local files, pure Node built-ins.
//

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARTS_FILE = resolve(REPO_ROOT, 'src/data/charts.ts');
const ENUM_FILE = resolve(REPO_ROOT, 'src/data/panel-types.json');

const chartsSource = readFileSync(CHARTS_FILE, 'utf8');
const { panelTypes } = JSON.parse(readFileSync(ENUM_FILE, 'utf8'));

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
