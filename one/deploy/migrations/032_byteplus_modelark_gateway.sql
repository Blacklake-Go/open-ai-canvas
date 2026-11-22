-- 032_byteplus_modelark_gateway.sql
-- BytePlus ModelArk provider and explicitly disabled channels.
-- The supplied credential was rejected by both official regional endpoints during
-- deployment validation, so these routes must not enter production selection until
-- a region-matched API key is verified and an operator enables the provider.

INSERT INTO ai_studio.ai_providers
  (id, slug, name, provider_type, enabled, priority, base_url, api_mode, currency, metadata, created_at, updated_at)
VALUES
  ('byteplus', 'byteplus', 'BytePlus ModelArk 聚合网关', 'aggregator', FALSE, 105,
   'https://ark.ap-southeast.bytepluses.com/api/v3', 'async', 'USD',
   '{"registered_from":"byteplus_modelark_adapter","activation":"pending_verified_region_key","supports":"seedream_and_seedance"}'::jsonb,
   now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_studio.provider_models
  (id, model_id, provider_id, provider_model_id, enabled, priority, cost_config, endpoint_config, metadata, timeout, max_retries, supports_polling, created_at, updated_at)
VALUES
  ('pm_seedream_5_0_byteplus', 'seedream-5.0', 'byteplus', 'seedream-5.0', FALSE, 105,
   '{"currency":"USD","base_cost":0.035,"pricing_source":"BytePlus ModelArk public pricing","pricing_unit":"image"}'::jsonb,
   '{"model":"seedream-5-0-lite-260128","endpoint":"/images/generations"}'::jsonb,
   '{"category":"image","activation":"pending_verified_region_key"}'::jsonb, 120000, 1, FALSE, now(), now()),
  ('pm_seedream_5_0_edit_byteplus', 'seedream-5.0-edit', 'byteplus', 'seedream-5.0-edit', FALSE, 105,
   '{"currency":"USD","base_cost":0.03,"pricing_source":"BytePlus ModelArk public pricing","pricing_unit":"image"}'::jsonb,
   '{"model":"seededit-3-0-i2i-250628","endpoint":"/images/generations"}'::jsonb,
   '{"category":"image","activation":"pending_verified_region_key"}'::jsonb, 120000, 1, FALSE, now(), now()),
  ('pm_seedance_2_5_byteplus', 'seedance-2.5-image-to-video', 'byteplus', 'seedance-2.5-image-to-video', FALSE, 105,
   '{"currency":"USD","pricing_source":"BytePlus ModelArk public pricing","pricing_unit":"token","note":"actual charge depends on completion_tokens"}'::jsonb,
   '{"model":"dreamina-seedance-2-5-260628","endpoint":"/contents/generations/tasks"}'::jsonb,
   '{"category":"video","activation":"pending_verified_region_key"}'::jsonb, 259200000, 1, TRUE, now(), now()),
  ('pm_seedance_2_0_i2v_byteplus', 'seedance-v2.0-i2v', 'byteplus', 'seedance-v2.0-i2v', FALSE, 105,
   '{"currency":"USD","pricing_source":"BytePlus ModelArk public pricing","pricing_unit":"token","note":"actual charge depends on completion_tokens"}'::jsonb,
   '{"model":"dreamina-seedance-2-0-260128","endpoint":"/contents/generations/tasks"}'::jsonb,
   '{"category":"video","activation":"pending_verified_region_key"}'::jsonb, 259200000, 1, TRUE, now(), now()),
  ('pm_seedance_2_0_t2v_byteplus', 'seedance-v2.0-t2v', 'byteplus', 'seedance-v2.0-t2v', FALSE, 105,
   '{"currency":"USD","pricing_source":"BytePlus ModelArk public pricing","pricing_unit":"token","note":"actual charge depends on completion_tokens"}'::jsonb,
   '{"model":"dreamina-seedance-2-0-260128","endpoint":"/contents/generations/tasks"}'::jsonb,
   '{"category":"video","activation":"pending_verified_region_key"}'::jsonb, 259200000, 1, TRUE, now(), now())
ON CONFLICT (id) DO NOTHING;
