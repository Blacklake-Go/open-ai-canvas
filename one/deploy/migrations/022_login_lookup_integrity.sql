-- 022_login_lookup_integrity.sql
-- 登录与注册都按 LOWER(...) 归一匹配邮箱，但库里只有区分大小写的约束：
-- 同一邮箱的大小写变体可以注册出两个账号，且这些查询没有任何可用索引（全表扫描）。

-- 1. 归一化邮箱唯一性（仅约束非空邮箱，历史空串/NULL 不受影响）
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key
  ON auth_usr.users (LOWER(email))
  WHERE email IS NOT NULL AND email <> '';

-- 2. 登录热点表达式索引（users_email_lower_key 已可同时服务 users 侧查询）
CREATE INDEX IF NOT EXISTS auth_accounts_email_lower_idx
  ON auth_usr.auth_accounts (LOWER(provider_user_id))
  WHERE provider = 'email';

-- 3. 清理重复索引：同一列定义被历史迁移与临时脚本重复建过，只放大写入
DROP INDEX IF EXISTS auth_usr.idx_users_phone_unique;
DROP INDEX IF EXISTS auth_usr.idx_auth_accounts_user_id;
DROP INDEX IF EXISTS auth_usr.idx_users_last_login_at;
DROP INDEX IF EXISTS auth_usr.idx_users_email;
DROP INDEX IF EXISTS auth_usr.auth_accounts_user_idx;
