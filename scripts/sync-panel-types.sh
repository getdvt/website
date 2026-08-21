#!/usr/bin/env bash
#
# Sync the vendored PanelType enum into src/data/panel-types.json, vendor the
# schema (NORMALIZED - structure only, annotation prose stripped, since this
# repo is public) into src/data/dashboard.schema.json (read by
# scripts/check-chart-specs.mjs), vendor the chart-type status table
# (PROJECTED - type->status only, since this repo is public) into
# src/data/chart-type-status.json (also read by scripts/check-chart-specs.mjs,
# for the data-binding gate), and maintain the provenance this creates in
# TWO more places so a refresh here can't silently go stale elsewhere:
#   - src/data/README.md    — TWO provenance blocks: the schema's, between the
#                              `<!-- provenance:begin -->` / `-end -->` markers,
#                              and the chart-type-status's, between the
#                              `<!-- chart-type-status-provenance:begin -->` /
#                              `-end -->` markers.
#   - scripts/check-chart-types.mjs — the EXPECTED_SHA256 constant (schema) and
#                              the EXPECTED_CHART_TYPE_STATUS_SHA256 constant
#                              (status table).
# All five files come from TWO fetches (schema, chart-types) and are staged,
# then published together — the publish is FIVE `mv`s, so an interrupt between
# them can still split the set. What actually surfaces a split among the five is
# scripts/check-chart-types.mjs, which goes red whenever the drift workflow (or
# a local `npm run check:chart-types`) runs — advisory, not a required check:
# the enum set-compare surfaces a schema/panel-types.json split, the two
# sha256 consistency checks surface a schema/EXPECTED_SHA256 or
# status/EXPECTED_CHART_TYPE_STATUS_SHA256 split, and the two README-staleness
# checks surface a schema/README or status/README split.
#
# Canonical sources of truth:
#   - getdvt/dvt → spec/schema/dashboard.schema.json ($defs.PanelType.enum) —
#     this repo's src/data/panel-types.json is a VENDORED MIRROR so CI can
#     assert that every dvtType in src/data/charts.ts resolves to a real spec
#     type, without a live network call to the private getdvt/dvt repo.
#   - getdvt/dvt → spec/schema/echarts/chart-types.json (types[*].status) —
#     this repo's src/data/chart-type-status.json is a VENDORED WHITELIST
#     PROJECTION (type -> status only; see scripts/project-chart-type-status.mjs
#     for why a projection, not a strip) so scripts/check-chart-specs.mjs can
#     enforce the data-binding contract (passthrough types need inline
#     series[].data; everything else needs a data block) offline.
# Do NOT hand-edit any of the five vendored/maintained files — refresh them
# here and commit the result. CI (.github/workflows/chart-types-drift.yml)
# will catch a stale or split copy.
#
# Source-resolution precedence (applies to BOTH fetches):
#   1. DVT_REPO=/path/to/dvt (env set)  — explicit local checkout; reads origin/main.
#   2. `gh` on PATH + authed            — reads origin/main live via gh api (DEFAULT).
#   3. ../dvt sibling checkout          — reads origin/main; hard-error if not found.
#
# Staleness (applies to every local checkout):
#   Paths 1 and 3 `git fetch -q origin` and then read `origin/main:<path>` — the
#   REF, never the working tree. So a checkout parked on a feature branch, or
#   holding uncommitted schema/chart-types edits, cannot be vendored, and there
#   is no behind-count to check: a post-fetch ref read cannot be stale.
#   Unset DVT_REPO (or install/auth `gh`) to skip local checkouts entirely.
#
# Usage (from the website repo root):
#   ./scripts/sync-panel-types.sh                         # uses gh api (default)
#   DVT_REPO=/path/to/dvt ./scripts/sync-panel-types.sh  # explicit local checkout
#
# macOS note: this must run under bash 3.2 (no assoc arrays), and file rewrites
# use `node`, never `sed -i` (BSD/GNU flag semantics diverge).
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="$REPO_ROOT/src/data/panel-types.json"
SCHEMA_DST="$REPO_ROOT/src/data/dashboard.schema.json"
STATUS_DST="$REPO_ROOT/src/data/chart-type-status.json"
README_FILE="$REPO_ROOT/src/data/README.md"
CCT_FILE="$REPO_ROOT/scripts/check-chart-types.mjs"

