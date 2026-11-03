package visualengine

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"reflect"
	"regexp"
	"strings"
)

func DecodeConfig(raw []byte) (Config, error) {
	var config Config
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&config); err != nil {
		return Config{}, err
	}
	if err := requireConfigFields(raw, reflect.TypeOf(config), "config"); err != nil {
		return Config{}, err
	}
	if err := ValidateConfig(config); err != nil {
		return Config{}, err
	}
	return config, nil
}

func requireConfigFields(raw json.RawMessage, fieldType reflect.Type, path string) error {
	if len(raw) == 0 || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return fmt.Errorf("视觉配置字段缺失或为空：%s", path)
	}
	if fieldType.Kind() == reflect.Pointer {
		fieldType = fieldType.Elem()
	}
	switch fieldType.Kind() {
	case reflect.Struct:
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(raw, &fields); err != nil {
			return err
		}
		for index := 0; index < fieldType.NumField(); index++ {
			field := fieldType.Field(index)
			tag := field.Tag.Get("json")
			name := strings.Split(tag, ",")[0]
			value, present := fields[name]
			if !present && strings.Contains(tag, ",omitempty") {
				continue
			}
			if err := requireConfigFields(value, field.Type, path+"."+name); err != nil {
				return err
			}
		}
	case reflect.Map:
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(raw, &fields); err != nil {
			return err
		}
		for name, value := range fields {
			if err := requireConfigFields(value, fieldType.Elem(), path+"."+name); err != nil {
				return err
			}
		}
	case reflect.Slice:
		var entries []json.RawMessage
		if err := json.Unmarshal(raw, &entries); err != nil {
			return err
		}
		for index, value := range entries {
			if err := requireConfigFields(value, fieldType.Elem(), fmt.Sprintf("%s[%d]", path, index)); err != nil {
				return err
			}
		}
	}
	return nil
}

var colorPattern = regexp.MustCompile(`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`)

const shadowLength = `(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em))`
const shadowChannel = `(?:25[0-5]|2[0-4]\d|1?\d{1,2})`
const shadowAlpha = `(?:0(?:\.\d+)?|1(?:\.0+)?|\.\d+)`
const shadowColor = `(?:#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?|rgb\(\s*` + shadowChannel + `\s*,\s*` + shadowChannel + `\s*,\s*` + shadowChannel + `\s*\)|rgba\(\s*` + shadowChannel + `\s*,\s*` + shadowChannel + `\s*,\s*` + shadowChannel + `\s*,\s*` + shadowAlpha + `\s*\)|transparent|black|white)`
const singleShadow = `(?:inset\s+)?[+-]?` + shadowLength + `\s+[+-]?` + shadowLength + `(?:\s+` + shadowLength + `(?:\s+[+-]?` + shadowLength + `)?)?\s+` + shadowColor

var shadowPattern = regexp.MustCompile(`^(?:none|` + singleShadow + `(?:,\s*` + singleShadow + `)*)$`)
var easingPattern = regexp.MustCompile(`^(linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\(\s*(0(\.\d+)?|1(\.0+)?)\s*,\s*-?\d+(\.\d+)?\s*,\s*(0(\.\d+)?|1(\.0+)?)\s*,\s*-?\d+(\.\d+)?\s*\))$`)

