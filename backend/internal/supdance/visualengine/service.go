package visualengine

import (
	"time"
)

func DefaultConfig() Config {
	return Config{
		SchemaVersion:    2,
		ActivePreset:     "studio",
		ThemeMode:        "dark",
		PublishedVersion: DefaultPublishedVersion,
		UpdatedAt:        time.Now().UTC().Format(time.RFC3339),
		UpdatedBy:        "SupDance Architecture Team",
		Tokens: map[string]SemanticTokens{
			"dark": {
				Canvas:             "#0a0a0f",
				Surface:            "#12121a",
				SurfaceSubtle:      "#0e0e14",
				SurfaceRaised:      "#181822",
				Overlay:            "#161620",
				Text:               "#f4f4f5",
				TextMuted:          "#a1a1aa",
				Border:             "#232332",
				Control:            "#151520",
				ControlHover:       "#1c1c2a",
				ControlActive:      "#242436",
				ControlBorder:      "#2a2a3e",
				ControlFocus:       "#f43f5e",
				Primary:            "#f43f5e",
				PrimaryHover:       "#fb7185",
				PrimaryActive:      "#e11d48",
				PrimaryForeground:  "#ffffff",
				Selected:           "#2c0b1e",
				SelectedHover:      "#3d102a",
				SelectedActive:     "#4e1436",
				SelectedForeground: "#fda4af",
				Danger:             "#f87171",
				DangerHover:        "#ef4444",
				DangerActive:       "#dc2626",
				DangerForeground:   "#0a0a0f",
				Success:            "#34d399",
				Warning:            "#fbbf24",
				Info:               "#f43f5e",
			},
			"light": {
				Canvas:             "#fafafa",
				Surface:            "#ffffff",
				SurfaceSubtle:      "#f4f4f5",
				SurfaceRaised:      "#ffffff",
				Overlay:            "#ffffff",
				Text:               "#18181b",
				TextMuted:          "#71717a",
				Border:             "#e4e4e7",
				Control:            "#ffffff",
				ControlHover:       "#fafafa",
				ControlActive:      "#f4f4f5",
				ControlBorder:      "#d4d4d8",
				ControlFocus:       "#e11d74",
				Primary:            "#e11d74",
				PrimaryHover:       "#be185d",
				PrimaryActive:      "#9d174d",
				PrimaryForeground:  "#ffffff",
				Selected:           "#fdf2f8",
				SelectedHover:      "#fce7f3",
				SelectedActive:     "#fbcfe8",
				SelectedForeground: "#831843",
				Danger:             "#ef4444",
				DangerHover:        "#dc2626",
				DangerActive:       "#b91c1c",
				DangerForeground:   "#ffffff",
				Success:            "#10b981",
				Warning:            "#f59e0b",
				Info:               "#e11d74",
			},
		},
		Components: ComponentTokens{
			ButtonHeightRegular: 36,
			ButtonHeightCompact: 32,
			ButtonHeightMicro:   28,
			ButtonRadius:        10,
			InputHeight:         36,
			InputRadius:         10,
			CardRadius:          14,
			OverlayRadius:       14,
			MenuRadius:          8,
			TagRadius:           6,
		},
		Elevations: map[string]ElevationToken{
			"E0": {Level: "E0", Label: "底板层", Usage: "标准画板底色", ShadowLight: "none", ShadowDark: "none", BlurRadius: 0},
			"E1": {Level: "E1", Label: "操作台与工具栏", Usage: "悬浮工具条", ShadowLight: "0 1px 3px rgba(0,0,0,0.06)", ShadowDark: "0 2px 6px rgba(0,0,0,0.45)", BlurRadius: 3},
			"E2": {Level: "E2", Label: "浮动菜单", Usage: "下拉菜单与气泡", ShadowLight: "0 4px 6px -1px rgba(0,0,0,0.08)", ShadowDark: "0 6px 18px rgba(0,0,0,0.55)", BlurRadius: 6},
			"E3": {Level: "E3", Label: "模态窗口", Usage: "对话框与抽屉", ShadowLight: "0 10px 15px -3px rgba(0,0,0,0.1)", ShadowDark: "0 14px 32px rgba(0,0,0,0.68)", BlurRadius: 15},
			"E4": {Level: "E4", Label: "拖拽预览", Usage: "幽灵画卷拖拽", ShadowLight: "0 20px 25px -5px rgba(0,0,0,0.12)", ShadowDark: "0 22px 48px rgba(0,0,0,0.85)", BlurRadius: 25},
		},
		Overlays: OverlaysConfig{
			ModalBackdropBlur:            8,
			ModalBackdropOpacity:         0.65,
			DrawerBackdropBlur:           4,
			DrawerBackdropOpacity:        0.5,
			MenuBackdropBlur:             12,
			EnableTextProtectionGradient: true,
		},
		Motion: MotionConfig{
			Enabled:               true,
			DurationQuick:         150,
			DurationDropdownEnter: 200,
			DurationDropdownExit:  150,
			DurationModal:         200,
			DurationDrawer:        250,
			DurationTabSwitch:     200,
			EasingStandard:        "cubic-bezier(0.16, 1, 0.3, 1)",
			EasingBounce:          "cubic-bezier(0.34, 1.56, 0.64, 1)",
			EasingSmooth:          "cubic-bezier(0.4, 0, 0.2, 1)",
			ReducedMotionBehavior: "fade-only",
		},
		WorkspaceRecovery: WorkspaceRecoveryConfig{
			Enabled:            true,
			ThemeMode:          "dark",
			BrandLogoURL:       "/logo.svg",
			BrandName:          "SupDance",
			OrbitSpeed:         1.0,
			OrbitNodesCount:    6,
			FloatingCardsCount: 4,
			GlowIntensity:      0.75,
			GridDensity:        "normal",
			TimeoutMs:          8000,
			StatusCopies: map[string]string{
				"init":       "正在初始化 SupDance 创作空间…",
				"recovering": "正在恢复创作者工作区…",
				"syncing":    "正在同步项目数据与模型连接…",
				"ready":      "工作区已就绪，即将进入…",
				"failed":     "工作区恢复超时，请检查网络或点击重试",
			},
			StageDetails: map[string]string{
				"auth":        "验证账户会话与创作者身份",
				"workspace":   "还原面板布局与画板视图状态",
				"projects":    "检查近期创作画卷与资产缓存",
				"environment": "准备本地与云端模型能力",
			},
		},
		PageRules: []PageRule{
			{
				ID:                  "rule-admin",
				Name:                "管理后台视觉降噪隔离",
				PathPattern:         "/admin/*",
				ThemePresetOverride: "native",
				Notes:               "保持微信公众平台/腾讯We分析极度克制设计",
			},
		},
	}
}

func NormalizeConfig(c Config) Config {
	def := DefaultConfig()
	if c.SchemaVersion == 0 {
		c.SchemaVersion = def.SchemaVersion
	}
	if c.ActivePreset == "" {
		c.ActivePreset = def.ActivePreset
	}
	if c.ThemeMode == "" {
		c.ThemeMode = def.ThemeMode
	}
	if c.Tokens == nil {
		c.Tokens = def.Tokens
	}
	if c.PublishedVersion == "" {
		c.PublishedVersion = def.PublishedVersion
	}
	return c
}