# Temp files for the gh-api path, plus the staging files for the five atomic
# writes below; all cleaned up on exit.
TMP_SCHEMA=""
TMP_CT=""
cleanup() {
  if [[ -n "$TMP_SCHEMA" && -f "$TMP_SCHEMA" ]]; then
    rm -f "$TMP_SCHEMA"
  fi
  if [[ -n "$TMP_CT" && -f "$TMP_CT" ]]; then
    rm -f "$TMP_CT"
  fi
  rm -f "$SCHEMA_DST.tmp" "$DST.tmp" "$STATUS_DST.tmp" "$README_FILE.tmp" "$CCT_FILE.tmp"
}
trap cleanup EXIT

# (There is no freshness_check any more. It existed to prove a local checkout was
# not BEHIND origin/main before vendoring from its working tree — but paths 1 and 3
# now fetch and read `origin/main:` directly, and a post-fetch ref read cannot be
# stale, nor can it pick up a feature branch or an uncommitted edit. Reading the
# ref subsumes the check entirely rather than complementing it.)

# ---------------------------------------------------------------------------
# Determine schema + chart-types acquisition path. Each path also resolves
# UPSTREAM_COMMIT — the last commit that actually TOUCHED the schema, not the
# branch tip — and, separately, CT_UPSTREAM_COMMIT — the last commit that
# touched spec/schema/echarts/chart-types.json. These are two DIFFERENT files
# with two DIFFERENT edit histories, so UPSTREAM_COMMIT is schema-path-only BY
# DESIGN; it must never be reused or conflated with CT_UPSTREAM_COMMIT. That's
# what makes each a stable, reproducible `?ref=` pin: re-running this script
# against an unrelated upstream commit (one that doesn't touch either path)
# reproduces the same two commits, rather than needlessly moving either
# provenance pin.
# ---------------------------------------------------------------------------

if [[ -n "${DVT_REPO:-}" ]]; then
  # --- Path 1: explicit DVT_REPO override ---
  echo "Using explicit DVT_REPO: $DVT_REPO" >&2
  if ! git -C "$DVT_REPO" rev-parse --git-dir &>/dev/null; then
    echo "error: DVT_REPO is not a git checkout: $DVT_REPO" >&2
    echo "       Check that DVT_REPO points to a valid getdvt/dvt checkout." >&2
    exit 1
  fi
  # Read the REF, not the working tree. A checkout parked on a feature branch that
  # modifies the schema — or one with uncommitted edits — would otherwise be
  # vendored verbatim, and since the vendored copy is now byte-compared weekly,
  # that surfaces days later as a phantom "upstream drift" pointing at getdvt/dvt
  # instead of at the local tree. This is the workspace's "read the ref, not the
  # working tree" rule (OS-90). A post-fetch ref read also cannot be stale, which
  # is why no separate freshness check is needed on this path.
  echo "Fetching origin in $DVT_REPO ..." >&2
  git -C "$DVT_REPO" fetch -q origin
  UPSTREAM_COMMIT="$(git -C "$DVT_REPO" log -1 --format=%H origin/main -- spec/schema/dashboard.schema.json)"
  if [[ -z "$UPSTREAM_COMMIT" ]]; then
    echo "error: no commit touching spec/schema/dashboard.schema.json found on origin/main in $DVT_REPO." >&2
    exit 1
  fi
  TMP_SCHEMA="$(mktemp)"
  if ! git -C "$DVT_REPO" show origin/main:spec/schema/dashboard.schema.json > "$TMP_SCHEMA"; then
    echo "error: could not read spec/schema/dashboard.schema.json from origin/main in $DVT_REPO." >&2
    exit 1
  fi
  SCHEMA_FILE="$TMP_SCHEMA"
  SCHEMA_SOURCE="$DVT_REPO -> origin/main:spec/schema/dashboard.schema.json"

  CT_UPSTREAM_COMMIT="$(git -C "$DVT_REPO" log -1 --format=%H origin/main -- spec/schema/echarts/chart-types.json)"
  if [[ -z "$CT_UPSTREAM_COMMIT" ]]; then
    echo "error: no commit touching spec/schema/echarts/chart-types.json found on origin/main in $DVT_REPO." >&2
    exit 1
  fi
  TMP_CT="$(mktemp)"
  if ! git -C "$DVT_REPO" show origin/main:spec/schema/echarts/chart-types.json > "$TMP_CT"; then
    echo "error: could not read spec/schema/echarts/chart-types.json from origin/main in $DVT_REPO." >&2
    exit 1
  fi
  CT_FILE="$TMP_CT"
  CT_SOURCE="$DVT_REPO -> origin/main:spec/schema/echarts/chart-types.json"

