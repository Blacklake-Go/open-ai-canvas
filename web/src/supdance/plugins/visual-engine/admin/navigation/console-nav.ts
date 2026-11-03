import { LayoutDashboard, Palette, Droplet, Type, Layers, Shield, MousePointerClick, Zap, GitCommit, Loader2, Compass, Eye, Package, History, MonitorCheck, ClipboardList } from "lucide-react";
import type { ConsoleModuleKey } from "../../storage/visual-engine-store";

export type ConsoleNavSection = {
    title: string;
    items: Array<{
        key: ConsoleModuleKey;
        label: string;
        shortLabel: string;
        icon: React.ComponentType<{ className?: string }>;
    }>;
};

export const CONSOLE_NAV_SECTIONS: ConsoleNavSection[] = [
    {
        title: "基础体系",
        items: [
            { key: "dashboard", label: "总览 Dashboard", shortLabel: "总览", icon: LayoutDashboard },
            { key: "themes", label: "主题中心 Themes", shortLabel: "主题", icon: Palette },
            { key: "colors", label: "色彩中心 Colors", shortLabel: "色彩", icon: Droplet },
            { key: "typography", label: "字体排版 Typography", shortLabel: "字体", icon: Type },
        ],
    },
    {
        title: "界面与光学",
        items: [
            { key: "components", label: "UI 组件 Components", shortLabel: "组件", icon: Layers },
            { key: "effects", label: "阴影遮罩 Effects", shortLabel: "阴影", icon: Shield },
            { key: "interactions", label: "交互中心 Interactions", shortLabel: "交互", icon: MousePointerClick },
        ],
    },
    {
        title: "动效与恢复",
        items: [
            { key: "motion", label: "动效引擎 Motion", shortLabel: "动效", icon: Zap },
            { key: "transitions", label: "页面过渡 Transitions", shortLabel: "过渡", icon: GitCommit },
            { key: "loading", label: "工作区恢复 Loading (图1)", shortLabel: "恢复", icon: Loader2 },
        ],
    },
    {
        title: "策略与预设",
        items: [
            { key: "pagerules", label: "页面规则 Page Rules", shortLabel: "规则", icon: Compass },
            { key: "preview", label: "实时预览 Preview", shortLabel: "预览", icon: Eye },
            { key: "presets", label: "主题预设 Presets", shortLabel: "预设", icon: Package },
        ],
    },
    {
        title: "运维与安全",
        items: [
            { key: "versions", label: "版本发布 Versions", shortLabel: "版本", icon: History },
            { key: "diagnostics", label: "兼容诊断 Diagnostics", shortLabel: "诊断", icon: MonitorCheck },
            { key: "auditlogs", label: "审计日志 Audit Logs", shortLabel: "日志", icon: ClipboardList },
        ],
    },
];
