import { useEffect, useState } from "react";
import { AppDrawer } from "@/components/ui/product/app-drawer";
import "./console.css";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { fetchAdminVisualEngineOverview } from "../api/visual-engine-api";
import { CONSOLE_NAV_SECTIONS } from "./navigation/console-nav";
import { ConsoleHeader } from "./layouts/console-header";
import { ConsolePreviewPanel } from "./layouts/console-preview-panel";
import { useVisualEngineStore, type ConsoleModuleKey } from "../storage/visual-engine-store";

// 子页面引入
import { DashboardPane } from "./pages/DashboardPane";
import { ThemesPane } from "./pages/ThemesPane";
import { ColorsPane } from "./pages/ColorsPane";
import { TypographyPane } from "./pages/TypographyPane";
import { ComponentsPane } from "./pages/ComponentsPane";
import { EffectsPane } from "./pages/EffectsPane";
import { InteractionsPane } from "./pages/InteractionsPane";
import { MotionPane } from "./pages/MotionPane";
import { LoadingPane } from "./pages/LoadingPane";
import { PageRulesPane } from "./pages/PageRulesPane";
import { PreviewPane } from "./pages/PreviewPane";
import { PresetsPane } from "./pages/PresetsPane";
import { VersionsPane } from "./pages/VersionsPane";
import { DiagnosticsPane } from "./pages/DiagnosticsPane";
import { AuditLogsPane } from "./pages/AuditLogsPane";

export default function VisualConsole() {
    const activeModule = useVisualEngineStore((state) => state.activeConsoleModule);
    const setConsoleModule = useVisualEngineStore((state) => state.setConsoleModule);
    const [previewOpen, setPreviewOpen] = useState(true);
    const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
    const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1536px)").matches);
    useEffect(() => {
        const query = window.matchMedia("(min-width: 1536px)");
        const update = () => setWide(query.matches);
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);
    const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState("");
    const [retry, setRetry] = useState(0);
    const enabled = useVisualEngineStore((state) => state.enabled);
    const permissions = useVisualEngineStore((state) => state.permissions);
    const locked = useAppearanceStore((state) => state.appearance.skinId !== "classic");

    useEffect(() => {
        let disposed = false;
        setLoadState("loading");
        fetchAdminVisualEngineOverview()
            .then((overview) => {
                if (disposed) return;
                useVisualEngineStore.getState().acceptOverview(overview);
                setLoadState("ready");
            })
            .catch((error) => {
                if (disposed) return;
                setLoadError(error instanceof Error ? error.message : "配置加载失败");
                setLoadState("error");
            });
        return () => {
            disposed = true;
        };
    }, [retry]);

    if (loadState === "loading")
        return (
            <p role="status" className="p-6">
                正在读取服务端视觉配置…
            </p>
        );
    if (loadState === "error")
        return (
            <div role="alert" className="p-6 space-y-3">
                <p>{loadError}</p>
                <button type="button" onClick={() => setRetry((value) => value + 1)}>
                    重新加载
                </button>
            </div>
        );
    if (!enabled)
        return (
            <p role="status" className="p-6">
                视觉引擎已停用，请从插件管理重新启用。
            </p>
        );

    const renderActiveModule = () => {
        switch (activeModule) {
            case "dashboard":
                return <DashboardPane />;
            case "themes":
                return <ThemesPane />;
            case "colors":
                return <ColorsPane />;
            case "typography":
                return <TypographyPane />;
            case "components":
                return <ComponentsPane />;
            case "effects":
                return <EffectsPane />;
            case "interactions":
                return <InteractionsPane />;
            case "motion":
                return <MotionPane />;
            case "loading":
                return <LoadingPane />;
            case "pagerules":
                return <PageRulesPane />;
            case "preview":
                return <PreviewPane />;
            case "presets":
                return <PresetsPane />;
            case "versions":
                return <VersionsPane />;
            case "diagnostics":
                return <DiagnosticsPane />;
            case "auditlogs":
                return <AuditLogsPane />;
            default:
                return <DashboardPane />;
        }
    };

    return (
        <div className="ve-console flex h-full w-full flex-col bg-background text-foreground overflow-hidden">
            {/* 统一顶栏 */}
            <ConsoleHeader previewOpen={wide ? previewOpen : mobilePreviewOpen} onTogglePreview={() => (wide ? setPreviewOpen(!previewOpen) : setMobilePreviewOpen(!mobilePreviewOpen))} />
            <label className="xl:hidden block p-3 border-b border-border text-sm">
                <span className="sr-only">视觉配置模块</span>
                <select aria-label="视觉配置模块" value={activeModule} onChange={(event) => setConsoleModule(event.target.value as ConsoleModuleKey)} className="min-h-11 w-full rounded-lg border border-border bg-card px-3">
                    {CONSOLE_NAV_SECTIONS.map((section) => (
                        <optgroup key={section.title} label={section.title}>
                            {section.items.map((item) => (
                                <option key={item.key} value={item.key}>
                                    {item.label}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </label>

            {/* 控制台主体三栏架构：左侧导航 + 中间配置工作区 + 右侧常驻预览 */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* 内部导航侧边栏 */}
                <nav className="hidden xl:block w-56 shrink-0 border-r border-border/70 bg-card/40 overflow-y-auto thin-scrollbar p-3 space-y-4" aria-label="视觉引擎内部模块导航">
                    {CONSOLE_NAV_SECTIONS.map((section) => (
                        <div key={section.title} className="space-y-1">
                            <span className="px-2.5 text-xs font-bold tracking-wider text-foreground/40 uppercase">{section.title}</span>
                            <div className="space-y-0.5">
                                {section.items.map((item) => {
                                    const isSelected = activeModule === item.key;
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            aria-pressed={isSelected}
                                            onClick={() => setConsoleModule(item.key)}
                                            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                                                isSelected ? "bg-sky-500/15 text-sky-400 font-semibold" : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                                            }`}
                                        >
                                            <item.icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-sky-400" : "text-foreground/50"}`} />
                                            <span className="truncate">{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* 中间核心配置编辑区 */}
                <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 thin-scrollbar">
                    <div className="max-w-4xl mx-auto pb-16">
                        {locked && (
                            <p role="status" className="mb-4 rounded-lg border border-border p-3 text-sm">
                                宿主后台已强制选择自定义皮肤，共享颜色、字体和组件字段为只读。请先在宿主外观设置解除强制皮肤，再发布这些字段。
                            </p>
                        )}
                        <fieldset
                            disabled={
                                (locked && ["themes", "colors", "typography", "components", "effects", "interactions"].includes(activeModule)) ||
                                (!permissions.includes("edit") && !["dashboard", "preview", "versions", "diagnostics", "auditlogs"].includes(activeModule))
                            }
                            className="min-w-0"
                        >
                            {renderActiveModule()}
                        </fieldset>
                    </div>
                </main>

                {/* 右侧独立实时沙箱预览面板 */}
                {wide && previewOpen ? (
                    <div className="w-[480px] shrink-0 min-h-0">
                        <ConsolePreviewPanel />
                    </div>
                ) : null}
            </div>
            <AppDrawer title="实时预览" open={!wide && mobilePreviewOpen} onClose={() => setMobilePreviewOpen(false)} size={480} flush>
                <ConsolePreviewPanel />
            </AppDrawer>
        </div>
    );
}
