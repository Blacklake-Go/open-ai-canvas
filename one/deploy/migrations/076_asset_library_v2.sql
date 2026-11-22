-- 076_asset_library_v2.sql
-- 资产库移植：引入素材语义维度（kind/category）、来源与备注、文本/实体数据，
-- 以及回收站保留期字段 trashed_at。

ALTER TABLE ai_studio.user_assets
  ADD COLUMN IF NOT EXISTS kind VARCHAR(16),
  ADD COLUMN IF NOT EXISTS category VARCHAR(32) DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS source VARCHAR(255),
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS asset_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS trashed_at TIMESTAMPTZ;

-- 历史存量按 asset_type / mime 回填 kind，保证只读列表口径完整。
UPDATE ai_studio.user_assets
SET kind = CASE
  WHEN asset_type IN ('image', 'avatar', 'thumbnail') THEN 'image'
  WHEN asset_type = 'video' THEN 'video'
  WHEN asset_type IN ('audio', 'music') THEN 'audio'
  WHEN asset_type = 'document' THEN 'text'
  WHEN asset_type = 'workflow' THEN CASE
    WHEN COALESCE(mime_type, '') LIKE 'video/%' THEN 'video'
    WHEN COALESCE(mime_type, '') LIKE 'audio/%' THEN 'audio'
    ELSE 'image'
  END
  ELSE 'image'
END
WHERE kind IS NULL;

UPDATE ai_studio.user_assets SET category = 'other' WHERE category IS NULL;
UPDATE ai_studio.user_assets
SET trashed_at = COALESCE(trashed_at, deleted_at)
WHERE status = 'trash' AND trashed_at IS NULL;

ALTER TABLE ai_studio.user_assets
  ALTER COLUMN kind SET DEFAULT 'image',
  ALTER COLUMN kind SET NOT NULL,
  ALTER COLUMN category SET DEFAULT 'other',
  ALTER COLUMN category SET NOT NULL;

ALTER TABLE ai_studio.user_assets DROP CONSTRAINT IF EXISTS user_assets_kind_check;
ALTER TABLE ai_studio.user_assets
  ADD CONSTRAINT user_assets_kind_check
  CHECK (kind IN ('text', 'image', 'video', 'audio', 'model', 'entity'));

ALTER TABLE ai_studio.user_assets DROP CONSTRAINT IF EXISTS user_assets_category_check;
ALTER TABLE ai_studio.user_assets
  ADD CONSTRAINT user_assets_category_check
  CHECK (category IN ('character', 'environment', 'prop', 'material', 'other'));

CREATE INDEX IF NOT EXISTS user_assets_user_kind_idx
  ON ai_studio.user_assets(user_id, kind, created_at DESC)
  WHERE status = 'ready' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS user_assets_user_category_idx
  ON ai_studio.user_assets(user_id, category, created_at DESC)
  WHERE status = 'ready' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS user_assets_trash_retention_idx
  ON ai_studio.user_assets(trashed_at)
  WHERE status = 'trash';
