-- 020_subscription_billing_cycle_hardening.sql
-- 订阅周期扩展与品牌核心资产表加固

ALTER TABLE ops_bill.subscriptions ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(32) DEFAULT 'monthly';
ALTER TABLE ops_bill.orders ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(32) DEFAULT 'monthly';

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON ops_bill.subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_billing_cycle ON ops_bill.orders(billing_cycle);
