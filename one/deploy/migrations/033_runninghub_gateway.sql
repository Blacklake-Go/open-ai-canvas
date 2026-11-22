-- 033_runninghub_gateway.sql
-- RunningHub is a task-based multimodal aggregation gateway. Keep its routes
-- disabled until a valid API key and the desired account entitlement are supplied.

INSERT INTO ai_studio.ai_providers
  (id, slug, name, provider_type, enabled, priority, base_url, api_mode, currency, metadata, created_at, updated_at)
VALUES
  ('runninghub', 'runninghub', 'RunningHub 聚合 API', 'aggregator', FALSE, 104,
   'https://www.runninghub.ai', 'async', 'USD',
   '{"registered_from":"runninghub_openapi_adapter","activation":"pending_api_key_and_endpoint_selection","supports":"model_ai_app_workflow"}'::jsonb,
   now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_studio.provider_models
  (id, model_id, provider_id, provider_model_id, enabled, priority, cost_config, endpoint_config, metadata, timeout, max_retries, supports_polling, created_at, updated_at)
SELECT
  'pm_wan27_text_to_image_runninghub', 'wan2.7-text-to-image', 'runninghub',
  'openapi/v2/alibaba/wan-2.7/text-to-image', FALSE, 104,
  '{"currency":"USD","pricing_unit":"call_plus_runtime","pricing_source":"RunningHub pricing and account billing","base_cost":0}'::jsonb,
  '{"endpoint":"/openapi/v2/alibaba/wan-2.7/text-to-image","category":"image"}'::jsonb,
  '{"activation":"pending_api_key_and_endpoint_selection","api_type":"model"}'::jsonb,
  120000, 1, TRUE, now(), now()
WHERE EXISTS (SELECT 1 FROM ai_studio.ai_models WHERE id = 'wan2.7-text-to-image')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_studio.provider_models
  (id, model_id, provider_id, provider_model_id, enabled, priority, cost_config, endpoint_config, metadata, timeout, max_retries, supports_polling, created_at, updated_at)
SELECT
  'pm_wan22_text_to_video_runninghub', 'wan2.2-text-to-video', 'runninghub',
  'openapi/v2/rhart-video/wan-2.2/text-to-video', FALSE, 104,
  '{"currency":"USD","pricing_unit":"call_plus_runtime","pricing_source":"RunningHub pricing and account billing","base_cost":0}'::jsonb,
  '{"endpoint":"/openapi/v2/rhart-video/wan-2.2/text-to-video","category":"video"}'::jsonb,
  '{"activation":"pending_api_key_and_endpoint_selection","api_type":"model"}'::jsonb,
  259200000, 1, TRUE, now(), now()
WHERE EXISTS (SELECT 1 FROM ai_studio.ai_models WHERE id = 'wan2.2-text-to-video')
ON CONFLICT (id) DO NOTHING;
