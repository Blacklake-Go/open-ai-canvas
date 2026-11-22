-- 024_retire_external_banner_promo.sql
-- 下线指向 vadoo.tv 的站外推广横幅：停用并清空外链与广告文案。
-- 014_content_management 已按 sha256 记账落库、不可改写，故在此覆盖其种子结果。
-- 字段显式置空而不是删除键：getBannerConfig 会用 DEFAULT_BANNER_CONFIG 展开补齐缺失键，
-- 删除 linkUrl 反而会让默认的 /pricing 链接重新浮现。

UPDATE ops_bill.system_settings
SET value_json = value_json || jsonb_build_object(
      'enabled', false,
      'message', '',
      'highlightText', '',
      'ctaText', '',
      'linkUrl', '',
      'linkTarget', '_self',
      'badgeText', '',
      'showPulseDot', false
    ),
    updated_by = 'system_migration',
    updated_at = now()
WHERE key = 'site_banner'
  AND (
    value_json->>'linkUrl' ILIKE '%vadoo.tv%'
    OR value_json->>'message' ILIKE '%Auto-Publish as YouTube Shorts%'
  );
