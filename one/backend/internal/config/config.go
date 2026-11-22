package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port                       string
	DatabaseURL                string
	RedisURL                   string
	RedisPassword              string
	AgentURL                   string
	AgentToken                 string
	PublicAppURL               string
	AdditionalAllowedOrigin    []string
	CSRFOriginRequired         bool
	IsProduction               bool
	MigrationsDir              string
	CookieDomain               string
	PGMaxConns                 int32
	PGMinConns                 int32
	AuthVerificationCodeSecret string
	OAuthStateSecret           string
	BillingSessionSecret       string
	InviteCodeRequired         bool
	StripeWebhookSecret        string
	StripeSecretKey            string
	AlipayAppID                string
	AlipayPublicKey            string
	AlipayPrivateKey           string
	WechatAppID                string
	WechatMchID                string
	WechatAPIV3Key             string
	WechatPublicKey            string
	WechatPrivateKey           string
	WechatSerialNo             string
	PayPalClientID             string
	PayPalClientSecret         string
	PayPalWebhookID            string
	PayPalMode                 string
	GoogleClientID             string
	// UpstreamAIBase and MuAPIKey are the server-managed MuAPI credentials/base used by the
	// legacy scoped proxies. Client-supplied x-api-key values are never accepted (BYOK gate
	// stays closed), mirroring lib/security/byok.js.
	UpstreamAIBase               string
	MuAPIKey                     string
	IndexNowKey                  string
	ProviderSecretsEncryptionKey string
	StorageSecretsEncryptionKey  string
	AdminSecretKey               string
	StorageLocalRoot             string
	AllowedPrivateHosts          []string
	WorkerDisabled               bool
}

