-- 078_canvas_project_assets.sql
-- 无限画布与主站资产库融合：画布工程本身作为一类资产（kind='canvas'）进入统一资产库。
-- 资产行 ID 采用 'ast_cvs_' || md5(project_id) 的确定性方案，使回填与运行时 upsert 天然幂等。

ALTER TABLE ai_studio.user_assets DROP CONSTRAINT IF EXISTS user_assets_kind_check;
ALTER TABLE ai_studio.user_assets
  ADD CONSTRAINT user_assets_kind_check
  CHECK (kind IN ('text', 'image', 'video', 'audio', 'model', 'entity', 'canvas'));

INSERT INTO ai_studio.user_assets (
  id, user_id, asset_type, studio_id, title, mime_type, prompt,
  kind, category, source, cover_url, asset_data, created_at, updated_at
)
SELECT
  'ast_cvs_' || md5(p.id),
  p.owner_user_id,
  'other',
  'canvas',
  COALESCE(NULLIF(btrim(p.name), ''), '未命名画布'),
  'application/json',
  '',
  'canvas',
  'other',
  '画布项目',
  t.media_url,
  jsonb_build_object(
    'canvasProjectId', p.id,
    'version', p.version,
    'url', '/canvas/' || p.id
  ),
  p.created_at,
  p.updated_at
FROM ai_studio.canvas_projects p
LEFT JOIN ai_studio.user_assets t ON t.id = p.thumbnail_asset_id
WHERE p.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS user_assets_canvas_project_idx
  ON ai_studio.user_assets((asset_data ->> 'canvasProjectId'))
  WHERE kind = 'canvas';
