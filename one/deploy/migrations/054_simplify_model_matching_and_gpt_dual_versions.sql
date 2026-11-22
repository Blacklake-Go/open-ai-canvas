-- 054_simplify_model_matching_and_gpt_dual_versions.sql
-- 极简前台模型匹配与 GPT 图像双版本配置规范（最新旗舰版 + 上一代经济版）

-- 1. 规范 GPT 图像最新版 (GPT 图像 2.0)
UPDATE ai_studio.ai_models
SET display_name = 'GPT 图像 2.0',
    name = 'GPT Image 2',
    description = '细节逼真，文字渲染精准。',
    status = 'active',
    tier = 'core',
    is_visible = TRUE,
    sort = 1,
    capabilities = COALESCE(capabilities, '{}'::jsonb) || jsonb_build_object('badge', '最新', 'sub_type', 't2i'),
    updated_at = NOW()
WHERE id = 'gpt-image-2';

-- 2. 规范 GPT 图像上一代经济版 (GPT 图像 1.5)
UPDATE ai_studio.ai_models
SET display_name = 'GPT 图像 1.5',
    name = 'GPT Image 1.5',
    description = '上一代高性价比，生成速度快。',
    status = 'active',
    tier = 'core',
    is_visible = TRUE,
    sort = 2,
    capabilities = COALESCE(capabilities, '{}'::jsonb) || jsonb_build_object('badge', '经济', 'sub_type', 't2i'),
    updated_at = NOW()
WHERE id = 'gpt-image-1.5';

-- 3. 纠正此前被误命名为 Seedream 的 gpt-image-2.5-flash，并从主展示隐藏
UPDATE ai_studio.ai_models
SET display_name = 'GPT 图像 2.5 (极速版)',
    name = 'GPT Image 2.5 Flash',
    description = '日常生成和编辑速度加快',
    tier = 'backup',
    is_visible = FALSE,
    updated_at = NOW()
WHERE id = 'gpt-image-2.5-flash';

-- 4. 隐藏杂乱或过期的旧生图模型，保持主列表清爽
UPDATE ai_studio.ai_models
SET is_visible = FALSE, tier = 'backup', updated_at = NOW()
WHERE id IN ('gpt-image-2.5-sunrise', 'gpt4o-text-to-image', 'gpt-image', 'bytedance-seedream-v3', 'seedream-3.0');

-- 5. 确保定价准确：最新版 20 积分，经济版 10 积分
UPDATE ai_studio.model_pricing
SET base_credits = 20, pricing_type = 'fixed', is_active = TRUE, updated_at = NOW()
WHERE model_id = 'gpt-image-2';

UPDATE ai_studio.model_pricing
SET base_credits = 10, pricing_type = 'fixed', is_active = TRUE, updated_at = NOW()
WHERE model_id = 'gpt-image-1.5';

-- 6. 兼容 models_config 表（若存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'ai_studio' AND table_name = 'models_config'
  ) THEN
    UPDATE ai_studio.models_config
    SET name = 'GPT 图像 2.0', credits_price = 20, tier = 'core', is_visible = TRUE, sort_order = 1, updated_at = NOW()
    WHERE id = 'gpt-image-2';

    UPDATE ai_studio.models_config
    SET name = 'GPT 图像 1.5', credits_price = 10, tier = 'core', is_visible = TRUE, sort_order = 2, updated_at = NOW()
    WHERE id = 'gpt-image-1.5';

    UPDATE ai_studio.models_config
    SET is_visible = FALSE, tier = 'backup', updated_at = NOW()
    WHERE id IN ('gpt-image-2.5-flash', 'gpt-image-2.5-sunrise', 'gpt4o-text-to-image', 'gpt-image', 'bytedance-seedream-v3', 'seedream-3.0');
  END IF;
END $$;
