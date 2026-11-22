-- 014_content_management.sql
-- 运营内容管理模块：横幅广告/公告事件埋点流水表与默认动效配置

CREATE TABLE IF NOT EXISTS ops_bill.banner_events (
  id BIGSERIAL PRIMARY KEY,
  banner_id TEXT NOT NULL DEFAULT 'default',
  event_type VARCHAR(32) NOT NULL, -- 'impression' | 'click' | 'dismiss'
  user_id TEXT,
  anonymous_id VARCHAR(64),
  target_url TEXT,
  page_path TEXT,
  locale VARCHAR(16) DEFAULT 'zh-CN',
  user_agent TEXT,
  ip VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS banner_events_created_idx ON ops_bill.banner_events(created_at DESC);
CREATE INDEX IF NOT EXISTS banner_events_type_created_idx ON ops_bill.banner_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS banner_events_banner_type_idx ON ops_bill.banner_events(banner_id, event_type);

-- 插入或更新初始默认 site_banner 配置
INSERT INTO ops_bill.system_settings (key, value_json, visibility, updated_by, updated_at)
VALUES (
  'site_banner',
  '{
    "id": "banner-default",
    "enabled": true,
    "message": "Unrestricted AI Images & Videos → Auto-Publish as YouTube Shorts & TikToks, Earn ↗",
    "linkUrl": "https://vadoo.tv",
    "linkTarget": "_blank",
    "theme": "indigo",
    "dismissible": true,
    "autoHideDays": 7,
    "badgeText": "NEW",
    "showPulseDot": true
  }'::jsonb,
  'public',
  'system_migration',
  now()
)
ON CONFLICT (key) DO UPDATE SET
  value_json = CASE
    WHEN ops_bill.system_settings.value_json->>'linkUrl' IS NULL THEN
      ops_bill.system_settings.value_json || jsonb_build_object(
        'id', 'banner-default',
        'linkUrl', 'https://vadoo.tv',
        'linkTarget', '_blank',
        'theme', 'indigo',
        'dismissible', true,
        'autoHideDays', 7,
        'badgeText', 'NEW',
        'showPulseDot', true
      )
    ELSE ops_bill.system_settings.value_json
  END;

-- 插入或更新初始默认 homepage_motion 配置
INSERT INTO ops_bill.system_settings (key, value_json, visibility, updated_by, updated_at)
VALUES (
  'homepage_motion',
  '{
    "motionLevel": "full",
    "ambientGlow": true,
    "cardTiltHover": true,
    "bannerPulse": true
  }'::jsonb,
  'public',
  'system_migration',
  now()
)
ON CONFLICT (key) DO NOTHING;
