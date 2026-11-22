-- Additive: no historical identity is merged, deleted or marked verified.
CREATE TABLE IF NOT EXISTS auth_usr.oauth_flows (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('state','onboarding','step_up')),
  payload JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  code_hash TEXT,
  code_email TEXT,
  code_sent_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS oauth_flows_expiry ON auth_usr.oauth_flows(expires_at);
ALTER TABLE auth_usr.auth_accounts
  ADD COLUMN IF NOT EXISTS provider_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS oauth_confirmed_at TIMESTAMPTZ;
