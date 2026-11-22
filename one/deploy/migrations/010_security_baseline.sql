-- P0 security baseline: durable rate-limit buckets for cookie-authenticated APIs.
CREATE TABLE IF NOT EXISTS sys_core.rate_limit_buckets (
  key_hash TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  subject TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_updated_idx
  ON sys_core.rate_limit_buckets(updated_at);
