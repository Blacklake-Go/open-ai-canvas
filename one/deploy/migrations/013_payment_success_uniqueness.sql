-- P6: one successful payment ledger entry per order.
-- Stripe can deliver semantically equivalent success events with different IDs;
-- an order must never grant the same paid entitlement twice.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ops_bill.payment_ledger
    WHERE entry_type = 'payment_succeeded' AND order_id IS NOT NULL
    GROUP BY order_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'payment ledger contains multiple success entries for one order; reconcile before migration 013';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS payment_ledger_one_success_per_order_idx
  ON ops_bill.payment_ledger(order_id)
  WHERE entry_type = 'payment_succeeded' AND order_id IS NOT NULL;
