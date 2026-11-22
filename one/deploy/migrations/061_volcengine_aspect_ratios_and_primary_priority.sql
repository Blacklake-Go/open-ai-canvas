-- 061_volcengine_aspect_ratios_and_primary_priority.sql
-- 修复火山方舟提供商路由能力集缺失 aspect_ratios 导致智能路由在多参数匹配时触发 NO_COST_VERIFIED_ROUTE 的隐性漏洞
-- 将已就绪且测试通过的 volcengine 优先级提升为 500（优先主通道），runninghub (200) 为次级容灾通道
-- 并将 nano-banana 的二级灾备模型从单一渠道的 flux-dev 调整为全通道就绪的 nano-banana-pro

UPDATE ai_studio.provider_models
SET capabilities = jsonb_set(
  COALESCE(capabilities, '{}'::jsonb),
  '{aspect_ratios}',
  '["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9", "*"]'::jsonb
),
priority = 500,
enabled = true
WHERE provider_id = 'volcengine'
  AND model_id IN ('nano-banana', 'nano-banana-pro', 'seedream-5.0', 'seedream-5.0-edit');

-- 确保 supported_resolutions 包含常用比例规格 (jsonb 类型)
UPDATE ai_studio.provider_models
SET supported_resolutions = '["*", "1024x1024", "2048x2048", "2560x1440", "1440x2560", "2304x1728", "1728x2304", "1K", "2K", "4K"]'::jsonb
WHERE provider_id = 'volcengine'
  AND model_id IN ('nano-banana', 'nano-banana-pro');

-- 优化模型互相灾备链，防止逃逸至欠费的上游渠道
UPDATE ai_studio.ai_models
SET backup_model_id = 'nano-banana-pro'
WHERE id = 'nano-banana';

UPDATE ai_studio.ai_models
SET backup_model_id = 'nano-banana'
WHERE id = 'nano-banana-pro';
