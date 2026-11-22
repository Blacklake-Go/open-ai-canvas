-- 058_seo_and_search_engine_push.sql
-- 搜索引擎主动推送历史日志表与 SEO 基础架构

CREATE TABLE IF NOT EXISTS ops_bill.seo_push_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engine TEXT NOT NULL,
  urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  urls_json JSONB,
  url_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  status_code INTEGER,
  response_body JSONB,
  error_message TEXT,
  latency_ms INTEGER,
  created_by TEXT,
  actor_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seo_push_logs_created_at_idx
  ON ops_bill.seo_push_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS seo_push_logs_engine_idx
  ON ops_bill.seo_push_logs (engine, created_at DESC);

CREATE INDEX IF NOT EXISTS seo_push_logs_status_idx
  ON ops_bill.seo_push_logs (status, created_at DESC);
