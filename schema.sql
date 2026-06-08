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
