-- 056_user_account_deletion_grace_period.sql
-- 支持创作者账户注销 3 天后悔保护期（冷静期），到期自动彻底物理清除所有关联数据
ALTER TABLE auth_usr.users
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deletion_due_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_users_deletion_due
  ON auth_usr.users(deletion_due_at)
  WHERE status = 'deletion_pending';
