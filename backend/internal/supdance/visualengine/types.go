package visualengine

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
)

const (
	PluginID                = "supdance-visual-engine"
	ConfigSettingKey        = "supdance_visual_engine_config"
	SnapshotsSettingKey     = "supdance_visual_engine_snapshots"
	DefaultPublishedVersion = "2.0.0"
)

type SemanticTokens struct {
	Canvas             string `json:"canvas"`
	Surface            string `json:"surface"`
	SurfaceSubtle      string `json:"surfaceSubtle"`
	SurfaceRaised      string `json:"surfaceRaised"`
	Overlay            string `json:"overlay"`
	Text               string `json:"text"`
	TextMuted          string `json:"textMuted"`
	Border             string `json:"border"`
	Control            string `json:"control"`
	ControlHover       string `json:"controlHover"`
	ControlActive      string `json:"controlActive"`
	ControlBorder      string `json:"controlBorder"`
	ControlFocus       string `json:"controlFocus"`
	Primary            string `json:"primary"`
	PrimaryHover       string `json:"primaryHover"`
	PrimaryActive      string `json:"primaryActive"`
	PrimaryForeground  string `json:"primaryForeground"`
	Selected           string `json:"selected"`
	SelectedHover      string `json:"selectedHover"`
	SelectedActive     string `json:"selectedActive"`
	SelectedForeground string `json:"selectedForeground"`
	Danger             string `json:"danger"`
	DangerHover        string `json:"dangerHover"`
	DangerActive       string `json:"dangerActive"`
	DangerForeground   string `json:"dangerForeground"`
	Success            string `json:"success"`
	Warning            string `json:"warning"`
	Info               string `json:"info"`
}

type ComponentTokens struct {
	ButtonHeightRegular int `json:"buttonHeightRegular"`
	ButtonHeightCompact int `json:"buttonHeightCompact"`
	ButtonHeightMicro   int `json:"buttonHeightMicro"`
	ButtonRadius        int `json:"buttonRadius"`
	InputHeight         int `json:"inputHeight"`
	InputRadius         int `json:"inputRadius"`
	CardRadius          int `json:"cardRadius"`
	OverlayRadius       int `json:"overlayRadius"`
	MenuRadius          int `json:"menuRadius"`
	TagRadius           int `json:"tagRadius"`
}

type ElevationToken struct {
	Level       string `json:"level"`
	Label       string `json:"label"`
	Usage       string `json:"usage"`
	ShadowLight string `json:"shadowLight"`
	ShadowDark  string `json:"shadowDark"`
	BlurRadius  int    `json:"blurRadius"`
}

type OverlaysConfig struct {
	ImageGradientOpacity         *float64 `json:"imageGradientOpacity,omitempty"`
	ScrollEdgeOpacity            *float64 `json:"scrollEdgeOpacity,omitempty"`
	BusyOpacity                  *float64 `json:"busyOpacity,omitempty"`
	ModalBackdropBlur            int      `json:"modalBackdropBlur"`
	ModalBackdropOpacity         float64  `json:"modalBackdropOpacity"`
	DrawerBackdropBlur           int      `json:"drawerBackdropBlur"`
	DrawerBackdropOpacity        float64  `json:"drawerBackdropOpacity"`
	MenuBackdropBlur             int      `json:"menuBackdropBlur"`
	EnableTextProtectionGradient bool     `json:"enableTextProtectionGradient"`
}

type MotionConfig struct {
	Enabled               bool   `json:"enabled"`
	DurationQuick         int    `json:"durationQuick"`
	DurationDropdownEnter int    `json:"durationDropdownEnter"`
	DurationDropdownExit  int    `json:"durationDropdownExit"`
	DurationModal         int    `json:"durationModal"`
	DurationDrawer        int    `json:"durationDrawer"`
	DurationTabSwitch     int    `json:"durationTabSwitch"`
	EasingStandard        string `json:"easingStandard"`
	EasingBounce          string `json:"easingBounce"`
	EasingSmooth          string `json:"easingSmooth"`
	ReducedMotionBehavior string `json:"reducedMotionBehavior"`
}

