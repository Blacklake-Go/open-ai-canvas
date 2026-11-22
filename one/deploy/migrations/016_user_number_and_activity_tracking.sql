-- 016_user_number_and_activity_tracking.sql
-- 深度升级用户身份系统（6 位数唯一数字 ID、隐私设置）与行为追踪入库系统（用于用户行为分析与活跃度面板）

-- 1. 扩展 auth_usr.users
ALTER TABLE auth_usr.users
  ADD COLUMN IF NOT EXISTS user_number VARCHAR(16),
  ADD COLUMN IF NOT EXISTS is_activity_public BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS privacy_settings JSONB NOT NULL DEFAULT '{"hide_activity": false, "hide_stats": false}'::jsonb;

-- 2. 为现有存量用户安全回填 6 位随机数字 ID（范围 100000 - 999999）
DO $$
DECLARE
  r RECORD;
  new_num TEXT;
  exists_count INT;
BEGIN
  FOR r IN SELECT id FROM auth_usr.users WHERE user_number IS NULL LOOP
    LOOP
      new_num := LPAD(FLOOR(100000 + random() * 900000)::TEXT, 6, '0');
      SELECT COUNT(*) INTO exists_count FROM auth_usr.users WHERE user_number = new_num;
      IF exists_count = 0 THEN
        UPDATE auth_usr.users SET user_number = new_num WHERE id = r.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_user_number_unique ON auth_usr.users(user_number) WHERE user_number IS NOT NULL;

-- 3. 全局用户行为追踪与互动分析表（支撑未来用户行为大数据分析）
CREATE TABLE IF NOT EXISTS sys_core.user_activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES auth_usr.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_category VARCHAR(32) NOT NULL DEFAULT 'general',
  event_action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32),
  target_id TEXT,
  model_name VARCHAR(128),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_activity_logs_user_idx ON sys_core.user_activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_logs_action_idx ON sys_core.user_activity_logs(event_action, created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_logs_model_idx ON sys_core.user_activity_logs(model_name) WHERE model_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_activity_logs_created_idx ON sys_core.user_activity_logs(created_at DESC);

-- 4. 创作者关注互动表
CREATE TABLE IF NOT EXISTS ai_studio.user_follows (
  id TEXT PRIMARY KEY,
  follower_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS user_follows_follower_idx ON ai_studio.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS user_follows_following_idx ON ai_studio.user_follows(following_id);
