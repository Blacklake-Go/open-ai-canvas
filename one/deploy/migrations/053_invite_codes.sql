-- 053_invite_codes.sql
-- 阶段 4：建立邀请码体系，支持内测期注册门槛与邀请码防刷

CREATE TABLE IF NOT EXISTS ai_studio.invite_codes (
  id            VARCHAR(64) PRIMARY KEY,
  code          VARCHAR(32) NOT NULL UNIQUE,
  max_uses      INTEGER NOT NULL DEFAULT 1,
  used_count    INTEGER NOT NULL DEFAULT 0,
  status        VARCHAR(16) NOT NULL DEFAULT 'active',
  notes         TEXT,
  created_by    VARCHAR(64),
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON ai_studio.invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_status ON ai_studio.invite_codes(status);

CREATE TABLE IF NOT EXISTS ai_studio.invite_code_redemptions (
  id              VARCHAR(64) PRIMARY KEY,
  invite_code_id  VARCHAR(64) NOT NULL REFERENCES ai_studio.invite_codes(id) ON DELETE CASCADE,
  user_id         VARCHAR(64) NOT NULL,
  redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip              VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_invite_code_redemptions_user ON ai_studio.invite_code_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_invite_code_redemptions_code ON ai_studio.invite_code_redemptions(invite_code_id);

-- 插入默认内测体验码
INSERT INTO ai_studio.invite_codes (id, code, max_uses, used_count, status, notes, created_by)
VALUES 
  ('inv_koyo_alpha_01', 'KOYO-VIP-2026', 100, 0, 'active', '首批内测官方通用邀请码', 'system'),
  ('inv_koyo_alpha_02', 'KOYO-BETA-8888', 50, 0, 'active', '内测公测体验码', 'system')
ON CONFLICT (code) DO NOTHING;