func ValidateConfig(config Config) error {
	invalid := func(field string) error { return fmt.Errorf("视觉配置字段无效：%s", field) }
	if config.SchemaVersion != 2 {
		return invalid("schemaVersion")
	}
	if !oneOf(config.ActivePreset, "native", "dark", "light", "studio", "custom") {
		return invalid("activePreset")
	}
	if !oneOf(config.ThemeMode, "dark", "light", "system") {
		return invalid("themeMode")
	}
	if len(config.Tokens) != 2 {
		return invalid("tokens")
	}
	for _, mode := range []string{"light", "dark"} {
		tokens, exists := config.Tokens[mode]
		if !exists {
			return invalid("tokens." + mode)
		}
		values := reflect.ValueOf(tokens)
		for index := 0; index < values.NumField(); index++ {
			if !colorPattern.MatchString(values.Field(index).String()) {
				return invalid("tokens." + mode + "." + values.Type().Field(index).Name)
			}
		}
	}
	components := reflect.ValueOf(config.Components)
	for index := 0; index < components.NumField(); index++ {
		value := components.Field(index).Int()
		minimum := int64(0)
		if strings.Contains(components.Type().Field(index).Name, "Height") {
			minimum = 16
		}
		if value < minimum || value > 128 {
			return invalid("components." + components.Type().Field(index).Name)
		}
	}
	if len(config.Elevations) != 5 {
		return invalid("elevations")
	}
	for _, level := range []string{"E0", "E1", "E2", "E3", "E4"} {
		elevation, exists := config.Elevations[level]
		if !exists || elevation.Level != level || elevation.BlurRadius < 0 || elevation.BlurRadius > 128 {
			return invalid("elevations." + level)
		}
		for _, shadow := range []string{elevation.ShadowLight, elevation.ShadowDark} {
			if len(shadow) > 512 || !shadowPattern.MatchString(shadow) {
				return invalid("elevations." + level + ".shadow")
			}
		}
	}
	overlays := config.Overlays
	if overlays.ModalBackdropBlur < 0 || overlays.ModalBackdropBlur > 128 || overlays.DrawerBackdropBlur < 0 || overlays.DrawerBackdropBlur > 128 || overlays.MenuBackdropBlur < 0 || overlays.MenuBackdropBlur > 128 || !bounded(overlays.ModalBackdropOpacity, 0, 1) || !bounded(overlays.DrawerBackdropOpacity, 0, 1) {
		return invalid("overlays")
	}
	motion := config.Motion
	for _, duration := range []int{motion.DurationQuick, motion.DurationDropdownEnter, motion.DurationDropdownExit, motion.DurationModal, motion.DurationDrawer, motion.DurationTabSwitch} {
		if duration < 0 || duration > 5000 {
			return invalid("motion.duration")
		}
	}
	for _, easing := range []string{motion.EasingStandard, motion.EasingBounce, motion.EasingSmooth} {
		if !easingPattern.MatchString(easing) {
			return invalid("motion.easing")
		}
	}
	if !oneOf(motion.ReducedMotionBehavior, "instant", "fade-only") {
		return invalid("motion.reducedMotionBehavior")
	}
	recovery := config.WorkspaceRecovery
	if !oneOf(recovery.ThemeMode, "light", "dark") || !oneOf(recovery.GridDensity, "compact", "normal", "sparse") || !bounded(recovery.OrbitSpeed, .1, 5) || recovery.OrbitNodesCount < 3 || recovery.OrbitNodesCount > 8 || recovery.FloatingCardsCount < 2 || recovery.FloatingCardsCount > 6 || !bounded(recovery.GlowIntensity, 0, 1) || recovery.TimeoutMs < 1000 || recovery.TimeoutMs > 120000 {
		return invalid("workspaceRecovery")
	}
	if strings.TrimSpace(recovery.BrandName) == "" || len(recovery.BrandName) > 200 {
		return invalid("workspaceRecovery.brandName")
	}
	if recovery.BrandLogoURL != "" {
		parsed, err := url.Parse(recovery.BrandLogoURL)
		if err != nil || parsed.User != nil || !(strings.HasPrefix(recovery.BrandLogoURL, "/") && !strings.HasPrefix(recovery.BrandLogoURL, "//") || parsed.Scheme == "https" && parsed.Host != "") {
			return invalid("workspaceRecovery.brandLogoUrl")
		}
	}
	if len(recovery.StatusCopies) != 5 || len(recovery.StageDetails) != 4 {
		return invalid("workspaceRecovery.copies")
	}
	for _, stage := range []string{"init", "recovering", "syncing", "ready", "failed"} {
		if strings.TrimSpace(recovery.StatusCopies[stage]) == "" || len(recovery.StatusCopies[stage]) > 1000 {
			return invalid("workspaceRecovery.statusCopies." + stage)
		}
	}
	for _, stage := range []string{"auth", "workspace", "projects", "environment"} {
		if strings.TrimSpace(recovery.StageDetails[stage]) == "" || len(recovery.StageDetails[stage]) > 1000 {
			return invalid("workspaceRecovery.stageDetails." + stage)
		}
	}
	if config.PageRules == nil || len(config.PageRules) > 128 {
		return invalid("pageRules")
	}
	seen := map[string]bool{}
	tokenType := reflect.TypeOf(SemanticTokens{})
	knownTokens := map[string]bool{}
	for index := 0; index < tokenType.NumField(); index++ {
		knownTokens[tokenType.Field(index).Tag.Get("json")] = true
	}
	for _, rule := range config.PageRules {
		if rule.ID == "" || seen[rule.ID] || len(rule.ID) > 200 || strings.TrimSpace(rule.Name) == "" || len(rule.Name) > 200 {
			return invalid("pageRules.identity")
		}
		seen[rule.ID] = true
		if len(rule.PathPattern) > 500 || !(rule.PathPattern == "*" || strings.HasPrefix(rule.PathPattern, "/")) || strings.ContainsAny(rule.PathPattern, "?#\\") || strings.Contains(strings.TrimSuffix(rule.PathPattern, "*"), "*") {
			return invalid("pageRules.pathPattern")
		}
		if rule.ThemePresetOverride != "" && !oneOf(rule.ThemePresetOverride, "native", "light", "dark", "studio", "custom") {
			return invalid("pageRules.themePresetOverride")
		}
		for key, value := range rule.CustomTokens {
			if !knownTokens[key] || !colorPattern.MatchString(value) {
				return invalid("pageRules.customTokens")
			}
		}
	}
	return nil
}

func bounded(value, minimum, maximum float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0) && value >= minimum && value <= maximum
}
func oneOf(value string, options ...string) bool {
	for _, option := range options {
		if value == option {
			return true
		}
	}
	return false
}
