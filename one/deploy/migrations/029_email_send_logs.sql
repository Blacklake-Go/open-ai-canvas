-- 发信明细：每一封经 SMTP 投递的邮件留一行，供后台「发信统计 / 发信内容明细」查询。
-- 只记录投递事实，不记录验证码明文（写入前已脱敏为 ******）。
CREATE TABLE IF NOT EXISTS auth_usr.email_send_logs (
  id TEXT PRIMARY KEY,
  provider VARCHAR(32) NOT NULL DEFAULT 'email_smtp',
  purpose VARCHAR(24) NOT NULL CHECK (purpose IN ('verification', 'test', 'system', 'marketing')),
  recipient VARCHAR(254) NOT NULL,
  recipient_domain VARCHAR(254) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body_preview TEXT,
  status VARCHAR(16) NOT NULL CHECK (status IN ('success', 'failed')),
  error_code VARCHAR(64),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  user_id TEXT REFERENCES auth_usr.users(id) ON DELETE SET NULL,
  actor_id TEXT REFERENCES auth_usr.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_send_logs_created_idx
  ON auth_usr.email_send_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS email_send_logs_purpose_created_idx
  ON auth_usr.email_send_logs(purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS email_send_logs_status_created_idx
  ON auth_usr.email_send_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS email_send_logs_recipient_idx
  ON auth_usr.email_send_logs(recipient, created_at DESC);
