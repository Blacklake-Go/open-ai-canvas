CREATE TABLE ai_studio.workshop_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL REFERENCES auth_usr.users (id) ON DELETE CASCADE,
  creation_key UUID NOT NULL,
  title VARCHAR(160) NOT NULL CHECK (length(trim(title)) > 0),
  story TEXT NOT NULL DEFAULT '' CHECK (length(story) <= 20000),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, creation_key)
);

CREATE INDEX workshop_projects_owner_created_idx
  ON ai_studio.workshop_projects (owner_user_id, created_at DESC, id DESC);
