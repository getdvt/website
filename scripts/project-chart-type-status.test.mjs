#!/usr/bin/env node
//
// Self-test for scripts/project-chart-type-status.mjs. Zero-dep (node
// built-ins only), so it can run in CI before `npm ci`.
//
// Covers:
//   1. PROSE-SCRUBBED — a fixture carrying prose keys at every level (top-level
//      $comment/$editableControlsComment/editableControlDefs, per-entry
//      caveat/research/whenToUse/exampleSkeleton) with distinctive sentinel
//      strings. Output must parse, `types` must map exactly the input types to
//      their statuses, and the raw output string must NOT contain any sentinel
//      — proving the projection is a whitelist, not a strip.
//   2. SHAPE — output top-level keys are exactly $comment/source/types.
//   3. UNKNOWN-STATUS — an unrecognized status value exits non-zero, 0 stdout bytes.
//   4. MISSING-STATUS — a type with no status exits non-zero, 0 stdout bytes.
//   5. MISSING-TYPES / EMPTY-TYPES — no top-level `types`, or an empty one,
//      both exit non-zero, 0 stdout bytes.
//   6. DETERMINISM — unsorted input type keys produce sorted output keys, and
//      running twice on the same input is byte-identical.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'project-chart-type-status.mjs');
const NODE = process.execPath;

let failures = 0;
function ok(label, cond, detail) {
  if (cond) {
    console.log(`OK — ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL — ${label}${detail !== undefined ? `: ${detail}` : ''}`);
  }
}

const dir = mkdtempSync(join(tmpdir(), 'project-chart-type-status-test-'));

