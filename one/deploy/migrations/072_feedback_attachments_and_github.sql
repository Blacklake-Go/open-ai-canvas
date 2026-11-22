-- 反馈提交补充 GitHub 关联与附件元数据。
-- 附件本体走对象存储（feedback 专用前缀），这里只保留展示所需的元数据，
-- 避免把最大 30MB 的二进制塞进业务库。
ALTER TABLE ops_bill.feedback_reports
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
