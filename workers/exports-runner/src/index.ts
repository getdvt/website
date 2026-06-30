/**
 * dvt-exports-runner — Cloudflare Worker cron trigger (DVT-727 / ADR-0051 §5).
 *
 * On each scheduled tick this Worker makes a single authenticated POST to the
 * dvt-api exports tick endpoint, which selects due export schedules, renders
 * each dashboard, and fans the artifact out to its delivery channels. The
 * Worker carries NO runner logic and NO database access — it is purely the
 * clock. Every guard (due-selection, FOR UPDATE SKIP LOCKED, idempotent
 * UNIQUE(schedule_id, fired_at) run insert, fire-time re-authorization, retry
 * backoff) lives in the API. This mirrors the sandbox reaper precedent
 * (ADR-0042 D7) — the proven CF Cron → authenticated internal-endpoint pattern.
 *
 * Auth: the tick endpoint requires BOTH factors (ADR-0051 §5) —
 *   Authorization: Bearer <EXPORTS_INTERNAL_KEY>
 *   X-Cron-Secret: <EXPORTS_CRON_SECRET>
 * both of which must match the EXPORTS_* secrets on the dvt-api Fly app. They
 * are deliberately distinct from INTERNAL_API_KEY (render callback) and the
 * SANDBOX_* secrets so a leak of one trigger secret cannot fire another
 * subsystem.
 *
 * There is intentionally no `fetch` handler: this Worker is unreachable over
 * HTTP and can only be driven by its cron trigger, so the credentials it holds
 * cannot be exercised by an external caller.
 */

export interface Env {
  /** Direct dvt-api tick URL (bypasses the Cloudflare proxy). */
  TICK_URL: string
  /** First factor — matches EXPORTS_INTERNAL_KEY on dvt-api. */
  EXPORTS_INTERNAL_KEY: string
  /** Second factor — matches EXPORTS_CRON_SECRET on dvt-api. */
  EXPORTS_CRON_SECRET: string
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    // Fail loud (and visible in `wrangler tail`) if a secret was never set —
    // a silent no-auth call would just 401 forever and no schedule would fire.
    if (!env.EXPORTS_INTERNAL_KEY || !env.EXPORTS_CRON_SECRET) {
      throw new Error(
        'exports-runner: missing EXPORTS_INTERNAL_KEY / EXPORTS_CRON_SECRET secret(s)',
      )
    }

    // Await directly: a throw here marks the scheduled invocation as errored in
    // the CF cron dashboard, which is the signal a failed tick produces. No
    // waitUntil — we want the failure to count.
    await tick(env)
  },
}

async function tick(env: Env): Promise<void> {
  const res = await fetch(env.TICK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.EXPORTS_INTERNAL_KEY}`,
      'X-Cron-Secret': env.EXPORTS_CRON_SECRET,
    },
    // Rendering several due schedules can take longer than a reap; allow more
    // headroom than the reaper's 30s while still failing before the Worker
    // wall-clock limit if dvt-api hangs.
    signal: AbortSignal.timeout(120_000),
  })

  // Body is a small JSON summary ({claimed,retried,done,skipped,failed}); log it
  // so `wrangler tail` shows what the tick did. Throw on non-2xx so the failure
  // surfaces in the Cloudflare cron dashboard rather than passing silently.
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`exports-runner: tick failed ${res.status}: ${body.slice(0, 500)}`)
  }
  console.log(`exports-runner: ok ${res.status} ${body.slice(0, 500)}`)
}