type WorkspaceRecoveryConfig struct {
	BackgroundLight    string            `json:"backgroundLight"`
	BackgroundDark     string            `json:"backgroundDark"`
	AnimationSpeed     float64           `json:"animationSpeed"`
	ExitEffect         string            `json:"exitEffect"`
	Paths              []string          `json:"paths"`
	TimeoutFeedback    string            `json:"timeoutFeedback"`
	Enabled            bool              `json:"enabled"`
	ThemeMode          string            `json:"themeMode"`
	BrandLogoURL       string            `json:"brandLogoUrl"`
	BrandName          string            `json:"brandName"`
	OrbitSpeed         float64           `json:"orbitSpeed"`
	OrbitNodesCount    int               `json:"orbitNodesCount"`
	FloatingCardsCount int               `json:"floatingCardsCount"`
	GlowIntensity      float64           `json:"glowIntensity"`
	GridDensity        string            `json:"gridDensity"`
	TimeoutMs          int               `json:"timeoutMs"`
	StatusCopies       map[string]string `json:"statusCopies"`
	StageDetails       map[string]string `json:"stageDetails"`
}

type PageRule struct {
	Components              *ComponentTokens          `json:"components,omitempty"`
	Overlays                *OverlaysConfig           `json:"overlays,omitempty"`
	Elevations              map[string]ElevationToken `json:"elevations,omitempty"`
	PerformanceMode         string                    `json:"performanceMode,omitempty"`
	CustomTokens            map[string]string         `json:"customTokens,omitempty"`
	ID                      string                    `json:"id"`
	Name                    string                    `json:"name"`
	PathPattern             string                    `json:"pathPattern"`
	ThemePresetOverride     string                    `json:"themePresetOverride,omitempty"`
	MotionEnabledOverride   *bool                     `json:"motionEnabledOverride,omitempty"`
	RecoveryEnabledOverride *bool                     `json:"recoveryEnabledOverride,omitempty"`
	Notes                   string                    `json:"notes,omitempty"`
}

type Config struct {
	Typography        *TypographyConfig         `json:"typography"`
	Interactions      *InteractionConfig        `json:"interactions"`
	Transitions       *TransitionConfig         `json:"transitions"`
	CustomPresets     []ThemePreset             `json:"customPresets"`
	SchemaVersion     int                       `json:"schemaVersion"`
	ActivePreset      string                    `json:"activePreset"`
	ThemeMode         string                    `json:"themeMode"`
	Tokens            map[string]SemanticTokens `json:"tokens"`
	Components        ComponentTokens           `json:"components"`
	Elevations        map[string]ElevationToken `json:"elevations"`
	Overlays          OverlaysConfig            `json:"overlays"`
	Motion            MotionConfig              `json:"motion"`
	WorkspaceRecovery WorkspaceRecoveryConfig   `json:"workspaceRecovery"`
	PageRules         []PageRule                `json:"pageRules"`
	PublishedVersion  string                    `json:"publishedVersion"`
	UpdatedAt         string                    `json:"updatedAt"`
	UpdatedBy         string                    `json:"updatedBy"`
}

type Snapshot struct {
	Action    string `json:"action,omitempty"`
	Version   string `json:"version"`
	Timestamp string `json:"timestamp"`
	Actor     string `json:"actor"`
	Summary   string `json:"summary"`
	Config    Config `json:"config"`
}

type PublicBundle struct {
	Installation LifecycleState `json:"installation"`
	PluginID     string         `json:"pluginId"`
	Enabled      bool           `json:"enabled"`
	Version      string         `json:"version"`
	Config       Config         `json:"config"`
	Revision     string         `json:"revision"`
}

type AdminOverview struct {
	Permissions []string        `json:"permissions"`
	Draft       *Config         `json:"draft"`
	AuditLogs   []AuditLogEntry `json:"auditLogs"`
	Bundle      PublicBundle    `json:"bundle"`
	Snapshots   []Snapshot      `json:"snapshots"`
	CanPublish  bool            `json:"canPublish"`
	CanRollback bool            `json:"canRollback"`
}

type AuditLogEntry struct {
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Actor     string `json:"actor"`
	Module    string `json:"module"`
	Action    string `json:"action"`
	Details   string `json:"details"`
	Version   string `json:"version"`
	Success   bool   `json:"success"`
}

func ComputeRevision(cfg Config, enabled bool, states ...LifecycleState) string {
	var state *LifecycleState
	if len(states) > 0 {
		state = &states[0]
	}
	raw, _ := json.Marshal(struct {
		Config       Config          `json:"config"`
		Enabled      bool            `json:"enabled"`
		Installation *LifecycleState `json:"installation,omitempty"`
	}{Config: cfg, Enabled: enabled, Installation: state})
	h := sha256.Sum256(raw)
	return hex.EncodeToString(h[:8])
}
