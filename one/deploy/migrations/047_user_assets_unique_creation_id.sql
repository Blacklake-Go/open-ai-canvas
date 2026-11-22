-- A generation may be finalized by polling and a provider callback concurrently.
-- Keep one asset row per successful creation so the sync path can safely retry.
CREATE UNIQUE INDEX IF NOT EXISTS user_assets_creation_id_uidx
  ON ai_studio.user_assets (creation_id)
  WHERE creation_id IS NOT NULL;
