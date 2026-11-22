-- 071_provider_balance_api_capabilities.sql
-- 依据 2026-10-18 对 12 个渠道余额端点的只读实测，登记「可机器查询余额」的渠道，
-- 并把不支持的渠道原因写清楚，后台供应商卡片据此显示「余额」或「API 不支持」。

UPDATE ai_studio.ai_providers SET
  account_balance_api_supported = TRUE,
  account_balance_api_url = 'https://www.runninghub.ai/uc/openapi/accountStatus',
  account_balance_api_reason = '官方 POST /uc/openapi/accountStatus 返回钱包余额 remainMoney 与 RH 币 remainCoins（2026-10-18 实测 HTTP 200）。',
  updated_at = now()
WHERE id = 'runninghub';

UPDATE ai_studio.ai_providers SET
  account_balance_api_supported = TRUE,
  account_balance_api_url = 'https://api.deepseek.com/user/balance',
  account_balance_api_reason = '官方 GET /user/balance 返回 total_balance（端点实测存在；当前环境未配置 DEEPSEEK_API_KEY，配置后即可抓取）。',
  updated_at = now()
WHERE id = 'deepseek';

UPDATE ai_studio.ai_providers SET
  account_balance_api_supported = TRUE,
  account_balance_api_url = 'https://api.muapi.ai/api/v1/account/balance',
  account_balance_api_reason = '官方 GET /api/v1/account/balance 返回积分余额（端点实测存在，未带凭据返回 403；当前渠道已禁用且未配置密钥）。',
  updated_at = now()
WHERE id = 'muapi';

UPDATE ai_studio.ai_providers SET
  account_balance_api_supported = FALSE,
  account_balance_api_url = NULL,
  account_balance_api_reason = '火山方舟 Ark 未提供余额接口（GET /api/v3/balance、/api/v3/user/balance 均 404，2026-10-18 实测）；账户余额需用火山引擎 AK/SK 签名调账单 OpenAPI，Ark API Key 无权限。',
  updated_at = now()
WHERE id = 'volcengine';

UPDATE ai_studio.ai_providers SET
  account_balance_api_supported = FALSE,
  account_balance_api_url = NULL,
  account_balance_api_reason = 'BytePlus Ark 未提供余额接口（GET /api/v3/balance 返回 404，2026-10-18 实测）；余额需在 BytePlus 控制台人工查看。另：当前 ARK_API_KEY 被上游拒绝（The API key doesn''t exist），需更换密钥。',
  updated_at = now()
WHERE id = 'byteplus';

UPDATE ai_studio.ai_providers SET
  account_balance_api_supported = FALSE,
  account_balance_api_url = NULL,
  account_balance_api_reason = '可灵账户接口 GET /account/resource-pack、/account/costs 存在，但要求 AK/SK 签发的三段式 JWT；本渠道为 Bearer Key，2026-10-18 实测返回 401（The token was expected to have 3 parts）。补齐 AK/SK 后可接入。',
  updated_at = now()
WHERE id = 'kling';

UPDATE ai_studio.ai_providers SET
  account_balance_api_supported = FALSE,
  account_balance_api_url = NULL,
  account_balance_api_reason = 'MiniMax 开放平台未提供余额查询 API（/v1/user/balance、/v1/account/balance、/v1/query/balance 均 404，2026-10-18 实测）；余额需在 MiniMax 控制台人工查看。',
  updated_at = now()
WHERE id = 'minimax';

UPDATE ai_studio.ai_providers SET
  account_balance_api_supported = FALSE,
  account_balance_api_url = NULL,
  account_balance_api_reason = '阿里云百炼未提供 API Key 级余额接口（GET /api/v1/balance、/api/v1/usage 均 404，2026-10-18 实测）；余额需用阿里云 AK/SK 调 BSS QueryAccountBalance。',
  updated_at = now()
WHERE id = 'alibaba';

UPDATE ai_studio.ai_providers SET
  account_balance_api_supported = FALSE,
  account_balance_api_url = NULL,
  account_balance_api_reason = 'OpenAI 未提供密钥级余额接口：/dashboard/billing/* 已下线，组织费用需 Admin Key 调 GET /v1/organization/costs（2026-10-18 实测）。',
  updated_at = now()
WHERE id = 'openai';

UPDATE ai_studio.ai_providers SET
  account_balance_api_supported = FALSE,
  account_balance_api_url = NULL,
  account_balance_api_reason = 'Gemini API 无余额接口；费用归属 Google Cloud Billing，需服务账号调 Cloud Billing API，API Key 无法查询。',
  updated_at = now()
WHERE id = 'google';

UPDATE ai_studio.ai_providers SET
  account_balance_api_supported = FALSE,
  account_balance_api_url = NULL,
  account_balance_api_reason = 'Luma 未提供余额查询 API（GET /v1/account 返回 404，2026-10-18 实测）；余额需在 Luma 控制台人工查看。',
  updated_at = now()
WHERE id = 'luma';

UPDATE ai_studio.ai_providers SET
  account_balance_api_supported = FALSE,
  account_balance_api_url = NULL,
  account_balance_api_reason = 'Runway 未提供余额查询 API（无账户/账单端点，2026-10-18 实测）；余额需在 Runway 控制台人工查看。',
  updated_at = now()
WHERE id = 'runway';
