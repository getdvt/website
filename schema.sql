-- dvt handraises D1 schema
-- Run once with: wrangler d1 execute dvt-handraises --file=schema.sql
-- Or via Cloudflare dashboard: D1 → dvt-handraises → Console → run this

CREATE TABLE IF NOT EXISTS handraises (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  email    TEXT    NOT NULL UNIQUE,
  referrer TEXT,
  utm      TEXT,
  created  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_handraises_created ON handraises(created);

-- demo_requests: tracks self-serve demo sandbox provisioning for rate-limiting.
-- email is NOT UNIQUE — re-requests after expiry must be allowed; the per-email
-- window check in functions/api/request-demo.ts handles dedup within the TTL window.
-- Run: wrangler d1 execute dvt-handraises --file=schema.sql
CREATE TABLE IF NOT EXISTS demo_requests (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  email   TEXT    NOT NULL,
  ip      TEXT,
  created TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_demo_requests_email   ON demo_requests(email);
CREATE INDEX IF NOT EXISTS idx_demo_requests_ip      ON demo_requests(ip);
CREATE INDEX IF NOT EXISTS idx_demo_requests_created ON demo_requests(created);
