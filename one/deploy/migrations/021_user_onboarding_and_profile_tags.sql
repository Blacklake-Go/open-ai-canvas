-- 021_user_onboarding_and_profile_tags.sql
-- 扩展用户多维画像字段（行业、星座、职业、功能偏好、入驻状态）并预设行业与偏好标签

-- 1. 扩展 auth_usr.users 表
ALTER TABLE auth_usr.users
  ADD COLUMN IF NOT EXISTS zodiac VARCHAR(32),
  ADD COLUMN IF NOT EXISTS industry VARCHAR(64),
  ADD COLUMN IF NOT EXISTS occupation VARCHAR(64),
  ADD COLUMN IF NOT EXISTS preferences_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_industry_idx ON auth_usr.users(industry) WHERE industry IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_onboarding_idx ON auth_usr.users(onboarding_completed);

-- 2. 向 ops_bill.tags 表中写入行业、偏好与星座运营标签
INSERT INTO ops_bill.tags (id, name, slug, color, description)
VALUES
  -- 行业领域标签（对齐视觉与业务核心功能）
  ('tag_ind_freelance', '自由创作', 'ind_freelance', '#10b981', '行业领域:自由创作者/独立艺术家'),
  ('tag_ind_media', '自媒体', 'ind_media', '#06b6d4', '行业领域:个人博主/自媒体内容创作者'),
  ('tag_ind_anime', '短漫剧', 'ind_anime', '#f59e0b', '行业领域:短剧/动漫/漫改连续剧创作者'),
  ('tag_ind_game', '游戏美术', 'ind_game', '#8b5cf6', '行业领域:游戏角色/场景/道具概念设计'),
  ('tag_ind_ecommerce', '电商设计', 'ind_ecommerce', '#ec4899', '行业领域:电商主图/详情页/模特商拍'),
  ('tag_ind_ad', '商业广告', 'ind_ad', '#3b82f6', '行业领域:品牌宣传/营销广告创意设计'),
  ('tag_ind_mv', '音乐MV', 'ind_mv', '#e11d48', '行业领域:音乐视频/影视级创意视效'),

  -- 核心功能偏好标签（网站优势）
  ('tag_pref_image', '偏好图像创作', 'pref_image', '#14b8a6', '功能偏好:文生图/图生图/超分辨率精绘'),
  ('tag_pref_video', '偏好AI视频', 'pref_video', '#a855f7', '功能偏好:Wan 2.1/Kling/MiniMax 视频生成'),
  ('tag_pref_workflow', '偏好工作流', 'pref_workflow', '#6366f1', '功能偏好:Vibe Canvas/批量节点自动化工作流'),
  ('tag_pref_agent', '偏好智能体', 'pref_agent', '#f97316', '功能偏好:Design Agent/Poe 创作智能体')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  color = EXCLUDED.color,
  description = EXCLUDED.description;
