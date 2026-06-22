#!/usr/bin/env bash
#
# Sync the vendored PanelType enum into src/data/panel-types.json.
#
# Canonical source of truth: getdvt/dvt → spec/schema/dashboard.schema.json
# ($defs.PanelType.enum). This repo's src/data/panel-types.json is a VENDORED
# MIRROR so CI can assert that every dvtType in src/data/charts.ts resolves to
# a real spec type, without a live network call to the private getdvt/dvt repo.
# Do NOT hand-edit the vendored copy — refresh it here and commit the result.
# CI (.github/workflows/chart-types-drift.yml) will catch a stale copy.
#
# Usage (from the website repo root, with the dvt repo checked out as a sibling):
#   ./scripts/sync-panel-types.sh
#   DVT_REPO=/path/to/dvt ./scripts/sync-panel-types.sh   # explicit source location
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${DVT_REPO:-$REPO_ROOT/../dvt}/spec/schema/dashboard.schema.json"
DST="$REPO_ROOT/src/data/panel-types.json"

if [[ ! -f "$SRC" ]]; then
  echo "error: canonical source not found at:" >&2
  echo "         $SRC" >&2
  echo "       Check out getdvt/dvt as a sibling of this repo, or set DVT_REPO=/path/to/dvt." >&2
  exit 1
fi

# Paths are passed via env (not string-interpolated into the JS) so a path with
# a quote/space/newline can't break out of the eval. $defs needs no escaping here.
SRC="$SRC" DST="$DST" node -e '
const fs = require("fs");
const schema = JSON.parse(fs.readFileSync(process.env.SRC, "utf8"));
const panelTypes = schema["$defs"]["PanelType"]["enum"];
const out = {
  "$comment": "VENDORED mirror of dvt'"'"'s canonical PanelType enum. Do NOT hand-edit. Refresh with: scripts/sync-panel-types.sh (with getdvt/dvt checked out as a FRESH sibling at origin/main — a stale checkout will vendor a stale enum). Drift from charts.ts is caught by scripts/check-chart-types.mjs in CI (see .github/workflows/chart-types-drift.yml).",
  source: "getdvt/dvt -> spec/schema/dashboard.schema.json -> $defs/PanelType.enum",
  panelTypes,
};
fs.writeFileSync(process.env.DST, JSON.stringify(out, null, 2) + "\n");
'

echo "synced: $SRC"
echo "    ->: $DST"
