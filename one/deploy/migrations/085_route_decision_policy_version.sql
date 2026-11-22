-- 085_route_decision_policy_version.sql
-- 调度决策必须可解释：只记录 selected_provider_id 和一句理由，
-- 无法回答「用的是哪版策略、哪些线路合格、为什么被排除、权重和预算上限是多少」。
-- 本迁移给 route_decision_logs 补上策略版本与选择元数据；
-- 不改变已有列语义（stability_score 继续存放成功率分项），旧行 metadata 为空对象。

ALTER TABLE ai_studio.route_decision_logs
  ADD COLUMN IF NOT EXISTS policy_version VARCHAR(32),
  ADD COLUMN IF NOT EXISTS selection_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN ai_studio.route_decision_logs.policy_version IS
  '排序策略版本，例如 route-policy-v1；为空表示历史决策，未记录策略版本';
COMMENT ON COLUMN ai_studio.route_decision_logs.selection_metadata_json IS
  '选择元数据：请求/生效策略、权重、模式回退、预算上限、合格候选及分项得分、策略执行路径';
COMMENT ON COLUMN ai_studio.route_decision_logs.stability_score IS
  '稳定性分项，当前由成功率归一化得到；容量分项见 capacity_score';