try {
  // --- Fixture 1: PROSE-SCRUBBED ---
  const proseFile = join(dir, 'prose.json');
  writeFileSync(
    proseFile,
    JSON.stringify({
      '$comment': 'SENTINEL-INTERNAL-PROSE top-level',
      '$editableControlsComment': 'SENTINEL-INTERNAL-PROSE editable-controls',
      editableControlDefs: { foo: 'SENTINEL-INTERNAL-PROSE editable-control-defs' },
      types: {
        'chart:bar': {
          status: 'stable',
          caveat: 'SENTINEL-INTERNAL-PROSE caveat',
          research: 'SENTINEL-INTERNAL-PROSE research',
          whenToUse: 'SENTINEL-INTERNAL-PROSE when-to-use',
          exampleSkeleton: { note: 'SENTINEL-INTERNAL-PROSE example-skeleton' },
        },
        'chart:boxplot': {
          status: 'passthrough',
          caveat: 'SENTINEL-INTERNAL-PROSE caveat 2',
        },
      },
    })
  );
  const prose = spawnSync(NODE, [SCRIPT, proseFile], { encoding: 'utf8' });
  ok('PROSE-SCRUBBED fixture exits zero', prose.status === 0, `exit ${prose.status}, stderr: ${prose.stderr}`);

  let proseOut = null;
  try {
    proseOut = JSON.parse(prose.stdout);
  } catch (e) {
    proseOut = null;
  }
  ok('PROSE-SCRUBBED fixture output is valid JSON', proseOut !== null, prose.stdout);
  ok(
    'PROSE-SCRUBBED fixture maps exactly the input types to their statuses',
    JSON.stringify(proseOut?.types) === JSON.stringify({ 'chart:bar': 'stable', 'chart:boxplot': 'passthrough' }),
    JSON.stringify(proseOut)
  );
  ok(
    'PROSE-SCRUBBED fixture raw output contains NO sentinel string',
    !prose.stdout.includes('SENTINEL-INTERNAL-PROSE'),
    prose.stdout
  );

  // --- Fixture 2: SHAPE — top-level keys are exactly $comment/source/types ---
  ok(
    'SHAPE fixture has exactly the keys $comment/source/types',
    proseOut !== null && JSON.stringify(Object.keys(proseOut).sort()) === JSON.stringify(['$comment', 'source', 'types']),
    JSON.stringify(proseOut && Object.keys(proseOut))
  );

  // --- Fixture 3: UNKNOWN-STATUS ---
  const unknownFile = join(dir, 'unknown-status.json');
  writeFileSync(
    unknownFile,
    JSON.stringify({
      types: {
        'chart:bar': { status: 'stable' },
        'chart:experimental': { status: 'beta' },
      },
    })
  );
  const unknown = spawnSync(NODE, [SCRIPT, unknownFile], { encoding: 'utf8' });
  ok('UNKNOWN-STATUS fixture exits non-zero', unknown.status !== 0, `exit ${unknown.status}`);
  ok('UNKNOWN-STATUS fixture writes 0 bytes to stdout', unknown.stdout.length === 0, `got ${unknown.stdout.length} bytes`);
  ok('UNKNOWN-STATUS fixture names the offending type', unknown.stderr.includes('chart:experimental'), unknown.stderr);
  ok('UNKNOWN-STATUS fixture names the offending value', unknown.stderr.includes('beta'), unknown.stderr);

  // --- Fixture 4: MISSING-STATUS ---
  const missingStatusFile = join(dir, 'missing-status.json');
  writeFileSync(
    missingStatusFile,
    JSON.stringify({
      types: {
        'chart:bar': { status: 'stable' },
        'chart:no-status': { whenToUse: 'no status field at all' },
      },
    })
  );
  const missingStatus = spawnSync(NODE, [SCRIPT, missingStatusFile], { encoding: 'utf8' });
  ok('MISSING-STATUS fixture exits non-zero', missingStatus.status !== 0, `exit ${missingStatus.status}`);
  ok(
    'MISSING-STATUS fixture writes 0 bytes to stdout',
    missingStatus.stdout.length === 0,
    `got ${missingStatus.stdout.length} bytes`
  );
  ok('MISSING-STATUS fixture names the offending type', missingStatus.stderr.includes('chart:no-status'), missingStatus.stderr);

  // --- Fixture 5a: MISSING-TYPES — no top-level `types` key at all ---
  const missingTypesFile = join(dir, 'missing-types.json');
  writeFileSync(missingTypesFile, JSON.stringify({ '$comment': 'no types here' }));
  const missingTypes = spawnSync(NODE, [SCRIPT, missingTypesFile], { encoding: 'utf8' });
  ok('MISSING-TYPES fixture exits non-zero', missingTypes.status !== 0, `exit ${missingTypes.status}`);
  ok(
    'MISSING-TYPES fixture writes 0 bytes to stdout',
    missingTypes.stdout.length === 0,
    `got ${missingTypes.stdout.length} bytes`
  );

  // --- Fixture 5b: EMPTY-TYPES — an empty `types` object ---
  const emptyTypesFile = join(dir, 'empty-types.json');
  writeFileSync(emptyTypesFile, JSON.stringify({ types: {} }));
  const emptyTypes = spawnSync(NODE, [SCRIPT, emptyTypesFile], { encoding: 'utf8' });
  ok('EMPTY-TYPES fixture exits non-zero', emptyTypes.status !== 0, `exit ${emptyTypes.status}`);
  ok(
    'EMPTY-TYPES fixture writes 0 bytes to stdout',
    emptyTypes.stdout.length === 0,
    `got ${emptyTypes.stdout.length} bytes`
  );

  // --- Fixture 6: DETERMINISM — unsorted input keys sort in the output, and
  // running twice on the same input is byte-identical. ---
  const unsortedFile = join(dir, 'unsorted.json');
  writeFileSync(
    unsortedFile,
    JSON.stringify({
      types: {
        'chart:scatter': { status: 'stable' },
        'chart:bar': { status: 'stable' },
        'chart:boxplot': { status: 'passthrough' },
      },
    })
  );
  const run1 = spawnSync(NODE, [SCRIPT, unsortedFile], { encoding: 'utf8' });
  const run2 = spawnSync(NODE, [SCRIPT, unsortedFile], { encoding: 'utf8' });
  ok('DETERMINISM fixture exits zero both runs', run1.status === 0 && run2.status === 0, `${run1.status}, ${run2.status}`);
  ok('DETERMINISM fixture is byte-identical across two runs', run1.stdout === run2.stdout, 'stdout differed');

  let unsortedOut = null;
  try {
    unsortedOut = JSON.parse(run1.stdout);
  } catch (e) {
    unsortedOut = null;
  }
  ok(
    'DETERMINISM fixture output keys are sorted',
    unsortedOut !== null && JSON.stringify(Object.keys(unsortedOut.types)) === JSON.stringify(['chart:bar', 'chart:boxplot', 'chart:scatter']),
    JSON.stringify(unsortedOut && Object.keys(unsortedOut.types))
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll project-chart-type-status.mjs self-test assertions passed.');
