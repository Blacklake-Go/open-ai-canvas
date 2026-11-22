-- P3 generation lifecycle, immutable credit journal metadata, and one-time admin bootstrap.

ALTER TABLE sys_core.auth_verification_codes
  ADD COLUMN IF NOT EXISTS request_ip TEXT;

ALTER TABLE ops_bill.credit_ledger_v2
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_v2_idempotency_idx
  ON ops_bill.credit_ledger_v2(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE ai_studio.creations
  ADD COLUMN IF NOT EXISTS reservation_id TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS input_summary_json JSONB,
  ADD COLUMN IF NOT EXISTS provider_request_id TEXT;

UPDATE auth_usr.users SET role = 'operations_admin' WHERE role = 'ops_admin';

UPDATE ai_studio.creations SET status = 'succeeded' WHERE status IN ('completed', 'success');
UPDATE ai_studio.creations SET status = 'succeeded' WHERE status = 'under_review';
UPDATE ai_studio.creations SET status = 'failed', error_code = COALESCE(error_code, 'MODERATION_REJECTED') WHERE status = 'moderated_rejected';
UPDATE ai_studio.creations
SET status = 'failed', error_code = COALESCE(error_code, 'LEGACY_STATUS_MIGRATED')
WHERE status NOT IN ('queued', 'processing', 'succeeded', 'failed', 'cancelled');
ALTER TABLE ai_studio.creations ALTER COLUMN status SET DEFAULT 'queued';
ALTER TABLE ai_studio.creations DROP CONSTRAINT IF EXISTS creations_status_check;
ALTER TABLE ai_studio.creations
  ADD CONSTRAINT creations_status_check
  CHECK (status IN ('queued', 'processing', 'succeeded', 'failed', 'cancelled'));
CREATE UNIQUE INDEX IF NOT EXISTS creations_user_idempotency_idx
  ON ai_studio.creations(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS creations_reservation_idx
  ON ai_studio.creations(reservation_id)
  WHERE reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS creations_external_request_idx
  ON ai_studio.creations(provider, external_request_id)
  WHERE external_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_studio.generation_events (
  id TEXT PRIMARY KEY,
  creation_id TEXT NOT NULL REFERENCES ai_studio.creations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  reservation_id TEXT,
  provider TEXT,
  provider_request_id TEXT,
  idempotency_key TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS generation_events_creation_idx
  ON ai_studio.generation_events(creation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS generation_events_user_idx
  ON ai_studio.generation_events(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS generation_events_idempotency_idx
  ON ai_studio.generation_events(creation_id, event_type, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS sys_core.auth_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  target TEXT,
  request_ip TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_events_target_idx
  ON sys_core.auth_events(target, created_at DESC);

CREATE TABLE IF NOT EXISTS sys_core.admin_roles (
  role TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT TRUE,
  permissions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO sys_core.admin_roles (role, display_name, permissions_json)
VALUES
  ('super_admin', '超级管理员', '["*"]'::jsonb),
  ('admin', '管理员', '[]'::jsonb),
  ('operations_admin', '运营管理员', '[]'::jsonb),
  ('finance_admin', '财务管理员', '[]'::jsonb),
  ('support_admin', '客服管理员', '[]'::jsonb),
  ('auditor', '审计员', '[]'::jsonb)
ON CONFLICT (role) DO NOTHING;

CREATE TABLE IF NOT EXISTS sys_core.admin_bootstrap_claims (
  id TEXT PRIMARY KEY,
  consumed_at TIMESTAMPTZ,
  consumed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO sys_core.admin_bootstrap_claims (id) VALUES ('initial_admin') ON CONFLICT (id) DO NOTHING;
