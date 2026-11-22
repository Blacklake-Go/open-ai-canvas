package ai

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"one/backend/internal/config"
	"one/backend/internal/pkg/seckey"
)

type providerCredConfig struct {
	envNames   []string
	secretName string
}

// Exact mapping from Supdance Pro/lib/services/providerSecrets.js.
var providerEnvKeys = map[string]providerCredConfig{
	"muapi":      {envNames: []string{"MUAPI_API_KEY", "MUAPI_KEY"}, secretName: "api_key"},
	"aliyun":     {envNames: []string{"DASHSCOPE_API_KEY", "ALIYUN_API_KEY", "BAILIAN_API_KEY"}, secretName: "api_key"},
	"dashscope":  {envNames: []string{"DASHSCOPE_API_KEY", "ALIYUN_API_KEY", "BAILIAN_API_KEY"}, secretName: "api_key"},
	"alibaba":    {envNames: []string{"DASHSCOPE_API_KEY", "ALIYUN_API_KEY", "BAILIAN_API_KEY"}, secretName: "api_key"},
	"minimax":    {envNames: []string{"MINIMAX_API_KEY", "MINIMAX_KEY"}, secretName: "api_key"},
	"kling":      {envNames: []string{"KLING_API_KEY", "KLING_KEY", "KLING_ACCESS_KEY"}, secretName: "api_key"},
	"openai":     {envNames: []string{"OPENAI_API_KEY", "OPENAI_KEY"}, secretName: "api_key"},
	"volcengine": {envNames: []string{"VOLCENGINE_API_KEY", "ARK_API_KEY", "VOLC_API_KEY"}, secretName: "api_key"},
	"byteplus":   {envNames: []string{"BYTEPLUS_API_KEY", "BYTEPLUS_ARK_API_KEY"}, secretName: "api_key"},
	"runninghub": {envNames: []string{"RUNNINGHUB_API_KEY", "RUNNING_HUB_API_KEY", "RUNNINGHUB_KEY"}, secretName: "api_key"},
	"google":     {envNames: []string{"GEMINI_API_KEY", "GOOGLE_API_KEY"}, secretName: "api_key"},
	"runway":     {envNames: []string{"RUNWAY_API_KEY"}, secretName: "api_key"},
	"luma":       {envNames: []string{"LUMA_API_KEY"}, secretName: "api_key"},
	"deepseek":   {envNames: []string{"DEEPSEEK_API_KEY", "DEEPSEEK_KEY"}, secretName: "api_key"},
}

// CredentialResolution reports resolved API key metadata without exposing secrets via JSON.
type CredentialResolution struct {
	Value       string `json:"-"`
	Source      string `json:"source,omitempty"` // environment | encrypted_database
	Status      string `json:"status"`           // configured | missing | error
	SelectedEnv string `json:"selectedEnvironment,omitempty"`
	SecretName  string `json:"secretName,omitempty"`
}

// ResolveCredentials reads env vars first (with MuAPI dual-key support via system_settings)
// and falls back to ops_bill.provider_secrets encrypted rows.
func ResolveCredentials(ctx context.Context, pool *pgxpool.Pool, cfg config.Config, providerID string) CredentialResolution {
	norm := strings.ToLower(strings.TrimSpace(providerID))
	if norm == "" {
		norm = "muapi"
	}
	spec, ok := providerEnvKeys[norm]
	if !ok {
		spec = providerCredConfig{envNames: []string{strings.ToUpper(norm) + "_API_KEY"}, secretName: "api_key"}
	}

	// MuAPI env vars via config or process environment.
	for _, envName := range spec.envNames {
		if val := strings.TrimSpace(os.Getenv(envName)); val != "" {
			return CredentialResolution{Value: val, Source: "environment", Status: "configured"}
		}
	}
	if norm == "muapi" && strings.TrimSpace(cfg.MuAPIKey) != "" {
		return CredentialResolution{Value: strings.TrimSpace(cfg.MuAPIKey), Source: "environment", Status: "configured"}
	}

	if pool == nil {
		return CredentialResolution{Status: "missing"}
	}

	secretName := spec.secretName
	selectedEnv := ""
	if norm == "muapi" {
		selectedEnv = "production"
		var rawSetting []byte
		if err := pool.QueryRow(ctx, `SELECT value FROM ops_bill.system_settings WHERE key = 'provider_active_env'`).Scan(&rawSetting); err == nil {
			var m map[string]any
			if json.Unmarshal(rawSetting, &m) == nil {
				if envVal, _ := m["muapi"].(string); strings.EqualFold(strings.TrimSpace(envVal), "sandbox") {
					secretName = "api_key_sandbox"
					selectedEnv = "sandbox"
				}
			}
		}
	}

	encKey := cfg.ProviderSecretKey()
	if encKey == "" {
		return CredentialResolution{Status: "missing", SelectedEnv: selectedEnv, SecretName: secretName}
	}

	candidates := []string{norm}
	switch norm {
	case "dashscope", "aliyun":
		candidates = append(candidates, "alibaba")
	case "ark", "bytedance":
		candidates = append(candidates, "volcengine")
	}

	for _, cand := range candidates {
		val, err := seckey.ReadProviderSecret(ctx, pool.QueryRow, encKey, cand, secretName)
		if err == nil && strings.TrimSpace(val) != "" {
			return CredentialResolution{
				Value:       strings.TrimSpace(val),
				Source:      "encrypted_database",
				Status:      "configured",
				SelectedEnv: selectedEnv,
				SecretName:  secretName,
			}
		}
		if err != nil && !errors.Is(err, seckey.ErrSecretMissing) && !errors.Is(err, pgx.ErrNoRows) {
			return CredentialResolution{Status: "error", SelectedEnv: selectedEnv, SecretName: secretName}
		}
	}

	return CredentialResolution{Status: "missing", SelectedEnv: selectedEnv, SecretName: secretName}
}

