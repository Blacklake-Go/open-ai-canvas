-- 086_provider_cost_reconciliation.sql
-- 成本对账需要三组独立金额：估算（estimated_cost_usd）、供应商上报
-- （actual_cost_usd）与人工对账确认（reconciled_cost_usd）。
-- 040 只建了前两组，对账只能覆盖 actual_cost_usd，无法同时保留
-- 「供应商说多少」和「账单实收多少」，也没有证据引用、差异原因与对账事件。
-- 本迁移只做扩展：新增可空列（历史行保持 NULL 表示未知），
-- 把 provider_cost_records 的状态枚举补上 cost_gap（历史成本缺口），
-- 并新增只追加的对账事件表。不修改任何用户积分或已有金额。

ALTER TABLE ai_studio.provider_cost_records
  ADD COLUMN IF NOT EXISTS reconciled_cost_usd NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS billing_evidence_ref TEXT,
  ADD COLUMN IF NOT EXISTS variance_reason TEXT,
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reconciled_by VARCHAR(64);

COMMENT ON COLUMN ai_studio.provider_cost_records.reconciled_cost_usd IS
  '人工对账确认的供应商成本（账单/对账单口径）；NULL 表示尚未对账确认，0 是明确确认的零成本';
COMMENT ON COLUMN ai_studio.provider_cost_records.billing_evidence_ref IS
  '对账证据引用（账单号、对账单文件名、工单号等），不存放密钥或完整签名 URL';
COMMENT ON COLUMN ai_studio.provider_cost_records.variance_reason IS
  '差异原因或处理说明；disputed / not_billable / cost_gap 必须填写';
COMMENT ON COLUMN ai_studio.provider_cost_records.reconciled_at IS '最近一次人工对账时间';
COMMENT ON COLUMN ai_studio.provider_cost_records.reconciled_by IS '最近一次对账操作者 ID（管理员）';

ALTER TABLE ai_studio.provider_cost_records
  DROP CONSTRAINT IF EXISTS provider_cost_records_reconciled_cost_check;
ALTER TABLE ai_studio.provider_cost_records
  ADD CONSTRAINT provider_cost_records_reconciled_cost_check
  CHECK (reconciled_cost_usd IS NULL OR reconciled_cost_usd >= 0);

-- 019/040 建的是匿名 CHECK，先按定义找到并删除，再重建为含 cost_gap 的命名约束。
DO $migration$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'ai_studio'
      AND rel.relname = 'provider_cost_records'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%reconciliation_status%'
  LOOP
    EXECUTE format('ALTER TABLE ai_studio.provider_cost_records DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END
$migration$;

ALTER TABLE ai_studio.provider_cost_records
  ADD CONSTRAINT provider_cost_records_reconciliation_status_check
  CHECK (reconciliation_status IN (
    'pending_reconciliation', 'provider_reported', 'invoice_matched',
    'disputed', 'not_billable', 'cost_gap'
  ));

COMMENT ON COLUMN ai_studio.provider_cost_records.reconciliation_status IS
  '成本对账状态：pending_reconciliation 待核对；provider_reported 已上报；invoice_matched 账单已匹配；disputed 存在争议；not_billable 供应商未计费；cost_gap 历史成本缺口（保留 NULL 并记录原因）';

CREATE TABLE IF NOT EXISTS ai_studio.provider_cost_reconciliation_events (
  id VARCHAR(64) PRIMARY KEY,
  cost_record_id VARCHAR(64) NOT NULL REFERENCES ai_studio.provider_cost_records(id) ON DELETE CASCADE,
  job_id TEXT,
  attempt_id VARCHAR(64),
  from_status VARCHAR(32) NOT NULL,
  to_status VARCHAR(32) NOT NULL,
  provider_reported_cost_usd NUMERIC(18, 8),
  reconciled_cost_usd NUMERIC(18, 8),
  variance_usd NUMERIC(18, 8),
  evidence_ref TEXT,
  variance_reason TEXT,
  actor_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cost_reconciliation_events_record_idx
  ON ai_studio.provider_cost_reconciliation_events (cost_record_id, created_at DESC);

COMMENT ON TABLE ai_studio.provider_cost_reconciliation_events IS
  '成本对账事件：每次人工对账只追加一行，保留状态迁移、供应商上报金额快照、对账金额、差异、证据与操作者';
COMMENT ON COLUMN ai_studio.provider_cost_reconciliation_events.variance_usd IS
  '对账金额 - 供应商上报金额；任一侧未知时为 NULL，不用 0 代替';
