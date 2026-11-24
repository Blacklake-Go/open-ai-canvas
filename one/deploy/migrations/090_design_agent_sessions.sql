CREATE TABLE ai_studio.design_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES auth_usr.users (id) ON DELETE CASCADE,
  creation_key UUID NOT NULL,
  name VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(messages) = 'array'),
  message_revision INTEGER NOT NULL DEFAULT 1 CHECK (message_revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, creation_key)
);

CREATE INDEX design_agent_sessions_user_updated_idx
  ON ai_studio.design_agent_sessions (user_id, updated_at DESC, id DESC);
