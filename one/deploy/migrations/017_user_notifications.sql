-- 017_user_notifications.sql
-- 全站用户通知中心与系统广播表

CREATE TABLE IF NOT EXISTS sys_core.user_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'system', -- 'system', 'activity', 'credit', 'vip'
  link_url VARCHAR(255),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_idx ON sys_core.user_notifications(user_id, is_read, created_at DESC);

-- 为当前系统存量用户注入基础系统通知与上线通知
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT id FROM auth_usr.users LOOP
    IF NOT EXISTS (SELECT 1 FROM sys_core.user_notifications WHERE user_id = u.id AND type = 'system') THEN
      INSERT INTO sys_core.user_notifications (id, user_id, title, content, type, link_url, is_read, created_at)
      VALUES 
        ('ntf_wel_' || substr(u.id, 5, 8), u.id, '🎉 欢迎加入 SupDance AI 创作工作室', '恭喜您完成注册！专属 6 位数字身份 ID 已分配完毕，您可以随时在个人中心查看活跃面板与管理资产。', 'system', '/account?tab=activity', false, now() - INTERVAL '1 hour'),
        ('ntf_3d_' || substr(u.id, 5, 8), u.id, '✨ AI 3D 预演与新模型工作流上线', '全新 AI 3D 预演与模型创作画布已正式开放，快去探索前沿生成体验！', 'activity', '/studio', false, now());
    END IF;
  END LOOP;
END $$;