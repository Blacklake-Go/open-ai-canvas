CREATE TABLE ai_studio.one_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  creation_key UUID NOT NULL,
  title VARCHAR(120) NOT NULL CHECK (length(trim(title)) > 0),
  steps JSONB NOT NULL CHECK (jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) BETWEEN 1 AND 6),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (owner_user_id, creation_key),
  UNIQUE (id, owner_user_id)
);

CREATE INDEX one_workflows_owner_idx
  ON ai_studio.one_workflows (owner_user_id, updated_at DESC, id DESC) WHERE deleted_at IS NULL;

CREATE TABLE ai_studio.one_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  owner_user_id TEXT NOT NULL,
  creation_key UUID NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  title VARCHAR(120) NOT NULL,
  input TEXT NOT NULL CHECK (length(input) BETWEEN 1 AND 2000),
  steps JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (workflow_id, owner_user_id) REFERENCES ai_studio.one_workflows(id, owner_user_id) ON DELETE CASCADE,
  UNIQUE (owner_user_id, creation_key)
);

CREATE INDEX one_workflow_runs_owner_idx
  ON ai_studio.one_workflow_runs (owner_user_id, workflow_id, created_at DESC, id DESC);
