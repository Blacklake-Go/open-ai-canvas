-- P4 admin export jobs: async, auditable, least-privilege data exports.

CREATE TABLE IF NOT EXISTS sys_core.admin_export_jobs (
  id TEXT PRIMARY KEY,
  requested_by TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE RESTRICT,
  export_type TEXT NOT NULL CHECK (export_type IN ('users', 'orders', 'creations')),
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'expired')),
  file_name TEXT,
  content_text TEXT,
  content_sha256 TEXT,
  error_code TEXT,
  error_message TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admin_export_jobs_requester_idx
  ON sys_core.admin_export_jobs(requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_export_jobs_expiry_idx
  ON sys_core.admin_export_jobs(expires_at)
  WHERE status IN ('queued', 'running', 'succeeded');
