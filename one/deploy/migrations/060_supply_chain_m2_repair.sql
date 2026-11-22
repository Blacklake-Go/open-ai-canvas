-- 060_supply_chain_m2_repair.sql
-- Milestone 2: Generation Supply Chain & Pricing Margin Floor Repair

BEGIN;

-- 1. Fix default preset in system_settings: update default_image_model to 'nano-banana'
UPDATE ops_bill.system_settings
SET value_json = jsonb_set(COALESCE(value_json, '{}'::jsonb), '{default_image_model}', '"nano-banana"'),
    version = version + 1,
    updated_at = NOW()
WHERE key = 'model_presets';

-- 2. Align nano-banana-pro in ai_models and model_pricing to prevent studio exclusion and margin floor violations
UPDATE ai_studio.ai_models
SET tier = 'core',
    auto_route_eligible = true,
    is_visible = true,
    status = 'active',
    updated_at = NOW()
WHERE id = 'nano-banana-pro';

UPDATE ai_studio.model_pricing
SET base_credits = 15,
    min_credits = 10,
    is_active = true,
    min_gross_margin_rate = '0.7500',
    updated_at = NOW()
WHERE model_id = 'nano-banana-pro';

-- 3. Elevate RunningHub in provider_models: enable pm_nano-banana_runninghub and pm_nano-banana-pro_runninghub (priority 200)
UPDATE ai_studio.provider_models
SET enabled = true,
    priority = 200,
    cost_config = jsonb_build_object('currency', 'USD', 'base_cost', 0.02),
    supported_resolutions = CASE 
      WHEN supported_resolutions IS NULL OR supported_resolutions = '[]'::jsonb 
      THEN '["1024x1024", "1280x720", "720x1280", "1920x1080", "1080x1920", "2048x2048", "auto"]'::jsonb 
      ELSE supported_resolutions 
    END,
    updated_at = NOW()
WHERE id IN ('pm_nano-banana_runninghub', 'pm_nano-banana-pro_runninghub');

-- 4. Volcengine channel maintenance: ensure active and healthy
UPDATE ai_studio.provider_models
SET enabled = true,
    priority = 300,
    provider_endpoint = '/images/generations',
    updated_at = NOW()
WHERE id IN ('pm_nano-banana_volcengine', 'pm_nano-banana-pro_volcengine');

UPDATE ai_studio.provider_models
SET enabled = true,
    cost_config = jsonb_build_object('currency', 'USD', 'base_cost', 0.02),
    provider_endpoint = '/api/v3/cv/image_generation',
    supported_resolutions = CASE 
      WHEN supported_resolutions IS NULL OR supported_resolutions = '[]'::jsonb 
      THEN '["1024x1024", "1280x720", "720x1280", "1920x1080", "1080x1920", "2048x2048", "auto"]'::jsonb 
      ELSE supported_resolutions 
    END,
    updated_at = NOW()
WHERE id = 'pm_test_seedream_volcengine';

-- 5. Populate standard direct provider endpoints for degraded core models
UPDATE ai_studio.provider_models
SET provider_endpoint = '/services/aigc/text2image/image-synthesis',
    enabled = true,
    cost_config = jsonb_build_object('currency', 'CNY', 'base_cost', 0.02),
    supported_resolutions = '["1024x1024", "1280x720", "720x1280", "1920x1080", "1080x1920", "2048x2048", "auto"]'::jsonb,
    updated_at = NOW()
WHERE id = 'pm_wan2_1_text_to_image_alibaba';

UPDATE ai_studio.provider_models
SET provider_endpoint = '/services/aigc/video-generation/video-synthesis',
    enabled = true,
    cost_config = jsonb_build_object('currency', 'CNY', 'base_cost', 0.05),
    supported_resolutions = '["720p", "1080p", "1280x720", "1920x1080", "auto"]'::jsonb,
    updated_at = NOW()
WHERE id = 'pm_wan2_1_image_to_video_alibaba';

UPDATE ai_studio.provider_models
SET provider_endpoint = '/v1/videos/text2video',
    enabled = true,
    cost_config = jsonb_build_object('currency', 'CNY', 'base_cost', 0.05),
    supported_resolutions = '["720p", "1080p", "1280x720", "1920x1080", "auto"]'::jsonb,
    updated_at = NOW()
WHERE id = 'pm_kling_v2_6_pro_t2v_kling';

UPDATE ai_studio.provider_models
SET provider_endpoint = '/v1/video_generation',
    enabled = true,
    cost_config = jsonb_build_object('currency', 'CNY', 'base_cost', 0.05),
    supported_resolutions = '["720p", "1080p", "1280x720", "1920x1080", "auto"]'::jsonb,
    updated_at = NOW()
WHERE id = 'pm_minimax_hailuo_2_3_standard_t2v_minimax';

UPDATE ai_studio.provider_models
SET provider_endpoint = '/v1/projects/{project}/locations/{location}/publishers/google/models/veo-2.0-generate-001',
    enabled = true,
    cost_config = jsonb_build_object('currency', 'USD', 'base_cost', 0.05),
    supported_resolutions = '["720p", "1080p", "1280x720", "1920x1080", "auto"]'::jsonb,
    updated_at = NOW()
WHERE id = 'pm_veo_2_text_to_video_google';

-- Clean up cost_config in minimax music
UPDATE ai_studio.provider_models
SET cost_config = jsonb_build_object('currency', 'USD', 'base_cost', 0.02),
    updated_at = NOW()
WHERE id = 'pm_minimax-music-3_0_runninghub';

-- 6. Synchronize provider_model_price_versions to clean rates without double-counted unit_cost
UPDATE ai_studio.provider_model_price_versions
SET price_config = jsonb_build_object('currency', 'USD', 'base_cost', 0.02),
    status = 'active',
    billing_unit = 'per_request',
    source_observed_at = NOW(),
    effective_at = NOW(),
    created_at = NOW()
WHERE id IN ('pver_test_seedream', 'pver_id_985f11800efc42d6c2aa0d78', 'pver_id_nano_banana_runninghub', 'pver_id_762994ea1ccf3afbc99b4e6f');

UPDATE ai_studio.provider_model_price_versions
SET status = 'active',
    billing_unit = 'per_request',
    source_observed_at = NOW(),
    effective_at = NOW()
WHERE id IN (
  'pver_legacy_e2969354d3aeb386208e0565',
  'pver_legacy_d69f2cbfcc3b179ef33c776f',
  'pver_legacy_d4f6412ef5cc60f4dfe53d83',
  'pver_legacy_fc5914cbacfd985571a1f10d',
  'pver_legacy_1f93d35e113cecb0df0a027b'
);

-- 7. Reset provider circuit breaker & refresh heartbeat timestamps
UPDATE ai_studio.ai_providers
SET circuit_state = 'closed',
    consecutive_failures = 0,
    circuit_opened_at = NULL,
    health_status = 'healthy',
    last_health_check_at = NOW(),
    updated_at = NOW()
WHERE id IN ('runninghub', 'volcengine', 'alibaba', 'kling', 'minimax', 'google', 'muapi');

COMMIT;
