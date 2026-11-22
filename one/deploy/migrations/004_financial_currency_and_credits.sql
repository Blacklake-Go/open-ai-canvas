-- Financial wallets, immutable journals, and two-phase credit reservations.
CREATE TABLE IF NOT EXISTS ops_bill.currency_wallets (
  user_id TEXT PRIMARY KEY REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  available_balance NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  frozen_balance NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (frozen_balance >= 0),
  restricted_balance NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (restricted_balance >= 0),
  pay_password_hash TEXT,
  pay_password_salt TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_bill.currency_journal_entries (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  user_id TEXT REFERENCES auth_usr.users(id),
  account_code TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(18, 4),
  biz_type TEXT NOT NULL,
  biz_id TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS currency_journal_user_idx ON ops_bill.currency_journal_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS currency_journal_tx_idx ON ops_bill.currency_journal_entries(transaction_id);
CREATE TABLE IF NOT EXISTS ops_bill.currency_transfers (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES auth_usr.users(id),
  receiver_id TEXT NOT NULL REFERENCES auth_usr.users(id),
  amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  fee NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING',
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_remarks TEXT,
  client_ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_bill.credit_wallets (
  user_id TEXT PRIMARY KEY REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  daily_free_credits INTEGER NOT NULL DEFAULT 0 CHECK (daily_free_credits >= 0),
  daily_expires_at TIMESTAMPTZ,
  subscription_credits INTEGER NOT NULL DEFAULT 0 CHECK (subscription_credits >= 0),
  subscription_expires_at TIMESTAMPTZ,
  perpetual_credits INTEGER NOT NULL DEFAULT 0 CHECK (perpetual_credits >= 0),
  frozen_credits INTEGER NOT NULL DEFAULT 0 CHECK (frozen_credits >= 0),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_bill.credit_reservations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id),
  studio_id TEXT,
  model_id TEXT NOT NULL,
  reserved_amount INTEGER NOT NULL CHECK (reserved_amount > 0),
  settled_amount INTEGER NOT NULL DEFAULT 0 CHECK (settled_amount >= 0),
  bucket_split_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'RESERVED',
  idempotency_key TEXT UNIQUE NOT NULL,
  creation_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_reservations_status_idx ON ops_bill.credit_reservations(user_id, status);
CREATE TABLE IF NOT EXISTS ops_bill.credit_ledger_v2 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id),
  bucket_type TEXT NOT NULL,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  reference_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_v2_user_idx ON ops_bill.credit_ledger_v2(user_id, bucket_type, created_at DESC);
