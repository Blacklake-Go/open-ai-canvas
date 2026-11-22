-- 034_pricing_policy_v2.sql
-- Production-compatible pricing policy migration for the online catalog.
-- The online database already uses 001..033, so this is intentionally 034.

-- Canonical commercial plans: no bonus credits and no cycle discount.  Each
-- credit is sold at ¥0.07; quarterly/yearly amounts are derived by the app.
INSERT INTO ops_bill.plans_config
  (id, name, billing_cycle, price_cny, price_usd, credits_included,
   monthly_cny, monthly_usd, features_json, sort_order, display_order,
   enabled, is_active, updated_at)
VALUES
  ('starter', 'Starter (入门探索版)', 'monthly', 140, 20, 2000, 140, 20,
   '{"items":["每月 2,000 创作积分（¥0.07/积分）","专享 Seedance 2.5 & 2.0 异步并发：10","单模型并发数：5","授权人像容量：2 个","资产库单素材快速生成","去水印高清导出","商业使用许可"],"meta":{"yearlyCny":1680,"yearlyUsd":240,"quarterlyCny":420,"quarterlyUsd":60,"quotaBase":2000,"quotaBonus":0,"concurrency":5,"asyncConcurrency":10,"portraitCapacity":2,"badge":""}}'::jsonb,
   1, 1, TRUE, TRUE, now()),
  ('basic', 'Basic (进阶创作者)', 'monthly', 350, 50, 5000, 350, 50,
   '{"items":["每月 5,000 创作积分（¥0.07/积分）","专享 Seedance 2.5 & 2.0 异步并发：20","单模型并发数：7","授权人像容量：5 个","包含 Starter 全部特权","去水印与极速优先生成通道"],"meta":{"yearlyCny":4200,"yearlyUsd":600,"quarterlyCny":1050,"quarterlyUsd":150,"quotaBase":5000,"quotaBonus":0,"concurrency":7,"asyncConcurrency":20,"portraitCapacity":5,"badge":"推荐"}}'::jsonb,
   2, 2, TRUE, TRUE, now()),
  ('plus', 'Plus (专业工作室)', 'monthly', 700, 100, 10000, 700, 100,
   '{"items":["每月 10,000 创作积分（¥0.07/积分）","专享 Seedance 2.5 & 2.0 异步并发：50","单模型并发数：10","授权人像容量：10 个","图片视频 HD 超清增强","真人多风格合规生成"],"meta":{"yearlyCny":8400,"yearlyUsd":1200,"quarterlyCny":2100,"quarterlyUsd":300,"quotaBase":10000,"quotaBonus":0,"concurrency":10,"asyncConcurrency":50,"portraitCapacity":10,"badge":""}}'::jsonb,
   3, 3, TRUE, TRUE, now()),
  ('pro', 'Pro (旗舰大师版)', 'monthly', 1400, 200, 20000, 1400, 200,
   '{"items":["每月 20,000 创作积分（¥0.07/积分）","专享 Seedance 2.5 & 2.0 异步并发：80","单模型并发数：15","授权人像容量：20 个","图片视频 4K 极清超采样","多语言真人双风格极速生成","VIP 1 对 1 专属技术支持与企业级 SLA"],"meta":{"yearlyCny":16800,"yearlyUsd":2400,"quarterlyCny":4200,"quarterlyUsd":600,"quotaBase":20000,"quotaBonus":0,"concurrency":15,"asyncConcurrency":80,"portraitCapacity":20,"badge":"旗舰"}}'::jsonb,
   4, 4, TRUE, TRUE, now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  billing_cycle = 'monthly',
  price_cny = EXCLUDED.price_cny,
  price_usd = EXCLUDED.price_usd,
  credits_included = EXCLUDED.credits_included,
  monthly_cny = EXCLUDED.monthly_cny,
  monthly_usd = EXCLUDED.monthly_usd,
  features_json = EXCLUDED.features_json,
  sort_order = EXCLUDED.sort_order,
  display_order = EXCLUDED.display_order,
  enabled = TRUE,
  is_active = TRUE,
  updated_at = now();

-- Treat legacy video base_cost as cost per output second. Adjustment/edit
-- models also reserve input-video seconds so one edit cannot be underquoted.
UPDATE ai_studio.provider_models pm
SET cost_config = COALESCE(pm.cost_config, '{}'::jsonb) || jsonb_build_object(
  'pricing_policy_version', '2026-09-22',
  'cost_per_output_second', COALESCE(
    NULLIF(pm.cost_config->>'cost_per_output_second', '')::numeric,
    NULLIF(pm.cost_config->>'cost_per_second', '')::numeric,
    NULLIF(pm.cost_config->>'base_cost', '')::numeric, 0),
  'cost_per_input_second', CASE
    WHEN m.id ILIKE '%edit%' OR m.id ILIKE '%recast%' OR m.id ILIKE '%r2v%'
      OR m.id ILIKE '%motion-control%' OR m.id ILIKE '%video-to-video%'
    THEN COALESCE(NULLIF(pm.cost_config->>'cost_per_input_second', '')::numeric,
                  NULLIF(pm.cost_config->>'base_cost', '')::numeric, 0)
    ELSE COALESCE(NULLIF(pm.cost_config->>'cost_per_input_second', '')::numeric, 0)
  END,
  'base_cost', 0,
  'default_output_seconds', COALESCE(NULLIF(pm.cost_config->>'default_output_seconds', '')::numeric, 5),
  'duration_scales', FALSE)
FROM ai_studio.ai_models m
WHERE pm.model_id = m.id
  AND m.category IN ('video', 'video_image', 'video_text')
  AND COALESCE((pm.cost_config->>'base_cost')::numeric, 0) > 0;

-- Reference price uses the highest enabled provider cost. Runtime recalculates
-- for resolution, input/output duration and batch size.
WITH max_enabled_cost AS (
  SELECT pm.model_id,
    MAX((COALESCE((pm.cost_config->>'base_cost')::numeric, 0)
      + COALESCE((pm.cost_config->>'cost_per_output_second')::numeric, 0)
        * COALESCE((pm.cost_config->>'default_output_seconds')::numeric, 5))
      * CASE UPPER(COALESCE(pm.cost_config->>'currency', 'USD'))
          WHEN 'CNY' THEN 1 WHEN 'RMB' THEN 1 ELSE 7.2 END) AS max_cost_cny
  FROM ai_studio.provider_models pm
  JOIN ai_studio.ai_providers p ON p.id = pm.provider_id AND p.enabled = TRUE
  WHERE pm.enabled = TRUE
  GROUP BY pm.model_id
)
UPDATE ai_studio.model_pricing mp
SET pricing_type = CASE WHEN m.category IN ('video', 'video_image', 'video_text') THEN 'formula' ELSE 'fixed' END,
    base_credits = GREATEST(10, CEIL((COALESCE(c.max_cost_cny, 0) * 1.10 / (0.07 * 0.25)) / 5.0)::integer * 5),
    formula_config = COALESCE(mp.formula_config, '{}'::jsonb) || jsonb_build_object(
      'pricing_policy_version', '2026-09-22', 'cost_source_required', TRUE,
      'credit_value_cny', 0.07, 'provider_cost_reserve_rate', 0.10,
      'target_contribution_margin_rate', 0.75, 'credit_rounding', 5,
      'membership_price_multiplier', 1.0),
    subscription_discounts = '{}'::jsonb,
    min_credits = GREATEST(mp.min_credits, 10),
    min_gross_margin_rate = 0.7500,
    is_active = TRUE,
    updated_at = now()
FROM ai_studio.ai_models m
LEFT JOIN max_enabled_cost c ON c.model_id = m.id
WHERE mp.model_id = m.id;