elif command -v gh &>/dev/null && gh auth status &>/dev/null; then
  # --- Path 2: gh api (default, always fresh) ---
  echo "Using gh api (origin/main) ..." >&2
  # Resolve the last commit that touched the schema path FIRST, then fetch the
  # contents pinned to that exact commit via `?ref=`. This also removes the
  # fetch/sha race the two-step (fetch-then-guess-the-commit) version had.
  UPSTREAM_COMMIT="$(gh api "repos/getdvt/dvt/commits?path=spec/schema/dashboard.schema.json&sha=main&per_page=1" --jq '.[0].sha // empty')"
  if [[ -z "$UPSTREAM_COMMIT" ]]; then
    echo "error: gh api could not resolve the last commit touching spec/schema/dashboard.schema.json on main." >&2
    exit 1
  fi
  TMP_SCHEMA="$(mktemp)"
  if ! gh api "repos/getdvt/dvt/contents/spec/schema/dashboard.schema.json?ref=$UPSTREAM_COMMIT" \
       -H "Accept: application/vnd.github.raw" > "$TMP_SCHEMA"; then
    echo "error: gh api fetch failed." >&2
    exit 1
  fi
  SCHEMA_FILE="$TMP_SCHEMA"
  SCHEMA_SOURCE="gh api repos/getdvt/dvt/contents/spec/schema/dashboard.schema.json (origin/main @ $UPSTREAM_COMMIT)"

  CT_UPSTREAM_COMMIT="$(gh api "repos/getdvt/dvt/commits?path=spec/schema/echarts/chart-types.json&sha=main&per_page=1" --jq '.[0].sha // empty')"
  if [[ -z "$CT_UPSTREAM_COMMIT" ]]; then
    echo "error: gh api could not resolve the last commit touching spec/schema/echarts/chart-types.json on main." >&2
    exit 1
  fi
  TMP_CT="$(mktemp)"
  if ! gh api "repos/getdvt/dvt/contents/spec/schema/echarts/chart-types.json?ref=$CT_UPSTREAM_COMMIT" \
       -H "Accept: application/vnd.github.raw" > "$TMP_CT"; then
    echo "error: gh api fetch failed for spec/schema/echarts/chart-types.json." >&2
    exit 1
  fi
  CT_FILE="$TMP_CT"
  CT_SOURCE="gh api repos/getdvt/dvt/contents/spec/schema/echarts/chart-types.json (origin/main @ $CT_UPSTREAM_COMMIT)"

