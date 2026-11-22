-- 015_banner_history.sql
-- 历史横幅管理与高级弥散动效配置支持

CREATE TABLE IF NOT EXISTS ops_bill.banner_history (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(128) NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  highlight_text VARCHAR(64),
  cta_text VARCHAR(32),
  link_url TEXT,
  link_target VARCHAR(16) DEFAULT '_blank',
  theme VARCHAR(32) DEFAULT 'indigo',
  ambient_glow BOOLEAN DEFAULT true,
  glow_style VARCHAR(32) DEFAULT 'aurora',
  dynamic_effect VARCHAR(32) DEFAULT 'breathe',
  badge_text VARCHAR(32),
  show_pulse_dot BOOLEAN DEFAULT true,
  dismissible BOOLEAN DEFAULT true,
  auto_hide_days INTEGER DEFAULT 7,
  target_scope VARCHAR(32) DEFAULT 'all',
  is_active BOOLEAN DEFAULT false,
  created_by VARCHAR(64) DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS banner_history_created_idx ON ops_bill.banner_history(created_at DESC);
CREATE INDEX IF NOT EXISTS banner_history_active_idx ON ops_bill.banner_history(is_active);

-- 插入当前已有默认横幅快照
INSERT INTO ops_bill.banner_history (
  id, title, message, highlight_text, cta_text, link_url, link_target, theme, ambient_glow, glow_style, dynamic_effect, badge_text, show_pulse_dot, dismissible, auto_hide_days, target_scope, is_active, created_by, created_at, updated_at
) VALUES (
  'banner-initial-flova',
  '上新特惠公告 (Flova 风格)',
  '年会员享 Flova Image 2.5、Seedance 2.5 最低4折，1K 低至 ¥0.058/张',
  '上新特惠：',
  '立即订阅',
  '/pricing',
  '_self',
  'indigo',
  true,
  'aurora',
  'breathe',
  'HOT',
  true,
  true,
  7,
  'all',
  true,
  'system',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;
