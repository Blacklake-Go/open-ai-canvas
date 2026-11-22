-- 055_fix_provider_api_mode_and_type_constraints.sql
-- 修复供应商 API 调用模式与供应商类型的检查约束，允许 UI 常用别名 (async_poll, sync_direct, webhook, custom)

ALTER TABLE ai_studio.ai_providers DROP CONSTRAINT IF EXISTS ai_providers_api_mode_check;
ALTER TABLE ai_studio.ai_providers DROP CONSTRAINT IF EXISTS ai_providers_provider_type_check;

ALTER TABLE ai_studio.ai_providers ADD CONSTRAINT ai_providers_api_mode_check
  CHECK (api_mode IN ('async', 'sync', 'stream', 'async_poll', 'sync_direct', 'webhook'));

ALTER TABLE ai_studio.ai_providers ADD CONSTRAINT ai_providers_provider_type_check
  CHECK (provider_type IN ('aggregator', 'official', 'direct', 'custom'));
