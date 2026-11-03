package visualengine

import "fmt"

type TypeScale struct {
	Size       int `json:"size"`
	LineHeight int `json:"lineHeight"`
	Weight     int `json:"weight"`
}
type TypographyConfig struct {
	FontFamilySans string               `json:"fontFamilySans"`
	FontFamilyMono string               `json:"fontFamilyMono"`
	SpacingUnit    int                  `json:"spacingUnit"`
	Scales         map[string]TypeScale `json:"scales"`
}
type InteractionConfig struct {
	FocusWidth      int     `json:"focusWidth"`
	FocusOffset     int     `json:"focusOffset"`
	HoverLift       float64 `json:"hoverLift"`
	PressedScale    float64 `json:"pressedScale"`
	DisabledOpacity float64 `json:"disabledOpacity"`
	SwitchOnLight   string  `json:"switchOnLight"`
	SwitchOnDark    string  `json:"switchOnDark"`
	CheckboxLight   string  `json:"checkboxLight"`
	CheckboxDark    string  `json:"checkboxDark"`
	PerformanceMode string  `json:"performanceMode"`
}
type TransitionConfig struct {
	Enabled    bool     `json:"enabled"`
	Preset     string   `json:"preset"`
	Duration   int      `json:"duration"`
	Delay      int      `json:"delay"`
	Distance   int      `json:"distance"`
	Scale      float64  `json:"scale"`
	Opacity    float64  `json:"opacity"`
	Direction  string   `json:"direction"`
	Paths      []string `json:"paths"`
	Components []string `json:"components"`
}
type ThemePreset struct {
	ID          string                    `json:"id"`
	Name        string                    `json:"name"`
	Description string                    `json:"description"`
	IsSystem    bool                      `json:"isSystem"`
	Author      string                    `json:"author"`
	Tokens      map[string]SemanticTokens `json:"tokens"`
	Components  ComponentTokens           `json:"components"`
	Motion      *MotionConfig             `json:"motion,omitempty"`
}

