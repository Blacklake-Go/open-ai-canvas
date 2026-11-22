-- 075_storage_v2.sql
-- 多供应商对象存储：存储位置（含历史凭据）、资源位置绑定、迁移运行记录。

CREATE TABLE IF NOT EXISTS ai_studio.storage_locations (
  id VARCHAR(64) PRIMARY KEY,
  scope VARCHAR(16) NOT NULL DEFAULT 'platform',
  owner_id TEXT NOT NULL DEFAULT '',
  provider VARCHAR(32) NOT NULL,
  location_digest CHAR(64) NOT NULL,
  value_json JSONB NOT NULL,
  tested_at TIMESTAMPTZ,
  tested_digest CHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT storage_locations_identity_unique UNIQUE (scope, owner_id, provider, location_digest)
);

CREATE INDEX IF NOT EXISTS storage_locations_scope_idx
  ON ai_studio.storage_locations(scope, owner_id, created_at DESC);

ALTER TABLE ai_studio.user_assets
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(32),
  ADD COLUMN IF NOT EXISTS storage_location_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS user_assets_storage_location_idx
  ON ai_studio.user_assets(storage_location_id)
  WHERE storage_location_id IS NOT NULL;

ALTER TABLE ai_studio.creations
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(32),
  ADD COLUMN IF NOT EXISTS storage_location_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS creations_storage_location_idx
  ON ai_studio.creations(storage_location_id)
  WHERE storage_location_id IS NOT NULL;

ALTER TABLE auth_usr.users
  ADD COLUMN IF NOT EXISTS avatar_storage_provider VARCHAR(32),
  ADD COLUMN IF NOT EXISTS avatar_storage_location_id VARCHAR(64);

CREATE TABLE IF NOT EXISTS ai_studio.storage_migration_runs (
  id VARCHAR(64) PRIMARY KEY,
  target_location_id VARCHAR(64),
  target_provider VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'running',
  phase VARCHAR(16) NOT NULL DEFAULT 'assets',
  cursor_created_at TIMESTAMPTZ,
  cursor_id VARCHAR(64),
  scanned INTEGER NOT NULL DEFAULT 0,
  migrated INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT storage_migration_runs_status_check CHECK (status IN ('running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS storage_migration_runs_recent_idx
  ON ai_studio.storage_migration_runs(started_at DESC);
