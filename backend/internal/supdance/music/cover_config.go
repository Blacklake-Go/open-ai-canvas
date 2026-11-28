package music

const CoverConfigSettingKey = "plugin.supdance-music-generation.cover"

type CoverConfig struct {
	Enabled        bool     `json:"enabled"`
	DefaultModel   string   `json:"defaultModel"`
	AllowedModels  []string `json:"allowedModels"`
	AllowUpload    bool     `json:"allowUpload"`
	MaxUploadBytes int64    `json:"maxUploadBytes"`
	MaxDimension   int      `json:"maxDimension"`
	PromptTemplate string   `json:"promptTemplate"`
}

type CoverModel struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	Channel           string `json:"channel,omitempty"`
	QuoteMicrocredits int64  `json:"quoteMicrocredits"`
	Estimated         bool   `json:"estimated"`
}

type CoverOptions struct {
	Enabled        bool         `json:"enabled"`
	DefaultModel   string       `json:"defaultModel"`
	Models         []CoverModel `json:"models"`
	AllowUpload    bool         `json:"allowUpload"`
	MaxUploadBytes int64        `json:"maxUploadBytes"`
	MaxDimension   int          `json:"maxDimension"`
}
