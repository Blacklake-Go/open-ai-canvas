-- K 币兑换商品与用户已兑换权益。
-- 生产环境使用 035：024 已被既有生产迁移占用，不能改写历史版本。

CREATE TABLE IF NOT EXISTS ai_studio.coin_reward_items (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('avatar_frame')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  cost_coins NUMERIC(18, 4) NOT NULL CHECK (cost_coins > 0),
  duration_days INTEGER CHECK (duration_days IS NULL OR duration_days > 0),
  asset_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coin_reward_items_active_idx
  ON ai_studio.coin_reward_items(is_active, sort_order, created_at);

CREATE TABLE IF NOT EXISTS ai_studio.user_coin_rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  reward_item_id TEXT NOT NULL REFERENCES ai_studio.coin_reward_items(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  equipped_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, reward_item_id)
);

CREATE INDEX IF NOT EXISTS user_coin_rewards_user_idx
  ON ai_studio.user_coin_rewards(user_id, status, redeemed_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS user_coin_rewards_equipped_frame_idx
  ON ai_studio.user_coin_rewards(user_id)
  WHERE status = 'active' AND equipped_at IS NOT NULL;

INSERT INTO ai_studio.coin_reward_items
  (id, slug, reward_type, name, description, cost_coins, duration_days, asset_config, sort_order, stock)
VALUES
  (
    'coin_reward_frame_solaris',
    'solar-gold-frame',
    'avatar_frame',
    '太阳金环头像框',
    '暖金色能量环，适合展示创作者身份与长期贡献。',
    20,
    NULL,
    '{"theme":"solar","label":"SOLAR","icon":"✦"}'::jsonb,
    10,
    NULL
  ),
  (
    'coin_reward_frame_neon',
    'neon-cyan-frame',
    'avatar_frame',
    '霓虹青光头像框',
    '青色霓虹光环，呼应工作台的创作能量视觉。',
    35,
    NULL,
    '{"theme":"neon","label":"NEON","icon":"✧"}'::jsonb,
    20,
    NULL
  ),
  (
    'coin_reward_frame_aurora',
    'aurora-frame',
    'avatar_frame',
    '极光流彩头像框',
    '多色渐变流光环，作为限定创作者荣誉标识。',
    60,
    NULL,
    '{"theme":"aurora","label":"AURORA","icon":"✺"}'::jsonb,
    30,
    NULL
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  cost_coins = EXCLUDED.cost_coins,
  duration_days = EXCLUDED.duration_days,
  asset_config = EXCLUDED.asset_config,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();
