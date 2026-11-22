-- 040_model_pricing_routing_control_tower.sql
-- Versioned provider pricing, reviewed mappings, quote-pinned cost routing and reconciliation.

ALTER TABLE ai_studio.ai_providers
  ADD COLUMN IF NOT EXISTS model_catalog_api_supported BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS model_catalog_api_url TEXT,
  ADD COLUMN IF NOT EXISTS model_catalog_api_reason TEXT,
  ADD COLUMN IF NOT EXISTS model_price_api_supported BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS model_price_api_url TEXT,
  ADD COLUMN IF NOT EXISTS model_price_api_reason TEXT,
  ADD COLUMN IF NOT EXISTS account_balance_api_supported BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS account_balance_api_url TEXT,
  ADD COLUMN IF NOT EXISTS account_balance_api_reason TEXT,
  ADD COLUMN IF NOT EXISTS usage_api_supported BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS usage_api_url TEXT,
  ADD COLUMN IF NOT EXISTS usage_api_reason TEXT,
  ADD COLUMN IF NOT EXISTS balance_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS available_quota NUMERIC(20, 8),
  ADD COLUMN IF NOT EXISTS quota_checked_at TIMESTAMPTZ;

UPDATE ai_studio.ai_providers SET
  model_catalog_api_supported = TRUE,
  model_catalog_api_url = 'https://api.muapi.ai/api/v1/models',
  model_catalog_api_reason = 'MuAPI official docs expose a public, machine-readable full model catalog.',
  model_price_api_supported = TRUE,
  model_price_api_url = 'https://api.muapi.ai/api/v1/models and /api/v1/models/{name}/estimate-cost',
  model_price_api_reason = 'MuAPI official docs expose fixed costs and request-specific estimates for dynamic prices.',
  account_balance_api_supported = TRUE,
  account_balance_api_url = 'https://api.muapi.ai/api/v1/account/balance',
  account_balance_api_reason = 'MuAPI official credits docs document GET /api/v1/account/balance.',
  usage_api_supported = FALSE,
  usage_api_reason = 'Per-request cost is returned by generation responses; a paginated account usage API was not verified.'
WHERE id = 'muapi';

UPDATE ai_studio.ai_providers SET
  model_catalog_api_supported = TRUE,
  model_catalog_api_url = 'https://api.openai.com/v1/models',
  model_catalog_api_reason = 'OpenAI official API lists model IDs and basic ownership/availability only.',
  model_price_api_supported = FALSE,
  model_price_api_reason = 'Public prices are published in documentation; no machine-readable pricing endpoint was verified.'
WHERE id = 'openai';

UPDATE ai_studio.ai_providers SET
  model_catalog_api_supported = TRUE,
  model_catalog_api_url = 'https://generativelanguage.googleapis.com/v1beta/models',
  model_catalog_api_reason = 'Google official API lists models and supported actions with page tokens.',
  model_price_api_supported = FALSE,
  model_price_api_reason = 'Public prices are published in documentation; no machine-readable pricing endpoint was verified.'
WHERE id = 'google';

UPDATE ai_studio.ai_providers SET
  model_catalog_api_supported = TRUE,
  model_catalog_api_url = 'provider-configured /api/v1/models',
  model_catalog_api_reason = 'Official paginated API returns model IDs, modalities, and specs; this channel needs a valid regional/workspace endpoint.',
  model_price_api_supported = TRUE,
  model_price_api_url = 'provider-configured /api/v1/models (output.models[].prices)',
  model_price_api_reason = 'The official directory API includes public prices; currency/unit interpretation remains staged for review, and it is not the account settlement price.'
WHERE id IN ('alibaba', 'dashscope');

UPDATE ai_studio.ai_providers SET
  model_catalog_api_reason = 'Official model documentation is available, but a machine-readable catalog endpoint was not verified.',
  model_price_api_reason = 'Manual verification against the official pricing page is required; no machine-readable pricing endpoint was verified.',
  account_balance_api_reason = 'No supported account-balance endpoint has been verified for this adapter.',
  usage_api_reason = 'No supported account-usage endpoint has been verified for this adapter.'
