-- 站内建议 / 报错 / 安全漏洞提交：硬币的第二条获取渠道（另一条是每日登录）。
-- 硬币只在人工审核判定有效后由管理员裁决发放，因此这里同时保存审核结论与发放结果。
CREATE TABLE IF NOT EXISTS ops_bill.feedback_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  kind VARCHAR(24) NOT NULL CHECK (kind IN ('bug_report', 'improvement', 'security')),
  title VARCHAR(200) NOT NULL,
  page_url TEXT,
  detail TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  reward_coins NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
  reviewer_id TEXT REFERENCES auth_usr.users(id) ON DELETE SET NULL,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  reward_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_reports_status_created_idx
  ON ops_bill.feedback_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_reports_user_created_idx
  ON ops_bill.feedback_reports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_reports_kind_status_idx
  ON ops_bill.feedback_reports(kind, status);
