-- 073: Generation routing repair follow-up (2026-10-19)
-- Applied transactionally on prod; recorded here for reproducibility.
BEGIN;

-- 1) Commercial policy: user price = official provider cost x 130%.
--    Kept in code (lib/pricing/creditPolicy.js); formula models opt into the
--    lower 15% minimum margin so the 130% multiplier can quote successfully.
UPDATE ai_studio.model_pricing
   SET min_gross_margin_rate = 0.15, updated_at = now()
 WHERE pricing_type = 'formula';

UPDATE ai_studio.model_pricing
   SET base_credits = 135, min_gross_margin_rate = 0.15, updated_at = now()
 WHERE model_id = 'seedance-2.0';
UPDATE ai_studio.model_pricing
   SET base_credits = 10, min_gross_margin_rate = 0.15, updated_at = now()
 WHERE model_id = 'kling-2.6';

-- Official RunningHub Seedance 2.0 prices are resolution dependent.
UPDATE ai_studio.provider_model_price_versions
   SET price_config = COALESCE(price_config,'{}'::jsonb)
       || '{"resolution_multipliers":{"480p":0.5,"720p":1.0,"1080p":1.5,"2k":2.0,"4k":3.0}}'::jsonb
 WHERE provider_model_id IN (
   'pm_runninghub_seedance20_global_t2v',
   'pm_runninghub_seedance20_global_i2v'
 );

-- 2) Canvas model capability metadata consumed by /api/canvas/models.
UPDATE ai_studio.ai_models
   SET capabilities = COALESCE(capabilities,'{}'::jsonb) || '{"supports_reference":true,"supports_edit":true,"supported_ratios":["1:1","16:9","9:16","4:3","3:4","2:3","3:2","21:9"],"supported_resolution":["1K","2K","4K"]}'::jsonb,
       supported_ratios = '["1:1","16:9","9:16","4:3","3:4","2:3","3:2","21:9"]'::jsonb,
       supported_resolutions = '["1K","2K","4K"]'::jsonb,
       updated_at = now()
 WHERE id IN ('seedream-5.0','seedream-4.5');

UPDATE ai_studio.ai_models
   SET capabilities = COALESCE(capabilities,'{}'::jsonb) || '{"supports_reference":true,"supports_edit":false,"supports_audio":true,"supported_ratios":["16:9","9:16","1:1","4:3","3:4","21:9"],"supported_resolution":["480p","720p","1080p"],"supported_duration":["4","5","6","7","8","9","10","11","12","13","14","15"]}'::jsonb,
       supported_ratios = '["16:9","9:16","1:1","4:3","3:4","21:9"]'::jsonb,
       supported_resolutions = '["480p","720p","1080p"]'::jsonb,
       supported_durations = '["4","5","6","7","8","9","10","11","12","13","14","15"]'::jsonb,
       updated_at = now()
 WHERE id = 'seedance-2.0';

UPDATE ai_studio.ai_models
   SET capabilities = COALESCE(capabilities,'{}'::jsonb) || '{"supports_reference":true,"supports_edit":false,"supported_ratios":["16:9","9:16","1:1"],"supported_resolution":["720p","1080p"],"supported_duration":["5","10"]}'::jsonb,
       supported_ratios = '["16:9","9:16","1:1"]'::jsonb,
       supported_resolutions = '["720p","1080p"]'::jsonb,
       supported_durations = '["5","10"]'::jsonb,
       updated_at = now()
 WHERE id IN ('kling-3.0','kling-2.6','kling-2.5');

-- 3) Canvas mounts/defaults aligned with the orderable model set.
UPDATE ops_bill.system_settings
   SET value_json = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(value_json, '{mountedModelIds,image}', '["seedream-5.0","seedream-4.5"]'::jsonb, true),
             '{mountedModelIds,video}', '["seedance-2.0","kling-3.0","kling-2.6","kling-2.5"]'::jsonb, true),
           '{defaults,imageModelId}', '"seedream-5.0"'::jsonb, true),
         '{defaults,videoModelId}', '"seedance-2.0"'::jsonb, true),
       version = version + 1,
       updated_by = 'migration:073',
       updated_at = now()
 WHERE key = 'canvas_model_config';

COMMIT;
