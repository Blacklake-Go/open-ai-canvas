CREATE TABLE IF NOT EXISTS ai_studio.canvas_project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(64) NOT NULL REFERENCES ai_studio.canvas_projects(id) ON DELETE CASCADE,
  owner_user_id VARCHAR NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS canvas_project_shares_one_active_per_project_idx
  ON ai_studio.canvas_project_shares (project_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS canvas_project_shares_owner_idx
  ON ai_studio.canvas_project_shares (owner_user_id, created_at DESC);
