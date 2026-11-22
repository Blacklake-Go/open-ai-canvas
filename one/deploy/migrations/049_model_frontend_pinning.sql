-- 049_model_frontend_pinning.sql
-- 支持模型在前台展示中置顶 (is_pinned)
ALTER TABLE ai_studio.ai_models
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ai_models_pinned_idx
  ON ai_studio.ai_models(is_pinned, sort ASC);

-- 兼容 models_config 表
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'ai_studio' AND table_name = 'models_config'
  ) THEN
    ALTER TABLE ai_studio.models_config
      ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
  END IF;
END $$;
