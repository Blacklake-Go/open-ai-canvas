-- Server-only recovery evidence; never add provider output to creations/attempts SELECT *.
CREATE TABLE IF NOT EXISTS ai_studio.generation_result_checkpoints (
  creation_id TEXT PRIMARY KEY REFERENCES ai_studio.creations(id) ON DELETE CASCADE,
  -- Keep the attempt identity intact while evidence exists (no SET NULL or cascade here).
  attempt_id VARCHAR(64) REFERENCES ai_studio.generation_attempts(id),
  provider_id VARCHAR(64) NOT NULL,
  provider_request_id TEXT,
  encrypted_payload_json JSONB NOT NULL,
  stage TEXT NOT NULL DEFAULT 'provider_succeeded'
    CHECK (stage IN ('provider_succeeded', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
