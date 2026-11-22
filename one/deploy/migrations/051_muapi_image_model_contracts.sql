-- 051_muapi_image_model_contracts.sql
-- Record the documented MuAPI request contracts and stage live price estimates
-- for review. Routes and prices deliberately remain disabled/pending review.

UPDATE ai_studio.provider_models pm
SET provider_model_id = CASE
      WHEN pm.model_id = 'gpt-image-2' AND pm.provider_model_id = 'gpt-image-2'
        THEN 'gpt-image-2-text-to-image'
      ELSE pm.provider_model_id
    END,
    provider_endpoint = CASE
      WHEN pm.model_id = 'gpt-image-2' THEN '/api/v1/gpt-image-2-text-to-image'
      WHEN pm.model_id = 'nano-banana-pro' THEN '/api/v1/nano-banana-pro'
      WHEN pm.model_id = 'seedream-5.0' THEN '/api/v1/seedream-5.0'
      ELSE pm.provider_endpoint
    END,
    supported_task_types = '["t2i"]'::jsonb,
    supported_resolutions = CASE
      WHEN pm.model_id IN ('gpt-image-2', 'nano-banana-pro') THEN '["1K","2K","4K"]'::jsonb
      ELSE '[]'::jsonb
    END,
    supported_qualities = CASE
      WHEN pm.model_id = 'gpt-image-2' THEN '["low","medium","high"]'::jsonb
      WHEN pm.model_id = 'seedream-5.0' THEN '["basic","high"]'::jsonb
      ELSE '[]'::jsonb
    END,
    capabilities = COALESCE(pm.capabilities, '{}'::jsonb) || jsonb_build_object(
      'input_types', '["text"]'::jsonb,
      'output_types', '["image"]'::jsonb,
      'max_output_count', 1,
      'aspect_ratios', CASE
        WHEN pm.model_id = 'gpt-image-2' THEN '["auto","1:1","16:9","9:16","4:3","3:4","3:2","2:3","5:4","4:5"]'::jsonb
        WHEN pm.model_id = 'nano-banana-pro' THEN '["1:1","3:4","4:3","9:16","16:9","3:2","2:3","5:4","4:5","21:9"]'::jsonb
        ELSE '["1:1","16:9","9:16","4:3","3:4","2:3","3:2","21:9"]'::jsonb
      END,
      'quality_values', CASE
        WHEN pm.model_id = 'gpt-image-2' THEN '["low","medium","high"]'::jsonb
        WHEN pm.model_id = 'seedream-5.0' THEN '["basic","high"]'::jsonb
        ELSE '[]'::jsonb
      END,
      'specification_source_url', CASE
        WHEN pm.model_id = 'gpt-image-2' THEN 'https://muapi.ai/de/playground/gpt-image-2-text-to-image/api'
        WHEN pm.model_id = 'nano-banana-pro' THEN 'https://muapi.ai/ko/playground/nano-banana-pro/api'
        ELSE 'https://muapi.ai/ko/playground/bytedance-seedream-v5.0/api'
      END
    ),
    review_status = 'pending_review',
    enabled = FALSE,
    specification_reviewed_at = NULL,
    specification_reviewed_by = NULL,
    mapping_version = pm.mapping_version + 1,
    metadata = COALESCE(pm.metadata, '{}'::jsonb) || jsonb_build_object(
      'specification_repair', jsonb_build_object(
        'migration', '051_muapi_image_model_contracts',
        'repaired_at', now(),
        'admin_review_required', TRUE
      )
    ),
    updated_at = now()
WHERE pm.provider_id = 'muapi'
  AND (
    (pm.model_id = 'gpt-image-2' AND pm.provider_model_id IN ('gpt-image-2', 'gpt-image-2-text-to-image'))
    OR (pm.model_id = 'nano-banana-pro' AND pm.provider_model_id = 'nano-banana-pro')
    OR (pm.model_id = 'seedream-5.0' AND pm.provider_model_id = 'bytedance-seedream-v5.0')
  )
  AND NOT EXISTS (
    SELECT 1 FROM ai_studio.provider_models duplicate
    WHERE duplicate.id <> pm.id
      AND duplicate.model_id = pm.model_id
      AND duplicate.provider_id = pm.provider_id
      AND duplicate.provider_model_id = CASE
        WHEN pm.model_id = 'gpt-image-2' THEN 'gpt-image-2-text-to-image'
        ELSE pm.provider_model_id
      END
  );

WITH model_price_source AS (
  SELECT pm.id AS provider_model_id,
    pm.provider_model_id AS external_model_id,
    COALESCE((SELECT MAX(existing.version_no) FROM ai_studio.provider_model_price_versions existing
      WHERE existing.provider_model_id = pm.id), 0) + 1 AS version_no,
    CASE
      WHEN pm.model_id = 'gpt-image-2' THEN 'https://muapi.ai/de/playground/gpt-image-2-text-to-image/api'
      WHEN pm.model_id = 'nano-banana-pro' THEN 'https://muapi.ai/ko/playground/nano-banana-pro/api'
      ELSE 'https://muapi.ai/ko/playground/bytedance-seedream-v5.0/api'
    END AS source_url,
    'https://api.muapi.ai/api/v1/models/' || pm.provider_model_id || '/estimate-cost' AS source_api
  FROM ai_studio.provider_models pm
  WHERE pm.provider_id = 'muapi'
    AND (
      (pm.model_id = 'gpt-image-2' AND pm.provider_model_id = 'gpt-image-2-text-to-image')
      OR (pm.model_id = 'nano-banana-pro' AND pm.provider_model_id = 'nano-banana-pro')
      OR (pm.model_id = 'seedream-5.0' AND pm.provider_model_id = 'bytedance-seedream-v5.0')
    )
)
INSERT INTO ai_studio.provider_model_price_versions
  (id, provider_model_id, version_no, price_type, billing_unit, currency, price_config,
   source_url, source_api, source_observed_at, fetched_at, evidence_digest, status,
   change_summary, modified_by)
SELECT 'pmv_muapi_051_' || substr(md5(source.provider_model_id || '|' || source.version_no::text), 1, 32),
  source.provider_model_id,
  source.version_no,
  'aggregator',
  'per_request_estimate',
  'USD',
  jsonb_build_object(
    'dynamic_pricing', TRUE,
    'estimate_endpoint', '/api/v1/models/' || source.external_model_id || '/estimate-cost'
  ),
  source.source_url,
  source.source_api,
  now(),
  now(),
  md5(source.source_url || '|' || source.source_api || '|051'),
  'pending_review',
  jsonb_build_object('reason', 'documented MuAPI contract; dynamic estimate requires admin review'),
  'migration:051_muapi_image_model_contracts'
FROM model_price_source source
WHERE NOT EXISTS (
  SELECT 1 FROM ai_studio.provider_model_price_versions existing
  WHERE existing.provider_model_id = source.provider_model_id
    AND existing.source_api = source.source_api
    AND existing.status <> 'rejected'
);