func DefaultTypography() *TypographyConfig {
	return &TypographyConfig{FontFamilySans: "system", FontFamilyMono: "system", SpacingUnit: 4, Scales: map[string]TypeScale{
		"label": {11, 16, 500}, "caption": {12, 18, 400}, "ui": {13, 20, 500}, "body": {14, 22, 400}, "heading": {16, 24, 600}, "title": {22, 30, 700}, "display": {32, 40, 700},
	}}
}
func DefaultInteractions() *InteractionConfig {
	return &InteractionConfig{FocusWidth: 2, FocusOffset: 3, PressedScale: 0.98, DisabledOpacity: 0.45, SwitchOnLight: "#15803d", SwitchOnDark: "#22c55e", CheckboxLight: "#18181b", CheckboxDark: "#f4f4f5", PerformanceMode: "auto"}
}
func DefaultTransitions() *TransitionConfig {
	return &TransitionConfig{Enabled: true, Preset: "fade", Duration: 150, Distance: 8, Scale: 0.98, Direction: "forward", Paths: []string{"/*"}, Components: []string{"page"}}
}
func floatPointer(value float64) *float64 { return &value }
func MigrateConfig(config Config) Config {
	recovery := &config.WorkspaceRecovery
	if recovery.BackgroundLight == "" {
		recovery.BackgroundLight = "#f4f4f5"
	}
	if recovery.BackgroundDark == "" {
		recovery.BackgroundDark = "#07080b"
	}
	if recovery.AnimationSpeed == 0 {
		recovery.AnimationSpeed = 1
	}
	if recovery.ExitEffect == "" {
		recovery.ExitEffect = "fade"
	}
	if recovery.Paths == nil {
		recovery.Paths = []string{"/*"}
	}
	if recovery.TimeoutFeedback == "" {
		recovery.TimeoutFeedback = "retry"
	}
	if config.Overlays.ImageGradientOpacity == nil {
		config.Overlays.ImageGradientOpacity = floatPointer(0.85)
	}
	if config.Overlays.ScrollEdgeOpacity == nil {
		config.Overlays.ScrollEdgeOpacity = floatPointer(0.8)
	}
	if config.Overlays.BusyOpacity == nil {
		config.Overlays.BusyOpacity = floatPointer(0.65)
	}
	if config.Typography == nil {
		config.Typography = DefaultTypography()
	}
	if config.Interactions == nil {
		config.Interactions = DefaultInteractions()
	}
	if config.Transitions == nil {
		config.Transitions = DefaultTransitions()
	}
	if config.CustomPresets == nil {
		config.CustomPresets = []ThemePreset{}
	}
	return config
}
func validateExtendedConfig(config Config) error {
	recovery := config.WorkspaceRecovery
	if (recovery.ThemeMode != "light" && recovery.ThemeMode != "dark") || (recovery.GridDensity != "compact" && recovery.GridDensity != "normal" && recovery.GridDensity != "sparse") || len(recovery.BrandName) == 0 || len(recovery.BrandName) > 360 {
		return fmt.Errorf("恢复动画主题或品牌无效")
	}
	for _, key := range []string{"init", "recovering", "syncing", "ready", "failed"} {
		if text := recovery.StatusCopies[key]; len(text) == 0 || len(text) > 2400 {
			return fmt.Errorf("恢复动画状态文案无效")
		}
	}
	for _, key := range []string{"auth", "workspace", "projects", "environment"} {
		if text := recovery.StageDetails[key]; len(text) == 0 || len(text) > 2400 {
			return fmt.Errorf("恢复动画状态说明无效")
		}
	}
	if !hexColor.MatchString(recovery.BackgroundLight) || !hexColor.MatchString(recovery.BackgroundDark) || recovery.AnimationSpeed < 0.25 || recovery.AnimationSpeed > 2 || (recovery.ExitEffect != "fade" && recovery.ExitEffect != "instant") || (recovery.TimeoutFeedback != "retry" && recovery.TimeoutFeedback != "reload") || len(recovery.Paths) > 100 {
		return fmt.Errorf("恢复动画配置无效")
	}
	for _, path := range recovery.Paths {
		if len(path) == 0 || path[0] != '/' || len(path) > 200 {
			return fmt.Errorf("恢复动画适用路径无效")
		}
	}
	for _, value := range []*float64{config.Overlays.ImageGradientOpacity, config.Overlays.ScrollEdgeOpacity, config.Overlays.BusyOpacity} {
		if value != nil && (*value < 0 || *value > 1) {
			return fmt.Errorf("遮罩透明度无效")
		}
	}
	if config.Typography == nil || config.Interactions == nil || config.Transitions == nil {
		return fmt.Errorf("扩展配置缺失")
	}
	typography := config.Typography
	if (typography.FontFamilySans != "system" && typography.FontFamilySans != "inter") || (typography.FontFamilyMono != "system" && typography.FontFamilyMono != "mono") || typography.SpacingUnit < 2 || typography.SpacingUnit > 8 {
		return fmt.Errorf("字体或间距无效")
	}
	for name := range DefaultTypography().Scales {
		scale, found := typography.Scales[name]
		if !found || scale.Size < 10 || scale.Size > 72 || scale.LineHeight < scale.Size || scale.LineHeight > 120 || scale.Weight < 100 || scale.Weight > 900 {
			return fmt.Errorf("排版层级 %s 无效", name)
		}
	}
	interaction := config.Interactions
	if interaction.FocusWidth < 1 || interaction.FocusWidth > 6 || interaction.FocusOffset < 0 || interaction.FocusOffset > 8 || interaction.HoverLift < 0 || interaction.HoverLift > 4 || interaction.PressedScale < 0.9 || interaction.PressedScale > 1 || interaction.DisabledOpacity < 0.2 || interaction.DisabledOpacity > 0.8 || (interaction.PerformanceMode != "auto" && interaction.PerformanceMode != "low" && interaction.PerformanceMode != "full") {
		return fmt.Errorf("交互参数超出范围")
	}
	for _, color := range []string{interaction.SwitchOnLight, interaction.SwitchOnDark, interaction.CheckboxLight, interaction.CheckboxDark} {
		if !hexColor.MatchString(color) {
			return fmt.Errorf("交互颜色无效")
		}
	}
	transition := config.Transitions
	if transition.Duration < 0 || transition.Duration > 1000 || transition.Delay < 0 || transition.Delay > 300 || transition.Distance < 0 || transition.Distance > 32 || transition.Scale < 0.9 || transition.Scale > 1 || transition.Opacity < 0 || transition.Opacity > 1 || (transition.Preset != "fade" && transition.Preset != "slide" && transition.Preset != "scale") || (transition.Direction != "forward" && transition.Direction != "backward") || len(transition.Paths) > 100 {
		return fmt.Errorf("页面过渡参数无效")
	}
	for _, path := range transition.Paths {
		if len(path) == 0 || path[0] != '/' || len(path) > 200 {
			return fmt.Errorf("页面过渡路径无效")
		}
	}
	for _, component := range transition.Components {
		if component != "page" && component != "workspace" && component != "generation" && component != "overlay" {
			return fmt.Errorf("动效组件范围无效")
		}
	}
	if len(config.CustomPresets) > 30 {
		return fmt.Errorf("自定义预设不能超过 30 个")
	}
	seen := map[string]bool{}
	for _, preset := range config.CustomPresets {
		if len(preset.ID) < 8 || preset.ID[:7] != "custom-" || len(preset.ID) > 80 || seen[preset.ID] || len(preset.Name) == 0 || len(preset.Name) > 240 || len(preset.Description) > 2000 || preset.IsSystem {
			return fmt.Errorf("自定义预设标识无效")
		}
		seen[preset.ID] = true
		check := config
		check.CustomPresets = []ThemePreset{}
		check.Tokens = preset.Tokens
		check.Components = preset.Components
		if preset.Motion != nil {
			check.Motion = *preset.Motion
		}
		if err := ValidateConfig(check); err != nil {
			return fmt.Errorf("预设 %s: %w", preset.Name, err)
		}
	}
	return nil
}
