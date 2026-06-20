/**
 * dvt-sandbox-reaper — Cloudflare Worker cron trigger (DVT-437 / ADR-0042 D7).
 *
 * On each scheduled tick this Worker makes a single authenticated POST to the
 * dvt-api reaper endpoint, which hard-deletes expired sandbox orgs and their
 * R2 artifacts. The Worker carries NO delete logic and NO database access — it
 * is purely the clock. Every safety guard (is_sandbox scoping, advisory lock,
 * idempotency) lives in the API.
 *
 * Auth: the reaper requires BOTH factors (ADR-0042 D7) —
 *   Authorization: Bearer <SANDBOX_INTERNAL_KEY>
 *   X-Cron-Secret: <SANDBOX_CRON_SECRET>
 * both of which must match the SANDBOX_* secrets on the dvt-api Fly app.
 *
 * There is intentionally no `fetch` handler: this Worker is unreachable over
 * HTTP and can only be driven by its cron trigger, so the credentials it holds
 * cannot be exercised by an external caller.
 */

export interface Env {
  /** Direct dvt-api reaper URL (bypasses the Cloudflare proxy). */
  REAP_URL: string
  /** First factor — matches SANDBOX_INTERNAL_KEY on dvt-api. */
  SANDBOX_INTERNAL_KEY: string
  /** Second factor — matches SANDBOX_CRON_SECRET on dvt-api. */
  SANDBOX_CRON_SECRET: string
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    // Fail loud (and visible in `wrangler tail`) if a secret was never set —
    // a silent no-auth call would just 401 forever and the reaper would never run.
    if (!env.SANDBOX_INTERNAL_KEY || !env.SANDBOX_CRON_SECRET) {
      throw new Error(
        'sandbox-reaper: missing SANDBOX_INTERNAL_KEY / SANDBOX_CRON_SECRET secret(s)',
      )
    }

    // Await directly (single short request): a throw here marks the scheduled
    // invocation as errored in the CF cron dashboard, which is the only signal
    // a failed reap produces. No waitUntil — we want the failure to count.
    await reap(env)
  },
}

async function reap(env: Env): Promise<void> {
  const res = await fetch(env.REAP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SANDBOX_INTERNAL_KEY}`,
      'X-Cron-Secret': env.SANDBOX_CRON_SECRET,
    },
    // Fail fast rather than riding the Worker wall-clock limit if dvt-api hangs.
    signal: AbortSignal.timeout(30_000),
  })

  // Body is small JSON (a ReapResult summary); log it so `wrangler tail` shows
  // how many sandboxes were reaped. Throw on non-2xx so the failure surfaces in
  // the Cloudflare cron dashboard rather than passing silently.
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`sandbox-reaper: reap failed ${res.status}: ${body.slice(0, 500)}`)
  }
  console.log(`sandbox-reaper: ok ${res.status} ${body.slice(0, 500)}`)
}
