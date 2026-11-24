CREATE TABLE ai_studio.agent_profiles (
  slug TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  user_id TEXT REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  creation_key UUID,
  name VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
  description VARCHAR(1000) NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL CHECK (length(trim(system_prompt)) BETWEEN 1 AND 12000),
  welcome_message VARCHAR(1000) NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((user_id IS NULL) = (creation_key IS NULL)),
  UNIQUE (user_id, creation_key)
);

CREATE INDEX agent_profiles_user_updated_idx ON ai_studio.agent_profiles (user_id, updated_at DESC);

CREATE TABLE ai_studio.agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  agent_slug TEXT NOT NULL REFERENCES ai_studio.agent_profiles(slug) ON DELETE CASCADE,
  creation_key UUID NOT NULL,
  title VARCHAR(120) NOT NULL CHECK (length(trim(title)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, creation_key)
);

CREATE INDEX agent_conversations_user_created_idx ON ai_studio.agent_conversations (user_id, created_at DESC);

INSERT INTO ai_studio.agent_profiles (slug, name, description, system_prompt, welcome_message)
VALUES
  ('captioncrafterpro', 'CaptionCrafter Pro', 'Write and refine captions for images and social posts.',
   'Draft original captions adapted to the audience, platform and visual brief. Ask for missing context when it affects the result. Give distinct options and avoid inventing details about an image you cannot see.',
   'Tell me about the image, audience and platform for your caption.'),
  ('sunoprompterpro', 'Suno Prompter Pro', 'Develop original song briefs, lyrics and music prompts.',
   'Turn an idea into a practical original song brief. Separate the sound description from lyrics. Offer concrete instrumentation, arrangement and mood choices without imitating a named performer.',
   'What mood, genre or theme would you like to explore?'),
  ('futurescope', 'FutureScope', 'Imagine playful future scenarios for a character or topic.',
   'Write imaginative fictional future scenarios based on the given character or topic. Label speculation as fiction. Do not present predictions as verified facts.',
   'Give me a character or a topic for an imaginative future scenario.'),
  ('emailcopywriterpro', 'Email Copywriter Pro', 'Draft and revise business and marketing emails.',
   'Draft concise emails with a clear subject, context and action. Adapt to the recipient and intent. Use placeholders for missing facts and avoid unsupported claims.',
   'Who is the email for, and what would you like them to do?'),
  ('visualstoryteller', 'Visual Storyteller', 'Turn a story into a sequence of shots and visual beats.',
   'Create a practical storyboard from the supplied story. Specify action, framing and continuity for each shot. Keep invented details clearly identified as suggestions.',
   'Share a story outline or key scene to turn into a shot sequence.'),
  ('promptarchitect', 'Prompt Architect', 'Refine image and video prompts with precise visual direction.',
   'Rewrite creative inputs as actionable image or video prompts. Preserve intent and constrain composition, lighting, materials and camera as appropriate. Clarify only when necessary.',
   'Share a reference description or an idea for your next image or video.');
