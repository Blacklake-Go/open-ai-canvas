-- 064_fix_imagen4_and_seedream_routes.sql
-- 1. 提升 imagen-4 为 core 核心模型，开启 auto_route_eligible，配置容灾备用模型 seedream-5.0
UPDATE ai_studio.ai_models
SET tier = 'core',
    auto_route_eligible = TRUE,
    is_visible = TRUE,
    status = 'active',
    backup_model_id = 'seedream-5.0'
WHERE id = 'imagen-4';

-- 2. 补全 Google 官方渠道 pm_imagen4_google 的 provider_endpoint 与 capabilities.aspect_ratios
UPDATE ai_studio.provider_models
SET provider_endpoint = '/v1beta/models/imagen-3.0-generate-002:predict',
    capabilities = jsonb_set(
      COALESCE(capabilities, '{}'::jsonb),
      '{aspect_ratios}',
      '["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9", "*"]'::jsonb
    ),
    supported_resolutions = '["*", "1024x1024", "1280x720", "720x1280"]'::jsonb,
    enabled = TRUE,
    priority = 100
WHERE id = 'pm_imagen4_google';

-- 3. 补全 MuAPI 渠道 pm_imagen4_muapi 的 capabilities.aspect_ratios
UPDATE ai_studio.provider_models
SET capabilities = jsonb_set(
      COALESCE(capabilities, '{}'::jsonb),
      '{aspect_ratios}',
      '["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9", "*"]'::jsonb
    ),
    supported_resolutions = '["*", "1024x1024", "1280x720", "720x1280"]'::jsonb,
    enabled = TRUE,
    priority = 50
WHERE id = 'pm_imagen4_muapi';

-- 4. 为 imagen-4 添加 RunningHub 渠道容灾备用（当 Google/MuAPI 欠费或凭证异常时可无缝切流）
INSERT INTO ai_studio.provider_models (
  id, model_id, provider_id, provider_model_id, enabled, priority,
  cost_config, parameter_mapping, capabilities, endpoint_config,
  timeout, max_retries, supports_webhook, supports_polling,
  concurrency_limit, rate_limit, metadata, created_at, updated_at,
  review_status, provider_endpoint, supported_task_types,
  supported_resolutions, supported_durations, supported_qualities,
  supported_regions, license_requirements, mapping_version
) VALUES (
  'pm_imagen4_runninghub', 'imagen-4', 'runninghub',
  'openapi/v2/alibaba/qwen-image-3.0-pro/text-to-image', TRUE, 80,
  '{"currency": "USD", "base_cost": 0.02}'::jsonb, '{}'::jsonb,
  '{"input_types": ["text", "image"], "output_types": ["image"], "supported_task_types": ["t2i", "i2i", "text_to_image", "image_to_image"], "aspect_ratios": ["1:1", "16:9", "9:16", "4:3", "3:4", "*"]}'::jsonb,
  '{}'::jsonb, 120000, 2, FALSE, TRUE, 10, 60, '{}'::jsonb, now(), now(),
  'approved', '/task/openapi/create', '["t2i", "i2i", "text_to_image", "image_to_image"]'::jsonb,
  '["*", "1024x1024", "1K", "2K", "4K"]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  '[]'::jsonb, '[]'::jsonb, 1
) ON CONFLICT (id) DO UPDATE SET
  enabled = TRUE,
  provider_endpoint = '/task/openapi/create',
  capabilities = EXCLUDED.capabilities,
  supported_task_types = EXCLUDED.supported_task_types,
  supported_resolutions = EXCLUDED.supported_resolutions,
  updated_at = now();

-- 为 pm_imagen4_runninghub 配置价格版本以满足路由审计与计费准入
INSERT INTO ai_studio.provider_model_price_versions (
  id, provider_model_id, version_no, price_type, billing_unit, currency,
  price_config, applicability, source_url, source_api, source_observed_at,
  fetched_at, effective_at, expires_at, evidence_digest, status,
  manually_locked, change_summary, previous_version_id, modified_by,
  approved_by, approved_at, created_at
) VALUES (
  'pver_imagen4_runninghub_v1', 'pm_imagen4_runninghub', 1, 'manual', 'per_request', 'USD',
  '{"currency": "USD", "base_cost": 0.02}'::jsonb, '{}'::jsonb, NULL,
  'runninghub:openapi', now(), now(), now(), NULL, 'imagen4_rh_digest', 'active',
  FALSE, '{"note": "RunningHub backup route for imagen-4"}'::jsonb, NULL, 'migration:064',
  'system', now(), now()
) ON CONFLICT (id) DO UPDATE SET status = 'active';

-- 5. 确保 seedream-5.0 也是 core 并且 backup_model_id 为 nano-banana-pro
UPDATE ai_studio.ai_models
SET tier = 'core',
    auto_route_eligible = TRUE,
    is_visible = TRUE,
    status = 'active',
    backup_model_id = 'nano-banana-pro'
WHERE id = 'seedream-5.0';
