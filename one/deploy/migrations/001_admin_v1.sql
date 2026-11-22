-- PostgreSQL 16 baseline. Every application table is owned by one domain schema.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS sys_core;
CREATE SCHEMA IF NOT EXISTS auth_usr;
CREATE SCHEMA IF NOT EXISTS ai_studio;
CREATE SCHEMA IF NOT EXISTS ops_bill;

CREATE TABLE IF NOT EXISTS sys_core.schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  execution_ms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS auth_usr.users (
  id TEXT PRIMARY KEY,
  uuid UUID NOT NULL DEFAULT gen_random_uuid(),
  username VARCHAR(64),
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  password_hash TEXT,
  password_salt TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  status TEXT NOT NULL DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  phone VARCHAR(32),
  phone_country_code VARCHAR(16) DEFAULT '+86',
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  registration_source VARCHAR(64) DEFAULT 'web',
  referral_source VARCHAR(128),
  locale VARCHAR(16) DEFAULT 'zh',
  timezone VARCHAR(64) DEFAULT 'Asia/Shanghai',
  last_login_ip VARCHAR(64),
  last_login_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON auth_usr.users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_last_login_idx ON auth_usr.users(last_login_at DESC);

CREATE TABLE IF NOT EXISTS auth_usr.sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  user_agent_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON auth_usr.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON auth_usr.sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_usr.oauth_accounts (
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  email TEXT,
  profile_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS oauth_accounts_user_idx ON auth_usr.oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS auth_usr.auth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  provider_user_id VARCHAR(128) NOT NULL,
  provider_email VARCHAR(255),
  provider_username VARCHAR(128),
  password_hash TEXT,
  password_salt TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  profile_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS auth_accounts_user_idx ON auth_usr.auth_accounts(user_id);

CREATE TABLE IF NOT EXISTS sys_core.auth_verification_codes (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'login',
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_codes_target_idx ON sys_core.auth_verification_codes(target, type, expires_at DESC);

CREATE TABLE IF NOT EXISTS ai_studio.models_config (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0,
  credits_price INTEGER NOT NULL DEFAULT 1 CHECK (credits_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS models_provider_idx ON ai_studio.models_config(provider);
CREATE INDEX IF NOT EXISTS models_type_idx ON ai_studio.models_config(type);

CREATE TABLE IF NOT EXISTS ai_studio.creations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  studio_id TEXT NOT NULL,
  label TEXT,
  result_url TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  credit_cost INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  model TEXT,
  external_request_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_code TEXT,
  error_reason TEXT,
  actual_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0,
  parent_creation_id TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creations_user_idx ON ai_studio.creations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creations_status_idx ON ai_studio.creations(status, created_at DESC);

CREATE TABLE IF NOT EXISTS ops_bill.subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subscription_id)
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON ops_bill.subscriptions(user_id);

CREATE TABLE IF NOT EXISTS ops_bill.orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  provider_order_id TEXT,
  checkout_url TEXT,
  failure_code TEXT,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  metadata_json JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON ops_bill.orders(user_id);

CREATE TABLE IF NOT EXISTS ops_bill.webhook_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  attempts INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  payload_json JSONB,
  headers_json JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);

CREATE TABLE IF NOT EXISTS ops_bill.credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  actor_user_id TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_idx ON ops_bill.credit_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ops_bill.plans_config (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_cny INTEGER NOT NULL DEFAULT 0,
  monthly_usd INTEGER NOT NULL DEFAULT 0,
  features_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops_bill.admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low',
  before_json JSONB,
  after_json JSONB,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON ops_bill.admin_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS ops_bill.admin_notes (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops_bill.moderation_cases (
  id TEXT PRIMARY KEY,
  creation_id TEXT NOT NULL REFERENCES ai_studio.creations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  reason_code TEXT,
  resolution TEXT,
  reviewer_id TEXT,
  notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops_bill.provider_configs (
  provider TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config_json JSONB,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_bill.provider_secrets (
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, name)
);
CREATE TABLE IF NOT EXISTS ops_bill.provider_health_checks (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER,
  error_code TEXT,
  details_json JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops_bill.system_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ops_bill.idempotency_keys (
  key_hash TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  response_json JSONB,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
