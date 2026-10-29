package music

import (
	"time"
)

const (
	// ConfigSettingKey is the system_settings key storing the encrypted music plugin config.
	ConfigSettingKey = "supdance_music_config"
)

// StoredMusicConfig represents the encrypted configuration persisted in system_settings.
type StoredMusicConfig struct {
	// APIKeyCipher stores the AES-256-GCM encrypted API key with "enc:v1:" prefix.
	APIKeyCipher string `json:"apiKeyCipher"`

	// WebhookSecretCipher stores the AES-256-GCM encrypted webhook secret (optional).
	WebhookSecretCipher string `json:"webhookSecretCipher,omitempty"`

	// DefaultModel represents the platform-wide default model ID (e.g. "suno-v6").
	DefaultModel string `json:"defaultModel,omitempty"`

	// ModelPricing maps model ID to its billing price configuration.
	ModelPricing map[string]ModelPricingConfig `json:"modelPricing,omitempty"`

	// UpdatedAt records the last modification time.
	UpdatedAt time.Time `json:"updatedAt"`

	// UpdatedBy records the user ID who performed the update.
	UpdatedBy string `json:"updatedBy,omitempty"`
}

// ModelPricingConfig defines pricing and availability for a specific model.
type ModelPricingConfig struct {
	Enabled                   bool  `json:"enabled"`
	CostPerSecondMicrocredits int64 `json:"costPerSecondMicrocredits"`
}

// AdminMusicConfigView is the safe public view exposed to Admin UI.
type AdminMusicConfigView struct {
	// BaseURL is strictly immutable and hardcoded to "https://www.koyosim.com".
	BaseURL string `json:"baseUrl"`

	// HasAPIKey indicates whether an API key has been configured.
	HasAPIKey bool `json:"hasApiKey"`

	// MaskedAPIKey masks the key as "koyo_****abcd" for safe viewing in UI.
	MaskedAPIKey string `json:"maskedApiKey"`

	// HasWebhookSecret indicates whether a webhook secret is configured.
	HasWebhookSecret bool `json:"hasWebhookSecret"`

	// DefaultModel is the selected default model.
	DefaultModel string `json:"defaultModel"`

	// ModelPricing contains pricing rules per model.
	ModelPricing map[string]ModelPricingConfig `json:"modelPricing,omitempty"`

	// UpdatedAt is the last updated timestamp.
	UpdatedAt time.Time `json:"updatedAt"`

	// UpdatedBy is the administrator who modified the config.
	UpdatedBy string `json:"updatedBy,omitempty"`
}

// UpdateMusicConfigRequest represents the admin request payload.
type UpdateMusicConfigRequest struct {
	// BaseURL if supplied must equal "https://www.koyosim.com" or the request is rejected.
	BaseURL string `json:"baseUrl,omitempty"`

	// APIKey updates the secret key if non-empty and not masked.
	APIKey string `json:"apiKey,omitempty"`

	// WebhookSecret updates the webhook secret if provided.
	WebhookSecret string `json:"webhookSecret,omitempty"`

	// DefaultModel updates default model choice.
	DefaultModel string `json:"defaultModel,omitempty"`

	// ModelPricing updates model pricing rules.
	ModelPricing map[string]ModelPricingConfig `json:"modelPricing,omitempty"`
}
