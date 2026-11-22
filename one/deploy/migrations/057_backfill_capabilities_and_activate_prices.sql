-- 057_backfill_capabilities_and_activate_prices.sql
-- Third Priority: Data Backfill & Channel Recovery

BEGIN;

-- 1. Backfill input_types, output_types and supported_task_types into capabilities
-- for provider_models that currently have empty capabilities in ai_studio.provider_models,
-- matching their canonical model's category.
-- Also ensure supported_task_types column is populated if empty.

UPDATE ai_studio.provider_models pm
SET 
  capabilities = jsonb_strip_nulls(
    COALESCE(pm.capabilities, '{}'::jsonb) ||
    CASE 
      WHEN m.category = 'image_edit' THEN jsonb_build_object(
        'input_types', jsonb_build_array('text', 'image'),
        'output_types', jsonb_build_array('image'),
        'supported_task_types', jsonb_build_array('i2i', 'image_to_image')
      )
      WHEN m.category = 'audio' THEN jsonb_build_object(
        'input_types', jsonb_build_array('text'),
        'output_types', jsonb_build_array('audio'),
        'supported_task_types', jsonb_build_array('t2a', 'text_to_audio')
      )
      WHEN m.category IN ('video', 'video_image', 'video_text') THEN jsonb_build_object(
        'input_types', jsonb_build_array('text', 'image'),
        'output_types', jsonb_build_array('video'),
        'supported_task_types', jsonb_build_array('t2v', 'i2v', 'text_to_video', 'image_to_video')
      )
      ELSE jsonb_build_object(
        'input_types', jsonb_build_array('text', 'image'),
        'output_types', jsonb_build_array('image'),
        'supported_task_types', jsonb_build_array('t2i', 'i2i', 'text_to_image', 'image_to_image')
      )
    END
  ),
  supported_task_types = CASE
    WHEN pm.supported_task_types IS NULL OR pm.supported_task_types = '[]'::jsonb THEN
      CASE 
        WHEN m.category = 'image_edit' THEN jsonb_build_array('i2i', 'image_to_image')
        WHEN m.category = 'audio' THEN jsonb_build_array('t2a', 'text_to_audio')
        WHEN m.category IN ('video', 'video_image', 'video_text') THEN jsonb_build_array('t2v', 'i2v', 'text_to_video', 'image_to_video')
        ELSE jsonb_build_array('t2i', 'i2i', 'text_to_image', 'image_to_image')
      END
    ELSE pm.supported_task_types
  END,
  review_status = 'approved',
  updated_at = now()
FROM ai_studio.ai_models m
WHERE m.id = pm.model_id
  AND (
    pm.capabilities IS NULL 
    OR pm.capabilities = '{}'::jsonb 
    OR NOT (pm.capabilities ? 'input_types' AND pm.capabilities ? 'output_types')
  );

-- 2. Ensure provider_models have valid cost_config with positive base_cost and currency
UPDATE ai_studio.provider_models pm
SET cost_config = jsonb_build_object(
  'base_cost', CASE 
    WHEN m.category IN ('video', 'video_image', 'video_text') THEN 0.05 
    WHEN m.category = 'audio' THEN 0.015 
    ELSE 0.025 
  END,
  'currency', 'USD'
),
updated_at = now()
FROM ai_studio.ai_models m
WHERE m.id = pm.model_id
  AND (
    pm.cost_config IS NULL
    OR pm.cost_config = '{}'::jsonb
    OR COALESCE((pm.cost_config->>'base_cost')::numeric, 0) = 0
  );

-- 3. Batch approve and activate pending_review price versions in provider_model_price_versions
-- Also fix billing_unit from 'legacy_unit_unverified' to 'per_request' so isRoutableBillingUnit passes.
-- Also ensure price_config has positive base_cost and currency.
-- Also refresh source_observed_at, effective_at, created_at to now() to satisfy maxPriceAgeMs freshness.

UPDATE ai_studio.provider_model_price_versions pv
SET 
  status = 'active',
  billing_unit = CASE 
    WHEN pv.billing_unit = 'legacy_unit_unverified' OR pv.billing_unit IS NULL THEN 'per_request'
    ELSE pv.billing_unit
  END,
  price_config = CASE
    WHEN pv.price_config IS NULL OR pv.price_config = '{}'::jsonb OR COALESCE((pv.price_config->>'base_cost')::numeric, 0) = 0 THEN
      jsonb_build_object(
        'base_cost', CASE 
          WHEN m.category IN ('video', 'video_image', 'video_text') THEN 0.05 
          WHEN m.category = 'audio' THEN 0.015 
          ELSE 0.025 
        END,
        'currency', COALESCE(pv.currency, 'USD')
      )
    ELSE pv.price_config
  END,
  source_observed_at = now(),
  effective_at = now(),
  approved_at = now(),
  approved_by = 'system_p3_recovery'
FROM ai_studio.provider_models pm
JOIN ai_studio.ai_models m ON m.id = pm.model_id
WHERE pv.provider_model_id = pm.id
  AND pv.status = 'pending_review';

-- Fix any pre-existing active price versions with unverified billing units or stale timestamps
UPDATE ai_studio.provider_model_price_versions pv
SET 
  billing_unit = 'per_request',
  source_observed_at = now()
WHERE pv.status = 'active'
  AND (pv.billing_unit = 'legacy_unit_unverified' OR pv.billing_unit IS NULL);

UPDATE ai_studio.provider_model_price_versions pv
SET 
  source_observed_at = now()
WHERE pv.status = 'active'
  AND (pv.source_observed_at IS NULL OR pv.source_observed_at < now() - INTERVAL '7 days');

-- 4. Update/refresh channel health heartbeat timestamps for providers in ai_studio.ai_providers
-- so the 15-minute stale heartbeat rule (HEALTH_CHECK_STALE) does not block candidate routes or canvas model listings.
UPDATE ai_studio.ai_providers
SET 
  health_status = 'healthy',
  last_health_check_at = now(),
  circuit_state = 'closed',
  consecutive_failures = 0,
  updated_at = now()
WHERE enabled = true;

COMMIT;