else
  # --- Path 3: sibling checkout fallback ---
  SIBLING="$REPO_ROOT/../dvt"
  if [[ ! -d "$SIBLING" ]]; then
    echo "error: no gh tool/auth available and no sibling dvt checkout found at:" >&2
    echo "         $SIBLING" >&2
    echo "" >&2
    echo "       To fix, choose one of:" >&2
    echo "         a) Install gh (https://cli.github.com/) and run: gh auth login" >&2
    echo "         b) Set DVT_REPO=/path/to/dvt" >&2
    echo "         c) Check out getdvt/dvt at $SIBLING" >&2
    exit 1
  fi
  # Read the REF, not the working tree — same rationale as path 1 above (OS-90).
  echo "Fetching origin in $SIBLING ..." >&2
  git -C "$SIBLING" fetch -q origin
  UPSTREAM_COMMIT="$(git -C "$SIBLING" log -1 --format=%H origin/main -- spec/schema/dashboard.schema.json)"
  if [[ -z "$UPSTREAM_COMMIT" ]]; then
    echo "error: no commit touching spec/schema/dashboard.schema.json found on origin/main in $SIBLING." >&2
    exit 1
  fi
  TMP_SCHEMA="$(mktemp)"
  if ! git -C "$SIBLING" show origin/main:spec/schema/dashboard.schema.json > "$TMP_SCHEMA"; then
    echo "error: could not read spec/schema/dashboard.schema.json from origin/main in $SIBLING." >&2
    echo "       Check out getdvt/dvt as a sibling of this repo, or set DVT_REPO=/path/to/dvt." >&2
    exit 1
  fi
  SCHEMA_FILE="$TMP_SCHEMA"
  SCHEMA_SOURCE="$SIBLING -> origin/main:spec/schema/dashboard.schema.json"

  CT_UPSTREAM_COMMIT="$(git -C "$SIBLING" log -1 --format=%H origin/main -- spec/schema/echarts/chart-types.json)"
  if [[ -z "$CT_UPSTREAM_COMMIT" ]]; then
    echo "error: no commit touching spec/schema/echarts/chart-types.json found on origin/main in $SIBLING." >&2
    exit 1
  fi
  TMP_CT="$(mktemp)"
  if ! git -C "$SIBLING" show origin/main:spec/schema/echarts/chart-types.json > "$TMP_CT"; then
    echo "error: could not read spec/schema/echarts/chart-types.json from origin/main in $SIBLING." >&2
    echo "       Check out getdvt/dvt as a sibling of this repo, or set DVT_REPO=/path/to/dvt." >&2
    exit 1
  fi
  CT_FILE="$TMP_CT"
  CT_SOURCE="$SIBLING -> origin/main:spec/schema/echarts/chart-types.json"
fi

# ---------------------------------------------------------------------------
# Shape guard — runs on EVERY acquisition path, against whichever $SCHEMA_FILE
# was resolved above. It must be valid JSON with a non-empty $defs.PanelType.enum
# and a $defs.Panel def (the shape scripts/check-chart-specs.mjs validates
# against). If either is missing, an upstream shape change would silently disarm
# the guards that depend on it, so fail loudly here instead.
#
# This deliberately sits AFTER the path selection, not inside the gh-api branch:
# a local checkout (paths 1 and 3) can hold a malformed or reshaped schema just
# as easily as a bad fetch can, and validating only one of the three paths left
# the other two able to clobber the vendored copy with an unusable file.
# ---------------------------------------------------------------------------
GUARD_OK="$(SCHEMA_FILE="$SCHEMA_FILE" node -e '
const fs = require("fs");
try {
  const schema = JSON.parse(fs.readFileSync(process.env.SCHEMA_FILE, "utf8"));
  const arr = (schema["$defs"] || {})["PanelType"] && schema["$defs"]["PanelType"]["enum"];
  if (!Array.isArray(arr) || arr.length === 0) { process.exit(1); }
  if (!(schema["$defs"] || {})["Panel"]) { process.exit(1); }
  process.stdout.write("ok");
} catch(e) { process.exit(1); }
' 2>/dev/null || true)"
if [[ "$GUARD_OK" != "ok" ]]; then
  echo "error: $SCHEMA_SOURCE is not valid JSON, or is missing \$defs.PanelType.enum / \$defs.Panel." >&2
  echo "       Cannot safely update the vendored files; none are touched." >&2
  exit 1
fi

# Same placement rationale as the schema guard above, applied to the
# chart-types fetch: must be valid JSON with a non-empty top-level `types`
# object, same shape scripts/project-chart-type-status.mjs requires. Runs
# after path selection so all three paths are guarded uniformly.
CT_GUARD_OK="$(CT_FILE="$CT_FILE" node -e '
const fs = require("fs");
try {
  const ct = JSON.parse(fs.readFileSync(process.env.CT_FILE, "utf8"));
  const types = ct && ct.types;
  if (!types || typeof types !== "object" || Array.isArray(types) || Object.keys(types).length === 0) { process.exit(1); }
  process.stdout.write("ok");
} catch(e) { process.exit(1); }
' 2>/dev/null || true)"
if [[ "$CT_GUARD_OK" != "ok" ]]; then
  echo "error: $CT_SOURCE is not valid JSON, or is missing a non-empty top-level \"types\" object." >&2
  echo "       Cannot safely update the vendored files; none are touched." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Extract PanelType enum, staging to $DST.tmp.
