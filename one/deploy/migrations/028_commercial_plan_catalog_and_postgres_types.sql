-- The public and admin plan repository uses a richer PostgreSQL catalog than
-- the legacy table created in 001. Add the missing columns before API reads or
-- checkout orders use them.
ALTER TABLE ops_bill.plans_config
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(32) NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS price_cny INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_usd INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_included INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 线上这张表的 enabled / is_active 一直是 smallint(0/1)，而新的仓储读路径按
-- `WHERE enabled = TRUE` 过滤套餐。不先把启用位收敛成 boolean，任何按启用位过滤
-- 的查询都会报 "operator does not exist: smallint = boolean"，本迁移自己的
-- UPDATE / INSERT 也会在同一处失败。
ALTER TABLE ops_bill.plans_config
  ALTER COLUMN enabled DROP DEFAULT,
  ALTER COLUMN is_active DROP DEFAULT;

-- USING 表达式必须与列的现有类型无关：干净库里这两列已经是 boolean（上面刚 ADD
-- COLUMN），线上库里是 smallint。写成 COALESCE(col, 1) = 1 会在 boolean 列上报
-- "COALESCE types boolean and integer cannot be matched"，把整批迁移连带 029 一起卡死。
ALTER TABLE ops_bill.plans_config
  ALTER COLUMN enabled TYPE BOOLEAN USING COALESCE(enabled::text, '1') NOT IN ('0', 'false', 'f', ''),
  ALTER COLUMN is_active TYPE BOOLEAN USING COALESCE(is_active::text, '1') NOT IN ('0', 'false', 'f', '');

ALTER TABLE ops_bill.plans_config
  ALTER COLUMN enabled SET DEFAULT TRUE,
  ALTER COLUMN enabled SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT TRUE;

UPDATE ops_bill.plans_config
SET price_cny = CASE WHEN price_cny = 0 THEN monthly_cny ELSE price_cny END,
    price_usd = CASE WHEN price_usd = 0 THEN monthly_usd ELSE price_usd END,
    sort_order = CASE WHEN sort_order = 0 THEN display_order ELSE sort_order END,
    is_active = CASE WHEN enabled IS FALSE THEN FALSE ELSE is_active END;

-- Seed only missing commercial tiers. A pre-existing custom tier is preserved.
INSERT INTO ops_bill.plans_config
  (id, name, billing_cycle, price_cny, price_usd, credits_included,
   monthly_cny, monthly_usd, features_json, sort_order, display_order,
   enabled, is_active, updated_at)
