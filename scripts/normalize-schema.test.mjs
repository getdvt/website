#!/usr/bin/env node
//
// Self-test for scripts/normalize-schema.mjs. Zero-dep (node built-ins only), so
// it runs in CI immediately before the fixed-point check — before `npm ci`.
//
// Covers the failure/pass modes the schema-aware, opaque-scanning walk exists to
// distinguish:
//   1. TRIP (enum)   — a STRIP key (description/$comment) appears INSIDE an
//      opaque (enum/const/default/examples) value. The normalizer must refuse
//      to normalize, write ZERO bytes to stdout, and name the exact path in
//      stderr.
//   2. PASS          — a real schema property literally NAMED "description"
//      (there are 7 of these in the actual vendored schema). The property
//      DEFINITION must survive; only its own `description` annotation sibling
//      is stripped.
//   3. TRIP (const)  — the same STRIP-inside-opaque refusal, but nested inside
//      `const` instead of `enum`, and using `$comment` instead of `description`
//      — both OPAQUE keywords and both STRIP keys must be covered, not just one
//      of each.
//   4. UNKNOWN       — a keyword this normalizer has never been audited against
//      must also refuse to normalize and write ZERO bytes to stdout.
//   5. BOTH          — a fixture with both an unknown keyword AND an opaque
//      violation must report BOTH in stderr (the `hasError` accumulator runs
//      both checks before exiting, rather than stopping at the first).
//   6. OPAQUE-PASS   — a violation-free opaque object value (no STRIP keys
//      nested inside it) must survive byte-identical, alongside a sibling
//      `description` annotation on the same node being stripped as normal.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), 'normalize-schema.mjs');
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

const dir = mkdtempSync(join(tmpdir(), 'normalize-schema-test-'));