WHERE id IN ('kling', 'minimax', 'runway', 'luma');

ALTER TABLE ai_studio.provider_models
  ADD COLUMN IF NOT EXISTS review_status VARCHAR(32) NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('pending_review', 'approved', 'rejected', 'needs_specification')),
  ADD COLUMN IF NOT EXISTS provider_model_version VARCHAR(128),
  ADD COLUMN IF NOT EXISTS provider_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS supported_task_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supported_resolutions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supported_durations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supported_qualities JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supported_regions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS license_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mapping_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS specification_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS specification_reviewed_by TEXT;

-- Existing 019 mappings do not contain reviewed specifications; keep them visible but
-- require an operator to verify model equivalence before they can receive new traffic.
UPDATE ai_studio.provider_models
SET review_status = 'needs_specification'
WHERE review_status = 'pending_review'
  AND (supported_task_types = '[]'::jsonb OR capabilities = '{}'::jsonb);

CREATE INDEX IF NOT EXISTS provider_models_review_idx
  ON ai_studio.provider_models(review_status, enabled, model_id);

ALTER TABLE ai_studio.routing_policies
  ALTER COLUMN routing_mode SET DEFAULT 'cost';
UPDATE ai_studio.routing_policies
SET routing_mode = 'cost', updated_at = now()
WHERE routing_mode = 'balanced' AND updated_at = created_at;

