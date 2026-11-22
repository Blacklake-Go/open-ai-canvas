-- 019_unified_ai_routing_and_pricing.sql
-- 统一 AI 模型中台：混合供应商、三层模型映射、智能路由、动态计价、调用尝试与成本流水

-- 1. AI 供应商管理表
CREATE TABLE IF NOT EXISTS ai_studio.ai_providers (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  provider_type VARCHAR(32) NOT NULL DEFAULT 'official' CHECK (provider_type IN ('aggregator', 'official', 'direct')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 100,
  base_url TEXT,
  api_mode VARCHAR(32) NOT NULL DEFAULT 'async' CHECK (api_mode IN ('async', 'sync', 'stream')),
  health_status VARCHAR(32) NOT NULL DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'disabled')),
  last_health_check_at TIMESTAMPTZ,
  balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  circuit_state VARCHAR(32) NOT NULL DEFAULT 'closed' CHECK (circuit_state IN ('closed', 'circuit_open', 'half_open')),
  circuit_opened_at TIMESTAMPTZ,
  consecutive_failures INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_providers_enabled_idx ON ai_studio.ai_providers(enabled, priority DESC);

-- 2. 标准统一模型目录表 (Canonical AI Models)
CREATE TABLE IF NOT EXISTS ai_studio.ai_models (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'image' CHECK (category IN ('image', 'image_edit', 'video', 'video_image', 'video_text', 'audio', 'text', 'other')),
  description TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'disabled')),
  sort INT NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  supported_resolutions JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_durations JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_ratios JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_input_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  supported_output_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_models_category_status_idx ON ai_studio.ai_models(category, status, sort ASC);

-- 3. 供应商模型渠道映射表 (Provider Models)
CREATE TABLE IF NOT EXISTS ai_studio.provider_models (
  id VARCHAR(64) PRIMARY KEY,
  model_id VARCHAR(64) NOT NULL REFERENCES ai_studio.ai_models(id) ON DELETE CASCADE,
  provider_id VARCHAR(64) NOT NULL REFERENCES ai_studio.ai_providers(id) ON DELETE CASCADE,
  provider_model_id VARCHAR(128) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 100,
  cost_config JSONB NOT NULL DEFAULT '{"currency":"USD","base_cost":0}'::jsonb,
  parameter_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  endpoint_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  timeout INT NOT NULL DEFAULT 120000,
  max_retries INT NOT NULL DEFAULT 2,
  supports_webhook BOOLEAN NOT NULL DEFAULT FALSE,
  supports_polling BOOLEAN NOT NULL DEFAULT TRUE,
  concurrency_limit INT NOT NULL DEFAULT 10,
  rate_limit INT NOT NULL DEFAULT 60,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, provider_id, provider_model_id)
);
CREATE INDEX IF NOT EXISTS provider_models_lookup_idx ON ai_studio.provider_models(model_id, enabled, priority DESC);

