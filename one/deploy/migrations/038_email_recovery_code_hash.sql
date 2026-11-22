-- Widen the existing OTP storage column to support SHA-256 digests used by email recovery.
ALTER TABLE sys_core.auth_verification_codes
  ALTER COLUMN code TYPE TEXT USING code::TEXT;