# Paths are passed via env (not string-interpolated into the JS) so a path with
# a quote/space/newline can't break out of the eval. $defs needs no escaping here.
#
# All five files are STAGED first and moved into place only once every one
# of them has been produced successfully. Writing the schema before extracting
# the enum meant a failed extraction left a clobbered schema next to a stale
# enum — the exact drift the header promises is impossible. `mv` within one
# filesystem is atomic, so an interrupt can no longer leave a truncated ~97KB
# JSON in the tree.
# ---------------------------------------------------------------------------
SCHEMA_FILE="$SCHEMA_FILE" DST="$DST.tmp" node -e '
const fs = require("fs");
const schema = JSON.parse(fs.readFileSync(process.env.SCHEMA_FILE, "utf8"));
const panelTypes = schema["$defs"]["PanelType"]["enum"];
const out = {
  "$comment": "VENDORED mirror of dvt'"'"'s canonical PanelType enum. Do NOT hand-edit. Refresh with: scripts/sync-panel-types.sh — gh api (origin/main) is the default refresh path; DVT_REPO or a sibling checkout are fallbacks, both read from origin/main. Drift from charts.ts is caught by scripts/check-chart-types.mjs in CI (see .github/workflows/chart-types-drift.yml).",
  source: "getdvt/dvt -> spec/schema/dashboard.schema.json -> $defs/PanelType.enum",
  panelTypes,
};
fs.writeFileSync(process.env.DST, JSON.stringify(out, null, 2) + "\n");
'

# Stage the NORMALIZED schema copy — structure only, with `description`/`$comment`/
# `title`/`examples` annotation prose stripped. This repo is PUBLIC and the canonical
# schema's prose is internal engineering commentary (source paths, ADR/ticket history,
# version-scoped security notes), so it must not be published here. See
# scripts/normalize-schema.mjs for why the strip is schema-aware rather than a
# recursive delete.
#
# The same normalizer runs on the live upstream fetch in the weekly drift check, so
# the byte-compare stays valid; it just compares normalized forms on both sides.
# Same $SCHEMA_FILE the extraction above read, so the vendored artifacts are still
# produced from one source and cannot disagree.
node "$REPO_ROOT/scripts/normalize-schema.mjs" "$SCHEMA_FILE" > "$SCHEMA_DST.tmp"

# Stage the PROJECTED chart-type status table — type -> status only, with all
# internal commentary excluded by construction. See
# scripts/project-chart-type-status.mjs for why this is a whitelist projection
# rather than a strip. A projection failure (e.g. an unrecognized status value
# upstream) must abort the WHOLE publish — `set -euo pipefail` covers this
# (the script exits non-zero, the pipeline fails, and the trap cleans up
# $STATUS_DST.tmp along with everything else before any `mv` below runs).
node "$REPO_ROOT/scripts/project-chart-type-status.mjs" "$CT_FILE" > "$STATUS_DST.tmp"

# ---------------------------------------------------------------------------
# Compute the provenance values every remaining artifact needs, all from what
# is already in hand — no extra fetch.
# ---------------------------------------------------------------------------
UPSTREAM_BLOB="$(git hash-object "$SCHEMA_FILE")"
UPSTREAM_SHA256="$(shasum -a 256 "$SCHEMA_FILE" | awk '{print $1}')"
VENDORED_SHA256="$(shasum -a 256 "$SCHEMA_DST.tmp" | awk '{print $1}')"
CT_UPSTREAM_BLOB="$(git hash-object "$CT_FILE")"
CT_UPSTREAM_SHA256="$(shasum -a 256 "$CT_FILE" | awk '{print $1}')"
STATUS_SHA256="$(shasum -a 256 "$STATUS_DST.tmp" | awk '{print $1}')"
TODAY="$(date +%Y-%m-%d)"

