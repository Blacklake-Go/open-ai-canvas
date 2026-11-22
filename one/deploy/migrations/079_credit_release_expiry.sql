-- Preserve the original validity of released daily/subscription credits.
-- Existing reservations without a snapshot require evidence before automatic release.
ALTER TABLE ops_bill.credit_reservations
  ADD COLUMN IF NOT EXISTS bucket_allocations_json JSONB,
  ADD COLUMN IF NOT EXISTS released_amount INTEGER CHECK (released_amount >= 0),
  ADD COLUMN IF NOT EXISTS expired_amount INTEGER CHECK (expired_amount >= 0);

CREATE TABLE IF NOT EXISTS ops_bill.credit_returned_lots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  bucket_type TEXT NOT NULL CHECK (bucket_type IN ('DAILY_FREE', 'SUBSCRIPTION')),
  initial_credits INTEGER NOT NULL CHECK (initial_credits > 0),
  remaining_credits INTEGER NOT NULL CHECK (remaining_credits >= 0 AND remaining_credits <= initial_credits),
  expires_at TIMESTAMPTZ,
  reservation_id TEXT NOT NULL REFERENCES ops_bill.credit_reservations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_returned_lots_user_expiry_idx
  ON ops_bill.credit_returned_lots(user_id, bucket_type, expires_at)
  WHERE remaining_credits > 0;
