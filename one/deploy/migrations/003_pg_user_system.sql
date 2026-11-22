-- Compatibility migration for installations that predate the PostgreSQL-only baseline.
-- It is additive so an existing PostgreSQL database can be expanded before cutover.
ALTER TABLE auth_usr.users
  ADD COLUMN IF NOT EXISTS username VARCHAR(64),
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(16) DEFAULT '+86',
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(64),
  ADD COLUMN IF NOT EXISTS locale VARCHAR(16) DEFAULT 'zh',
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'Asia/Shanghai',
  ADD COLUMN IF NOT EXISTS registration_source VARCHAR(64) DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS referral_source VARCHAR(128),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_v2 ON auth_usr.users(phone) WHERE phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_usr.auth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  provider_user_id VARCHAR(128) NOT NULL,
  provider_email VARCHAR(255),
  provider_username VARCHAR(128),
  password_hash TEXT,
  password_salt TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  profile_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS auth_accounts_user_idx_v2 ON auth_usr.auth_accounts(user_id);

CREATE TABLE IF NOT EXISTS ops_bill.tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#22d3ee',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_bill.user_tags (
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES ops_bill.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  PRIMARY KEY (user_id, tag_id)
);
CREATE INDEX IF NOT EXISTS user_tags_user_idx ON ops_bill.user_tags(user_id);
CREATE INDEX IF NOT EXISTS user_tags_tag_idx ON ops_bill.user_tags(tag_id);

INSERT INTO ops_bill.tags (id, name, slug, color, description)
VALUES
  ('tag_new', '新用户', 'new_user', '#10b981', '注册未满 7 天的新用户'),
  ('tag_active', '活跃用户', 'active_user', '#06b6d4', '近 7 天有模型生成行为的用户'),
  ('tag_paying', '付费用户', 'paying_user', '#8b5cf6', '有充值或订阅记录的用户'),
  ('tag_vip', '高价值用户', 'vip_user', '#f59e0b', '生成量或消费处于头部梯队的用户'),
  ('tag_churn', '流失风险', 'churn_risk', '#ef4444', '超过 30 天未再次访问的用户'),
  ('tag_test', '测试用户', 'test_user', '#6b7280', '内部测试与联调账号')
ON CONFLICT (slug) DO NOTHING;
