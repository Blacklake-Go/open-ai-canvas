-- P5/P3: database-owned launch catalog.
--
-- The Studio package contains presentation metadata, but the database is the
-- authority for which models may be selected, which provider receives the
-- request, and how many credits are reserved. This seed is deliberately
-- additive and only fills missing rows so operators can change pricing or
-- disable a model without a later migration overwriting that decision.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'ai_studio' AND table_name = 'models_config'
      AND column_name = 'is_active' AND data_type IN ('smallint', 'integer')
  ) THEN
    ALTER TABLE ai_studio.models_config
      ALTER COLUMN is_active DROP DEFAULT,
      ALTER COLUMN is_active TYPE BOOLEAN USING (is_active <> 0),
      ALTER COLUMN is_active SET DEFAULT TRUE;
  END IF;
END $$;

INSERT INTO ai_studio.models_config
  (id, provider, name, type, cost_usd, credits_price, is_active, sort_order, metadata_json, created_at, updated_at)
VALUES
  ('nano-banana', 'google', 'Nano Banana', 'image', 0, 1, TRUE, 10, '{"source":"studio-catalog","modes":["t2i"]}'::jsonb, now(), now()),
  ('flux-dev', 'blackforest', 'FLUX.1 Dev', 'image', 0, 1, TRUE, 20, '{"source":"studio-catalog","modes":["t2i"]}'::jsonb, now(), now()),
  ('flux-kontext-dev-t2i', 'blackforest', 'FLUX.1 Kontext Dev', 'image', 0, 1, TRUE, 30, '{"source":"studio-catalog","modes":["t2i"]}'::jsonb, now(), now()),
  ('hidream-i1-fast', 'hidream', 'HiDream I1 Fast', 'image', 0, 1, TRUE, 40, '{"source":"studio-catalog","modes":["t2i"]}'::jsonb, now(), now()),
  ('ai-anime-generator', 'muapi', 'Ai Anime Generator', 'image', 0, 1, TRUE, 50, '{"source":"studio-catalog","modes":["t2i"]}'::jsonb, now(), now()),
  ('wan2.1-text-to-image', 'alibaba', 'Wan 2.1', 'image', 0, 1, TRUE, 60, '{"source":"studio-catalog","modes":["t2i"]}'::jsonb, now(), now()),
  ('flux-kontext-pro-t2i', 'blackforest', 'FLUX.1 Kontext Pro', 'image', 0, 1, TRUE, 70, '{"source":"studio-catalog","modes":["t2i"]}'::jsonb, now(), now()),
  ('gpt4o-text-to-image', 'openai', 'GPT-4o', 'image', 0, 1, TRUE, 80, '{"source":"studio-catalog","modes":["t2i"]}'::jsonb, now(), now()),
  ('flux-schnell', 'blackforest', 'FLUX.1 Schnell', 'image', 0, 1, TRUE, 90, '{"source":"studio-catalog","modes":["t2i"]}'::jsonb, now(), now()),
  ('seedance-lite-t2v', 'bytedance', 'Seedance 1.0 Lite', 'video', 0, 1, TRUE, 100, '{"source":"studio-catalog","modes":["t2v"]}'::jsonb, now(), now()),
  ('seedance-pro-t2v', 'bytedance', 'Seedance 1.0 Pro', 'video', 0, 1, TRUE, 110, '{"source":"studio-catalog","modes":["t2v"]}'::jsonb, now(), now()),
  ('seedance-v1.5-pro-t2v', 'bytedance', 'Seedance 1.5 Pro', 'video', 0, 1, TRUE, 120, '{"source":"studio-catalog","modes":["t2v"]}'::jsonb, now(), now()),
  ('seedance-v2.0-t2v', 'bytedance', 'Seedance 2.0', 'video', 0, 1, TRUE, 130, '{"source":"studio-catalog","modes":["t2v"]}'::jsonb, now(), now()),
  ('kling-v2.1-master-t2v', 'kling', 'Kling 2.1 Master', 'video', 0, 1, TRUE, 140, '{"source":"studio-catalog","modes":["t2v"]}'::jsonb, now(), now()),
  ('kling-v2.5-turbo-pro-t2v', 'kling', 'Kling 2.5 Turbo Pro', 'video', 0, 1, TRUE, 150, '{"source":"studio-catalog","modes":["t2v"]}'::jsonb, now(), now()),
  ('kling-v2.6-pro-t2v', 'kling', 'Kling 2.6 Pro', 'video', 0, 1, TRUE, 160, '{"source":"studio-catalog","modes":["t2v"]}'::jsonb, now(), now()),
  ('kling-o1-text-to-video', 'kling', 'Kling O1 Pro', 'video', 0, 1, TRUE, 170, '{"source":"studio-catalog","modes":["t2v"]}'::jsonb, now(), now()),
  ('ai-video-effects', 'muapi', 'AI Video Effects', 'video', 0, 1, TRUE, 180, '{"source":"studio-catalog","modes":["i2v"]}'::jsonb, now(), now()),
  ('motion-controls', 'muapi', 'Motion Controls', 'video', 0, 1, TRUE, 190, '{"source":"studio-catalog","modes":["i2v"]}'::jsonb, now(), now()),
  ('vfx', 'muapi', 'VFX', 'video', 0, 1, TRUE, 200, '{"source":"studio-catalog","modes":["i2v"]}'::jsonb, now(), now()),
  ('veo3-image-to-video', 'google', 'Veo 3', 'video', 0, 1, TRUE, 210, '{"source":"studio-catalog","modes":["i2v"]}'::jsonb, now(), now()),
  ('veo3-fast-image-to-video', 'google', 'Veo 3 Fast', 'video', 0, 1, TRUE, 220, '{"source":"studio-catalog","modes":["i2v"]}'::jsonb, now(), now()),
  ('runway-image-to-video', 'runway', 'Runway Image To Video', 'video', 0, 1, TRUE, 230, '{"source":"studio-catalog","modes":["i2v"]}'::jsonb, now(), now()),
  ('wan2.1-image-to-video', 'alibaba', 'Wan2.1 Image To Video', 'video', 0, 1, TRUE, 240, '{"source":"studio-catalog","modes":["i2v"]}'::jsonb, now(), now()),
  ('hunyuan-image-to-video', 'hunyuan', 'Hunyuan Image To Video', 'video', 0, 1, TRUE, 250, '{"source":"studio-catalog","modes":["i2v"]}'::jsonb, now(), now()),
  ('kling-v2.1-master-i2v', 'kling', 'Kling v2.1 Master I2V', 'video', 0, 1, TRUE, 260, '{"source":"studio-catalog","modes":["i2v"]}'::jsonb, now(), now()),
  ('kling-v2.1-standard-i2v', 'kling', 'Kling 2.1 Standard', 'video', 0, 1, TRUE, 270, '{"source":"studio-catalog","modes":["i2v"]}'::jsonb, now(), now()),
  ('wan2.2-image-to-video', 'alibaba', 'Wan2.2 Image To Video', 'video', 0, 1, TRUE, 280, '{"source":"studio-catalog","modes":["i2v"]}'::jsonb, now(), now()),
  ('video-watermark-remover', 'muapi', 'AI Video Watermark Remover', 'video', 0, 1, TRUE, 300, '{"source":"studio-catalog","modes":["v2v"]}'::jsonb, now(), now()),
  ('kling-v2.6-std-motion-control', 'kling', 'Kling 2.6 Standard Motion Control', 'video', 0, 1, TRUE, 310, '{"source":"studio-catalog","modes":["v2v"]}'::jsonb, now(), now()),
  ('ai-video-face-swap', 'muapi', 'AI Video Face Swap', 'video', 0, 1, TRUE, 320, '{"source":"studio-catalog","modes":["v2v"]}'::jsonb, now(), now()),
  ('mmaudio-v2-video-to-video', 'mmaudio', 'MMAudio v2', 'video', 0, 1, TRUE, 330, '{"source":"studio-catalog","modes":["v2v"]}'::jsonb, now(), now()),
  ('runway-aleph-v2v', 'runway', 'Runway Aleph', 'video', 0, 1, TRUE, 340, '{"source":"studio-catalog","modes":["v2v"]}'::jsonb, now(), now()),
  ('ai-dance-effects', 'muapi', 'AI Dance Effects', 'video', 0, 1, TRUE, 350, '{"source":"studio-catalog","modes":["v2v"]}'::jsonb, now(), now()),
  ('ai-video-upscaler', 'muapi', 'AI Video Upscaler', 'video', 0, 1, TRUE, 360, '{"source":"studio-catalog","modes":["v2v"]}'::jsonb, now(), now()),
  ('wan2.2-edit-video', 'alibaba', 'Wan2.2 Edit Video', 'video', 0, 1, TRUE, 370, '{"source":"studio-catalog","modes":["v2v"]}'::jsonb, now(), now()),
  ('heygen-video-translate', 'muapi', 'HeyGen Video Translate', 'video', 0, 1, TRUE, 380, '{"source":"studio-catalog","modes":["v2v"]}'::jsonb, now(), now()),
  ('topaz-video-upscale', 'topaz', 'Topaz Video Upscale', 'video', 0, 1, TRUE, 390, '{"source":"studio-catalog","modes":["v2v"]}'::jsonb, now(), now()),
  ('suno-create-music', 'muapi', 'Suno Create Music', 'audio', 0, 1, TRUE, 400, '{"source":"studio-catalog","modes":["audio"]}'::jsonb, now(), now()),
  ('suno-remix-music', 'muapi', 'Suno Remix Music', 'audio', 0, 1, TRUE, 410, '{"source":"studio-catalog","modes":["audio"]}'::jsonb, now(), now()),
  ('suno-extend-music', 'muapi', 'Suno Extend Music', 'audio', 0, 1, TRUE, 420, '{"source":"studio-catalog","modes":["audio"]}'::jsonb, now(), now()),
  ('suno-generate-sounds', 'muapi', 'Suno Generate Sounds', 'audio', 0, 1, TRUE, 430, '{"source":"studio-catalog","modes":["audio"]}'::jsonb, now(), now()),
  ('suno-add-vocals', 'muapi', 'Suno Add Vocals', 'audio', 0, 1, TRUE, 440, '{"source":"studio-catalog","modes":["audio"]}'::jsonb, now(), now()),
  ('suno-generate-mashup', 'muapi', 'Suno Generate Mashup', 'audio', 0, 1, TRUE, 450, '{"source":"studio-catalog","modes":["audio"]}'::jsonb, now(), now()),
  ('suno-add-instrumental', 'muapi', 'Suno Add Instrumental', 'audio', 0, 1, TRUE, 460, '{"source":"studio-catalog","modes":["audio"]}'::jsonb, now(), now()),
  ('suno-voice-clone', 'muapi', 'Suno Voice Cloning', 'audio', 0, 1, TRUE, 470, '{"source":"studio-catalog","modes":["audio"]}'::jsonb, now(), now()),
  ('minimax-voice-clone', 'muapi', 'Minimax Voice Clone', 'audio', 0, 1, TRUE, 480, '{"source":"studio-catalog","modes":["audio"]}'::jsonb, now(), now()),
  ('minimax-speech-2.6-hd', 'muapi', 'Minimax Speech HD', 'audio', 0, 1, TRUE, 490, '{"source":"studio-catalog","modes":["audio"]}'::jsonb, now(), now()),
  ('minimax-speech-2.6-turbo', 'muapi', 'Minimax Speech Turbo', 'audio', 0, 1, TRUE, 500, '{"source":"studio-catalog","modes":["audio"]}'::jsonb, now(), now()),
  ('mmaudio-v2-text-to-audio', 'muapi', 'MM Audio V2', 'audio', 0, 1, TRUE, 510, '{"source":"studio-catalog","modes":["audio"]}'::jsonb, now(), now()),
  ('infinitetalk-image-to-video', 'muapi', 'Infinite Talk', 'lipsync', 0, 1, TRUE, 600, '{"source":"studio-catalog","modes":["lipsync"]}'::jsonb, now(), now()),
  ('wan2.2-speech-to-video', 'muapi', 'Wan 2.2 Speech to Video', 'lipsync', 0, 1, TRUE, 610, '{"source":"studio-catalog","modes":["lipsync"]}'::jsonb, now(), now()),
  ('ltx-2.3-lipsync', 'muapi', 'LTX 2.3 Lipsync', 'lipsync', 0, 1, TRUE, 620, '{"source":"studio-catalog","modes":["lipsync"]}'::jsonb, now(), now()),
  ('sync-lipsync', 'muapi', 'Sync Lipsync', 'lipsync', 0, 1, TRUE, 630, '{"source":"studio-catalog","modes":["lipsync"]}'::jsonb, now(), now()),
  ('latent-sync', 'muapi', 'LatentSync', 'lipsync', 0, 1, TRUE, 640, '{"source":"studio-catalog","modes":["lipsync"]}'::jsonb, now(), now()),
  ('kling-v3.0-pro-recast', 'muapi', 'Kling 3.0 Pro Motion Control', 'recast', 0, 1, TRUE, 700, '{"source":"studio-catalog","modes":["recast"]}'::jsonb, now(), now()),
  ('runway-act-two-recast', 'muapi', 'Runway Act Two', 'recast', 0, 1, TRUE, 710, '{"source":"studio-catalog","modes":["recast"]}'::jsonb, now(), now()),
  ('wan2.2-animate-recast', 'muapi', 'Wan2.2 Animate', 'recast', 0, 1, TRUE, 720, '{"source":"studio-catalog","modes":["recast"]}'::jsonb, now(), now()),
  ('seedance-2.5-motion-control', 'muapi', 'Seedance 2.5 Motion Control', 'motion-control', 0, 1, TRUE, 800, '{"source":"studio-catalog","modes":["motion-control"]}'::jsonb, now(), now()),
  ('seedance-2-motion-control', 'muapi', 'Seedance 2.0 Motion Control', 'motion-control', 0, 1, TRUE, 810, '{"source":"studio-catalog","modes":["motion-control"]}'::jsonb, now(), now()),
  ('ai-clipping', 'muapi', 'AI Clipping', 'image', 0, 1, TRUE, 900, '{"source":"studio-catalog","modes":["clipping"]}'::jsonb, now(), now()),
  ('topaz-image-upscale', 'topaz', 'Topaz Image Upscale', 'image', 0, 1, TRUE, 910, '{"source":"studio-catalog","modes":["layers"]}'::jsonb, now(), now()),
  ('seedvr2-image-upscale', 'muapi', 'SeedVR2 Image Upscale', 'image', 0, 1, TRUE, 920, '{"source":"studio-catalog","modes":["layers"]}'::jsonb, now(), now()),
  ('ai-image-upscaler', 'muapi', 'AI Image Upscaler', 'image', 0, 1, TRUE, 930, '{"source":"studio-catalog","modes":["layers"]}'::jsonb, now(), now()),
  ('nano-banana-pro', 'google', 'Nano Banana Pro', 'image', 0, 1, TRUE, 940, '{"source":"studio-catalog","modes":["cinema","ai-influencer"]}'::jsonb, now(), now()),
  ('nano-banana-pro-edit', 'google', 'Nano Banana Pro Edit', 'image', 0, 1, TRUE, 950, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now()),
  ('flux-1.1-pro', 'blackforest', 'Flux 1.1 Pro', 'image', 0, 1, TRUE, 960, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now()),
  ('flux-schnell-image', 'blackforest', 'Flux Schnell', 'image', 0, 1, TRUE, 970, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now()),
  ('sd-3.5-large', 'stability', 'SD 3.5 Large', 'image', 0, 1, TRUE, 980, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now()),
  ('minimax-hailuo-2.3-standard-t2v', 'minimax', 'Hailuo 2.3', 'video', 0, 1, TRUE, 990, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now()),
  ('minimax-hailuo-2.3-standard-i2v', 'minimax', 'Hailuo 2.3 I2V', 'video', 0, 1, TRUE, 991, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now()),
  ('kling-v3.0-standard-text-to-video', 'kling', 'Kling 3.0 Standard', 'video', 0, 1, TRUE, 992, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now()),
  ('kling-v3.0-standard-image-to-video', 'kling', 'Kling 3.0 Standard I2V', 'video', 0, 1, TRUE, 993, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now()),
  ('veo-2-text-to-video', 'google', 'Google Veo 2', 'video', 0, 1, TRUE, 994, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now()),
  ('veo-2-image-to-video', 'google', 'Google Veo 2 I2V', 'video', 0, 1, TRUE, 995, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now()),
  ('luma-dream-machine', 'luma', 'Luma Dream Machine', 'video', 0, 1, TRUE, 996, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now()),
  ('wan2.1-t2v-14b', 'alibaba', 'Wan 2.1 14B', 'video', 0, 1, TRUE, 997, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now()),
  ('wan2.1-i2v-14b', 'alibaba', 'Wan 2.1 14B I2V', 'video', 0, 1, TRUE, 998, '{"source":"studio-catalog","modes":["cinema"]}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;
