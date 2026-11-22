-- Migration 066: Fix provider catalog endpoints and backfill generation attempts status
-- 1. Correct alibaba model catalog endpoint
UPDATE ai_studio.ai_providers
SET model_catalog_api_url = 'https://dashscope.aliyuncs.com/api/v1/models',
    updated_at = NOW()
WHERE id = 'alibaba' AND (model_catalog_api_url LIKE '%provider-configured%' OR model_catalog_api_url IS NULL);

-- 2. Synchronize legacy generation_attempts stuck in 'processing' whose creation already resolved
UPDATE ai_studio.generation_attempts att
SET status = c.status,
    duration_ms = COALESCE(att.duration_ms, c.duration_ms, 3000),
    completed_at = COALESCE(att.completed_at, c.updated_at, NOW())
FROM ai_studio.creations c
WHERE att.creation_id = c.id
  AND att.status = 'processing'
  AND c.status IN ('succeeded', 'failed', 'cancelled');
