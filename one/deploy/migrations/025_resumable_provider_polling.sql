-- 025_resumable_provider_polling.sql
-- 统一 AI 模型中台 Phase 04：把「提交上游任务」与「等待上游结果」拆开。
--
-- 动机：上游一次视频生成可能要几分钟，而单次 HTTP 调用有 PROVIDER_TIMEOUT_MS（默认 60s）。
-- 拆开后 worker 每个心跳只查一次状态，任务留在 processing 且带 provider_request_id，
-- 重启/超时后继续轮询而不是重新提交（重新提交会向上游重复要一次配额并重复计费）。
--
-- 兼容性：两个新列都可空，不回填、不删列、不改既有约束；老产代码路径不受影响。
ALTER TABLE ai_studio.creations
  ADD COLUMN IF NOT EXISTS next_poll_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS poll_locked_until TIMESTAMPTZ;

-- 只覆盖「已提交、待轮询」这一小撮行，避免在 processing 全表上扫描。
CREATE INDEX IF NOT EXISTS creations_poll_due_idx
  ON ai_studio.creations (next_poll_at)
  WHERE status = 'processing' AND provider_request_id IS NOT NULL;
