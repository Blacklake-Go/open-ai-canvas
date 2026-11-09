import { Link } from "react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { GitHubIcon } from "./github-icon";
import { LegalThemeToggler } from "../legal/legal-theme-toggler";
import { TopbarLanguageSwitcher } from "@/supdance/plugins/i18n";
import { OFFICIAL_REPO_URL } from "./mcp-plugin-list";
import { useUserStore } from "@/stores/use-user-store";

export function McpHeader() {
    const user = useUserStore((s) => s.user);

    return (
        <header className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-zinc-200/80 bg-white/80 px-4 sm:px-8 backdrop-blur-xl transition-colors dark:border-white/10 dark:bg-[#09090c]/80">
            {/* 左侧：Logo 与品牌 */}
            <div className="flex items-center gap-3">
                <Link to="/" className="group flex items-center gap-2.5 text-base font-semibold tracking-tight no-underline">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-black ring-1 ring-black/10 dark:ring-white/15">
                        <img src="/supdance-mark.png" alt="" className="size-[27px] object-contain" />
                    </span>
                    <span className="font-bold tracking-tight text-zinc-900 dark:text-white">SupDance</span>
                </Link>
                <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-rose-600 dark:text-rose-400">MCP & PLUGINS</span>
            </div>

            {/* 中间导航 */}
            <nav className="hidden items-center gap-6 text-xs font-medium text-zinc-600 md:flex dark:text-zinc-300">
                <a href="#cli-quickstart" className="transition-colors hover:text-rose-500 dark:hover:text-white">
                    CLI 安装指南
                </a>
                <a href="#plugins-market" className="transition-colors hover:text-rose-500 dark:hover:text-white">
                    插件集市
                </a>
                <a href="#tools-schema" className="transition-colors hover:text-rose-500 dark:hover:text-white">
                    MCP 工具清单
                </a>
                <a href="#faqs" className="transition-colors hover:text-rose-500 dark:hover:text-white">
                    常见排查
                </a>
                <a href="/pricing.html" className="transition-colors hover:text-rose-500 dark:hover:text-white">
                    定价表
                </a>
                <a href={OFFICIAL_REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 transition-colors hover:text-rose-500 dark:hover:text-white">
                    <GitHubIcon className="size-3.5" />
                    <span>开源仓库</span>
                </a>
            </nav>

            {/* 右侧：多语言、明暗、GitHub Star 与登录/工作台入口 */}
            <div className="flex items-center gap-2.5">
                <div className="hidden sm:block">
                    <TopbarLanguageSwitcher surface="legal" className="min-h-9 rounded-lg border border-zinc-200 px-2.5 text-xs text-zinc-700 hover:text-zinc-900 dark:border-white/10 dark:text-zinc-300 dark:hover:text-white" />
                </div>
                <LegalThemeToggler />

                <a
                    href={OFFICIAL_REPO_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white"
                >
                    <GitHubIcon className="size-3.5" />
                    <span>Star</span>
                </a>

                {user ? (
                    <Link to="/create" className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-rose-500/25 transition-transform hover:scale-105 hover:bg-rose-600">
                        <span>进入创作台</span>
                        <ArrowRight className="size-3.5" />
                    </Link>
                ) : (
                    <Link to="/login" className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-rose-500/25 transition-transform hover:scale-105 hover:bg-rose-600">
                        <Sparkles className="size-3.5" />
                        <span>立即登录</span>
                    </Link>
                )}
            </div>
        </header>
    );
}
