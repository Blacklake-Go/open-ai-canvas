-- 048_pricing_strategy.sql
-- 创建 pricing_strategy 表并扩展 model_pricing 支持倍率自动定价与手动调价

CREATE TABLE IF NOT EXISTS ai_studio.pricing_strategy (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL DEFAULT 'default',
  base_multiplier       NUMERIC(6,3) NOT NULL DEFAULT 1.500,
  min_margin_rate       NUMERIC(5,4) NOT NULL DEFAULT 0.3000,
  rounding_strategy     TEXT NOT NULL DEFAULT 'ceil_to_0.01',
  category_multipliers  JSONB DEFAULT '{}',
  tier_multipliers      JSONB DEFAULT '{}',
  spec_multipliers      JSONB DEFAULT '{}',
  is_active             BOOLEAN DEFAULT true,
  updated_by            UUID,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_studio.model_pricing ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'auto';
ALTER TABLE ai_studio.model_pricing ADD COLUMN IF NOT EXISTS auto_suggested_price_cny NUMERIC(12,4);
ALTER TABLE ai_studio.model_pricing ADD COLUMN IF NOT EXISTS manual_override_price_cny NUMERIC(12,4);
ALTER TABLE ai_studio.model_pricing ADD COLUMN IF NOT EXISTS effective_multiplier NUMERIC(6,3);
ALTER TABLE ai_studio.model_pricing ADD COLUMN IF NOT EXISTS locked_by UUID;
ALTER TABLE ai_studio.model_pricing ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE ai_studio.model_pricing ADD COLUMN IF NOT EXISTS lock_reason TEXT;

INSERT INTO ai_studio.pricing_strategy (
  name, base_multiplier, min_margin_rate,
  category_multipliers, tier_multipliers, spec_multipliers, is_active
)
SELECT
  'default', 1.500, 0.3000,
  '{"image": 1.5, "video": 2.0, "audio": 1.3, "workflow": 1.8}'::jsonb,
  '{"core": 1.0, "backup": 1.0, "experimental": 1.2}'::jsonb,
  '{"resolution": {"4k": 2.0, "2k": 1.5, "1k": 1.0, "720p": 0.8}, "duration": {"60s": 2.5, "30s": 1.8, "10s": 1.2, "5s": 1.0}}'::jsonb,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM ai_studio.pricing_strategy WHERE is_active = true
);
