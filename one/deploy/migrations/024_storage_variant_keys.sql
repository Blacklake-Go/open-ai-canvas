-- Persist derivative object keys separately from the original asset.
-- The original 023 migration is immutable after application; this migration
-- adds the fields needed by the preview/thumbnail pipeline.

ALTER TABLE ai_studio.user_assets
  ADD COLUMN IF NOT EXISTS preview_object_key TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_object_key TEXT;

ALTER TABLE ai_studio.creations
  ADD COLUMN IF NOT EXISTS storage_preview_object_key TEXT,
  ADD COLUMN IF NOT EXISTS storage_thumbnail_object_key TEXT;

CREATE INDEX IF NOT EXISTS user_assets_variant_object_key_idx
  ON ai_studio.user_assets(preview_object_key, thumbnail_object_key)
  WHERE preview_object_key IS NOT NULL OR thumbnail_object_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS creations_variant_object_key_idx
  ON ai_studio.creations(storage_preview_object_key, storage_thumbnail_object_key)
  WHERE storage_preview_object_key IS NOT NULL OR storage_thumbnail_object_key IS NOT NULL;