func Load() Config {
	env := strings.ToLower(strings.TrimSpace(firstNonEmpty(os.Getenv("APP_ENV"), os.Getenv("NODE_ENV"))))
	isProd := env == "production"

	csrfRequired := isProd
	if raw := firstNonEmpty(os.Getenv("ONE_CSRF_ORIGIN_REQUIRED"), os.Getenv("CSRF_ORIGIN_REQUIRED")); raw != "" {
		csrfRequired = raw != "false" && raw != "0"
	}

	var extraOrigins []string
	if raw := strings.TrimSpace(os.Getenv("ADDITIONAL_ALLOWED_ORIGINS")); raw != "" {
		for _, part := range strings.Split(raw, ",") {
			if p := strings.TrimSpace(strings.ToLower(part)); p != "" {
				extraOrigins = append(extraOrigins, p)
			}
		}
	}

	return Config{
		Port:                         firstNonEmpty(os.Getenv("PORT"), "8080"),
		DatabaseURL:                  strings.TrimSpace(os.Getenv("DATABASE_URL")),
		RedisURL:                     strings.TrimSpace(os.Getenv("REDIS_URL")),
		RedisPassword:                strings.TrimSpace(os.Getenv("REDIS_PASSWORD")),
		AgentURL:                     firstNonEmpty(os.Getenv("ONE_AGENT_URL"), os.Getenv("AGENT_URL")),
		AgentToken:                   firstNonEmpty(os.Getenv("ONE_AGENT_TOKEN"), os.Getenv("YINGCE_AGENT_TOKEN")),
		PublicAppURL:                 strings.TrimSpace(os.Getenv("PUBLIC_APP_URL")),
		AdditionalAllowedOrigin:      extraOrigins,
		CSRFOriginRequired:           csrfRequired,
		IsProduction:                 isProd,
		MigrationsDir:                firstNonEmpty(os.Getenv("ONE_MIGRATIONS_DIR"), os.Getenv("MIGRATIONS_DIR")),
		CookieDomain:                 firstNonEmpty(os.Getenv("ONE_COOKIE_DOMAIN"), os.Getenv("COOKIE_DOMAIN")),
		PGMaxConns:                   int32(parsePositiveInt(os.Getenv("PG_MAX_CONNECTIONS"), 20)),
		PGMinConns:                   int32(parsePositiveInt(os.Getenv("PG_MIN_CONNECTIONS"), 2)),
		AuthVerificationCodeSecret:   firstNonEmpty(os.Getenv("AUTH_VERIFICATION_CODE_SECRET"), os.Getenv("AUTH_SECRET")),
		OAuthStateSecret:             firstNonEmpty(os.Getenv("OAUTH_STATE_SECRET"), os.Getenv("AUTH_SECRET")),
		BillingSessionSecret:         firstNonEmpty(os.Getenv("BILLING_SESSION_SECRET"), os.Getenv("AUTH_SECRET")),
		InviteCodeRequired:           strings.TrimSpace(os.Getenv("INVITE_CODE_REQUIRED")) != "false",
		StripeWebhookSecret:          strings.TrimSpace(os.Getenv("STRIPE_WEBHOOK_SECRET")),
		StripeSecretKey:              strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY")),
		AlipayAppID:                  strings.TrimSpace(os.Getenv("ALIPAY_APP_ID")),
		AlipayPublicKey:              strings.TrimSpace(os.Getenv("ALIPAY_PUBLIC_KEY")),
		AlipayPrivateKey:             strings.TrimSpace(os.Getenv("ALIPAY_PRIVATE_KEY")),
		WechatAppID:                  strings.TrimSpace(os.Getenv("WECHAT_APP_ID")),
		WechatMchID:                  strings.TrimSpace(os.Getenv("WECHAT_MCH_ID")),
		WechatAPIV3Key:               strings.TrimSpace(os.Getenv("WECHAT_API_V3_KEY")),
		WechatPublicKey:              strings.TrimSpace(os.Getenv("WECHAT_PUBLIC_KEY")),
		WechatPrivateKey:             strings.TrimSpace(os.Getenv("WECHAT_PRIVATE_KEY")),
		WechatSerialNo:               firstNonEmpty(os.Getenv("WECHAT_CERT_SERIAL_NO"), os.Getenv("WECHAT_SERIAL_NO")),
		PayPalClientID:               strings.TrimSpace(os.Getenv("PAYPAL_CLIENT_ID")),
		PayPalClientSecret:           strings.TrimSpace(os.Getenv("PAYPAL_CLIENT_SECRET")),
		PayPalWebhookID:              strings.TrimSpace(os.Getenv("PAYPAL_WEBHOOK_ID")),
		PayPalMode:                   firstNonEmpty(os.Getenv("PAYPAL_MODE"), map[bool]string{true: "live", false: "sandbox"}[isProd]),
		GoogleClientID:               firstNonEmpty(os.Getenv("GOOGLE_CLIENT_ID"), os.Getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID")),
		UpstreamAIBase:               firstNonEmpty(os.Getenv("UPSTREAM_AI_BASE"), "https://api.muapi.ai"),
		MuAPIKey:                     firstNonEmpty(os.Getenv("MUAPI_API_KEY"), os.Getenv("MUAPI_KEY")),
		IndexNowKey:                  os.Getenv("INDEXNOW_KEY"),
		ProviderSecretsEncryptionKey: strings.TrimSpace(os.Getenv("PROVIDER_SECRETS_ENCRYPTION_KEY")),
		StorageSecretsEncryptionKey:  strings.TrimSpace(os.Getenv("STORAGE_SECRETS_ENCRYPTION_KEY")),
		AdminSecretKey:               strings.TrimSpace(os.Getenv("ADMIN_SECRET_KEY")),
		StorageLocalRoot:             strings.TrimSpace(os.Getenv("ONE_STORAGE_LOCAL_ROOT")),
		AllowedPrivateHosts:          parseCSVList(os.Getenv("ALLOWED_PRIVATE_UPSTREAM_HOSTS")),
		WorkerDisabled:               strings.EqualFold(firstNonEmpty(os.Getenv("ONE_WORKER_DISABLED"), os.Getenv("WORKER_DISABLED")), "true") || firstNonEmpty(os.Getenv("ONE_WORKER_DISABLED"), os.Getenv("WORKER_DISABLED")) == "1",
	}
}

func (c Config) ProviderSecretKey() string {
	return firstNonEmpty(c.ProviderSecretsEncryptionKey, c.AdminSecretKey, c.BillingSessionSecret, c.OAuthStateSecret)
}

func (c Config) StorageSecretKey() string {
	return firstNonEmpty(c.StorageSecretsEncryptionKey, c.ProviderSecretsEncryptionKey, c.AdminSecretKey, c.AuthVerificationCodeSecret, c.BillingSessionSecret, c.OAuthStateSecret)
}

func parseCSVList(raw string) []string {
	var out []string
	for _, part := range strings.Split(raw, ",") {
		if t := strings.TrimSpace(strings.ToLower(part)); t != "" {
			out = append(out, t)
		}
	}
	return out
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if trimmed := strings.TrimSpace(v); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func parsePositiveInt(raw string, fallback int) int {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}
