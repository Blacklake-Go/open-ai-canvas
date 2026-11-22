-- 074: Volcengine Seedance 2.0 direct route, staged disabled until console activation (2026-10-19)
-- Activate the model in Ark console first: FoundationModelNames = ["doubao-seedance-2-0-260128"]
-- Then run: UPDATE ai_studio.provider_models SET enabled=true WHERE id='pm_volcengine_seedance20_global_t2v';
BEGIN;

INSERT INTO ai_studio.provider_models (
  id, model_id, provider_id, provider_model_id, enabled, priority, cost_config,
  parameter_mapping, capabilities, endpoint_config, timeout, max_retries,
  supports_webhook, supports_polling, concurrency_limit, rate_limit, metadata,
  review_status, provider_model_version, provider_endpoint, supported_task_types,
  supported_resolutions, supported_durations, supported_qualities, supported_regions,
  license_requirements, mapping_version, created_at, updated_at
) VALUES (
  'pm_volcengine_seedance20_global_t2v', 'seedance-2.0', 'volcengine',
  'doubao-seedance-2-0-260128', false, 95,
  '{"currency":"CNY","cost_per_output_second":1.0}'::jsonb,
  '{"aspect_ratio":"ratio","generate_audio":"generate_audio","camera_motion":"camera_fixed"}'::jsonb,
  '{"input_types":["text","image"],"output_types":["video"],"output_type":"video","resolutions":["480p","720p","1080p","2k","4k"],"durations":["4","5","6","7","8","9","10","11","12","13","14","15"],"aspect_ratios":["16:9","9:16","1:1","4:3","3:4","21:9"],"qualities":["standard","hd"],"parameters":["prompt","negative_prompt","aspect_ratio","resolution","duration","quality","seed","watermark","batch_size","n","reference_mode","camera_motion","generate_audio","first_frame_url","end_frame_url","image_urls","video_url","mode"],"supported_task_types":["t2v","i2v","text_to_video","image_to_video"],"source_api":"https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks"}'::jsonb,
  '{"params":[],"category":"Volcengine/Seedance","endpoint":"/contents/generations/tasks","output_type":"video","taskType":"text-to-video","registry_source":"volcengine official ark video API","registry_version":"2026-10-19"}'::jsonb,
  900000, 1, false, true, 10, 60,
  '{"endpoint":"contents/generations/tasks","model":"doubao-seedance-2-0-260128","activation_required":true}'::jsonb,
  'approved', '', '/contents/generations/tasks',
  '["t2v","i2v","text_to_video","image_to_video"]'::jsonb,
  '["480p","720p","1080p","2k","4k"]'::jsonb,
  '["4","5","6","7","8","9","10","11","12","13","14","15"]'::jsonb,
  '["standard","hd"]'::jsonb, '["cn-beijing"]'::jsonb, '[]'::jsonb, 1, now(), now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_studio.provider_model_price_versions (
  id, provider_model_id, version_no, price_type, billing_unit, currency, price_config,
  applicability, source_url, source_api, source_observed_at, fetched_at, effective_at,
  expires_at, evidence_digest, status, manually_locked, change_summary, previous_version_id,
  modified_by, approved_by, approved_at, conservative_upper_bound_config,
  conservative_upper_bound_currency, conservative_upper_bound_expires_at,
  conservative_upper_bound_reason, created_at
) VALUES (
  'pver_volcengine_seedance20_global_20261019', 'pm_volcengine_seedance20_global_t2v', 1,
  'manual', 'per_output_second', 'CNY',
  '{"currency":"CNY","cost_per_output_second":1.0,"resolution_multipliers":{"480p":0.5,"720p":1.0,"1080p":1.5,"2k":2.0,"4k":3.0}}'::jsonb,
  '{"billing":"per_output_second","task_type":"t2v","durations":["4","5","6","7","8","9","10","11","12","13","14","15"],"resolution":"720p"}'::jsonb,
  'https://www.volcengine.com/pricing', 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
  now(), now(), now(), null, null, 'active', false,
  '{"reason":"Volcengine official Seedance 2.0 list price ~CNY 1.0/s; enable after console activation","priceSourceObservedOn":"2026-10-19"}'::jsonb,
  null, 'lead-2026-10-19', 'lead-2026-10-19', now(), null, null, null, null, now()
) ON CONFLICT (id) DO NOTHING;

COMMIT;
