-- Ensure the canonical model IDs referenced by migration 032 exist.
-- Migration 023 only creates Seedream rows when the legacy models_config catalog
-- already contains them, and the Seedance rows may be absent from older catalogs.
-- Clean or partially seeded databases need disabled placeholders before the
-- BytePlus provider mappings are added.
-- Keep this migration before 032 and additive: do not overwrite operator data.

INSERT INTO ai_studio.ai_models
  (id, slug, name, display_name, category, description, status, sort,
   is_featured, capabilities, created_at, updated_at)
VALUES
  ('seedream-5.0', 'seedream-5.0', 'Seedream 5.0', 'Seedream 5.0',
   'image', 'Seedream image generation model.', 'disabled', 900, FALSE,
   '{"source":"byteplus_modelark_prerequisite","activation":"pending_provider_verification"}'::jsonb,
   now(), now()),
  ('seedream-5.0-edit', 'seedream-5.0-edit', 'Seedream 5.0 Edit', 'Seedream 5.0 Edit',
   'image_edit', 'Seedream image editing model.', 'disabled', 901, FALSE,
   '{"source":"byteplus_modelark_prerequisite","activation":"pending_provider_verification"}'::jsonb,
   now(), now()),
  ('seedance-2.5-image-to-video', 'seedance-2.5-image-to-video', 'Seedance 2.5 Image to Video', 'Seedance 2.5 Image to Video',
   'video_image', 'Seedance image-to-video model.', 'disabled', 902, FALSE,
   '{"source":"byteplus_modelark_prerequisite","activation":"pending_provider_verification"}'::jsonb,
   now(), now()),
  ('seedance-v2.0-i2v', 'seedance-v2.0-i2v', 'Seedance 2.0 Image to Video', 'Seedance 2.0 Image to Video',
   'video_image', 'Seedance image-to-video model.', 'disabled', 903, FALSE,
   '{"source":"byteplus_modelark_prerequisite","activation":"pending_provider_verification"}'::jsonb,
   now(), now()),
  ('seedance-v2.0-t2v', 'seedance-v2.0-t2v', 'Seedance 2.0 Text to Video', 'Seedance 2.0 Text to Video',
   'video_text', 'Seedance text-to-video model.', 'disabled', 904, FALSE,
   '{"source":"byteplus_modelark_prerequisite","activation":"pending_provider_verification"}'::jsonb,
   now(), now())
ON CONFLICT (id) DO NOTHING;
