import { useEffect, useState } from "react";
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
import { TransitionsPane } from "./pages/TransitionsPane";
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
    const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState("");
    const [retry, setRetry] = useState(0);
    const enabled = useVisualEngineStore((state) => state.enabled);

    useEffect(() => {
        let disposed = false;
        setLoadState("loading");
        fetchAdminVisualEngineOverview().then((overview) => {
            if (disposed) return;
            useVisualEngineStore.getState().acceptOverview(overview);
            setLoadState("ready");
        }).catch((error) => {
            if (disposed) return;
            setLoadError(error instanceof Error ? error.message : "配置加载失败");
            setLoadState("error");
        });
        return () => { disposed = true; };
    }, [retry]);

    if (loadState === "loading") return <p role="status" className="p-6">正在读取服务端视觉配置…</p>;
    if (loadState === "error") return <div role="alert" className="p-6 space-y-3"><p>{loadError}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>重新加载</button></div>;
    if (!enabled) return <p role="status" className="p-6">视觉引擎已停用，请从插件管理重新启用。</p>;

    const renderActiveModule = () => {
        switch (activeModule) {
            case "dashboard": return <DashboardPane />;
            case "themes": return <ThemesPane />;
            case "colors": return <ColorsPane />;
            case "typography": return <TypographyPane />;
            case "components": return <ComponentsPane />;
            case "effects": return <EffectsPane />;
            case "interactions": return <InteractionsPane />;
            case "motion": return <MotionPane />;
            case "transitions": return <TransitionsPane />;
            case "loading": return <LoadingPane />;
            case "pagerules": return <PageRulesPane />;
            case "preview": return <PreviewPane />;
            case "presets": return <PresetsPane />;
            case "versions": return <VersionsPane />;
            case "diagnostics": return <DiagnosticsPane />;
            case "auditlogs": return <AuditLogsPane />;
            default: return <DashboardPane />;
        }
    };

    return (
        <div className="flex h-full w-full flex-col bg-background text-foreground overflow-hidden">
            {/* 统一顶栏 */}
            <ConsoleHeader
                previewOpen={previewOpen}
                onTogglePreview={() => setPreviewOpen(!previewOpen)}
            />

            {/* 控制台主体三栏架构：左侧导航 + 中间配置工作区 + 右侧常驻预览 */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* 内部导航侧边栏 */}
                <nav
                    className="w-56 shrink-0 border-r border-border/70 bg-card/40 overflow-y-auto thin-scrollbar p-3 space-y-4"
                    aria-label="视觉引擎内部模块导航"
                >
                    {CONSOLE_NAV_SECTIONS.map((section) => (
                        <div key={section.title} className="space-y-1">
                            <span className="px-2.5 text-[10px] font-bold tracking-wider text-foreground/40 uppercase">
                                {section.title}
                            </span>
                            <div className="space-y-0.5">
                                {section.items.map((item) => {
                                    const isSelected = activeModule === item.key;
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => setConsoleModule(item.key)}
                                            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                                                isSelected
                                                    ? "bg-sky-500/15 text-sky-400 font-semibold"
                                                    : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
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
                <main className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8 thin-scrollbar">
                    <div className="max-w-4xl mx-auto pb-16">
                        {renderActiveModule()}
                    </div>
                </main>

                {/* 右侧独立实时沙箱预览面板 */}
                {previewOpen ? <ConsolePreviewPanel /> : null}
            </div>
        </div>
    );
}
