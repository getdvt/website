<!--
Repo-specific merge-safety guidance for the auto-approve confidence judge in
.github/workflows/pr-agent.yml. The workflow appends this file to a generic
gatekeeper system prompt, so the workflow itself stays identical across repos
and each repo tunes its own risk rules here. Keep it short and concrete.
-->
This repository is the dvt website (dvt.dev): Astro front end with Cloudflare
Pages Functions and a D1 database. Trivially safe (high confidence): copy/docs,
comments, or a config typo.

Score lower (route to human review) for anything touching:

- The handraise API / form-submission endpoints
- D1 schema or migrations
- Secrets, API tokens, or environment bindings
- Build or deploy configuration (wrangler, Pages, CI)
- `src/data/dashboard.schema.json` / `src/data/panel-types.json`, `scripts/normalize-schema.mjs`, or
  `scripts/sync-panel-types.sh` — these vendor NORMALIZED content from private `getdvt/dvt` into this
  public repo (a public-disclosure boundary); `normalize-schema.mjs` strips upstream's internal
  annotation prose before anything lands here. A diff touching any of the three must keep the strip +
  fixed-point + provenance machinery intact.
- `src/data/chart-type-status.json` / `scripts/project-chart-type-status.mjs` — the status file is a
  whitelist PROJECTION, not a strip: its output is built key-by-key from an explicit allowlist
  (`status` per type, closed enum), not by removing known-bad keys from upstream. Any PR widening the
  projector's `KNOWN_STATUSES`, its key-shape rule, or its output fields changes a public-disclosure
  boundary and must never be scored trivially safe.
