package visualengine

import (
	"fmt"
	"math"
	"reflect"
	"regexp"
	"strconv"
	"strings"
)

var hexColor = regexp.MustCompile(`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`)
var easing = regexp.MustCompile(`^(linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\([-0-9., ]+\))$`)
var shadow = regexp.MustCompile(`^(none|[-0-9.pxrgba(), #%]+)$`)

func ValidateConfig(config Config) error {
	if config.SchemaVersion != 2 {
		return fmt.Errorf("仅支持配置 Schema 2")
	}
	if config.ThemeMode != "dark" && config.ThemeMode != "light" && config.ThemeMode != "system" {
		return fmt.Errorf("主题模式无效")
	}
	if len(config.ActivePreset) == 0 || len(config.ActivePreset) > 80 {
		return fmt.Errorf("主题标识无效")
	}
	for _, mode := range []string{"light", "dark"} {
		tokens, found := config.Tokens[mode]
		if !found {
			return fmt.Errorf("缺少 %s 主题", mode)
		}
		values := reflect.ValueOf(tokens)
		for index := 0; index < values.NumField(); index++ {
			if !hexColor.MatchString(values.Field(index).String()) {
				return fmt.Errorf("%s 主题存在非法颜色", mode)
			}
		}
	}
	geometry := reflect.ValueOf(config.Components)
	for index := 0; index < geometry.NumField(); index++ {
		value := geometry.Field(index).Int()
		if value < 0 || value > 128 {
			return fmt.Errorf("组件尺寸应在 0 至 128 之间")
		}
	}
	if config.Components.ButtonHeightRegular < 28 || config.Components.InputHeight < 28 {
		return fmt.Errorf("控件高度不能小于 28")
	}
	for _, level := range []string{"E0", "E1", "E2", "E3", "E4"} {
		token, found := config.Elevations[level]
		if !found || !shadow.MatchString(token.ShadowLight) || !shadow.MatchString(token.ShadowDark) || len(token.ShadowLight) > 240 || len(token.ShadowDark) > 240 || token.BlurRadius < 0 || token.BlurRadius > 100 {
			return fmt.Errorf("阴影配置无效：%s", level)
		}
	}
	overlay := config.Overlays
	if overlay.ModalBackdropBlur < 0 || overlay.ModalBackdropBlur > 100 || overlay.DrawerBackdropBlur < 0 || overlay.DrawerBackdropBlur > 100 || overlay.MenuBackdropBlur < 0 || overlay.MenuBackdropBlur > 100 {
		return fmt.Errorf("模糊半径无效")
	}
	if overlay.ModalBackdropOpacity < 0 || overlay.ModalBackdropOpacity > 1 || overlay.DrawerBackdropOpacity < 0 || overlay.DrawerBackdropOpacity > 1 {
		return fmt.Errorf("遮罩透明度无效")
	}
	motion := config.Motion
	for _, duration := range []int{motion.DurationQuick, motion.DurationDropdownEnter, motion.DurationDropdownExit, motion.DurationModal, motion.DurationDrawer, motion.DurationTabSwitch} {
		if duration < 0 || duration > 3000 {
			return fmt.Errorf("动画时长应在 0 至 3000 毫秒之间")
		}
	}
	for _, curve := range []string{motion.EasingStandard, motion.EasingBounce, motion.EasingSmooth} {
		if len(curve) > 100 || !validEasing(curve) {
			return fmt.Errorf("动画曲线无效")
		}
	}
	if motion.ReducedMotionBehavior != "instant" && motion.ReducedMotionBehavior != "fade-only" {
		return fmt.Errorf("减少动效策略无效")
	}
	recovery := config.WorkspaceRecovery
	if !strings.HasPrefix(recovery.BrandLogoURL, "/") || strings.HasPrefix(recovery.BrandLogoURL, "//") || strings.ContainsAny(recovery.BrandLogoURL, "\\\r\n") {
		return fmt.Errorf("Logo 必须使用站内资源路径")
	}
	if recovery.TimeoutMs < 1000 || recovery.TimeoutMs > 120000 || recovery.OrbitNodesCount < 0 || recovery.OrbitNodesCount > 8 || recovery.FloatingCardsCount < 0 || recovery.FloatingCardsCount > 4 || math.IsNaN(recovery.OrbitSpeed) || recovery.OrbitSpeed < 0.1 || recovery.OrbitSpeed > 10 || recovery.GlowIntensity < 0 || recovery.GlowIntensity > 1 {
		return fmt.Errorf("恢复动画参数超出范围")
	}
	if len(config.PageRules) > 100 {
		return fmt.Errorf("页面规则不能超过 100 条")
	}
	known := reflect.TypeOf(SemanticTokens{})
	tokenNames := map[string]bool{}
	for index := 0; index < known.NumField(); index++ {
		tokenNames[known.Field(index).Tag.Get("json")] = true
	}
	ids := map[string]bool{}
	for _, rule := range config.PageRules {
		if rule.ID == "" || ids[rule.ID] || len(rule.PathPattern) > 200 || !strings.HasPrefix(rule.PathPattern, "/") {
			return fmt.Errorf("页面规则标识或路径无效")
		}
		ids[rule.ID] = true
		if rule.PerformanceMode != "" && rule.PerformanceMode != "auto" && rule.PerformanceMode != "low" && rule.PerformanceMode != "full" {
			return fmt.Errorf("页面性能模式无效")
		}
		if rule.Components != nil || rule.Overlays != nil || rule.Elevations != nil {
			scoped := config
			scoped.PageRules = nil
			scoped.CustomPresets = nil
			if rule.Components != nil {
				scoped.Components = *rule.Components
			}
			if rule.Overlays != nil {
				scoped.Overlays = *rule.Overlays
			}
			if rule.Elevations != nil {
				scoped.Elevations = rule.Elevations
			}
			if err := ValidateConfig(scoped); err != nil {
				return fmt.Errorf("页面覆盖配置无效: %w", err)
			}
		}
		for name, color := range rule.CustomTokens {
			if !tokenNames[name] || !hexColor.MatchString(color) {
				return fmt.Errorf("页面规则颜色无效")
			}
		}
	}
	return validateExtendedConfig(config)
}
func validEasing(value string) bool {
	if !easing.MatchString(value) {
		return false
	}
	if !strings.HasPrefix(value, "cubic-bezier(") {
		return true
	}
	parts := strings.Split(strings.TrimSuffix(strings.TrimPrefix(value, "cubic-bezier("), ")"), ",")
	if len(parts) != 4 {
		return false
	}
	for index, part := range parts {
		number, err := strconv.ParseFloat(strings.TrimSpace(part), 64)
		if err != nil || math.IsNaN(number) || math.IsInf(number, 0) || ((index == 0 || index == 2) && (number < 0 || number > 1)) {
			return false
		}
	}
	return true
}
