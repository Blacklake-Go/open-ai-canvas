-- P6/P7: reconcile paid credit grants when an order is refunded.
-- The obligation row makes a partial reversal visible without allowing the
-- wallet to become negative when the user has already spent the credits.
CREATE TABLE IF NOT EXISTS ops_bill.credit_refund_obligations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  reference_id TEXT NOT NULL,
  granted_amount INTEGER NOT NULL CHECK (granted_amount >= 0),
  reversed_amount INTEGER NOT NULL DEFAULT 0 CHECK (reversed_amount >= 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED')),
  last_idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reference_id)
);
CREATE INDEX IF NOT EXISTS credit_refund_obligations_status_idx
  ON ops_bill.credit_refund_obligations(user_id, status, updated_at DESC);
