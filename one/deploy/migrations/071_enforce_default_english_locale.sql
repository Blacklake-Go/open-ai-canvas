-- 强制网站与用户默认语言为英语 (en)
-- 1. 修改 users 表 locale 字段默认值为 'en'
ALTER TABLE auth_usr.users ALTER COLUMN locale SET DEFAULT 'en';

-- 2. 将未在偏好设置中显式指定过 locale 的存量用户的系统语言重置为英文 'en'
UPDATE auth_usr.users
SET locale = 'en'
WHERE (social_links->'preferences'->>'locale') IS NULL;
