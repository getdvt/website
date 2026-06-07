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
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // ── Parse body ──────────────────────────────────────────────────────────────
  let email: string;
  try {
    const body = await request.json<{ email?: unknown }>();
    if (typeof body.email !== 'string' || !body.email.includes('@')) {
      return Response.json({ error: 'Invalid email address.' }, { status: 400 });
    }
    email = body.email.trim().toLowerCase().slice(0, 254);
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
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
  const notifyEmail = env.NOTIFY_EMAIL ?? 'collin@dvt.dev';
  if (env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'DVT Handraise <noreply@dvt.dev>',
          to: [notifyEmail],
          subject: `DVT handraise: ${email}`,
          text: [
            `New early-access request for DVT.`,
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
    } catch (err) {
      // Don't fail the response if email fails — email is best-effort
      console.error('Resend error:', err);
    }
  }

  return Response.json({ ok: true }, { status: 201 });
};
