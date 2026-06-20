# dvt-sandbox-reaper (Cloudflare Worker cron)

Scheduled-only Worker that drives the demo-sandbox reaper (DVT-437 / ADR-0042 D7).

On every cron tick it makes a single authenticated `POST` to the dvt-api reaper
endpoint, which hard-deletes expired sandbox orgs and their R2 artifacts. This
Worker holds **no** delete logic and **no** DB access — it is purely the clock.
All scoping and safety guards (`is_sandbox` filter, advisory lock, idempotency)
live in the API: `dvt/server/internal/repo/sandbox.go`.

It is deliberately deployed as a **standalone Worker**, not a Pages Function:
Cloudflare cron triggers are a Workers-only feature, and the dvt.dev site is a
Pages project.

## Why it's safe

- No `fetch` handler → unreachable over HTTP → the credentials it holds cannot be
  exercised by any external caller; only the cron schedule drives it.
- The reaper requires **both** factors (ADR-0042 D7); a leak of one is not enough.

## Deploy

```bash
cd workers/sandbox-reaper

# 1. One-time: set the two secrets (must match the SANDBOX_* secrets on dvt-api)
npx wrangler secret put SANDBOX_INTERNAL_KEY
npx wrangler secret put SANDBOX_CRON_SECRET

# 2. Deploy (registers the worker + the hourly cron trigger)
npx wrangler deploy
```

Requires `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in the environment.

## Operate

```bash
npx wrangler tail dvt-sandbox-reaper   # live logs (each tick logs the ReapResult)
```

Schedule: hourly (`0 * * * *`). The reaper is idempotent and cheap when nothing
is expired, so an hourly cadence bounds a leaked sandbox to ≤1h past its 24h TTL.
Change the cadence in `wrangler.toml` (`[triggers].crons`).

## Typecheck

```bash
npx tsc -p tsconfig.json
```
