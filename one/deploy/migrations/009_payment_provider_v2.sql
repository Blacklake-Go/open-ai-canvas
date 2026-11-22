-- P6: provider attempts, immutable payment entries, safe webhook replay and call observability.
ALTER TABLE ops_bill.orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_amount_minor INTEGER,
  ADD COLUMN IF NOT EXISTS provider_payload_json JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_idempotency_idx
  ON ops_bill.orders(provider, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_order_idx
  ON ops_bill.orders(provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

ALTER TABLE ops_bill.webhook_events
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS event_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_object_id TEXT,
  ADD COLUMN IF NOT EXISTS replayed_at TIMESTAMPTZ;
UPDATE ops_bill.webhook_events SET received_at = COALESCE(received_at, created_at);

ALTER TABLE ops_bill.subscriptions
  ADD COLUMN IF NOT EXISTS last_provider_event_created_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ops_bill.payment_ledger (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  order_id TEXT REFERENCES ops_bill.orders(id),
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('payment_succeeded', 'payment_refund')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  provider_payment_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id, entry_type)
);
CREATE INDEX IF NOT EXISTS payment_ledger_order_idx ON ops_bill.payment_ledger(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_ledger_user_idx ON ops_bill.payment_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ops_bill.payment_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES ops_bill.orders(id),
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_request_id TEXT,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops_bill.provider_call_logs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  order_id TEXT,
  request_id TEXT,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  error_code TEXT,
  usage_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_call_logs_lookup_idx ON ops_bill.provider_call_logs(provider, action, created_at DESC);
