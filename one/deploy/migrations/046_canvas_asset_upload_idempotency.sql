-- Canvas upload retries reuse one private asset row per user and request key.
CREATE UNIQUE INDEX IF NOT EXISTS user_assets_canvas_upload_idempotency_uidx
  ON ai_studio.user_assets (user_id, (generation_params->>'canvas_upload_idempotency_hash'))
  WHERE (generation_params ? 'canvas_upload_idempotency_hash') AND deleted_at IS NULL;
