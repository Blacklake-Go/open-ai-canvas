package canvas

import (
	"fmt"
	"math"
	"regexp"
	"strings"
)

var (
	AspectRatios   = []string{"1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"}
	Resolutions    = []string{"2k", "4k"}
	DetailLevels   = []string{"low", "medium", "high"}
	UpscaleModes   = []string{"smart", "standard"}
	OutpaintScales = []float64{1.5, 2, 3}
)

var (
	detailWords      = map[string]string{"low": "轻度", "medium": "适中", "high": "强力"}
	upscaleModeWords = map[string]string{"smart": "智能超清", "standard": "超清"}
	reSourceAssetID  = regexp.MustCompile(`^[A-Za-z0-9_-]{8,160}$`)
)

type ToolError struct {
	Code    string
	Message string
}

func (e *ToolError) Error() string { return e.Message }

type CameraPreset struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Yaw   int    `json:"yaw"`
	Pitch int    `json:"pitch"`
}

var CameraPresets = []CameraPreset{
	{ID: "top_left", Label: "左上", Yaw: -45, Pitch: 30},
	{ID: "top", Label: "俯视", Yaw: 0, Pitch: 60},
	{ID: "top_right", Label: "右上", Yaw: 45, Pitch: 30},
	{ID: "left", Label: "左视", Yaw: -90, Pitch: 0},
	{ID: "front", Label: "正视", Yaw: 0, Pitch: 0},
	{ID: "right", Label: "右视", Yaw: 90, Pitch: 0},
	{ID: "bottom_left", Label: "左下", Yaw: -45, Pitch: -30},
	{ID: "bottom", Label: "仰视", Yaw: 0, Pitch: -60},
	{ID: "bottom_right", Label: "右下", Yaw: 45, Pitch: -30},
}

type presetDef struct {
	ID          string
	Label       string
	AspectRatio string
	Resolutions []string
	Hint        string
	Prompt      string
}

var canvasPresets = []presetDef{
	{
		ID:          "scene_top_view",
		Label:       "场景俯视图",
		AspectRatio: "source",
		Resolutions: Resolutions,
		Hint:        "正上方俯视重建场景平面布局",
		Prompt:      "以正上方垂直俯视的视角重绘该场景，输出场景的俯视布局图。保持原有空间结构、物体种类与数量、相对位置关系、材质和配色不变，采用均匀明亮的顶光，画面清晰、无透视畸变、无遮挡。不新增或删除主要物体，不出现文字、水印、尺寸标注与边框。",
	},
	{
		ID:          "continuous_storyboard",
		Label:       "连续分镜图",
		AspectRatio: "16:9",
		Resolutions: Resolutions,
		Hint:        "横向三格连续分镜",
		Prompt:      "以该画面为起点，生成横向连续分镜：画面从左到右分为三个等宽分镜格，按时间顺序展示同一场景、同一角色的连续动作。角色造型、服装、场景、光线与色调在各格之间保持一致，镜头语言连贯，每格构图完整清晰。不出现文字、水印、对话气泡与边框。",
	},
	{
		ID:          "multi_camera_nine_grid",
		Label:       "多机位九宫格",
		AspectRatio: "16:9",
		Resolutions: Resolutions,
		Hint:        "3x3 九机位同一主体",
		Prompt:      "以该主体为核心生成九宫格多机位画面：3×3 网格排列同一主体在九个不同机位与角度下的画面，覆盖正面、左侧、右侧、背面、俯视、仰视、近景、中景、远景。主体造型、服装、材质与配色在所有格子中保持一致，光线统一，格子等大对齐。不出现文字、水印与边框。",
	},
	{
		ID:          "character_three_view",
		Label:       "人物三视图",
		AspectRatio: "16:9",
		Resolutions: Resolutions,
		Hint:        "正面 / 侧面 / 背面全身",
		Prompt:      "生成该人物的角色三视图：在同一画面中从左到右等距排列正面、侧面、背面三个全身视角。人物站姿自然、比例一致，三个视角朝向统一（正视镜头、侧面 90°、背对镜头），服装、发型、配饰、材质与配色完全一致。纯色浅灰背景，均匀柔光，无投影、无文字、无水印、无边框，16:9 横版构图。",
	},
	{
		ID:          "face_three_view",
		Label:       "面部三视图",
		AspectRatio: "16:9",
		Resolutions: Resolutions,
		Hint:        "正面 / 侧面 / 背面头部",
		Prompt:      "生成该人物的面部三视图：同一画面中从左到右等距排列正面、侧面、背面三个头部视角。五官、发型、肤色、妆容与表情在各视角之间保持一致，角度过渡自然，头部比例不变。纯色浅灰背景，均匀柔光，无文字、无水印、无边框，16:9 横版构图。",
	},
	{
		ID:          "product_three_view",
		Label:       "产品三视图",
		AspectRatio: "16:9",
		Resolutions: Resolutions,
		Hint:        "正面 / 侧面 / 背面产品",
		Prompt:      "生成该产品的产品三视图：同一画面中从左到右等距排列正面、侧面、背面三个视角。产品造型、比例、材质、颜色、logo 与细节完全一致，背景干净统一。纯色浅灰背景，均匀柔光，轻微地面接触阴影，无文字标注、无水印、无边框，16:9 横版构图。",
	},
}