VALUES
  ('starter', 'Starter (入门探索版)', 'monthly', 140, 20, 2000, 140, 20,
   jsonb_build_object(
     'items', jsonb_build_array('每月 2,000 + 400 额度 (多送20%)', '专享 Seedance 2.5 & 2.0 异步并发: 10', '单模型并发数: 5', '授权人像容量: 2 个', '资产库单素材快速生成', '去水印高清导出', '商业使用许可'),
     'meta', jsonb_build_object('yearlyCny', 1399, 'yearlyUsd', 199, 'quotaBase', 2000, 'quotaBonus', 400, 'concurrency', 5, 'asyncConcurrency', 10, 'portraitCapacity', 2, 'badge', '多送20%',
       'featureGroups', jsonb_build_object(
         'video', jsonb_build_array('Seedance 2.0/2.5 Pro / Fast / mini', '专享异步并发通道：10 路', '单模型并发：5 路'),
         'image', jsonb_build_array('Flova Image 2.5 Sunburst / Flare', '全站模型限时低至 6 折'),
         'more', jsonb_build_array('授权人像容量：2 个', '资产库单素材快速生成', '去水印高清导出', '商业使用许可')))),
   1, 1, TRUE, TRUE, now()),
  ('basic', 'Basic (进阶创作者)', 'monthly', 350, 50, 5000, 350, 50,
   jsonb_build_object(
     'items', jsonb_build_array('每月 5,000 + 1,500 额度 (多送30%)', '专享 Seedance 2.5 & 2.0 异步并发: 20', '单模型并发数: 7', '授权人像容量: 5 个', '包含 Starter 全部特权', '去水印与极速优先生成通道'),
     'meta', jsonb_build_object('yearlyCny', 3499, 'yearlyUsd', 499, 'quotaBase', 5000, 'quotaBonus', 1500, 'concurrency', 7, 'asyncConcurrency', 20, 'portraitCapacity', 5, 'badge', '多送30%',
       'featureGroups', jsonb_build_object(
         'video', jsonb_build_array('Seedance 2.5 专享异步并发：20 路', '单模型并发：7 路', '包含 Starter 全部特权'),
         'image', jsonb_build_array('Flova 4K 极清超采样支持', '图片生成全线享专属低折'),
         'more', jsonb_build_array('授权人像容量：5 个', '极速优先生成通道（免排队）', '专属人像训练加速', '商业商用授权全面支持')))),
   2, 2, TRUE, TRUE, now()),
  ('plus', 'Plus (专业工作室)', 'monthly', 700, 100, 10000, 700, 100,
   jsonb_build_object(
     'items', jsonb_build_array('每月 10,000 + 4,000 额度 (多送40%)', '专享 Seedance 2.5 & 2.0 异步并发: 50', '单模型并发数: 10', '授权人像容量: 10 个', '图片视频 HD 超清增强', '真人多风格合规生成'),
     'meta', jsonb_build_object('yearlyCny', 6999, 'yearlyUsd', 999, 'quotaBase', 10000, 'quotaBonus', 4000, 'concurrency', 10, 'asyncConcurrency', 50, 'portraitCapacity', 10, 'badge', '多送40% · 人气推荐',
       'featureGroups', jsonb_build_object(
         'video', jsonb_build_array('Seedance 2.5 专享异步并发：50 路', '单模型并发：10 路', '视频 HD 超清增强'),
         'image', jsonb_build_array('多风格真人极速生成', '批量图片极速批量出图'),
         'more', jsonb_build_array('授权人像容量：10 个', '极速 VIP 专用 GPU 集群', '优先服务保障', '专属素材资产库空间')))),
   3, 3, TRUE, TRUE, now()),
  ('pro', 'Pro (旗舰大师版)', 'monthly', 1400, 200, 20000, 1400, 200,
   jsonb_build_object(
     'items', jsonb_build_array('每月 20,000 + 10,000 额度 (多送50%)', '专享 Seedance 2.5 & 2.0 异步并发: 80', '单模型并发数: 15', '授权人像容量: 20 个', '图片视频 4K 极清超采样', '多语言真人双风格极速生成', 'VIP 1对1 专属技术支持与企业级 SLA'),
     'meta', jsonb_build_object('yearlyCny', 13999, 'yearlyUsd', 1999, 'quotaBase', 20000, 'quotaBonus', 10000, 'concurrency', 15, 'asyncConcurrency', 80, 'portraitCapacity', 20, 'badge', '多送50% · 旗舰大师',
       'featureGroups', jsonb_build_object(
         'video', jsonb_build_array('Seedance 2.5 专享异步并发：80 路', '单模型并发：15 路', '影视级无限长镜头与高码率'),
         'image', jsonb_build_array('4K 极清超采样顶级画质', '全站模型享受底价折扣'),
         'more', jsonb_build_array('授权人像容量：20 个', 'VIP 1对1 专属技术顾问', '企业级 SLA 保障与增值税发票', '优先体验最新 SOTA 模型')))),
   4, 4, TRUE, TRUE, now())
ON CONFLICT (id) DO NOTHING;

-- Migration 005 used `pro` for its obsolete BYOK tier. Convert only that known
-- legacy seed; an operator-defined non-BYOK `pro` plan remains untouched.
UPDATE ops_bill.plans_config
SET name = 'Pro (旗舰大师版)',
    billing_cycle = 'monthly',
    price_cny = 1400,
    price_usd = 200,
    credits_included = 20000,
    monthly_cny = 1400,
    monthly_usd = 200,
    features_json = jsonb_build_object(
      'items', jsonb_build_array('每月 20,000 + 10,000 额度 (多送50%)', '专享 Seedance 2.5 & 2.0 异步并发: 80', '单模型并发数: 15', '授权人像容量: 20 个', '图片视频 4K 极清超采样', '多语言真人双风格极速生成', 'VIP 1对1 专属技术支持与企业级 SLA'),
      'meta', jsonb_build_object('yearlyCny', 13999, 'yearlyUsd', 1999, 'quotaBase', 20000, 'quotaBonus', 10000, 'concurrency', 15, 'asyncConcurrency', 80, 'portraitCapacity', 20, 'badge', '多送50% · 旗舰大师',
        'featureGroups', jsonb_build_object(
          'video', jsonb_build_array('Seedance 2.5 专享异步并发：80 路', '单模型并发：15 路', '影视级无限长镜头与高码率'),
          'image', jsonb_build_array('4K 极清超采样顶级画质', '全站模型享受底价折扣'),
          'more', jsonb_build_array('授权人像容量：20 个', 'VIP 1对1 专属技术顾问', '企业级 SLA 保障与增值税发票', '优先体验最新 SOTA 模型')))),
    sort_order = 4,
    display_order = 4,
    enabled = TRUE,
    is_active = TRUE,
    updated_at = now()
WHERE id = 'pro' AND name ILIKE '%BYOK%';

CREATE INDEX IF NOT EXISTS plans_config_public_order_idx
  ON ops_bill.plans_config (enabled, display_order, id);
