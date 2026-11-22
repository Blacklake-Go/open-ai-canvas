-- 023_ark_image_gateway.sql
-- 把「火山方舟图像网关」登记成可直连供应商，并为它确实能调用的 Seedream 图像模型建立渠道。
--
-- 为什么放在迁移里：调用链改为「按目录渠道决定网关」之后，线上唯一在正常出片的
-- seedream-5.0 必须有 volcengine 渠道，否则部署瞬间会退回聚合网关。后台的
-- 「对账老目录」按钮负责补齐其余历史模型，两者都是只插不改，重复执行不会产生半条覆盖。

-- 1. 网关供应商（provider_type=official：方舟是字节的官方 API，不是聚合转售）
INSERT INTO ai_studio.ai_providers
  (id, slug, name, provider_type, enabled, priority, base_url, api_mode, currency, metadata, created_at, updated_at)
VALUES
  ('volcengine', 'volcengine', '火山方舟 / Volcengine Ark', 'official', TRUE, 100,
   'https://ark.cn-beijing.volces.com/api/v3', 'async', 'CNY',
   '{"registered_from":"adapter_registry"}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

-- 2. 标准模型目录行（渠道外键指向 ai_models，与 lib/repositories/legacyCatalog.js 的映射口径一致）
INSERT INTO ai_studio.ai_models
  (id, slug, name, display_name, category, description, cover, status, sort, is_featured,
   capabilities, created_at, updated_at)
SELECT
  mc.id,
  mc.id,
  COALESCE(NULLIF(btrim(mc.name), ''), mc.id),
  COALESCE(NULLIF(btrim(mc.name), ''), mc.id),
  'image',
  COALESCE(NULLIF(mc.metadata_json ->> 'description', ''), mc.name, mc.id),
  COALESCE(mc.metadata_json ->> 'cover', ''),
  CASE WHEN mc.is_active THEN 'active' ELSE 'disabled' END,
  COALESCE(mc.sort_order, 0),
  FALSE,
  COALESCE(mc.metadata_json, '{}'::jsonb) || jsonb_build_object('_synced_from', 'models_config'),
  mc.created_at,
  now()
FROM ai_studio.models_config mc
WHERE mc.type = 'image' AND lower(mc.id) LIKE 'seedream%'
ON CONFLICT DO NOTHING;

-- 3. 方舟渠道：优先级 110 高于聚合网关的 100，因为它是当前唯一有出片记录的通道
INSERT INTO ai_studio.provider_models
  (id, model_id, provider_id, provider_model_id, enabled, priority,
   cost_config, endpoint_config, metadata, timeout, created_at, updated_at)
SELECT
  'pm_' || replace(mc.id, '-', '_') || '_volcengine',
  mc.id,
  'volcengine',
  mc.id,
  mc.is_active,
  110,
  jsonb_build_object('currency', 'CNY', 'base_cost', COALESCE(mc.cost_usd, 0)),
  jsonb_build_object('model', mc.id),
  jsonb_build_object('synced_from', 'models_config', 'legacy_brand', mc.provider),
  120000,
  mc.created_at,
  now()
FROM ai_studio.models_config mc
WHERE mc.type = 'image' AND lower(mc.id) LIKE 'seedream%'
  AND NOT EXISTS (
    SELECT 1 FROM ai_studio.provider_models pm
    WHERE pm.model_id = mc.id AND pm.provider_id = 'volcengine'
  )
ON CONFLICT DO NOTHING;