-- 4. 模型定价策略表 (Pricing Engine Rules)
CREATE TABLE IF NOT EXISTS ai_studio.model_pricing (
  id VARCHAR(64) PRIMARY KEY,
  model_id VARCHAR(64) NOT NULL REFERENCES ai_studio.ai_models(id) ON DELETE CASCADE UNIQUE,
  pricing_type VARCHAR(32) NOT NULL DEFAULT 'fixed' CHECK (pricing_type IN ('fixed', 'formula')),
  base_credits INT NOT NULL DEFAULT 100 CHECK (base_credits >= 0),
  formula_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  subscription_discounts JSONB NOT NULL DEFAULT '{}'::jsonb,
  min_credits INT NOT NULL DEFAULT 10 CHECK (min_credits >= 0),
  min_gross_margin_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.3000,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. 模型路由策略配置表 (Routing Policies)
CREATE TABLE IF NOT EXISTS ai_studio.routing_policies (
  id VARCHAR(64) PRIMARY KEY,
  model_id VARCHAR(64) NOT NULL REFERENCES ai_studio.ai_models(id) ON DELETE CASCADE UNIQUE,
  routing_mode VARCHAR(32) NOT NULL DEFAULT 'balanced' CHECK (routing_mode IN ('cost', 'quality', 'stability', 'balanced')),
  weights JSONB NOT NULL DEFAULT '{"cost":0.4,"success_rate":0.3,"speed":0.2,"capacity":0.1}'::jsonb,
  circuit_breaker_config JSONB NOT NULL DEFAULT '{"failure_threshold":3,"cooling_period_sec":60,"half_open_requests":2}'::jsonb,
  failover_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. 生成任务报价表 (Generation Quotes)
CREATE TABLE IF NOT EXISTS ai_studio.generation_quotes (
  id VARCHAR(64) PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  model_id VARCHAR(64) NOT NULL REFERENCES ai_studio.ai_models(id) ON DELETE CASCADE,
  parameters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  credits_quoted INT NOT NULL CHECK (credits_quoted >= 0),
  pricing_breakdown_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_provider_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quotes_lookup_idx ON ai_studio.generation_quotes(user_id, model_id, expires_at DESC);

-- 7. 扩展生成任务主表 (ai_studio.creations 向后兼容扩展)
ALTER TABLE ai_studio.creations
  ADD COLUMN IF NOT EXISTS quote_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS routing_mode VARCHAR(32),
  ADD COLUMN IF NOT EXISTS selected_provider_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS total_attempts INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(18, 8) DEFAULT 0;

-- 允许统一中台更丰富的生命周期状态
ALTER TABLE ai_studio.creations DROP CONSTRAINT IF EXISTS creations_status_check;
ALTER TABLE ai_studio.creations
  ADD CONSTRAINT creations_status_check
  CHECK (status IN (
    'created', 'quoted', 'credit_reserved', 'queued', 'routing', 'submitted',
    'processing', 'succeeded', 'failed', 'cancelled', 'refunding'
  ));

-- 8. 渠道调用尝试表 (Generation Attempts)
CREATE TABLE IF NOT EXISTS ai_studio.generation_attempts (
  id VARCHAR(64) PRIMARY KEY,
  creation_id TEXT NOT NULL REFERENCES ai_studio.creations(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  provider_id VARCHAR(64) NOT NULL,
  provider_model_id VARCHAR(128),
  request_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_request_id TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'processing', 'succeeded', 'failed', 'timeout', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  error_code TEXT,
  error_reason TEXT,
  actual_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creation_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS attempts_creation_idx ON ai_studio.generation_attempts(creation_id, attempt_number ASC);
CREATE INDEX IF NOT EXISTS attempts_provider_idx ON ai_studio.generation_attempts(provider_id, status, created_at DESC);

-- 9. 智能路由决策日志表 (Route Decision Logs)
CREATE TABLE IF NOT EXISTS ai_studio.route_decision_logs (
  id VARCHAR(64) PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES ai_studio.creations(id) ON DELETE CASCADE,
  model_id VARCHAR(64) NOT NULL,
  candidate_providers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_provider_id VARCHAR(64) NOT NULL,
  selected_provider_model_id VARCHAR(128),
  routing_mode VARCHAR(32) NOT NULL DEFAULT 'balanced',
  score NUMERIC(8, 4) NOT NULL DEFAULT 0,
  cost_score NUMERIC(8, 4) NOT NULL DEFAULT 0,
  stability_score NUMERIC(8, 4) NOT NULL DEFAULT 0,
  speed_score NUMERIC(8, 4) NOT NULL DEFAULT 0,
  capacity_score NUMERIC(8, 4) NOT NULL DEFAULT 0,
  selection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS route_decision_job_idx ON ai_studio.route_decision_logs(job_id);
CREATE INDEX IF NOT EXISTS route_decision_model_idx ON ai_studio.route_decision_logs(model_id, created_at DESC);

-- 10. 供应商成本与核算流水表 (Provider Cost Records)
CREATE TABLE IF NOT EXISTS ai_studio.provider_cost_records (
  id VARCHAR(64) PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES ai_studio.creations(id) ON DELETE CASCADE,
  attempt_id VARCHAR(64) REFERENCES ai_studio.generation_attempts(id) ON DELETE SET NULL,
  provider_id VARCHAR(64) NOT NULL,
  model_id VARCHAR(64) NOT NULL,
  credits_charged INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0,
  actual_cost_usd NUMERIC(18, 8) NOT NULL DEFAULT 0,
  currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cost_records_provider_idx ON ai_studio.provider_cost_records(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cost_records_model_idx ON ai_studio.provider_cost_records(model_id, created_at DESC);

-- ============================================================================
-- 11. 数据初始化与兼容性迁移 (Seed Data & Backfill)
-- ============================================================================

-- 插入八大主流供应商
INSERT INTO ai_studio.ai_providers
  (id, slug, name, provider_type, enabled, priority, base_url, api_mode, currency, created_at, updated_at)
VALUES
  ('muapi', 'muapi', 'MuAPI 聚合网关', 'aggregator', TRUE, 100, 'https://api.muapi.ai', 'async', 'USD', now(), now()),
  ('kling', 'kling', '快手可灵官方 API', 'official', TRUE, 90, 'https://api.klingai.com', 'async', 'CNY', now(), now()),
  ('minimax', 'minimax', 'MiniMax / 海螺官方 API', 'official', TRUE, 90, 'https://api.minimax.chat', 'async', 'CNY', now(), now()),
  ('alibaba', 'alibaba', '阿里云百炼 / DashScope', 'official', TRUE, 85, 'https://dashscope.aliyuncs.com', 'async', 'CNY', now(), now()),
  ('openai', 'openai', 'OpenAI 官方 API', 'official', TRUE, 80, 'https://api.openai.com', 'async', 'USD', now(), now()),
  ('google', 'google', 'Google Imagen / Veo', 'official', TRUE, 80, 'https://generativelanguage.googleapis.com', 'async', 'USD', now(), now()),
  ('runway', 'runway', 'Runway 官方 API', 'official', TRUE, 75, 'https://api.runwayml.com', 'async', 'USD', now(), now()),
  ('luma', 'luma', 'Luma Dream Machine', 'official', TRUE, 70, 'https://api.lumalabs.ai', 'async', 'USD', now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  provider_type = EXCLUDED.provider_type,
  base_url = EXCLUDED.base_url,
  currency = EXCLUDED.currency,
  updated_at = now();

-- 从老 models_config 表平滑回填所有模型至 ai_models
INSERT INTO ai_studio.ai_models
  (id, slug, name, display_name, category, description, status, sort, is_featured, capabilities, created_at, updated_at)
SELECT
  id,
  id AS slug,
  name,
  name AS display_name,
  CASE
    WHEN type IN ('image', 'layers', 'clipping') THEN 'image'
    WHEN type IN ('video', 'cinema', 'lipsync', 'recast', 'motion-control', 'v2v', 'i2v', 't2v') THEN 'video'
    WHEN type = 'audio' THEN 'audio'
    ELSE 'other'
  END AS category,
  COALESCE(metadata_json->>'description', name) AS description,
  CASE WHEN is_active THEN 'active' ELSE 'disabled' END AS status,
  sort_order AS sort,
  (sort_order <= 30) AS is_featured,
  COALESCE(metadata_json, '{}'::jsonb) AS capabilities,
  created_at,
  updated_at
FROM ai_studio.models_config
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  updated_at = now();

-- 补充关键 Canonical 标准模型 (kling-2.6, flux-pro, wan-2.1, hailuo-02, gpt-image, imagen-4)
INSERT INTO ai_studio.ai_models
  (id, slug, name, display_name, category, description, status, sort, is_featured, capabilities, supported_resolutions, supported_durations, supported_ratios, created_at, updated_at)
VALUES
  ('kling-2.6', 'kling-2.6', 'Kling 2.6', 'Kling 2.6 (可灵官方/聚合)', 'video', '新一代高画质物理模拟视频生成模型，支持 1080P 超高清输出与动作精确运镜。', 'active', 5, TRUE,
   '{"modes":["t2v","i2v"],"promptRequired":true,"motionControl":true}'::jsonb,
   '["720p","1080p"]'::jsonb, '[5,10]'::jsonb, '["16:9","9:16","1:1"]'::jsonb, now(), now()),
  ('flux-pro', 'flux-pro', 'Flux Pro', 'FLUX.1 Pro (顶级画质)', 'image', 'Black Forest Labs 顶级文生图旗舰模型，极致光影质感与复杂排版表现。', 'active', 1, TRUE,
   '{"modes":["t2i"],"promptRequired":true,"highResolution":true}'::jsonb,
   '["1024x1024","1280x720","720x1280","1920x1080"]'::jsonb, '[]'::jsonb, '["1:1","16:9","9:16","4:3","3:4"]'::jsonb, now(), now()),
  ('wan-2.1', 'wan-2.1', 'Wan 2.1', 'Wan 2.1 (阿里万相)', 'video', '阿里云最新万相 Wan 2.1 视频生成模型，极速推理与优秀影视级画面。', 'active', 6, TRUE,
   '{"modes":["t2v","i2v"],"promptRequired":true}'::jsonb,
   '["720p","1080p"]'::jsonb, '[5,10]'::jsonb, '["16:9","9:16","1:1"]'::jsonb, now(), now()),
  ('hailuo-02', 'hailuo-02', 'Hailuo 02', 'Hailuo 02 (海螺/MiniMax)', 'video', 'MiniMax 海螺视频生成模型，镜头语言生动，影视质感出色。', 'active', 7, TRUE,
   '{"modes":["t2v","i2v"],"promptRequired":true}'::jsonb,
   '["720p","1080p"]'::jsonb, '[6]'::jsonb, '["16:9","9:16"]'::jsonb, now(), now()),
  ('gpt-image', 'gpt-image', 'GPT Image', 'GPT Image (DALL·E 3)', 'image', 'OpenAI 图像创意生成模型，对复杂自然语言与文字提示深度理解。', 'active', 2, TRUE,
   '{"modes":["t2i"],"promptRequired":true}'::jsonb,
   '["1024x1024","1024x1792","1792x1024"]'::jsonb, '[]'::jsonb, '["1:1","16:9","9:16"]'::jsonb, now(), now()),
  ('imagen-4', 'imagen-4', 'Imagen 4', 'Google Imagen 4', 'image', 'Google 最新高保真文生图引擎，色彩纯正逼真，照片级真实渲染。', 'active', 3, TRUE,
   '{"modes":["t2i"],"promptRequired":true}'::jsonb,
   '["1024x1024","1280x720","720x1280"]'::jsonb, '[]'::jsonb, '["1:1","16:9","9:16"]'::jsonb, now(), now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  capabilities = EXCLUDED.capabilities,
  supported_resolutions = EXCLUDED.supported_resolutions,
  supported_durations = EXCLUDED.supported_durations,
  supported_ratios = EXCLUDED.supported_ratios,
  updated_at = now();

-- 为所有模型初始化默认 ProviderModel 映射
-- 1. 回填原有 models_config 的默认映射（大部分通过 MuAPI 聚合调用）
INSERT INTO ai_studio.provider_models
  (id, model_id, provider_id, provider_model_id, enabled, priority, cost_config, timeout, created_at, updated_at)
SELECT
  'pm_' || replace(id, '-', '_') || '_muapi' AS id,
  id AS model_id,
  'muapi' AS provider_id,
  id AS provider_model_id,
  is_active AS enabled,
  100 AS priority,
  jsonb_build_object('currency', 'USD', 'base_cost', cost_usd),
  120000 AS timeout,
  created_at,
  updated_at
FROM ai_studio.models_config
ON CONFLICT (id) DO NOTHING;

-- 2. 为重点模型建立多供应商渠道 (Kling, Flux, Wan, Hailuo, GPT, Imagen)
INSERT INTO ai_studio.provider_models
  (id, model_id, provider_id, provider_model_id, enabled, priority, cost_config, endpoint_config, timeout, created_at, updated_at)
VALUES
  -- Kling 2.6: MuAPI 渠道 + Kling 官方渠道
  ('pm_kling26_muapi', 'kling-2.6', 'muapi', 'kling-v2.6-pro-t2v', TRUE, 100,
   '{"currency":"USD","base_cost":0.60,"cost_per_second":0.06}'::jsonb, '{"endpoint":"kling-v2.6-pro-t2v"}'::jsonb, 150000, now(), now()),
  ('pm_kling26_kling', 'kling-2.6', 'kling', 'kling-video-2-6', TRUE, 90,
   '{"currency":"CNY","base_cost":4.00,"cost_per_second":0.40}'::jsonb, '{"endpoint":"/v1/videos/text2video"}'::jsonb, 150000, now(), now()),

  -- Flux Pro: MuAPI 渠道 + OpenAI / Direct 渠道
  ('pm_fluxpro_muapi', 'flux-pro', 'muapi', 'flux-kontext-pro-t2i', TRUE, 100,
   '{"currency":"USD","base_cost":0.05}'::jsonb, '{"endpoint":"flux-kontext-pro-t2i"}'::jsonb, 60000, now(), now()),
  ('pm_fluxpro_bfl', 'flux-pro', 'openai', 'flux-1.1-pro', TRUE, 85,
   '{"currency":"USD","base_cost":0.04}'::jsonb, '{"endpoint":"/v1/images/generations"}'::jsonb, 60000, now(), now()),

  -- Wan 2.1: MuAPI 渠道 + 阿里云 DashScope 原生直连渠道
  ('pm_wan21_muapi', 'wan-2.1', 'muapi', 'wan2.1-image-to-video', TRUE, 95,
   '{"currency":"USD","base_cost":0.35}'::jsonb, '{"endpoint":"wan2.1-image-to-video"}'::jsonb, 120000, now(), now()),
  ('pm_wan21_aliyun', 'wan-2.1', 'alibaba', 'wanx2.1-t2v-turbo', TRUE, 100,
   '{"currency":"CNY","base_cost":2.50}'::jsonb, '{"endpoint":"/services/aigc/video-generation/video-synthesis"}'::jsonb, 120000, now(), now()),

  -- Hailuo 02: MuAPI 渠道 + MiniMax 官方渠道
  ('pm_hailuo02_muapi', 'hailuo-02', 'muapi', 'minimax-hailuo-2.3-standard-t2v', TRUE, 100,
   '{"currency":"USD","base_cost":0.45}'::jsonb, '{"endpoint":"minimax-hailuo-2.3-standard-t2v"}'::jsonb, 120000, now(), now()),
  ('pm_hailuo02_minimax', 'hailuo-02', 'minimax', 'minimax-video-01', TRUE, 90,
   '{"currency":"CNY","base_cost":3.00}'::jsonb, '{"endpoint":"/v1/video_generation"}'::jsonb, 120000, now(), now()),

  -- GPT Image: OpenAI 官方渠道 + MuAPI 渠道
  ('pm_gptimage_openai', 'gpt-image', 'openai', 'dall-e-3', TRUE, 100,
   '{"currency":"USD","base_cost":0.04}'::jsonb, '{"endpoint":"/v1/images/generations"}'::jsonb, 60000, now(), now()),
  ('pm_gptimage_muapi', 'gpt-image', 'muapi', 'gpt4o-text-to-image', TRUE, 90,
   '{"currency":"USD","base_cost":0.05}'::jsonb, '{"endpoint":"gpt4o-text-to-image"}'::jsonb, 60000, now(), now()),

  -- Imagen 4: Google 官方渠道 + MuAPI 渠道
  ('pm_imagen4_google', 'imagen-4', 'google', 'imagen-3.0-generate-002', TRUE, 100,
   '{"currency":"USD","base_cost":0.03}'::jsonb, '{"endpoint":"/v1beta/models/imagen-3.0"}'::jsonb, 60000, now(), now()),
  ('pm_imagen4_muapi', 'imagen-4', 'muapi', 'nano-banana-pro', TRUE, 90,
   '{"currency":"USD","base_cost":0.04}'::jsonb, '{"endpoint":"nano-banana-pro"}'::jsonb, 60000, now(), now())
ON CONFLICT (id) DO UPDATE SET
  model_id = EXCLUDED.model_id,
  provider_id = EXCLUDED.provider_id,
  provider_model_id = EXCLUDED.provider_model_id,
  cost_config = EXCLUDED.cost_config,
  updated_at = now();

-- 为所有模型初始化定价规则 (model_pricing)
INSERT INTO ai_studio.model_pricing
  (id, model_id, pricing_type, base_credits, formula_config, subscription_discounts, min_credits, min_gross_margin_rate, is_active, created_at, updated_at)
SELECT
  'prc_' || replace(m.id, '-', '_') AS id,
  m.id AS model_id,
  CASE WHEN m.category = 'video' THEN 'formula' ELSE 'fixed' END AS pricing_type,
  CASE
    WHEN m.id = 'kling-2.6' THEN 1000
    WHEN m.id = 'flux-pro' THEN 50
    WHEN m.id = 'wan-2.1' THEN 600
    WHEN m.id = 'hailuo-02' THEN 800
    WHEN m.id = 'gpt-image' THEN 60
    WHEN m.id = 'imagen-4' THEN 40
    WHEN m.category = 'video' THEN 500
    ELSE 30
  END AS base_credits,
  jsonb_build_object(
    'resolution_multipliers', jsonb_build_object('720p', 1.0, '1080p', 1.3, '4K', 2.0, '1024x1024', 1.0, '1920x1080', 1.2),
    'duration_multipliers', jsonb_build_object('5', 1.0, '6', 1.2, '10', 1.8),
    'quality_multipliers', jsonb_build_object('standard', 1.0, 'pro', 1.3, 'master', 1.6)
  ) AS formula_config,
  jsonb_build_object('free', 1.0, 'starter', 0.95, 'basic', 0.90, 'plus', 0.85, 'pro', 0.80, 'team', 0.75) AS subscription_discounts,
  10 AS min_credits,
  0.3500 AS min_gross_margin_rate,
  TRUE AS is_active,
  now(),
  now()
FROM ai_studio.ai_models m
ON CONFLICT (model_id) DO NOTHING;

-- 为所有模型初始化路由策略 (routing_policies，默认智能平衡)
INSERT INTO ai_studio.routing_policies
  (id, model_id, routing_mode, weights, circuit_breaker_config, failover_enabled, created_at, updated_at)
SELECT
  'rp_' || replace(m.id, '-', '_') AS id,
  m.id AS model_id,
  'balanced' AS routing_mode,
  '{"cost":0.4,"success_rate":0.3,"speed":0.2,"capacity":0.1}'::jsonb AS weights,
  '{"failure_threshold":3,"cooling_period_sec":60,"half_open_requests":2}'::jsonb AS circuit_breaker_config,
  TRUE AS failover_enabled,
  now(),
  now()
FROM ai_studio.ai_models m
ON CONFLICT (model_id) DO NOTHING;
