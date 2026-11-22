-- 043_backfill_mapping_provider_endpoint.sql
--
-- Root cause of the platform-wide "该模型暂时没有可用的生成渠道" failure:
-- migration 040 added `ai_studio.provider_models.provider_endpoint` as a new
-- nullable column and the router (lib/modelCenter/routePricing.js) rejects every
-- candidate whose endpoint is blank (PROVIDER_ENDPOINT_MISSING). All 979 mappings
-- predate the column, so 979/979 channels failed the very first rung and no model
-- on the shelf could be submitted — independent of keys, prices or health.
--
-- This migration backfills only the providers whose outbound path is a
-- deterministic function of data the platform already stores and calls with today:
--   * muapi      -> '/api/v1/' || provider_model_id (MuAPIAdapter's own submit path;
--                    verified against the live supplier: /api/v1/<slug> answers 403
--                    "auth required" while /<slug> answers 404)
--   * runninghub -> provider_model_id, which already holds the `openapi/...` path
--                    RunningHubAdapter submits to (it rejects anything else)
-- Every other provider derives its path from the requested task type
-- (Kling text2video vs image2video, DashScope text2image vs video-synthesis), so
-- their endpoints must be set per mapping through the admin Control Tower after
-- review; a blanket value here would silently change the URL actually called.
--
-- Idempotent, reversible through the backup table, and never overwrites a value an
-- admin has already reviewed.

-- The migration runner wraps the entire batch in one transaction. Keep this
-- file free of transaction-control statements so the ledger and data commit
-- together.

CREATE TABLE IF NOT EXISTS ai_studio.provider_model_endpoint_backfill_backup (
  mapping_id TEXT PRIMARY KEY,
  previous_provider_endpoint TEXT,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO ai_studio.provider_model_endpoint_backfill_backup (mapping_id, previous_provider_endpoint)
SELECT pm.id, pm.provider_endpoint
  FROM ai_studio.provider_models pm
 WHERE pm.provider_endpoint IS NULL
   AND pm.provider_id IN ('muapi', 'runninghub')
ON CONFLICT (mapping_id) DO NOTHING;

UPDATE ai_studio.provider_models
   SET provider_endpoint = '/api/v1/' || btrim(provider_model_id, '/'),
       updated_at = now()
 WHERE provider_endpoint IS NULL
   AND provider_id = 'muapi'
   AND btrim(COALESCE(provider_model_id, ''), '/') <> '';

UPDATE ai_studio.provider_models
   SET provider_endpoint = '/' || btrim(provider_model_id, '/'),
       updated_at = now()
 WHERE provider_endpoint IS NULL
   AND provider_id = 'runninghub'
   AND btrim(COALESCE(provider_model_id, ''), '/') LIKE 'openapi/%';
