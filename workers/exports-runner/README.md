# dvt-exports-runner (Cloudflare Worker cron)

Scheduled-only Worker that drives the scheduled-exports runner (DVT-727 / ADR-0051 §5).

On every cron tick it makes a single authenticated `POST` to the dvt-api exports
tick endpoint, which selects due export schedules, renders each dashboard, and
fans the rendered artifact out to the schedule's delivery channels. This Worker
holds **no** runner logic and **no** DB access — it is purely the clock. All
selection and safety guards (`FOR UPDATE SKIP LOCKED` due-selection, the
idempotent `UNIQUE(schedule_id, fired_at)` run insert with quantized `fired_at`,
fire-time re-authorization, retry backoff) live in the API:
`dvt/server/internal/api/export_runner.go`.

It is deliberately deployed as a **standalone Worker**, not a Pages Function:
Cloudflare cron triggers are a Workers-only feature, and the dvt.dev site is a
Pages project. Mirrors the `sandbox-reaper` precedent (ADR-0042 D7).

## Why it's safe

- No `fetch` handler → unreachable over HTTP → the credentials it holds cannot be
  exercised by any external caller; only the cron schedule drives it.
- The tick endpoint requires **both** factors (ADR-0051 §5); a leak of one is not
  enough. Both are distinct from `INTERNAL_API_KEY` and the `SANDBOX_*` secrets so
  a leak of one trigger secret cannot fire another subsystem.
- The tick is idempotent: a retried/overlapping tick computes the same quantized
  `fired_at`, so the unique constraint prevents a second run → no double-delivery.

## Deploy

```bash
cd workers/exports-runner

# 1. One-time: set the two secrets (must match the EXPORTS_* secrets on dvt-api)
npx wrangler secret put EXPORTS_INTERNAL_KEY
npx wrangler secret put EXPORTS_CRON_SECRET

# 2. Deploy (registers the worker + the hourly cron trigger)
npx wrangler deploy
```

Requires `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in the environment.

## Operate

```bash
npx wrangler tail dvt-exports-runner   # live logs (each tick logs the run summary)
```

Schedule: hourly (`0 * * * *`). NOTE (ADR-0051 §6): with an hourly trigger a
sub-hourly cron expression coalesces to one fire per tick — "more often than
hourly" is not honored until this cadence is raised. Change the cadence in
`wrangler.toml` (`[triggers].crons`).

### ⚠️ Secret rotation — rotate in BOTH places

`EXPORTS_INTERNAL_KEY` / `EXPORTS_CRON_SECRET` live in two systems: the dvt-api
Fly app (`flyctl secrets set … -a dvt-api`) and this Worker (`wrangler secret put`).
They must stay identical. If you rotate them on dvt-api **without** re-running
`wrangler secret put` here, the runner silently 401s and no schedule fires
(fail-closed — nothing delivered wrongly, but exports stop). The failure is
visible via `wrangler tail` / the CF cron dashboard but is **not yet alerted**
(DVT-732 follow-up). Always rotate both, in both places, together.

## Typecheck

```bash
npx tsc -p tsconfig.json
```