# ---------------------------------------------------------------------------
# Stage src/data/README.md — regenerate ONLY the regions between the
# `<!-- provenance:begin -->` / `<!-- provenance:end -->` markers (schema) and
# the `<!-- chart-type-status-provenance:begin -->` /
# `<!-- chart-type-status-provenance:end -->` markers (chart-type status).
# Everything outside the markers is hand-maintained prose and is left
# untouched. Hard-fail if either marker pair is missing or duplicated —
# silently no-op-ing would let the README go stale in a way nothing else
# catches until check-chart-types.mjs's staleness checks fire.
# ---------------------------------------------------------------------------
README_FILE="$README_FILE" README_TMP="$README_FILE.tmp" \
UPSTREAM_COMMIT="$UPSTREAM_COMMIT" UPSTREAM_BLOB="$UPSTREAM_BLOB" \
UPSTREAM_SHA256="$UPSTREAM_SHA256" VENDORED_SHA256="$VENDORED_SHA256" \
CT_UPSTREAM_COMMIT="$CT_UPSTREAM_COMMIT" CT_UPSTREAM_BLOB="$CT_UPSTREAM_BLOB" \
CT_UPSTREAM_SHA256="$CT_UPSTREAM_SHA256" STATUS_SHA256="$STATUS_SHA256" \
TODAY="$TODAY" \
node -e '
const fs = require("fs");
const path = process.env.README_FILE;
const src = fs.readFileSync(path, "utf8");

function replaceBlock(text, beginMarker, endMarker, block) {
  const beginIdx = text.indexOf(beginMarker);
  const endIdx = text.indexOf(endMarker);
  if (beginIdx === -1 || endIdx === -1) {
    console.error("error: provenance markers not found in " + path + " — expected both:");
    console.error("  " + beginMarker);
    console.error("  " + endMarker);
    process.exit(1);
  }
  if (text.indexOf(beginMarker, beginIdx + 1) !== -1 || text.indexOf(endMarker, endIdx + 1) !== -1) {
    console.error("error: duplicate provenance markers in " + path + " for " + beginMarker);
    process.exit(1);
  }
  return text.slice(0, beginIdx) + block + text.slice(endIdx + endMarker.length);
}

const commit = process.env.UPSTREAM_COMMIT;
const blob = process.env.UPSTREAM_BLOB;
const upstreamSha = process.env.UPSTREAM_SHA256;
const vendoredSha = process.env.VENDORED_SHA256;
const today = process.env.TODAY;

const BEGIN = "<!-- provenance:begin — maintained by scripts/sync-panel-types.sh; do not hand-edit between markers -->";
const END = "<!-- provenance:end -->";
const block =
  BEGIN + "\n" +
  "- **Vendored**: " + today + ", from `getdvt/dvt` `origin/main` @ `" + commit + "`\n" +
  "  (blob sha `" + blob + "`, upstream sha256\n" +
  "  `" + upstreamSha + "`).\n" +
  "- **Vendored (normalized) sha256**: `" + vendoredSha + "`.\n" +
  "- **Reproduce it** — the vendored file is a deterministic function of the upstream one:\n" +
  "  ```\n" +
  "  # ?ref= pins the SAME commit this block records. Without it the fetch follows the\n" +
  "  # default branch, so the first upstream schema commit makes the sha mismatch and\n" +
  "  # read as a bug rather than as expected drift.\n" +
  "  gh api \"repos/getdvt/dvt/contents/spec/schema/dashboard.schema.json?ref=" + commit + "\" \\\n" +
  "    -H \"Accept: application/vnd.github.raw\" > /tmp/upstream.json\n" +
  "  node scripts/normalize-schema.mjs /tmp/upstream.json | shasum -a 256   # must match the sha256 above\n" +
  "  ```\n" +
  END;

let out = replaceBlock(src, BEGIN, END, block);

const ctCommit = process.env.CT_UPSTREAM_COMMIT;
const ctBlob = process.env.CT_UPSTREAM_BLOB;
const ctUpstreamSha = process.env.CT_UPSTREAM_SHA256;
const statusSha = process.env.STATUS_SHA256;

