-- 084_provider_balance_observed_values.sql
-- 余额必须区分「实测值」与「未知」。
-- 019 建表时 balance 为 NUMERIC NOT NULL DEFAULT 0，使从未查询过余额的渠道
-- 在后台被显示为「余额 0」，路由也把它当作真实余额读取。
-- 本迁移只放宽约束，并把从未观测过的默认 0 归一为 NULL（未知）；
-- balance_checked_at 非空的行是真实观测/写入值，保持原样，不触碰历史数据。

ALTER TABLE ai_studio.ai_providers
  ALTER COLUMN balance DROP NOT NULL,
  ALTER COLUMN balance DROP DEFAULT;

UPDATE ai_studio.ai_providers
SET balance = NULL
WHERE balance = 0
  AND balance_checked_at IS NULL;
