import React from "react";
import { ArrowUp, AtSign, Globe, MessageCircle, PanelsTopLeft, Rss, Video, type LucideIcon } from "lucide-react";
import { Link } from "react-router";

export const AppStoreFooter: React.FC = () => {
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        const root = document.getElementById("app-store-scroll-root");
        if (root) root.scrollTo({ top: 0, behavior: "smooth" });
    };

    // 与主站侧栏一致：单色浅灰、线性描边的 Lucide 图标，不使用彩色实心品牌 SVG。
    const socialLinks: { name: string; Icon: LucideIcon; url: string }[] = [
        { name: "X", Icon: AtSign, url: "https://x.com/TapNow_AI" },
        { name: "YouTube", Icon: Video, url: "https://www.youtube.com/@tapnow_global" },
        { name: "TikTok", Icon: Rss, url: "https://tiktok.com" },
        { name: "Discord", Icon: MessageCircle, url: "https://discord.gg" },
        { name: "Instagram", Icon: Globe, url: "https://instagram.com" },
    ];

    return (
        <footer className="mx-auto flex w-full max-w-[1500px] flex-col bg-transparent px-5 py-10 font-sans text-white md:px-10 md:py-16 border-t border-white/[0.06] select-none">
            {/* Top row: Brand + Social Links + Back to top */}
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.10] text-zinc-300 shadow-xs">
                        <PanelsTopLeft className="size-4" strokeWidth={2.2} />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">TapNow</span>
                    <span className="text-xs text-white/40 ml-2">智能体创意画布</span>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Social Media Links */}
                    <div className="flex items-center gap-2">
                        {socialLinks.map(({ name, Icon, url }) => (
                            <a
                                key={name}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={name}
                                className="flex size-8 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.12] hover:border-white/20 hover:text-white shadow-xs active:scale-95 transition-all cursor-pointer"
                            >
                                <Icon className="size-3.5" strokeWidth={2.2} />
                            </a>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={scrollToTop}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.12] hover:border-white/20 hover:text-white shadow-xs active:scale-95 transition-all cursor-pointer select-none"
                    >
                        <ArrowUp className="size-3.5" strokeWidth={2.2} />
                        <span>回到顶部</span>
                    </button>
                </div>
            </div>

            {/* Bottom Row: Legal Links & Copyright */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-xs text-zinc-400 border-t border-white/[0.06] pt-6">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <Link to="/privacy" className="hover:text-white transition-colors">
                        隐私政策
                    </Link>
                    <Link to="/terms" className="hover:text-white transition-colors">
                        服务条款
                    </Link>
                    <Link to="/aup" className="hover:text-white transition-colors">
                        社区准则
                    </Link>
                    <Link to="/legal" className="hover:text-white transition-colors">
                        生成内容授权说明
                    </Link>
                    <button type="button" onClick={() => alert("Cookie 偏好设置已保存为暗黑高性能模式。")} className="hover:text-white transition-colors cursor-pointer">
                        Cookie 偏好设置
                    </button>
                </div>

                <div className="text-zinc-400 tabular-nums">© 2026 TapNow AI Inc. All rights reserved. · v 2.28.54</div>
            </div>
        </footer>
    );
};
