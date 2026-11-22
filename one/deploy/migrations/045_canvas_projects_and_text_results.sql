-- Cloud Canvas projects reuse the SupDance user, generation, wallet and asset records.
ALTER TABLE ai_studio.creations ADD COLUMN IF NOT EXISTS result_text TEXT;

CREATE TABLE IF NOT EXISTS ai_studio.canvas_projects (
  id VARCHAR(64) PRIMARY KEY,
  owner_user_id VARCHAR NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  thumbnail_asset_id VARCHAR REFERENCES ai_studio.user_assets(id) ON DELETE SET NULL,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS canvas_projects_owner_updated_idx
  ON ai_studio.canvas_projects (owner_user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_studio.canvas_project_versions (
  project_id VARCHAR(64) NOT NULL REFERENCES ai_studio.canvas_projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  snapshot_json JSONB NOT NULL,
  created_by VARCHAR NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, version)
);

CREATE TABLE IF NOT EXISTS ai_studio.canvas_project_jobs (
  job_id VARCHAR NOT NULL REFERENCES ai_studio.creations(id) ON DELETE CASCADE,
  project_id VARCHAR(64) NOT NULL REFERENCES ai_studio.canvas_projects(id) ON DELETE CASCADE,
  owner_user_id VARCHAR NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  node_id VARCHAR(120) NOT NULL,
  model_id VARCHAR NOT NULL,
  idempotency_key VARCHAR(200) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  result_asset_id VARCHAR REFERENCES ai_studio.user_assets(id) ON DELETE SET NULL,
  credits_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id),
  UNIQUE (project_id, node_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS canvas_project_jobs_owner_project_idx
  ON ai_studio.canvas_project_jobs (owner_user_id, project_id, created_at DESC);
