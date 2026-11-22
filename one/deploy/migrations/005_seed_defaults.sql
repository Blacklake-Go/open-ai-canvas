-- Idempotent application seeds and legacy-compatible backfill.
INSERT INTO ops_bill.plans_config (id, name, monthly_cny, monthly_usd, features_json, display_order, enabled, updated_at)
VALUES
  ('free', 'BYOK 基础', 0, 0, '["保留自有 API Key（BYOK）", "基础图片工作流", "本地浏览器密钥存储"]'::jsonb, 1, TRUE, now()),
  ('pro', 'BYOK 专业版', 29, 5, '["包含 BYOK 基础能力", "高级图片/视频/音频工具", "工作流与 Agent 权限", "优先额度与订阅管理"]'::jsonb, 2, TRUE, now()),
  ('team', '团队版', 99, 19, '["包含专业版能力", "团队席位与共享工作流", "商业使用支持与审计入口"]'::jsonb, 3, TRUE, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO ops_bill.system_settings (key, value_json, visibility, version, updated_by, updated_at)
VALUES
  ('site_banner', '{"enabled":false,"message":"欢迎使用 SupDance AI Studio","tone":"info","dismissible":true}'::jsonb, 'public', 1, 'system', now()),
  ('registration_enabled', '{"enabled":true,"allow_oauth":true}'::jsonb, 'public', 1, 'system', now()),
  ('maintenance_mode', '{"enabled":false,"message":"系统维护中，请稍后访问"}'::jsonb, 'public', 1, 'system', now()),
  ('model_presets', '{"default_image_model":"nano-banana-pro","default_video_model":"minimax-video-01"}'::jsonb, 'public', 1, 'system', now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO auth_usr.auth_accounts (id, user_id, provider, provider_user_id, provider_email, password_hash, password_salt, created_at, updated_at)
SELECT 'acc_em_' || md5(id), id, 'email', email, email, password_hash, password_salt, COALESCE(created_at, now()), COALESCE(updated_at, now())
FROM auth_usr.users WHERE email IS NOT NULL
ON CONFLICT (provider, provider_user_id) DO NOTHING;

INSERT INTO ops_bill.currency_wallets (user_id, updated_at, created_at)
SELECT id, now(), COALESCE(created_at, now()) FROM auth_usr.users
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO ops_bill.credit_wallets (user_id, perpetual_credits, updated_at, created_at)
SELECT id, credits, now(), COALESCE(created_at, now()) FROM auth_usr.users
ON CONFLICT (user_id) DO NOTHING;