// NewAdapter constructs the canonical ProviderAdapter for providerID.
func NewAdapter(providerID, baseURL, apiKey string, cfg map[string]any, allowedPrivateHosts []string) ProviderAdapter {
	norm := strings.ToLower(strings.TrimSpace(providerID))
	switch norm {
	case "muapi":
		return NewMuAPIAdapter(baseURL, apiKey, cfg, allowedPrivateHosts)
	case "volcengine", "ark", "bytedance":
		return NewVolcengineAdapter(baseURL, apiKey, cfg, allowedPrivateHosts)
	case "byteplus":
		return NewBytePlusAdapter(baseURL, apiKey, cfg, allowedPrivateHosts)
	case "runninghub":
		return NewRunningHubAdapter(baseURL, apiKey, cfg, allowedPrivateHosts)
	case "alibaba", "aliyun", "dashscope":
		return NewAlibabaAdapter(baseURL, apiKey, cfg, allowedPrivateHosts)
	case "google", "gemini":
		return NewGoogleAdapter(baseURL, apiKey, cfg, allowedPrivateHosts)
	case "kling":
		return NewKlingAdapter(baseURL, apiKey, cfg, allowedPrivateHosts)
	case "runway":
		return NewRunwayAdapter(baseURL, apiKey, cfg, allowedPrivateHosts)
	case "luma":
		return NewLumaAdapter(baseURL, apiKey, cfg, allowedPrivateHosts)
	case "minimax":
		return NewMiniMaxAdapter(baseURL, apiKey, cfg, allowedPrivateHosts)
	case "deepseek":
		return NewDeepSeekAdapter(baseURL, apiKey, cfg, allowedPrivateHosts)
	default:
		return NewOpenAIAdapter(norm, baseURL, apiKey, cfg, allowedPrivateHosts)
	}
}

// ResolveAndBuild looks up ai_studio.ai_providers base_url/config and credentials, returning an adapter.
func ResolveAndBuild(ctx context.Context, pool *pgxpool.Pool, cfg config.Config, providerID, baseURLOverride string) (ProviderAdapter, CredentialResolution) {
	cred := ResolveCredentials(ctx, pool, cfg, providerID)
	baseURL := strings.TrimSpace(baseURLOverride)
	var pCfg map[string]any
	if pool != nil && baseURL == "" {
		var dbBase string
		var cfgRaw []byte
		if err := pool.QueryRow(ctx, `SELECT COALESCE(base_url,''), COALESCE(config,'{}'::jsonb) FROM ai_studio.ai_providers WHERE id = $1`, providerID).Scan(&dbBase, &cfgRaw); err == nil {
			baseURL = strings.TrimSpace(dbBase)
			if len(cfgRaw) > 0 {
				_ = json.Unmarshal(cfgRaw, &pCfg)
			}
		}
	}
	if baseURL == "" && strings.EqualFold(providerID, "muapi") {
		baseURL = cfg.UpstreamAIBase
	}
	return NewAdapter(providerID, baseURL, cred.Value, pCfg, cfg.AllowedPrivateHosts), cred
}
