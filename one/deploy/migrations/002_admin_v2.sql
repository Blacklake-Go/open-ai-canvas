-- Model configuration additions. Safe on clean and pre-existing PostgreSQL 16 databases.
ALTER TABLE ai_studio.models_config
  ADD COLUMN IF NOT EXISTS metadata_json JSONB,
  ADD COLUMN IF NOT EXISTS actual_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS models_active_idx ON ai_studio.models_config(is_active, sort_order);