type ToolPlan struct {
	Tool       string         `json:"tool"`
	Label      string         `json:"label"`
	Prompt     string         `json:"prompt"`
	Parameters map[string]any `json:"parameters"`
	Meta       map[string]any `json:"meta"`
}

func containsStr(list []string, v string) bool {
	for _, item := range list {
		if item == v {
			return true
		}
	}
	return false
}

func normalizeResolution(v, fallback string) (string, error) {
	s := strings.ToLower(strings.TrimSpace(v))
	if s == "" {
		return fallback, nil
	}
	if !containsStr(Resolutions, s) {
		return "", &ToolError{Code: "RESOLUTION_UNSUPPORTED", Message: "不支持的超清档位"}
	}
	return s, nil
}

func normalizeRatio(v, fallback string) (string, error) {
	s := strings.TrimSpace(v)
	if s == "" || s == "source" || s == "auto" {
		return fallback, nil
	}
	if !containsStr(AspectRatios, s) {
		return "", &ToolError{Code: "ASPECT_RATIO_UNSUPPORTED", Message: "不支持的目标画幅比例"}
	}
	return s, nil
}

func sanitizeUserPrompt(v any, maxLen int) (string, error) {
	s, ok := v.(string)
	if !ok {
		return "", nil
	}
	var b strings.Builder
	for _, r := range s {
		if r < 0x20 && r != '\n' && r != '\t' || r == 0x7f {
			b.WriteByte(' ')
		} else {
			b.WriteRune(r)
		}
	}
	clean := strings.TrimSpace(b.String())
	if len([]rune(clean)) > maxLen {
		return "", &ToolError{Code: "PROMPT_TOO_LONG", Message: fmt.Sprintf("补充描述不能超过 %d 个字符", maxLen)}
	}
	return clean, nil
}

func toBoundedFloat(v any, fallback, minV, maxV float64) float64 {
	var n float64
	switch val := v.(type) {
	case float64:
		n = val
	case int:
		n = float64(val)
	case int64:
		n = float64(val)
	default:
		return fallback
	}
	if math.IsNaN(n) || math.IsInf(n, 0) {
		return fallback
	}
	return math.Min(maxV, math.Max(minV, n))
}

func strParam(params map[string]any, key string) string {
	if params == nil {
		return ""
	}
	if s, ok := params[key].(string); ok {
		return strings.TrimSpace(s)
	}
	return ""
}

func describeYaw(yaw float64) string {
	angle := math.Mod(math.Mod(yaw, 360)+360, 360)
	switch {
	case angle <= 22 || angle >= 338:
		return "正面（0°）"
	case angle < 67:
		return "右前侧 45°"
	case angle <= 112:
		return "右侧 90°"
	case angle < 157:
		return "右后侧 135°"
	case angle <= 202:
		return "背面 180°"
	case angle < 247:
		return "左后侧 225°"
	case angle <= 292:
		return "左侧 270°"
	default:
		return "左前侧 315°"
	}
}

