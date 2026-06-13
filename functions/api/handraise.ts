/**
 * Cloudflare Pages Function: POST /api/handraise
 *
 * Accepts an early-access signup, stores it in D1, and sends an email
 * notification to collin@dvt.dev via Resend.
 *
 * Environment variables / bindings required (set in Cloudflare Pages → Settings):
 *   DB             — D1 database binding named "dvt-handraises"
 *   RESEND_API_KEY — Resend API key (https://resend.com)
 *   NOTIFY_EMAIL   — defaults to "collin@dvt.dev"
 *
 * D1 schema (run once with wrangler d1 execute dvt-handraises --file=schema.sql):
 *   CREATE TABLE IF NOT EXISTS handraises (
 *     id        INTEGER PRIMARY KEY AUTOINCREMENT,
 *     email     TEXT NOT NULL UNIQUE,
 *     referrer  TEXT,
 *     utm       TEXT,
 *     created   TEXT NOT NULL DEFAULT (datetime('now'))
 *   );
 */

interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
  NOTIFY_EMAIL?: string;
  // Set this (plus PUBLIC_TURNSTILE_SITE_KEY at build time) to switch on the
  // Cloudflare Turnstile challenge. Until it's set, the honeypot below is the
  // always-on baseline and the form keeps working unprotected-by-Turnstile.
  TURNSTILE_SECRET_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // ── Parse body ──────────────────────────────────────────────────────────────
  let email: string;
  let honeypot = '';
  let turnstileToken = '';
  try {
    const body = await request.json<{ email?: unknown; company?: unknown; turnstileToken?: unknown }>();
    if (typeof body.email !== 'string' || !body.email.includes('@')) {
      return Response.json({ error: 'Invalid email address.' }, { status: 400 });
    }
    email = body.email.trim().toLowerCase().slice(0, 254);
    honeypot = typeof body.company === 'string' ? body.company.trim() : '';
    turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // ── Honeypot ──────────────────────────────────────────────────────────────
  // `company` is a hidden field no human ever sees or fills. If it's populated
  // the request is a bot — return a normal-looking success (so the bot gets no
  // signal to adapt) but store nothing. Zero external dependencies, always on.
  if (honeypot) {
    return Response.json({ ok: true }, { status: 201 });
  }

  // ── Turnstile challenge ─────────────────────────────────────────────────────
  // Activates the moment TURNSTILE_SECRET_KEY is present on the deployment.
  // Fail-closed once enabled: a missing or invalid token is rejected.
  if (env.TURNSTILE_SECRET_KEY) {
    if (!turnstileToken) {
      return Response.json({ error: 'Bot challenge missing — please retry.' }, { status: 400 });
    }
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: request.headers.get('CF-Connecting-IP') ?? '',
      }),
    });
    const outcome = await verify
      .json<{ success?: boolean }>()
      .catch(() => ({ success: false }));
    if (!outcome.success) {
      return Response.json({ error: 'Bot challenge failed — please retry.' }, { status: 400 });
    }
  }

  const referrer = request.headers.get('Referer') ?? '';
  const url = new URL(request.url);
  const utm = url.searchParams.toString();

  // ── Store in D1 ─────────────────────────────────────────────────────────────
  try {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO handraises (email, referrer, utm) VALUES (?, ?, ?)'
    )
      .bind(email, referrer, utm)
      .run();
  } catch (err) {
    console.error('D1 error:', err);
    return Response.json({ error: 'Database error.' }, { status: 500 });
  }

  // ── Email notification via Resend ────────────────────────────────────────────
  // Email is best-effort: the D1 insert above is the source of truth, so a send
  // failure never fails the request. But failures MUST be logged loudly — a
  // silently-skipped notification (e.g. missing API key) is how a real signup
  // once went unnoticed. Check Cloudflare Pages → Functions → Logs to debug.
  const notifyEmail = env.NOTIFY_EMAIL ?? 'collin@dvt.dev';
  if (!env.RESEND_API_KEY) {
    console.error(`Handraise notification SKIPPED: RESEND_API_KEY not set. Captured signup ${email} in D1 but sent no email.`);
  } else {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'dvt Handraise <noreply@dvt.dev>',
          to: [notifyEmail],
          subject: `dvt handraise: ${email}`,
          text: [
            `New early-access request for dvt.`,
            ``,
            `Email:    ${email}`,
            `Referrer: ${referrer || '(direct)'}`,
            `UTM:      ${utm || '(none)'}`,
            `Time:     ${new Date().toISOString()}`,
            ``,
            `View all: https://dash.cloudflare.com (D1 → dvt-handraises)`,
          ].join('\n'),
        }),
      });
      if (!resendRes.ok) {
        // 4xx/5xx don't throw on fetch — surface the status + body so auth
        // (401), unverified-domain (403), and validation errors are visible.
        const body = await resendRes.text().catch(() => '(unreadable)');
        console.error(`Resend send failed for ${email}: ${resendRes.status} ${body}`);
      }
    } catch (err) {
      console.error('Resend error:', err);
    }
  }

  return Response.json({ ok: true }, { status: 201 });
};
