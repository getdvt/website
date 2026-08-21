#!/usr/bin/env node
//
// Project dvt's canonical spec/schema/echarts/chart-types.json into a MINIMAL
// WHITELIST for vendoring into THIS PUBLIC REPO: `type -> status` pairs only,
// nothing else.
//
// Why a whitelist projection, not a strip (the same distinction
// scripts/normalize-schema.mjs draws, but stronger here): the upstream file
// is saturated with internal engineering prose at every level — ticket refs,
// ADR citations, security commentary, internal file paths, and per-entry
// `caveat`/`research`/`whenToUse`/`exampleSkeleton` fields. A recursive strip
// (delete known-bad keys, keep everything else) inherits the upstream
// author's vocabulary: a NEW prose key added upstream tomorrow would sail
// straight through un-stripped, because a strip-list only knows what to
// remove, not what is safe to keep. A whitelist projection inverts that: the
// output is built key-by-key from an explicit allowlist (here, just `status`
// per type), so nothing upstream can leak by construction — a new prose key
// upstream is invisible to this script by default, not merely unstripped.
//
// Closed status enum, fail-closed: every entry's `status` must be one of
// `stable` / `passthrough` / `advanced`. A missing status or an unrecognized
// value refuses to project — same philosophy as scripts/normalize-schema.mjs's
// KNOWN_KEYWORDS guard. This matters for two reasons at once: (1) a new status
// value upstream might carry a different data-binding contract that
// scripts/check-chart-specs.mjs has never been audited against, so it must be
// reviewed by a human before it is vendored, and (2) refusing outright (rather
// than passing the raw string through) means an unrecognized value can never
// itself become an unaudited vector for upstream prose to leak into this
// projection.
//
// Zero dependencies: pure Node built-ins, so it runs in CI before `npm ci`.
//
// Used in two places that MUST agree — mirrors scripts/normalize-schema.mjs's
// own rationale for being one shared script rather than two copies:
//   1. scripts/sync-panel-types.sh       — projects before writing the vendored copy.
//   2. .github/workflows/chart-types-drift.yml — projects the live upstream fetch
//      before byte-comparing it against the vendored copy.

import { readFileSync } from 'fs';

const KNOWN_STATUSES = new Set(['stable', 'passthrough', 'advanced']);

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/project-chart-type-status.mjs <chart-types.json>');
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(src, 'utf8'));
} catch (e) {
  console.error(`ERROR: could not parse ${src} as JSON: ${e.message}`);
  process.exit(1);
}

const types = parsed && typeof parsed === 'object' ? parsed.types : undefined;
if (!types || typeof types !== 'object' || Array.isArray(types) || Object.keys(types).length === 0) {
  console.error(`ERROR: ${src} has no non-empty top-level "types" object. Refusing to project.`);
  process.exit(1);
}

// Fail-closed: collect every offender before writing anything, same pattern as
// normalize-schema.mjs — both classes of error must be reported together, and
// stdout must stay at zero bytes if either fires.
const offenders = [];
const projected = {};
for (const [type, entry] of Object.entries(types)) {
  const status = entry && typeof entry === 'object' ? entry.status : undefined;
  if (!KNOWN_STATUSES.has(status)) {
    offenders.push({ type, status });
    continue;
  }
  projected[type] = status;
}

if (offenders.length > 0) {
  console.error(
    `ERROR: ${src} has type(s) with a missing or unrecognized "status" ` +
      `(closed enum: ${[...KNOWN_STATUSES].sort().join('/')}):`
  );
  for (const { type, status } of offenders) {
    console.error(
      `  ${type}: status = ${status === undefined ? '<missing>' : JSON.stringify(status)}`
    );
  }
  console.error('');
  console.error(
    'Refusing to project. A new upstream status value carries an unknown data-binding ' +
      'contract and must be audited by a human — add it to KNOWN_STATUSES here AND teach ' +
      'scripts/check-chart-specs.mjs its rule — before it can be vendored.'
  );
  process.exit(1);
}

// Sorted keys make the projection byte-deterministic regardless of upstream's
// insertion order, so the weekly drift compare (which projects both sides) is
// stable across an upstream reorder that changes nothing semantically.
const sortedTypes = {};
for (const type of Object.keys(projected).sort()) {
  sortedTypes[type] = projected[type];
}

const out = {
  '$comment':
    'VENDORED projection of getdvt/dvt spec/schema/echarts/chart-types.json — ' +
    'type→status ONLY (whitelist projection; the upstream file carries internal ' +
    'commentary that must not be published in this public repo). Do NOT hand-edit. ' +
    'Refresh with: scripts/sync-panel-types.sh. Consumed by scripts/check-chart-specs.mjs; ' +
    'drift caught by .github/workflows/chart-types-drift.yml.',
  source: 'getdvt/dvt -> spec/schema/echarts/chart-types.json -> types[*].status',
  types: sortedTypes,
};

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
