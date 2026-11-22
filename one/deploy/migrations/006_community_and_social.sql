-- 006_community_and_social.sql
-- 扩展用户资料字段与创建社区帖子、点赞、评论表

-- 1. 扩展 auth_usr.users
ALTER TABLE auth_usr.users
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS followers_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count INT NOT NULL DEFAULT 0;

-- 2. 社区作品发布表
CREATE TABLE IF NOT EXISTS ai_studio.community_posts (
  id TEXT PRIMARY KEY,
  creation_id TEXT REFERENCES ai_studio.creations(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  media_type VARCHAR(32) NOT NULL DEFAULT 'image', -- 'image', 'video', 'audio', 'workflow'
  media_url TEXT NOT NULL,
  cover_url TEXT,
  prompt TEXT,
  negative_prompt TEXT,
  model_name TEXT,
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  likes_count INT NOT NULL DEFAULT 0,
  coins_count INT NOT NULL DEFAULT 0,
  views_count INT NOT NULL DEFAULT 0,
  remix_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'published', -- 'published', 'hidden', 'banned'
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_posts_user_idx ON ai_studio.community_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_posts_status_idx ON ai_studio.community_posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS community_posts_media_type_idx ON ai_studio.community_posts(media_type, created_at DESC);
CREATE INDEX IF NOT EXISTS community_posts_likes_idx ON ai_studio.community_posts(likes_count DESC);
CREATE INDEX IF NOT EXISTS community_posts_coins_idx ON ai_studio.community_posts(coins_count DESC);
CREATE INDEX IF NOT EXISTS community_posts_featured_idx ON ai_studio.community_posts(is_featured, created_at DESC);

-- 3. 社区点赞表
CREATE TABLE IF NOT EXISTS ai_studio.community_likes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES ai_studio.community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_likes_post_idx ON ai_studio.community_likes(post_id);
CREATE INDEX IF NOT EXISTS community_likes_user_idx ON ai_studio.community_likes(user_id);

-- 4. 社区评论表
CREATE TABLE IF NOT EXISTS ai_studio.community_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES ai_studio.community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_comments_post_idx ON ai_studio.community_comments(post_id, created_at ASC);
