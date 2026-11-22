-- 070_deepseek_text_models_and_canvas_mount.sql
-- 上架 DeepSeek 官方最强文本模型（deepseek-r1, deepseek-v3）并挂载至无限画布

-- 1. 上架模型至 ai_studio.ai_models
INSERT INTO ai_studio.ai_models (
  id,
  slug,
  name,
  display_name,
  category,
  description,
  status,
  sort,
  is_featured,
  capabilities,
  tier,
  is_visible,
  auto_route_eligible,
  backup_model_id,
  is_pinned,
  created_at,
  updated_at
) VALUES
  (
    'deepseek-r1',
    'deepseek-r1',
    'DeepSeek R1',
    'DeepSeek R1 深度思考',
    'text',
    'DeepSeek 官方最强推理大模型，拥有极高水平的数学、代码和逻辑推理能力，具备完整推理思考链路。',
    'active',
    1,
    TRUE,
    '{"badge": "Reasoning", "sub_type": "reasoner", "input_types": ["text"], "output_types": ["text"], "supported_task_types": ["chat", "completion", "reasoning"], "is_pinned": true}'::jsonb,
    'core',
    TRUE,
    TRUE,
    'deepseek-v3',
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'deepseek-v3',
    'deepseek-v3',
    'DeepSeek V3',
    'DeepSeek V3 顶级推理',
    'text',
    'DeepSeek 官方最强通用大模型，671B MoE 架构，性能全面对标国际顶尖闭源模型。',
    'active',
    2,
    TRUE,
    '{"badge": "Top", "sub_type": "chat", "input_types": ["text"], "output_types": ["text"], "supported_task_types": ["chat", "completion"], "is_pinned": true}'::jsonb,
    'core',
    TRUE,
    TRUE,
    NULL,
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  status = 'active',
  tier = 'core',
  is_visible = TRUE,
  auto_route_eligible = TRUE,
  backup_model_id = EXCLUDED.backup_model_id,
  capabilities = EXCLUDED.capabilities,
  is_pinned = TRUE,
  updated_at = NOW();

-- 2. 配置前台基础积分定价 model_pricing
INSERT INTO ai_studio.model_pricing (
  id,
  model_id,
  pricing_type,
  base_credits,
  formula_config,
  subscription_discounts,
  min_credits,
  min_gross_margin_rate,
  is_active,
  created_at,
  updated_at
) VALUES
  (
    'prc_deepseek_r1',
    'deepseek-r1',
    'fixed',
    8,
    '{"pricing_policy_version": "2026-09-22", "target_contribution_margin_rate": 0.75}'::jsonb,
    '{}'::jsonb,
    1,
    0.7500,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'prc_deepseek_v3',
    'deepseek-v3',
    'fixed',
    5,
    '{"pricing_policy_version": "2026-09-22", "target_contribution_margin_rate": 0.75}'::jsonb,
    '{}'::jsonb,
    1,
    0.7500,
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT (model_id) DO UPDATE SET
  base_credits = EXCLUDED.base_credits,
  pricing_type = 'fixed',
  is_active = TRUE,
  min_gross_margin_rate = 0.7500,
  updated_at = NOW();

-- 3. 关联 DeepSeek 官方渠道映射 provider_models
INSERT INTO ai_studio.provider_models (
  id,
  model_id,
  provider_id,
  provider_model_id,
  enabled,
  priority,
  cost_config,
  parameter_mapping,
  capabilities,
  endpoint_config,
  timeout,
  max_retries,
  supports_webhook,
  supports_polling,
  concurrency_limit,
  rate_limit,
  metadata,
  review_status,
  provider_endpoint,
  supported_task_types,
  supported_resolutions,
  supported_durations,
  supported_qualities,
  supported_regions,
  license_requirements,
  mapping_version,
  created_at,
  updated_at
) VALUES
  (
    'pm_deepseek_r1_deepseek',
    'deepseek-r1',
    'deepseek',
    'deepseek-reasoner',
    TRUE,
    100,
    '{"currency": "CNY", "base_cost": 0.002}'::jsonb,
    '{}'::jsonb,
    '{"input_types": ["text"], "output_types": ["text"], "supported_task_types": ["chat", "completion", "reasoning"]}'::jsonb,
    '{}'::jsonb,
    120000,
    2,
    FALSE,
    FALSE,
    20,
    60,
    '{"official": true}'::jsonb,
    'approved',
    '/chat/completions',
    '["chat", "completion", "reasoning"]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    1,
    NOW(),
    NOW()
  ),
  (
    'pm_deepseek_v3_deepseek',
    'deepseek-v3',
    'deepseek',
    'deepseek-chat',
    TRUE,
    100,
    '{"currency": "CNY", "base_cost": 0.001}'::jsonb,
    '{}'::jsonb,
    '{"input_types": ["text"], "output_types": ["text"], "supported_task_types": ["chat", "completion"]}'::jsonb,
    '{}'::jsonb,
    120000,
    2,
    FALSE,
    FALSE,
    20,
    60,
    '{"official": true}'::jsonb,
    'approved',
    '/chat/completions',
    '["chat", "completion"]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    1,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  enabled = TRUE,
  review_status = 'approved',
  provider_endpoint = '/chat/completions',
  provider_model_id = EXCLUDED.provider_model_id,
  cost_config = EXCLUDED.cost_config,
  capabilities = EXCLUDED.capabilities,
  supported_task_types = EXCLUDED.supported_task_types,
  priority = EXCLUDED.priority,
  updated_at = NOW();

-- 4. 插入渠道价格审计版本 provider_model_price_versions
INSERT INTO ai_studio.provider_model_price_versions (
  id,
  provider_model_id,
  version_no,
  price_type,
  billing_unit,
  currency,
  price_config,
  applicability,
  source_api,
  source_observed_at,
  fetched_at,
  effective_at,
  status,
  manually_locked,
  change_summary,
  created_at
) VALUES
  (
    'pver_deepseek_r1_deepseek_v1',
    'pm_deepseek_r1_deepseek',
    1,
    'manual',
    'per_request',
    'CNY',
    '{"currency": "CNY", "base_cost": 0.002}'::jsonb,
    '{}'::jsonb,
    'deepseek:official',
    NOW(),
    NOW(),
    NOW(),
    'active',
    FALSE,
    '{"note": "DeepSeek R1 official route pricing"}'::jsonb,
    NOW()
  ),
  (
    'pver_deepseek_v3_deepseek_v1',
    'pm_deepseek_v3_deepseek',
    1,
    'manual',
    'per_request',
    'CNY',
    '{"currency": "CNY", "base_cost": 0.001}'::jsonb,
    '{}'::jsonb,
    'deepseek:official',
    NOW(),
    NOW(),
    NOW(),
    'active',
    FALSE,
    '{"note": "DeepSeek V3 official route pricing"}'::jsonb,
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  status = 'active',
  price_config = EXCLUDED.price_config;

-- 5. 路由策略与熔断 routing_policies
INSERT INTO ai_studio.routing_policies (
  id,
  model_id,
  routing_mode,
  weights,
  circuit_breaker_config,
  failover_enabled,
  created_at,
  updated_at
) VALUES
  (
    'rp_deepseek_r1',
    'deepseek-r1',
    'balanced',
    '{"cost": 0.4, "success_rate": 0.3, "speed": 0.2, "capacity": 0.1}'::jsonb,
    '{"failure_threshold": 3, "cooling_period_sec": 60, "half_open_requests": 2}'::jsonb,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'rp_deepseek_v3',
    'deepseek-v3',
    'balanced',
    '{"cost": 0.4, "success_rate": 0.3, "speed": 0.2, "capacity": 0.1}'::jsonb,
    '{"failure_threshold": 3, "cooling_period_sec": 60, "half_open_requests": 2}'::jsonb,
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT (model_id) DO UPDATE SET
  failover_enabled = TRUE,
  updated_at = NOW();

-- 6. 刷新 DeepSeek 供应商探活与熔断状态
UPDATE ai_studio.ai_providers
SET last_health_check_at = NOW(),
    health_status = 'healthy',
    circuit_state = 'closed',
    updated_at = NOW()
WHERE id = 'deepseek';

-- 7. 更新画布配置 ops_bill.system_settings 挂载 DeepSeek 文本模型并设 deepseek-r1 为默认模型
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ops_bill.system_settings WHERE key = 'canvas_model_config') THEN
    UPDATE ops_bill.system_settings
    SET value_json = jsonb_set(
      jsonb_set(
        value_json::jsonb,
        '{mountedModelIds,text}',
        '["deepseek-r1", "deepseek-v3"]'::jsonb
      ),
      '{defaults,textModelId}',
      to_jsonb('deepseek-r1'::text)
    ),
    updated_at = NOW()
    WHERE key = 'canvas_model_config';
  END IF;
END $$;
