import { useState, useId, useEffect } from "react";
import {
    Sun,
    Moon,
    Palette,
    Layers,
    Box,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    Info,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Wand2,
    Film,
    Image as ImageIcon,
    FileText,
    Bot,
    Search,
    RefreshCw,
    X,
    ArrowUpRight,
    Lock,
    Eye,
    EyeOff,
    Sliders,
    Check,
    Folder,
    ArrowRight,
    CornerDownLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/base/select";
import { Switch } from "@/components/ui/base/switch";
import { Checkbox } from "@/components/ui/base/checkbox";
import { AppModal } from "@/components/ui/product/app-modal";
import { AppDrawer } from "@/components/ui/product/app-drawer";
import { EmptyState } from "@/components/ui/product/empty-state";

export default function DesignSystemShowcase() {
    // 主题与皮肤状态
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
    const [skin, setSkin] = useState<"classic" | "aurora" | "forest">("classic");
    const [density, setDensity] = useState<"compact" | "default" | "spacious">("default");
    const [activeTab, setActiveTab] = useState<"tokens" | "buttons" | "forms" | "studio" | "overlays" | "plugin">("tokens");

    // 状态演示控制开关
    const [btnLoading, setBtnLoading] = useState(false);
    const [btnDisabled, setBtnDisabled] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showDrawer, setShowDrawer] = useState(false);

    // Studio 交互控制
    const [studioMode, setStudioMode] = useState<"video" | "image" | "text" | "agent">("image");
    const [promptText, setPromptText] = useState("");
    const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
    const [modelSearch, setModelSearch] = useState("");
    const [simulateEmptyModels, setSimulateEmptyModels] = useState(false);
    const [selectedModel, setSelectedModel] = useState("Seedream 5.0 Ultra");

    // 表单演示状态
    const [pwdVisible, setPwdVisible] = useState(false);
    const [switchVal, setSwitchVal] = useState(true);
    const [checkVal, setCheckVal] = useState(true);
    const [selectVal, setSelectVal] = useState("option1");

    // 动态同步 HTML 根 dark 类名
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }, [isDark]);

    // 皮肤变量动态注入
    useEffect(() => {
        const root = document.documentElement;
        if (skin === "classic") {
            root.style.removeProperty("--ui-primary");
            root.style.removeProperty("--ui-primary-hover");
        } else if (skin === "aurora") {
            root.style.setProperty("--ui-primary", isDark ? "#818cf8" : "#4f46e5");
            root.style.setProperty("--ui-primary-hover", isDark ? "#a5b4fc" : "#4338ca");
        } else if (skin === "forest") {
            root.style.setProperty("--ui-primary", isDark ? "#34d399" : "#059669");
            root.style.setProperty("--ui-primary-hover", isDark ? "#6ee7b7" : "#047857");
        }
    }, [skin, isDark]);

    const sampleModels = [
        { id: "m1", name: "Seedream 5.0 Ultra", tag: "满血画质", provider: "ByteDance", desc: "影视级真实感画面渲染，支持 4K 原生分辨率" },
        { id: "m2", name: "Midjourney v6.1 Pro", tag: "艺术美学", provider: "Midjourney", desc: "高光比电影质感与构图大师" },
        { id: "m3", name: "FLUX.1 Schnell [Dev]", tag: "开源顶峰", provider: "Black Forest", desc: "极速构图与精确文字渲染" },
        { id: "m4", name: "Kling 1.5 HD", tag: "镜头运动", provider: "Kuaishou", desc: "超强物理世界动力学仿真与高帧率" },
    ];

    const filteredModels = sampleModels.filter((m) => m.name.toLowerCase().includes(modelSearch.toLowerCase()) || m.provider.toLowerCase().includes(modelSearch.toLowerCase()));

    return (
        <div className="min-h-screen bg-[var(--ui-bg-canvas,#ffffff)] dark:bg-[var(--ui-bg-canvas,#0f0f11)] text-[var(--ui-text-primary,#171717)] dark:text-[var(--ui-text-primary,#f5f5f5)] transition-colors duration-200">
            {/* 顶栏控制条 */}
            <header className="sticky top-0 z-40 border-b border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] bg-[var(--ui-bg-canvas,#ffffff)]/80 dark:bg-[var(--ui-bg-canvas,#0f0f11)]/80 backdrop-blur-md px-6 h-14 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-[var(--ui-primary,#171717)] dark:bg-[var(--ui-primary,#f5f5f5)] text-[var(--ui-primary-foreground,#ffffff)] dark:text-[var(--ui-primary-foreground,#171717)] flex items-center justify-center font-bold text-sm">
                        DS
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold leading-tight">影策 UI 设计系统规范与交互实验室</h1>
                        <p className="text-[11px] text-[var(--ui-text-muted,#737373)]">基于 yingce.tv 实测 · 三层 Token 架构 · 零侵入隔离展示</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* 皮肤选择 */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--ui-bg-surface-subtle,#f7f7f7)] dark:bg-[var(--ui-bg-surface-subtle,#202020)] text-xs">
                        <Palette className="size-3.5 text-[var(--ui-text-muted,#737373)]" />
                        <span className="text-[11px] text-[var(--ui-text-muted,#737373)]">皮肤:</span>
                        <select value={skin} onChange={(e) => setSkin(e.target.value as any)} className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer">
                            <option value="classic">经典黑白 (Classic)</option>
                            <option value="aurora">极光蓝紫 (Aurora)</option>
                            <option value="forest">山岚翡翠 (Forest)</option>
                        </select>
                    </div>

                    {/* 明暗模式切换 */}
                    <button
                        onClick={() => setIsDark(!isDark)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--ui-border-control,rgba(0,0,0,0.18))] hover:bg-[var(--ui-bg-surface-raised,#ececec)] dark:hover:bg-[var(--ui-bg-surface-raised,#2a2a2a)] text-xs font-medium transition-colors"
                        title="切换明暗模式"
                    >
                        {isDark ? <Sun className="size-3.5 text-amber-400" /> : <Moon className="size-3.5 text-slate-700" />}
                        <span>{isDark ? "浅色模式" : "深色模式"}</span>
                    </button>
                </div>
            </header>

            {/* 实验室主导航 Tabs */}
            <div className="border-b border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] px-6 bg-[var(--ui-bg-surface,#ffffff)] dark:bg-[var(--ui-bg-surface,#18181b)]">
                <nav className="flex items-center gap-6 overflow-x-auto text-xs font-medium">
                    {[
                        { id: "tokens", label: "🎨 设计变量 (Tokens)" },
                        { id: "buttons", label: "🔘 按钮与状态 (Buttons & Badges)" },
                        { id: "forms", label: "📝 表单与下拉 (Forms & Controls)" },
                        { id: "studio", label: "✨ 创作复合组件 (Studio Creator)" },
                        { id: "overlays", label: "🪟 浮层与模态窗 (Overlays & Dialogs)" },
                        { id: "plugin", label: "🧩 插件与主题隔离契约 (Plugin Contract)" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "py-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                                activeTab === tab.id
                                    ? "border-[var(--ui-primary,#171717)] dark:border-[var(--ui-primary,#f5f5f5)] text-[var(--ui-text-primary,#171717)] dark:text-[var(--ui-text-primary,#f5f5f5)] font-semibold"
                                    : "border-transparent text-[var(--ui-text-muted,#737373)] hover:text-[var(--ui-text-primary,#171717)] dark:hover:text-[var(--ui-text-primary,#f5f5f5)]",
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* 主内容区域 */}
            <main className="max-w-7xl mx-auto p-6 md:p-8 flex flex-col gap-8">
                {/* 1. 设计变量 Tokens 面板 */}
                {activeTab === "tokens" && (
                    <div className="flex flex-col gap-8">
                        <section className="flex flex-col gap-4">
                            <h2 className="text-base font-semibold flex items-center gap-2">
                                <Layers className="size-4" /> 语义色彩体系 (Semantic Colors & Contrast)
                            </h2>
                            <p className="text-xs text-[var(--ui-text-muted,#737373)]">遵循 WCAG 2.2 AA 规范，深浅双主题完全镜像对称，实测参数来源于 yingce.tv 运行时。</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {[
                                    { label: "Canvas Base", variable: "--ui-bg-canvas", desc: "底板画布" },
                                    { label: "Surface Card", variable: "--ui-bg-surface", desc: "卡片表面" },
                                    { label: "Surface Subtle", variable: "--ui-bg-surface-subtle", desc: "次级列表项" },
                                    { label: "Surface Raised", variable: "--ui-bg-surface-raised", desc: "悬停抬升" },
                                    { label: "Overlay Pop", variable: "--ui-bg-overlay", desc: "浮动下拉气泡" },
                                    { label: "Primary Action", variable: "--ui-primary", desc: "主操作按钮" },
                                    { label: "Text Primary", variable: "--ui-text-primary", desc: "一级主要正文" },
                                    { label: "Text Muted", variable: "--ui-text-muted", desc: "二级辅助文字" },
                                    { label: "Border Subtle", variable: "--ui-border-subtle", desc: "极细分隔边框" },
                                    { label: "Border Control", variable: "--ui-border-control", desc: "交互控件外框" },
                                    { label: "Success Status", variable: "--ui-status-success", desc: "成功/完成" },
                                    { label: "Danger Status", variable: "--ui-status-danger", desc: "错误/删除" },
                                ].map((item) => (
                                    <div
                                        key={item.variable}
                                        className="p-3 rounded-xl border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] bg-[var(--ui-bg-surface,#ffffff)] dark:bg-[var(--ui-bg-surface,#18181b)] flex flex-col gap-2 shadow-[var(--elevation-card,none)]"
                                    >
                                        <div className="h-10 w-full rounded-md border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))]" style={{ backgroundColor: `var(${item.variable})` }} />
                                        <div>
                                            <div className="text-xs font-semibold">{item.label}</div>
                                            <div className="text-[10px] text-[var(--ui-text-muted,#737373)] font-mono">{item.variable}</div>
                                            <div className="text-[11px] text-[var(--ui-text-muted,#737373)] mt-0.5">{item.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="flex flex-col gap-4">
                            <h2 className="text-base font-semibold">排版字号阶梯 (Typography Ladder)</h2>
                            <div className="flex flex-col divide-y divide-[var(--ui-border-subtle,rgba(0,0,0,0.08))] border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] rounded-xl bg-[var(--ui-bg-surface,#ffffff)] dark:bg-[var(--ui-bg-surface,#18181b)] overflow-hidden">
                                {[
                                    { name: "Display", size: "32px / 2.0rem", weight: "700", sample: "让一个故事，从文字走向银幕。" },
                                    { name: "Title (6 档)", size: "22px / 1.375rem", weight: "600", sample: "和影策 · 体验站聊聊创作想法" },
                                    { name: "Heading (5 档)", size: "16px / 1.0rem", weight: "600", sample: "最近画布与灵感大厅" },
                                    { name: "Body (4 档)", size: "14px / 0.875rem", weight: "400", sample: "从一个画面、一个角色或一句话开始创作短剧与电影镜头。" },
                                    { name: "UI (3 档)", size: "13px / 0.8125rem", weight: "500", sample: "开始创作 · 选择图片模型 · 积分 1,530" },
                                    { name: "Caption (2 档)", size: "12px / 0.75rem", weight: "400", sample: "影视级真实感画面渲染，支持 4K 原生分辨率。" },
                                    { name: "Label (1 档)", size: "11px / 0.6875rem", weight: "600", sample: "资源与工具 · 新账号注册即表示同意服务协议" },
                                ].map((t) => (
                                    <div key={t.name} className="p-4 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
                                        <div className="w-48 shrink-0">
                                            <div className="text-xs font-semibold text-[var(--ui-text-primary,#171717)] dark:text-[var(--ui-text-primary,#f5f5f5)]">{t.name}</div>
                                            <div className="text-[11px] text-[var(--ui-text-muted,#737373)] font-mono">
                                                {t.size} · w-{t.weight}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: t.size.split(" / ")[0], fontWeight: Number(t.weight) }} className="truncate flex-1">
                                            {t.sample}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="flex flex-col gap-4">
                            <h2 className="text-base font-semibold">圆角与层级抬升 (Radii & Elevation)</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { name: "Radius 4px (--r-xs)", cls: "rounded-[4px]", desc: "复选框、角标" },
                                    { name: "Radius 8px (--r-md)", cls: "rounded-[8px]", desc: "标准按钮、输入框、菜单项" },
                                    { name: "Radius 12px (--r-lg)", cls: "rounded-[12px]", desc: "卡片、浮动面板、抽屉" },
                                    { name: "Radius 16px (--r-2xl)", cls: "rounded-[16px]", desc: "模态弹窗、提示词大容器" },
                                ].map((r) => (
                                    <div key={r.name} className={cn("p-4 border border-[var(--ui-border-control,rgba(0,0,0,0.18))] bg-[var(--ui-bg-surface-raised,#ececec)] dark:bg-[var(--ui-bg-surface-raised,#2a2a2a)] flex flex-col gap-1", r.cls)}>
                                        <div className="text-xs font-semibold">{r.name}</div>
                                        <div className="text-[11px] text-[var(--ui-text-muted,#737373)]">{r.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {/* 2. 按钮与标签展示 */}
                {activeTab === "buttons" && (
                    <div className="flex flex-col gap-8">
                        <div className="p-4 rounded-xl border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] bg-[var(--ui-bg-surface-subtle,#f7f7f7)] dark:bg-[var(--ui-bg-surface-subtle,#202020)] flex items-center justify-between">
                            <div className="text-xs">
                                <span className="font-semibold">交互状态控制台：</span>勾选以全局触发按钮的 loading 或 disabled 状态
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 text-xs cursor-pointer">
                                    <Checkbox checked={btnLoading} onChange={(e) => setBtnLoading(e.target.checked)} />
                                    <span>加载中 (Loading)</span>
                                </label>
                                <label className="flex items-center gap-2 text-xs cursor-pointer">
                                    <Checkbox checked={btnDisabled} onChange={(e) => setBtnDisabled(e.target.checked)} />
                                    <span>禁用态 (Disabled)</span>
                                </label>
                            </div>
                        </div>

                        {/* 各类变体 */}
                        <section className="flex flex-col gap-4">
                            <h3 className="text-sm font-semibold">按钮变体 (Variants)</h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    disabled={btnDisabled || btnLoading}
                                    className="h-9 px-4 rounded-lg bg-[var(--ui-primary,#171717)] dark:bg-[var(--ui-primary,#f5f5f5)] text-[var(--ui-primary-foreground,#ffffff)] dark:text-[var(--ui-primary-foreground,#171717)] hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-all flex items-center gap-2 shadow-sm"
                                >
                                    {btnLoading && <RefreshCw className="size-3.5 animate-spin" />}
                                    <span>Solid Primary 主按钮</span>
                                </button>

                                <button
                                    disabled={btnDisabled || btnLoading}
                                    className="h-9 px-4 rounded-lg bg-[var(--ui-bg-surface-subtle,#f7f7f7)] dark:bg-[var(--ui-bg-surface-subtle,#202020)] hover:bg-[var(--ui-bg-surface-raised,#ececec)] dark:hover:bg-[var(--ui-bg-surface-raised,#2a2a2a)] border border-[var(--ui-border-control,rgba(0,0,0,0.18))] text-[var(--ui-text-primary,#171717)] dark:text-[var(--ui-text-primary,#f5f5f5)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-all flex items-center gap-2"
                                >
                                    {btnLoading && <RefreshCw className="size-3.5 animate-spin" />}
                                    <span>Secondary 次级按钮</span>
                                </button>

                                <button
                                    disabled={btnDisabled || btnLoading}
                                    className="h-9 px-4 rounded-lg border border-[var(--ui-border-control,rgba(0,0,0,0.18))] hover:border-[var(--ui-text-primary,#171717)] dark:hover:border-[var(--ui-text-primary,#f5f5f5)] text-[var(--ui-text-primary,#171717)] dark:text-[var(--ui-text-primary,#f5f5f5)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-all"
                                >
                                    Outline 描边按钮
                                </button>

                                <button
                                    disabled={btnDisabled || btnLoading}
                                    className="h-9 px-4 rounded-lg hover:bg-[var(--ui-bg-surface-raised,#ececec)] dark:hover:bg-[var(--ui-bg-surface-raised,#2a2a2a)] text-[var(--ui-text-primary,#171717)] dark:text-[var(--ui-text-primary,#f5f5f5)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-all"
                                >
                                    Ghost / Text 文字按钮
                                </button>

                                <button
                                    disabled={btnDisabled || btnLoading}
                                    className="h-9 px-4 rounded-lg bg-[var(--ui-status-danger,#dc2626)] hover:bg-red-700 text-white active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm"
                                >
                                    <span>Danger 危险操作</span>
                                </button>
                            </div>
                        </section>

                        {/* 尺寸梯度 */}
                        <section className="flex flex-col gap-4">
                            <h3 className="text-sm font-semibold">尺寸档位 (Sizes: SM 30px / MD 36px / LG 42px)</h3>
                            <div className="flex items-center gap-3">
                                <button className="h-[30px] px-2.5 rounded-lg bg-[var(--ui-primary,#171717)] dark:bg-[var(--ui-primary,#f5f5f5)] text-[var(--ui-primary-foreground,#ffffff)] dark:text-[var(--ui-primary-foreground,#171717)] text-xs font-medium">
                                    Small (30px)
                                </button>
                                <button className="h-[36px] px-3.5 rounded-lg bg-[var(--ui-primary,#171717)] dark:bg-[var(--ui-primary,#f5f5f5)] text-[var(--ui-primary-foreground,#ffffff)] dark:text-[var(--ui-primary-foreground,#171717)] text-xs font-medium">
                                    Medium (36px 标准)
                                </button>
                                <button className="h-[42px] px-5 rounded-lg bg-[var(--ui-primary,#171717)] dark:bg-[var(--ui-primary,#f5f5f5)] text-[var(--ui-primary-foreground,#ffffff)] dark:text-[var(--ui-primary-foreground,#171717)] text-sm font-medium">
                                    Large (42px 宽适)
                                </button>
                            </div>
                        </section>

                        {/* 药丸与胶囊形态 */}
                        <section className="flex flex-col gap-4">
                            <h3 className="text-sm font-semibold">胶囊药丸 (Pills & Badges)</h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="h-[34px] px-3 rounded-full bg-[var(--ui-bg-surface-subtle,#f7f7f7)] dark:bg-[var(--ui-bg-surface-subtle,#202020)] border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] text-xs font-medium flex items-center gap-1.5">
                                    <Sparkles className="size-3 text-amber-500" />
                                    <span>积分: 1,530 点</span>
                                </span>
                                <span className="h-[26px] px-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-1">
                                    <CheckCircle2 className="size-3" />
                                    <span>已完成</span>
                                </span>
                                <span className="h-[26px] px-2.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center gap-1">
                                    <AlertTriangle className="size-3" />
                                    <span>排队中</span>
                                </span>
                                <span className="h-[26px] px-2.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-1">
                                    <AlertCircle className="size-3" />
                                    <span>生成失败</span>
                                </span>
                            </div>
                        </section>
                    </div>
                )}

                {/* 3. 表单与下拉 */}
                {activeTab === "forms" && (
                    <div className="flex flex-col gap-8 max-w-2xl">
                        <section className="flex flex-col gap-4">
                            <h3 className="text-sm font-semibold">标准输入框与密码框 (Inputs)</h3>
                            <div className="flex flex-col gap-3">
                                <div>
                                    <label className="text-xs font-medium mb-1 block">用户名或邮箱</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="请输入用户名或注册邮箱"
                                            className="h-10 w-full px-3 rounded-lg border border-[var(--ui-border-control,rgba(0,0,0,0.18))] bg-transparent text-xs focus:outline-none focus:border-[var(--ui-primary,#171717)] dark:focus:border-[var(--ui-primary,#f5f5f5)] focus:ring-2 focus:ring-[var(--ui-primary,#171717)]/10 transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium mb-1 block">密码输入 (带显隐切换)</label>
                                    <div className="relative">
                                        <input
                                            type={pwdVisible ? "text" : "password"}
                                            placeholder="请输入登录密码"
                                            defaultValue="SecretP@ssw0rd!"
                                            className="h-10 w-full pl-3 pr-10 rounded-lg border border-[var(--ui-border-control,rgba(0,0,0,0.18))] bg-transparent text-xs focus:outline-none focus:border-[var(--ui-primary,#171717)] dark:focus:border-[var(--ui-primary,#f5f5f5)] focus:ring-2 focus:ring-[var(--ui-primary,#171717)]/10 transition-all"
                                        />
                                        <button type="button" onClick={() => setPwdVisible(!pwdVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ui-text-muted,#737373)] hover:text-[var(--ui-text-primary,#171717)]">
                                            {pwdVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="flex flex-col gap-4">
                            <h3 className="text-sm font-semibold">开关、复选框与选择器 (Switches & Select)</h3>
                            <div className="p-4 rounded-xl border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] bg-[var(--ui-bg-surface,#ffffff)] dark:bg-[var(--ui-bg-surface,#18181b)] flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-medium">启用实时生成预演</div>
                                        <div className="text-[11px] text-[var(--ui-text-muted,#737373)]">在生成视频前实时计算 3D 摄像机位姿态</div>
                                    </div>
                                    <Switch checked={switchVal} onChange={(checked) => setSwitchVal(checked)} />
                                </div>

                                <div className="border-t border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] pt-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-medium">同意用户服务与隐私协议</div>
                                        <div className="text-[11px] text-[var(--ui-text-muted,#737373)]">阅读并遵循社区合规公约</div>
                                    </div>
                                    <Checkbox checked={checkVal} onChange={(e) => setCheckVal(e.target.checked)} />
                                </div>

                                <div className="border-t border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] pt-4">
                                    <label className="text-xs font-medium mb-1.5 block">统一 Select 下拉组件 (集成 AntD 浮层避让)</label>
                                    <Select
                                        size="md"
                                        appearance="field"
                                        value={selectVal}
                                        onChange={(val) => setSelectVal(val as string)}
                                        options={[
                                            { value: "option1", label: "Seedream 5.0 Ultra (推荐首选)" },
                                            { value: "option2", label: "Midjourney v6.1 Pro 艺术构图" },
                                            { value: "option3", label: "FLUX.1 Schnell 极速出图" },
                                        ]}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* 4. Studio 创作复合控件 (复刻 yingce.tv 核心体验) */}
                {activeTab === "studio" && (
                    <div className="flex flex-col gap-6 max-w-4xl">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl font-semibold">创作 Studio 核心交互面板 (实测复刻)</h2>
                            <p className="text-xs text-[var(--ui-text-muted,#737373)]">完整还原 yingce.tv 的模式选择卡、多行提示词输入框、模型选择浮层及空态保护机制。</p>
                        </div>

                        {/* 创作面板卡片 */}
                        <div className="rounded-2xl border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] bg-[var(--ui-bg-surface,#ffffff)] dark:bg-[var(--ui-bg-surface,#18181b)] shadow-[var(--elevation-card,none)] overflow-hidden">
                            {/* 模式页签栏 */}
                            <div className="flex items-center border-b border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] px-3 bg-[var(--ui-bg-surface-subtle,#f7f7f7)] dark:bg-[var(--ui-bg-surface-subtle,#202020)]">
                                {[
                                    { id: "video", label: "视频", icon: Film },
                                    { id: "image", label: "图片", icon: ImageIcon },
                                    { id: "text", label: "文本", icon: FileText },
                                    { id: "agent", label: "Agent", icon: Bot },
                                ].map((tab) => {
                                    const Icon = tab.icon;
                                    const isActive = studioMode === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setStudioMode(tab.id as any)}
                                            className={cn(
                                                "h-11 px-4 text-xs font-medium flex items-center gap-2 border-b-2 transition-all cursor-pointer",
                                                isActive
                                                    ? "border-[var(--ui-primary,#171717)] dark:border-[var(--ui-primary,#f5f5f5)] text-[var(--ui-text-primary,#171717)] dark:text-[var(--ui-text-primary,#f5f5f5)] font-semibold bg-[var(--ui-bg-surface,#ffffff)] dark:bg-[var(--ui-bg-surface,#18181b)] rounded-t-lg"
                                                    : "border-transparent text-[var(--ui-text-muted,#737373)] hover:text-[var(--ui-text-primary,#171717)]",
                                            )}
                                        >
                                            <Icon className="size-3.5" />
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* 提示词多行文本域 */}
                            <div className="p-4 flex flex-col gap-3">
                                <textarea
                                    rows={4}
                                    value={promptText}
                                    onChange={(e) => setPromptText(e.target.value)}
                                    placeholder="输入你的镜头、画面或故事。也可以添加参考图开始创作..."
                                    className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-[var(--ui-text-muted,#737373)]"
                                />

                                {/* 底部控制条 */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--ui-border-subtle,rgba(0,0,0,0.08))]">
                                    <div className="flex items-center gap-2 relative">
                                        {/* 模型选择器触发器 */}
                                        <button
                                            type="button"
                                            onClick={() => setIsModelPickerOpen(!isModelPickerOpen)}
                                            className="h-[34px] px-3 rounded-lg bg-[var(--ui-bg-surface-subtle,#f7f7f7)] dark:bg-[var(--ui-bg-surface-subtle,#202020)] hover:bg-[var(--ui-bg-surface-raised,#ececec)] text-xs font-medium flex items-center gap-1.5 transition-colors"
                                        >
                                            <Wand2 className="size-3.5 text-blue-500" />
                                            <span>{selectedModel}</span>
                                            {isModelPickerOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                                        </button>

                                        {/* 参数胶囊 */}
                                        <button className="h-[34px] px-3 rounded-lg bg-[var(--ui-bg-surface-subtle,#f7f7f7)] dark:bg-[var(--ui-bg-surface-subtle,#202020)] text-xs text-[var(--ui-text-muted,#737373)] hover:text-[var(--ui-text-primary,#171717)] flex items-center gap-1.5">
                                            <Sliders className="size-3.5" />
                                            <span>1:1 · 自动 · 1 张</span>
                                        </button>

                                        {/* 模型选择 Popover 浮层 */}
                                        {isModelPickerOpen && (
                                            <div className="absolute left-0 top-10 z-50 w-80 p-3 rounded-xl border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] bg-[var(--ui-bg-overlay,#ffffff)] dark:bg-[var(--ui-bg-overlay,#1f1f20)] shadow-[var(--elevation-overlay,0_20px_50px_rgba(0,0,0,0.25))] flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150">
                                                <div className="flex items-center justify-between pb-1 border-b border-[var(--ui-border-subtle,rgba(0,0,0,0.08))]">
                                                    <span className="text-xs font-semibold">选择图片/视频生成模型</span>
                                                    <button onClick={() => setSimulateEmptyModels(!simulateEmptyModels)} className="text-[10px] text-blue-500 hover:underline cursor-pointer">
                                                        {simulateEmptyModels ? "恢复模型列表" : "模拟无模型空态"}
                                                    </button>
                                                </div>

                                                {!simulateEmptyModels ? (
                                                    <>
                                                        <div className="relative">
                                                            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ui-text-muted,#737373)]" />
                                                            <input
                                                                type="text"
                                                                placeholder="搜索模型名称或提供商..."
                                                                value={modelSearch}
                                                                onChange={(e) => setModelSearch(e.target.value)}
                                                                className="h-8 w-full pl-8 pr-3 rounded-lg bg-[var(--ui-bg-surface-subtle,#f7f7f7)] dark:bg-[var(--ui-bg-surface-subtle,#202020)] text-xs focus:outline-none"
                                                            />
                                                        </div>

                                                        <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                                                            {filteredModels.map((m) => (
                                                                <button
                                                                    key={m.id}
                                                                    onClick={() => {
                                                                        setSelectedModel(m.name);
                                                                        setIsModelPickerOpen(false);
                                                                    }}
                                                                    className="p-2 rounded-lg hover:bg-[var(--ui-bg-surface-raised,#ececec)] dark:hover:bg-[var(--ui-bg-surface-raised,#2a2a2a)] text-left flex items-start justify-between gap-2 transition-colors cursor-pointer"
                                                                >
                                                                    <div>
                                                                        <div className="text-xs font-semibold flex items-center gap-1.5">
                                                                            <span>{m.name}</span>
                                                                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-normal">{m.tag}</span>
                                                                        </div>
                                                                        <div className="text-[11px] text-[var(--ui-text-muted,#737373)] line-clamp-1">{m.desc}</div>
                                                                    </div>
                                                                    {selectedModel === m.name && <Check className="size-3.5 text-blue-500 shrink-0 mt-0.5" />}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="py-6 px-4 text-center flex flex-col items-center gap-2">
                                                        <AlertCircle className="size-6 text-amber-500" />
                                                        <div className="text-xs font-medium">当前没有可用模型</div>
                                                        <p className="text-[11px] text-[var(--ui-text-muted,#737373)]">请联系系统管理员或在后台检查渠道模型授权配置。</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* 开始创作主按钮 */}
                                    <button
                                        disabled={!promptText.trim()}
                                        className="h-[34px] px-4 rounded-lg bg-[var(--ui-primary,#171717)] dark:bg-[var(--ui-primary,#f5f5f5)] text-[var(--ui-primary-foreground,#ffffff)] dark:text-[var(--ui-primary-foreground,#171717)] hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                                    >
                                        <span>开始创作</span>
                                        <CornerDownLeft className="size-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 4 张引导卡片 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { title: "生成第一个镜头", desc: "描述画面、镜头运动与光线", prompt: "电影级特写：宇航员头盔面罩反光映出远方爆发的恒星..." },
                                { title: "从参考图开始", desc: "上传风格图，生成同风格画面", prompt: "参考经典王家卫色调，香港雨夜霓虹灯下的奔跑身影..." },
                                { title: "续写故事分镜", desc: "和 AI 讨论剧情、角色与对白", prompt: "故事第一幕：古董钟表店学徒偶然发现了能暂停时间的怀表..." },
                                { title: "引用技能增强", desc: "@技能 调用分镜、配音等能力", prompt: "@分镜规划大师 为剧本生成 6 个标准景别分镜表..." },
                            ].map((card, i) => (
                                <button
                                    key={i}
                                    onClick={() => setPromptText(card.prompt)}
                                    className="p-3.5 rounded-xl border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] bg-[var(--ui-bg-surface,#ffffff)] dark:bg-[var(--ui-bg-surface,#18181b)] hover:border-[var(--ui-border-control,rgba(0,0,0,0.18))] hover:-translate-y-0.5 text-left transition-all group cursor-pointer shadow-[var(--elevation-card,none)]"
                                >
                                    <div className="text-xs font-semibold group-hover:text-blue-500 transition-colors flex items-center justify-between">
                                        <span>{card.title}</span>
                                        <ArrowUpRight className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="text-[11px] text-[var(--ui-text-muted,#737373)] mt-1">{card.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* 5. 浮层与模态窗展示 */}
                {activeTab === "overlays" && (
                    <div className="flex flex-col gap-6 max-w-2xl">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl font-semibold">浮层与弹窗系统 (Overlays & Dialogs)</h2>
                            <p className="text-xs text-[var(--ui-text-muted,#737373)]">遵循 WCAG 焦点锁定 APG，毛玻璃遮罩 (`backdrop-filter: blur(5px)`)，支持 Esc 关闭。</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowModal(true)}
                                className="h-10 px-4 rounded-lg bg-[var(--ui-primary,#171717)] dark:bg-[var(--ui-primary,#f5f5f5)] text-[var(--ui-primary-foreground,#ffffff)] dark:text-[var(--ui-primary-foreground,#171717)] text-xs font-semibold shadow-sm hover:opacity-90"
                            >
                                呼出双栏认证弹窗 (Auth Modal)
                            </button>

                            <button onClick={() => setShowDrawer(true)} className="h-10 px-4 rounded-lg border border-[var(--ui-border-control,rgba(0,0,0,0.18))] text-xs font-semibold hover:bg-[var(--ui-bg-surface-raised,#ececec)]">
                                呼出侧栏设置抽屉 (AppDrawer)
                            </button>
                        </div>

                        {/* 复刻官方实测的双栏登录弹窗 */}
                        <AppModal open={showModal} onCancel={() => setShowModal(false)} footer={null} width={1000} centered flush>
                            <div className="grid grid-cols-1 md:grid-cols-2 bg-[var(--ui-bg-surface,#ffffff)] dark:bg-[#121318] rounded-2xl overflow-hidden border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))]">
                                {/* 左侧 Hero 品牌区 */}
                                <div className="p-8 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent flex flex-col justify-between">
                                    <div className="flex flex-col gap-6">
                                        <div className="flex items-center gap-2">
                                            <div className="size-6 rounded bg-[var(--ui-primary,#171717)] dark:bg-[var(--ui-primary,#f5f5f5)] text-[var(--ui-primary-foreground,#ffffff)] dark:text-[var(--ui-primary-foreground,#171717)] flex items-center justify-center font-bold text-xs">
                                                YC
                                            </div>
                                            <span className="text-xs font-semibold tracking-wide">影策 · 体验站</span>
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold leading-tight">
                                                让一个故事，
                                                <br />
                                                从文字走向银幕。
                                            </h2>
                                            <p className="text-xs text-[var(--ui-text-muted,#737373)] mt-2">AI 驱动的影视与短剧创作平台</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2.5 mt-8">
                                        {[
                                            { title: "AI 短剧", desc: "剧本、分镜到成片" },
                                            { title: "电商广告", desc: "Agent 协作产出视频" },
                                            { title: "无限画布", desc: "节点自由编排协同" },
                                            { title: "创作 Agent", desc: "对话驱动自动拆解" },
                                        ].map((f, i) => (
                                            <div key={i} className="p-2.5 rounded-xl border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] bg-[var(--ui-bg-surface,#ffffff)]/60 dark:bg-[var(--ui-bg-surface,#18181b)]/60 text-xs">
                                                <div className="font-semibold">{f.title}</div>
                                                <div className="text-[10px] text-[var(--ui-text-muted,#737373)] mt-0.5">{f.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 右侧表单区 */}
                                <div className="p-8 flex flex-col justify-center gap-4 bg-[var(--ui-bg-surface,#ffffff)] dark:bg-[#121318]">
                                    <h3 className="text-base font-semibold">欢迎来到影策 · 体验站</h3>
                                    <div className="flex flex-col gap-3">
                                        <input type="text" placeholder="用户名或邮箱" className="h-11 px-3.5 rounded-xl border border-[var(--ui-border-control,rgba(0,0,0,0.18))] bg-black/5 dark:bg-white/5 text-xs focus:outline-none" />
                                        <input type="password" placeholder="请输入密码" className="h-11 px-3.5 rounded-xl border border-[var(--ui-border-control,rgba(0,0,0,0.18))] bg-black/5 dark:bg-white/5 text-xs focus:outline-none" />
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <label className="flex items-center gap-1.5 text-[11px] text-[var(--ui-text-muted,#737373)]">
                                            <Checkbox defaultChecked />
                                            <span>新账号注册即表示同意服务协议</span>
                                        </label>
                                        <a href="#forgot" className="text-[11px] text-[var(--ui-text-muted,#737373)] hover:underline">
                                            忘记密码？
                                        </a>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="h-11 w-full rounded-lg bg-[var(--ui-primary,#171717)] dark:bg-[var(--ui-primary,#f5f5f5)] text-[var(--ui-primary-foreground,#ffffff)] dark:text-[var(--ui-primary-foreground,#171717)] text-xs font-semibold"
                                    >
                                        登录 / 注册
                                    </button>
                                </div>
                            </div>
                        </AppModal>

                        {/* 抽屉演示 */}
                        <AppDrawer open={showDrawer} onClose={() => setShowDrawer(false)} title="系统外观与模型参数抽屉" width={400}>
                            <div className="p-4 flex flex-col gap-4 text-xs">
                                <p className="text-[var(--ui-text-muted,#737373)]">这是一个标准 AppDrawer，继承宿主全局主题与 CSS Variables。</p>
                                <div className="p-3 rounded-lg border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] bg-[var(--ui-bg-surface-subtle,#f7f7f7)] dark:bg-[var(--ui-bg-surface-subtle,#202020)]">
                                    <div className="font-semibold mb-1">抽屉内容区</div>
                                    <div>支持复杂表单、树形节点或长列表滚动。</div>
                                </div>
                            </div>
                        </AppDrawer>
                    </div>
                )}

                {/* 6. 插件与主题隔离契约 */}
                {activeTab === "plugin" && (
                    <div className="flex flex-col gap-6 max-w-3xl">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl font-semibold">插件接入契约与防覆盖演示 (Plugin Contract Demo)</h2>
                            <p className="text-xs text-[var(--ui-text-muted,#737373)]">演示第三方插件（如“AI 音效配乐生成插件”）如何完全在命名空间隔离下运行，继承当前主题色，且上游代码同步时绝不被覆盖。</p>
                        </div>

                        {/* 隔离插件视图模拟 */}
                        <div className="p-6 rounded-2xl border-2 border-dashed border-blue-500/30 bg-blue-500/5 flex flex-col gap-4">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">[Plugin Scope: .plugin-music-workbench]</span>
                                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-300">第三方独立模块</span>
                            </div>

                            <div className="p-4 rounded-xl border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] bg-[var(--ui-bg-surface,#ffffff)] dark:bg-[var(--ui-bg-surface,#18181b)] shadow-sm flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold">影视情绪配乐生成器 (Suno / Udio 引擎)</h4>
                                    <span className="text-[11px] text-[var(--ui-text-muted,#737373)] font-mono">v1.2.0</span>
                                </div>
                                <p className="text-xs text-[var(--ui-text-muted,#737373)]">插件消费宿主提供的标准 Select 与 Button 组件，自动响应当前顶部切换的“极光”、“山岚”或“经典黑白”主题，完全保持全站一致。</p>
                                <div className="flex items-center gap-2">
                                    <Select
                                        size="sm"
                                        appearance="pill"
                                        defaultValue="cinematic"
                                        options={[
                                            { value: "cinematic", label: "电影史诗级管弦乐" },
                                            { value: "cyber", label: "赛博朋克电子合成器" },
                                            { value: "noir", label: "黑色电影冷爵士" },
                                        ]}
                                        className="w-48"
                                    />
                                    <button className="h-[30px] px-4 rounded-lg bg-[var(--ui-primary,#171717)] dark:bg-[var(--ui-primary,#f5f5f5)] text-[var(--ui-primary-foreground,#ffffff)] dark:text-[var(--ui-primary-foreground,#171717)] text-xs font-semibold hover:opacity-90 transition-opacity">
                                        生成 30 秒配乐
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 防覆盖架构说明 */}
                        <div className="p-5 rounded-xl border border-[var(--ui-border-subtle,rgba(0,0,0,0.08))] bg-[var(--ui-bg-surface,#ffffff)] dark:bg-[var(--ui-bg-surface,#18181b)] flex flex-col gap-3 text-xs">
                            <h3 className="font-semibold text-sm">Git 上游更新零冲突防护承诺</h3>
                            <ul className="list-disc pl-5 flex flex-col gap-1.5 text-[var(--ui-text-muted,#737373)]">
                                <li>
                                    <strong>目录隔离</strong>：所有定制代码集中在 <code className="text-blue-500">web/src/supdance/plugins/</code> 与 <code className="text-blue-500">web/src/themes/</code>，不改动宿主页面核心源码。
                                </li>
                                <li>
                                    <strong>插槽契约</strong>：插件通过扩展点动态注入，不侵入主工作区 JSX。
                                </li>
                                <li>
                                    <strong>平滑同步</strong>：执行 <code className="text-blue-500">git fetch upstream && git merge upstream/main</code> 时，仅需核对最小插槽声明文件。
                                </li>
                            </ul>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
