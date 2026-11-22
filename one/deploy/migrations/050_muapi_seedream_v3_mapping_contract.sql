-- 050_muapi_seedream_v3_mapping_contract.sql
-- Pin the MuAPI Seedream 3 contract published by the official live model catalog.
-- The mapping remains disabled and pending review; this migration must not open
-- paid generation before provider cost and the site's margin are verified.

UPDATE ai_studio.provider_models
SET provider_endpoint = '/api/v1/bytedance-seedream-v3',
    supported_task_types = '["t2i"]'::jsonb,
    supported_resolutions = '[]'::jsonb,
    capabilities = COALESCE(capabilities, '{}'::jsonb) || jsonb_build_object(
      'input_types', '["text"]'::jsonb,
      'output_types', '["image"]'::jsonb,
      'max_output_count', 1,
      'aspect_ratios', '["1:1","16:9","9:16","3:4","4:3"]'::jsonb,
      'specification_source_url', 'https://muapi.ai/playground/bytedance-seedream-v3/api',
      'pricing_source_url', 'https://muapi.ai/docs/pricing'
    ),
    review_status = 'pending_review',
    enabled = FALSE,
    specification_reviewed_at = NULL,
    specification_reviewed_by = NULL,
    mapping_version = mapping_version + 1,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'specification_repair', jsonb_build_object(
        'source_url', 'https://muapi.ai/playground/bytedance-seedream-v3/api',
        'pricing_source_url', 'https://muapi.ai/docs/pricing',
        'repaired_at', now(),
        'admin_review_required', TRUE
      )
    ),
    updated_at = now()
WHERE model_id = 'bytedance-seedream-v3'
  AND provider_id = 'muapi'
  AND provider_model_id = 'bytedance-seedream-v3'
  AND (
    provider_endpoint IS DISTINCT FROM '/api/v1/bytedance-seedream-v3'
    OR supported_task_types IS DISTINCT FROM '["t2i"]'::jsonb
    OR supported_resolutions IS DISTINCT FROM '[]'::jsonb
    OR capabilities->'input_types' IS DISTINCT FROM '["text"]'::jsonb
    OR capabilities->'output_types' IS DISTINCT FROM '["image"]'::jsonb
    OR capabilities->'max_output_count' IS DISTINCT FROM '1'::jsonb
    OR capabilities->'aspect_ratios' IS DISTINCT FROM '["1:1","16:9","9:16","3:4","4:3"]'::jsonb
    OR review_status IS DISTINCT FROM 'pending_review'
    OR enabled IS DISTINCT FROM FALSE
  );
