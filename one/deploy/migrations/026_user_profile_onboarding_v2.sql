-- 026_user_profile_onboarding_v2.sql
-- 把入驻问卷升级为「可被后续行为数据校验的画像基线」：
-- 分步进度、国家/性别补全项、职业/目的/强度/风格/授权五维受控枚举，
-- 以及一段可直接 group by 的 creator_persona_code 人群短码。

-- 1. 扩展 auth_usr.users
ALTER TABLE auth_usr.users
  ADD COLUMN IF NOT EXISTS country VARCHAR(2),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(16),
  ADD COLUMN IF NOT EXISTS occupation_code VARCHAR(24),
  ADD COLUMN IF NOT EXISTS purpose_codes TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS commitment VARCHAR(16),
  ADD COLUMN IF NOT EXISTS style_codes TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS usage_intent VARCHAR(24),
  ADD COLUMN IF NOT EXISTS creator_persona_code VARCHAR(32),
  ADD COLUMN IF NOT EXISTS onboarding_answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_schema_version SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_step SMALLINT NOT NULL DEFAULT 0;

-- 画像列的枚举取值由 lib/onboarding/schema.js 单点定义，
-- 这里用 CHECK 兜住绕过服务层直接写库的路径（运维脚本、手工修数）。
ALTER TABLE auth_usr.users
  DROP CONSTRAINT IF EXISTS users_gender_check,
  ADD CONSTRAINT users_gender_check
    CHECK (gender IS NULL OR gender IN ('female', 'male', 'non_binary', 'prefer_not_to_say')),
  DROP CONSTRAINT IF EXISTS users_commitment_check,
  ADD CONSTRAINT users_commitment_check
    CHECK (commitment IS NULL OR commitment IN ('daily', 'weekly_high', 'weekly_low', 'monthly', 'browsing')),
  DROP CONSTRAINT IF EXISTS users_usage_intent_check,
  ADD CONSTRAINT users_usage_intent_check
    CHECK (usage_intent IS NULL OR usage_intent IN ('personal', 'internal_work', 'commercial', 'public_release')),
  DROP CONSTRAINT IF EXISTS users_onboarding_step_check,
  ADD CONSTRAINT users_onboarding_step_check
    CHECK (onboarding_step BETWEEN 0 AND 2);

-- 人群短码是「自述 vs 行为」配对分析的主键，必须可按前缀检索
CREATE INDEX IF NOT EXISTS users_persona_idx ON auth_usr.users(creator_persona_code) WHERE creator_persona_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_onboarding_step_idx ON auth_usr.users(onboarding_step);
CREATE INDEX IF NOT EXISTS users_purpose_idx ON auth_usr.users USING GIN (purpose_codes);
CREATE INDEX IF NOT EXISTS users_style_idx ON auth_usr.users USING GIN (style_codes);

