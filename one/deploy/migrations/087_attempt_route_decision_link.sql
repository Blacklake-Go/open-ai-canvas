-- 087_attempt_route_decision_link.sql
-- 选择记录要求覆盖 receipt、重试和终态，但这些只发生在执行期：
-- route_decision_logs 记录的是「当时为什么选它」，generation_attempts 记录的是
-- 「实际调用哪条线路、是否拿到回执、为什么重试、最终什么状态」。
-- 两表原先只能按 creation_id 粗略关联，同一任务多次路由/重试时无法一一对应。
-- 本迁移只新增可空关联列与索引，历史 attempt 保持 NULL 表示未关联，不改任何已有数据。

ALTER TABLE ai_studio.generation_attempts
  ADD COLUMN IF NOT EXISTS route_decision_id VARCHAR(64);

COMMENT ON COLUMN ai_studio.generation_attempts.route_decision_id IS
  '本次尝试所依据的 route_decision_logs.id；NULL 表示历史尝试未记录选择依据';

CREATE INDEX IF NOT EXISTS attempts_route_decision_idx
  ON ai_studio.generation_attempts (route_decision_id)
  WHERE route_decision_id IS NOT NULL;