CREATE TABLE IF NOT EXISTS ai_studio.model_publication_tests (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL REFERENCES ai_studio.ai_models(id),
  creation_id TEXT NOT NULL UNIQUE REFERENCES ai_studio.creations(id),
  capability_version TEXT NOT NULL,
  configuration_hash TEXT NOT NULL,
  verified_by TEXT NOT NULL REFERENCES auth_usr.users(id),
  receipt_json JSONB NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS model_publication_tests_current_idx
  ON ai_studio.model_publication_tests(model_id, capability_version, configuration_hash);