const CT_BEGIN = "<!-- chart-type-status-provenance:begin — maintained by scripts/sync-panel-types.sh; do not hand-edit between markers -->";
const CT_END = "<!-- chart-type-status-provenance:end -->";
const ctBlock =
  CT_BEGIN + "\n" +
  "- **Vendored**: " + today + ", from `getdvt/dvt` `origin/main` @ `" + ctCommit + "`\n" +
  "  (blob sha `" + ctBlob + "`, upstream sha256\n" +
  "  `" + ctUpstreamSha + "`).\n" +
  "- **Vendored (projected) sha256**: `" + statusSha + "`.\n" +
  "- **Reproduce it** — the vendored file is a deterministic function of the upstream one:\n" +
  "  ```\n" +
  "  # ?ref= pins the SAME commit this block records. Without it the fetch follows the\n" +
  "  # default branch, so the first upstream chart-types commit makes the sha mismatch and\n" +
  "  # read as a bug rather than as expected drift.\n" +
  "  gh api \"repos/getdvt/dvt/contents/spec/schema/echarts/chart-types.json?ref=" + ctCommit + "\" \\\n" +
  "    -H \"Accept: application/vnd.github.raw\" > /tmp/upstream-chart-types.json\n" +
  "  node scripts/project-chart-type-status.mjs /tmp/upstream-chart-types.json | shasum -a 256   # must match the sha256 above\n" +
  "  ```\n" +
  CT_END;

out = replaceBlock(out, CT_BEGIN, CT_END, ctBlock);

fs.writeFileSync(process.env.README_TMP, out);
'

# ---------------------------------------------------------------------------
# Stage scripts/check-chart-types.mjs — rewrite ONLY the EXPECTED_SHA256 and
# EXPECTED_CHART_TYPE_STATUS_SHA256 constant lines, each by its own anchored
# pattern. Hard-fail unless exactly one line matches each: zero means the
# constant moved or was hand-edited into a different shape (this script would
# then silently fail to keep it in sync), and more than one means something is
# badly wrong with the file.
# ---------------------------------------------------------------------------
CCT_FILE="$CCT_FILE" CCT_TMP="$CCT_FILE.tmp" VENDORED_SHA256="$VENDORED_SHA256" STATUS_SHA256="$STATUS_SHA256" node -e '
const fs = require("fs");
const Q = String.fromCharCode(39);
const path = process.env.CCT_FILE;
let src = fs.readFileSync(path, "utf8");

function rewriteConstant(text, name, value) {
  const re = new RegExp("^const " + name + " = " + Q + "[0-9a-f]{64}" + Q + ";$", "m");
  const matches = text.match(new RegExp(re.source, "gm"));
  if (!matches || matches.length !== 1) {
    console.error("error: expected exactly one " + name + " constant line in " + path + ", found " + (matches ? matches.length : 0));
    process.exit(1);
  }
  const replacement = "const " + name + " = " + Q + value + Q + ";";
  return text.replace(re, replacement);
}

src = rewriteConstant(src, "EXPECTED_SHA256", process.env.VENDORED_SHA256);
src = rewriteConstant(src, "EXPECTED_CHART_TYPE_STATUS_SHA256", process.env.STATUS_SHA256);

fs.writeFileSync(process.env.CCT_TMP, src);
'

# All five files produced — publish them. Each `mv` is atomic, but the SET
# is not: an interrupt between them can leave some published and some stale.
# The order does not change which side is left stale in any useful way, so it
# carries no safety argument — what makes the split visible is that
# check-chart-types.mjs surfaces any resulting split (advisory, not a required
# check: enum set-compare for a schema/panel-types.json split, sha256
# consistency checks for a schema/EXPECTED_SHA256 or
# status/EXPECTED_CHART_TYPE_STATUS_SHA256 split, README-staleness checks for a
# schema/README or status/README split), and re-running this script repairs
# any direction.
mv -f "$DST.tmp" "$DST"
mv -f "$SCHEMA_DST.tmp" "$SCHEMA_DST"
mv -f "$STATUS_DST.tmp" "$STATUS_DST"
mv -f "$README_FILE.tmp" "$README_FILE"
mv -f "$CCT_FILE.tmp" "$CCT_FILE"

echo "synced: $SCHEMA_SOURCE"
echo "    ->: $DST"
echo "    ->: $SCHEMA_DST"
echo "synced: $CT_SOURCE"
echo "    ->: $STATUS_DST"
echo "    ->: $README_FILE (both provenance blocks)"
echo "    ->: $CCT_FILE (both EXPECTED_*_SHA256 constants)"