func describePitch(pitch float64) string {
	switch {
	case pitch >= 45:
		return "接近垂直的顶视俯拍"
	case pitch >= 20:
		return "高角度俯拍"
	case pitch > 8:
		return "略高于平视的俯拍"
	case pitch >= -8:
		return "平视（与主体视线齐平）"
	case pitch > -35:
		return "低角度仰拍"
	default:
		return "接近垂直的底视仰拍"
	}
}

// BuildToolPlan translates a canvas tool invocation and params into a whitelisted i2i generation plan.
func BuildToolPlan(tool string, params map[string]any, sourceAssetID string) (*ToolPlan, error) {
	assetID := strings.TrimSpace(sourceAssetID)
	if !reSourceAssetID.MatchString(assetID) {
		return nil, &ToolError{Code: "INVALID_SOURCE", Message: "请先上传一张源图片"}
	}
	if params == nil {
		params = map[string]any{}
	}
	baseParams := func(ratio, res string) map[string]any {
		return map[string]any{
			"task_type":    "i2i",
			"image_urls":   []string{"koyo-asset:" + assetID},
			"aspect_ratio": ratio,
			"resolution":   res,
		}
	}

	switch strings.TrimSpace(tool) {
	case "outpaint":
		ratio, err := normalizeRatio(strParam(params, "aspectRatio"), "1:1")
		if err != nil {
			return nil, err
		}
		scale := toBoundedFloat(params["scale"], 1.5, 1, 3)
		extra, err := sanitizeUserPrompt(params["prompt"], 600)
		if err != nil {
			return nil, err
		}
		prompt := fmt.Sprintf("在保持原图主体、姿态、服装、材质、光照方向、色调与透视关系完全不变的前提下，将画面向外扩展约 %g 倍，输出 %s 画幅。补全扩展区域的环境、背景与场景细节，让扩展部分与原图无缝衔接；不新增人物或主要物体，不改变主体位置、大小与构图重心。不出现文字、水印、边框与拼贴痕迹。", scale, ratio)
		if extra != "" {
			prompt += "补充要求：" + extra
		}
		return &ToolPlan{
			Tool: "outpaint", Label: "画布扩图", Prompt: prompt,
			Parameters: baseParams(ratio, "2k"),
			Meta:       map[string]any{"aspectRatio": ratio, "scale": scale},
		}, nil

	case "upscale":
		mode := strParam(params, "mode")
		if !containsStr(UpscaleModes, mode) {
			mode = "smart"
		}
		detail := strParam(params, "detail")
		if !containsStr(DetailLevels, detail) {
			detail = "medium"
		}
		res, err := normalizeResolution(strParam(params, "resolution"), "2k")
		if err != nil {
			return nil, err
		}
		ratio, err := normalizeRatio(strParam(params, "aspectRatio"), "1:1")
		if err != nil {
			return nil, err
		}
		label := "画布智能超清"
		prompt := fmt.Sprintf("对原图执行智能超分辨重建，将画面提升到 %s 分辨率。完整保留原图的构图、主体、姿态、表情、服装、文字排版、色彩与光影，智能推理并补全被压缩的细节，强化边缘锐度、纹理与材质表现（细节强度：%s）。输出画幅比例保持 %s，不得改变任何内容，不得新增或删除物体，不得出现噪点、涂抹感、色偏与形变。",
			strings.ToUpper(res), detailWords[detail], ratio)
		if mode == "standard" {
			label = "画布超清"
			prompt = fmt.Sprintf("对原图进行%s重绘，将画面提升到 %s 分辨率。完整保留原图的构图、主体、姿态、表情、服装、文字排版、色彩与光影，仅提升清晰度并补充边缘与纹理细节（细节强度：%s）。输出画幅比例保持 %s，不得新增或删除物体，不得出现噪点、涂抹感、色偏、形变与重影。",
				upscaleModeWords[mode], strings.ToUpper(res), detailWords[detail], ratio)
		}
		return &ToolPlan{
			Tool: "upscale", Label: label, Prompt: prompt,
			Parameters: baseParams(ratio, res),
			Meta:       map[string]any{"aspectRatio": ratio, "resolution": res, "mode": mode, "detail": detail},
		}, nil

	case "cutout":
		ratio, err := normalizeRatio(strParam(params, "aspectRatio"), "1:1")
		if err != nil {
			return nil, err
		}
		prompt := fmt.Sprintf("精确识别画面中的主体，完整保留主体轮廓、发丝、边缘与半透明细节，将背景替换为均匀的纯白色（#FFFFFF）影棚背景。主体位置、大小、角度、朝向、光照与色彩保持不变，输出画幅比例保持 %s。不新增或删除物体，不裁切主体，不出现文字、水印与投影。", ratio)
		return &ToolPlan{
			Tool: "cutout", Label: "画布抠图", Prompt: prompt,
			Parameters: baseParams(ratio, "2k"),
			Meta:       map[string]any{"aspectRatio": ratio, "background": "white"},
		}, nil

	case "preset":
		pid := strParam(params, "presetId")
		var matched *presetDef
		for i := range canvasPresets {
			if canvasPresets[i].ID == pid {
				matched = &canvasPresets[i]
				break
			}
		}
		if matched == nil {
			return nil, &ToolError{Code: "PRESET_UNSUPPORTED", Message: "不支持的预设"}
		}
		res, err := normalizeResolution(strParam(params, "resolution"), "2k")
		if err != nil {
			return nil, err
		}
		ratio := "16:9"
		if matched.AspectRatio != "16:9" {
			ratio, err = normalizeRatio(strParam(params, "aspectRatio"), "16:9")
			if err != nil {
				return nil, err
			}
		}
		return &ToolPlan{
			Tool: "preset", Label: "画布" + matched.Label, Prompt: matched.Prompt,
			Parameters: baseParams(ratio, res),
			Meta:       map[string]any{"presetId": matched.ID, "presetLabel": matched.Label, "aspectRatio": ratio, "resolution": res},
		}, nil

	case "view_control":
		yaw := toBoundedFloat(params["yaw"], 0, -180, 180)
		pitch := toBoundedFloat(params["pitch"], 0, -60, 60)
		dist := 1
		switch d := params["distance"].(type) {
		case float64:
			if d == 0 || d == 1 || d == 2 {
				dist = int(d)
			}
		case int:
			if d == 0 || d == 1 || d == 2 {
				dist = d
			}
		}
		ratio, err := normalizeRatio(strParam(params, "aspectRatio"), "1:1")
		if err != nil {
			return nil, err
		}
		distWord := "保持中景距离"
		if dist == 0 {
			distWord = "拉近为近景特写"
		} else if dist == 2 {
			distWord = "拉远为全景"
		}
		prompt := fmt.Sprintf("将摄像机方位调整到%s、%s，并%s。保持原画面中的主体身份、造型、服装、场景、光照氛围与整体风格不变，仅改变拍摄角度与机位，输出自然、连续、无畸变的画面。输出画幅比例保持 %s，不新增或删除物体，不出现文字与水印。",
			describeYaw(yaw), describePitch(pitch), distWord, ratio)
		return &ToolPlan{
			Tool: "view_control", Label: "画布多角度", Prompt: prompt,
			Parameters: baseParams(ratio, "2k"),
			Meta:       map[string]any{"aspectRatio": ratio, "yaw": yaw, "pitch": pitch, "distance": dist},
		}, nil

	default:
		return nil, &ToolError{Code: "INVALID_TOOL", Message: "不支持的工具"}
	}
}