try {
  // --- Fixture 1: TRIP — a STRIP key nested inside an opaque value ---
  const tripFile = join(dir, 'trip.schema.json');
  writeFileSync(
    tripFile,
    JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'string',
      enum: [{ description: 'leaked prose' }],
    })
  );
  const trip = spawnSync(NODE, [SCRIPT, tripFile], { encoding: 'utf8' });
  ok('TRIP fixture exits non-zero', trip.status !== 0, `exit ${trip.status}`);
  ok('TRIP fixture writes 0 bytes to stdout', trip.stdout.length === 0, `got ${trip.stdout.length} bytes`);
  ok('TRIP fixture names the exact path in stderr', trip.stderr.includes('enum[0]/description'), trip.stderr);

  // --- Fixture 2: PASS — a real property literally named "description" ---
  const passFile = join(dir, 'pass.schema.json');
  writeFileSync(
    passFile,
    JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'annotation to strip',
        },
      },
    })
  );
  const pass = spawnSync(NODE, [SCRIPT, passFile], { encoding: 'utf8' });
  ok('PASS fixture exits zero', pass.status === 0, `exit ${pass.status}, stderr: ${pass.stderr}`);

  let passOut = null;
  try {
    passOut = JSON.parse(pass.stdout);
  } catch (e) {
    passOut = null;
  }
  ok('PASS fixture output is valid JSON', passOut !== null, pass.stdout);
  ok(
    'PASS fixture keeps the "description" property definition',
    !!passOut?.properties?.description && passOut.properties.description.type === 'string',
    JSON.stringify(passOut)
  );
  ok(
    'PASS fixture strips the nested description annotation',
    !!passOut?.properties?.description && !('description' in passOut.properties.description),
    JSON.stringify(passOut)
  );

  // --- Fixture 3: TRIP (const/$comment variant) — same refusal, different
  // opaque keyword (const, not enum) and different STRIP key ($comment, not
  // description) — both must be covered, not just one of each. ---
  const constTripFile = join(dir, 'const-trip.schema.json');
  writeFileSync(
    constTripFile,
    JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        foo: {
          type: 'object',
          const: { $comment: 'leaked prose' },
        },
      },
    })
  );
  const constTrip = spawnSync(NODE, [SCRIPT, constTripFile], { encoding: 'utf8' });
  ok('CONST-TRIP fixture exits non-zero', constTrip.status !== 0, `exit ${constTrip.status}`);
  ok(
    'CONST-TRIP fixture writes 0 bytes to stdout',
    constTrip.stdout.length === 0,
    `got ${constTrip.stdout.length} bytes`
  );
  ok(
    'CONST-TRIP fixture names the exact path in stderr',
    constTrip.stderr.includes('properties/foo/const/$comment'),
    constTrip.stderr
  );

  // --- Fixture 4: UNKNOWN — a keyword this normalizer has never been audited
  // against must also refuse to normalize and write 0 stdout bytes. ---
  const unknownFile = join(dir, 'unknown.schema.json');
  writeFileSync(
    unknownFile,
    JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'string',
      unknownKeyword123: true,
    })
  );
  const unknown = spawnSync(NODE, [SCRIPT, unknownFile], { encoding: 'utf8' });
  ok('UNKNOWN fixture exits non-zero', unknown.status !== 0, `exit ${unknown.status}`);
  ok(
    'UNKNOWN fixture writes 0 bytes to stdout',
    unknown.stdout.length === 0,
    `got ${unknown.stdout.length} bytes`
  );
  ok('UNKNOWN fixture names the keyword in stderr', unknown.stderr.includes('unknownKeyword123'), unknown.stderr);

  // --- Fixture 5: BOTH — a fixture with both an unknown keyword AND an opaque
  // violation must report BOTH in stderr (the `hasError` accumulator runs both
  // checks before exiting, rather than stopping at the first). ---
  const bothFile = join(dir, 'both.schema.json');
  writeFileSync(
    bothFile,
    JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'string',
      unknownKeyword456: true,
      enum: [{ description: 'leaked prose' }],
    })
  );
  const both = spawnSync(NODE, [SCRIPT, bothFile], { encoding: 'utf8' });
  ok('BOTH fixture exits non-zero', both.status !== 0, `exit ${both.status}`);
  ok('BOTH fixture writes 0 bytes to stdout', both.stdout.length === 0, `got ${both.stdout.length} bytes`);
  ok('BOTH fixture reports the unknown-keyword error', both.stderr.includes('unknownKeyword456'), both.stderr);
  ok('BOTH fixture reports the opaque-violation error', both.stderr.includes('enum[0]/description'), both.stderr);

  // --- Fixture 6: OPAQUE-PASS — a violation-free opaque object value (no
  // STRIP keys nested inside it) must survive byte-identical, alongside a
  // sibling `description` annotation on the same node being stripped as
  // normal. ---
  const opaquePassFile = join(dir, 'opaque-pass.schema.json');
  const opaqueDefault = { someKey: 1 };
  writeFileSync(
    opaquePassFile,
    JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        foo: {
          type: 'object',
          default: opaqueDefault,
          description: 'annotation to strip',
        },
      },
    })
  );
  const opaquePass = spawnSync(NODE, [SCRIPT, opaquePassFile], { encoding: 'utf8' });
  ok(
    'OPAQUE-PASS fixture exits zero',
    opaquePass.status === 0,
    `exit ${opaquePass.status}, stderr: ${opaquePass.stderr}`
  );

  let opaquePassOut = null;
  try {
    opaquePassOut = JSON.parse(opaquePass.stdout);
  } catch (e) {
    opaquePassOut = null;
  }
  ok('OPAQUE-PASS fixture output is valid JSON', opaquePassOut !== null, opaquePass.stdout);
  ok(
    'OPAQUE-PASS fixture keeps the opaque `default` value byte-identical to the input',
    JSON.stringify(opaquePassOut?.properties?.foo?.default) === JSON.stringify(opaqueDefault),
    JSON.stringify(opaquePassOut)
  );
  ok(
    'OPAQUE-PASS fixture strips the sibling description annotation',
    !!opaquePassOut?.properties?.foo && !('description' in opaquePassOut.properties.foo),
    JSON.stringify(opaquePassOut)
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll normalize-schema.mjs self-test assertions passed.');