ALTER TABLE ai_studio.model_pricing
  ADD COLUMN IF NOT EXISTS site_price_cny NUMERIC(18, 6),
  ADD COLUMN IF NOT EXISTS site_price_currency VARCHAR(16) NOT NULL DEFAULT 'CNY',
  ADD COLUMN IF NOT EXISTS price_locked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS price_valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by TEXT,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS override_expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ai_studio.model_site_price_versions (
  id VARCHAR(64) PRIMARY KEY,
  model_id VARCHAR(64) NOT NULL REFERENCES ai_studio.ai_models(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  site_price NUMERIC(18, 6) NOT NULL CHECK (site_price > 0),
  currency VARCHAR(16) NOT NULL DEFAULT 'CNY',
  credits INTEGER NOT NULL CHECK (credits > 0),
  status VARCHAR(24) NOT NULL DEFAULT 'active'
    CHECK (status IN ('staged','active','superseded','rejected')),
  price_locked BOOLEAN NOT NULL DEFAULT TRUE,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  min_gross_margin_rate NUMERIC(6,4) NOT NULL,
  override_reason TEXT,
  override_expires_at TIMESTAMPTZ,
  previous_version_id VARCHAR(64) REFERENCES ai_studio.model_site_price_versions(id),
  modified_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id,version_no)
);
CREATE INDEX IF NOT EXISTS model_site_price_history_idx
  ON ai_studio.model_site_price_versions(model_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS model_site_price_one_active_idx
  ON ai_studio.model_site_price_versions(model_id) WHERE status='active';

ALTER TABLE ai_studio.model_pricing
  ADD COLUMN IF NOT EXISTS active_site_price_version_id VARCHAR(64)
    REFERENCES ai_studio.model_site_price_versions(id);

INSERT INTO ai_studio.model_site_price_versions
  (id,model_id,version_no,site_price,currency,credits,status,price_locked,effective_at,expires_at,
   min_gross_margin_rate,override_reason,override_expires_at,modified_by)
SELECT 'spv_legacy_' || substr(md5(mp.model_id),1,24),mp.model_id,1,mp.site_price_cny,
       COALESCE(mp.site_price_currency,'CNY'),GREATEST(mp.base_credits,1),'active',
       COALESCE(mp.price_locked,FALSE),COALESCE(mp.price_valid_from,mp.created_at),mp.price_valid_until,
       COALESCE(mp.min_gross_margin_rate,0.75),mp.override_reason,mp.override_expires_at,'migration:040'
FROM ai_studio.model_pricing mp
WHERE mp.site_price_cny IS NOT NULL AND mp.site_price_cny > 0
  AND NOT EXISTS (SELECT 1 FROM ai_studio.model_site_price_versions v WHERE v.model_id=mp.model_id);
UPDATE ai_studio.model_pricing mp SET active_site_price_version_id=v.id
FROM ai_studio.model_site_price_versions v
WHERE v.model_id=mp.model_id AND v.status='active' AND mp.active_site_price_version_id IS NULL;

CREATE TABLE IF NOT EXISTS ai_studio.exchange_rate_snapshots (
  id VARCHAR(64) PRIMARY KEY,
  base_currency VARCHAR(16) NOT NULL,
  quote_currency VARCHAR(16) NOT NULL,
  rate NUMERIC(24, 12) NOT NULL CHECK (rate > 0),
  source_type VARCHAR(32) NOT NULL CHECK (source_type IN ('official', 'reference', 'manual', 'configured')),
  source_url TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  evidence_digest VARCHAR(128),
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exchange_rate_lookup_idx
  ON ai_studio.exchange_rate_snapshots(base_currency, quote_currency, observed_at DESC);

-- Preserve the existing configured conversion policy as an explicitly configured, timestamped baseline.
INSERT INTO ai_studio.exchange_rate_snapshots
  (id, base_currency, quote_currency, rate, source_type, source_url, observed_at, expires_at, evidence_digest, created_by)
SELECT 'fx_baseline_usd_cny_20260924', 'USD', 'CNY', 7.2, 'configured',
       'Existing server-side CREDIT_PRICING_POLICY.usdToCny baseline', now(),
       now() + interval '30 days', md5('CREDIT_PRICING_POLICY.usdToCny=7.2'), 'migration:040'
WHERE NOT EXISTS (
  SELECT 1 FROM ai_studio.exchange_rate_snapshots
  WHERE base_currency = 'USD' AND quote_currency = 'CNY'
);

CREATE TABLE IF NOT EXISTS ai_studio.provider_model_price_versions (
  id VARCHAR(64) PRIMARY KEY,
  provider_model_id VARCHAR(64) NOT NULL REFERENCES ai_studio.provider_models(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  price_type VARCHAR(32) NOT NULL CHECK (price_type IN ('official_public', 'account_actual', 'aggregator', 'manual')),
  billing_unit VARCHAR(64) NOT NULL,
  currency VARCHAR(16) NOT NULL,
  price_config JSONB NOT NULL,
  applicability JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT,
  source_api TEXT,
  source_observed_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  evidence_digest VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'pending_review', 'active', 'superseded', 'expired', 'rejected')),
  manually_locked BOOLEAN NOT NULL DEFAULT FALSE,
  change_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_version_id VARCHAR(64) REFERENCES ai_studio.provider_model_price_versions(id),
  modified_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  conservative_upper_bound_config JSONB,
  conservative_upper_bound_currency VARCHAR(16),
  conservative_upper_bound_expires_at TIMESTAMPTZ,
  conservative_upper_bound_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_model_id, version_no)
);
CREATE INDEX IF NOT EXISTS provider_model_price_history_idx
  ON ai_studio.provider_model_price_versions(provider_model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS provider_model_price_review_idx
  ON ai_studio.provider_model_price_versions(status, fetched_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS provider_model_one_active_price_idx
  ON ai_studio.provider_model_price_versions(provider_model_id,price_type)
  WHERE status = 'active';

-- Legacy JSON prices are retained as reviewable history. Their source and commercial meaning were
-- not recorded, so the migration deliberately does not make them route-eligible.
INSERT INTO ai_studio.provider_model_price_versions
  (id, provider_model_id, version_no, price_type, billing_unit, currency, price_config,
   source_api, source_observed_at, fetched_at, evidence_digest, status, change_summary, modified_by)
SELECT 'pver_legacy_' || substr(md5(pm.id), 1, 24), pm.id, 1, 'manual',
       COALESCE(pm.cost_config->>'billing_unit', 'legacy_unit_unverified'),
       COALESCE(NULLIF(pm.cost_config->>'currency', ''), 'USD'),
       COALESCE(pm.cost_config, '{}'::jsonb),
       'ai_studio.provider_models.cost_config (legacy; source unverified)', pm.updated_at,
       now(), md5(pm.cost_config::text), 'pending_review',
       jsonb_build_object('migration', '040', 'requires_manual_verification', true), 'migration:040'
FROM ai_studio.provider_models pm
WHERE pm.cost_config IS NOT NULL
  AND pm.cost_config <> '{}'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM ai_studio.provider_model_price_versions pv WHERE pv.provider_model_id = pm.id
  );

ALTER TABLE ai_studio.generation_quotes
  ALTER COLUMN estimated_provider_cost_usd DROP NOT NULL,
  ALTER COLUMN estimated_provider_cost_usd DROP DEFAULT,
  ADD COLUMN IF NOT EXISTS route_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fx_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(200),
  ADD COLUMN IF NOT EXISTS request_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS pricing_policy_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS site_price_version_id VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS generation_quotes_idempotency_idx
  ON ai_studio.generation_quotes(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE ai_studio.creations
  ALTER COLUMN estimated_cost_usd DROP NOT NULL,
  ALTER COLUMN estimated_cost_usd DROP DEFAULT,
  ALTER COLUMN actual_cost_usd DROP NOT NULL,
  ALTER COLUMN actual_cost_usd DROP DEFAULT;
-- The previous schema filled omitted costs with 0, and did not retain provenance.
-- These legacy zeroes cannot be distinguished from an explicitly reported free call,
-- so preserve neither as a financial fact: new provider-reported zeroes carry source data.
UPDATE ai_studio.creations
SET estimated_cost_usd = NULL WHERE estimated_cost_usd = 0;
UPDATE ai_studio.creations
SET actual_cost_usd = NULL WHERE actual_cost_usd = 0;

ALTER TABLE ai_studio.route_decision_logs
  ADD COLUMN IF NOT EXISTS quote_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS price_version_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS estimated_cost_cny NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS fx_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rejected_candidates_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS failover_cost_limit_usd NUMERIC(18, 8);

ALTER TABLE ai_studio.generation_attempts
  ALTER COLUMN actual_cost_usd DROP NOT NULL,
  ALTER COLUMN actual_cost_usd DROP DEFAULT,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS price_version_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS cost_currency VARCHAR(16),
  ADD COLUMN IF NOT EXISTS cost_source VARCHAR(32),
  ADD COLUMN IF NOT EXISTS provider_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS provider_model_version VARCHAR(128),
  ADD COLUMN IF NOT EXISTS mapping_version INTEGER,
  ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(32) NOT NULL DEFAULT 'pending_reconciliation'
    CHECK (reconciliation_status IN ('pending_reconciliation', 'provider_reported', 'invoice_matched', 'disputed', 'not_billable'));
UPDATE ai_studio.generation_attempts SET actual_cost_usd = NULL WHERE actual_cost_usd = 0;

ALTER TABLE ai_studio.provider_cost_records
  ALTER COLUMN estimated_cost_usd DROP NOT NULL,
  ALTER COLUMN estimated_cost_usd DROP DEFAULT,
  ALTER COLUMN actual_cost_usd DROP NOT NULL,
  ALTER COLUMN actual_cost_usd DROP DEFAULT,
  ADD COLUMN IF NOT EXISTS price_version_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS fx_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cost_source VARCHAR(32),
  ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(32) NOT NULL DEFAULT 'pending_reconciliation'
    CHECK (reconciliation_status IN ('pending_reconciliation', 'provider_reported', 'invoice_matched', 'disputed', 'not_billable'));
UPDATE ai_studio.provider_cost_records SET actual_cost_usd = NULL WHERE actual_cost_usd = 0;
UPDATE ai_studio.provider_cost_records SET estimated_cost_usd = NULL WHERE estimated_cost_usd = 0;

CREATE TABLE IF NOT EXISTS ai_studio.channel_sync_runs (
  id VARCHAR(64) PRIMARY KEY,
  provider_id VARCHAR(64) NOT NULL REFERENCES ai_studio.ai_providers(id),
  sync_type VARCHAR(32) NOT NULL CHECK (sync_type IN ('models', 'prices', 'balance', 'usage')),
  status VARCHAR(32) NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed', 'empty', 'parse_failed')),
  source_url TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  fetched_count INTEGER NOT NULL DEFAULT 0,
  staged_count INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_summary TEXT,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id TEXT,
  request_id TEXT
);
CREATE INDEX IF NOT EXISTS channel_sync_runs_provider_idx
  ON ai_studio.channel_sync_runs(provider_id, started_at DESC);

CREATE TABLE IF NOT EXISTS ai_studio.provider_catalog_entries (
  id VARCHAR(64) PRIMARY KEY,
  provider_id VARCHAR(64) NOT NULL REFERENCES ai_studio.ai_providers(id) ON DELETE CASCADE,
  provider_model_id VARCHAR(128) NOT NULL,
  display_name VARCHAR(256),
  category VARCHAR(64),
  provider_model_version VARCHAR(128),
  provider_endpoint TEXT,
  capabilities_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  catalog_price_json JSONB,
  source_url TEXT,
  source_api TEXT,
  evidence_digest VARCHAR(128),
  review_status VARCHAR(32) NOT NULL DEFAULT 'pending_mapping'
    CHECK (review_status IN ('pending_mapping', 'mapped_pending_review', 'approved', 'retired', 'rejected')),
  mapped_provider_model_id VARCHAR(64) REFERENCES ai_studio.provider_models(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired_at TIMESTAMPTZ,
  seen_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, provider_model_id)
);
CREATE INDEX IF NOT EXISTS provider_catalog_review_idx
  ON ai_studio.provider_catalog_entries(review_status, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS ai_studio.model_price_import_batches (
  id VARCHAR(64) PRIMARY KEY,
  status VARCHAR(32) NOT NULL CHECK (status IN ('previewed', 'applied', 'rolled_back', 'failed')),
  mode VARCHAR(16) NOT NULL CHECK (mode IN ('dry_run', 'apply')),
  source_filename TEXT,
  row_count INTEGER NOT NULL DEFAULT 0,
  valid_count INTEGER NOT NULL DEFAULT 0,
  conflict_count INTEGER NOT NULL DEFAULT 0,
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  rollback_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  actor_id TEXT,
  idempotency_key VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ,
  rolled_back_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS model_price_import_idempotency_idx
  ON ai_studio.model_price_import_batches(actor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_studio.generation_cost_reconciliations (
  id VARCHAR(64) PRIMARY KEY,
  provider_id VARCHAR(64) NOT NULL REFERENCES ai_studio.ai_providers(id),
  provider_request_id TEXT,
  generation_attempt_id VARCHAR(64) REFERENCES ai_studio.generation_attempts(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  invoice_reference TEXT,
  currency VARCHAR(16),
  amount NUMERIC(18, 8),
  status VARCHAR(32) NOT NULL CHECK (status IN ('pending', 'matched', 'unmatched', 'disputed')),
  evidence_digest VARCHAR(128),
  notes TEXT,
  reconciled_by TEXT,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS generation_cost_reconciliation_status_idx
  ON ai_studio.generation_cost_reconciliations(status, provider_id, created_at DESC);
