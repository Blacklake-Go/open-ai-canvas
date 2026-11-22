-- 044_model_tiering_and_shrink_routing.sql
-- SupDance AI 模型收缩式治理与分级路由
-- 1. 模型分级：core (核心), backup (备用), experimental (实验), deprecated (停用)
-- 2. 前台可见性：is_visible (核心前台少而精，200+模型多而全作为后台资源池)
-- 3. 自动路由标记与跨模型降级备份：auto_route_eligible, backup_model_id, backup_provider_id

-- 1. 标准模型目录表扩展
ALTER TABLE ai_studio.ai_models
  ADD COLUMN IF NOT EXISTS tier VARCHAR(32) NOT NULL DEFAULT 'backup'
    CHECK (tier IN ('core', 'backup', 'experimental', 'deprecated')),
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_route_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS backup_model_id VARCHAR(64) REFERENCES ai_studio.ai_models(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS backup_provider_id VARCHAR(64) REFERENCES ai_studio.ai_providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ai_models_tier_visible_idx
  ON ai_studio.ai_models(tier, is_visible, status);

CREATE INDEX IF NOT EXISTS ai_models_category_tier_idx
  ON ai_studio.ai_models(category, tier, sort ASC);

-- 2. 兼容老 models_config 表扩展
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'ai_studio' AND table_name = 'models_config'
  ) THEN
    ALTER TABLE ai_studio.models_config
      ADD COLUMN IF NOT EXISTS tier VARCHAR(32) DEFAULT 'backup',
      ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS auto_route_eligible BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS backup_model_id VARCHAR(64),
      ADD COLUMN IF NOT EXISTS backup_provider_id VARCHAR(64);
  END IF;
END $$;

-- 3. 默认将全部模型设为 backup 且前台默认收缩（不直接堆积在普通用户工作台）
UPDATE ai_studio.ai_models
SET tier = CASE
      WHEN status = 'disabled' THEN 'deprecated'
      WHEN status = 'maintenance' THEN 'experimental'
      ELSE 'backup'
    END,
    is_visible = (status = 'active'),
    auto_route_eligible = FALSE;

-- 4. 精选配置生图核心模型 (4～8 个，此处精选 6 个高性能 SOTA 模型)
-- nano-banana, flux-dev, flux-kontext-pro-t2i, wan2.1-text-to-image, gpt4o-text-to-image, bytedance-seedream-v3
UPDATE ai_studio.ai_models
SET tier = 'core',
    is_visible = TRUE,
    auto_route_eligible = TRUE,
    backup_model_id = 'flux-dev'
WHERE id IN (
  'nano-banana',
  'flux-kontext-pro-t2i',
  'wan2.1-text-to-image',
  'gpt4o-text-to-image',
  'bytedance-seedream-v3',
  'seedream-5.0'
);

-- flux-dev 核心模型以 nano-banana 作为首选降级模型
UPDATE ai_studio.ai_models
SET tier = 'core',
    is_visible = TRUE,
    auto_route_eligible = TRUE,
    backup_model_id = 'nano-banana'
WHERE id = 'flux-dev';

-- 5. 精选配置生视频核心模型 (4～6 个，此处精选 5 个高性能 SOTA 模型)
-- seedance-v2.0-t2v, kling-v2.6-pro-t2v, veo3-text-to-video, wan2.1-image-to-video, minimax-hailuo-2.3-standard-t2v
UPDATE ai_studio.ai_models
SET tier = 'core',
    is_visible = TRUE,
    auto_route_eligible = TRUE,
    backup_model_id = 'kling-v2.6-pro-t2v'
WHERE id IN (
  'seedance-v2.0-t2v',
  'veo3-text-to-video',
  'veo-2-text-to-video',
  'wan2.1-image-to-video',
  'minimax-hailuo-2.3-standard-t2v'
);

-- kling-v2.6-pro-t2v 核心模型以 seedance-v2.0-t2v 作为首选降级模型
UPDATE ai_studio.ai_models
SET tier = 'core',
    is_visible = TRUE,
    auto_route_eligible = TRUE,
    backup_model_id = 'seedance-v2.0-t2v'
WHERE id = 'kling-v2.6-pro-t2v';

-- 6. 精选配置生音乐核心模型 (2～4 个，此处精选 3 个高质量音乐与音效模型)
-- suno-create-music, minimax-music-3.0, mmaudio-v2-text-to-audio
UPDATE ai_studio.ai_models
SET tier = 'core',
    is_visible = TRUE,
    auto_route_eligible = TRUE,
    backup_model_id = 'minimax-music-3.0'
WHERE id IN (
  'suno-create-music',
  'mmaudio-v2-text-to-audio'
);

-- minimax-music-3.0 以 suno-create-music 作为首选降级模型
UPDATE ai_studio.ai_models
SET tier = 'core',
    is_visible = TRUE,
    auto_route_eligible = TRUE,
    backup_model_id = 'suno-create-music'
WHERE id = 'minimax-music-3.0';

-- 7. 同步更新老 models_config 对应的 core 与 visible 状态 (如存在)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'ai_studio' AND table_name = 'models_config'
  ) THEN
    UPDATE ai_studio.models_config mc
    SET tier = m.tier,
        is_visible = m.is_visible,
        auto_route_eligible = m.auto_route_eligible,
        backup_model_id = m.backup_model_id,
        backup_provider_id = m.backup_provider_id
    FROM ai_studio.ai_models m
    WHERE mc.id = m.id;
  END IF;
END $$;
