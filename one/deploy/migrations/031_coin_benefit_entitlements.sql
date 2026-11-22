-- 硬币权益兑换的落库位：兑换结果必须变成可核验的用户状态，而不是只记一笔流水。
-- avatar_frames 记录已永久拥有的头像框，avatar_frame 记录当前佩戴的那一个；
-- priority_until 是加速卡的到期时间，出图队列据此把该用户的任务排在普通队列之前。
ALTER TABLE auth_usr.users
  ADD COLUMN IF NOT EXISTS avatar_frame VARCHAR(32),
  ADD COLUMN IF NOT EXISTS avatar_frames TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS priority_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_active_priority_idx
  ON auth_usr.users(priority_until DESC)
  WHERE priority_until IS NOT NULL;
