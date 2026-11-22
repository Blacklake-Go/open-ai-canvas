-- Durable process heartbeats used by readiness and the admin health dashboard.
CREATE TABLE IF NOT EXISTS sys_core.worker_heartbeats (
  worker_name TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  process_id INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (worker_name, instance_id)
);

CREATE INDEX IF NOT EXISTS worker_heartbeats_freshness_idx
  ON sys_core.worker_heartbeats(worker_name, last_seen_at DESC);