-- 2. 运营标签：目的 / 强度 / 风格 / 授权各自成段，便于人群圈选
--    tags.name 全局唯一，所以名称带维度前缀。
INSERT INTO ops_bill.tags (id, name, slug, color, description)
VALUES
  -- 职业身份
  ('tag_occ_pro',   '职业:影视广告从业者', 'occ_pro',   '#22d3ee', '画像维度:职业身份-影视/广告/MV 商业交付'),
  ('tag_occ_semi',  '职业:设计师插画师',   'occ_semi',  '#06b6d4', '画像维度:职业身份-半专业设计/插画/概念美术'),
  ('tag_occ_ops',   '职业:内容与电商运营', 'occ_ops',   '#0ea5e9', '画像维度:职业身份-自媒体/短视频/电商视觉运营'),
  ('tag_occ_game',  '职业:游戏动漫美术',   'occ_game',  '#8b5cf6', '画像维度:职业身份-游戏角色/场景/道具资产'),
  ('tag_occ_student','职业:学生与爱好者',  'occ_student','#10b981','画像维度:职业身份-学习阶段或兴趣驱动'),

  -- 创作目的
  ('tag_pur_commercial','目的:商业交付接单','pur_commercial','#f59e0b','画像维度:创作目的-商业交付与接单变现'),
  ('tag_pur_growth',    '目的:涨粉与引流',  'pur_growth',    '#ec4899','画像维度:创作目的-自媒体内容与账号增长'),
  ('tag_pur_learning',  '目的:学习与技能',  'pur_learning',  '#14b8a6','画像维度:创作目的-学习 AI 创作工作流'),
  ('tag_pur_fun',       '目的:自娱与兴趣',  'pur_fun',       '#a855f7','画像维度:创作目的-个人娱乐与兴趣表达'),
  ('tag_pur_prototype', '目的:提案与原型',  'pur_prototype', '#3b82f6','画像维度:创作目的-方案可视化与快速原型'),
  ('tag_pur_community', '目的:社区与互动',  'pur_community', '#f97316','画像维度:创作目的-社区分享与协作'),

  -- 投入强度：活跃度偏差分的基线档位
  ('tag_cmt_daily',      '强度:几乎每天',   'cmt_daily',      '#ef4444','画像维度:投入强度-每天或每个工作日'),
  ('tag_cmt_weekly_high','强度:每周3到4次', 'cmt_weekly_high','#f97316','画像维度:投入强度-每周三到四次'),
  ('tag_cmt_weekly_low', '强度:每周1到2次', 'cmt_weekly_low', '#eab308','画像维度:投入强度-每周一到两次'),
  ('tag_cmt_monthly',    '强度:每月几次',   'cmt_monthly',    '#22c55e','画像维度:投入强度-每月数次'),
  ('tag_cmt_browsing',   '强度:随便看看',   'cmt_browsing',   '#64748b','画像维度:投入强度-观望与浏览为主'),

  -- 风格取向：推荐召回先验
  ('tag_sty_realistic','风格:写实人像', 'sty_realistic','#22d3ee','画像维度:风格取向-写实人像与摄影质感'),
  ('tag_sty_anime',    '风格:二次元',   'sty_anime',    '#ec4899','画像维度:风格取向-动漫与赛璐璐'),
  ('tag_sty_3d',       '风格:3D与CG',   'sty_3d',       '#8b5cf6','画像维度:风格取向-3D 渲染与 CG'),
  ('tag_sty_guofeng',  '风格:国风水墨', 'sty_guofeng',  '#10b981','画像维度:风格取向-国风与水墨'),
  ('tag_sty_scifi',    '风格:科幻赛博', 'sty_scifi',    '#06b6d4','画像维度:风格取向-科幻与赛博朋克'),
  ('tag_sty_product',  '风格:产品静物', 'sty_product',  '#f59e0b','画像维度:风格取向-电商产品与静物'),
  ('tag_sty_scene',    '风格:场景概念', 'sty_scene',    '#3b82f6','画像维度:风格取向-场景与概念设计'),
  ('tag_sty_cozy',     '风格:治愈插画', 'sty_cozy',     '#f472b6','画像维度:风格取向-治愈系与插画'),

  -- 用途授权边界
  ('tag_use_personal',     '授权:仅个人自用', 'use_personal',     '#64748b','画像维度:用途授权-不对外发布'),
  ('tag_use_internal_work','授权:内部工作用', 'use_internal_work','#0ea5e9','画像维度:用途授权-公司或团队内部交付'),
  ('tag_use_commercial',   '授权:对外商用',   'use_commercial',   '#f59e0b','画像维度:用途授权-公开发布与商业投放'),
  ('tag_use_training',     '授权:同意改进模型','use_training',     '#14b8a6','画像维度:用途授权-作品可用于模型改进')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  color = EXCLUDED.color,
  description = EXCLUDED.description;

-- 3. 存量用户回填：021 的问卷已把 onboarding_completed 置真的记录视为走完旧版两步，
--    否则线上会出现「已完成却仍被强制引导」的回跳死循环。
UPDATE auth_usr.users
SET onboarding_step = 2
WHERE onboarding_completed = TRUE AND onboarding_step < 2;