func stringSliceFromCap(caps map[string]any, key string) []string {
	if caps == nil {
		return nil
	}
	switch raw := caps[key].(type) {
	case []string:
		return raw
	case []any:
		var out []string
		for _, item := range raw {
			if s, ok := item.(string); ok && s != "" {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

// BuildToolSpec produces the complete canvas-tools/spec payload for an i2i model.
func BuildToolSpec(modelID, modelName, provider string, creditsPrice float64, capabilities map[string]any) map[string]any {
	declaredRatios := stringSliceFromCap(capabilities, "aspectRatios")
	declaredRes := stringSliceFromCap(capabilities, "resolutions")

	usableRatios := make([]string, 0, len(AspectRatios))
	for _, r := range AspectRatios {
		if len(declaredRatios) == 0 || containsStr(declaredRatios, r) {
			usableRatios = append(usableRatios, r)
		}
	}
	if len(usableRatios) == 0 {
		usableRatios = append(usableRatios, AspectRatios...)
	}

	usableRes := make([]string, 0, len(Resolutions))
	for _, r := range Resolutions {
		if len(declaredRes) == 0 || containsStr(declaredRes, r) {
			usableRes = append(usableRes, r)
		}
	}
	if len(usableRes) == 0 {
		usableRes = append(usableRes, Resolutions...)
	}

	presetsOut := make([]map[string]any, 0, len(canvasPresets))
	for _, p := range canvasPresets {
		resOpts := make([]string, 0, len(p.Resolutions))
		for _, r := range p.Resolutions {
			if containsStr(usableRes, r) {
				resOpts = append(resOpts, r)
			}
		}
		presetsOut = append(presetsOut, map[string]any{
			"id":          p.ID,
			"label":       p.Label,
			"hint":        p.Hint,
			"aspectRatio": p.AspectRatio,
			"resolutions": resOpts,
		})
	}

	if modelName == "" {
		modelName = modelID
	}

	return map[string]any{
		"version": 1,
		"model": map[string]any{
			"id":           modelID,
			"name":         modelName,
			"provider":     provider,
			"creditsPrice": creditsPrice,
		},
		"capabilities": map[string]any{
			"aspectRatios": usableRatios,
			"resolutions":  usableRes,
		},
		"tools": []map[string]any{
			{
				"id":                "outpaint",
				"label":             "扩图",
				"hint":              "扩展画幅并补全场景",
				"ratios":            usableRatios,
				"scales":            OutpaintScales,
				"defaultScale":      1.5,
				"promptPlaceholder": "描述你想如何修改图片",
			},
			{
				"id":                "upscale",
				"label":             "智能超清",
				"hint":              "提升分辨率并补全细节",
				"modes":             []map[string]string{{"id": "smart", "label": "智能超清"}, {"id": "standard", "label": "超清"}},
				"details":           []map[string]string{{"id": "low", "label": "低"}, {"id": "medium", "label": "中"}, {"id": "high", "label": "高"}},
				"resolutions":       usableRes,
				"defaultMode":       "smart",
				"defaultDetail":     "medium",
				"defaultResolution": "2k",
			},
			{
				"id":    "cutout",
				"label": "抠图",
				"hint":  "自动识别主体并移除背景",
				"note":  "当前上游不支持透明通道，输出为纯白背景；蒙版画笔等局部编辑暂不可用。",
			},
			{
				"id":          "preset",
				"label":       "三视图 / 预设",
				"hint":        "场景俯视图、连续分镜与三视图",
				"presets":     presetsOut,
				"resolutions": usableRes,
			},
			{
				"id":            "view_control",
				"label":         "多角度",
				"hint":          "调整摄像机方位重绘同一画面",
				"cameraPresets": CameraPresets,
				"yaw":           map[string]int{"min": -180, "max": 180, "step": 5},
				"pitch":         map[string]int{"min": -60, "max": 60, "step": 5},
				"distances":     []map[string]any{{"value": 0, "label": "近景"}, {"value": 1, "label": "中景"}, {"value": 2, "label": "远景"}},
			},
		},
		"limitations": []string{
			"所有工具均由 Seedream 图生图重绘承接，结果为近似复刻，而非即梦原模型输出。",
			"每次生成固定输出 1 张图片；多张输出与 8K 超清暂不可用。",
			"抠图输出为纯白背景的不透明图片。",
			"三视图类预设强制 16:9 画幅，仅支持 2K / 4K。",
		},
	}
}
