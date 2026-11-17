import React from "react";
import { Link, useNavigate } from "react-router";
import { Download, Home, LayoutGrid, FolderGit2, Tv, Swords, PanelsTopLeft } from "lucide-react";

interface AppStoreHeaderProps {
    activeNav?: string;
}

const NAV_ITEMS = [
    { name: "主页", enName: "Home", path: "/home", icon: Home },
    { name: "应用市场", enName: "Apps", path: "/home/app-store", icon: LayoutGrid },
    { name: "工作空间", enName: "Workspace", path: "/canvas/projects", icon: FolderGit2 },
    { name: "TapTV", enName: "TapTV", path: "/home/taptv", icon: Tv },
    { name: "竞技场", enName: "Arena", path: "/arena", icon: Swords },
];

export const AppStoreHeader: React.FC<AppStoreHeaderProps> = ({ activeNav = "应用市场" }) => {
    const navigate = useNavigate();

    const isItemActive = (item: (typeof NAV_ITEMS)[0]) => {
        if (item.name === activeNav || item.enName === activeNav) return true;
        if (item.path === activeNav) return true;
        if (item.name === "应用市场" && (activeNav === "Apps" || activeNav === "应用市场")) return true;
        if (item.name === "主页" && (activeNav === "Home" || activeNav === "主页")) return true;
        if (item.name === "工作空间" && (activeNav === "Workspace" || activeNav === "工作空间")) return true;
        if (item.name === "竞技场" && (activeNav === "Arena" || activeNav === "竞技场")) return true;
        return false;
    };

    return (
        <header
            className="fixed top-0 left-0 right-0 z-40 h-16 bg-[#0a0a0a] border-0 select-none"
            data-testid="tapnow-app-header"
            style={{
                boxShadow: "none",
            }}
        >
            <div className="mx-auto flex h-full w-full max-w-[1500px] items-center justify-between px-4 sm:px-6 xl:px-12">
                {/* Left: Brand Logo & Desktop Download */}
                <div className="flex items-center gap-3">
                    <Link to="/home/app-store" className="group flex items-center gap-2 py-1 transition-opacity hover:opacity-90">
                        <div className="relative flex size-7 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.10] text-zinc-200 shadow-sm">
                            <PanelsTopLeft className="size-4" strokeWidth={2.2} />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-white font-sans">TapNow</span>
                    </Link>

                    {/* Desktop Download Pill: neutral grayscale translucent surface */}
                    <button
                        type="button"
                        onClick={() => {
                            window.open("https://app.tapnow.ai", "_blank");
                        }}
                        className="hidden md:inline-flex h-[28px] items-center gap-1.5 rounded-full px-2.5 text-xs font-medium cursor-pointer transition-all hover:brightness-110 active:scale-95 shadow-sm"
                        style={{
                            backgroundColor: "rgba(255, 255, 255, 0.08)",
                            color: "rgb(228, 228, 231)",
                            border: "1px solid rgba(255, 255, 255, 0.14)",
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                        }}
                    >
                        <Download className="size-3" strokeWidth={2.2} />
                        <span>下载桌面端</span>
                    </button>
                </div>

                {/* Center: Navigation Links with standard 18px SVG icons */}
                <nav className="hidden lg:flex items-center gap-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = isItemActive(item);
                        return (
                            <button
                                key={item.name}
                                type="button"
                                onClick={() => {
                                    if (item.path.startsWith("/")) {
                                        navigate(item.path);
                                    }
                                }}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer select-none active:scale-95 ${
                                    isActive ? "text-white bg-white/10 shadow-sm border border-white/10" : "text-zinc-300 hover:text-white hover:bg-white/[0.08]"
                                }`}
                            >
                                <item.icon className="size-[18px] shrink-0" strokeWidth={2.2} />
                                <span>{item.name}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Right: Pricing, Promotion & CTA */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            navigate("/pricing.html");
                        }}
                        className="text-sm font-normal text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer"
                    >
                        价格方案
                    </button>

                    {/* Tilted Promotional Tag (rotate -13.638deg) */}
                    <div
                        className="hidden xl:inline-block pointer-events-none select-none shadow-sm"
                        style={{
                            transform: "translateX(-12px) rotate(-13.638deg)",
                            transformOrigin: "right",
                            background: "rgba(30, 30, 30, 0.75)",
                            border: "1px solid rgba(255, 255, 255, 0.4)",
                            borderRadius: "14px",
                            padding: "4px 12px",
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 600,
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                        }}
                    >
                        限时送 SD2.5 × H3 免费畅用
                    </div>

                    {/* Neutral grayscale primary CTA */}
                    <button
                        type="button"
                        onClick={() => {
                            navigate("/create");
                        }}
                        className="inline-flex h-[32px] items-center justify-center rounded-xl px-3.5 text-xs font-semibold text-black transition-all cursor-pointer hover:brightness-95 active:scale-95"
                        style={{
                            backgroundColor: "rgb(255, 255, 255)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255, 255, 255, 0.25)",
                        }}
                    >
                        免费体验
                    </button>
                </div>
            </div>
        </header>
    );
};
