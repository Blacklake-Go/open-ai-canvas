-- Unified content storage foundation.
-- Existing media_url/result_url columns remain for legacy migration visibility;
-- new writes must use object_key and server-generated URLs.

ALTER TABLE ai_studio.user_assets
  ALTER COLUMN media_url DROP NOT NULL;

ALTER TABLE ai_studio.user_assets DROP CONSTRAINT IF EXISTS user_assets_asset_type_check;
ALTER TABLE ai_studio.user_assets
  ADD CONSTRAINT user_assets_asset_type_check
  CHECK (asset_type IN ('image', 'video', 'audio', 'music', 'document', 'avatar', 'thumbnail', 'workflow', 'other'));

ALTER TABLE ai_studio.user_assets
  ADD COLUMN IF NOT EXISTS bucket TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS object_key TEXT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS filename TEXT,
  ADD COLUMN IF NOT EXISTS extension TEXT,
  ADD COLUMN IF NOT EXISTS checksum TEXT,
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS source_provider VARCHAR(64),
  ADD COLUMN IF NOT EXISTS source_task_id TEXT,
  ADD COLUMN IF NOT EXISTS original_asset_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS preview_asset_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS thumbnail_asset_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_status VARCHAR(32) NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS storage_error_code TEXT;

ALTER TABLE ai_studio.user_assets DROP CONSTRAINT IF EXISTS user_assets_visibility_check;
ALTER TABLE ai_studio.user_assets
  ADD CONSTRAINT user_assets_visibility_check
  CHECK (visibility IN ('private', 'unlisted', 'public'));

ALTER TABLE ai_studio.user_assets DROP CONSTRAINT IF EXISTS user_assets_storage_status_check;
ALTER TABLE ai_studio.user_assets
  ADD CONSTRAINT user_assets_storage_status_check
  CHECK (storage_status IN ('pending', 'ready', 'failed'));

ALTER TABLE ai_studio.user_assets DROP CONSTRAINT IF EXISTS user_assets_status_check;
ALTER TABLE ai_studio.user_assets
  ADD CONSTRAINT user_assets_status_check
  CHECK (status IN ('ready', 'archived', 'trash'));

CREATE INDEX IF NOT EXISTS user_assets_object_key_idx
  ON ai_studio.user_assets(object_key)
  WHERE object_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_assets_deleted_at_idx
  ON ai_studio.user_assets(user_id, deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS user_assets_storage_status_idx
  ON ai_studio.user_assets(storage_status, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_studio.storage_operation_logs (
  id VARCHAR(64) PRIMARY KEY,
  asset_id VARCHAR(64),
  user_id TEXT,
  provider VARCHAR(64) NOT NULL,
  object_key TEXT,
  operation VARCHAR(32) NOT NULL,
  size_bytes BIGINT,
  duration_ms INTEGER,
  status VARCHAR(16) NOT NULL CHECK (status IN ('success', 'failed')),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS storage_operation_logs_created_idx
  ON ai_studio.storage_operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS storage_operation_logs_asset_idx
  ON ai_studio.storage_operation_logs(asset_id, created_at DESC);

ALTER TABLE ai_studio.creations
  ADD COLUMN IF NOT EXISTS storage_status VARCHAR(32) NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS storage_error_code TEXT,
  ADD COLUMN IF NOT EXISTS storage_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS asset_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS result_object_key TEXT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
  ADD COLUMN IF NOT EXISTS storage_region TEXT,
  ADD COLUMN IF NOT EXISTS storage_mime_type VARCHAR(128),
  ADD COLUMN IF NOT EXISTS storage_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS storage_checksum TEXT;

ALTER TABLE ai_studio.creations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE ai_studio.creations DROP CONSTRAINT IF EXISTS creations_storage_status_check;
ALTER TABLE ai_studio.creations
  ADD CONSTRAINT creations_storage_status_check
  CHECK (storage_status IN ('pending', 'ready', 'failed'));

CREATE INDEX IF NOT EXISTS creations_storage_status_idx
  ON ai_studio.creations(storage_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS creations_deleted_at_idx
  ON ai_studio.creations(user_id, deleted_at, created_at DESC);

ALTER TABLE auth_usr.users
  ADD COLUMN IF NOT EXISTS avatar_object_key TEXT;
