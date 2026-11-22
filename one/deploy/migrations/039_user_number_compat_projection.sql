-- Keep a read-only compatibility projection for pre-037 server bundles.
-- Canonical user identity remains auth_usr.users.id; this column is derived and cannot diverge.
ALTER TABLE auth_usr.users
  ADD COLUMN IF NOT EXISTS user_number TEXT GENERATED ALWAYS AS (id::TEXT) STORED;
