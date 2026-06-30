# dvt-trial-sweep (Cloudflare Worker cron)

Scheduled-only Worker that drives the Gallery-trial retention sweep (DVT-783 / ADR-0052 D5).

On every cron tick it makes a single authenticated `POST` to the dvt-api
trial-sweep endpoint, which purges the content of expired trial orgs (≥30 days
past `trial_ends_at`, `converted_at IS NULL`) and their R2 artifacts. This Worker
holds **no** delete logic and **no** DB access — it is purely the clock. All
scoping and safety guards (`plan='gallery'` filter, `converted_at` suppression,
the `organizations_guard_delete` trigger that keeps the org row, the explicit
`entity_revisions` prune, per-org transaction) live in the API:
`dvt/server/internal/repo/trial.go` (`SweepExpiredTrials`).

It is deliberately deployed as a **standalone Worker**, not a Pages Function:
Cloudflare cron triggers are a Workers-only feature, and the dvt.dev site is a
Pages project. (Mirrors `workers/sandbox-reaper`.)

## Why it's safe

- No `fetch` handler → unreachable over HTTP → the credentials it holds cannot be
  exercised by any external caller; only the cron schedule drives it.
- The sweep requires **both** factors (ADR-0052 D5); a leak of one is not enough.
- Fails closed: until both secrets are set on the Worker **and** dvt-api, the
  endpoint returns 401 and nothing is purged.

## Deploy

```bash
cd workers/trial-sweep

# 1. One-time: set the two secrets (must match TRIAL_PROVISION_KEY / TRIAL_CRON_SECRET on dvt-api)
npx wrangler secret put TRIAL_PROVISION_KEY
npx wrangler secret put TRIAL_CRON_SECRET

# 2. Deploy (registers the worker + the daily cron trigger)
npx wrangler deploy
```

Requires `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in the environment.

## Operate

```bash
npx wrangler tail dvt-trial-sweep   # live logs (each tick logs the SweepResult)
```

Schedule: daily at 03:00 UTC (`0 3 * * *`). The sweep is idempotent and cheap
when nothing is eligible, and retention is a 30-day boundary, so daily is ample.
Change the cadence in `wrangler.toml` (`[triggers].crons`).

### ⚠️ Secret rotation — rotate in BOTH places

`TRIAL_PROVISION_KEY` / `TRIAL_CRON_SECRET` live in two systems: the dvt-api Fly
app (`flyctl secrets set … -a dvt-api`) and this Worker (`wrangler secret put`).
They must stay identical. If you rotate them on dvt-api **without** re-running
`wrangler secret put` here, the sweep silently 401s and expired trials stop being
purged (fail-closed — no wrong deletes, but the retention gap reopens). The
failure is visible via `wrangler tail` / the CF cron dashboard but is **not yet
alerted** (follow-up). Always rotate both, in both places, together.
