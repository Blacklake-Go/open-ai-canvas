-- Coupon issuance and redemption ledger.
CREATE TABLE IF NOT EXISTS ops_bill.coupons (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'credits',
  value TEXT NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_bill.coupon_redemptions (
  id TEXT PRIMARY KEY,
  coupon_code TEXT NOT NULL REFERENCES ops_bill.coupons(code) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coupon_code, user_id)
);
CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx ON ops_bill.coupon_redemptions(user_id);
