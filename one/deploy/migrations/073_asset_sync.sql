-- 073_asset_sync.sql
-- 跨站资产库同步：连接令牌与外部资产映射（影策 <-> SupDance）

CREATE TABLE IF NOT EXISTS ai_studio.asset_sync_tokens (
  id VARCHAR(64) PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL DEFAULT '',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asset_sync_tokens_user_idx
  ON ai_studio.asset_sync_tokens(user_id, created_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_studio.asset_sync_links (
  id VARCHAR(64) PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  external_system VARCHAR(32) NOT NULL,
  external_id TEXT NOT NULL,
  asset_id VARCHAR(64) NOT NULL REFERENCES ai_studio.user_assets(id) ON DELETE CASCADE,
  direction VARCHAR(16) NOT NULL DEFAULT 'import',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT asset_sync_links_external_unique UNIQUE (user_id, external_system, external_id)
);

CREATE INDEX IF NOT EXISTS asset_sync_links_asset_idx
  ON ai_studio.asset_sync_links(asset_id);
