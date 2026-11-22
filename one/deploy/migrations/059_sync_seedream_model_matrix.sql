-- 059_sync_seedream_model_matrix.sql
-- 对齐官方 Seedream / 美学模型 5 款核心规格矩阵与能力集

-- 1. 完善 ai_models 支持的长宽比例与画质规格
UPDATE ai_studio.ai_models
SET supported_ratios = '["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "3:2", "2:3", "auto"]'::jsonb,
    supported_resolutions = '["1024x1024", "1280x720", "720x1280", "1920x1080", "1080x1920", "2048x2048", "3840x2160", "auto"]'::jsonb,
    supported_input_types = '["text", "image"]'::jsonb,
    supported_output_types = '["image"]'::jsonb
WHERE id IN ('seedream-5.0-pro', 'seedream-5.0-flash', 'image-aesthetic-v8.2', 'seedream-5.0-lite', 'seedream-4.5');

-- 停用孤立的历史 4.0 模型
UPDATE ai_studio.ai_models
SET status = 'disabled', tier = 'backup', is_visible = false
WHERE id = 'seedream-4.0';

-- 2. 完善 provider_models 的任务类型与路由能力
UPDATE ai_studio.provider_models
SET capabilities = COALESCE(capabilities, '{}'::jsonb) || '{
  "qualities": ["standard", "hd", "fast", "pro", "ultra", "auto"],
  "input_types": ["text", "image"],
  "output_types": ["image"],
  "resolutions": ["1024x1024", "1024x1792", "1792x1024", "512x512", "768x768", "1280x720", "720x1280", "1920x1080", "1080x1920", "2048x2048", "auto"],
  "aspect_ratios": ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9", "3:2", "2:3", "auto"],
  "supported_task_types": ["t2i", "i2i", "text_to_image", "image_to_image"]
}'::jsonb,
supported_task_types = '["t2i", "i2i", "text_to_image", "image_to_image", "text-to-image", "image-to-image"]'::jsonb
WHERE model_id IN ('seedream-5.0-pro', 'seedream-5.0-flash', 'image-aesthetic-v8.2', 'seedream-5.0-lite', 'seedream-4.5');

-- 禁用 seedream-4.5 下的 4.0 降级路由，保证 4.7 规格精确
UPDATE ai_studio.provider_models
SET enabled = false
WHERE id = 'pm_seedream_4_0_volcengine' AND model_id = 'seedream-4.5';

-- 3. 同步 models_config 基础配置
INSERT INTO ai_studio.models_config (id, provider, name, type, cost_usd, credits_price, is_active, sort_order, tier, is_visible, auto_route_eligible)
VALUES
  ('seedream-5.0-pro', 'volcengine', 'Seedream 5.0 Pro', 'image', 0.011111, 28, true, 1, 'core', true, true),
  ('seedream-5.0-flash', 'volcengine', 'Seedream 5.0 Flash', 'image', 0.005555, 18, true, 2, 'core', true, true),
  ('image-aesthetic-v8.2', 'runninghub', '图片美学模型 V8.2', 'image', 0.025000, 25, true, 3, 'core', true, true),
  ('seedream-5.0-lite', 'runninghub', 'Seedream 5.0 Lite', 'image', 0.025000, 12, true, 4, 'core', true, true),
  ('seedream-4.5', 'volcengine', 'Seedream 4.7', 'image', 0.006944, 15, true, 5, 'core', true, true)
ON CONFLICT (id) DO UPDATE SET
  provider = EXCLUDED.provider,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  cost_usd = EXCLUDED.cost_usd,
  credits_price = EXCLUDED.credits_price,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  tier = EXCLUDED.tier,
  is_visible = EXCLUDED.is_visible,
  auto_route_eligible = EXCLUDED.auto_route_eligible,
  updated_at = NOW();

UPDATE ai_studio.models_config
SET is_active = false, is_visible = false, tier = 'backup'
WHERE id IN ('seedream-4.0', 'bytedance-seedream-v4', 'bytedance-seedream-v4-edit', 'bytedance-seedream-edit-v4');
