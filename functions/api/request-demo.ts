/**
 * Cloudflare Pages Function: POST /api/request-demo
 *
 * Public self-serve endpoint that provisions a prospect demo sandbox and
 * emails the prospect their magic-link app URL. Rate-limited by email,
 * IP, and global daily cap. Turnstile is REQUIRED (not optional like
 * handraise) — missing secret → 503, not fall-through.
 *
 * Environment variables / bindings required (set in Cloudflare Pages → Settings):
 *   DB                   — D1 database binding (same "dvt-handraises" DB as handraise)
 *   RESEND_API_KEY       — Resend API key (https://resend.com)
 *   TURNSTILE_SECRET_KEY — Cloudflare Turnstile secret (REQUIRED; endpoint 503s without it)
 *   SANDBOX_INTERNAL_KEY — Bearer key for /internal/sandbox/provision (Neon-console/CF-dashboard
 *                          secret; NEVER logged, returned, or exposed to client JS)
 *   NOTIFY_EMAIL         — founder notification address (default: "collin@dvt.dev")
 *   DVT_API_BASE         — Fly origin base URL (default: "https://dvt-api.fly.dev")
 *                          Use the Fly origin directly — app.dvt.dev/api returns CF 1010.
 *   DEMO_TTL_HOURS       — sandbox lifetime in hours (default: "72")
 *   DEMO_IP_CAP_24H      — per-IP requests allowed in 24h window (default: "3")
 *   DEMO_GLOBAL_CAP_24H  — total requests allowed globally in 24h window (default: "50")
 *
 * D1 schema (append to schema.sql, then run against dvt-handraises):
 *   CREATE TABLE IF NOT EXISTS demo_requests (
 *     id      INTEGER PRIMARY KEY AUTOINCREMENT,
 *     email   TEXT    NOT NULL,
 *     ip      TEXT,
 *     created TEXT    NOT NULL DEFAULT (datetime('now'))
 *   );
 */

interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
  NOTIFY_EMAIL?: string;
  /** Required — endpoint returns 503 if absent rather than fall through unprotected. */
  TURNSTILE_SECRET_KEY?: string;
  /** CF dashboard secret; Bearer key for /internal/sandbox/provision. NEVER log or return. */
  SANDBOX_INTERNAL_KEY?: string;
  /** Default: "https://dvt-api.fly.dev" — Fly origin bypasses CF 1010 on app.dvt.dev/api. */
  DVT_API_BASE?: string;
  /** Default: "72" */
  DEMO_TTL_HOURS?: string;
  /** Default: "3" */
  DEMO_IP_CAP_24H?: string;
  /** Default: "50" */
  DEMO_GLOBAL_CAP_24H?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // ── Parse body ──────────────────────────────────────────────────────────────
  let email: string;
  let honeypot = '';
  let turnstileToken = '';
  try {
    const body = await request.json<{
      email?: unknown;
      company?: unknown;
      turnstileToken?: unknown;
    }>();
    if (typeof body.email !== 'string' || !body.email.includes('@')) {
      return Response.json({ error: 'Invalid email address.' }, { status: 400 });
    }
    email = body.email.trim().toLowerCase().slice(0, 254);
    honeypot = typeof body.company === 'string' ? body.company.trim() : '';
    turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // ── Honeypot ─────────────────────────────────────────────────────────────────
  // `company` is a hidden field no human sees or fills. If populated the request
  // is a bot — return a normal-looking success so the bot gets no signal to adapt,
  // but store and provision nothing.
  if (honeypot) {
    return Response.json({ ok: true }, { status: 201 });
  }

  // ── Turnstile challenge (REQUIRED — fail-closed with no opt-out path) ─────────
  // Unlike handraise, the demo provision path is never left unprotected.
  // A missing secret means misconfiguration, not "not yet enabled".
  if (!env.TURNSTILE_SECRET_KEY) {
    return Response.json(
      { error: 'Demo signup is temporarily unavailable.' },
      { status: 503 }
    );
  }
  if (!turnstileToken) {
    return Response.json({ error: 'Bot challenge missing — please retry.' }, { status: 400 });
  }
  const tsVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: turnstileToken,
      remoteip: request.headers.get('CF-Connecting-IP') ?? '',
    }),
  });
  const tsOutcome = await tsVerify
    .json<{ success?: boolean }>()
    .catch(() => ({ success: false }));
  if (!tsOutcome.success) {
    return Response.json({ error: 'Bot challenge failed — please retry.' }, { status: 400 });
  }

  // ── SANDBOX_INTERNAL_KEY guard ────────────────────────────────────────────────
  // Never provision without the key — provision call would fail anyway, but reject
  // early so caps aren't consumed on a guaranteed-502 request.
  if (!env.SANDBOX_INTERNAL_KEY) {
    console.error(
      'request-demo: SANDBOX_INTERNAL_KEY is not set. Demo provision is disabled. ' +
        'Set this secret in Cloudflare Pages → Settings → Environment variables.'
    );
    return Response.json(
      { error: 'Demo signup is temporarily unavailable.' },
      { status: 503 }
    );
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const ttlHours = Number(env.DEMO_TTL_HOURS ?? '72');
  const ipCap = Number(env.DEMO_IP_CAP_24H ?? '3');
  const globalCap = Number(env.DEMO_GLOBAL_CAP_24H ?? '50');

  // ── D1 cap checks ────────────────────────────────────────────────────────────
  // All three checks must pass before we touch the provision API.
  // Wrap in try/catch: if D1 itself fails we must fail closed (don't provision).
  try {
    // Per-email: if an active demo was already provisioned within ttlHours, silently
    // return ok — the sandbox is still alive and we don't provision duplicates.
    const emailRow = await env.DB.prepare(
      `SELECT 1 FROM demo_requests
       WHERE email = ?
         AND created > datetime('now', '-' || ? || ' hours')
       LIMIT 1`
    )
      .bind(email, String(ttlHours))
      .first<{ 1: number }>();

    if (emailRow) {
      // Friendly already-sent: a live demo exists for this email.
      return Response.json({ ok: true }, { status: 200 });
    }

    // Per-IP: limit abuse from a single network address.
    const ipRow = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM demo_requests
       WHERE ip = ?
         AND created > datetime('now', '-24 hours')`
    )
      .bind(ip)
      .first<{ cnt: number }>();

    if ((ipRow?.cnt ?? 0) >= ipCap) {
      return Response.json(
        { error: 'Too many demo requests from your network. Try again tomorrow.' },
        { status: 429 }
      );
    }

    // Global: protect against viral surges that would exhaust sandbox capacity.
    const globalRow = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM demo_requests
       WHERE created > datetime('now', '-24 hours')`
    )
      .first<{ cnt: number }>();

    if ((globalRow?.cnt ?? 0) >= globalCap) {
      return Response.json(
        { error: 'Demo capacity reached for today — please check back tomorrow.' },
        { status: 429 }
      );
    }
  } catch (err) {
    console.error('request-demo: D1 cap check failed:', err);
    return Response.json({ error: 'Database error.' }, { status: 500 });
  }

  // ── Provision the sandbox ────────────────────────────────────────────────────
  // orgName = domain extracted from email (after @), capped at 80 chars.
  const atIdx = email.indexOf('@');
  const domain = atIdx >= 0 ? email.slice(atIdx + 1, atIdx + 1 + 80) : '';
  const orgName = domain || 'Demo Sandbox';
  const apiBase = env.DVT_API_BASE ?? 'https://dvt-api.fly.dev';

  let appUrl: string;
  let mcpConnectCommand: string;
  let expiresAt: string;

  try {
    const provisionRes = await fetch(`${apiBase}/internal/sandbox/provision`, {
      method: 'POST',
      headers: {
        // SANDBOX_INTERNAL_KEY is used only here — never logged, never returned.
        Authorization: `Bearer ${env.SANDBOX_INTERNAL_KEY}`,
        'Content-Type': 'application/json',
        'X-Sandbox-Minted-By': email,
      },
      body: JSON.stringify({ ttlHours, orgName }),
    });

    if (!provisionRes.ok) {
      const body = await provisionRes.text().catch(() => '(unreadable)');
      console.error(
        `request-demo: provision failed for ${email}: ${provisionRes.status} ${body}`
      );
      return Response.json(
        { error: 'Could not create your demo right now — please try again shortly.' },
        { status: 502 }
      );
    }

    const provisioned = await provisionRes.json<{
      appUrl: string;
      mcpUrl: string;
      mcpConnectCommand: string;
      expiresAt: string;
    }>();
    appUrl = provisioned.appUrl;
    mcpConnectCommand = provisioned.mcpConnectCommand;
    expiresAt = provisioned.expiresAt;
  } catch (err) {
    console.error('request-demo: provision fetch error for', email, err);
    return Response.json(
      { error: 'Could not create your demo right now — please try again shortly.' },
      { status: 502 }
    );
  }

  // ── Record in D1 ─────────────────────────────────────────────────────────────
  // Best-effort: provision already happened so we do not fail the request on D1
  // write errors. Log loudly so the cap state drift is visible.
  // Do NOT store appUrl/token — the magic-link is single-use + short-TTL.
  try {
    await env.DB.prepare(
      `INSERT INTO demo_requests (email, ip, created) VALUES (?, ?, datetime('now'))`
    )
      .bind(email, ip)
      .run();
  } catch (err) {
    console.error('request-demo: D1 insert failed for', email, err);
    // Not fatal — provision succeeded; continue to email.
  }

  // ── Email the prospect ───────────────────────────────────────────────────────
  // Best-effort: log loudly on failure (mirror handraise discipline).
  // The appUrl and mcpConnectCommand are for the prospect's own throwaway org —
  // safe to include in email to them. They are NOT returned in the HTTP response.
  if (!env.RESEND_API_KEY) {
    console.error(
      `request-demo: prospect email SKIPPED: RESEND_API_KEY not set. ` +
        `Provisioned sandbox for ${email} but sent no email to them.`
    );
  } else {
    try {
      const prospectRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'dvt <noreply@dvt.dev>',
          to: [email],
          subject: 'Your dvt demo sandbox is ready',
          text: [
            `Your dvt demo sandbox is ready — here's how to get started.`,
            ``,
            `Open your demo:`,
            `  ${appUrl}`,
            ``,
            `Or drive it from your own Claude:`,
            `  ${mcpConnectCommand}`,
            ``,
            `This sandbox expires at: ${expiresAt}`,
            ``,
            `Questions? Reply to this email or reach us at collin@dvt.dev.`,
          ].join('\n'),
        }),
      });
      if (!prospectRes.ok) {
        const body = await prospectRes.text().catch(() => '(unreadable)');
        console.error(
          `request-demo: prospect Resend send failed for ${email}: ${prospectRes.status} ${body}`
        );
      }
    } catch (err) {
      console.error('request-demo: prospect Resend error for', email, err);
    }
  }

  // ── Notify the founder ────────────────────────────────────────────────────────
  // Best-effort, same discipline as above.
  const notifyEmail = env.NOTIFY_EMAIL ?? 'collin@dvt.dev';
  if (!env.RESEND_API_KEY) {
    // Already logged above — skip duplicate log.
  } else {
    try {
      const founderRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'dvt <noreply@dvt.dev>',
          to: [notifyEmail],
          subject: `dvt self-serve demo: ${email}`,
          text: [
            `A new self-serve demo sandbox was provisioned.`,
            ``,
            `Email:      ${email}`,
            `IP:         ${ip || '(unknown)'}`,
            `Org name:   ${orgName}`,
            `Expires at: ${expiresAt}`,
            `Time:       ${new Date().toISOString()}`,
            ``,
            `View requests: https://dash.cloudflare.com (D1 → dvt-handraises → demo_requests)`,
          ].join('\n'),
        }),
      });
      if (!founderRes.ok) {
        const body = await founderRes.text().catch(() => '(unreadable)');
        console.error(
          `request-demo: founder Resend send failed: ${founderRes.status} ${body}`
        );
      }
    } catch (err) {
      console.error('request-demo: founder Resend error:', err);
    }
  }

  // Return ok — NEVER include appUrl, mcpConnectCommand, or any token in the
  // HTTP response body. The magic-link reaches the prospect via email only.
  return Response.json({ ok: true }, { status: 201 });
};
