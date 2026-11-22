-- Web-only SMS OTP challenges and masked delivery telemetry. Existing users.id,
-- auth_accounts, sessions, billing, generation, and asset records are unchanged.
CREATE TABLE IF NOT EXISTS auth_usr.otp_challenges (
  id TEXT PRIMARY KEY,
  phone_e164 VARCHAR(18) NOT NULL,
  country VARCHAR(2) NOT NULL,
  provider VARCHAR(32) NOT NULL CHECK (provider IN ('tencent_sms', 'aliyun_sms', 'firebase_phone')),
  purpose VARCHAR(24) NOT NULL DEFAULT 'login' CHECK (purpose IN ('login', 'bind')),
  user_id TEXT REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  ip_hash TEXT,
  code_hash TEXT,
  provider_session_ciphertext TEXT,
  provider_session_nonce TEXT,
  provider_session_auth_tag TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  send_count INTEGER NOT NULL DEFAULT 0 CHECK (send_count >= 0),
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('captcha_pending', 'pending', 'sent', 'verified', 'invalid', 'expired', 'cancelled', 'send_failed')),
  provider_error_code VARCHAR(64),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (provider = 'firebase_phone' AND code_hash IS NULL)
    OR (provider IN ('tencent_sms', 'aliyun_sms') AND (code_hash IS NOT NULL OR status = 'captcha_pending'))
  ),
  CHECK (
    provider <> 'firebase_phone'
    OR status NOT IN ('sent', 'verified')
    OR (provider_session_ciphertext IS NOT NULL AND provider_session_nonce IS NOT NULL AND provider_session_auth_tag IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS otp_challenges_phone_created_idx
  ON auth_usr.otp_challenges(phone_e164, created_at DESC);
CREATE INDEX IF NOT EXISTS otp_challenges_ip_created_idx
  ON auth_usr.otp_challenges(ip_hash, created_at DESC) WHERE ip_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS otp_challenges_device_created_idx
  ON auth_usr.otp_challenges(device_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS otp_challenges_status_expiry_idx
  ON auth_usr.otp_challenges(status, expires_at);

CREATE TABLE IF NOT EXISTS auth_usr.sms_delivery_logs (
  id TEXT PRIMARY KEY,
  challenge_id TEXT REFERENCES auth_usr.otp_challenges(id) ON DELETE SET NULL,
  provider VARCHAR(32) NOT NULL,
  masked_phone VARCHAR(32) NOT NULL,
  country VARCHAR(2) NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('success', 'failed')),
  error_code VARCHAR(64),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_delivery_logs_provider_created_idx
  ON auth_usr.sms_delivery_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS sms_delivery_logs_created_idx
  ON auth_usr.sms_delivery_logs(created_at DESC);
