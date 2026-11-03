export const SUPDANCE_VISUAL_ENGINE_PLUGIN_ID = "supdance-visual-engine" as const;

export type ThemeMode = "dark" | "light" | "system";
export type PresetId = "native" | "dark" | "light" | "studio" | "custom";

/**
 * Primitive Tokens: 基础原子层
 */
export type PrimitiveColors = {
    brandPrimary: string;
    brandSecondary: string;
    brandAccent: string;
    gray50: string;
    gray100: string;
    gray200: string;
    gray300: string;
    gray400: string;
    gray500: string;
    gray600: string;
    gray700: string;
    gray800: string;
    gray900: string;
    gray950: string;
    pureWhite: string;
    pureBlack: string;
};

export type PrimitiveTypography = {
    fontFamilySans: string;
    fontFamilyMono: string;
    sizeLabel: number; // 11px
    sizeCaption: number; // 12px
    sizeUI: number; // 13px
    sizeBody: number; // 14px
    sizeHeading: number; // 16px
    sizeTitle: number; // 22px
    sizeDisplay: number; // 32px
};

/**
 * Semantic Tokens: 语义化层
 */
export type SemanticTokens = {
    canvas: string;
    surface: string;
    surfaceSubtle: string;
    surfaceRaised: string;
    overlay: string;
    text: string;
    textMuted: string;
    border: string;
    control: string;
    controlHover: string;
    controlActive: string;
    controlBorder: string;
    controlFocus: string;
    primary: string;
    primaryHover: string;
    primaryActive: string;
    primaryForeground: string;
    selected: string;
    selectedHover: string;
    selectedActive: string;
    selectedForeground: string;
    danger: string;
    dangerHover: string;
    dangerActive: string;
    dangerForeground: string;
    success: string;
    warning: string;
    info: string;
};

/**
 * Component Tokens: 组件层状态光学
 */
export type ComponentTokens = {
    buttonHeightRegular: number;
    buttonHeightCompact: number;
    buttonHeightMicro: number;
    buttonRadius: number;
    inputHeight: number;
    inputRadius: number;
    cardRadius: number;
    overlayRadius: number;
    menuRadius: number;
    tagRadius: number;
};

/**
 * E0–E4 阴影与光学深度系统
 */
export type ElevationLevel = "E0" | "E1" | "E2" | "E3" | "E4";

export type ElevationToken = {
    level: ElevationLevel;
    label: string;
    usage: string;
    shadowLight: string;
    shadowDark: string;
    blurRadius: number;
};

export type OverlaysConfig = {
    imageGradientOpacity: number;
    scrollEdgeOpacity: number;
    busyOpacity: number;
    modalBackdropBlur: number;
    modalBackdropOpacity: number;
    drawerBackdropBlur: number;
    drawerBackdropOpacity: number;
    menuBackdropBlur: number;
    enableTextProtectionGradient: boolean;
};

/**
 * Motion Engine 动效系统配置
 */
export type MotionConfig = {
    enabled: boolean;
    durationQuick: number; // 150ms 快速微交互
    durationDropdownEnter: number; // 200ms 下拉展开
    durationDropdownExit: number; // 150ms 下拉收起
    durationModal: number; // 200ms 弹窗展开
    durationDrawer: number; // 250ms 抽屉滑入
    durationTabSwitch: number; // 200ms 分段切换
    easingStandard: string; // cubic-bezier(0.16, 1, 0.3, 1)
    easingBounce: string; // cubic-bezier(0.34, 1.56, 0.64, 1)
    easingSmooth: string; // cubic-bezier(0.4, 0, 0.2, 1)
    reducedMotionBehavior: "instant" | "fade-only";
};

/**
 * 图 1 工作区恢复动画模块配置 (Workspace Recovery Transition)
 */
export type WorkspaceRecoveryStage = "init" | "recovering" | "syncing" | "ready" | "failed";

