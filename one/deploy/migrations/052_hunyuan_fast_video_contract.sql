-- 052_hunyuan_fast_video_contract.sql
-- Stage the documented MuAPI Hunyuan Fast text-to-video contract for review.
-- The model and route deliberately remain disabled until an operator approves them.

UPDATE ai_studio.provider_models pm
SET provider_endpoint = '/api/v1/hunyuan-fast-text-to-video',
    supported_task_types = '["t2v"]'::jsonb,
    supported_resolutions = '[]'::jsonb,
    supported_durations = '[]'::jsonb,
    supported_qualities = '[]'::jsonb,
    capabilities = COALESCE(pm.capabilities, '{}'::jsonb) || jsonb_build_object(
      'input_types', '["text"]'::jsonb,
      'output_types', '["video"]'::jsonb,
      'aspect_ratios', '["16:9","9:16","1:1"]'::jsonb,
      'max_output_count', 1,
      'specification_source_url', 'https://muapi.ai/playground/hunyuan-fast-text-to-video/api'
    ),
    review_status = 'pending_review',
    enabled = FALSE,
    specification_reviewed_at = NULL,
    specification_reviewed_by = NULL,
    mapping_version = pm.mapping_version + 1,
    metadata = COALESCE(pm.metadata, '{}'::jsonb) || jsonb_build_object(
      'specification_repair', jsonb_build_object(
        'migration', '052_hunyuan_fast_video_contract',
        'admin_review_required', TRUE
      )
    ),
    updated_at = now()
WHERE pm.provider_id = 'muapi'
  AND pm.model_id = 'hunyuan-fast-text-to-video'
  AND pm.provider_model_id = 'hunyuan-fast-text-to-video';

WITH mapping AS (
  SELECT pm.id AS provider_model_id,
    COALESCE((SELECT MAX(existing.version_no)
      FROM ai_studio.provider_model_price_versions existing
      WHERE existing.provider_model_id = pm.id), 0) + 1 AS version_no,
    'https://muapi.ai/playground/hunyuan-fast-text-to-video/api' AS source_url,
    'https://api.muapi.ai/api/v1/models/hunyuan-fast-text-to-video/estimate-cost' AS source_api
  FROM ai_studio.provider_models pm
  WHERE pm.provider_id = 'muapi'
    AND pm.model_id = 'hunyuan-fast-text-to-video'
    AND pm.provider_model_id = 'hunyuan-fast-text-to-video'
)
INSERT INTO ai_studio.provider_model_price_versions
  (id, provider_model_id, version_no, price_type, billing_unit, currency, price_config,
   source_url, source_api, source_observed_at, fetched_at, evidence_digest, status,
   change_summary, modified_by)
SELECT 'pmv_muapi_052_' || substr(md5(mapping.provider_model_id || '|' || mapping.version_no::text), 1, 32),
  mapping.provider_model_id,
  mapping.version_no,
  'aggregator',
  'per_request_estimate',
  'USD',
  jsonb_build_object(
    'dynamic_pricing', TRUE,
    'estimate_endpoint', '/api/v1/models/hunyuan-fast-text-to-video/estimate-cost'
  ),
  mapping.source_url,
  mapping.source_api,
  now(),
  now(),
  md5(mapping.source_url || '|' || mapping.source_api || '|052'),
  'pending_review',
  jsonb_build_object('reason', 'documented Hunyuan Fast API; confirm account estimate and margin before activation'),
  'migration:052_hunyuan_fast_video_contract'
FROM mapping
WHERE NOT EXISTS (
  SELECT 1 FROM ai_studio.provider_model_price_versions existing
  WHERE existing.provider_model_id = mapping.provider_model_id
    AND existing.source_api = mapping.source_api
    AND existing.status <> 'rejected'
);
