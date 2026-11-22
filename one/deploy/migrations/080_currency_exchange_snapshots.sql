CREATE TABLE IF NOT EXISTS ops_bill.currency_exchange_snapshots (
  transaction_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id),
  request_json JSONB NOT NULL,
  result_json JSONB NOT NULL,
  fx_snapshot_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS currency_exchange_snapshots_user_idx
  ON ops_bill.currency_exchange_snapshots(user_id, created_at DESC);