export type WorkspaceRecoveryConfig = {
    backgroundLight: string;
    backgroundDark: string;
    animationSpeed: number;
    exitEffect: "fade" | "instant";
    paths: string[];
    timeoutFeedback: "retry" | "reload";
    enabled: boolean;
    themeMode: "dark" | "light";
    brandLogoUrl: string;
    brandName: string;
    orbitSpeed: number; // 1.0 = normal, 0.5 = slow, 2.0 = fast
    orbitNodesCount: number; // 4 - 8
    floatingCardsCount: number; // 2 - 6
    glowIntensity: number; // 0.0 - 1.0
    gridDensity: "compact" | "normal" | "sparse";
    timeoutMs: number; // 超时重试阈值，默认 8000ms
    statusCopies: {
        init: string;
        recovering: string;
        syncing: string;
        ready: string;
        failed: string;
    };
    stageDetails: {
        auth: string;
        workspace: string;
        projects: string;
        environment: string;
    };
};

/**
 * 页面规则配置
 */
export type PageRule = {
    components?: ComponentTokens;
    overlays?: OverlaysConfig;
    elevations?: Record<ElevationLevel, ElevationToken>;
    performanceMode?: InteractionConfig["performanceMode"];
    modelPicker?: Partial<ModelPickerVisualConfig>;
    id: string;
    name: string;
    pathPattern: string; // e.g. "/admin/*", "/create/*", "/auth/*"
    themePresetOverride?: string;
    motionEnabledOverride?: boolean;
    recoveryEnabledOverride?: boolean;
    customTokens?: Partial<SemanticTokens>;
    notes?: string;
};

/**
 * 主题预设定义
 */
export type ThemePreset = {
    id: PresetId | string;
    name: string;
    description: string;
    isSystem: boolean;
    author: string;
    tokens: {
        light: SemanticTokens;
        dark: SemanticTokens;
    };
    components: ComponentTokens;
    motion?: Partial<MotionConfig>;
};

/**
 * 全站视觉引擎核心配置对象
 */
export type VisualEngineConfig = {
    typography: TypographyConfig;
    interactions: InteractionConfig;
    transitions: TransitionConfig;
    modelPicker: ModelPickerVisualConfig;
    customPresets: ThemePreset[];
    schemaVersion: 2;
    activePreset: string;
    themeMode: ThemeMode;
    tokens: {
        light: SemanticTokens;
        dark: SemanticTokens;
    };
    components: ComponentTokens;
    elevations: Record<ElevationLevel, ElevationToken>;
    overlays: OverlaysConfig;
    motion: MotionConfig;
    workspaceRecovery: WorkspaceRecoveryConfig;
    pageRules: PageRule[];
    publishedVersion: string;
    updatedAt: string;
    updatedBy: string;
};

export type TypeScale = { size: number; lineHeight: number; weight: number };
export type TypographyConfig = {
    fontFamilySans: "system" | "inter";
    fontFamilyMono: "system" | "mono";
    spacingUnit: number;
    scales: Record<"label" | "caption" | "ui" | "body" | "heading" | "title" | "display", TypeScale>;
};

export type ModelPickerVisualConfig = {
    simplified: boolean; // 模型下拉精简视图总开关（默认开启）
    hideChannelMeta: boolean; // 隐藏左侧品牌栏渠道数与平台服务标记（图 1 标记项）
    hideTelemetry: boolean; // 隐藏调用采样统计浮窗与状态指示（图 3 标记项，仅隐藏不删除底层 DOM/组件）
    cleanCardLayout: boolean; // 启用卡片式精简布局与独立积分药丸（参考图 2 样式，保留原积分区间）
};

export type InteractionConfig = {
    focusWidth: number;
    focusOffset: number;
    hoverLift: number;
    pressedScale: number;
    disabledOpacity: number;
    switchOnLight: string;
    switchOnDark: string;
    checkboxLight: string;
    checkboxDark: string;
    performanceMode: "auto" | "low" | "full";
};
export type TransitionConfig = {
    enabled: boolean;
    preset: "fade" | "slide" | "scale";
    duration: number;
    delay: number;
    distance: number;
    scale: number;
    opacity: number;
    direction: "forward" | "backward";
    paths: string[];
    components: string[];
};

/**
 * 版本快照与审计日志
 */
export type VisualEngineSnapshot = {
    version: string;
    timestamp: string;
    actor: string;
    summary: string;
    config: VisualEngineConfig;
};

export type AuditLogEntry = {
    id: string;
    timestamp: string;
    actor: string;
    module: string;
    action: string;
    details: string;
    version: string;
    success: boolean;
};
