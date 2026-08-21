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
// per type). VALUES cannot leak by construction — the allowlist only ever
// copies a `status` string that already passed the closed-enum check below.
// KEYS are a different story: a type key is an upstream-authored string that
// passes straight through, so it is only as safe as the shape check enforces
// (see the key-shape guard below) — a whitelist on values alone would not
// stop a prose sentence smuggled in AS a key.
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

// Closed key shape: a real chart type is a colon-segmented lowercase
// identifier, e.g. `chart:bar`, `chart:bar:stacked-percent`. This is a
// second, independent fail-closed guard alongside the status enum: a type
// KEY is an upstream-authored string that this script copies straight
// through (unlike a `status` VALUE, which is checked against a closed enum
// before it is ever copied), so a prose sentence smuggled in AS a key —
// e.g. `"chart:internal — see DVT-9999"` — would otherwise sail through
// un-audited. All 35 real upstream keys conform to this shape.
const KEY_SHAPE_RE = /^[a-z][a-z0-9]*(?::[a-z0-9-]+)*$/;

// Bound any offending status/key echoed back into the refusal message — an
// upstream prose string used AS a key or a value could itself be long, and
// this script's own stderr must not become a second leak vector for it.
const MAX_OFFENDER_ECHO = 60;
function truncateForEcho(value) {
  const s = JSON.stringify(value);
  return s.length > MAX_OFFENDER_ECHO ? `${s.slice(0, MAX_OFFENDER_ECHO)}...` : s;
}

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
// stdout must stay at zero bytes if either fires. `Object.create(null)` (not
// `{}`) for every map built from upstream-authored keys, so an upstream type
// key of `__proto__` cannot silently land on `Object.prototype` and drop out
// of enumeration instead of being flagged.
const offenders = [];
const projected = Object.create(null);
for (const [type, entry] of Object.entries(types)) {
  if (!KEY_SHAPE_RE.test(type)) {
    offenders.push({ type, status: undefined, reason: 'bad-key-shape' });
    continue;
  }
  const status = entry && typeof entry === 'object' ? entry.status : undefined;
  if (!KNOWN_STATUSES.has(status)) {
    offenders.push({ type, status, reason: 'bad-status' });
    continue;
  }
  projected[type] = status;
}

if (offenders.length > 0) {
  console.error(
    `ERROR: ${src} has type(s) with a bad key shape or a missing/unrecognized "status" ` +
      `(closed enum: ${[...KNOWN_STATUSES].sort().join('/')}; ` +
      `key shape: ${KEY_SHAPE_RE}):`
  );
  for (const { type, status, reason } of offenders) {
    if (reason === 'bad-key-shape') {
      console.error(`  ${truncateForEcho(type)}: key does not match the closed key shape`);
    } else {
      console.error(
        `  ${truncateForEcho(type)}: status = ` +
          `${status === undefined ? '<missing>' : truncateForEcho(status)}`
      );
    }
  }
  console.error('');
  console.error(
    'Refusing to project. A key that does not match the closed shape, or a new upstream ' +
      'status value, carries an unaudited risk (respectively: prose smuggled in as a key, or ' +
      'an unknown data-binding contract) and must be reviewed by a human — fix the shape, or ' +
      'add the status to KNOWN_STATUSES here AND teach scripts/check-chart-specs.mjs its rule ' +
      '— before it can be vendored.'
  );
  process.exit(1);
}

// Sorted keys make the projection byte-deterministic regardless of upstream's
// insertion order, so the weekly drift compare (which projects both sides) is
// stable across an upstream reorder that changes nothing semantically.
const sortedTypes = Object.create(null);
for (const type of Object.keys(projected).sort()) {
  sortedTypes[type] = projected[type];
}

// Output-count assertion: the number of projected entries must exactly equal
// the number of input `types` entries. Every input entry either lands in
// `projected` or is collected in `offenders` above (which exits before this
// point), so this can only fail if a future edit changes that invariant —
// catch that here rather than silently emitting a truncated projection.
const inputCount = Object.keys(types).length;
const projectedCount = Object.keys(sortedTypes).length;
if (projectedCount !== inputCount) {
  console.error(
    `ERROR: internal invariant violated: projected ${projectedCount} entr${projectedCount === 1 ? 'y' : 'ies'} ` +
      `but input ${src} has ${inputCount} "types" entr${inputCount === 1 ? 'y' : 'ies'}. Refusing to write a ` +
      'mismatched projection.'
  );
  process.exit(1);
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
